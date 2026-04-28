import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, UpdateQuery } from 'mongoose';
import {
  INTEGRATION_MODEL_NAME,
  IntegrationDocument,
} from '../../common/schemas';

export type IntegrationUpdate = Partial<{
  jira: IntegrationDocument['jira'];
  confluence: IntegrationDocument['confluence'];
  llm: IntegrationDocument['llm'];
  git: IntegrationDocument['git'];
  browserstack: IntegrationDocument['browserstack'];
}>;

@Injectable()
export class IntegrationRepository {
  constructor(
    @InjectModel(INTEGRATION_MODEL_NAME)
    private readonly model: Model<IntegrationDocument>,
  ) {}

  async findByUserId(userId: string): Promise<IntegrationDocument | null> {
    return this.model.findOne({ userId }).exec();
  }

  async upsert(
    userId: string,
    data: IntegrationUpdate,
  ): Promise<IntegrationDocument> {
    const now = Date.now();
    const update: UpdateQuery<IntegrationDocument> = {
      $set: { ...data, updatedAt: now },
      $setOnInsert: { userId, createdAt: now },
    };
    return (await this.model
      .findOneAndUpdate({ userId }, update, {
        new: true,
        upsert: true,
        runValidators: true,
      })
      .exec()) as IntegrationDocument;
  }

  async clear(
    userId: string,
    section: keyof IntegrationUpdate,
  ): Promise<IntegrationDocument | null> {
    return this.model
      .findOneAndUpdate(
        { userId },
        { $set: { [section]: null, updatedAt: Date.now() } },
        { new: true, runValidators: true },
      )
      .exec();
  }
}
