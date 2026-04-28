import {
  BadRequestException,
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
import { ApiResponse, ok } from '../../common/interfaces/api-response.interface';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { AuthenticatedUser } from '../auth/auth.interface';
import { CurrentUser } from '../auth/current-user.decorator';
import { CaptureService } from './capture.service';
import { CrawlerService } from './crawler.service';
import { BulkCreatePageElementDto } from './dto/bulk-create-page-element.dto';
import { CrawlPageDto } from './dto/crawl-page.dto';
import { CreatePageElementDto } from './dto/create-page-element.dto';
import { SearchPageElementDto } from './dto/search-page-element.dto';
import { StartCaptureDto } from './dto/start-capture.dto';
import { UpdatePageElementDto } from './dto/update-page-element.dto';
import { PageElementService } from './page-element.service';

@ApiTags('page-elements')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('page-elements')
export class PageElementController {
  constructor(
    private readonly pageElementService: PageElementService,
    private readonly crawlerService: CrawlerService,
    private readonly captureService: CaptureService,
  ) {}

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

  @Post('crawl')
  @HttpCode(HttpStatus.CREATED)
  async crawl(
    @Body() dto: CrawlPageDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const elements = await this.crawlerService.crawl(dto, user.sub);
    const saved = await this.pageElementService.bulkCreate(
      { elements },
      user.sub,
    );
    return ok('Page crawled successfully', saved);
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

  @Get('by-feature/:featureId/pages')
  async pagesByFeature(
    @Param('featureId') featureId: string,
  ): Promise<ApiResponse<unknown>> {
    const groups = await this.pageElementService.getPagesByFeature(featureId);
    return ok('Pages fetched successfully', groups);
  }

  @Get('by-feature/:featureId/pom')
  async pomByFeature(
    @Param('featureId') featureId: string,
    @Query('framework') frameworkRaw?: string,
  ): Promise<ApiResponse<unknown>> {
    const framework = (frameworkRaw ?? 'PLAYWRIGHT').toUpperCase();
    if (
      framework !== 'PLAYWRIGHT' &&
      framework !== 'CYPRESS' &&
      framework !== 'SELENIUM'
    ) {
      throw new BadRequestException(
        'framework must be one of PLAYWRIGHT, CYPRESS, SELENIUM',
      );
    }
    const files = await this.pageElementService.getPomByFeature(
      featureId,
      framework,
    );
    return ok('POM generated successfully', files);
  }

  // -----------------------------------------------------------
  //  Manual capture session ("click-to-record" mode)
  //  start  → launches a non-headless browser the user can interact with
  //  list   → polled by the UI every ~1.5s for newly-captured elements
  //  save   → persists captured elements to MongoDB and closes browser
  //  stop   → closes the browser without persisting
  // -----------------------------------------------------------

  @Post('capture/start')
  @HttpCode(HttpStatus.CREATED)
  async startCapture(
    @Body() dto: StartCaptureDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const result = await this.captureService.start(dto, user.sub);
    return ok('Capture session started', result);
  }

  @Get('capture/:sessionId')
  capturedElements(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): ApiResponse<unknown> {
    const captured = this.captureService.list(sessionId, user.sub);
    return ok('Captured elements fetched', captured);
  }

  @Post('capture/:sessionId/save')
  @HttpCode(HttpStatus.OK)
  async saveCapture(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const elements = this.captureService.finalize(sessionId, user.sub);
    const saved = await this.pageElementService.bulkCreate(
      { elements },
      user.sub,
    );
    await this.captureService.stop(sessionId, user.sub).catch(() => undefined);
    return ok('Captured elements saved', saved);
  }

  @Post('capture/:sessionId/stop')
  @HttpCode(HttpStatus.OK)
  async stopCapture(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const result = await this.captureService.stop(sessionId, user.sub);
    return ok('Capture session stopped', result);
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
