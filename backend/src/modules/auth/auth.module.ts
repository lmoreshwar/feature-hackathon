import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UserModule } from '../user/user.module';
import { AccessTokenGuard } from './access-token.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAccessStrategy } from './jwt-access.strategy';

@Module({
  imports: [ConfigModule, JwtModule.register({}), PassportModule, UserModule],
  controllers: [AuthController],
  providers: [AuthService, JwtAccessStrategy, AccessTokenGuard],
  exports: [AuthService],
})
export class AuthModule {}