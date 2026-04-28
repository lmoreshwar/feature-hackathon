import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from './current-user.decorator';
import { AccessTokenGuard } from './access-token.guard';
import { AuthenticatedUser } from './auth.interface';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthService } from './auth.service';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto): Promise<ApiResponse<unknown>> {
    const result = await this.authService.login(dto);
    return {
      success: true,
      message: 'Login successful',
      data: result,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto): Promise<ApiResponse<unknown>> {
    const result = await this.authService.refreshTokens(dto);
    return {
      success: true,
      message: 'Tokens refreshed successfully',
      data: result,
    };
  }

  @Post('logout')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const result = await this.authService.logout(user.sub);
    return {
      success: true,
      message: 'Logout successful',
      data: result,
    };
  }

  @Get('me')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  async me(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<unknown>> {
    const profile = await this.authService.getProfile(user.sub);
    return {
      success: true,
      message: 'Authenticated user fetched successfully',
      data: profile,
    };
  }
}