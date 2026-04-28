import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  TEST_EXECUTION_MODEL_NAME,
  TestExecutionSchema,
} from '../../common/schemas';
import { AuthModule } from '../auth/auth.module';
import { IntegrationModule } from '../integration/integration.module';
import { PageElementModule } from '../page-element/page-element.module';
import { TestCaseModule } from '../test-case/test-case.module';
import { TestcaseMappingModule } from '../testcase-mapping/testcase-mapping.module';
import { BrowserStackRunnerService } from './browserstack-runner.service';
import { GitRunnerService } from './git-runner.service';
import { ExecutionController } from './test-execution.controller';
import { ExecutionRepository } from './test-execution.repository';
import { ExecutionService } from './test-execution.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TEST_EXECUTION_MODEL_NAME, schema: TestExecutionSchema },
    ]),
    AuthModule,
    IntegrationModule,
    TestCaseModule,
    TestcaseMappingModule,
    PageElementModule,
  ],
  controllers: [ExecutionController],
  providers: [
    ExecutionService,
    ExecutionRepository,
    BrowserStackRunnerService,
    GitRunnerService,
  ],
  exports: [ExecutionService, ExecutionRepository],
})
export class TestExecutionModule {}
