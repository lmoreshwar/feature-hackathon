import { IBaseCollection, IReferenceInfo } from './common.models';

export type TestSuiteStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export const TEST_SUITE_STATUSES: readonly TestSuiteStatus[] = [
  'DRAFT',
  'ACTIVE',
  'ARCHIVED',
] as const;

export interface ITestSuite extends IBaseCollection {
  featureId: string;
  moduleName: string;
  description?: string;
  version: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests?: number;
  passPercentage: number;
  status: TestSuiteStatus;
  referenceInfo?: IReferenceInfo;
  createdBy: string;
}

export interface CreateTestSuitePayload {
  featureId: string;
  moduleName: string;
  description?: string;
  version?: string;
  status?: TestSuiteStatus;
  referenceInfo?: IReferenceInfo;
}

export interface UpdateTestSuitePayload {
  moduleName?: string;
  description?: string;
  version?: string;
  status?: TestSuiteStatus;
  totalTests?: number;
  passedTests?: number;
  failedTests?: number;
  skippedTests?: number;
  passPercentage?: number;
  referenceInfo?: IReferenceInfo;
}
