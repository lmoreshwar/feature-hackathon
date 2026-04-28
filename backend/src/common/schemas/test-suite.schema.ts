import { HydratedDocument, InferSchemaType, Schema } from 'mongoose';

export const TEST_SUITE_MODEL_NAME = 'TestSuite';

const ReferenceInfoSchema = new Schema(
  {
    jiraId: { type: String, default: null, trim: true },
    testLinkId: { type: String, default: null, trim: true },
    confluenceUrl: { type: String, default: null, trim: true },
    requirementText: { type: String, default: null },
  },
  { _id: false },
);

export const TestSuiteSchema = new Schema(
  {
    featureId: { type: String, required: true, index: true, trim: true },

    moduleName: { type: String, required: true, trim: true },
    description: { type: String, default: null, trim: true },
    version: { type: String, required: true, default: '1.0.0', trim: true },

    totalTests: { type: Number, default: 0, min: 0 },
    passedTests: { type: Number, default: 0, min: 0 },
    failedTests: { type: Number, default: 0, min: 0 },
    skippedTests: { type: Number, default: 0, min: 0 },
    passPercentage: { type: Number, default: 0, min: 0, max: 100 },

    status: {
      type: String,
      enum: ['DRAFT', 'ACTIVE', 'ARCHIVED'],
      default: 'DRAFT',
      required: true,
    },

    referenceInfo: { type: ReferenceInfoSchema, default: null },

    createdBy: { type: String, required: true, trim: true },

    createdAt: { type: Number, default: () => Date.now() },
    updatedAt: { type: Number, default: () => Date.now() },
  },
  { collection: 'testSuites', versionKey: false },
);

TestSuiteSchema.index({ featureId: 1, moduleName: 1 }, { unique: true });

export type TestSuite = InferSchemaType<typeof TestSuiteSchema>;
export type TestSuiteDocument = HydratedDocument<TestSuite>;
