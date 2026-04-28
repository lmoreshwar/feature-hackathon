import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  TEST_SUITE_MODEL_NAME,
  TestSuiteSchema,
} from '../../common/schemas';
import { AuthModule } from '../auth/auth.module';
import { FeatureModule } from '../feature/feature.module';
import { TestSuiteController } from './test-suite.controller';
import { TestSuiteRepository } from './test-suite.repository';
import { TestSuiteService } from './test-suite.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TEST_SUITE_MODEL_NAME, schema: TestSuiteSchema },
    ]),
    AuthModule,
    FeatureModule,
  ],
  controllers: [TestSuiteController],
  providers: [TestSuiteService, TestSuiteRepository],
  exports: [TestSuiteService, TestSuiteRepository],
})
export class TestSuiteModule {}
