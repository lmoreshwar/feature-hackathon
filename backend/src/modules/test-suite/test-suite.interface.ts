import { ITestSuite } from '../../interfaces';

export type TestSuiteStatus = ITestSuite['status'];

export interface TestSuiteRecord extends ITestSuite {
  _id: string;
}
