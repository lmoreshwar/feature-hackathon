import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class BrowserStackSettingsDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  username: string;

  @ApiProperty({ description: 'Plain access key (will be encrypted server side)' })
  @IsString()
  @MinLength(4)
  accessKey: string;
}
