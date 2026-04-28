import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  Browser,
  BrowserContext,
  Page,
  chromium,
} from 'playwright';
import { LlmService } from '../llm/llm.service';
import { CreatePageElementDto } from './dto/create-page-element.dto';
import { CrawlPageDto } from './dto/crawl-page.dto';
import {
  PageElementType,
  PageSelectorType,
} from './page-element.interface';

interface RawElement {
  elementName: string;
  elementType: PageElementType;
  selector: string;
  selectorType: PageSelectorType;
}

const COMMON_USERNAME_SELECTORS = [
  'input[name="username"]',
  'input[name="email"]',
  'input[name="user"]',
  'input[name="login"]',
  'input[name="userName"]',
  'input[id="username"]',
  'input[id="email"]',
  'input[id="user-name"]',
  'input[type="email"]',
  'input[autocomplete="username"]',
  'input[autocomplete="email"]',
  'input[data-testid="username"]',
  'input[data-testid="email"]',
];

const COMMON_PASSWORD_SELECTORS = [
  'input[type="password"]',
  'input[name="password"]',
  'input[id="password"]',
  'input[autocomplete="current-password"]',
  'input[data-testid="password"]',
];

const COMMON_SUBMIT_SELECTORS = [
  'button[type="submit"]',
  'input[type="submit"]',
  'button[name="login"]',
  'button[id="login-button"]',
  'button[data-testid="login"]',
  'button[data-testid="submit"]',
];

const SUBMIT_TEXT_PATTERN = /\b(log\s*in|sign\s*in|login|submit|continue)\b/i;

const TOKEN_STORAGE_KEYS = [
  'token',
  'accessToken',
  'access_token',
  'authToken',
  'auth_token',
  'jwt',
  'idToken',
  'id_token',
];

@Injectable()
export class CrawlerService {
  private readonly logger = new Logger(CrawlerService.name);

  constructor(private readonly llmService: LlmService) {}

