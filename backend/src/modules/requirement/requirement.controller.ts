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
import { CreateRequirementDto } from './dto/create-requirement.dto';
import { SearchRequirementDto } from './dto/search-requirement.dto';
import { UpdateRequirementDto } from './dto/update-requirement.dto';
import { RequirementService } from './requirement.service';

@ApiTags('requirements')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('requirements')
export class RequirementController {
  constructor(private readonly requirementService: RequirementService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateRequirementDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const created = await this.requirementService.create(dto, user.sub);
    return ok('Requirement source created successfully', created);
  }

  @Post('search')
  @HttpCode(HttpStatus.OK)
  async search(
    @Body() dto: SearchRequirementDto,
  ): Promise<ApiResponse<unknown>> {
    const result = await this.requirementService.search(dto);
    return ok('Fetched successfully', result);
  }

  @Get('by-feature/:featureId')
  async listByFeature(
    @Param('featureId') featureId: string,
  ): Promise<ApiResponse<unknown>> {
    const items = await this.requirementService.listByFeature(featureId);
    return ok('Requirements fetched successfully', items);
  }

  @Get(':id')
  async getOne(@Param('id') id: string): Promise<ApiResponse<unknown>> {
    const found = await this.requirementService.getById(id);
    return ok('Requirement fetched successfully', found);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateRequirementDto,
  ): Promise<ApiResponse<unknown>> {
    const updated = await this.requirementService.update(id, dto);
    return ok('Requirement updated successfully', updated);
  }

  @Post(':id/mark-processed')
  @HttpCode(HttpStatus.OK)
  async markProcessed(
    @Param('id') id: string,
  ): Promise<ApiResponse<unknown>> {
    const updated = await this.requirementService.markStatus(id, 'PROCESSED');
    return ok('Requirement marked as processed', updated);
  }

  @Post(':id/mark-failed')
  @HttpCode(HttpStatus.OK)
  async markFailed(@Param('id') id: string): Promise<ApiResponse<unknown>> {
    const updated = await this.requirementService.markStatus(id, 'FAILED');
    return ok('Requirement marked as failed', updated);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<ApiResponse<unknown>> {
    const result = await this.requirementService.delete(id);
    return ok('Requirement deleted successfully', result);
  }
}
