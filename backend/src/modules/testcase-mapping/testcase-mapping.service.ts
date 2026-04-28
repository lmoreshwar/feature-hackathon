import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TestCaseMappingDocument } from '../../common/schemas';
import { PaginatedResult } from '../../common/interfaces/api-response.interface';
import { paginate } from '../../common/utils/search-query.util';
import { assertValidObjectId } from '../../common/utils/object-id.util';
import { PageElementRepository } from '../page-element/page-element.repository';
import { TestCaseRepository } from '../test-case/test-case.repository';
import { CreateMappingDto } from './dto/create-mapping.dto';
import { GenerateScriptDto } from './dto/generate-script.dto';
import { PushToGitDto } from './dto/push-to-git.dto';
import { SearchMappingDto } from './dto/search-mapping.dto';
import { UpdateMappingDto } from './dto/update-mapping.dto';
import { generateScript } from './script-generator.util';
import { MappingRecord } from './testcase-mapping.interface';
import { MappingRepository } from './testcase-mapping.repository';

@Injectable()
export class MappingService {
  constructor(
    private readonly mappingRepository: MappingRepository,
    private readonly testCaseRepository: TestCaseRepository,
    private readonly pageElementRepository: PageElementRepository,
  ) {}

  async create(
    dto: CreateMappingDto,
    createdBy: string,
  ): Promise<MappingRecord> {
    assertValidObjectId(dto.featureId, 'featureId');
    assertValidObjectId(dto.testSuiteId, 'testSuiteId');
    assertValidObjectId(dto.testCaseId, 'testCaseId');

    const tc = await this.testCaseRepository.findById(dto.testCaseId);
    if (!tc) {
      throw new NotFoundException(
        `Test case with id "${dto.testCaseId}" not found`,
      );
    }

    const elements = await this.pageElementRepository.findByIds(dto.elementIds);
    if (elements.length !== dto.elementIds.length) {
      throw new BadRequestException(
        'One or more elementIds are invalid or missing',
      );
    }

    const existing = await this.mappingRepository.findByTestCaseId(
      dto.testCaseId,
    );
    if (existing) {
      const updated = await this.mappingRepository.update(
        existing._id.toString(),
        {
          elementIds: dto.elementIds,
          scriptType: dto.scriptType ?? 'PLAYWRIGHT',
          generatedScript: dto.generatedScript ?? null,
        },
      );
      return this.toRecord(updated);
    }

    const created = await this.mappingRepository.create({
      featureId: dto.featureId,
      testSuiteId: dto.testSuiteId,
      testCaseId: dto.testCaseId,
      elementIds: dto.elementIds,
      scriptType: dto.scriptType ?? 'PLAYWRIGHT',
      generatedScript: dto.generatedScript ?? null,
      gitPushStatus: 'NOT_PUSHED',
      createdBy,
    });
    return this.toRecord(created);
  }

  async getById(id: string): Promise<MappingRecord> {
    assertValidObjectId(id);
    const found = await this.mappingRepository.findById(id);
    if (!found) {
      throw new NotFoundException(`Mapping with id "${id}" not found`);
    }
    return this.toRecord(found);
  }

  async getByTestCaseId(testCaseId: string): Promise<MappingRecord | null> {
    assertValidObjectId(testCaseId, 'testCaseId');
    const found = await this.mappingRepository.findByTestCaseId(testCaseId);
    return found ? this.toRecord(found) : null;
  }

  async search(
    dto: SearchMappingDto,
  ): Promise<PaginatedResult<MappingRecord>> {
    const pageIndex = dto.pageIndex ?? 1;
    const pageSize = dto.pageSize ?? 10;
    const { items, total } = await this.mappingRepository.search(dto);
    return paginate(
      items.map((i) => this.toRecord(i)),
      total,
      pageIndex,
      pageSize,
    );
  }

  async update(
    id: string,
    dto: UpdateMappingDto,
  ): Promise<MappingRecord> {
    assertValidObjectId(id);
    const updated = await this.mappingRepository.update(id, {
      elementIds: dto.elementIds,
      scriptType: dto.scriptType,
      generatedScript: dto.generatedScript,
      gitPushStatus: dto.gitPushStatus,
    });
    if (!updated) {
      throw new NotFoundException(`Mapping with id "${id}" not found`);
    }
    return this.toRecord(updated);
  }

  async delete(id: string): Promise<{ id: string }> {
    assertValidObjectId(id);
    const deleted = await this.mappingRepository.delete(id);
    if (!deleted) {
      throw new NotFoundException(`Mapping with id "${id}" not found`);
    }
    return { id };
  }

  async generateScript(
    id: string,
    dto: GenerateScriptDto,
  ): Promise<MappingRecord> {
    assertValidObjectId(id);
    const mapping = await this.mappingRepository.findById(id);
    if (!mapping) {
      throw new NotFoundException(`Mapping with id "${id}" not found`);
    }

    const tc = await this.testCaseRepository.findById(
      (mapping.toObject() as { testCaseId: string }).testCaseId,
    );
    if (!tc) {
      throw new NotFoundException('Linked test case not found');
    }

    const elementIds = (mapping.toObject() as { elementIds: string[] })
      .elementIds;
    const elements = await this.pageElementRepository.findByIds(elementIds);

    const scriptType =
      dto.scriptType ??
      ((mapping.toObject() as { scriptType: 'PLAYWRIGHT' | 'CYPRESS' | 'SELENIUM' })
        .scriptType);

    const script = generateScript(scriptType, tc, elements);

    const updated = await this.mappingRepository.update(id, {
      generatedScript: script,
      scriptType,
      gitPushStatus: 'NOT_PUSHED',
    });
    return this.toRecord(updated);
  }

  async pushToGit(
    id: string,
    _dto: PushToGitDto,
  ): Promise<MappingRecord> {
    assertValidObjectId(id);
    const mapping = await this.mappingRepository.findById(id);
    if (!mapping) {
      throw new NotFoundException(`Mapping with id "${id}" not found`);
    }
    const obj = mapping.toObject() as { generatedScript?: string | null };
    if (!obj.generatedScript) {
      throw new BadRequestException(
        'Generate the script before pushing to git',
      );
    }

    // The actual git push is delegated to the integrations layer.
    // Here we mark as PUSHED to mirror a successful integration call.
    const updated = await this.mappingRepository.update(id, {
      gitPushStatus: 'PUSHED',
    });
    return this.toRecord(updated);
  }

  async markPushFailed(id: string): Promise<MappingRecord> {
    assertValidObjectId(id);
    const updated = await this.mappingRepository.update(id, {
      gitPushStatus: 'FAILED',
    });
    if (!updated) {
      throw new NotFoundException(`Mapping with id "${id}" not found`);
    }
    return this.toRecord(updated);
  }

  private toRecord(doc: TestCaseMappingDocument): MappingRecord {
    const obj = doc.toObject() as Record<string, unknown>;
    return {
      _id: doc._id.toString(),
      featureId: obj.featureId as string,
      testSuiteId: obj.testSuiteId as string,
      testCaseId: obj.testCaseId as string,
      elementIds: (obj.elementIds as string[]) ?? [],
      generatedScript: (obj.generatedScript as string) ?? undefined,
      scriptType: obj.scriptType as MappingRecord['scriptType'],
      gitPushStatus: (obj.gitPushStatus as MappingRecord['gitPushStatus']) ??
        'NOT_PUSHED',
      createdBy: obj.createdBy as string,
      createdAt: obj.createdAt as number,
      updatedAt: obj.updatedAt as number,
    };
  }
}
