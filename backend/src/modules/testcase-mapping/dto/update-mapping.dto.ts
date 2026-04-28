import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
} from 'class-validator';
import {
  GitPushStatus,
  ScriptType,
} from '../testcase-mapping.interface';

export class UpdateMappingDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsMongoId({ each: true })
  elementIds?: string[];

  @ApiPropertyOptional({ enum: ['PLAYWRIGHT', 'CYPRESS', 'SELENIUM'] })
  @IsOptional()
  @IsEnum(['PLAYWRIGHT', 'CYPRESS', 'SELENIUM'])
  scriptType?: ScriptType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  generatedScript?: string;

  @ApiPropertyOptional({ enum: ['NOT_PUSHED', 'PUSHED', 'FAILED'] })
  @IsOptional()
  @IsEnum(['NOT_PUSHED', 'PUSHED', 'FAILED'])
  gitPushStatus?: GitPushStatus;
}
