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
import { BulkCreateTestCaseDto } from './dto/bulk-create-test-case.dto';
import { CoverageReviewDto } from './dto/coverage-review.dto';
import { CreateTestCaseDto } from './dto/create-test-case.dto';
import { SearchTestCaseDto } from './dto/search-test-case.dto';
import { UpdateTestCaseDto } from './dto/update-test-case.dto';
import { TestCaseService } from './test-case.service';

@ApiTags('test-cases')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('test-cases')
export class TestCaseController {
  constructor(private readonly testCaseService: TestCaseService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateTestCaseDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const created = await this.testCaseService.create(dto, user.sub);
    return ok('Test case created successfully', created);
  }

  @Post('bulk')
  @HttpCode(HttpStatus.CREATED)
  async bulkCreate(
    @Body() dto: BulkCreateTestCaseDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const created = await this.testCaseService.bulkCreate(dto, user.sub);
    return ok('Test cases created successfully', created);
  }

  @Post('search')
  @HttpCode(HttpStatus.OK)
  async search(@Body() dto: SearchTestCaseDto): Promise<ApiResponse<unknown>> {
    const result = await this.testCaseService.search(dto);
    return ok('Fetched successfully', result);
  }

  @Post('coverage')
  @HttpCode(HttpStatus.OK)
  async coverage(
    @Body() dto: CoverageReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const result = await this.testCaseService.coverageReview(dto, user.sub);
    return ok('Coverage computed', result);
  }

  @Get('by-suite/:testSuiteId')
  async listBySuite(
    @Param('testSuiteId') testSuiteId: string,
  ): Promise<ApiResponse<unknown>> {
    const items = await this.testCaseService.listBySuite(testSuiteId);
    return ok('Test cases fetched successfully', items);
  }

  @Get(':id')
  async getOne(@Param('id') id: string): Promise<ApiResponse<unknown>> {
    const found = await this.testCaseService.getById(id);
    return ok('Test case fetched successfully', found);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTestCaseDto,
  ): Promise<ApiResponse<unknown>> {
    const updated = await this.testCaseService.update(id, dto);
    return ok('Test case updated successfully', updated);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  async approve(@Param('id') id: string): Promise<ApiResponse<unknown>> {
    const updated = await this.testCaseService.setStatus(id, 'APPROVED');
    return ok('Test case approved', updated);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  async reject(@Param('id') id: string): Promise<ApiResponse<unknown>> {
    const updated = await this.testCaseService.setStatus(id, 'REJECTED');
    return ok('Test case rejected', updated);
  }

  @Post(':id/needs-review')
  @HttpCode(HttpStatus.OK)
  async needsReview(@Param('id') id: string): Promise<ApiResponse<unknown>> {
    const updated = await this.testCaseService.setStatus(id, 'NEEDS_REVIEW');
    return ok('Test case marked as needs review', updated);
  }

  @Post('bulk-approve')
  @HttpCode(HttpStatus.OK)
  async bulkApprove(
    @Body() body: { ids: string[] },
  ): Promise<ApiResponse<unknown>> {
    const result = await this.testCaseService.bulkSetStatus(
      body?.ids ?? [],
      'APPROVED',
    );
    return ok(`Approved ${result.updated} test case(s)`, result);
  }

  @Post('bulk-reject')
  @HttpCode(HttpStatus.OK)
  async bulkReject(
    @Body() body: { ids: string[] },
  ): Promise<ApiResponse<unknown>> {
    const result = await this.testCaseService.bulkSetStatus(
      body?.ids ?? [],
      'REJECTED',
    );
    return ok(`Rejected ${result.updated} test case(s)`, result);
  }

  @Post('recompute-automation')
  @HttpCode(HttpStatus.OK)
  async recomputeAutomation(
    @Body() body: { featureId?: string; testSuiteId?: string },
  ): Promise<ApiResponse<unknown>> {
    const result = await this.testCaseService.recomputeAutomation({
      featureId: body?.featureId,
      testSuiteId: body?.testSuiteId,
    });
    const message =
      result.changed === 0
        ? `Re-evaluated ${result.scanned} test case(s); no changes needed.`
        : `Re-evaluated ${result.scanned} test case(s); flipped ${result.changed} to match the new heuristic.`;
    return ok(message, result);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<ApiResponse<unknown>> {
    const result = await this.testCaseService.delete(id);
    return ok('Test case deleted successfully', result);
  }
}
