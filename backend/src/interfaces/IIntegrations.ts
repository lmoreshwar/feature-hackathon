import { IBaseCollection } from './IBase';

// =====================================================
// SETTINGS / INTEGRATIONS
// =====================================================


export interface IIntegrationSettings extends IBaseCollection {
  userId: string; // IUser._id

  jira?: {
    baseUrl: string;
    email: string;
    apiTokenEncrypted: string;
  };

  confluence?: {
    baseUrl: string;
    email: string;
    apiTokenEncrypted: string;
  };

  llm?: {
    provider: 'OPENAI' | 'AZURE_OPENAI' | 'ANTHROPIC';
    apiKeyEncrypted: string;
    model: string;
  };

  git?: {
    provider: 'GITHUB' | 'GITLAB' | 'BITBUCKET';
    repoUrl: string;
    tokenEncrypted: string;
    branch: string;
  };

  browserstack?: {
    username: string;
    accessKeyEncrypted: string;
  };
}
