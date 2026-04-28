import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  PAGE_ELEMENT_MODEL_NAME,
  PageElementSchema,
} from '../../common/schemas';
import { AuthModule } from '../auth/auth.module';
import { PageElementController } from './page-element.controller';
import { PageElementRepository } from './page-element.repository';
import { PageElementService } from './page-element.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PAGE_ELEMENT_MODEL_NAME, schema: PageElementSchema },
    ]),
    AuthModule,
  ],
  controllers: [PageElementController],
  providers: [PageElementService, PageElementRepository],
  exports: [PageElementService, PageElementRepository],
})
export class PageElementModule {}
