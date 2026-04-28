import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  FEATURE_MODEL_NAME,
  FeatureSchema,
  PAGE_ELEMENT_MODEL_NAME,
  PageElementSchema,
  REQUIREMENT_MODEL_NAME,
  RequirementSchema,
  TEST_CASE_MODEL_NAME,
  TEST_EXECUTION_MODEL_NAME,
  TEST_SUITE_MODEL_NAME,
  TESTCASE_MAPPING_MODEL_NAME,
  TestCaseMappingSchema,
  TestCaseSchema,
  TestExecutionSchema,
  TestSuiteSchema,
} from '../../common/schemas';
import { AuthModule } from '../auth/auth.module';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FEATURE_MODEL_NAME, schema: FeatureSchema },
      { name: TEST_SUITE_MODEL_NAME, schema: TestSuiteSchema },
      { name: TEST_CASE_MODEL_NAME, schema: TestCaseSchema },
      { name: TESTCASE_MAPPING_MODEL_NAME, schema: TestCaseMappingSchema },
      { name: TEST_EXECUTION_MODEL_NAME, schema: TestExecutionSchema },
      { name: REQUIREMENT_MODEL_NAME, schema: RequirementSchema },
      { name: PAGE_ELEMENT_MODEL_NAME, schema: PageElementSchema },
    ]),
    AuthModule,
  ],
  controllers: [MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
