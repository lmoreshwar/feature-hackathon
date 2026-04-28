import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  IsUrl,
  ValidateIf,
} from 'class-validator';

export type CrawlAuthMethod = 'none' | 'token' | 'credentials';

export class CrawlPageDto {
  @ApiProperty()
  @IsMongoId({ message: 'featureId must be a valid MongoDB ObjectId' })
  featureId: string;

  @ApiProperty({ example: 'https://www.saucedemo.com/inventory.html' })
  @IsUrl({ require_tld: false }, { message: 'pageUrl must be a valid URL' })
  pageUrl: string;

  @ApiPropertyOptional({ example: 'Inventory' })
  @IsOptional()
  @IsString()
  pageName?: string;

  @ApiProperty({ enum: ['none', 'token', 'credentials'] })
  @IsEnum(['none', 'token', 'credentials'])
  authMethod: CrawlAuthMethod;

  @ApiPropertyOptional({ example: 'https://www.saucedemo.com/' })
  @ValidateIf((o: CrawlPageDto) => o.authMethod !== 'none')
  @IsUrl({ require_tld: false }, { message: 'loginUrl must be a valid URL' })
  loginUrl?: string;

  @ApiPropertyOptional({ description: 'Bearer token (or raw token) used when authMethod=token' })
  @ValidateIf((o: CrawlPageDto) => o.authMethod === 'token')
  @IsString()
  authToken?: string;

  @ApiPropertyOptional()
  @ValidateIf((o: CrawlPageDto) => o.authMethod === 'credentials')
  @IsString()
  username?: string;

  @ApiPropertyOptional()
  @ValidateIf((o: CrawlPageDto) => o.authMethod === 'credentials')
  @IsString()
  password?: string;

  @ApiPropertyOptional({
    description:
      'When true (default), the crawler asks the configured LLM to assign semantic camelCase names. Falls back to a heuristic when no integration is configured.',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  aiNaming?: boolean;
}

