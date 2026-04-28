import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';
import {
  PageElementType,
  PageSelectorType,
} from '../page-element.interface';

export class UpdatePageElementDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false })
  pageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pageName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  elementName?: string;

  @ApiPropertyOptional({
    enum: ['BUTTON', 'INPUT', 'LINK', 'DROPDOWN', 'CHECKBOX', 'TEXT', 'OTHER'],
  })
  @IsOptional()
  @IsEnum(['BUTTON', 'INPUT', 'LINK', 'DROPDOWN', 'CHECKBOX', 'TEXT', 'OTHER'])
  elementType?: PageElementType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  selector?: string;

  @ApiPropertyOptional({ enum: ['ID', 'CSS', 'XPATH', 'TEXT'] })
  @IsOptional()
  @IsEnum(['ID', 'CSS', 'XPATH', 'TEXT'])
  selectorType?: PageSelectorType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isStable?: boolean;
}
