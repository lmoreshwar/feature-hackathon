import { IBaseCollection } from './IBase';

// =====================================================
// TEST EXECUTION
// =====================================================


export interface ITestExecution extends IBaseCollection {
  featureId: string; // IFeature._id
  testSuiteId?: string; // ITestSuite._id
  testCaseIds?: string[]; // ITestCase._id[]

  buildName: string;

  provider: 'BROWSERSTACK' | 'LOCAL';

  status: 'QUEUED' | 'RUNNING' | 'PASSED' | 'FAILED' | 'CANCELLED';

  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests?: number;

  reportUrl?: string;
  videoUrl?: string;
  logsUrl?: string;

  triggeredBy: string; // IUser._id
}
