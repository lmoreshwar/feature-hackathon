import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TestCaseDocument } from '../../common/schemas';
import { PaginatedResult } from '../../common/interfaces/api-response.interface';
import { paginate } from '../../common/utils/search-query.util';
import { assertValidObjectId } from '../../common/utils/object-id.util';
import { FeatureRepository } from '../feature/feature.repository';
import { JiraFetcherService } from '../integration/jira-fetcher.service';
import { TestSuiteRepository } from '../test-suite/test-suite.repository';
import { BulkCreateTestCaseDto } from './dto/bulk-create-test-case.dto';
import { CreateTestCaseDto } from './dto/create-test-case.dto';
import {
  CoverageReviewDto,
  CoverageReviewResponse,
} from './dto/coverage-review.dto';
import { SearchTestCaseDto } from './dto/search-test-case.dto';
import { UpdateTestCaseDto } from './dto/update-test-case.dto';
import { TestCaseRecord, TestCaseStatus } from './test-case.interface';
import { TestCaseRepository } from './test-case.repository';
import {
  CoverageInputTestCase,
  computeCoverage,
} from './coverage.util';

@Injectable()
export class TestCaseService {
  constructor(
    private readonly testCaseRepository: TestCaseRepository,
    private readonly testSuiteRepository: TestSuiteRepository,
    private readonly featureRepository: FeatureRepository,
    private readonly jiraFetcher: JiraFetcherService,
  ) {}

  async create(
    dto: CreateTestCaseDto,
    createdBy: string,
  ): Promise<TestCaseRecord> {
    assertValidObjectId(dto.featureId, 'featureId');
    assertValidObjectId(dto.testSuiteId, 'testSuiteId');

    const suite = await this.testSuiteRepository.findById(dto.testSuiteId);
    if (!suite) {
      throw new NotFoundException(
        `Test suite with id "${dto.testSuiteId}" not found`,
      );
    }

    const automationFeasible = dto.automationFeasible ?? false;
    const tags = this.normalizeTags(dto.tags ?? [], automationFeasible);

    const created = await this.testCaseRepository.create({
      featureId: dto.featureId,
      testSuiteId: dto.testSuiteId,
      title: dto.title.trim(),
      description: dto.description?.trim(),
      preconditions: dto.preconditions ?? [],
      steps: dto.steps,
      expectedResult: dto.expectedResult.trim(),
      testData: dto.testData?.trim() || null,
      tags,
      comments: dto.comments?.trim() || null,
      automationFeasible,
      priority: dto.priority ?? 'MEDIUM',
      type: dto.type ?? 'FUNCTIONAL',
      status: dto.status ?? 'GENERATED',
      referenceInfo: dto.referenceInfo ?? null,
      createdBy,
    });

    await this.recalculateFeatureCounts(dto.featureId);

    return this.toRecord(created);
  }

  async bulkCreate(
    dto: BulkCreateTestCaseDto,
    createdBy: string,
  ): Promise<TestCaseRecord[]> {
    const records = await Promise.all(
      dto.testCases.map((tc) => this.create(tc, createdBy)),
    );
    return records;
  }

  async getById(id: string): Promise<TestCaseRecord> {
    assertValidObjectId(id);
    const found = await this.testCaseRepository.findById(id);
    if (!found) {
      throw new NotFoundException(`Test case with id "${id}" not found`);
    }
    return this.toRecord(found);
  }

  async listBySuite(testSuiteId: string): Promise<TestCaseRecord[]> {
    assertValidObjectId(testSuiteId, 'testSuiteId');
    const items = await this.testCaseRepository.findByTestSuiteId(testSuiteId);
    return items.map((i) => this.toRecord(i));
  }

  async search(
    dto: SearchTestCaseDto,
  ): Promise<PaginatedResult<TestCaseRecord>> {
    const pageIndex = dto.pageIndex ?? 1;
    const pageSize = dto.pageSize ?? 10;
    const { items, total } = await this.testCaseRepository.search(dto);
    return paginate(
      items.map((i) => this.toRecord(i)),
      total,
      pageIndex,
      pageSize,
    );
  }

