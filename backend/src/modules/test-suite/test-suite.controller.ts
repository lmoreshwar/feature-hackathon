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
import { CreateTestSuiteDto } from './dto/create-test-suite.dto';
import { SearchTestSuiteDto } from './dto/search-test-suite.dto';
import { UpdateTestSuiteDto } from './dto/update-test-suite.dto';
import { TestSuiteService } from './test-suite.service';

@ApiTags('test-suites')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('test-suites')
export class TestSuiteController {
  constructor(private readonly testSuiteService: TestSuiteService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateTestSuiteDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const created = await this.testSuiteService.createTestSuite(dto, user.sub);
    return ok('Test suite created successfully', created);
  }

  @Post('search')
  @HttpCode(HttpStatus.OK)
  async search(
    @Body() dto: SearchTestSuiteDto,
  ): Promise<ApiResponse<unknown>> {
    const result = await this.testSuiteService.search(dto);
    return ok('Fetched successfully', result);
  }

  @Get('by-feature/:featureId')
  async listByFeature(
    @Param('featureId') featureId: string,
  ): Promise<ApiResponse<unknown>> {
    const items = await this.testSuiteService.listByFeature(featureId);
    return ok('Test suites fetched successfully', items);
  }

  @Get(':id')
  async getOne(@Param('id') id: string): Promise<ApiResponse<unknown>> {
    const found = await this.testSuiteService.getById(id);
    return ok('Test suite fetched successfully', found);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTestSuiteDto,
  ): Promise<ApiResponse<unknown>> {
    const updated = await this.testSuiteService.update(id, dto);
    return ok('Test suite updated successfully', updated);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  async archive(@Param('id') id: string): Promise<ApiResponse<unknown>> {
    const archived = await this.testSuiteService.archive(id);
    return ok('Test suite archived successfully', archived);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<ApiResponse<unknown>> {
    const result = await this.testSuiteService.delete(id);
    return ok('Test suite deleted successfully', result);
  }
}
