import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateFeatureDto {
  @ApiProperty({
    example: 'Login Workflow',
    description: 'Unique name for the feature',
  })
  @IsString({ message: 'name must be a string' })
  @MinLength(2, { message: 'name must be at least 2 characters long' })
  name: string;

  @ApiPropertyOptional({
    example: 'Validates end-to-end login scenarios',
    description: 'Optional description for the feature',
  })
  @IsOptional()
  @IsString({ message: 'description must be a string' })
  description?: string;
}
