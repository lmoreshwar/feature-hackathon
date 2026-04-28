import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import mongoose, { Connection } from 'mongoose';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private connection: Connection;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  private async connect(): Promise<void> {
    const uri =
      this.configService.get<string>('MONGO_URI') ??
      this.configService.get<string>('MONGODB_URI') ??
      'mongodb://admin:SecurePassword123!@localhost:27017/hackathon_dev?authSource=admin';

    try {
      await mongoose.connect(uri);
      this.connection = mongoose.connection;

      this.connection.on('connected', () => {
        this.logger.log('MongoDB connected successfully');
      });

      this.connection.on('error', (error: Error) => {
        this.logger.error(`MongoDB connection error: ${error.message}`);
      });

      this.connection.on('disconnected', () => {
        this.logger.warn('MongoDB disconnected');
      });

      this.logger.log('MongoDB connection established');
    } catch (error) {
      this.logger.error(`Failed to connect to MongoDB: ${(error as Error).message}`);
      throw error;
    }
  }

  private async disconnect(): Promise<void> {
    if (this.connection) {
      await mongoose.disconnect();
      this.logger.log('MongoDB connection closed');
    }
  }

  getConnection(): Connection {
    return this.connection;
  }
}
