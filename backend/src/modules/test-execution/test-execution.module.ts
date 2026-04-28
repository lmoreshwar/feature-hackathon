import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  TEST_EXECUTION_MODEL_NAME,
  TestExecutionSchema,
} from '../../common/schemas';
import { AuthModule } from '../auth/auth.module';
import { ExecutionController } from './test-execution.controller';
import { ExecutionRepository } from './test-execution.repository';
import { ExecutionService } from './test-execution.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TEST_EXECUTION_MODEL_NAME, schema: TestExecutionSchema },
    ]),
    AuthModule,
  ],
  controllers: [ExecutionController],
  providers: [ExecutionService, ExecutionRepository],
  exports: [ExecutionService, ExecutionRepository],
})
export class TestExecutionModule {}