  async crawl(
    dto: CrawlPageDto,
    userId: string,
  ): Promise<CreatePageElementDto[]> {
    let browser: Browser | undefined;
    try {
      browser = await chromium.launch({ headless: true });
    } catch (err) {
      this.logger.error('Failed to launch Chromium', err as Error);
      throw new ServiceUnavailableException(
        'Crawler is unavailable: failed to launch headless browser. Run "npx playwright install chromium" in the backend.',
      );
    }

    try {
      const context = await this.buildContext(browser, dto);
      const page = await context.newPage();

      if (dto.authMethod === 'credentials') {
        await this.loginWithCredentials(page, dto);
      } else if (dto.authMethod === 'token') {
        await this.applyToken(page, dto);
      }

      await page.goto(dto.pageUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      await page
        .waitForLoadState('networkidle', { timeout: 8000 })
        .catch(() => undefined);

      const raw = await this.extractElements(page);

      if (raw.length === 0) {
        throw new BadRequestException(
          'Crawler navigated to the page but found no interactive elements. Verify the URL or auth.',
        );
      }

      const useAi = dto.aiNaming !== false;
      const named = useAi
        ? await this.applyAiNaming(raw, dto, userId)
        : raw.map((r) => ({ ...r, elementName: this.toCamelCase(r.elementName) }));

      return named.map((r) => ({
        featureId: dto.featureId,
        pageUrl: dto.pageUrl,
        pageName: dto.pageName?.trim() || undefined,
        elementName: r.elementName,
        elementType: r.elementType,
        selector: r.selector,
        selectorType: r.selectorType,
        isStable: true,
      }));
    } finally {
      await browser.close().catch(() => undefined);
    }
  }

  /**
   * Ask the user's configured LLM to produce semantic camelCase names for
   * the captured elements. Falls back to a heuristic when no integration is
   * configured or the LLM fails.
   */
  private async applyAiNaming(
    raw: RawElement[],
    dto: CrawlPageDto,
    userId: string,
  ): Promise<RawElement[]> {
    const creds = await this.llmService.getUserCredentials(userId).catch(() => null);
    if (!creds) {
      this.logger.log('No LLM integration configured; using heuristic naming');
      return raw.map((r) => ({ ...r, elementName: this.toCamelCase(r.elementName) }));
    }

    const system =
      'You are a senior QA automation engineer. Given a list of UI elements scraped from a web page, return a unique, descriptive camelCase identifier for each one. Names must be short (1-4 words), human-readable, and reflect the element\'s purpose (not its tag). Suffix inputs with "Input", buttons with "Button", links with "Link", checkboxes with "Checkbox", dropdowns with "Dropdown" when it adds clarity. Do not invent meaning the data does not support; if unsure, use the existing label.';

    const payload = raw.map((r, i) => ({
      i,
      elementType: r.elementType,
      selector: r.selector,
      currentName: r.elementName,
    }));

    const userPrompt = [
      `Page URL: ${dto.pageUrl}`,
      dto.pageName ? `Page name: ${dto.pageName}` : null,
      'Return STRICT JSON of the form {"names":[{"i":0,"name":"emailInput"}, ...]}. Every input must have an output entry.',
      `Elements: ${JSON.stringify(payload)}`,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const result = await this.llmService.chatJson<{ names: Array<{ i: number; name: string }> }>(
        userId,
        system,
        userPrompt,
        { temperature: 0.1, maxOutputTokens: 1500 },
      );
      const byIndex = new Map<number, string>(
        (result?.names ?? []).map((n) => [n.i, n.name]),
      );
      const seen = new Set<string>();
      return raw.map((r, i) => {
        const candidate = byIndex.get(i);
        const cleaned = candidate
          ? this.toCamelCase(candidate)
          : this.toCamelCase(r.elementName);
        const unique = this.dedup(cleaned || `element${i + 1}`, seen);
        seen.add(unique);
        return { ...r, elementName: unique };
      });
    } catch (err) {
      this.logger.warn(`AI naming failed, falling back to heuristic: ${(err as Error).message}`);
      return raw.map((r) => ({ ...r, elementName: this.toCamelCase(r.elementName) }));
    }
  }

  private toCamelCase(input: string): string {
    if (!input) return '';
    const parts = input
      .replace(/[^A-Za-z0-9]+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (parts.length === 0) return '';
    const head = parts[0].toLowerCase();
    const tail = parts
      .slice(1)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
      .join('');
    return head + tail;
  }

  private dedup(name: string, taken: Set<string>): string {
    if (!taken.has(name)) return name;
    let n = 2;
    while (taken.has(`${name}${n}`)) n += 1;
    return `${name}${n}`;
  }

  private async buildContext(
    browser: Browser,
    dto: CrawlPageDto,
  ): Promise<BrowserContext> {
    const extraHTTPHeaders: Record<string, string> = {};
    if (dto.authMethod === 'token' && dto.authToken) {
      const value = dto.authToken.trim();
      extraHTTPHeaders['Authorization'] = value.toLowerCase().startsWith('bearer ')
        ? value
        : `Bearer ${value}`;
    }
    return browser.newContext({
      ignoreHTTPSErrors: true,
      extraHTTPHeaders:
        Object.keys(extraHTTPHeaders).length > 0 ? extraHTTPHeaders : undefined,
    });
  }

  private async loginWithCredentials(
    page: Page,
    dto: CrawlPageDto,
  ): Promise<void> {
    if (!dto.loginUrl || !dto.username || !dto.password) {
      throw new BadRequestException(
        'loginUrl, username and password are required for credential-based auth',
      );
    }

    await page.goto(dto.loginUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    const userField = await this.findFirstVisible(
      page,
      COMMON_USERNAME_SELECTORS,
    );
    if (!userField) {
      throw new BadRequestException(
        'Could not locate a username/email input on the login page.',
      );
    }
    await userField.fill(dto.username);

    const passField = await this.findFirstVisible(
      page,
      COMMON_PASSWORD_SELECTORS,
    );
    if (!passField) {
      throw new BadRequestException(
        'Could not locate a password input on the login page.',
      );
    }
    await passField.fill(dto.password);

    const submitButton = await this.findFirstVisible(
      page,
      COMMON_SUBMIT_SELECTORS,
    );

    const navPromise = page
      .waitForURL((url) => url.toString() !== dto.loginUrl, { timeout: 15000 })
      .catch(() => undefined);

    if (submitButton) {
      await submitButton.click();
    } else {
      const fallback = page
        .locator('button, input[type="button"]')
        .filter({ hasText: SUBMIT_TEXT_PATTERN })
        .first();
      if (await fallback.count()) {
        await fallback.click();
      } else {
        await passField.press('Enter');
      }
    }

    await navPromise;
    await page
      .waitForLoadState('networkidle', { timeout: 8000 })
      .catch(() => undefined);
  }

  private async applyToken(page: Page, dto: CrawlPageDto): Promise<void> {
    if (!dto.authToken) {
      throw new BadRequestException(
        'authToken is required for token-based auth',
      );
    }
    if (!dto.loginUrl) {
      return;
    }

    await page.goto(dto.loginUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    const token = dto.authToken.trim();
    await page.evaluate(
      ({ token, keys }) => {
        for (const key of keys) {
          try {
            localStorage.setItem(key, token);
            sessionStorage.setItem(key, token);
          } catch {
            // ignore storage access errors (e.g. about:blank)
          }
        }
      },
      { token, keys: TOKEN_STORAGE_KEYS },
    );
  }

  private async findFirstVisible(
    page: Page,
    selectors: readonly string[],
  ) {
    for (const sel of selectors) {
      const locator = page.locator(sel).first();
      if (await locator.count()) {
        const visible = await locator.isVisible().catch(() => false);
        if (visible) return locator;
      }
    }
    return null;
  }

  private async extractElements(page: Page): Promise<RawElement[]> {
    return page.evaluate(() => {
      const seen = new Set<string>();
      const out: Array<{
        elementName: string;
        elementType:
          | 'BUTTON'
          | 'INPUT'
          | 'LINK'
          | 'DROPDOWN'
          | 'CHECKBOX'
          | 'TEXT'
          | 'OTHER';
        selector: string;
        selectorType: 'ID' | 'CSS' | 'XPATH' | 'TEXT';
      }> = [];

      const escapeAttr = (v: string) => v.replace(/"/g, '\\"');

      const buildSelector = (
        el: Element,
      ): { selector: string; selectorType: 'ID' | 'CSS' } => {
        const id = (el as HTMLElement).id;
        if (id && /^[A-Za-z][\w-]*$/.test(id)) {
          return { selector: `#${id}`, selectorType: 'ID' };
        }
        const tag = el.tagName.toLowerCase();
        const testId = el.getAttribute('data-testid');
        if (testId)
          return {
            selector: `${tag}[data-testid="${escapeAttr(testId)}"]`,
            selectorType: 'CSS',
          };
        const name = el.getAttribute('name');
        if (name)
          return {
            selector: `${tag}[name="${escapeAttr(name)}"]`,
            selectorType: 'CSS',
          };
        const aria = el.getAttribute('aria-label');
        if (aria)
          return {
            selector: `${tag}[aria-label="${escapeAttr(aria)}"]`,
            selectorType: 'CSS',
          };
        const placeholder = el.getAttribute('placeholder');
        if (placeholder)
          return {
            selector: `${tag}[placeholder="${escapeAttr(placeholder)}"]`,
            selectorType: 'CSS',
          };
        const role = el.getAttribute('role');
        if (role)
          return {
            selector: `${tag}[role="${escapeAttr(role)}"]`,
            selectorType: 'CSS',
          };
        const cls = (el as HTMLElement).className;
        if (typeof cls === 'string' && cls.trim()) {
          const first = cls.trim().split(/\s+/)[0];
          if (first && !/[^\w-]/.test(first))
            return { selector: `${tag}.${first}`, selectorType: 'CSS' };
        }
        return { selector: tag, selectorType: 'CSS' };
      };

      const labelFor = (el: Element): string => {
        const id = (el as HTMLElement).id;
        if (id) {
          const lbl = document.querySelector(`label[for="${id}"]`);
          if (lbl?.textContent?.trim()) return lbl.textContent.trim();
        }
        const aria = el.getAttribute('aria-label');
        if (aria?.trim()) return aria.trim();
        const placeholder = el.getAttribute('placeholder');
        if (placeholder?.trim()) return placeholder.trim();
        const name = el.getAttribute('name');
        if (name?.trim()) return name.trim();
        if (el.textContent && el.textContent.trim()) {
          const text = el.textContent.trim().replace(/\s+/g, ' ');
          return text.length > 60 ? `${text.slice(0, 57)}...` : text;
        }
        return el.tagName.toLowerCase();
      };

      const isVisible = (el: Element): boolean => {
        const rect = (el as HTMLElement).getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return false;
        const style = window.getComputedStyle(el as HTMLElement);
        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          style.opacity !== '0'
        );
      };

      const push = (
        el: Element,
        type:
          | 'BUTTON'
          | 'INPUT'
          | 'LINK'
          | 'DROPDOWN'
          | 'CHECKBOX'
          | 'TEXT'
          | 'OTHER',
      ) => {
        if (!isVisible(el)) return;
        const sel = buildSelector(el);
        const key = `${type}::${sel.selector}`;
        if (seen.has(key)) return;
        seen.add(key);
        out.push({
          elementName: labelFor(el),
          elementType: type,
          selector: sel.selector,
          selectorType: sel.selectorType,
        });
      };

      const inputs = Array.from(document.querySelectorAll('input'));
      for (const i of inputs) {
        const t = (i.getAttribute('type') || 'text').toLowerCase();
        if (t === 'hidden') continue;
        if (t === 'checkbox' || t === 'radio') push(i, 'CHECKBOX');
        else if (t === 'submit' || t === 'button') push(i, 'BUTTON');
        else push(i, 'INPUT');
      }
      for (const el of Array.from(document.querySelectorAll('textarea'))) {
        push(el, 'INPUT');
      }
      for (const el of Array.from(document.querySelectorAll('select'))) {
        push(el, 'DROPDOWN');
      }
      for (const el of Array.from(document.querySelectorAll('button'))) {
        push(el, 'BUTTON');
      }
      for (const el of Array.from(
        document.querySelectorAll('[role="button"]'),
      )) {
        push(el, 'BUTTON');
      }
      for (const el of Array.from(document.querySelectorAll('a[href]'))) {
        push(el, 'LINK');
      }
      for (const el of Array.from(
        document.querySelectorAll('[role="combobox"], [role="listbox"]'),
      )) {
        push(el, 'DROPDOWN');
      }

      return out;
    });
  }
}
