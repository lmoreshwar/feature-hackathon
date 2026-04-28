import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TestCaseMappingDocument } from '../../common/schemas';
import { PaginatedResult } from '../../common/interfaces/api-response.interface';
import { paginate } from '../../common/utils/search-query.util';
import { assertValidObjectId } from '../../common/utils/object-id.util';
import { PageElementRepository } from '../page-element/page-element.repository';
import { TestCaseRepository } from '../test-case/test-case.repository';
import { LlmService } from '../llm/llm.service';
import { CreateMappingDto } from './dto/create-mapping.dto';
import { GenerateScriptDto } from './dto/generate-script.dto';
import { PushToGitDto } from './dto/push-to-git.dto';
import { SearchMappingDto } from './dto/search-mapping.dto';
import { UpdateMappingDto } from './dto/update-mapping.dto';
import { generateScript } from './script-generator.util';
import { MappingRecord } from './testcase-mapping.interface';
import { MappingRepository } from './testcase-mapping.repository';

export interface StepSuggestion {
  stepIndex: number;
  step: string;
  elementId: string | null;
  elementName?: string;
  selector?: string;
  confidence?: number;
  reason?: string;
}

export interface MappingSuggestion {
  testCaseId: string;
  featureId: string;
  testSuiteId: string;
  steps: StepSuggestion[];
  /** Convenience: deduplicated, in-order list of suggested element ids. */
  elementIds: string[];
}

@Injectable()
export class MappingService {
  constructor(
    private readonly mappingRepository: MappingRepository,
    private readonly testCaseRepository: TestCaseRepository,
    private readonly pageElementRepository: PageElementRepository,
    private readonly llmService: LlmService,
  ) {}

  async create(
    dto: CreateMappingDto,
    createdBy: string,
  ): Promise<MappingRecord> {
    assertValidObjectId(dto.featureId, 'featureId');
    assertValidObjectId(dto.testSuiteId, 'testSuiteId');
    assertValidObjectId(dto.testCaseId, 'testCaseId');

    const tc = await this.testCaseRepository.findById(dto.testCaseId);
    if (!tc) {
      throw new NotFoundException(
        `Test case with id "${dto.testCaseId}" not found`,
      );
    }

    const elements = await this.pageElementRepository.findByIds(dto.elementIds);
    if (elements.length !== dto.elementIds.length) {
      throw new BadRequestException(
        'One or more elementIds are invalid or missing',
      );
    }

    const existing = await this.mappingRepository.findByTestCaseId(
      dto.testCaseId,
    );
    if (existing) {
      const updated = await this.mappingRepository.update(
        existing._id.toString(),
        {
          elementIds: dto.elementIds,
          scriptType: dto.scriptType ?? 'PLAYWRIGHT',
          generatedScript: dto.generatedScript ?? null,
        },
      );
      return this.toRecord(updated);
    }

    const created = await this.mappingRepository.create({
      featureId: dto.featureId,
      testSuiteId: dto.testSuiteId,
      testCaseId: dto.testCaseId,
      elementIds: dto.elementIds,
      scriptType: dto.scriptType ?? 'PLAYWRIGHT',
      generatedScript: dto.generatedScript ?? null,
      gitPushStatus: 'NOT_PUSHED',
      createdBy,
    });
    return this.toRecord(created);
  }

  async getById(id: string): Promise<MappingRecord> {
    assertValidObjectId(id);
    const found = await this.mappingRepository.findById(id);
    if (!found) {
      throw new NotFoundException(`Mapping with id "${id}" not found`);
    }
    return this.toRecord(found);
  }

  async getByTestCaseId(testCaseId: string): Promise<MappingRecord | null> {
    assertValidObjectId(testCaseId, 'testCaseId');
    const found = await this.mappingRepository.findByTestCaseId(testCaseId);
    return found ? this.toRecord(found) : null;
  }

  async search(
    dto: SearchMappingDto,
  ): Promise<PaginatedResult<MappingRecord>> {
    const pageIndex = dto.pageIndex ?? 1;
    const pageSize = dto.pageSize ?? 10;
    const { items, total } = await this.mappingRepository.search(dto);
    return paginate(
      items.map((i) => this.toRecord(i)),
      total,
      pageIndex,
      pageSize,
    );
  }

  async update(
    id: string,
    dto: UpdateMappingDto,
  ): Promise<MappingRecord> {
    assertValidObjectId(id);
    const updated = await this.mappingRepository.update(id, {
      elementIds: dto.elementIds,
      scriptType: dto.scriptType,
      generatedScript: dto.generatedScript,
      gitPushStatus: dto.gitPushStatus,
    });
    if (!updated) {
      throw new NotFoundException(`Mapping with id "${id}" not found`);
    }
    return this.toRecord(updated);
  }

