import { HydratedDocument, InferSchemaType, Schema } from 'mongoose';

export const INTEGRATION_MODEL_NAME = 'IntegrationSettings';

const JiraSchema = new Schema(
  {
    baseUrl: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    apiTokenEncrypted: { type: String, required: true },
  },
  { _id: false },
);

const ConfluenceSchema = new Schema(
  {
    baseUrl: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    apiTokenEncrypted: { type: String, required: true },
  },
  { _id: false },
);

const LlmSchema = new Schema(
  {
    provider: {
      type: String,
      enum: ['OPENAI', 'AZURE_OPENAI', 'ANTHROPIC'],
      required: true,
    },
    apiKeyEncrypted: { type: String, required: true },
    model: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const GitSchema = new Schema(
  {
    provider: {
      type: String,
      enum: ['GITHUB', 'GITLAB', 'BITBUCKET'],
      required: true,
    },
    repoUrl: { type: String, required: true, trim: true },
    tokenEncrypted: { type: String, required: true },
    branch: { type: String, required: true, default: 'main', trim: true },
  },
  { _id: false },
);

const BrowserStackSchema = new Schema(
  {
    username: { type: String, required: true, trim: true },
    accessKeyEncrypted: { type: String, required: true },
  },
  { _id: false },
);

export const IntegrationSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true, trim: true },

    jira: { type: JiraSchema, default: null },
    confluence: { type: ConfluenceSchema, default: null },
    llm: { type: LlmSchema, default: null },
    git: { type: GitSchema, default: null },
    browserstack: { type: BrowserStackSchema, default: null },

    createdAt: { type: Number, default: () => Date.now() },
    updatedAt: { type: Number, default: () => Date.now() },
  },
  { collection: 'integrationSettings', versionKey: false },
);

export type Integration = InferSchemaType<typeof IntegrationSchema>;
export type IntegrationDocument = HydratedDocument<Integration>;
