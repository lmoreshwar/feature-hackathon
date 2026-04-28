import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { decryptSecret } from '../../common/utils/crypto.util';
import { IntegrationRepository } from '../integration/integration.repository';
import { JiraFetcherService } from '../integration/jira-fetcher.service';
import { TestSuiteRepository } from '../test-suite/test-suite.repository';
import { TestSuiteService } from '../test-suite/test-suite.service';
import { TestCaseRecord } from '../test-case/test-case.interface';
import { TestCaseService } from '../test-case/test-case.service';
import { CreateTestCaseDto } from '../test-case/dto/create-test-case.dto';
import { RequirementRecord } from './requirement.interface';
import { RequirementRepository } from './requirement.repository';

const AUTO_SUITE_NAME = 'Auto-generated suite';

export interface GenerateTestCasesResult {
  source: 'LLM' | 'TEMPLATE';
  generated: number;
  testCases: TestCaseRecord[];
  requirement: RequirementRecord;
  warnings: string[];
}

interface GeneratedTestCase {
  title: string;
  description?: string;
  preconditions?: string[];
  steps: string[];
  expectedResult: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  type?: 'FUNCTIONAL' | 'REGRESSION' | 'SMOKE' | 'E2E';
}

const LLM_TIMEOUT_MS = 45_000;
const MAX_TEST_CASES = 12;

const SYSTEM_PROMPT = `You are a senior QA engineer. Given a software requirement, write a concise but realistic set of test cases that thoroughly validate it.

Rules:
- Output JSON only. No prose, no markdown, no comments.
- Top-level shape: { "testCases": [ ... ] }
- Each test case: { "title": string, "description": string, "preconditions": string[], "steps": string[], "expectedResult": string, "priority": "LOW"|"MEDIUM"|"HIGH"|"CRITICAL", "type": "FUNCTIONAL"|"REGRESSION"|"SMOKE"|"E2E" }
- Cover happy path, validation/negative cases, and at least one edge case.
- Keep titles short (<= 80 chars). 2-7 steps per case. Be specific and actionable.
- Generate between 3 and 8 test cases.`;

@Injectable()
export class TestCaseGeneratorService {
  private readonly logger = new Logger(TestCaseGeneratorService.name);

  constructor(
    private readonly requirementRepository: RequirementRepository,
    private readonly testSuiteRepository: TestSuiteRepository,
    private readonly testSuiteService: TestSuiteService,
    private readonly testCaseService: TestCaseService,
    private readonly integrationRepository: IntegrationRepository,
    private readonly jiraFetcher: JiraFetcherService,
  ) {}

  async generate(
    requirementId: string,
    userId: string,
  ): Promise<GenerateTestCasesResult> {
    const requirement = await this.requirementRepository.findById(requirementId);
    if (!requirement) {
      throw new NotFoundException(
        `Requirement with id "${requirementId}" not found`,
      );
    }
    const reqRecord = this.toRecord(requirement);

    const testSuiteId = await this.resolveTestSuiteId(reqRecord, userId);
    const warnings: string[] = [];
    const context = await this.buildContext(reqRecord, userId, warnings);

    const llmCfg = await this.loadLlmConfig(userId);

    let generated: GeneratedTestCase[];
    let source: 'LLM' | 'TEMPLATE';

    if (llmCfg) {
      // LLM is configured -> we MUST use it. No silent fallback to template.
      // This way the user sees exactly what's wrong with their integration.
      try {
        generated = await this.generateWithLlm(llmCfg, context);
      } catch (e) {
        await this.requirementRepository.update(requirementId, {
          status: 'FAILED',
        });
        const msg = e instanceof Error ? e.message : 'Unknown LLM error';
        this.logger.error(`LLM generation failed for ${requirementId}: ${msg}`);
        throw new BadRequestException(
          `${llmCfg.provider} test-case generation failed: ${msg}`,
        );
      }
      if (generated.length === 0) {
        await this.requirementRepository.update(requirementId, {
          status: 'FAILED',
        });
        throw new BadRequestException(
          `${llmCfg.provider} returned no usable test cases. Try rewording the requirement or switching models.`,
        );
      }
      source = 'LLM';
    } else {
      // No LLM configured -> degrade to template so the button still does
      // something for first-time users, but tell them to wire up OpenAI.
      generated = this.templateTestCases(context);
      source = 'TEMPLATE';
      warnings.push(
        'No LLM integration configured. Used a template instead. Configure OpenAI in Settings → Integrations to get AI-generated test cases.',
      );
    }

    const dtos: CreateTestCaseDto[] = generated
      .slice(0, MAX_TEST_CASES)
      .map((tc) => this.toCreateDto(tc, reqRecord, testSuiteId));

    const created = await Promise.all(
      dtos.map((dto) => this.testCaseService.create(dto, userId)),
    );

    const updated = await this.requirementRepository.update(requirementId, {
      status: created.length > 0 ? 'PROCESSED' : 'FAILED',
    });

    return {
      source,
      generated: created.length,
      testCases: created,
      requirement: updated ? this.toRecord(updated) : reqRecord,
      warnings,
    };
  }

