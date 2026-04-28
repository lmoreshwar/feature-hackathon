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
import { BulkCreatePageElementDto } from './dto/bulk-create-page-element.dto';
import { CreatePageElementDto } from './dto/create-page-element.dto';
import { SearchPageElementDto } from './dto/search-page-element.dto';
import { UpdatePageElementDto } from './dto/update-page-element.dto';
import { PageElementService } from './page-element.service';

@ApiTags('page-elements')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('page-elements')
export class PageElementController {
  constructor(private readonly pageElementService: PageElementService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreatePageElementDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const created = await this.pageElementService.create(dto, user.sub);
    return ok('Page element created successfully', created);
  }

  @Post('bulk')
  @HttpCode(HttpStatus.CREATED)
  async bulkCreate(
    @Body() dto: BulkCreatePageElementDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const created = await this.pageElementService.bulkCreate(dto, user.sub);
    return ok('Page elements created successfully', created);
  }

  @Post('search')
  @HttpCode(HttpStatus.OK)
  async search(
    @Body() dto: SearchPageElementDto,
  ): Promise<ApiResponse<unknown>> {
    const result = await this.pageElementService.search(dto);
    return ok('Fetched successfully', result);
  }

  @Get('by-feature/:featureId')
  async listByFeature(
    @Param('featureId') featureId: string,
  ): Promise<ApiResponse<unknown>> {
    const items = await this.pageElementService.listByFeature(featureId);
    return ok('Page elements fetched successfully', items);
  }

  @Get(':id')
  async getOne(@Param('id') id: string): Promise<ApiResponse<unknown>> {
    const found = await this.pageElementService.getById(id);
    return ok('Page element fetched successfully', found);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePageElementDto,
  ): Promise<ApiResponse<unknown>> {
    const updated = await this.pageElementService.update(id, dto);
    return ok('Page element updated successfully', updated);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<ApiResponse<unknown>> {
    const result = await this.pageElementService.delete(id);
    return ok('Page element deleted successfully', result);
  }
}
