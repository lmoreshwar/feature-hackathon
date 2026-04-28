import { Injectable, NotFoundException } from '@nestjs/common';
import { TestExecutionDocument } from '../../common/schemas';
import { PaginatedResult } from '../../common/interfaces/api-response.interface';
import { paginate } from '../../common/utils/search-query.util';
import { assertValidObjectId } from '../../common/utils/object-id.util';
import { CreateExecutionDto } from './dto/create-execution.dto';
import { SearchExecutionDto } from './dto/search-execution.dto';
import { UpdateExecutionDto } from './dto/update-execution.dto';
import {
  ExecutionRecord,
  ExecutionStatus,
} from './test-execution.interface';
import { ExecutionRepository } from './test-execution.repository';

@Injectable()
export class ExecutionService {
  constructor(private readonly executionRepository: ExecutionRepository) {}

  async trigger(
    dto: CreateExecutionDto,
    triggeredBy: string,
  ): Promise<ExecutionRecord> {
    assertValidObjectId(dto.featureId, 'featureId');
    if (dto.testSuiteId) {
      assertValidObjectId(dto.testSuiteId, 'testSuiteId');
    }

    const created = await this.executionRepository.create({
      featureId: dto.featureId,
      testSuiteId: dto.testSuiteId ?? null,
      testCaseIds: dto.testCaseIds ?? [],
      buildName: dto.buildName.trim(),
      provider: dto.provider ?? 'LOCAL',
      status: dto.status ?? 'QUEUED',
      totalTests: dto.testCaseIds?.length ?? 0,
      triggeredBy,
    });

    return this.toRecord(created);
  }

  async getById(id: string): Promise<ExecutionRecord> {
    assertValidObjectId(id);
    const found = await this.executionRepository.findById(id);
    if (!found) {
      throw new NotFoundException(`Execution with id "${id}" not found`);
    }
    return this.toRecord(found);
  }

  async search(
    dto: SearchExecutionDto,
  ): Promise<PaginatedResult<ExecutionRecord>> {
    const pageIndex = dto.pageIndex ?? 1;
    const pageSize = dto.pageSize ?? 10;
    const { items, total } = await this.executionRepository.search(dto);
    return paginate(
      items.map((i) => this.toRecord(i)),
      total,
      pageIndex,
      pageSize,
    );
  }

  async update(
    id: string,
    dto: UpdateExecutionDto,
  ): Promise<ExecutionRecord> {
    assertValidObjectId(id);
    const updated = await this.executionRepository.update(id, {
      buildName: dto.buildName?.trim(),
      status: dto.status,
      totalTests: dto.totalTests,
      passedTests: dto.passedTests,
      failedTests: dto.failedTests,
      skippedTests: dto.skippedTests,
      reportUrl: dto.reportUrl,
      videoUrl: dto.videoUrl,
      logsUrl: dto.logsUrl,
    });
    if (!updated) {
      throw new NotFoundException(`Execution with id "${id}" not found`);
    }
    return this.toRecord(updated);
  }

  async setStatus(
    id: string,
    status: ExecutionStatus,
  ): Promise<ExecutionRecord> {
    assertValidObjectId(id);
    const updated = await this.executionRepository.update(id, { status });
    if (!updated) {
      throw new NotFoundException(`Execution with id "${id}" not found`);
    }
    return this.toRecord(updated);
  }

  async delete(id: string): Promise<{ id: string }> {
    assertValidObjectId(id);
    const deleted = await this.executionRepository.delete(id);
    if (!deleted) {
      throw new NotFoundException(`Execution with id "${id}" not found`);
    }
    return { id };
  }

  private toRecord(doc: TestExecutionDocument): ExecutionRecord {
    const obj = doc.toObject() as Record<string, unknown>;
    return {
      _id: doc._id.toString(),
      featureId: obj.featureId as string,
      testSuiteId: (obj.testSuiteId as string) ?? undefined,
      testCaseIds: (obj.testCaseIds as string[]) ?? [],
      buildName: obj.buildName as string,
      provider: obj.provider as ExecutionRecord['provider'],
      status: obj.status as ExecutionRecord['status'],
      totalTests: (obj.totalTests as number) ?? 0,
      passedTests: (obj.passedTests as number) ?? 0,
      failedTests: (obj.failedTests as number) ?? 0,
      skippedTests: (obj.skippedTests as number) ?? 0,
      reportUrl: (obj.reportUrl as string) ?? undefined,
      videoUrl: (obj.videoUrl as string) ?? undefined,
      logsUrl: (obj.logsUrl as string) ?? undefined,
      triggeredBy: obj.triggeredBy as string,
      createdAt: obj.createdAt as number,
      updatedAt: obj.updatedAt as number,
    };
  }
}
