import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import mongoose, { Connection } from 'mongoose';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private connection: Connection;

  private readonly uri =
    process.env.MONGODB_URI ||
    'mongodb://admin:SecurePassword123!@localhost:27017/myappdb?authSource=admin';

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  private async connect(): Promise<void> {
    try {
      await mongoose.connect(this.uri);
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
