import { IBaseCollection, IReferenceInfo } from './common.models';

export type TestCasePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TestCaseType = 'FUNCTIONAL' | 'REGRESSION' | 'SMOKE' | 'E2E';
export type TestCaseStatus =
  | 'GENERATED'
  | 'APPROVED'
  | 'REJECTED'
  | 'NEEDS_REVIEW';

export const TEST_CASE_PRIORITIES: readonly TestCasePriority[] = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
] as const;

export const TEST_CASE_TYPES: readonly TestCaseType[] = [
  'FUNCTIONAL',
  'REGRESSION',
  'SMOKE',
  'E2E',
] as const;

export const TEST_CASE_STATUSES: readonly TestCaseStatus[] = [
  'GENERATED',
  'APPROVED',
  'REJECTED',
  'NEEDS_REVIEW',
] as const;

export interface ITestCase extends IBaseCollection {
  featureId: string;
  testSuiteId: string;
  title: string;
  description?: string;
  preconditions?: string[];
  steps: string[];
  expectedResult: string;
  testData?: string;
  tags?: string[];
  comments?: string;
  /**
   * True when the test case is a candidate for automation (deterministic
   * steps, programmatically verifiable expected result, etc.). When true
   * the literal "Automation" tag is also present in `tags`.
   */
  automationFeasible?: boolean;
  priority: TestCasePriority;
  type: TestCaseType;
  status: TestCaseStatus;
  referenceInfo?: IReferenceInfo;
  createdBy: string;
}

export interface CreateTestCasePayload {
  featureId: string;
  testSuiteId: string;
  title: string;
  description?: string;
  preconditions?: string[];
  steps: string[];
  expectedResult: string;
  testData?: string;
  tags?: string[];
  comments?: string;
  automationFeasible?: boolean;
  priority?: TestCasePriority;
  type?: TestCaseType;
  status?: TestCaseStatus;
  referenceInfo?: IReferenceInfo;
}

export interface UpdateTestCasePayload {
  title?: string;
  description?: string;
  preconditions?: string[];
  steps?: string[];
  expectedResult?: string;
  testData?: string;
  tags?: string[];
  comments?: string;
  automationFeasible?: boolean;
  priority?: TestCasePriority;
  type?: TestCaseType;
  status?: TestCaseStatus;
  referenceInfo?: IReferenceInfo;
}
