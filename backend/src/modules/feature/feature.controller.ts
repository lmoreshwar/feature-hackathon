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
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { ApiResponse, ok } from '../../common/interfaces/api-response.interface';
import { CreateFeatureDto } from './dto/create-feature.dto';
import { ListFeaturesQueryDto } from './dto/list-features.query.dto';
import { SearchFeatureDto } from './dto/search-feature.dto';
import { UpdateFeatureDto } from './dto/update-feature.dto';
import { FeatureService } from './feature.service';

@ApiTags('features')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('features')
export class FeatureController {
  constructor(private readonly featureService: FeatureService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateFeatureDto): Promise<ApiResponse<unknown>> {
    const feature = await this.featureService.createFeature(dto);
    return ok('Feature created successfully', feature);
  }

  @Get()
  async list(
    @Query() query: ListFeaturesQueryDto,
  ): Promise<ApiResponse<unknown>> {
    const result = await this.featureService.listFeatures(query);
    return ok('Features fetched successfully', result);
  }

  @Post('search')
  @HttpCode(HttpStatus.OK)
  async search(@Body() dto: SearchFeatureDto): Promise<ApiResponse<unknown>> {
    const result = await this.featureService.searchFeatures(dto);
    return ok('Fetched successfully', result);
  }

  @Get(':id')
  async getOne(@Param('id') id: string): Promise<ApiResponse<unknown>> {
    const feature = await this.featureService.getFeatureById(id);
    return ok('Feature fetched successfully', feature);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateFeatureDto,
  ): Promise<ApiResponse<unknown>> {
    const feature = await this.featureService.updateFeature(id, dto);
    return ok('Feature updated successfully', feature);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  async archive(@Param('id') id: string): Promise<ApiResponse<unknown>> {
    const feature = await this.featureService.archiveFeature(id);
    return ok('Feature archived successfully', feature);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<ApiResponse<unknown>> {
    const result = await this.featureService.deleteFeature(id);
    return ok('Feature deleted successfully', result);
  }
}
