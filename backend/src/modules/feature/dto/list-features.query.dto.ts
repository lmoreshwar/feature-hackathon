import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsMongoId, IsOptional, IsString, Max, Min } from 'class-validator';
import { FeatureStatus } from '../feature.interface';

export class ListFeaturesQueryDto {
  @ApiPropertyOptional({
    example: 1,
    minimum: 1,
    description: 'Page number for pagination',
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page must be an integer' })
  @Min(1, { message: 'page must be >= 1' })
  page?: number = 1;

  @ApiPropertyOptional({
    example: 10,
    minimum: 1,
    maximum: 100,
    description: 'Number of features returned per page',
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit must be an integer' })
  @Min(1, { message: 'limit must be >= 1' })
  @Max(100, { message: 'limit must be <= 100' })
  limit?: number = 10;

  @ApiPropertyOptional({
    example: 'login',
    description: 'Case-insensitive search by feature name',
  })
  @IsOptional()
  @IsString({ message: 'search must be a string' })
  search?: string;

  @ApiPropertyOptional({
    enum: ['DRAFT', 'ACTIVE', 'ARCHIVED'],
    description: 'Filter by feature status',
  })
  @IsOptional()
  @IsEnum(['DRAFT', 'ACTIVE', 'ARCHIVED'], {
    message: 'status must be one of DRAFT, ACTIVE, ARCHIVED',
  })
  status?: FeatureStatus;

  @ApiPropertyOptional({
    example: '664c2bc84eb14f4d6a4b9d2e',
    description: 'Filter by owner user id',
  })
  @IsOptional()
  @IsMongoId({ message: 'createdBy must be a valid MongoDB ObjectId' })
  createdBy?: string;
}
