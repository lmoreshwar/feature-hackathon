export type LlmProvider = 'OPENAI' | 'AZURE_OPENAI' | 'ANTHROPIC';
export type GitProvider = 'GITHUB' | 'GITLAB' | 'BITBUCKET';

export const LLM_PROVIDERS: readonly LlmProvider[] = [
  'OPENAI',
  'AZURE_OPENAI',
  'ANTHROPIC',
] as const;

export const GIT_PROVIDERS: readonly GitProvider[] = [
  'GITHUB',
  'GITLAB',
  'BITBUCKET',
] as const;

export interface JiraSettingsForm {
  baseUrl: string;
  email: string;
  apiToken: string;
}

export interface ConfluenceSettingsForm {
  baseUrl: string;
  email: string;
  apiToken: string;
}

export interface LlmSettingsForm {
  provider: LlmProvider;
  apiKey: string;
  model: string;
}

export interface GitSettingsForm {
  provider: GitProvider;
  repoUrl: string;
  token: string;
  branch: string;
}

export interface BrowserStackSettingsForm {
  username: string;
  accessKey: string;
}

export interface UpsertIntegrationPayload {
  jira?: JiraSettingsForm;
  confluence?: ConfluenceSettingsForm;
  llm?: LlmSettingsForm;
  git?: GitSettingsForm;
  browserstack?: BrowserStackSettingsForm;
}

export interface MaskedIntegration {
  _id: string;
  userId: string;
  jira?: { baseUrl: string; email: string; apiTokenMasked: string } | null;
  confluence?:
    | { baseUrl: string; email: string; apiTokenMasked: string }
    | null;
  llm?:
    | { provider: LlmProvider; apiKeyMasked: string; model: string }
    | null;
  git?:
    | {
        provider: GitProvider;
        repoUrl: string;
        tokenMasked: string;
        branch: string;
      }
    | null;
  browserstack?: { username: string; accessKeyMasked: string } | null;
  createdAt: number;
  updatedAt: number;
}
