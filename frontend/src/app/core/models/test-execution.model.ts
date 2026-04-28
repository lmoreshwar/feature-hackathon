import { IBaseCollection } from './common.models';

export type ExecutionProvider = 'BROWSERSTACK' | 'LOCAL';
export type ExecutionStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'PASSED'
  | 'FAILED'
  | 'CANCELLED';

export const EXECUTION_PROVIDERS: readonly ExecutionProvider[] = [
  'BROWSERSTACK',
  'LOCAL',
] as const;

export const EXECUTION_STATUSES: readonly ExecutionStatus[] = [
  'QUEUED',
  'RUNNING',
  'PASSED',
  'FAILED',
  'CANCELLED',
] as const;

export interface ITestExecution extends IBaseCollection {
  featureId: string;
  testSuiteId?: string;
  testCaseIds?: string[];
  buildName: string;
  provider: ExecutionProvider;
  status: ExecutionStatus;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests?: number;
  reportUrl?: string;
  videoUrl?: string;
  logsUrl?: string;
  triggeredBy: string;
}

export interface BrowserStackCapsPayload {
  os?: string;
  osVersion?: string;
  browser?: string;
  browserVersion?: string;
}

export interface CreateExecutionPayload {
  featureId: string;
  testSuiteId?: string;
  testCaseIds?: string[];
  buildName: string;
  provider?: ExecutionProvider;
  status?: ExecutionStatus;
  baseUrl?: string;
  browserStack?: BrowserStackCapsPayload;
}

export interface UpdateExecutionPayload {
  buildName?: string;
  status?: ExecutionStatus;
  totalTests?: number;
  passedTests?: number;
  failedTests?: number;
  skippedTests?: number;
  reportUrl?: string;
  videoUrl?: string;
  logsUrl?: string;
}
