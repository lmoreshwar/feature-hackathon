import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, UpdateQuery } from 'mongoose';
import {
  REQUIREMENT_MODEL_NAME,
  RequirementDocument,
} from '../../common/schemas';
import { SearchDto } from '../../common/dto/search.dto';
import { buildSearchQuery } from '../../common/utils/search-query.util';
import { RequirementStatus } from './requirement.interface';

export interface CreateRequirementData {
  featureId: string;
  testSuiteId?: string | null;
  jiraId?: string | null;
  confluenceUrl?: string | null;
  requirementText?: string | null;
  rawContent?: string | null;
  status?: RequirementStatus;
  createdBy: string;
}

export interface UpdateRequirementData {
  jiraId?: string | null;
  confluenceUrl?: string | null;
  requirementText?: string | null;
  rawContent?: string | null;
  status?: RequirementStatus;
}

@Injectable()
export class RequirementRepository {
  constructor(
    @InjectModel(REQUIREMENT_MODEL_NAME)
    private readonly model: Model<RequirementDocument>,
  ) {}

  async create(data: CreateRequirementData): Promise<RequirementDocument> {
    const now = Date.now();
    const created = await this.model.create({
      ...data,
      createdAt: now,
      updatedAt: now,
    });
    return this.findById(created._id.toString());
  }

  async findById(id: string): Promise<RequirementDocument | null> {
    return this.model.findById(id).exec();
  }

  async update(
    id: string,
    data: UpdateRequirementData,
  ): Promise<RequirementDocument | null> {
    const update: UpdateQuery<RequirementDocument> = {
      ...data,
      updatedAt: Date.now(),
    };
    return this.model
      .findByIdAndUpdate(id, update, { new: true, runValidators: true })
      .exec();
  }

  async delete(id: string): Promise<RequirementDocument | null> {
    return this.model.findByIdAndDelete(id).exec();
  }

  async search(dto: SearchDto): Promise<{
    items: RequirementDocument[];
    total: number;
  }> {
    const { filter, sort, skip, limit } = buildSearchQuery<RequirementDocument>(
      dto,
      {
        searchableFields: ['jiraId', 'confluenceUrl', 'requirementText'],
        allowedFilterFields: [
          'featureId',
          'testSuiteId',
          'status',
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

  async findByFeatureId(featureId: string): Promise<RequirementDocument[]> {
    return this.model.find({ featureId }).sort({ createdAt: -1 }).exec();
  }
}
