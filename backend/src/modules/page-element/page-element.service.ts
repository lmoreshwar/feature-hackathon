import { Injectable, NotFoundException } from '@nestjs/common';
import { PageElementDocument } from '../../common/schemas';
import { PaginatedResult } from '../../common/interfaces/api-response.interface';
import { paginate } from '../../common/utils/search-query.util';
import { assertValidObjectId } from '../../common/utils/object-id.util';
import { BulkCreatePageElementDto } from './dto/bulk-create-page-element.dto';
import { CreatePageElementDto } from './dto/create-page-element.dto';
import { SearchPageElementDto } from './dto/search-page-element.dto';
import { UpdatePageElementDto } from './dto/update-page-element.dto';
import { PageElementRecord } from './page-element.interface';
import { PageElementRepository } from './page-element.repository';
import {
  PageGroup,
  PomFile,
  PomFramework,
  generatePomFiles,
  groupElementsByPage,
} from './pom-generator.util';

@Injectable()
export class PageElementService {
  constructor(private readonly pageElementRepository: PageElementRepository) {}

  async create(
    dto: CreatePageElementDto,
    createdBy: string,
  ): Promise<PageElementRecord> {
    assertValidObjectId(dto.featureId, 'featureId');
    if (dto.testSuiteId) {
      assertValidObjectId(dto.testSuiteId, 'testSuiteId');
    }
    const created = await this.pageElementRepository.create({
      featureId: dto.featureId,
      testSuiteId: dto.testSuiteId ?? null,
      pageUrl: dto.pageUrl.trim(),
      pageName: dto.pageName?.trim() ?? null,
      elementName: dto.elementName.trim(),
      elementType: dto.elementType,
      selector: dto.selector.trim(),
      selectorType: dto.selectorType,
      isStable: dto.isStable ?? true,
      createdBy,
    });
    return this.toRecord(created);
  }

  async bulkCreate(
    dto: BulkCreatePageElementDto,
    createdBy: string,
  ): Promise<PageElementRecord[]> {
    return Promise.all(
      dto.elements.map((el) => this.create(el, createdBy)),
    );
  }

  async getById(id: string): Promise<PageElementRecord> {
    assertValidObjectId(id);
    const found = await this.pageElementRepository.findById(id);
    if (!found) {
      throw new NotFoundException(`Page element with id "${id}" not found`);
    }
    return this.toRecord(found);
  }

  async listByFeature(featureId: string): Promise<PageElementRecord[]> {
    assertValidObjectId(featureId, 'featureId');
    const items = await this.pageElementRepository.findByFeatureId(featureId);
    return items.map((i) => this.toRecord(i));
  }

  async getPagesByFeature(featureId: string): Promise<PageGroup[]> {
    const elements = await this.listByFeature(featureId);
    return groupElementsByPage(elements);
  }

  async getPomByFeature(
    featureId: string,
    framework: PomFramework,
  ): Promise<PomFile[]> {
    const groups = await this.getPagesByFeature(featureId);
    return generatePomFiles(framework, groups);
  }

  async search(
    dto: SearchPageElementDto,
  ): Promise<PaginatedResult<PageElementRecord>> {
    const pageIndex = dto.pageIndex ?? 1;
    const pageSize = dto.pageSize ?? 10;
    const { items, total } = await this.pageElementRepository.search(dto);
    return paginate(
      items.map((i) => this.toRecord(i)),
      total,
      pageIndex,
      pageSize,
    );
  }

  async update(
    id: string,
    dto: UpdatePageElementDto,
  ): Promise<PageElementRecord> {
    assertValidObjectId(id);
    const updated = await this.pageElementRepository.update(id, {
      pageUrl: dto.pageUrl?.trim(),
      pageName: dto.pageName?.trim(),
      elementName: dto.elementName?.trim(),
      elementType: dto.elementType,
      selector: dto.selector?.trim(),
      selectorType: dto.selectorType,
      isStable: dto.isStable,
    });
    if (!updated) {
      throw new NotFoundException(`Page element with id "${id}" not found`);
    }
    return this.toRecord(updated);
  }

  async delete(id: string): Promise<{ id: string }> {
    assertValidObjectId(id);
    const deleted = await this.pageElementRepository.delete(id);
    if (!deleted) {
      throw new NotFoundException(`Page element with id "${id}" not found`);
    }
    return { id };
  }

  private toRecord(doc: PageElementDocument): PageElementRecord {
    const obj = doc.toObject() as Record<string, unknown>;
    return {
      _id: doc._id.toString(),
      featureId: obj.featureId as string,
      testSuiteId: (obj.testSuiteId as string) ?? undefined,
      pageUrl: obj.pageUrl as string,
      pageName: (obj.pageName as string) ?? undefined,
      elementName: obj.elementName as string,
      elementType: obj.elementType as PageElementRecord['elementType'],
      selector: obj.selector as string,
      selectorType: obj.selectorType as PageElementRecord['selectorType'],
      isStable: (obj.isStable as boolean) ?? true,
      createdBy: obj.createdBy as string,
      createdAt: obj.createdAt as number,
      updatedAt: obj.updatedAt as number,
    };
  }
}
