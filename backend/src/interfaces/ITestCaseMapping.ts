import { IBaseCollection } from './IBase';

// =====================================================
// TESTCASE → PAGE ELEMENT MAPPING
// =====================================================


export interface ITestCaseElementMapping extends IBaseCollection {
  featureId: string; // IFeature._id
  testSuiteId: string; // ITestSuite._id
  testCaseId: string; // ITestCase._id

  elementIds: string[]; // IPageElement._id[]

  generatedScript?: string;

  scriptType: 'PLAYWRIGHT' | 'CYPRESS' | 'SELENIUM';

  gitPushStatus?: 'NOT_PUSHED' | 'PUSHED' | 'FAILED';

  createdBy: string; // IUser._id
}
