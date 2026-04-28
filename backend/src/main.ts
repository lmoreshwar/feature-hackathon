import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Connection } from 'mongoose';
import { createServer } from 'node:net';
import { AppModule } from './app.module';

async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = createServer()
      .once('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') {
          resolve(false);
          return;
        }

        resolve(false);
      })
      .once('listening', () => {
        tester.close(() => resolve(true));
      })
      .listen(port, '0.0.0.0');
  });
}

async function shutdownApplication(
  app: INestApplication,
  logger: Logger,
  connection: Connection,
  state: { isShuttingDown: boolean },
): Promise<void> {
  if (state.isShuttingDown) {
    return;
  }

  state.isShuttingDown = true;
  logger.log('Shutting down application...');

  try {
    if (connection.readyState !== 0) {
      await connection.close();
    }
  } catch (error) {
    logger.error(
      `Failed to close MongoDB connection: ${(error as Error).message}`,
    );
  }

  try {
    await app.close();
  } catch (error) {
    logger.error(`Failed to close application: ${(error as Error).message}`);
  }
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  const connection = app.get<Connection>(getConnectionToken());
  const shutdownState = { isShuttingDown: false };

  app.enableShutdownHooks();

  const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:4200')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.setGlobalPrefix('api');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Hackathon API')
    .setDescription('API documentation for the Hackathon backend')
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('app')
    .addTag('auth')
    .addTag('features')
    .addTag('users')
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument);

  const port = Number(process.env.PORT || 3000);
  const portAvailable = await isPortAvailable(port);

  if (!portAvailable) {
    logger.error(
      `Port ${port} is already in use. Please free the port or change PORT in .env`,
    );
    await app.close();
    process.exit(1);
  }

  const handleSignal = async (signal: NodeJS.Signals) => {
    logger.log(`${signal} received`);
    await shutdownApplication(app, logger, connection, shutdownState);
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void handleSignal('SIGINT');
  });

  process.on('SIGTERM', () => {
    void handleSignal('SIGTERM');
  });

  try {
    await app.listen(port);
  } catch (error) {
    const listenError = error as NodeJS.ErrnoException;

    if (listenError.code === 'EADDRINUSE') {
      logger.error(
        `Port ${port} is already in use. Please free the port or change PORT in .env`,
      );
      await app.close();
      process.exit(1);
    }

    throw error;
  }

  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(
    `Swagger documentation is available on: http://localhost:${port}/api/docs`,
  );
}

bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');
  logger.error(`Application failed to start: ${(error as Error).message}`);
  process.exit(1);
});
