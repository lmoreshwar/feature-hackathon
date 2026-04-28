import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  IsUrl,
  ValidateIf,
} from 'class-validator';

export type CaptureAuthMethod = 'none' | 'token' | 'credentials';

export class StartCaptureDto {
  @ApiProperty()
  @IsMongoId({ message: 'featureId must be a valid MongoDB ObjectId' })
  featureId: string;

  @ApiProperty({ example: 'https://www.saucedemo.com/inventory.html' })
  @IsUrl({ require_tld: false }, { message: 'pageUrl must be a valid URL' })
  pageUrl: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pageName?: string;

  @ApiProperty({ enum: ['none', 'token', 'credentials'] })
  @IsEnum(['none', 'token', 'credentials'])
  authMethod: CaptureAuthMethod;

  @ApiPropertyOptional()
  @ValidateIf((o: StartCaptureDto) => o.authMethod !== 'none')
  @IsUrl({ require_tld: false }, { message: 'loginUrl must be a valid URL' })
  loginUrl?: string;

  @ApiPropertyOptional()
  @ValidateIf((o: StartCaptureDto) => o.authMethod === 'token')
  @IsString()
  authToken?: string;

  @ApiPropertyOptional()
  @ValidateIf((o: StartCaptureDto) => o.authMethod === 'credentials')
  @IsString()
  username?: string;

  @ApiPropertyOptional()
  @ValidateIf((o: StartCaptureDto) => o.authMethod === 'credentials')
  @IsString()
  password?: string;
}
