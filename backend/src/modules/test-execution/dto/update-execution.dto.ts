import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Min,
} from 'class-validator';
import { ExecutionStatus } from '../test-execution.interface';

export class UpdateExecutionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  buildName?: string;

  @ApiPropertyOptional({
    enum: ['QUEUED', 'RUNNING', 'PASSED', 'FAILED', 'CANCELLED'],
  })
  @IsOptional()
  @IsEnum(['QUEUED', 'RUNNING', 'PASSED', 'FAILED', 'CANCELLED'])
  status?: ExecutionStatus;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  totalTests?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  passedTests?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  failedTests?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  skippedTests?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false })
  reportUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false })
  videoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false })
  logsUrl?: string;
}
