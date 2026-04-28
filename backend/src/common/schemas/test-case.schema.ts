import { HydratedDocument, InferSchemaType, Schema } from 'mongoose';

export const TEST_CASE_MODEL_NAME = 'TestCase';

const TestCaseReferenceInfoSchema = new Schema(
  {
    jiraId: { type: String, default: null, trim: true },
    testLinkId: { type: String, default: null, trim: true },
    confluenceUrl: { type: String, default: null, trim: true },
    requirementText: { type: String, default: null },
  },
  { _id: false },
);

export const TestCaseSchema = new Schema(
  {
    featureId: { type: String, required: true, index: true, trim: true },
    testSuiteId: { type: String, required: true, index: true, trim: true },

    title: { type: String, required: true, trim: true },
    description: { type: String, default: null },

    preconditions: { type: [String], default: [] },
    steps: { type: [String], default: [] },
    expectedResult: { type: String, required: true },

    testData: { type: String, default: null },
    tags: { type: [String], default: [], index: true },
    comments: { type: String, default: null },
    automationFeasible: { type: Boolean, default: false, index: true },

    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM',
      required: true,
    },
    type: {
      type: String,
      enum: ['FUNCTIONAL', 'REGRESSION', 'SMOKE', 'E2E'],
      default: 'FUNCTIONAL',
      required: true,
    },
    status: {
      type: String,
      enum: ['GENERATED', 'APPROVED', 'REJECTED', 'NEEDS_REVIEW'],
      default: 'GENERATED',
      required: true,
    },

    referenceInfo: { type: TestCaseReferenceInfoSchema, default: null },

    createdBy: { type: String, required: true, trim: true },

    createdAt: { type: Number, default: () => Date.now() },
    updatedAt: { type: Number, default: () => Date.now() },
  },
  { collection: 'testCases', versionKey: false },
);

export type TestCase = InferSchemaType<typeof TestCaseSchema>;
export type TestCaseDocument = HydratedDocument<TestCase>;
