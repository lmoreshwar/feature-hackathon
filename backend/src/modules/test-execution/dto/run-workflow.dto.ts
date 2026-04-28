import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsOptional, IsString, MinLength } from 'class-validator';

export class RunWorkflowDto {
  @ApiProperty({ description: 'Feature this execution belongs to.' })
  @IsMongoId({ message: 'featureId must be a valid MongoDB ObjectId' })
  featureId: string;

  @ApiProperty({
    example: 'AruljothySundaramoorthy/hackathon',
    description:
      'GitHub repo to dispatch on, in `owner/name` form. Defaults to the ' +
      'repo saved under Settings → Integrations → Git when omitted.',
    required: false,
  })
  @IsOptional()
  @IsString()
  repo?: string;

  @ApiProperty({
    example: 'playwright.yml',
    description:
      'Workflow file name (under `.github/workflows/`) or full path. ' +
      'Both `playwright.yml` and `.github/workflows/playwright.yml` work.',
  })
  @IsString()
  @MinLength(1)
  workflowFile: string;

  @ApiProperty({ example: 'main', description: 'Branch the workflow runs on.' })
  @IsString()
  @MinLength(1)
  branch: string;

  @ApiProperty({ example: 'Build #42 – BrowserStack' })
  @IsString()
  @MinLength(2)
  buildName: string;
}
