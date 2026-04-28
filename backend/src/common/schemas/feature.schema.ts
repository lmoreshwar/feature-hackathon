import { HydratedDocument, InferSchemaType, Schema } from 'mongoose';

export const FEATURE_MODEL_NAME = 'Feature';

export const FeatureSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      default: null,
      trim: true,
    },
    status: {
      type: String,
      enum: ['DRAFT', 'ACTIVE', 'ARCHIVED'],
      default: 'DRAFT',
      required: true,
    },
    totalSuites: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalTestCases: {
      type: Number,
      default: 0,
      min: 0,
    },
    coveragePercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    createdBy: {
      type: String,
      default: null,
      trim: true,
    },
    createdAt: {
      type: Number,
      default: () => Date.now(),
    },
    updatedAt: {
      type: Number,
      default: () => Date.now(),
    },
  },
  {
    collection: 'features',
    versionKey: false,
  },
);

export type Feature = InferSchemaType<typeof FeatureSchema>;
export type FeatureDocument = HydratedDocument<Feature>;
