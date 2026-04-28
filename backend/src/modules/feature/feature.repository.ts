import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, UpdateQuery } from 'mongoose';
import { FEATURE_MODEL_NAME, FeatureDocument } from '../../common/schemas/feature.schema';
import { FeatureStatus } from './feature.interface';

export interface CreateFeatureData {
  name: string;
  description?: string;
  status: FeatureStatus;
  totalSuites?: number;
  totalTestCases?: number;
  coveragePercentage?: number;
  createdBy: string;
}

export interface UpdateFeatureData {
  name?: string;
  description?: string;
  status?: FeatureStatus;
  totalSuites?: number;
  totalTestCases?: number;
  coveragePercentage?: number;
  createdBy?: string;
}

export interface FeatureFilters {
  search?: string;
  status?: FeatureStatus;
  createdBy?: string;
}

export interface ListFeaturesResult {
  items: FeatureDocument[];
  total: number;
}

@Injectable()
export class FeatureRepository {
  constructor(
    @InjectModel(FEATURE_MODEL_NAME)
    private readonly featureModel: Model<FeatureDocument>,
  ) {}

  async create(data: CreateFeatureData): Promise<FeatureDocument> {
    const now = Date.now();
    const created = await this.featureModel.create({
      ...data,
      createdAt: now,
      updatedAt: now,
    });

    return this.findById(created._id.toString());
  }

  async findById(id: string): Promise<FeatureDocument | null> {
    return this.featureModel.findById(id).exec();
  }

  async findAll(
    page: number,
    limit: number,
    filters: FeatureFilters,
  ): Promise<ListFeaturesResult> {
    const safePage = Math.max(1, Math.floor(page) || 1);
    const safeLimit = Math.max(1, Math.min(100, Math.floor(limit) || 10));
    const skip = (safePage - 1) * safeLimit;

    const filter: FilterQuery<FeatureDocument> = {};

    if (filters.search && filters.search.trim().length > 0) {
      const escaped = filters.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.name = { $regex: escaped, $options: 'i' };
    }

    if (filters.status) {
      filter.status = filters.status;
    }

    if (filters.createdBy) {
      filter.createdBy = filters.createdBy;
    }

    const [items, total] = await Promise.all([
      this.featureModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .exec(),
      this.featureModel.countDocuments(filter).exec(),
    ]);

    return { items, total };
  }

  async update(id: string, data: UpdateFeatureData): Promise<FeatureDocument | null> {
    const update: UpdateQuery<FeatureDocument> = {
      ...data,
      updatedAt: Date.now(),
    };

    return this.featureModel
      .findByIdAndUpdate(id, update, { new: true, runValidators: true })
      .exec();
  }

  async delete(id: string): Promise<FeatureDocument | null> {
    return this.featureModel.findByIdAndDelete(id).exec();
  }

  async existsByName(name: string, excludeId?: string): Promise<boolean> {
    const filter: FilterQuery<FeatureDocument> = {
      name: name.trim(),
    };

    if (excludeId) {
      filter._id = { $ne: excludeId };
    }

    const found = await this.featureModel.exists(filter).exec();
    return Boolean(found);
  }
}
