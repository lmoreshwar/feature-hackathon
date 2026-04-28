import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsMongoId,
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

export class CreateTestCaseDto {
  @ApiProperty()
  @IsMongoId({ message: 'featureId must be a valid MongoDB ObjectId' })
  featureId: string;

  @ApiProperty()
  @IsMongoId({ message: 'testSuiteId must be a valid MongoDB ObjectId' })
  testSuiteId: string;

  @ApiProperty({ example: 'Login with valid credentials' })
  @IsString()
  @MinLength(3)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preconditions?: string[];

  @ApiProperty({ type: [String], example: ['Open URL', 'Enter credentials'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  steps: string[];

  @ApiProperty({ example: 'User is navigated to dashboard' })
  @IsString()
  @MinLength(3)
  expectedResult: string;

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
