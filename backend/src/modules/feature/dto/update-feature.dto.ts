import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { FeatureStatus } from '../feature.interface';

export class UpdateFeatureDto {
  @ApiPropertyOptional({
    example: 'Checkout Workflow',
    description: 'Updated feature name',
  })
  @IsOptional()
  @IsString({ message: 'name must be a string' })
  @MinLength(2, { message: 'name must be at least 2 characters long' })
  name?: string;

  @ApiPropertyOptional({
    example: 'Covers checkout flow with payment validation',
    description: 'Updated feature description',
  })
  @IsOptional()
  @IsString({ message: 'description must be a string' })
  description?: string;

  @ApiPropertyOptional({
    enum: ['DRAFT', 'ACTIVE', 'ARCHIVED'],
    description: 'Updated lifecycle status',
  })
  @IsOptional()
  @IsEnum(['DRAFT', 'ACTIVE', 'ARCHIVED'], {
    message: 'status must be one of DRAFT, ACTIVE, ARCHIVED',
  })
  status?: FeatureStatus;

  @ApiPropertyOptional({
    example: 10,
    minimum: 0,
    description: 'Updated total suite count',
  })
  @IsOptional()
  @IsInt({ message: 'totalSuites must be an integer' })
  @Min(0, { message: 'totalSuites must be >= 0' })
  totalSuites?: number;

  @ApiPropertyOptional({
    example: 64,
    minimum: 0,
    description: 'Updated total case count',
  })
  @IsOptional()
  @IsInt({ message: 'totalTestCases must be an integer' })
  @Min(0, { message: 'totalTestCases must be >= 0' })
  totalTestCases?: number;

  @ApiPropertyOptional({
    example: 92,
    minimum: 0,
    maximum: 100,
    description: 'Updated coverage percentage',
  })
  @IsOptional()
  @Min(0, { message: 'coveragePercentage must be >= 0' })
  @Max(100, { message: 'coveragePercentage must be <= 100' })
  coveragePercentage?: number;

  @ApiPropertyOptional({
    example: '664c2bc84eb14f4d6a4b9d2e',
    description: 'Updated owner user id',
  })
  @IsOptional()
  @IsMongoId({ message: 'createdBy must be a valid MongoDB ObjectId' })
  createdBy?: string;
}
