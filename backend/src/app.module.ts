import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { FeatureModule } from './modules/feature/feature.module';
import { IntegrationModule } from './modules/integration/integration.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { PageElementModule } from './modules/page-element/page-element.module';
import { RequirementModule } from './modules/requirement/requirement.module';
import { TestCaseModule } from './modules/test-case/test-case.module';
import { TestExecutionModule } from './modules/test-execution/test-execution.module';
import { TestSuiteModule } from './modules/test-suite/test-suite.module';
import { TestcaseMappingModule } from './modules/testcase-mapping/testcase-mapping.module';
import { UserModule } from './modules/user/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const uri =
          config.get<string>('MONGO_URI') ??
          config.get<string>('MONGODB_URI');
        if (!uri) {
          throw new Error(
            'MongoDB connection string is missing. Set MONGO_URI (or MONGODB_URI) in your .env file.',
          );
        }
        return { uri };
      },
    }),
    AuthModule,
    UserModule,
    FeatureModule,
    TestSuiteModule,
    RequirementModule,
    TestCaseModule,
    PageElementModule,
    TestcaseMappingModule,
    TestExecutionModule,
    IntegrationModule,
    MetricsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
