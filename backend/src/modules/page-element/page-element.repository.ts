import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, UpdateQuery } from 'mongoose';
import {
  PAGE_ELEMENT_MODEL_NAME,
  PageElementDocument,
} from '../../common/schemas';
import { SearchDto } from '../../common/dto/search.dto';
import { buildSearchQuery } from '../../common/utils/search-query.util';
import {
  PageElementType,
  PageSelectorType,
} from './page-element.interface';

export interface CreatePageElementData {
  featureId: string;
  testSuiteId?: string | null;
  pageUrl: string;
  pageName?: string | null;
  elementName: string;
  elementType: PageElementType;
  selector: string;
  selectorType: PageSelectorType;
  isStable?: boolean;
  createdBy: string;
}

export interface UpdatePageElementData {
  pageUrl?: string;
  pageName?: string | null;
  elementName?: string;
  elementType?: PageElementType;
  selector?: string;
  selectorType?: PageSelectorType;
  isStable?: boolean;
}

@Injectable()
export class PageElementRepository {
  constructor(
    @InjectModel(PAGE_ELEMENT_MODEL_NAME)
    private readonly model: Model<PageElementDocument>,
  ) {}

  async create(data: CreatePageElementData): Promise<PageElementDocument> {
    const now = Date.now();
    const created = await this.model.create({
      ...data,
      createdAt: now,
      updatedAt: now,
    });
    return this.findById(created._id.toString());
  }

  async createMany(items: CreatePageElementData[]): Promise<PageElementDocument[]> {
    if (items.length === 0) return [];
    const now = Date.now();
    return (await this.model.insertMany(
      items.map((i) => ({ ...i, createdAt: now, updatedAt: now })),
    )) as PageElementDocument[];
  }

  async findById(id: string): Promise<PageElementDocument | null> {
    return this.model.findById(id).exec();
  }

  async findByIds(ids: string[]): Promise<PageElementDocument[]> {
    if (ids.length === 0) return [];
    return this.model.find({ _id: { $in: ids } }).exec();
  }

  async findByFeatureId(featureId: string): Promise<PageElementDocument[]> {
    return this.model.find({ featureId }).sort({ createdAt: -1 }).exec();
  }

  async update(
    id: string,
    data: UpdatePageElementData,
  ): Promise<PageElementDocument | null> {
    const update: UpdateQuery<PageElementDocument> = {
      ...data,
      updatedAt: Date.now(),
    };
    return this.model
      .findByIdAndUpdate(id, update, { new: true, runValidators: true })
      .exec();
  }

  async delete(id: string): Promise<PageElementDocument | null> {
    return this.model.findByIdAndDelete(id).exec();
  }

  async search(dto: SearchDto): Promise<{
    items: PageElementDocument[];
    total: number;
  }> {
    const { filter, sort, skip, limit } = buildSearchQuery<PageElementDocument>(
      dto,
      {
        searchableFields: ['elementName', 'pageUrl', 'pageName', 'selector'],
        allowedFilterFields: [
          'featureId',
          'testSuiteId',
          'elementType',
          'selectorType',
          'isStable',
        ],
      },
    );

    const [items, total] = await Promise.all([
      this.model.find(filter).sort(sort).skip(skip).limit(limit).exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }
}
