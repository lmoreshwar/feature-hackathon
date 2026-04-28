import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, UpdateQuery } from 'mongoose';
import {
  TEST_CASE_MODEL_NAME,
  TestCaseDocument,
} from '../../common/schemas';
import { SearchDto } from '../../common/dto/search.dto';
import { buildSearchQuery } from '../../common/utils/search-query.util';
import {
  TestCasePriority,
  TestCaseStatus,
  TestCaseType,
} from './test-case.interface';

export interface CreateTestCaseData {
  featureId: string;
  testSuiteId: string;
  title: string;
  description?: string;
  preconditions?: string[];
  steps: string[];
  expectedResult: string;
  priority?: TestCasePriority;
  type?: TestCaseType;
  status?: TestCaseStatus;
  referenceInfo?: unknown;
  createdBy: string;
}

export interface UpdateTestCaseData {
  title?: string;
  description?: string;
  preconditions?: string[];
  steps?: string[];
  expectedResult?: string;
  priority?: TestCasePriority;
  type?: TestCaseType;
  status?: TestCaseStatus;
  referenceInfo?: unknown;
}

@Injectable()
export class TestCaseRepository {
  constructor(
    @InjectModel(TEST_CASE_MODEL_NAME)
    private readonly model: Model<TestCaseDocument>,
  ) {}

  async create(data: CreateTestCaseData): Promise<TestCaseDocument> {
    const now = Date.now();
    const created = await this.model.create({
      ...data,
      createdAt: now,
      updatedAt: now,
    });
    return this.findById(created._id.toString());
  }

  async createMany(items: CreateTestCaseData[]): Promise<TestCaseDocument[]> {
    if (items.length === 0) return [];
    const now = Date.now();
    const docs = await this.model.insertMany(
      items.map((i) => ({ ...i, createdAt: now, updatedAt: now })),
    );
    return docs as TestCaseDocument[];
  }

  async findById(id: string): Promise<TestCaseDocument | null> {
    return this.model.findById(id).exec();
  }

  async update(
    id: string,
    data: UpdateTestCaseData,
  ): Promise<TestCaseDocument | null> {
    const update: UpdateQuery<TestCaseDocument> = {
      ...data,
      updatedAt: Date.now(),
    };
    return this.model
      .findByIdAndUpdate(id, update, { new: true, runValidators: true })
      .exec();
  }

  async delete(id: string): Promise<TestCaseDocument | null> {
    return this.model.findByIdAndDelete(id).exec();
  }

  async search(dto: SearchDto): Promise<{
    items: TestCaseDocument[];
    total: number;
  }> {
    const { filter, sort, skip, limit } = buildSearchQuery<TestCaseDocument>(
      dto,
      {
        searchableFields: ['title', 'description', 'expectedResult'],
        allowedFilterFields: [
          'featureId',
          'testSuiteId',
          'status',
          'priority',
          'type',
          'createdBy',
        ],
      },
    );

    const [items, total] = await Promise.all([
      this.model.find(filter).sort(sort).skip(skip).limit(limit).exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }

  async findByTestSuiteId(testSuiteId: string): Promise<TestCaseDocument[]> {
    return this.model.find({ testSuiteId }).sort({ createdAt: -1 }).exec();
  }

  async countByFeatureId(featureId: string): Promise<number> {
    return this.model.countDocuments({ featureId }).exec();
  }

  async countByStatus(filter: FilterQuery<TestCaseDocument>): Promise<number> {
    return this.model.countDocuments(filter).exec();
  }

  async countAll(): Promise<number> {
    return this.model.countDocuments().exec();
  }
}
