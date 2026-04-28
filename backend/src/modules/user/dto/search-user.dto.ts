import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class SearchUserDto {
  @ApiPropertyOptional({
    example: 1,
    minimum: 1,
    default: 1,
    description: 'Page index, starting from 1',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pageIndex must be an integer' })
  @Min(1, { message: 'pageIndex must be >= 1' })
  pageIndex?: number = 1;

  @ApiPropertyOptional({
    example: 10,
    minimum: 1,
    maximum: 100,
    default: 10,
    description: 'Number of users returned per page',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pageSize must be an integer' })
  @Min(1, { message: 'pageSize must be >= 1' })
  @Max(100, { message: 'pageSize must be <= 100' })
  pageSize?: number = 10;

  @ApiPropertyOptional({
    example: 'user@example.com',
    description: 'Optional email search filter',
  })
  @IsOptional()
  @IsString({ message: 'search must be a string' })
  search?: string;
}