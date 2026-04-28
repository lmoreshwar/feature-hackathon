import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  INTEGRATION_MODEL_NAME,
  IntegrationSchema,
} from '../../common/schemas';
import { AuthModule } from '../auth/auth.module';
import { IntegrationController } from './integration.controller';
import { IntegrationRepository } from './integration.repository';
import { IntegrationService } from './integration.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: INTEGRATION_MODEL_NAME, schema: IntegrationSchema },
    ]),
    AuthModule,
  ],
  controllers: [IntegrationController],
  providers: [IntegrationService, IntegrationRepository],
  exports: [IntegrationService, IntegrationRepository],
})
export class IntegrationModule {}
