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
import {
  inferAutomationFeasible,
  shouldOverrideToAutomation,
} from '../test-case/automation-feasibility.util';
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
  testData?: string;
  tags?: string[];
  comments?: string;
  automationFeasible?: boolean;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  type?: 'FUNCTIONAL' | 'REGRESSION' | 'SMOKE' | 'E2E';
}

const LLM_TIMEOUT_MS = 45_000;
const MAX_TEST_CASES = 12;

// RICE-POT + Anti-Hallucination prompt (sourced from AI_Agents project,
// adapted to emit JSON matching this project's TestCase schema instead of
// a markdown table).
const SYSTEM_PROMPT = `You are a Senior QA Tester / SDET with 15+ years of experience.

## ANTI-HALLUCINATION RULES (MANDATORY)
1. DO NOT invent features, APIs, error codes, UI elements, or behavior.
2. DO NOT assume default or "typical" system behavior.
3. If information is missing or unclear, mark it as "[NOT SPECIFIED]".
4. Every assertion must be traceable to provided input.
5. If a detail is inferred, label it explicitly as "Inference (low confidence)".

## PROCESS (RICE-POT internally)
Step 1: Extract verifiable facts from the input.
Step 2: List unknown or missing information mentally.
Step 3: Generate output ONLY from Step 1 facts.
Step 4: Apply Boundary Value Analysis, Equivalence Partitioning, Negative Testing.
Step 5: Self-check for hallucinations or contradictions.

## SCOPE BOUNDARY RULE (HIGHEST PRIORITY \u2014 OVERRIDES COVERAGE RULES)
- ONLY generate test cases for features/sections that have EXPLICIT acceptance criteria, documented behavior, or detailed descriptions in the input.
- If a feature is mentioned by name but has NO acceptance criteria \u2014 DO NOT generate test cases for it.
- Generating test cases for undocumented features = hallucination violation.

## COVERAGE RULES (APPLIES ONLY TO IN-SCOPE FEATURES WITH DOCUMENTED CRITERIA)
- For features that DO have acceptance criteria: generate THOROUGH test cases using professional test design techniques.
- Every stated acceptance criterion MUST have MULTIPLE test cases derived from it:
  \u2022 At least 1 Positive (happy path) test case
  \u2022 At least 1 Negative (invalid/error) test case
  \u2022 Boundary Value Analysis: test at boundaries (empty, min, max, just-above, just-below)
  \u2022 Equivalence Partitioning: test representative values from each valid/invalid class
  \u2022 Error Handling: test system response to unexpected inputs
  \u2022 UI Validation: test presence and behavior of UI elements mentioned or implied
  \u2022 Security: test for injection, session hijacking, unauthorized access where applicable
- Deriving Negative, Boundary, Security, and UI tests from documented criteria is NOT hallucination \u2014 it is standard QA methodology.
- Do NOT pad with redundant or truly duplicate test cases.
- A single acceptance criterion like "User can login" should yield 4-6 test cases minimum (valid login, invalid password, invalid email, empty fields, boundary inputs, UI check).

## TEST DATA INTELLIGENCE (MANDATORY \u2014 same logic as AI_Agents Test Data column)
Every test case MUST have a "testData" string filled with concrete data the tester will actually use:
- POSITIVE  \u2192 realistic VALID values (e.g. "username=standard_user, password=secret_sauce")
- NEGATIVE  \u2192 INVALID / wrong-format / wrong-type values (e.g. "email=plaintext_no_at_sign, password=short")
- BOUNDARY  \u2192 EDGE values: empty, min, max, just-above, just-below (e.g. "name=\\"\\" (empty), name='A' (1 char), name='A'\u00d7256 (max+1)")
- SECURITY  \u2192 INJECTION / XSS / auth-bypass payloads (e.g. "username=admin' OR 1=1 --", "comment=<script>alert(1)</script>")
- VALIDATION \u2192 inputs that exercise validators (e.g. "phone=12345 (too short, expected 10 digits)")
- UI         \u2192 N/A or describe element state ("hover state on submit button", or "[NOT SPECIFIED]")
Use placeholder syntax \${variable} for values that vary at runtime. If the requirement gives no concrete data, write "[NOT SPECIFIED]" \u2014 NEVER invent values that are not derivable from the input.

## TAGS (free-form feature labels, max 5)
Examples: ["Login","Authentication"], ["Cart","Checkout"], ["API","Validation"], ["Security","XSS"]. Use names that appear in the requirement text.

## COMMENTS (optional notes the tester should know)
Short notes such as "Verify on Chrome and Firefox", "Re-run after fix XYZ", "[NOT SPECIFIED]".

## AUTOMATION FEASIBILITY (MANDATORY \u2014 DEFAULT IS true)
The default value of "automationFeasible" is **true**. Mark it false ONLY for these narrow, specific cases:
1. The test relies on visual inspection, look-and-feel review, accessibility opinions, or other subjective human judgement (e.g. "verify the page looks clean", "check the colour palette feels right").
2. The test requires a real-world physical action that cannot be mocked (real OTP from a physical phone, real biometric scan, real letter in the mail, real cash payment, talking to a human support agent).
3. The test is purely exploratory \u2014 "kick the tyres" \u2014 with no concrete pass/fail criterion.

EVERYTHING ELSE is automation-feasible. This explicitly INCLUDES:
- All POSITIVE, NEGATIVE, BOUNDARY, SECURITY, VALIDATION and FUNCTIONAL category tests.
- Tests where testData is "[NOT SPECIFIED]" \u2014 the test author can fill in concrete data later; missing testData is NOT a reason to mark false.
- Tests where expectedResult is paraphrased (e.g. "user is redirected") rather than a literal selector \u2014 the test author can sharpen the assertion later.
- E2E flows, even multi-step ones, as long as each step is something a script can perform.
- Tests that reference UI elements that have not yet been crawled \u2014 the mapping step happens later.

Also: when automationFeasible is true, ADD the literal tag "Automation" to the tags array (in addition to feature tags). When false, do NOT add "Automation".

TARGET: At least 90% of generated test cases MUST be automationFeasible:true. If you find yourself marking more than 10% as false, you are being too conservative \u2014 re-read rules 1-3 above and only keep "false" for cases that genuinely match one of them.

## OUTPUT FORMAT (STRICT JSON \u2014 no markdown, no code fences, no prose)
Return ONLY a single JSON object of this EXACT shape:
{
  "testCases": [
    {
      "title": string,                    // <= 80 chars, action-oriented (e.g. "Login with valid credentials")
      "description": string,              // 1-2 sentences. PREFIX with category tag in square brackets, e.g. "[POSITIVE] ...", "[NEGATIVE] ...", "[BOUNDARY] ...", "[SECURITY] ...", "[UI] ...", "[VALIDATION] ..."
      "preconditions": string[],          // 0-5 short preconditions
      "steps": string[],                  // 2-7 specific, actionable steps
      "expectedResult": string,           // single clear sentence
      "testData": string,                 // concrete data per intelligence rules above (or "[NOT SPECIFIED]")
      "tags": string[],                   // 1-5 free-form feature/area labels (+ "Automation" iff automationFeasible=true)
      "comments": string,                 // optional notes for the tester (or "[NOT SPECIFIED]")
      "automationFeasible": boolean,      // true iff this test case can be safely automated per the AUTOMATION FEASIBILITY rules above
      "priority": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
      "type": "FUNCTIONAL" | "REGRESSION" | "SMOKE" | "E2E"
    }
  ]
}

## TYPE MAPPING (use these rules to choose the "type" field)
- "SMOKE"      \u2192 core happy-path automation candidates (Sanity)
- "REGRESSION" \u2192 negative, boundary, security, UI checks that belong in the regression suite
- "FUNCTIONAL" \u2192 standard functional checks of documented behavior
- "E2E"        \u2192 multi-step end-to-end user flows that span several features

## CATEGORY TAG (encode AI_Agents "Test Case Type" inside the description prefix)
Use one of: [POSITIVE], [NEGATIVE], [BOUNDARY], [SECURITY], [UI], [VALIDATION], [FUNCTIONAL]

## FINAL RULES
- Generate between 4 and 10 test cases. No padding, no inflation, no duplicates.
- If a step or expected result depends on info NOT in the input, write "[NOT SPECIFIED]" rather than inventing details.
- Output JSON only. No commentary, no markdown, no explanation.`;

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
      `Analyze the following requirement and generate test cases strictly per your system instructions (RICE-POT + Anti-Hallucination).\n\n` +
      `REQUIREMENT / INPUT:\n${context}\n\n` +
      `Reply with a single JSON object of shape {"testCases":[ ... ]}. No prose, no markdown, no code fences.`;

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

    const tags = this.asStringArray(raw['tags']).slice(0, 8);
    const description = this.asString(raw['description']);
    const type = this.asEnum(raw['type'], [
      'FUNCTIONAL',
      'REGRESSION',
      'SMOKE',
      'E2E',
    ]);

    let automationFeasible = this.asBoolean(
      raw['automationFeasible'] ?? raw['automation_feasible'] ?? raw['automation'],
    );
    if (automationFeasible === undefined) {
      automationFeasible = inferAutomationFeasible({ description, tags });
    } else if (
      automationFeasible === false &&
      shouldOverrideToAutomation({
        description,
        expectedResult,
        steps,
        tags,
      })
    ) {
      // Safety net: LLMs are often too conservative about the
      // automationFeasible flag (esp. when testData is "[NOT SPECIFIED]"
      // they default to false). Flip to true when the case carries an
      // automation-friendly category tag and shows no manual-only signals,
      // so we don't drown the user in false negatives.
      this.logger.debug(
        `Overriding automationFeasible: false \u2192 true for "${title.slice(0, 60)}" (clearly-automatable category)`,
      );
      automationFeasible = true;
    }

    return {
      title: title.slice(0, 200),
      description,
      preconditions,
      steps,
      expectedResult,
      testData:
        this.asString(raw['testData']) ?? this.asString(raw['test_data']),
      tags,
      comments: this.asString(raw['comments']),
      automationFeasible,
      priority: this.asEnum(raw['priority'], [
        'LOW',
        'MEDIUM',
        'HIGH',
        'CRITICAL',
      ]),
      type,
    };
  }


  private asBoolean(v: unknown): boolean | undefined {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string') {
      const s = v.trim().toLowerCase();
      if (['true', 'yes', 'y', '1', 'automation'].includes(s)) return true;
      if (['false', 'no', 'n', '0'].includes(s)) return false;
    }
    return undefined;
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
          '[POSITIVE] Verifies the requirement works correctly under normal conditions.',
        preconditions: ['User is authenticated', 'System is in a known good state'],
        steps: [
          'Navigate to the relevant page',
          'Perform the documented user action',
          'Observe the system response',
        ],
        expectedResult:
          'The system behaves exactly as described in the requirement, with no errors.',
        testData: '[NOT SPECIFIED]',
        tags: ['Smoke', 'Automation'],
        comments: 'Template test case - configure OpenAI in Settings for AI-generated cases.',
        automationFeasible: true,
        priority: 'HIGH',
        type: 'SMOKE',
      },
      {
        title: `Validation: ${seed}`,
        description:
          '[NEGATIVE] Verifies the requirement rejects invalid input with a helpful message.',
        preconditions: ['User is authenticated'],
        steps: [
          'Open the relevant form or screen',
          'Submit clearly invalid input (empty, too long, wrong format)',
        ],
        expectedResult:
          'The system blocks the action and shows a clear validation message; no data is persisted.',
        testData: 'empty string, oversized string, malformed format',
        tags: ['Validation', 'Automation'],
        comments: '[NOT SPECIFIED]',
        automationFeasible: true,
        priority: 'MEDIUM',
        type: 'FUNCTIONAL',
      },
      {
        title: `Edge case: ${seed}`,
        description:
          '[BOUNDARY] Verifies the requirement still holds at a boundary or unusual condition.',
        preconditions: ['User is authenticated'],
        steps: [
          'Reproduce the boundary condition (max length, zero, concurrent action, etc.)',
          'Trigger the documented behaviour',
        ],
        expectedResult:
          'The system handles the edge case gracefully without crashing or data loss.',
        testData: 'min, max, max+1, 0, concurrent requests',
        tags: ['Boundary', 'Automation'],
        comments: '[NOT SPECIFIED]',
        automationFeasible: true,
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
      testData: tc.testData,
      tags: tc.tags ?? [],
      comments: tc.comments,
      automationFeasible: tc.automationFeasible ?? false,
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
