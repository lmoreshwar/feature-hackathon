import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh.token',
    description: 'Valid refresh token issued by the login endpoint',
  })
  @IsString()
  @MinLength(1)
  refreshToken: string;
}