import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, UpdateQuery } from 'mongoose';
import {
  TEST_EXECUTION_MODEL_NAME,
  TestExecutionDocument,
} from '../../common/schemas';
import { SearchDto } from '../../common/dto/search.dto';
import { buildSearchQuery } from '../../common/utils/search-query.util';
import {
  ExecutionProvider,
  ExecutionStatus,
} from './test-execution.interface';

export interface CreateExecutionData {
  featureId: string;
  testSuiteId?: string | null;
  testCaseIds?: string[];
  buildName: string;
  provider: ExecutionProvider;
  status: ExecutionStatus;
  totalTests?: number;
  passedTests?: number;
  failedTests?: number;
  skippedTests?: number;
  reportUrl?: string | null;
  videoUrl?: string | null;
  logsUrl?: string | null;
  triggeredBy: string;
}

export interface UpdateExecutionData {
  buildName?: string;
  status?: ExecutionStatus;
  totalTests?: number;
  passedTests?: number;
  failedTests?: number;
  skippedTests?: number;
  reportUrl?: string | null;
  videoUrl?: string | null;
  logsUrl?: string | null;
}

@Injectable()
export class ExecutionRepository {
  constructor(
    @InjectModel(TEST_EXECUTION_MODEL_NAME)
    private readonly model: Model<TestExecutionDocument>,
  ) {}

  async create(data: CreateExecutionData): Promise<TestExecutionDocument> {
    const now = Date.now();
    const created = await this.model.create({
      ...data,
      createdAt: now,
      updatedAt: now,
    });
    return this.findById(created._id.toString());
  }

  async findById(id: string): Promise<TestExecutionDocument | null> {
    return this.model.findById(id).exec();
  }

  async update(
    id: string,
    data: UpdateExecutionData,
  ): Promise<TestExecutionDocument | null> {
    const update: UpdateQuery<TestExecutionDocument> = {
      ...data,
      updatedAt: Date.now(),
    };
    return this.model
      .findByIdAndUpdate(id, update, { new: true, runValidators: true })
      .exec();
  }

  async delete(id: string): Promise<TestExecutionDocument | null> {
    return this.model.findByIdAndDelete(id).exec();
  }

  async search(dto: SearchDto): Promise<{
    items: TestExecutionDocument[];
    total: number;
  }> {
    const { filter, sort, skip, limit } = buildSearchQuery<TestExecutionDocument>(
      dto,
      {
        searchableFields: ['buildName'],
        allowedFilterFields: [
          'featureId',
          'testSuiteId',
          'provider',
          'status',
          'triggeredBy',
        ],
      },
    );

    const [items, total] = await Promise.all([
      this.model.find(filter).sort(sort).skip(skip).limit(limit).exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }

  async countByStatus(filter: FilterQuery<TestExecutionDocument>): Promise<number> {
    return this.model.countDocuments(filter).exec();
  }
}
