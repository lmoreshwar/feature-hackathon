import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsObject, IsOptional, ValidateNested } from 'class-validator';
import { BrowserStackSettingsDto } from './browserstack-settings.dto';
import { ConfluenceSettingsDto } from './confluence-settings.dto';
import { GitSettingsDto } from './git-settings.dto';
import { JiraSettingsDto } from './jira-settings.dto';
import { LlmSettingsDto } from './llm-settings.dto';

export class UpsertIntegrationDto {
  @ApiPropertyOptional({ type: () => JiraSettingsDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => JiraSettingsDto)
  jira?: JiraSettingsDto;

  @ApiPropertyOptional({ type: () => ConfluenceSettingsDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ConfluenceSettingsDto)
  confluence?: ConfluenceSettingsDto;

  @ApiPropertyOptional({ type: () => LlmSettingsDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => LlmSettingsDto)
  llm?: LlmSettingsDto;

  @ApiPropertyOptional({ type: () => GitSettingsDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => GitSettingsDto)
  git?: GitSettingsDto;

  @ApiPropertyOptional({ type: () => BrowserStackSettingsDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => BrowserStackSettingsDto)
  browserstack?: BrowserStackSettingsDto;
}
