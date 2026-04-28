import { HydratedDocument, InferSchemaType, Schema } from 'mongoose';

export const REQUIREMENT_MODEL_NAME = 'RequirementSource';

export const RequirementSchema = new Schema(
  {
    featureId: { type: String, required: true, index: true, trim: true },
    testSuiteId: { type: String, default: null, index: true, trim: true },

    jiraId: { type: String, default: null, trim: true },
    confluenceUrl: { type: String, default: null, trim: true },
    requirementText: { type: String, default: null },

    rawContent: { type: String, default: null },

    status: {
      type: String,
      enum: ['PENDING', 'PROCESSED', 'FAILED'],
      default: 'PENDING',
      required: true,
    },

    createdBy: { type: String, required: true, trim: true },

    createdAt: { type: Number, default: () => Date.now() },
    updatedAt: { type: Number, default: () => Date.now() },
  },
  { collection: 'requirementSources', versionKey: false },
);

export type Requirement = InferSchemaType<typeof RequirementSchema>;
export type RequirementDocument = HydratedDocument<Requirement>;
