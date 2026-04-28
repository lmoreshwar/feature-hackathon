import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export type CoverageInputType = 'jira' | 'confluence' | 'text';

export class CoverageReviewDto {
  @ApiProperty({ enum: ['jira', 'confluence', 'text'] })
  @IsIn(['jira', 'confluence', 'text'])
  inputType!: CoverageInputType;

  @ApiPropertyOptional({ description: 'Jira ticket id, e.g. PROJ-123' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  jiraId?: string;

  @ApiPropertyOptional({ description: 'Confluence page URL (reference only, not crawled)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  confluenceUrl?: string;

  @ApiPropertyOptional({ description: 'Pasted requirement text' })
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  text?: string;
}

export interface CoverageReviewResponse {
  percentage: number;
  full: number;
  partial: number;
  none: number;
  total: number;
  testCasesEvaluated: number;
  inputType: CoverageInputType;
  source: string;
}
