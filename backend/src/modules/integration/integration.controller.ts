import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ApiResponse, ok } from '../../common/interfaces/api-response.interface';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { AuthenticatedUser } from '../auth/auth.interface';
import { CurrentUser } from '../auth/current-user.decorator';
import { UpsertIntegrationDto } from './dto/upsert-integration.dto';
import {
  IntegrationSection,
  IntegrationTesterService,
} from './integration-tester.service';
import { IntegrationService } from './integration.service';
import { JiraFetcherService } from './jira-fetcher.service';

@ApiTags('integrations')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('integrations')
export class IntegrationController {
  constructor(
    private readonly integrationService: IntegrationService,
    private readonly integrationTester: IntegrationTesterService,
    private readonly jiraFetcher: JiraFetcherService,
  ) {}

  @Get('me')
  async getMine(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const found = await this.integrationService.getMine(user.sub);
    return ok('Integration settings fetched successfully', found);
  }

  @Put('me')
  @HttpCode(HttpStatus.OK)
  async upsertMine(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertIntegrationDto,
  ): Promise<ApiResponse<unknown>> {
    const saved = await this.integrationService.upsertMine(user.sub, dto);
    return ok('Integration settings saved successfully', saved);
  }

  @Delete('me/:section')
  async clear(
    @CurrentUser() user: AuthenticatedUser,
    @Param('section') section: IntegrationSection,
  ): Promise<ApiResponse<unknown>> {
    const updated = await this.integrationService.clearSection(user.sub, section);
    return ok(`Integration section "${section}" cleared`, updated);
  }

  @Post('me/:section/test')
  @HttpCode(HttpStatus.OK)
  async test(
    @CurrentUser() user: AuthenticatedUser,
    @Param('section') section: IntegrationSection,
  ): Promise<ApiResponse<unknown>> {
    const result = await this.integrationTester.test(user.sub, section);
    return ok(result.message, result);
  }

  @Get('jira/issues/:key')
  async fetchJiraIssue(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string,
  ): Promise<ApiResponse<unknown>> {
    const result = await this.jiraFetcher.fetchTicket(user.sub, key);
    return ok('Jira issue fetched successfully', result);
  }
}
