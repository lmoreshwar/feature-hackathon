import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TestSuiteDocument } from '../../common/schemas';
import { PaginatedResult } from '../../common/interfaces/api-response.interface';
import { paginate } from '../../common/utils/search-query.util';
import { assertValidObjectId } from '../../common/utils/object-id.util';
import { FeatureRepository } from '../feature/feature.repository';
import { CreateTestSuiteDto } from './dto/create-test-suite.dto';
import { SearchTestSuiteDto } from './dto/search-test-suite.dto';
import { UpdateTestSuiteDto } from './dto/update-test-suite.dto';
import { TestSuiteRecord } from './test-suite.interface';
import {
  TestSuiteRepository,
  UpdateTestSuiteData,
} from './test-suite.repository';

@Injectable()
export class TestSuiteService {
  constructor(
    private readonly testSuiteRepository: TestSuiteRepository,
    private readonly featureRepository: FeatureRepository,
  ) {}

  async createTestSuite(
    dto: CreateTestSuiteDto,
    createdBy: string,
  ): Promise<TestSuiteRecord> {
    assertValidObjectId(dto.featureId, 'featureId');

    const feature = await this.featureRepository.findById(dto.featureId);
    if (!feature) {
      throw new NotFoundException(
        `Feature with id "${dto.featureId}" not found`,
      );
    }

    const moduleName = dto.moduleName.trim();
    const exists = await this.testSuiteRepository.existsByName(
      dto.featureId,
      moduleName,
    );
    if (exists) {
      throw new ConflictException(
        `Test suite "${moduleName}" already exists for this feature`,
      );
    }

    const created = await this.testSuiteRepository.create({
      featureId: dto.featureId,
      moduleName,
      description: dto.description?.trim(),
      version: dto.version?.trim() ?? '1.0.0',
      status: dto.status ?? 'DRAFT',
      referenceInfo: dto.referenceInfo ?? null,
      createdBy,
    });

    await this.recalculateFeatureSuiteCount(dto.featureId);

    return this.toRecord(created);
  }

  async getById(id: string): Promise<TestSuiteRecord> {
    assertValidObjectId(id);
    const found = await this.testSuiteRepository.findById(id);
    if (!found) {
      throw new NotFoundException(`Test suite with id "${id}" not found`);
    }
    return this.toRecord(found);
  }

  async listByFeature(featureId: string): Promise<TestSuiteRecord[]> {
    assertValidObjectId(featureId, 'featureId');
    const items = await this.testSuiteRepository.findByFeatureId(featureId);
    return items.map((item) => this.toRecord(item));
  }

  async search(
    dto: SearchTestSuiteDto,
  ): Promise<PaginatedResult<TestSuiteRecord>> {
    const pageIndex = dto.pageIndex ?? 1;
    const pageSize = dto.pageSize ?? 10;
    const { items, total } = await this.testSuiteRepository.search(dto);
    return paginate(
      items.map((i) => this.toRecord(i)),
      total,
      pageIndex,
      pageSize,
    );
  }

  async update(
    id: string,
    dto: UpdateTestSuiteDto,
  ): Promise<TestSuiteRecord> {
    assertValidObjectId(id);
    const existing = await this.testSuiteRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Test suite with id "${id}" not found`);
    }

    const update: UpdateTestSuiteData = {};

    if (dto.moduleName !== undefined) {
      const newName = dto.moduleName.trim();
      if (newName !== existing.moduleName) {
        const inUse = await this.testSuiteRepository.existsByName(
          existing.featureId,
          newName,
          id,
        );
        if (inUse) {
          throw new ConflictException(
            `Test suite "${newName}" already exists for this feature`,
          );
        }
      }
      update.moduleName = newName;
    }

    if (dto.description !== undefined) {
      update.description = dto.description.trim();
    }
    if (dto.version !== undefined) update.version = dto.version.trim();
    if (dto.status !== undefined) update.status = dto.status;
    if (dto.totalTests !== undefined) update.totalTests = dto.totalTests;
    if (dto.passedTests !== undefined) update.passedTests = dto.passedTests;
    if (dto.failedTests !== undefined) update.failedTests = dto.failedTests;
    if (dto.skippedTests !== undefined) update.skippedTests = dto.skippedTests;
    if (dto.passPercentage !== undefined) {
      update.passPercentage = dto.passPercentage;
    }
    if (dto.referenceInfo !== undefined) {
      update.referenceInfo = dto.referenceInfo;
    }

    const updated = await this.testSuiteRepository.update(id, update);
    return this.toRecord(updated);
  }

  async archive(id: string): Promise<TestSuiteRecord> {
    assertValidObjectId(id);
    const updated = await this.testSuiteRepository.update(id, {
      status: 'ARCHIVED',
    });
    if (!updated) {
      throw new NotFoundException(`Test suite with id "${id}" not found`);
    }
    return this.toRecord(updated);
  }

  async delete(id: string): Promise<{ id: string }> {
    assertValidObjectId(id);
    const existing = await this.testSuiteRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Test suite with id "${id}" not found`);
    }
    await this.testSuiteRepository.delete(id);
    await this.recalculateFeatureSuiteCount(existing.featureId);
    return { id };
  }

  private async recalculateFeatureSuiteCount(featureId: string): Promise<void> {
    const total = await this.testSuiteRepository.countByFeatureId(featureId);
    await this.featureRepository.update(featureId, { totalSuites: total });
  }

  private toRecord(doc: TestSuiteDocument): TestSuiteRecord {
    const obj = doc.toObject() as Record<string, unknown>;
    return {
      _id: doc._id.toString(),
      featureId: obj.featureId as string,
      moduleName: obj.moduleName as string,
      description: (obj.description as string) ?? undefined,
      version: obj.version as string,
      totalTests: (obj.totalTests as number) ?? 0,
      passedTests: (obj.passedTests as number) ?? 0,
      failedTests: (obj.failedTests as number) ?? 0,
      skippedTests: (obj.skippedTests as number) ?? 0,
      passPercentage: (obj.passPercentage as number) ?? 0,
      status: obj.status as TestSuiteRecord['status'],
      referenceInfo: (obj.referenceInfo as TestSuiteRecord['referenceInfo']) ??
        undefined,
      createdBy: obj.createdBy as string,
      createdAt: obj.createdAt as number,
      updatedAt: obj.updatedAt as number,
    };
  }
}
