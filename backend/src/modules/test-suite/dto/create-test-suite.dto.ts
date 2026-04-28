import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsMongoId,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ReferenceInfoDto } from '../../../common/dto/reference-info.dto';
import { TestSuiteStatus } from '../test-suite.interface';

export class CreateTestSuiteDto {
  @ApiProperty({ example: '664c2bc84eb14f4d6a4b9d2e' })
  @IsMongoId({ message: 'featureId must be a valid MongoDB ObjectId' })
  featureId: string;

  @ApiProperty({ example: 'Authentication Suite' })
  @IsString({ message: 'moduleName must be a string' })
  @MinLength(2, { message: 'moduleName must be at least 2 characters long' })
  moduleName: string;

  @ApiPropertyOptional({ example: 'Login + logout coverage' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '1.0.0', default: '1.0.0' })
  @IsOptional()
  @IsString()
  version?: string;

  @ApiPropertyOptional({ enum: ['DRAFT', 'ACTIVE', 'ARCHIVED'] })
  @IsOptional()
  @IsEnum(['DRAFT', 'ACTIVE', 'ARCHIVED'])
  status?: TestSuiteStatus;

  @ApiPropertyOptional({ type: () => ReferenceInfoDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ReferenceInfoDto)
  referenceInfo?: ReferenceInfoDto;
}
