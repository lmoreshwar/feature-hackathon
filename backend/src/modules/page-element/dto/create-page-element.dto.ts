import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
} from 'class-validator';
import {
  PageElementType,
  PageSelectorType,
} from '../page-element.interface';

export class CreatePageElementDto {
  @ApiProperty()
  @IsMongoId({ message: 'featureId must be a valid MongoDB ObjectId' })
  featureId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId({ message: 'testSuiteId must be a valid MongoDB ObjectId' })
  testSuiteId?: string;

  @ApiProperty({ example: 'https://www.saucedemo.com/' })
  @IsUrl({ require_tld: false }, { message: 'pageUrl must be a valid URL' })
  pageUrl: string;

  @ApiPropertyOptional({ example: 'Login Page' })
  @IsOptional()
  @IsString()
  pageName?: string;

  @ApiProperty({ example: 'username_input' })
  @IsString()
  @MinLength(1)
  elementName: string;

  @ApiProperty({
    enum: ['BUTTON', 'INPUT', 'LINK', 'DROPDOWN', 'CHECKBOX', 'TEXT', 'OTHER'],
  })
  @IsEnum(['BUTTON', 'INPUT', 'LINK', 'DROPDOWN', 'CHECKBOX', 'TEXT', 'OTHER'])
  elementType: PageElementType;

  @ApiProperty({ example: '#user-name' })
  @IsString()
  @MinLength(1)
  selector: string;

  @ApiProperty({ enum: ['ID', 'CSS', 'XPATH', 'TEXT'] })
  @IsEnum(['ID', 'CSS', 'XPATH', 'TEXT'])
  selectorType: PageSelectorType;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isStable?: boolean;
}
