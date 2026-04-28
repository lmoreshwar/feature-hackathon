import { Injectable, Logger } from '@nestjs/common';
import { chromium, type Browser, type Page } from 'playwright-core';

import { decryptSecret } from '../../common/utils/crypto.util';
import { IntegrationRepository } from '../integration/integration.repository';
import { PageElementRepository } from '../page-element/page-element.repository';
import { TestCaseRepository } from '../test-case/test-case.repository';
import { MappingRepository } from '../testcase-mapping/testcase-mapping.repository';
import { ExecutionRepository } from './test-execution.repository';

const DEFAULT_BASE_URL = 'https://www.saucedemo.com/';
const SESSION_TIMEOUT_MS = 90_000;
const PROJECT_NAME = 'Quantum AI';

interface BrowserStackCreds {
  username: string;
  accessKey: string;
}

interface BrowserStackCaps {
  os: string;
  osVersion: string;
  browser: string;
  browserVersion: string;
}

interface RunnerInput {
  executionId: string;
  featureId: string;
  testSuiteId?: string | null;
  testCaseIds?: string[];
  buildName: string;
  baseUrl?: string;
  caps?: Partial<BrowserStackCaps>;
}

interface ResolvedElement {
  elementName: string;
  elementType: string;
  selector: string;
  selectorType: string;
}

interface ResolvedTestCase {
  id: string;
  title: string;
  steps: string[];
  expectedResult: string;
  testData?: string;
  elements: ResolvedElement[];
}

interface SingleTestResult {
  testCaseId: string;
  title: string;
  passed: boolean;
  reason: string;
  sessionUrl?: string;
  videoUrl?: string;
}

const DEFAULT_CAPS: BrowserStackCaps = {
  os: 'Windows',
  osVersion: '11',
  browser: 'chrome',
  browserVersion: 'latest',
};

/**
 * Drives a BrowserStack Automate run from the test cases + mappings + page
 * elements stored for a given execution. We deliberately re-derive the
 * actions from the mapping (rather than eval'ing the saved Playwright
 * script string) so the runner stays sandboxed and the saved scripts can
 * keep evolving without breaking the executor.
 *
 * Connection model: BrowserStack exposes a Playwright-compatible WebSocket
 * endpoint (`wss://cdp.browserstack.com/playwright?caps=...`). We pass the
 * username/accessKey + session metadata through the URL-encoded caps
 * payload, then drive the page over the standard Playwright API.
 */
@Injectable()
export class BrowserStackRunnerService {
  private readonly logger = new Logger(BrowserStackRunnerService.name);

  constructor(
    private readonly integrationRepository: IntegrationRepository,
    private readonly testCaseRepository: TestCaseRepository,
    private readonly mappingRepository: MappingRepository,
    private readonly pageElementRepository: PageElementRepository,
    private readonly executionRepository: ExecutionRepository,
  ) {}

  /**
   * Background entry-point. Never throws — every failure mode is captured
   * on the Execution document so the UI can surface it.
   */
  async runInBackground(
    input: RunnerInput,
    triggeredByUserId: string,
  ): Promise<void> {
    void this.run(input, triggeredByUserId).catch((e) => {
      const msg = e instanceof Error ? e.message : 'Unknown runner failure';
      this.logger.error(
        `BrowserStack runner crashed for execution ${input.executionId}: ${msg}`,
      );
    });
  }

  async run(
    input: RunnerInput,
    triggeredByUserId: string,
  ): Promise<void> {
    const { executionId } = input;
    this.logger.log(
      `Starting BrowserStack run for execution ${executionId} (build="${input.buildName}")`,
    );

    let creds: BrowserStackCreds;
    try {
      creds = await this.loadCreds(triggeredByUserId);
    } catch (e) {
      const reason = e instanceof Error ? e.message : 'BrowserStack not configured';
      await this.markFailure(executionId, reason);
      return;
    }

    const cases = await this.resolveTestCases(input);
    if (cases.length === 0) {
      await this.markFailure(
        executionId,
        'No automation-feasible, mapped test cases were found for this scope. ' +
          'Approve at least one test case, generate a mapping with page elements, then retry.',
      );
      return;
    }

    await this.executionRepository.update(executionId, {
      status: 'RUNNING',
      totalTests: cases.length,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
    });

    const caps: BrowserStackCaps = { ...DEFAULT_CAPS, ...input.caps };
    const baseUrl = (input.baseUrl ?? DEFAULT_BASE_URL).trim();

    const results: SingleTestResult[] = [];
    let passed = 0;
    let failed = 0;

    for (const tc of cases) {
      const result = await this.runSingleCase({
        creds,
        caps,
        baseUrl,
        buildName: input.buildName,
        tc,
      });
      results.push(result);
      if (result.passed) passed += 1;
      else failed += 1;

      await this.executionRepository.update(executionId, {
        passedTests: passed,
        failedTests: failed,
      });
    }

    const primary = results[0];
    const finalStatus: 'PASSED' | 'FAILED' = failed === 0 ? 'PASSED' : 'FAILED';

    await this.executionRepository.update(executionId, {
      status: finalStatus,
      passedTests: passed,
      failedTests: failed,
      skippedTests: 0,
      reportUrl: primary?.sessionUrl ?? null,
      videoUrl: primary?.videoUrl ?? null,
      logsUrl: this.buildSummaryLog(results),
    });

    this.logger.log(
      `BrowserStack run finished for execution ${executionId}: ${finalStatus} ` +
        `(${passed}/${cases.length} passed)`,
    );
  }

