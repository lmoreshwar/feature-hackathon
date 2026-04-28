import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class PushToGitDto {
  @ApiPropertyOptional({ example: 'tests/login.spec.ts' })
  @IsOptional()
  @IsString()
  path?: string;

  @ApiPropertyOptional({ example: 'feat: add generated playwright script' })
  @IsOptional()
  @IsString()
  message?: string;
}
