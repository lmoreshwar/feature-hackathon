import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { USER_MODEL_NAME, UserSchema } from '../../common/schemas';
import { UserController } from './user.controller';
import { UserRepository } from './user.repository';
import { UserService } from './user.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: USER_MODEL_NAME, schema: UserSchema }]),
  ],
  controllers: [UserController],
  providers: [UserService, UserRepository],
  exports: [UserService, UserRepository],
})
export class UserModule {}
