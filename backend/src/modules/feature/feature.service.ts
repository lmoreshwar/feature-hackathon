import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { FeatureDocument } from '../../common/schemas/feature.schema';
import { PaginatedResult } from '../../common/interfaces/api-response.interface';
import { paginate } from '../../common/utils/search-query.util';
import { CreateFeatureDto } from './dto/create-feature.dto';
import { ListFeaturesQueryDto } from './dto/list-features.query.dto';
import { SearchFeatureDto } from './dto/search-feature.dto';
import { UpdateFeatureDto } from './dto/update-feature.dto';
import { FeatureRecord, PaginatedFeatures } from './feature.interface';
import { FeatureFilters, FeatureRepository, UpdateFeatureData } from './feature.repository';

@Injectable()
export class FeatureService {
  constructor(private readonly featureRepository: FeatureRepository) {}

  async createFeature(dto: CreateFeatureDto): Promise<FeatureRecord> {
    const name = this.normalizeName(dto.name);

    const exists = await this.featureRepository.existsByName(name);
    if (exists) {
      throw new ConflictException(`Feature with name "${name}" already exists`);
    }

    const created = await this.featureRepository.create({
      name,
      description: dto.description?.trim(),
      status: 'DRAFT',
    });

    if (!created) {
      throw new BadRequestException('Failed to create feature');
    }

    return this.toFeatureRecord(created);
  }

  async getFeatureById(id: string): Promise<FeatureRecord> {
    this.assertValidObjectId(id);

    const feature = await this.featureRepository.findById(id);
    if (!feature) {
      throw new NotFoundException(`Feature with id "${id}" not found`);
    }

    return this.toFeatureRecord(feature);
  }

  async listFeatures(query: ListFeaturesQueryDto): Promise<PaginatedFeatures> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    if (query.createdBy !== undefined) {
      this.assertValidObjectId(query.createdBy, 'createdBy');
    }

    const filters: FeatureFilters = {
      search: query.search?.trim(),
      status: query.status,
      createdBy: query.createdBy,
    };

    const { items, total } = await this.featureRepository.findAll(page, limit, filters);
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      items: items.map((item) => this.toFeatureRecord(item)),
      page,
      limit,
      total,
      totalPages,
    };
  }

  async updateFeature(id: string, dto: UpdateFeatureDto): Promise<FeatureRecord> {
    this.assertValidObjectId(id);

    const existing = await this.featureRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Feature with id "${id}" not found`);
    }

    const update: UpdateFeatureData = {};

    if (dto.name !== undefined) {
      const name = this.normalizeName(dto.name);
      if (name !== existing.name) {
        const inUse = await this.featureRepository.existsByName(name, id);
        if (inUse) {
          throw new ConflictException(`Feature with name "${name}" already exists`);
        }
      }
      update.name = name;
    }

    if (dto.description !== undefined) {
      update.description = dto.description.trim();
    }

    if (dto.status !== undefined) {
      update.status = dto.status;
    }

    if (dto.totalSuites !== undefined) {
      update.totalSuites = dto.totalSuites;
    }

    if (dto.totalTestCases !== undefined) {
      update.totalTestCases = dto.totalTestCases;
    }

    if (dto.coveragePercentage !== undefined) {
      update.coveragePercentage = dto.coveragePercentage;
    }

    if (dto.createdBy !== undefined) {
      this.assertValidObjectId(dto.createdBy, 'createdBy');
      update.createdBy = dto.createdBy;
    }

    if (Object.keys(update).length === 0) {
      return this.toFeatureRecord(existing);
    }

    const updated = await this.featureRepository.update(id, update);
    if (!updated) {
      throw new NotFoundException(`Feature with id "${id}" not found`);
    }

    return this.toFeatureRecord(updated);
  }

  async searchFeatures(
    dto: SearchFeatureDto,
  ): Promise<PaginatedResult<FeatureRecord>> {
    const pageIndex = dto.pageIndex ?? 1;
    const pageSize = dto.pageSize ?? 10;

    const { items, total } = await this.featureRepository.search(dto);

    return paginate(
      items.map((item) => this.toFeatureRecord(item)),
      total,
      pageIndex,
      pageSize,
    );
  }

  async archiveFeature(id: string): Promise<FeatureRecord> {
    this.assertValidObjectId(id);
    const updated = await this.featureRepository.update(id, {
      status: 'ARCHIVED',
    });
    if (!updated) {
      throw new NotFoundException(`Feature with id "${id}" not found`);
    }
    return this.toFeatureRecord(updated);
  }

  async deleteFeature(id: string): Promise<{ id: string }> {
    this.assertValidObjectId(id);

    const deleted = await this.featureRepository.delete(id);
    if (!deleted) {
      throw new NotFoundException(`Feature with id "${id}" not found`);
    }

    return { id };
  }

  private assertValidObjectId(id: string, fieldName = 'id'): void {
    if (!id || !Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`"${id}" is not a valid MongoDB ObjectId for ${fieldName}`);
    }
  }

  private normalizeName(name: string): string {
    const normalized = name.trim();
    if (!normalized) {
      throw new BadRequestException('name is required');
    }

    return normalized;
  }

  private toFeatureRecord(doc: FeatureDocument): FeatureRecord {
    const obj = doc.toObject() as {
      name: string;
      description?: string;
      status: FeatureRecord['status'];
      totalSuites?: number;
      totalTestCases?: number;
      coveragePercentage?: number;
      createdBy?: string;
      createdAt: number;
      updatedAt: number;
    };

    return {
      _id: doc._id.toString(),
      name: obj.name,
      description: obj.description,
      status: obj.status,
      totalSuites: obj.totalSuites,
      totalTestCases: obj.totalTestCases,
      coveragePercentage: obj.coveragePercentage,
      createdBy: obj.createdBy,
      createdAt: obj.createdAt,
      updatedAt: obj.updatedAt,
    };
  }
}
