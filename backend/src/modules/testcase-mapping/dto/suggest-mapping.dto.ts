import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';

export class SuggestMappingDto {
  @ApiProperty()
  @IsMongoId({ message: 'testCaseId must be a valid MongoDB ObjectId' })
  testCaseId: string;
}
