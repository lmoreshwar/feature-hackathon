import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  REQUIREMENT_MODEL_NAME,
  RequirementSchema,
} from '../../common/schemas';
import { AuthModule } from '../auth/auth.module';
import { FeatureModule } from '../feature/feature.module';
import { RequirementController } from './requirement.controller';
import { RequirementRepository } from './requirement.repository';
import { RequirementService } from './requirement.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: REQUIREMENT_MODEL_NAME, schema: RequirementSchema },
    ]),
    AuthModule,
    FeatureModule,
  ],
  controllers: [RequirementController],
  providers: [RequirementService, RequirementRepository],
  exports: [RequirementService, RequirementRepository],
})
export class RequirementModule {}
