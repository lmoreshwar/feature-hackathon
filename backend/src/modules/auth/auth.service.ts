import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserDocument } from '../../common/schemas';
import {
  ACCESS_TOKEN_EXPIRES_IN,
  ACCESS_TOKEN_SECRET_FALLBACK,
  REFRESH_TOKEN_EXPIRES_IN,
  REFRESH_TOKEN_SECRET_FALLBACK,
} from './auth.constants';
import {
  AuthResponse,
  AuthenticatedUser,
  JwtPayload,
  TokenPair,
} from './auth.interface';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UserRepository } from '../user/user.repository';

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.validateCredentials(dto.email, dto.password);
    return this.buildAuthResponse(user);
  }

  async refreshTokens(dto: RefreshTokenDto): Promise<AuthResponse> {
    let payload: JwtPayload;

    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(dto.refreshToken, {
        secret: this.getRefreshTokenSecret(),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.userRepository.findByIdWithPassword(payload.sub);
    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Refresh token is not active');
    }

    const tokenMatches = await bcrypt.compare(
      dto.refreshToken,
      user.refreshTokenHash,
    );

    if (!tokenMatches) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.buildAuthResponse(user);
  }

  async logout(userId: string): Promise<{ loggedOut: true }> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with id "${userId}" not found`);
    }

    await this.userRepository.update(userId, { refreshTokenHash: null });
    return { loggedOut: true };
  }

  async getProfile(userId: string) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with id "${userId}" not found`);
    }

    return {
      _id: user._id.toString(),
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private async validateCredentials(
    email: string,
    password: string,
  ): Promise<UserDocument> {
    const user = await this.userRepository.findByEmailWithPassword(email);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return user;
  }

  private async buildAuthResponse(user: UserDocument): Promise<AuthResponse> {
    const safeUser = {
      _id: user._id.toString(),
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    const tokens = await this.issueTokens(safeUser._id, safeUser.email);
    const refreshTokenHash = await bcrypt.hash(tokens.refreshToken, 10);

    await this.userRepository.update(safeUser._id, { refreshTokenHash });

    return {
      user: safeUser,
      tokens,
    };
  }

  private async issueTokens(userId: string, email: string): Promise<TokenPair> {
    const accessPayload: JwtPayload = {
      sub: userId,
      email,
      type: 'access',
    };

    const refreshPayload: JwtPayload = {
      sub: userId,
      email,
      type: 'refresh',
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        expiresIn: ACCESS_TOKEN_EXPIRES_IN,
        secret: this.getAccessTokenSecret(),
      }),
      this.jwtService.signAsync(refreshPayload, {
        expiresIn: REFRESH_TOKEN_EXPIRES_IN,
        secret: this.getRefreshTokenSecret(),
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresIn: ACCESS_TOKEN_EXPIRES_IN,
      refreshTokenExpiresIn: REFRESH_TOKEN_EXPIRES_IN,
    };
  }

  private getAccessTokenSecret(): string {
    return (
      this.configService.get<string>('JWT_ACCESS_SECRET') ??
      ACCESS_TOKEN_SECRET_FALLBACK
    );
  }

  private getRefreshTokenSecret(): string {
    return (
      this.configService.get<string>('JWT_REFRESH_SECRET') ??
      REFRESH_TOKEN_SECRET_FALLBACK
    );
  }
}