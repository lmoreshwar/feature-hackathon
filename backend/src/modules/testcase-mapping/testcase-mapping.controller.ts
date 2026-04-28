import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ApiResponse, ok } from '../../common/interfaces/api-response.interface';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { AuthenticatedUser } from '../auth/auth.interface';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateMappingDto } from './dto/create-mapping.dto';
import { GenerateScriptDto } from './dto/generate-script.dto';
import { PushToGitDto } from './dto/push-to-git.dto';
import { SearchMappingDto } from './dto/search-mapping.dto';
import { SuggestMappingDto } from './dto/suggest-mapping.dto';
import { UpdateMappingDto } from './dto/update-mapping.dto';
import { MappingService } from './testcase-mapping.service';

@ApiTags('testcase-mappings')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('testcase-mappings')
export class MappingController {
  constructor(private readonly mappingService: MappingService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateMappingDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const created = await this.mappingService.create(dto, user.sub);
    return ok('Mapping saved successfully', created);
  }

  @Post('search')
  @HttpCode(HttpStatus.OK)
  async search(@Body() dto: SearchMappingDto): Promise<ApiResponse<unknown>> {
    const result = await this.mappingService.search(dto);
    return ok('Fetched successfully', result);
  }

  @Get('by-test-case/:testCaseId')
  async byTestCase(
    @Param('testCaseId') testCaseId: string,
  ): Promise<ApiResponse<unknown>> {
    const found = await this.mappingService.getByTestCaseId(testCaseId);
    return ok('Mapping fetched successfully', found);
  }

  @Post('suggest')
  @HttpCode(HttpStatus.OK)
  async suggest(
    @Body() dto: SuggestMappingDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const suggestion = await this.mappingService.suggestForTestCase(
      dto.testCaseId,
      user.sub,
    );
    return ok('Mapping suggestions generated', suggestion);
  }

  @Get(':id')
  async getOne(@Param('id') id: string): Promise<ApiResponse<unknown>> {
    const found = await this.mappingService.getById(id);
    return ok('Mapping fetched successfully', found);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateMappingDto,
  ): Promise<ApiResponse<unknown>> {
    const updated = await this.mappingService.update(id, dto);
    return ok('Mapping updated successfully', updated);
  }

  @Post(':id/generate-script')
  @HttpCode(HttpStatus.OK)
  async generateScript(
    @Param('id') id: string,
    @Body() dto: GenerateScriptDto,
  ): Promise<ApiResponse<unknown>> {
    const updated = await this.mappingService.generateScript(id, dto);
    return ok('Script generated successfully', updated);
  }

  @Post(':id/push-to-git')
  @HttpCode(HttpStatus.OK)
  async push(
    @Param('id') id: string,
    @Body() dto: PushToGitDto,
  ): Promise<ApiResponse<unknown>> {
    const updated = await this.mappingService.pushToGit(id, dto);
    return ok('Script pushed to Git successfully', updated);
  }

  @Post(':id/mark-push-failed')
  @HttpCode(HttpStatus.OK)
  async markFailed(@Param('id') id: string): Promise<ApiResponse<unknown>> {
    const updated = await this.mappingService.markPushFailed(id);
    return ok('Mapping push status updated', updated);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<ApiResponse<unknown>> {
    const result = await this.mappingService.delete(id);
    return ok('Mapping deleted successfully', result);
  }
}
