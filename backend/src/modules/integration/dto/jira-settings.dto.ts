import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsUrl, MinLength } from 'class-validator';

export class JiraSettingsDto {
  @ApiProperty({ example: 'https://your-company.atlassian.net' })
  @IsUrl({ require_tld: false })
  baseUrl: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Plain api token (will be encrypted server side)' })
  @IsString()
  @MinLength(4)
  apiToken: string;
}
