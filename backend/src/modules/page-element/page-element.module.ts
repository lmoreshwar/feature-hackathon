import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  PAGE_ELEMENT_MODEL_NAME,
  PageElementSchema,
} from '../../common/schemas';
import { AuthModule } from '../auth/auth.module';
import { LlmModule } from '../llm/llm.module';
import { CaptureService } from './capture.service';
import { CrawlerService } from './crawler.service';
import { PageElementController } from './page-element.controller';
import { PageElementRepository } from './page-element.repository';
import { PageElementService } from './page-element.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PAGE_ELEMENT_MODEL_NAME, schema: PageElementSchema },
    ]),
    AuthModule,
    LlmModule,
  ],
  controllers: [PageElementController],
  providers: [
    PageElementService,
    PageElementRepository,
    CrawlerService,
    CaptureService,
  ],
  exports: [PageElementService, PageElementRepository],
})
export class PageElementModule {}