  // ---------- credential loading ----------

  private async loadCreds(userId: string): Promise<BrowserStackCreds> {
    const integration = await this.integrationRepository.findByUserId(userId);
    const cfg = integration?.browserstack;
    if (!cfg?.username || !cfg.accessKeyEncrypted) {
      throw new Error(
        'BrowserStack credentials are not configured. Open Settings → Integrations, ' +
          'save your BrowserStack username and access key, then retry the build.',
      );
    }
    return {
      username: cfg.username,
      accessKey: decryptSecret(cfg.accessKeyEncrypted),
    };
  }

  // ---------- test-case resolution ----------

  private async resolveTestCases(
    input: RunnerInput,
  ): Promise<ResolvedTestCase[]> {
    let candidateIds: string[];

    if (input.testCaseIds && input.testCaseIds.length > 0) {
      candidateIds = input.testCaseIds;
    } else if (input.testSuiteId) {
      const docs = await this.testCaseRepository.findByTestSuiteId(
        input.testSuiteId,
      );
      candidateIds = docs.map((d) => d._id.toString());
    } else {
      // Whole-feature run: find every test case under the feature.
      const { items } = await this.testCaseRepository.search({
        pageIndex: 1,
        pageSize: 500,
        filters: { featureId: input.featureId },
      });
      candidateIds = items.map((d) => d._id.toString());
    }

    const out: ResolvedTestCase[] = [];

    for (const id of candidateIds) {
      const tcDoc = await this.testCaseRepository.findById(id);
      if (!tcDoc) continue;
      const tc = tcDoc.toObject() as Record<string, unknown>;

      // Skip non-automation candidates so we don't drown in "unverifiable"
      // failures on UI/exploratory cases.
      if (!tc['automationFeasible']) continue;
      if (tc['status'] !== 'APPROVED' && tc['status'] !== 'GENERATED') continue;

      const mapping = await this.mappingRepository.findByTestCaseId(id);
      if (!mapping) continue;
      const mObj = mapping.toObject() as { elementIds: string[] };
      const elementDocs = await this.pageElementRepository.findByIds(
        mObj.elementIds ?? [],
      );
      if (elementDocs.length === 0) continue;

      out.push({
        id,
        title: (tc['title'] as string) ?? 'Untitled test',
        steps: (tc['steps'] as string[]) ?? [],
        expectedResult: (tc['expectedResult'] as string) ?? '',
        testData: tc['testData'] as string | undefined,
        elements: elementDocs.map((el) => {
          const o = el.toObject() as {
            elementName: string;
            elementType: string;
            selector: string;
            selectorType: string;
          };
          return {
            elementName: o.elementName,
            elementType: o.elementType,
            selector: o.selector,
            selectorType: o.selectorType,
          };
        }),
      });
    }

    return out;
  }

  // ---------- single test execution on BrowserStack ----------

