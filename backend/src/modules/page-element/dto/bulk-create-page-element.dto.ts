import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { CreatePageElementDto } from './create-page-element.dto';

export class BulkCreatePageElementDto {
  @ApiProperty({ type: [CreatePageElementDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePageElementDto)
  elements: CreatePageElementDto[];
}