  // ---------- helpers ----------

  private async resolveTestSuiteId(
    req: RequirementRecord,
    userId: string,
  ): Promise<string> {
    if (req.testSuiteId) {
      return req.testSuiteId;
    }

    // Re-use any existing suite under this feature (most-recent first).
    const suites = await this.testSuiteRepository.findByFeatureId(req.featureId);
    if (suites.length > 0) {
      // Prefer the auto-generated bucket if it already exists, so repeat
      // generations stay grouped together rather than landing in a random
      // user-created suite.
      const auto = suites.find((s) => {
        const obj = s.toObject() as Record<string, unknown>;
        return (obj['moduleName'] as string) === AUTO_SUITE_NAME;
      });
      return (auto ?? suites[0])._id.toString();
    }

    // No suites at all → create a default one so the user doesn't have to
    // manage suites just to get test cases generated.
    this.logger.log(
      `Auto-creating "${AUTO_SUITE_NAME}" for feature ${req.featureId}`,
    );
    const created = await this.testSuiteService.createTestSuite(
      {
        featureId: req.featureId,
        moduleName: AUTO_SUITE_NAME,
        description:
          'Test suite created automatically when generating test cases from a requirement.',
        version: '1.0.0',
        status: 'DRAFT',
      },
      userId,
    );
    return created._id;
  }

  private async buildContext(
    req: RequirementRecord,
    userId: string,
    warnings: string[],
  ): Promise<string> {
    const parts: string[] = [];

    if (req.requirementText) {
      parts.push(`Requirement text:\n${req.requirementText.trim()}`);
    }

    if (req.jiraId) {
      try {
        const jira = await this.jiraFetcher.fetchTicket(userId, req.jiraId);
        const lines = [
          `Jira ticket ${jira.primary.key}: ${jira.primary.summary}`,
        ];
        if (jira.primary.description?.trim()) {
          lines.push(`Description: ${jira.primary.description.trim()}`);
        }
        if (jira.related.length) {
          lines.push(
            `Related: ${jira.related
              .map(
                (r) =>
                  `${r.key} (${r.relation}${r.linkType ? ` · ${r.linkType}` : ''}) ${r.summary}`,
              )
              .join('; ')}`,
          );
        }
        parts.push(lines.join('\n'));
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'unknown error';
        warnings.push(`Could not fetch Jira ticket ${req.jiraId}: ${msg}`);
        parts.push(`Jira ticket reference: ${req.jiraId}`);
      }
    }

    if (req.confluenceUrl) {
      parts.push(`Confluence reference: ${req.confluenceUrl}`);
    }

    if (req.rawContent) {
      parts.push(`Additional context:\n${req.rawContent}`);
    }

    if (parts.length === 0) {
      parts.push('Requirement source has no text yet.');
    }

    return parts.join('\n\n');
  }

  // ---------- LLM ----------

  private async loadLlmConfig(userId: string): Promise<{
    provider: 'OPENAI' | 'AZURE_OPENAI' | 'ANTHROPIC';
    apiKey: string;
    model: string;
  } | null> {
    const integration = await this.integrationRepository.findByUserId(userId);
    const cfg = integration?.llm;
    if (!cfg?.provider || !cfg.apiKeyEncrypted) return null;
    return {
      provider: cfg.provider,
      apiKey: decryptSecret(cfg.apiKeyEncrypted),
      model: cfg.model || this.defaultModel(cfg.provider),
    };
  }

  private defaultModel(
    provider: 'OPENAI' | 'AZURE_OPENAI' | 'ANTHROPIC',
  ): string {
    if (provider === 'ANTHROPIC') return 'claude-3-5-sonnet-latest';
    return 'gpt-4o-mini';
  }

