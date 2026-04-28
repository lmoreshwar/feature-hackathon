import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ApiResponse, ok } from '../../common/interfaces/api-response.interface';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { MetricsService } from './metrics.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('dashboard')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('metrics')
  async getMetrics(): Promise<ApiResponse<unknown>> {
    const metrics = await this.metricsService.getDashboardMetrics();
    return ok('Dashboard metrics fetched successfully', metrics);
  }

  @Get('traceability')
  async getTraceability(
    @Query('featureId') featureId?: string,
  ): Promise<ApiResponse<unknown>> {
    const rows = await this.metricsService.getTraceability(featureId);
    return ok('Traceability matrix fetched successfully', rows);
  }

  @Get('feature/:featureId')
  async getFeatureMetrics(
    @Param('featureId') featureId: string,
  ): Promise<ApiResponse<unknown>> {
    const counts = await this.metricsService.getCountsByFeature(featureId);
    return ok('Feature metrics fetched successfully', counts);
  }
}
