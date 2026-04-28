import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RequirementDocument } from '../../common/schemas';
import { PaginatedResult } from '../../common/interfaces/api-response.interface';
import { paginate } from '../../common/utils/search-query.util';
import { assertValidObjectId } from '../../common/utils/object-id.util';
import { FeatureRepository } from '../feature/feature.repository';
import { CreateRequirementDto } from './dto/create-requirement.dto';
import { SearchRequirementDto } from './dto/search-requirement.dto';
import { UpdateRequirementDto } from './dto/update-requirement.dto';
import { RequirementRecord } from './requirement.interface';
import { RequirementRepository } from './requirement.repository';

@Injectable()
export class RequirementService {
  constructor(
    private readonly requirementRepository: RequirementRepository,
    private readonly featureRepository: FeatureRepository,
  ) {}

  async create(
    dto: CreateRequirementDto,
    createdBy: string,
  ): Promise<RequirementRecord> {
    assertValidObjectId(dto.featureId, 'featureId');
    if (dto.testSuiteId) {
      assertValidObjectId(dto.testSuiteId, 'testSuiteId');
    }

    const hasJira = Boolean(dto.jiraId?.trim());
    const hasConfluence = Boolean(dto.confluenceUrl?.trim());
    const hasText = Boolean(dto.requirementText?.trim());
    if (!hasJira && !hasConfluence && !hasText) {
      throw new BadRequestException(
        'At least one of jiraId, confluenceUrl, or requirementText is required',
      );
    }

    const feature = await this.featureRepository.findById(dto.featureId);
    if (!feature) {
      throw new NotFoundException(
        `Feature with id "${dto.featureId}" not found`,
      );
    }

    const created = await this.requirementRepository.create({
      featureId: dto.featureId,
      testSuiteId: dto.testSuiteId ?? null,
      jiraId: dto.jiraId?.trim() ?? null,
      confluenceUrl: dto.confluenceUrl?.trim() ?? null,
      requirementText: dto.requirementText?.trim() ?? null,
      rawContent: dto.rawContent ?? null,
      status: dto.status ?? 'PENDING',
      createdBy,
    });
    return this.toRecord(created);
  }

  async getById(id: string): Promise<RequirementRecord> {
    assertValidObjectId(id);
    const found = await this.requirementRepository.findById(id);
    if (!found) {
      throw new NotFoundException(`Requirement with id "${id}" not found`);
    }
    return this.toRecord(found);
  }

  async listByFeature(featureId: string): Promise<RequirementRecord[]> {
    assertValidObjectId(featureId, 'featureId');
    const items = await this.requirementRepository.findByFeatureId(featureId);
    return items.map((i) => this.toRecord(i));
  }

  async search(
    dto: SearchRequirementDto,
  ): Promise<PaginatedResult<RequirementRecord>> {
    const pageIndex = dto.pageIndex ?? 1;
    const pageSize = dto.pageSize ?? 10;
    const { items, total } = await this.requirementRepository.search(dto);
    return paginate(
      items.map((i) => this.toRecord(i)),
      total,
      pageIndex,
      pageSize,
    );
  }

  async update(
    id: string,
    dto: UpdateRequirementDto,
  ): Promise<RequirementRecord> {
    assertValidObjectId(id);
    const updated = await this.requirementRepository.update(id, {
      jiraId: dto.jiraId?.trim(),
      confluenceUrl: dto.confluenceUrl?.trim(),
      requirementText: dto.requirementText?.trim(),
      rawContent: dto.rawContent,
      status: dto.status,
    });
    if (!updated) {
      throw new NotFoundException(`Requirement with id "${id}" not found`);
    }
    return this.toRecord(updated);
  }

  async markStatus(
    id: string,
    status: RequirementRecord['status'],
  ): Promise<RequirementRecord> {
    assertValidObjectId(id);
    const updated = await this.requirementRepository.update(id, { status });
    if (!updated) {
      throw new NotFoundException(`Requirement with id "${id}" not found`);
    }
    return this.toRecord(updated);
  }

  async delete(id: string): Promise<{ id: string }> {
    assertValidObjectId(id);
    const deleted = await this.requirementRepository.delete(id);
    if (!deleted) {
      throw new NotFoundException(`Requirement with id "${id}" not found`);
    }
    return { id };
  }

  private toRecord(doc: RequirementDocument): RequirementRecord {
    const obj = doc.toObject() as Record<string, unknown>;
    return {
      _id: doc._id.toString(),
      featureId: obj.featureId as string,
      testSuiteId: (obj.testSuiteId as string) ?? undefined,
      jiraId: (obj.jiraId as string) ?? undefined,
      confluenceUrl: (obj.confluenceUrl as string) ?? undefined,
      requirementText: (obj.requirementText as string) ?? undefined,
      rawContent: (obj.rawContent as string) ?? undefined,
      status: obj.status as RequirementRecord['status'],
      createdBy: obj.createdBy as string,
      createdAt: obj.createdAt as number,
      updatedAt: obj.updatedAt as number,
    };
  }
}
