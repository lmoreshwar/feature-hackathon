import { Injectable, NotFoundException } from '@nestjs/common';
import { TestCaseDocument } from '../../common/schemas';
import { PaginatedResult } from '../../common/interfaces/api-response.interface';
import { paginate } from '../../common/utils/search-query.util';
import { assertValidObjectId } from '../../common/utils/object-id.util';
import { FeatureRepository } from '../feature/feature.repository';
import { TestSuiteRepository } from '../test-suite/test-suite.repository';
import { BulkCreateTestCaseDto } from './dto/bulk-create-test-case.dto';
import { CreateTestCaseDto } from './dto/create-test-case.dto';
import { SearchTestCaseDto } from './dto/search-test-case.dto';
import { UpdateTestCaseDto } from './dto/update-test-case.dto';
import { TestCaseRecord, TestCaseStatus } from './test-case.interface';
import { TestCaseRepository } from './test-case.repository';

@Injectable()
export class TestCaseService {
  constructor(
    private readonly testCaseRepository: TestCaseRepository,
    private readonly testSuiteRepository: TestSuiteRepository,
    private readonly featureRepository: FeatureRepository,
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

    const created = await this.testCaseRepository.create({
      featureId: dto.featureId,
      testSuiteId: dto.testSuiteId,
      title: dto.title.trim(),
      description: dto.description?.trim(),
      preconditions: dto.preconditions ?? [],
      steps: dto.steps,
      expectedResult: dto.expectedResult.trim(),
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
    const updated = await this.testCaseRepository.update(id, {
      title: dto.title?.trim(),
      description: dto.description?.trim(),
      preconditions: dto.preconditions,
      steps: dto.steps,
      expectedResult: dto.expectedResult?.trim(),
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
