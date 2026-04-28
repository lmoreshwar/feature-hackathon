import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TEST_CASE_MODEL_NAME, TestCaseSchema } from '../../common/schemas';
import { AuthModule } from '../auth/auth.module';
import { FeatureModule } from '../feature/feature.module';
import { TestSuiteModule } from '../test-suite/test-suite.module';
import { TestCaseController } from './test-case.controller';
import { TestCaseRepository } from './test-case.repository';
import { TestCaseService } from './test-case.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TEST_CASE_MODEL_NAME, schema: TestCaseSchema },
    ]),
    AuthModule,
    FeatureModule,
    TestSuiteModule,
  ],
  controllers: [TestCaseController],
  providers: [TestCaseService, TestCaseRepository],
  exports: [TestCaseService, TestCaseRepository],
})
export class TestCaseModule {}
