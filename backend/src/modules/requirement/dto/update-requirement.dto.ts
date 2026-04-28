import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUrl } from 'class-validator';
import { RequirementStatus } from '../requirement.interface';

export class UpdateRequirementDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  jiraId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  confluenceUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  requirementText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rawContent?: string;

  @ApiPropertyOptional({ enum: ['PENDING', 'PROCESSED', 'FAILED'] })
  @IsOptional()
  @IsEnum(['PENDING', 'PROCESSED', 'FAILED'])
  status?: RequirementStatus;
}
