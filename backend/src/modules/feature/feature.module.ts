import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FEATURE_MODEL_NAME, FeatureSchema } from '../../common/schemas/feature.schema';
import { FeatureController } from './feature.controller';
import { FeatureRepository } from './feature.repository';
import { FeatureService } from './feature.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: FEATURE_MODEL_NAME, schema: FeatureSchema }]),
  ],
  controllers: [FeatureController],
  providers: [FeatureService, FeatureRepository],
  exports: [FeatureService, FeatureRepository],
})
export class FeatureModule {}
