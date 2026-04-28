import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl } from 'class-validator';

export class ReferenceInfoDto {
  @ApiPropertyOptional({ example: 'PROJ-123' })
  @IsOptional()
  @IsString()
  jiraId?: string;

  @ApiPropertyOptional({ example: 'TL-456' })
  @IsOptional()
  @IsString()
  testLinkId?: string;

  @ApiPropertyOptional({ example: 'https://wiki.example.com/page' })
  @IsOptional()
  @IsUrl({}, { message: 'confluenceUrl must be a valid URL' })
  confluenceUrl?: string;

  @ApiPropertyOptional({ example: 'User wants to log in with email/password' })
  @IsOptional()
  @IsString()
  requirementText?: string;
}
