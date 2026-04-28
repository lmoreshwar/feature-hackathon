import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ApiResponse, ok } from '../../common/interfaces/api-response.interface';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { AuthenticatedUser } from '../auth/auth.interface';
import { CurrentUser } from '../auth/current-user.decorator';
import { UpsertIntegrationDto } from './dto/upsert-integration.dto';
import { IntegrationService } from './integration.service';

type IntegrationSection = 'jira' | 'confluence' | 'llm' | 'git' | 'browserstack';

@ApiTags('integrations')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('integrations')
export class IntegrationController {
  constructor(private readonly integrationService: IntegrationService) {}

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
}
