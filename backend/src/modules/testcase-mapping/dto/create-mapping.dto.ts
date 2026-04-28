import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
} from 'class-validator';
import { ScriptType } from '../testcase-mapping.interface';

export class CreateMappingDto {
  @ApiProperty()
  @IsMongoId({ message: 'featureId must be a valid MongoDB ObjectId' })
  featureId: string;

  @ApiProperty()
  @IsMongoId({ message: 'testSuiteId must be a valid MongoDB ObjectId' })
  testSuiteId: string;

  @ApiProperty()
  @IsMongoId({ message: 'testCaseId must be a valid MongoDB ObjectId' })
  testCaseId: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsMongoId({ each: true, message: 'each elementId must be a valid MongoDB ObjectId' })
  elementIds: string[];

  @ApiPropertyOptional({ enum: ['PLAYWRIGHT', 'CYPRESS', 'SELENIUM'] })
  @IsOptional()
  @IsEnum(['PLAYWRIGHT', 'CYPRESS', 'SELENIUM'])
  scriptType?: ScriptType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  generatedScript?: string;
}