  private async runSingleCase(args: {
    creds: BrowserStackCreds;
    caps: BrowserStackCaps;
    baseUrl: string;
    buildName: string;
    tc: ResolvedTestCase;
  }): Promise<SingleTestResult> {
    const { creds, caps, baseUrl, buildName, tc } = args;

    const wsEndpoint = this.buildWsEndpoint(creds, caps, buildName, tc.title);
    let browser: Browser | null = null;
    let page: Page | null = null;

    try {
      this.logger.log(
        `[${tc.id}] Connecting to BrowserStack (${caps.os} ${caps.osVersion} · ${caps.browser})...`,
      );
      browser = await chromium.connect(wsEndpoint, {
        timeout: SESSION_TIMEOUT_MS,
      });
      page = await browser.newPage();

      await page.goto(baseUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });

      const dataMap = this.parseTestData(tc.testData);

      for (let i = 0; i < tc.elements.length; i += 1) {
        const el = tc.elements[i];
        await this.applyAction(page, el, i, dataMap);
      }

      // Heuristic verification: page is still alive, no obvious error string.
      const bodyText = await page
        .locator('body')
        .innerText({ timeout: 5_000 })
        .catch(() => '');
      const looksBroken =
        /epic sads|epic sadface|something went wrong|page not found/i.test(
          bodyText,
        );

      const passed = !looksBroken;
      const reason = passed
        ? `All ${tc.elements.length} interactions completed; page reached "${this.shortTitle(await page.title().catch(() => ''))}"`
        : `Page rendered an error message: "${bodyText.slice(0, 120)}"`;

      await this.markBrowserStackSessionStatus(
        page,
        passed ? 'passed' : 'failed',
        reason,
      );

      const sessionUrl = await this.fetchSessionUrl(page).catch(() => undefined);
      const videoUrl = sessionUrl; // BrowserStack hosts video on the session page

      this.logger.log(
        `[${tc.id}] ${passed ? 'PASS' : 'FAIL'} — ${reason}` +
          (sessionUrl ? ` · ${sessionUrl}` : ''),
      );

      return {
        testCaseId: tc.id,
        title: tc.title,
        passed,
        reason,
        sessionUrl,
        videoUrl,
      };
    } catch (e) {
      const reason = e instanceof Error ? e.message : 'Unknown runtime error';
      this.logger.warn(`[${tc.id}] FAIL — ${reason}`);
      try {
        if (page) {
          await this.markBrowserStackSessionStatus(page, 'failed', reason);
        }
      } catch {
        /* best-effort */
      }
      const sessionUrl = page
        ? await this.fetchSessionUrl(page).catch(() => undefined)
        : undefined;
      return {
        testCaseId: tc.id,
        title: tc.title,
        passed: false,
        reason,
        sessionUrl,
        videoUrl: sessionUrl,
      };
    } finally {
      try {
        await browser?.close();
      } catch {
        /* ignore */
      }
    }
  }

  // ---------- BrowserStack endpoint construction ----------

  private buildWsEndpoint(
    creds: BrowserStackCreds,
    caps: BrowserStackCaps,
    buildName: string,
    sessionName: string,
  ): string {
    const capabilities = {
      os: caps.os,
      os_version: caps.osVersion,
      browser: caps.browser,
      browser_version: caps.browserVersion,
      'browserstack.username': creds.username,
      'browserstack.accessKey': creds.accessKey,
      project: PROJECT_NAME,
      build: buildName,
      name: sessionName.slice(0, 240),
      'browserstack.networkLogs': true,
      'browserstack.console': 'errors',
    };
    const encoded = encodeURIComponent(JSON.stringify(capabilities));
    return `wss://cdp.browserstack.com/playwright?caps=${encoded}`;
  }

  // ---------- action replay ----------

  /**
   * Apply a single recorded interaction. We pick an action verb based on
   * elementType and feed it a value derived from the test case's testData
   * (or a SauceDemo-aware fallback) when needed.
   */
  private async applyAction(
    page: Page,
    el: ResolvedElement,
    index: number,
    dataMap: Record<string, string>,
  ): Promise<void> {
    const selector = this.toPlaywrightSelector(el);
    const locator = page.locator(selector).first();

    await locator.waitFor({ state: 'visible', timeout: 15_000 });

    switch (el.elementType) {
      case 'INPUT': {
        const value = this.pickValueFor(el.elementName, index, dataMap);
        await locator.fill(value);
        return;
      }
      case 'CHECKBOX': {
        await locator.check();
        return;
      }
      case 'BUTTON':
      case 'LINK': {
        await Promise.all([
          page
            .waitForLoadState('domcontentloaded', { timeout: 15_000 })
            .catch(() => undefined),
          locator.click(),
        ]);
        return;
      }
      case 'DROPDOWN': {
        const value = this.pickValueFor(el.elementName, index, dataMap);
        await locator.selectOption(value).catch(() => locator.click());
        return;
      }
      default: {
        // TEXT / OTHER — just verify presence so we don't fail the case for
        // an informational element.
        await locator.waitFor({ state: 'attached', timeout: 5_000 });
        return;
      }
    }
  }

  private toPlaywrightSelector(el: ResolvedElement): string {
    switch (el.selectorType) {
      case 'XPATH':
        return `xpath=${el.selector}`;
      case 'TEXT':
        return `text=${el.selector}`;
      case 'ID':
        return el.selector.startsWith('#') ? el.selector : `#${el.selector}`;
      default:
        return el.selector;
    }
  }

  // ---------- test data heuristics ----------

  /**
   * Best-effort parse of the `testData` field which the LLM emits as either
   *  - a comma-separated `key=value` list, or
   *  - free-form prose like `username=standard_user, password=secret_sauce`.
   * Anything that doesn't look like a key=value pair is ignored.
   */
  private parseTestData(raw?: string): Record<string, string> {
    if (!raw || raw.includes('NOT SPECIFIED')) return {};
    const out: Record<string, string> = {};
    const parts = raw
      .split(/[,;\n]/g)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const part of parts) {
      const eq = part.indexOf('=');
      if (eq <= 0) continue;
      const key = part.slice(0, eq).trim().toLowerCase();
      const val = part.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
      if (!key || !val || val.startsWith('[NOT')) continue;
      out[key] = val;
    }
    return out;
  }

  /**
   * Resolve the value to type into a given input. Order of preference:
   *  1. Exact key match in the test-case `testData` map.
   *  2. SauceDemo-aware fallback driven by element name/keywords.
   *  3. A generic "qa-value-{index}" so we never fill blanks.
   */
  private pickValueFor(
    elementName: string,
    index: number,
    dataMap: Record<string, string>,
  ): string {
    const name = (elementName || '').toLowerCase();

    const directKey = Object.keys(dataMap).find(
      (k) => name.includes(k) || k.includes(name),
    );
    if (directKey) return dataMap[directKey];

    if (/user|email|login/.test(name)) {
      return dataMap['username'] ?? dataMap['email'] ?? 'standard_user';
    }
    if (/pass|pwd/.test(name)) {
      return dataMap['password'] ?? 'secret_sauce';
    }
    if (/first/.test(name)) return dataMap['firstname'] ?? 'Quantum';
    if (/last/.test(name)) return dataMap['lastname'] ?? 'AI';
    if (/postal|zip|pin/.test(name)) {
      return dataMap['postal'] ?? dataMap['zip'] ?? '560001';
    }
    if (/phone|mobile/.test(name)) return dataMap['phone'] ?? '9876543210';

    return `qa-value-${index + 1}`;
  }

  // ---------- BrowserStack JS executor & session metadata ----------

  private async markBrowserStackSessionStatus(
    page: Page,
    status: 'passed' | 'failed',
    reason: string,
  ): Promise<void> {
    const payload = JSON.stringify({
      action: 'setSessionStatus',
      arguments: {
        status,
        reason: reason.slice(0, 256),
      },
    });
    // The JS executor magic string is a no-op `evaluate` call where the
    // FIRST arg of evaluate is the executor command. The second arg (`_`)
    // is intentionally ignored.
    await page
      .evaluate(`browserstack_executor: ${payload}`)
      .catch(() => undefined);
  }

  private async fetchSessionUrl(page: Page): Promise<string | undefined> {
    // BrowserStack returns the dashboard session URL via the JS executor's
    // `getSessionDetails` action. Result is a JSON-encoded string.
    const payload = JSON.stringify({ action: 'getSessionDetails' });
    const raw = await page
      .evaluate(`browserstack_executor: ${payload}`)
      .catch(() => undefined);
    if (typeof raw !== 'string') return undefined;
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const link =
        (parsed['public_url'] as string | undefined) ??
        (parsed['browser_url'] as string | undefined);
      return link;
    } catch {
      return undefined;
    }
  }

  // ---------- bookkeeping ----------

  private async markFailure(
    executionId: string,
    reason: string,
  ): Promise<void> {
    this.logger.warn(`Execution ${executionId} failed pre-flight: ${reason}`);
    await this.executionRepository.update(executionId, {
      status: 'FAILED',
      passedTests: 0,
      failedTests: 0,
      logsUrl: reason.slice(0, 500),
    });
  }

  private buildSummaryLog(results: SingleTestResult[]): string {
    const lines = results.map(
      (r) =>
        `${r.passed ? 'PASS' : 'FAIL'} · ${r.title} — ${r.reason}` +
        (r.sessionUrl ? ` · ${r.sessionUrl}` : ''),
    );
    return lines.join(' || ').slice(0, 1500);
  }

  private shortTitle(s: string): string {
    return (s || '').slice(0, 80);
  }
}
