import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class CreateFeatureDto {
  @ApiProperty({
    example: 'Login Workflow',
    description: 'Unique name for the feature',
  })
  @IsString({ message: 'name must be a string' })
  @MinLength(2, { message: 'name must be at least 2 characters long' })
  name: string;

  @ApiPropertyOptional({
    example: 'Validates end-to-end login scenarios',
    description: 'Optional description for the feature',
  })
  @IsOptional()
  @IsString({ message: 'description must be a string' })
  description?: string;

  @ApiPropertyOptional({
    enum: ['DRAFT', 'ACTIVE', 'ARCHIVED'],
    default: 'DRAFT',
    description: 'Current lifecycle state of the feature',
  })
  @IsOptional()
  @IsEnum(['DRAFT', 'ACTIVE', 'ARCHIVED'], {
    message: 'status must be one of DRAFT, ACTIVE, ARCHIVED',
  })
  status?: FeatureStatus;

  @ApiPropertyOptional({
    example: 4,
    minimum: 0,
    description: 'Total number of linked test suites',
  })
  @IsOptional()
  @IsInt({ message: 'totalSuites must be an integer' })
  @Min(0, { message: 'totalSuites must be >= 0' })
  totalSuites?: number;

  @ApiPropertyOptional({
    example: 28,
    minimum: 0,
    description: 'Total number of linked test cases',
  })
  @IsOptional()
  @IsInt({ message: 'totalTestCases must be an integer' })
  @Min(0, { message: 'totalTestCases must be >= 0' })
  totalTestCases?: number;

  @ApiPropertyOptional({
    example: 86.5,
    minimum: 0,
    maximum: 100,
    description: 'Feature-level coverage percentage',
  })
  @IsOptional()
  @Min(0, { message: 'coveragePercentage must be >= 0' })
  @Max(100, { message: 'coveragePercentage must be <= 100' })
  coveragePercentage?: number;

  @ApiProperty({
    example: '664c2bc84eb14f4d6a4b9d2e',
    description: 'User id of the creator',
  })
  @IsMongoId({ message: 'createdBy must be a valid MongoDB ObjectId' })
  createdBy: string;
}
