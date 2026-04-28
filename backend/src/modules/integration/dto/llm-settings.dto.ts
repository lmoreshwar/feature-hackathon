import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, MinLength } from 'class-validator';

export class LlmSettingsDto {
  @ApiProperty({ enum: ['OPENAI', 'AZURE_OPENAI', 'ANTHROPIC'] })
  @IsEnum(['OPENAI', 'AZURE_OPENAI', 'ANTHROPIC'])
  provider: 'OPENAI' | 'AZURE_OPENAI' | 'ANTHROPIC';

  @ApiProperty({ description: 'Plain api key (will be encrypted server side)' })
  @IsString()
  @MinLength(4)
  apiKey: string;

  @ApiProperty({ example: 'gpt-4o-mini' })
  @IsString()
  @MinLength(2)
  model: string;
}
