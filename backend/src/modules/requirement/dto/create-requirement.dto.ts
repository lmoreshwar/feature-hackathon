import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  IsUrl,
  ValidateIf,
} from 'class-validator';
import { RequirementStatus } from '../requirement.interface';

export class CreateRequirementDto {
  @ApiProperty({ example: '664c2bc84eb14f4d6a4b9d2e' })
  @IsMongoId({ message: 'featureId must be a valid MongoDB ObjectId' })
  featureId: string;

  @ApiPropertyOptional({ example: '664c2bc84eb14f4d6a4b9d2f' })
  @IsOptional()
  @IsMongoId({ message: 'testSuiteId must be a valid MongoDB ObjectId' })
  testSuiteId?: string;

  @ApiPropertyOptional({ example: 'PROJ-123' })
  @IsOptional()
  @IsString()
  @ValidateIf(
    (o: CreateRequirementDto) =>
      !o.confluenceUrl && !o.requirementText && !o.jiraId,
  )
  jiraId?: string;

  @ApiPropertyOptional({ example: 'https://wiki.example.com/page/PROJ-123' })
  @IsOptional()
  @IsUrl({}, { message: 'confluenceUrl must be a valid URL' })
  @ValidateIf(
    (o: CreateRequirementDto) =>
      !o.jiraId && !o.requirementText && !o.confluenceUrl,
  )
  confluenceUrl?: string;

  @ApiPropertyOptional({
    example: 'As a user, I want to log in with valid credentials...',
  })
  @IsOptional()
  @IsString()
  @ValidateIf(
    (o: CreateRequirementDto) =>
      !o.jiraId && !o.confluenceUrl && !o.requirementText,
  )
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