  async delete(id: string): Promise<{ id: string }> {
    assertValidObjectId(id);
    const deleted = await this.mappingRepository.delete(id);
    if (!deleted) {
      throw new NotFoundException(`Mapping with id "${id}" not found`);
    }
    return { id };
  }

  async generateScript(
    id: string,
    dto: GenerateScriptDto,
  ): Promise<MappingRecord> {
    assertValidObjectId(id);
    const mapping = await this.mappingRepository.findById(id);
    if (!mapping) {
      throw new NotFoundException(`Mapping with id "${id}" not found`);
    }

    const tc = await this.testCaseRepository.findById(
      (mapping.toObject() as { testCaseId: string }).testCaseId,
    );
    if (!tc) {
      throw new NotFoundException('Linked test case not found');
    }

    const elementIds = (mapping.toObject() as { elementIds: string[] })
      .elementIds;
    const elements = await this.pageElementRepository.findByIds(elementIds);

    const scriptType =
      dto.scriptType ??
      ((mapping.toObject() as { scriptType: 'PLAYWRIGHT' | 'CYPRESS' | 'SELENIUM' })
        .scriptType);

    const script = generateScript(scriptType, tc, elements);

    const updated = await this.mappingRepository.update(id, {
      generatedScript: script,
      scriptType,
      gitPushStatus: 'NOT_PUSHED',
    });
    return this.toRecord(updated);
  }

  async pushToGit(
    id: string,
    _dto: PushToGitDto,
  ): Promise<MappingRecord> {
    assertValidObjectId(id);
    const mapping = await this.mappingRepository.findById(id);
    if (!mapping) {
      throw new NotFoundException(`Mapping with id "${id}" not found`);
    }
    const obj = mapping.toObject() as { generatedScript?: string | null };
    if (!obj.generatedScript) {
      throw new BadRequestException(
        'Generate the script before pushing to git',
      );
    }

    // The actual git push is delegated to the integrations layer.
    // Here we mark as PUSHED to mirror a successful integration call.
    const updated = await this.mappingRepository.update(id, {
      gitPushStatus: 'PUSHED',
    });
    return this.toRecord(updated);
  }

