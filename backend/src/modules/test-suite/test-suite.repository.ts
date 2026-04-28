import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, UpdateQuery } from 'mongoose';
import {
  TEST_SUITE_MODEL_NAME,
  TestSuiteDocument,
} from '../../common/schemas';
import { SearchDto } from '../../common/dto/search.dto';
import { buildSearchQuery } from '../../common/utils/search-query.util';
import { TestSuiteStatus } from './test-suite.interface';

export interface CreateTestSuiteData {
  featureId: string;
  moduleName: string;
  description?: string;
  version?: string;
  status?: TestSuiteStatus;
  referenceInfo?: unknown;
  createdBy: string;
}

export interface UpdateTestSuiteData {
  moduleName?: string;
  description?: string;
  version?: string;
  status?: TestSuiteStatus;
  totalTests?: number;
  passedTests?: number;
  failedTests?: number;
  skippedTests?: number;
  passPercentage?: number;
  referenceInfo?: unknown;
}

@Injectable()
export class TestSuiteRepository {
  constructor(
    @InjectModel(TEST_SUITE_MODEL_NAME)
    private readonly model: Model<TestSuiteDocument>,
  ) {}

  async create(data: CreateTestSuiteData): Promise<TestSuiteDocument> {
    const now = Date.now();
    const created = await this.model.create({
      ...data,
      createdAt: now,
      updatedAt: now,
    });
    return this.findById(created._id.toString());
  }

  async findById(id: string): Promise<TestSuiteDocument | null> {
    return this.model.findById(id).exec();
  }

  async update(
    id: string,
    data: UpdateTestSuiteData,
  ): Promise<TestSuiteDocument | null> {
    const update: UpdateQuery<TestSuiteDocument> = {
      ...data,
      updatedAt: Date.now(),
    };
    return this.model
      .findByIdAndUpdate(id, update, { new: true, runValidators: true })
      .exec();
  }

  async delete(id: string): Promise<TestSuiteDocument | null> {
    return this.model.findByIdAndDelete(id).exec();
  }

  async existsByName(
    featureId: string,
    moduleName: string,
    excludeId?: string,
  ): Promise<boolean> {
    const filter: FilterQuery<TestSuiteDocument> = {
      featureId,
      moduleName: moduleName.trim(),
    };
    if (excludeId) {
      filter._id = { $ne: excludeId };
    }
    const found = await this.model.exists(filter).exec();
    return Boolean(found);
  }

  async countByFeatureId(featureId: string): Promise<number> {
    return this.model.countDocuments({ featureId }).exec();
  }

  async countAll(): Promise<number> {
    return this.model.countDocuments().exec();
  }

  async search(dto: SearchDto): Promise<{
    items: TestSuiteDocument[];
    total: number;
  }> {
    const { filter, sort, skip, limit } = buildSearchQuery<TestSuiteDocument>(
      dto,
      {
        searchableFields: ['moduleName', 'description'],
        allowedFilterFields: ['featureId', 'status', 'createdBy'],
      },
    );

    const [items, total] = await Promise.all([
      this.model.find(filter).sort(sort).skip(skip).limit(limit).exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }

  async findByFeatureId(featureId: string): Promise<TestSuiteDocument[]> {
    return this.model.find({ featureId }).sort({ createdAt: -1 }).exec();
  }
}
