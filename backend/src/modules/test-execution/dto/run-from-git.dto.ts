import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsMongoId,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
} from 'class-validator';

export class RunFromGitDto {
  @ApiProperty({ description: 'Feature this execution belongs to.' })
  @IsMongoId({ message: 'featureId must be a valid MongoDB ObjectId' })
  featureId: string;

  @ApiProperty({ example: 'main', description: 'Git branch to clone & run.' })
  @IsString()
  @MinLength(1)
  branch: string;

  @ApiProperty({ example: 'Build #42 – BrowserStack' })
  @IsString()
  @MinLength(2)
  buildName: string;

  @ApiPropertyOptional({
    description:
      'Override the saved git integration repo URL for this run only. ' +
      'Useful when the script lives in a different repo than the AUT.',
  })
  @IsOptional()
  @IsUrl({ require_tld: false }, { message: 'repoUrl must be a valid URL' })
  repoUrl?: string;

  @ApiPropertyOptional({
    example: 'tests/login.spec.ts',
    description:
      'Optional path/glob passed straight to `npx playwright test`. ' +
      'Leave empty to run the full suite.',
  })
  @IsOptional()
  @IsString()
  testPath?: string;
}
