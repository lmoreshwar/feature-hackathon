import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export type SortDirection = 'asc' | 'desc';

export class SearchDto {
  @ApiPropertyOptional({ example: 1, minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pageIndex must be an integer' })
  @Min(1, { message: 'pageIndex must be >= 1' })
  pageIndex?: number = 1;

  @ApiPropertyOptional({ example: 10, minimum: 1, maximum: 100, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pageSize must be an integer' })
  @Min(1, { message: 'pageSize must be >= 1' })
  @Max(100, { message: 'pageSize must be <= 100' })
  pageSize?: number = 10;

  @ApiPropertyOptional({ example: '', description: 'Free text search term' })
  @IsOptional()
  @IsString({ message: 'search must be a string' })
  search?: string;

  @ApiPropertyOptional({
    example: { status: 'ACTIVE' },
    description: 'Equality filters keyed by field name',
  })
  @IsOptional()
  @IsObject({ message: 'filters must be an object' })
  filters?: Record<string, unknown>;

  @ApiPropertyOptional({
    example: { createdAt: 'desc' },
    description: 'Sort map (1 = asc, -1 = desc)',
  })
  @IsOptional()
  @IsObject({ message: 'sort must be an object' })
  sort?: Record<string, SortDirection>;
}
