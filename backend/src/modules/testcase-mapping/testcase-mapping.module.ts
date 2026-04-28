import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  TESTCASE_MAPPING_MODEL_NAME,
  TestCaseMappingSchema,
} from '../../common/schemas';
import { AuthModule } from '../auth/auth.module';
import { LlmModule } from '../llm/llm.module';
import { PageElementModule } from '../page-element/page-element.module';
import { TestCaseModule } from '../test-case/test-case.module';
import { MappingController } from './testcase-mapping.controller';
import { MappingRepository } from './testcase-mapping.repository';
import { MappingService } from './testcase-mapping.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TESTCASE_MAPPING_MODEL_NAME, schema: TestCaseMappingSchema },
    ]),
    AuthModule,
    TestCaseModule,
    PageElementModule,
    LlmModule,
  ],
  controllers: [MappingController],
  providers: [MappingService, MappingRepository],
  exports: [MappingService, MappingRepository],
})
export class TestcaseMappingModule {}
