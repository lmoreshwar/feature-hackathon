import { IBaseCollection } from './common.models';

export type ScriptType = 'PLAYWRIGHT' | 'CYPRESS' | 'SELENIUM';
export type GitPushStatus = 'NOT_PUSHED' | 'PUSHED' | 'FAILED';

export const SCRIPT_TYPES: readonly ScriptType[] = [
  'PLAYWRIGHT',
  'CYPRESS',
  'SELENIUM',
] as const;

export const GIT_PUSH_STATUSES: readonly GitPushStatus[] = [
  'NOT_PUSHED',
  'PUSHED',
  'FAILED',
] as const;

export interface ITestCaseElementMapping extends IBaseCollection {
  featureId: string;
  testSuiteId: string;
  testCaseId: string;
  elementIds: string[];
  generatedScript?: string;
  scriptType: ScriptType;
  gitPushStatus?: GitPushStatus;
  createdBy: string;
}

export interface CreateMappingPayload {
  featureId: string;
  testSuiteId: string;
  testCaseId: string;
  elementIds: string[];
  scriptType?: ScriptType;
  generatedScript?: string;
}

export interface UpdateMappingPayload {
  elementIds?: string[];
  scriptType?: ScriptType;
  generatedScript?: string;
  gitPushStatus?: GitPushStatus;
}

export interface PushToGitPayload {
  path?: string;
  message?: string;
}