  private async generateWithLlm(
    cfg: { provider: 'OPENAI' | 'AZURE_OPENAI' | 'ANTHROPIC'; apiKey: string; model: string },
    context: string,
  ): Promise<GeneratedTestCase[]> {
    const userPrompt =
      `Generate test cases for the following requirement. ` +
      `Reply with a single JSON object of shape {"testCases":[ ... ]}. No prose.\n\n${context}`;

    this.logger.log(
      `Calling ${cfg.provider} (${cfg.model}) to generate test cases...`,
    );

    let raw: string;
    if (cfg.provider === 'ANTHROPIC') {
      raw = await this.callAnthropic(cfg.apiKey, cfg.model, userPrompt);
    } else {
      raw = await this.callOpenAi(cfg.apiKey, cfg.model, userPrompt);
    }

    const cases = this.parseTestCases(raw);
    this.logger.log(
      `${cfg.provider} returned ${cases.length} usable test case(s).`,
    );
    return cases;
  }

  private async callOpenAi(
    apiKey: string,
    model: string,
    userPrompt: string,
  ): Promise<string> {
    // response_format: json_object is only supported on gpt-4o, gpt-4-turbo,
    // gpt-3.5-turbo-1106+. Fall back to plain JSON-via-prompt for older models
    // so we don't get a hard 400 from OpenAI.
    const supportsJsonMode = /(gpt-4o|gpt-4-turbo|gpt-4\.1|gpt-3\.5-turbo-(1106|0125))/i.test(
      model,
    );

    const body: Record<string, unknown> = {
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
    };
    if (supportsJsonMode) {
      body['response_format'] = { type: 'json_object' };
    }

    const data = await this.httpJson(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
      'OpenAI',
    );

    const content =
      ((data as Record<string, unknown>)['choices'] as
        | Array<{ message?: { content?: string } }>
        | undefined)?.[0]?.message?.content;
    if (!content) {
      throw new Error('OpenAI returned an empty completion.');
    }
    return content;
  }

  private async callAnthropic(
    apiKey: string,
    model: string,
    userPrompt: string,
  ): Promise<string> {
    const body = {
      model,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
      temperature: 0.2,
    };

    const data = await this.httpJson(
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
      'Anthropic',
    );

    const content = (data as Record<string, unknown>)['content'] as
      | Array<{ type?: string; text?: string }>
      | undefined;
    const text = content?.find((c) => c.type === 'text')?.text;
    if (!text) {
      throw new Error('Anthropic returned an empty completion.');
    }
    return text;
  }

  private async httpJson(
    url: string,
    init: RequestInit,
    providerLabel: string,
  ): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      const text = await res.text();

      if (!res.ok) {
        let detail = text.slice(0, 300) || res.statusText;
        try {
          const parsed = JSON.parse(text) as Record<string, unknown>;
          const errObj = parsed['error'] as
            | { message?: string; code?: string; type?: string }
            | undefined;
          if (errObj?.message) {
            detail = errObj.message;
          } else if (typeof parsed['message'] === 'string') {
            detail = parsed['message'] as string;
          }
        } catch {
          /* fall through with raw text */
        }
        throw new Error(`${providerLabel} HTTP ${res.status}: ${detail}`);
      }

