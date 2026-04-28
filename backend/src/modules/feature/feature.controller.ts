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
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateFeatureDto } from './dto/create-feature.dto';
import { ListFeaturesQueryDto } from './dto/list-features.query.dto';
import { UpdateFeatureDto } from './dto/update-feature.dto';
import { FeatureService } from './feature.service';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
}

@ApiTags('features')
@Controller('features')
export class FeatureController {
  constructor(private readonly featureService: FeatureService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateFeatureDto): Promise<ApiResponse<unknown>> {
    const feature = await this.featureService.createFeature(dto);
    return {
      success: true,
      message: 'Feature created successfully',
      data: feature,
    };
  }

  @Get()
  async list(@Query() query: ListFeaturesQueryDto): Promise<ApiResponse<unknown>> {
    const result = await this.featureService.listFeatures(query);
    return {
      success: true,
      message: 'Features fetched successfully',
      data: result,
    };
  }

  @Get(':id')
  async getOne(@Param('id') id: string): Promise<ApiResponse<unknown>> {
    const feature = await this.featureService.getFeatureById(id);
    return {
      success: true,
      message: 'Feature fetched successfully',
      data: feature,
    };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateFeatureDto,
  ): Promise<ApiResponse<unknown>> {
    const feature = await this.featureService.updateFeature(id, dto);
    return {
      success: true,
      message: 'Feature updated successfully',
      data: feature,
    };
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<ApiResponse<unknown>> {
    const result = await this.featureService.deleteFeature(id);
    return {
      success: true,
      message: 'Feature deleted successfully',
      data: result,
    };
  }
}
