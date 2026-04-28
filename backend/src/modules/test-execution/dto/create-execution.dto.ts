import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
} from 'class-validator';
import {
  ExecutionProvider,
  ExecutionStatus,
} from '../test-execution.interface';

export class BrowserStackCapsDto {
  @ApiPropertyOptional({ example: 'Windows', description: 'BrowserStack OS' })
  @IsOptional()
  @IsString()
  os?: string;

  @ApiPropertyOptional({ example: '11', description: 'BrowserStack OS version' })
  @IsOptional()
  @IsString()
  osVersion?: string;

  @ApiPropertyOptional({
    example: 'chrome',
    description: 'BrowserStack browser (chrome | edge | playwright-chromium)',
  })
  @IsOptional()
  @IsString()
  browser?: string;

  @ApiPropertyOptional({ example: 'latest' })
  @IsOptional()
  @IsString()
  browserVersion?: string;
}

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

  /**
   * Optional override for the AUT base URL the runner navigates to before
   * replaying the recorded element interactions. Defaults to the AUT defined
   * in §3.5 (https://www.saucedemo.com/).
   */
  @ApiPropertyOptional({ example: 'https://www.saucedemo.com/' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  baseUrl?: string;

  @ApiPropertyOptional({ type: BrowserStackCapsDto })
  @IsOptional()
  browserStack?: BrowserStackCapsDto;
}