  /**
   * Ask the user's configured LLM to suggest, for each step in the test case,
   * which captured page element best fulfills that step. Falls back to a
   * keyword-overlap heuristic if no LLM integration is available.
   */
  async suggestForTestCase(
    testCaseId: string,
    userId: string,
  ): Promise<MappingSuggestion> {
    assertValidObjectId(testCaseId, 'testCaseId');

    const tcDoc = await this.testCaseRepository.findById(testCaseId);
    if (!tcDoc) {
      throw new NotFoundException(`Test case with id "${testCaseId}" not found`);
    }
    const tc = tcDoc.toObject() as {
      featureId: string;
      testSuiteId: string;
      title: string;
      steps: string[];
      expectedResult?: string;
    };
    const steps = tc.steps ?? [];

    const elementDocs = await this.pageElementRepository.findByFeatureId(tc.featureId);
    const elements = elementDocs.map((d) => {
      const o = d.toObject() as Record<string, unknown>;
      return {
        _id: d._id.toString(),
        elementName: o.elementName as string,
        elementType: o.elementType as string,
        selector: o.selector as string,
        pageUrl: o.pageUrl as string,
        pageName: (o.pageName as string) ?? '',
      };
    });

    if (elements.length === 0) {
      const empty: StepSuggestion[] = steps.map((s, i) => ({
        stepIndex: i,
        step: s,
        elementId: null,
      }));
      return {
        testCaseId,
        featureId: tc.featureId,
        testSuiteId: tc.testSuiteId,
        steps: empty,
        elementIds: [],
      };
    }

    const creds = await this.llmService.getUserCredentials(userId).catch(() => null);

    let stepSuggestions: StepSuggestion[];
    if (creds) {
      try {
        stepSuggestions = await this.suggestWithLlm(userId, tc, steps, elements);
      } catch {
        stepSuggestions = this.suggestHeuristic(steps, elements);
      }
    } else {
      stepSuggestions = this.suggestHeuristic(steps, elements);
    }

    const elementIds = Array.from(
      new Set(
        stepSuggestions
          .map((s) => s.elementId)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    return {
      testCaseId,
      featureId: tc.featureId,
      testSuiteId: tc.testSuiteId,
      steps: stepSuggestions,
      elementIds,
    };
  }

  private async suggestWithLlm(
    userId: string,
    tc: { title: string; expectedResult?: string },
    steps: string[],
    elements: Array<{
      _id: string;
      elementName: string;
      elementType: string;
      selector: string;
      pageUrl: string;
      pageName: string;
    }>,
  ): Promise<StepSuggestion[]> {
    const system =
      'You are a senior QA automation engineer. Given a test case and a catalog of UI elements scraped from the AUT, pair each test step with the single element most likely needed to perform it. Use null when no element clearly fits. Confidence is 0.0-1.0.';
    const user = [
      `Test case: ${tc.title}`,
      tc.expectedResult ? `Expected result: ${tc.expectedResult}` : null,
      `Steps (0-indexed):`,
      ...steps.map((s, i) => `  ${i}. ${s}`),
      '',
      'Available elements (select by id):',
      ...elements.map(
        (e) =>
          `  - id=${e._id} name=${e.elementName} type=${e.elementType} selector=${e.selector} page=${e.pageName || e.pageUrl}`,
      ),
      '',
      'Respond as STRICT JSON: {"steps":[{"stepIndex":0,"elementId":"<id|null>","confidence":0.0,"reason":"..."}, ...]}. Include every step.',
    ]
      .filter(Boolean)
      .join('\n');

    const result = await this.llmService.chatJson<{
      steps: Array<{
        stepIndex: number;
        elementId: string | null;
        confidence?: number;
        reason?: string;
      }>;
    }>(userId, system, user, { temperature: 0.1, maxOutputTokens: 1500 });

    const byIndex = new Map<number, { elementId: string | null; confidence?: number; reason?: string }>(
      (result?.steps ?? []).map((s) => [
        s.stepIndex,
        { elementId: s.elementId ?? null, confidence: s.confidence, reason: s.reason },
      ]),
    );
    const elementById = new Map(elements.map((e) => [e._id, e]));

    return steps.map((s, i) => {
      const hit = byIndex.get(i);
      const el = hit?.elementId ? elementById.get(hit.elementId) : undefined;
      return {
        stepIndex: i,
        step: s,
        elementId: el ? el._id : null,
        elementName: el?.elementName,
        selector: el?.selector,
        confidence: hit?.confidence,
        reason: hit?.reason,
      };
    });
  }

  private suggestHeuristic(
    steps: string[],
    elements: Array<{
      _id: string;
      elementName: string;
      elementType: string;
      selector: string;
    }>,
  ): StepSuggestion[] {
    const tokenize = (s: string): string[] =>
      s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .split(/\s+/)
        .filter((t) => t.length >= 3);

    return steps.map((s, i) => {
      const stepTokens = new Set(tokenize(s));
      let best: { id: string; el: (typeof elements)[number]; score: number } | null = null;
      for (const el of elements) {
        const elTokens = tokenize(`${el.elementName} ${el.elementType} ${el.selector}`);
        let score = 0;
        for (const t of elTokens) if (stepTokens.has(t)) score += 1;
        if (score > 0 && (!best || score > best.score)) {
          best = { id: el._id, el, score };
        }
      }
      return {
        stepIndex: i,
        step: s,
        elementId: best?.id ?? null,
        elementName: best?.el.elementName,
        selector: best?.el.selector,
        confidence: best ? Math.min(0.6, 0.2 + best.score * 0.1) : undefined,
        reason: best ? 'keyword overlap' : undefined,
      };
    });
  }

  async markPushFailed(id: string): Promise<MappingRecord> {
    assertValidObjectId(id);
    const updated = await this.mappingRepository.update(id, {
      gitPushStatus: 'FAILED',
    });
    if (!updated) {
      throw new NotFoundException(`Mapping with id "${id}" not found`);
    }
    return this.toRecord(updated);
  }

  private toRecord(doc: TestCaseMappingDocument): MappingRecord {
    const obj = doc.toObject() as Record<string, unknown>;
    return {
      _id: doc._id.toString(),
      featureId: obj.featureId as string,
      testSuiteId: obj.testSuiteId as string,
      testCaseId: obj.testCaseId as string,
      elementIds: (obj.elementIds as string[]) ?? [],
      generatedScript: (obj.generatedScript as string) ?? undefined,
      scriptType: obj.scriptType as MappingRecord['scriptType'],
      gitPushStatus: (obj.gitPushStatus as MappingRecord['gitPushStatus']) ??
        'NOT_PUSHED',
      createdBy: obj.createdBy as string,
      createdAt: obj.createdAt as number,
      updatedAt: obj.updatedAt as number,
    };
  }
}
