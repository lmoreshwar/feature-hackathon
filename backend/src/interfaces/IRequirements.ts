import { IBaseCollection } from './IBase';

// =====================================================
// REQUIREMENT SOURCE
// =====================================================


export interface IRequirementSource extends IBaseCollection {
  featureId: string; // IFeature._id
  testSuiteId?: string; // ITestSuite._id

  jiraId?: string;
  confluenceUrl?: string;
  requirementText?: string;

  rawContent?: string;

  status: 'PENDING' | 'PROCESSED' | 'FAILED';

  createdBy: string; // IUser._id
}
