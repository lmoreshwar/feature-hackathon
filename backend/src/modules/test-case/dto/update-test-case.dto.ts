import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ReferenceInfoDto } from '../../../common/dto/reference-info.dto';
import {
  TestCasePriority,
  TestCaseStatus,
  TestCaseType,
} from '../test-case.interface';

export class UpdateTestCaseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preconditions?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  steps?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  expectedResult?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  testData?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comments?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  automationFeasible?: boolean;

  @ApiPropertyOptional({ enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] })
  @IsOptional()
  @IsEnum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  priority?: TestCasePriority;

  @ApiPropertyOptional({ enum: ['FUNCTIONAL', 'REGRESSION', 'SMOKE', 'E2E'] })
  @IsOptional()
  @IsEnum(['FUNCTIONAL', 'REGRESSION', 'SMOKE', 'E2E'])
  type?: TestCaseType;

  @ApiPropertyOptional({
    enum: ['GENERATED', 'APPROVED', 'REJECTED', 'NEEDS_REVIEW'],
  })
  @IsOptional()
  @IsEnum(['GENERATED', 'APPROVED', 'REJECTED', 'NEEDS_REVIEW'])
  status?: TestCaseStatus;

  @ApiPropertyOptional({ type: () => ReferenceInfoDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ReferenceInfoDto)
  referenceInfo?: ReferenceInfoDto;
}
