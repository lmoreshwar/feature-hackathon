import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsUrl, MinLength } from 'class-validator';

export class GitSettingsDto {
  @ApiProperty({ enum: ['GITHUB', 'GITLAB', 'BITBUCKET'] })
  @IsEnum(['GITHUB', 'GITLAB', 'BITBUCKET'])
  provider: 'GITHUB' | 'GITLAB' | 'BITBUCKET';

  @ApiProperty({ example: 'https://github.com/your-org/your-repo' })
  @IsUrl({ require_tld: false })
  repoUrl: string;

  @ApiProperty({ description: 'Plain personal access token (will be encrypted server side)' })
  @IsString()
  @MinLength(4)
  token: string;

  @ApiProperty({ example: 'main' })
  @IsString()
  @MinLength(1)
  branch: string;
}
