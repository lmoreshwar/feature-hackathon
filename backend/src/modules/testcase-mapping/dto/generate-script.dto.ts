import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ScriptType } from '../testcase-mapping.interface';

export class GenerateScriptDto {
  @ApiPropertyOptional({ enum: ['PLAYWRIGHT', 'CYPRESS', 'SELENIUM'] })
  @IsOptional()
  @IsEnum(['PLAYWRIGHT', 'CYPRESS', 'SELENIUM'])
  scriptType?: ScriptType;
}
