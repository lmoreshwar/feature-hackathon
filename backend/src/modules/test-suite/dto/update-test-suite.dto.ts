import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ReferenceInfoDto } from '../../../common/dto/reference-info.dto';
import { TestSuiteStatus } from '../test-suite.interface';

export class UpdateTestSuiteDto {
  @ApiPropertyOptional({ example: 'Authentication Suite v2' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  moduleName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '1.1.0' })
  @IsOptional()
  @IsString()
  version?: string;

  @ApiPropertyOptional({ enum: ['DRAFT', 'ACTIVE', 'ARCHIVED'] })
  @IsOptional()
  @IsEnum(['DRAFT', 'ACTIVE', 'ARCHIVED'])
  status?: TestSuiteStatus;

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

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @Min(0)
  @Max(100)
  passPercentage?: number;

  @ApiPropertyOptional({ type: () => ReferenceInfoDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ReferenceInfoDto)
  referenceInfo?: ReferenceInfoDto;
}
