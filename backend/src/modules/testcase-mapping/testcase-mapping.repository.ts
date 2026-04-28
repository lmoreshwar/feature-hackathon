import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, UpdateQuery } from 'mongoose';
import {
  TESTCASE_MAPPING_MODEL_NAME,
  TestCaseMappingDocument,
} from '../../common/schemas';
import { SearchDto } from '../../common/dto/search.dto';
import { buildSearchQuery } from '../../common/utils/search-query.util';
import {
  GitPushStatus,
  ScriptType,
} from './testcase-mapping.interface';

export interface CreateMappingData {
  featureId: string;
  testSuiteId: string;
  testCaseId: string;
  elementIds: string[];
  scriptType: ScriptType;
  generatedScript?: string | null;
  gitPushStatus?: GitPushStatus;
  createdBy: string;
}

export interface UpdateMappingData {
  elementIds?: string[];
  scriptType?: ScriptType;
  generatedScript?: string | null;
  gitPushStatus?: GitPushStatus;
}

@Injectable()
export class MappingRepository {
  constructor(
    @InjectModel(TESTCASE_MAPPING_MODEL_NAME)
    private readonly model: Model<TestCaseMappingDocument>,
  ) {}

  async create(data: CreateMappingData): Promise<TestCaseMappingDocument> {
    const now = Date.now();
    const created = await this.model.create({
      ...data,
      createdAt: now,
      updatedAt: now,
    });
    return this.findById(created._id.toString());
  }

  async findById(id: string): Promise<TestCaseMappingDocument | null> {
    return this.model.findById(id).exec();
  }

  async findByTestCaseId(
    testCaseId: string,
  ): Promise<TestCaseMappingDocument | null> {
    return this.model.findOne({ testCaseId }).exec();
  }

  async update(
    id: string,
    data: UpdateMappingData,
  ): Promise<TestCaseMappingDocument | null> {
    const update: UpdateQuery<TestCaseMappingDocument> = {
      ...data,
      updatedAt: Date.now(),
    };
    return this.model
      .findByIdAndUpdate(id, update, { new: true, runValidators: true })
      .exec();
  }

  async delete(id: string): Promise<TestCaseMappingDocument | null> {
    return this.model.findByIdAndDelete(id).exec();
  }

  async search(dto: SearchDto): Promise<{
    items: TestCaseMappingDocument[];
    total: number;
  }> {
    const { filter, sort, skip, limit } =
      buildSearchQuery<TestCaseMappingDocument>(dto, {
        searchableFields: [],
        allowedFilterFields: [
          'featureId',
          'testSuiteId',
          'testCaseId',
          'scriptType',
          'gitPushStatus',
          'createdBy',
        ],
      });

    const [items, total] = await Promise.all([
      this.model.find(filter).sort(sort).skip(skip).limit(limit).exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }
}
