import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import {
  ExecutionProvider,
  ExecutionStatus,
} from '../test-execution.interface';

export class CreateExecutionDto {
  @ApiProperty()
  @IsMongoId({ message: 'featureId must be a valid MongoDB ObjectId' })
  featureId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId({ message: 'testSuiteId must be a valid MongoDB ObjectId' })
  testSuiteId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  testCaseIds?: string[];

  @ApiProperty({ example: 'Build #42 – Smoke' })
  @IsString()
  @MinLength(2)
  buildName: string;

  @ApiPropertyOptional({ enum: ['BROWSERSTACK', 'LOCAL'] })
  @IsOptional()
  @IsEnum(['BROWSERSTACK', 'LOCAL'])
  provider?: ExecutionProvider;

  @ApiPropertyOptional({
    enum: ['QUEUED', 'RUNNING', 'PASSED', 'FAILED', 'CANCELLED'],
  })
  @IsOptional()
  @IsEnum(['QUEUED', 'RUNNING', 'PASSED', 'FAILED', 'CANCELLED'])
  status?: ExecutionStatus;
}
