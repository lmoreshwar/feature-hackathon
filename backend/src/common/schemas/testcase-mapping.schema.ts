import { HydratedDocument, InferSchemaType, Schema } from 'mongoose';

export const TESTCASE_MAPPING_MODEL_NAME = 'TestCaseElementMapping';

export const TestCaseMappingSchema = new Schema(
  {
    featureId: { type: String, required: true, index: true, trim: true },
    testSuiteId: { type: String, required: true, index: true, trim: true },
    testCaseId: { type: String, required: true, trim: true },

    elementIds: { type: [String], default: [] },

    generatedScript: { type: String, default: null },

    scriptType: {
      type: String,
      enum: ['PLAYWRIGHT', 'CYPRESS', 'SELENIUM'],
      default: 'PLAYWRIGHT',
      required: true,
    },

    gitPushStatus: {
      type: String,
      enum: ['NOT_PUSHED', 'PUSHED', 'FAILED'],
      default: 'NOT_PUSHED',
    },

    createdBy: { type: String, required: true, trim: true },

    createdAt: { type: Number, default: () => Date.now() },
    updatedAt: { type: Number, default: () => Date.now() },
  },
  { collection: 'testCaseMappings', versionKey: false },
);

TestCaseMappingSchema.index({ testCaseId: 1 }, { unique: true });

export type TestCaseMapping = InferSchemaType<typeof TestCaseMappingSchema>;
export type TestCaseMappingDocument = HydratedDocument<TestCaseMapping>;
