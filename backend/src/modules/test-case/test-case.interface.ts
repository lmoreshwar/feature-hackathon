import { ITestCase } from '../../interfaces';

export type TestCaseStatus = ITestCase['status'];
export type TestCasePriority = ITestCase['priority'];
export type TestCaseType = ITestCase['type'];

export interface TestCaseRecord extends ITestCase {
  _id: string;
}