  async update(
    id: string,
    dto: UpdateTestCaseDto,
  ): Promise<TestCaseRecord> {
    assertValidObjectId(id);
    const tagsForUpdate =
      dto.tags !== undefined || dto.automationFeasible !== undefined
        ? this.normalizeTags(
            dto.tags ?? [],
            dto.automationFeasible ?? undefined,
          )
        : undefined;

    const updated = await this.testCaseRepository.update(id, {
      title: dto.title?.trim(),
      description: dto.description?.trim(),
      preconditions: dto.preconditions,
      steps: dto.steps,
      expectedResult: dto.expectedResult?.trim(),
      testData: dto.testData !== undefined ? (dto.testData.trim() || null) : undefined,
      tags: tagsForUpdate,
      comments: dto.comments !== undefined ? (dto.comments.trim() || null) : undefined,
      automationFeasible: dto.automationFeasible,
      priority: dto.priority,
      type: dto.type,
      status: dto.status,
      referenceInfo: dto.referenceInfo,
    });
    if (!updated) {
      throw new NotFoundException(`Test case with id "${id}" not found`);
    }
    return this.toRecord(updated);
  }

  async setStatus(
    id: string,
    status: TestCaseStatus,
  ): Promise<TestCaseRecord> {
    assertValidObjectId(id);
    const existing = await this.testCaseRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Test case with id "${id}" not found`);
    }
    const updated = await this.testCaseRepository.update(id, { status });
    await this.recalculateFeatureCounts(existing.featureId);
    return this.toRecord(updated);
  }

  /**
   * Bulk-update status for many test cases. Used by the table's
   * "Approve selected" / "Reject selected" actions.
   */
  async bulkSetStatus(
    ids: string[],
    status: TestCaseStatus,
  ): Promise<{ updated: number; affectedFeatureIds: string[] }> {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException('ids must be a non-empty array.');
    }
    ids.forEach((id) => assertValidObjectId(id));

    const featureIds = new Set<string>();
    let updated = 0;
    for (const id of ids) {
      const existing = await this.testCaseRepository.findById(id);
      if (!existing) continue;
      const result = await this.testCaseRepository.update(id, { status });
      if (result) {
        updated += 1;
        featureIds.add(existing.featureId);
      }
    }
    await Promise.all(
      Array.from(featureIds).map((fid) => this.recalculateFeatureCounts(fid)),
    );
    return { updated, affectedFeatureIds: Array.from(featureIds) };
  }

  async delete(id: string): Promise<{ id: string }> {
    assertValidObjectId(id);
    const existing = await this.testCaseRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Test case with id "${id}" not found`);
    }
    await this.testCaseRepository.delete(id);
    await this.recalculateFeatureCounts(existing.featureId);
    return { id };
  }

  async coverageReview(
    dto: CoverageReviewDto,
    userId: string,
  ): Promise<CoverageReviewResponse> {
    const requirementText = await this.resolveRequirementText(dto, userId);

    const approved = await this.testCaseRepository.findApproved();
    const inputs: CoverageInputTestCase[] = approved.map((doc) => {
      const o = doc.toObject() as Record<string, unknown>;
      return {
        title: o['title'] as string,
        description: (o['description'] as string) ?? undefined,
        preconditions: (o['preconditions'] as string[]) ?? [],
        steps: (o['steps'] as string[]) ?? [],
        expectedResult: o['expectedResult'] as string,
      };
    });

    const result = computeCoverage(requirementText, inputs);

    return {
      ...result,
      inputType: dto.inputType,
      source:
        dto.inputType === 'jira'
          ? `Jira:${dto.jiraId}`
          : dto.inputType === 'confluence'
            ? `Confluence:${dto.confluenceUrl}`
            : 'text',
    };
  }

  private async resolveRequirementText(
    dto: CoverageReviewDto,
    userId: string,
  ): Promise<string> {
    if (dto.inputType === 'text') {
      const text = (dto.text ?? '').trim();
      if (!text) {
        throw new BadRequestException(
          'Requirement text is required when inputType="text".',
        );
      }
      return text;
    }
    if (dto.inputType === 'jira') {
      if (!dto.jiraId) {
        throw new BadRequestException(
          'jiraId is required when inputType="jira".',
        );
      }
      try {
        const jira = await this.jiraFetcher.fetchTicket(userId, dto.jiraId);
        const lines = [
          `${jira.primary.key}: ${jira.primary.summary}`,
          jira.primary.description?.trim() ?? '',
        ];
        if (jira.related.length) {
          lines.push(
            jira.related
              .map((r) => `${r.key} (${r.relation}) ${r.summary}`)
              .join('\n'),
          );
        }
        // If user pasted extra text alongside, mix it in.
        if (dto.text?.trim()) lines.push(dto.text.trim());
        return lines.filter(Boolean).join('\n\n');
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown Jira error';
        throw new BadRequestException(
          `Could not fetch Jira ticket ${dto.jiraId}: ${msg}. Tip: configure Jira in Settings > Integrations, or paste the requirement text instead.`,
        );
      }
    }
    // confluence
    if (!dto.text?.trim()) {
      throw new BadRequestException(
        'Confluence content is not crawled by this service yet. Please paste the page text in the requirement text field for now (the Confluence URL is stored as a reference).',
      );
    }
    return dto.text.trim();
  }

  private async recalculateFeatureCounts(featureId: string): Promise<void> {
    const total = await this.testCaseRepository.countByFeatureId(featureId);
    const approved = await this.testCaseRepository.countByStatus({
      featureId,
      status: 'APPROVED',
    });
    const coveragePercentage = total === 0 ? 0 : Math.round((approved / total) * 100);
    await this.featureRepository.update(featureId, {
      totalTestCases: total,
      coveragePercentage,
    });
  }

  /**
   * Make sure tags are unique, trimmed, and contain "Automation" iff the
   * test case is automation-feasible. This keeps the boolean flag and the
   * tag array consistent so other tools can filter on either.
   */
  private normalizeTags(
    tags: string[],
    automationFeasible?: boolean,
  ): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of tags ?? []) {
      const t = (raw ?? '').toString().trim();
      if (!t) continue;
      const key = t.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(t);
    }
    const hasAutomation = out.some((t) => t.toLowerCase() === 'automation');
    if (automationFeasible === true && !hasAutomation) {
      out.push('Automation');
    } else if (automationFeasible === false && hasAutomation) {
      return out.filter((t) => t.toLowerCase() !== 'automation');
    }
    return out;
  }

  private toRecord(doc: TestCaseDocument): TestCaseRecord {
    const obj = doc.toObject() as Record<string, unknown>;
    return {
      _id: doc._id.toString(),
      featureId: obj.featureId as string,
      testSuiteId: obj.testSuiteId as string,
      title: obj.title as string,
      description: (obj.description as string) ?? undefined,
      preconditions: (obj.preconditions as string[]) ?? [],
      steps: (obj.steps as string[]) ?? [],
      expectedResult: obj.expectedResult as string,
      testData: (obj.testData as string) ?? undefined,
      tags: (obj.tags as string[]) ?? [],
      comments: (obj.comments as string) ?? undefined,
      automationFeasible: Boolean(obj.automationFeasible),
      priority: obj.priority as TestCaseRecord['priority'],
      type: obj.type as TestCaseRecord['type'],
      status: obj.status as TestCaseRecord['status'],
      referenceInfo: (obj.referenceInfo as TestCaseRecord['referenceInfo']) ??
        undefined,
      createdBy: obj.createdBy as string,
      createdAt: obj.createdAt as number,
      updatedAt: obj.updatedAt as number,
    };
  }
}