      try {
        return JSON.parse(text);
      } catch {
        throw new Error(`${providerLabel} returned a non-JSON response.`);
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') {
        throw new Error(
          `${providerLabel} request timed out after ${LLM_TIMEOUT_MS / 1000}s.`,
        );
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  private parseTestCases(raw: string): GeneratedTestCase[] {
    const json = this.extractJson(raw);
    if (!json) return [];

    const candidates = (() => {
      if (Array.isArray(json)) return json;
      const obj = json as Record<string, unknown>;
      if (Array.isArray(obj['testCases'])) return obj['testCases'];
      if (Array.isArray(obj['test_cases'])) return obj['test_cases'];
      if (Array.isArray(obj['tests'])) return obj['tests'];
      return [];
    })() as Array<Record<string, unknown>>;

    return candidates.map((c) => this.normaliseTestCase(c)).filter(Boolean) as GeneratedTestCase[];
  }

  private extractJson(raw: string): unknown {
    const trimmed = raw.trim();
    try {
      return JSON.parse(trimmed);
    } catch {
      // Strip ```json fences if present.
      const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
      if (fenceMatch) {
        try {
          return JSON.parse(fenceMatch[1]);
        } catch {
          /* fall through */
        }
      }
      return null;
    }
  }

  private normaliseTestCase(
    raw: Record<string, unknown>,
  ): GeneratedTestCase | null {
    const title = this.asString(raw['title']);
    const expectedResult =
      this.asString(raw['expectedResult']) ?? this.asString(raw['expected_result']);
    const steps = this.asStringArray(raw['steps']);

    if (!title || !expectedResult || steps.length === 0) return null;

    const preconditions =
      this.asStringArray(raw['preconditions']) ??
      (this.asString(raw['preconditions'])
        ? [this.asString(raw['preconditions']) as string]
        : []);

    return {
      title: title.slice(0, 200),
      description: this.asString(raw['description']),
      preconditions,
      steps,
      expectedResult,
      priority: this.asEnum(raw['priority'], [
        'LOW',
        'MEDIUM',
        'HIGH',
        'CRITICAL',
      ]),
      type: this.asEnum(raw['type'], [
        'FUNCTIONAL',
        'REGRESSION',
        'SMOKE',
        'E2E',
      ]),
    };
  }

  private asString(v: unknown): string | undefined {
    return typeof v === 'string' && v.trim() ? v.trim() : undefined;
  }

  private asStringArray(v: unknown): string[] {
    if (!Array.isArray(v)) return [];
    return v
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((s) => s.length > 0);
  }

  private asEnum<T extends string>(
    v: unknown,
    allowed: readonly T[],
  ): T | undefined {
    if (typeof v !== 'string') return undefined;
    const upper = v.toUpperCase() as T;
    return allowed.includes(upper) ? upper : undefined;
  }

  // ---------- template fallback ----------

  private templateTestCases(context: string): GeneratedTestCase[] {
    const seed = context.slice(0, 80).replace(/\s+/g, ' ').trim() || 'requirement';
    return [
      {
        title: `Happy path: ${seed}`,
        description:
          'Verifies the requirement works correctly under normal conditions.',
        preconditions: ['User is authenticated', 'System is in a known good state'],
        steps: [
          'Navigate to the relevant page',
          'Perform the documented user action',
          'Observe the system response',
        ],
        expectedResult:
          'The system behaves exactly as described in the requirement, with no errors.',
        priority: 'HIGH',
        type: 'FUNCTIONAL',
      },
      {
        title: `Validation: ${seed}`,
        description:
          'Verifies the requirement rejects invalid input with a helpful message.',
        preconditions: ['User is authenticated'],
        steps: [
          'Open the relevant form or screen',
          'Submit clearly invalid input (empty, too long, wrong format)',
        ],
        expectedResult:
          'The system blocks the action and shows a clear validation message; no data is persisted.',
        priority: 'MEDIUM',
        type: 'FUNCTIONAL',
      },
      {
        title: `Edge case: ${seed}`,
        description:
          'Verifies the requirement still holds at a boundary or unusual condition.',
        preconditions: ['User is authenticated'],
        steps: [
          'Reproduce the boundary condition (max length, zero, concurrent action, etc.)',
          'Trigger the documented behaviour',
        ],
        expectedResult:
          'The system handles the edge case gracefully without crashing or data loss.',
        priority: 'MEDIUM',
        type: 'REGRESSION',
      },
    ];
  }

  // ---------- mapping ----------

  private toCreateDto(
    tc: GeneratedTestCase,
    req: RequirementRecord,
    testSuiteId: string,
  ): CreateTestCaseDto {
    return {
      featureId: req.featureId,
      testSuiteId,
      title: tc.title,
      description: tc.description,
      preconditions: tc.preconditions ?? [],
      steps: tc.steps,
      expectedResult: tc.expectedResult,
      priority: tc.priority ?? 'MEDIUM',
      type: tc.type ?? 'FUNCTIONAL',
      status: 'GENERATED',
      referenceInfo: {
        ...(req.jiraId ? { jiraId: req.jiraId } : {}),
        ...(req.confluenceUrl ? { confluenceUrl: req.confluenceUrl } : {}),
        ...(req.requirementText
          ? { requirementText: req.requirementText.slice(0, 500) }
          : {}),
      },
    };
  }

  private toRecord(doc: any): RequirementRecord {
    const obj = (doc.toObject?.() ?? doc) as Record<string, unknown>;
    return {
      _id: doc._id?.toString?.() ?? (obj['_id'] as string),
      featureId: obj['featureId'] as string,
      testSuiteId: (obj['testSuiteId'] as string) ?? undefined,
      jiraId: (obj['jiraId'] as string) ?? undefined,
      confluenceUrl: (obj['confluenceUrl'] as string) ?? undefined,
      requirementText: (obj['requirementText'] as string) ?? undefined,
      rawContent: (obj['rawContent'] as string) ?? undefined,
      status: obj['status'] as RequirementRecord['status'],
      createdBy: obj['createdBy'] as string,
      createdAt: obj['createdAt'] as number,
      updatedAt: obj['updatedAt'] as number,
    };
  }
}
