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
import { CreateExecutionDto } from './dto/create-execution.dto';
import { SearchExecutionDto } from './dto/search-execution.dto';
import { UpdateExecutionDto } from './dto/update-execution.dto';
import { ExecutionService } from './test-execution.service';

@ApiTags('test-executions')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('test-executions')
export class ExecutionController {
  constructor(private readonly executionService: ExecutionService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateExecutionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const created = await this.executionService.trigger(dto, user.sub);
    return ok('Execution triggered successfully', created);
  }

  @Post('search')
  @HttpCode(HttpStatus.OK)
  async search(
    @Body() dto: SearchExecutionDto,
  ): Promise<ApiResponse<unknown>> {
    const result = await this.executionService.search(dto);
    return ok('Fetched successfully', result);
  }

  @Get(':id')
  async getOne(@Param('id') id: string): Promise<ApiResponse<unknown>> {
    const found = await this.executionService.getById(id);
    return ok('Execution fetched successfully', found);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateExecutionDto,
  ): Promise<ApiResponse<unknown>> {
    const updated = await this.executionService.update(id, dto);
    return ok('Execution updated successfully', updated);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(@Param('id') id: string): Promise<ApiResponse<unknown>> {
    const updated = await this.executionService.setStatus(id, 'CANCELLED');
    return ok('Execution cancelled', updated);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<ApiResponse<unknown>> {
    const result = await this.executionService.delete(id);
    return ok('Execution deleted successfully', result);
  }
}
