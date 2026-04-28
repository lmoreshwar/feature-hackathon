import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  REQUIREMENT_MODEL_NAME,
  RequirementSchema,
} from '../../common/schemas';
import { AuthModule } from '../auth/auth.module';
import { FeatureModule } from '../feature/feature.module';
import { IntegrationModule } from '../integration/integration.module';
import { TestCaseModule } from '../test-case/test-case.module';
import { TestSuiteModule } from '../test-suite/test-suite.module';
import { RequirementController } from './requirement.controller';
import { RequirementRepository } from './requirement.repository';
import { RequirementService } from './requirement.service';
import { TestCaseGeneratorService } from './test-case-generator.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: REQUIREMENT_MODEL_NAME, schema: RequirementSchema },
    ]),
    AuthModule,
    FeatureModule,
    TestSuiteModule,
    TestCaseModule,
    IntegrationModule,
  ],
  controllers: [RequirementController],
  providers: [RequirementService, RequirementRepository, TestCaseGeneratorService],
  exports: [RequirementService, RequirementRepository],
})
export class RequirementModule {}
