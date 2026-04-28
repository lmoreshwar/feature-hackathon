import { HydratedDocument, InferSchemaType, Schema } from 'mongoose';

export const TEST_EXECUTION_MODEL_NAME = 'TestExecution';

export const TestExecutionSchema = new Schema(
  {
    featureId: { type: String, required: true, index: true, trim: true },
    testSuiteId: { type: String, default: null, index: true, trim: true },
    testCaseIds: { type: [String], default: [] },

    buildName: { type: String, required: true, trim: true },

    provider: {
      type: String,
      enum: ['BROWSERSTACK', 'LOCAL'],
      default: 'LOCAL',
      required: true,
    },

    status: {
      type: String,
      enum: ['QUEUED', 'RUNNING', 'PASSED', 'FAILED', 'CANCELLED'],
      default: 'QUEUED',
      required: true,
    },

    totalTests: { type: Number, default: 0, min: 0 },
    passedTests: { type: Number, default: 0, min: 0 },
    failedTests: { type: Number, default: 0, min: 0 },
    skippedTests: { type: Number, default: 0, min: 0 },

    reportUrl: { type: String, default: null, trim: true },
    videoUrl: { type: String, default: null, trim: true },
    logsUrl: { type: String, default: null, trim: true },

    triggeredBy: { type: String, required: true, trim: true },

    createdAt: { type: Number, default: () => Date.now() },
    updatedAt: { type: Number, default: () => Date.now() },
  },
  { collection: 'testExecutions', versionKey: false },
);

export type TestExecution = InferSchemaType<typeof TestExecutionSchema>;
export type TestExecutionDocument = HydratedDocument<TestExecution>;
