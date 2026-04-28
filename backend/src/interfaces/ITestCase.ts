import { IBaseCollection } from './IBase';
import { IReferenceInfo } from "./IReferenceInfo";

// =====================================================
// TEST CASE
// =====================================================


export interface ITestCase extends IBaseCollection {
  featureId: string; // IFeature._id
  testSuiteId: string; // ITestSuite._id

  title: string;
  description?: string;

  preconditions?: string[];
  steps: string[];
  expectedResult: string;

  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  type: 'FUNCTIONAL' | 'REGRESSION' | 'SMOKE' | 'E2E';

  status: 'GENERATED' | 'APPROVED' | 'REJECTED' | 'NEEDS_REVIEW';

  referenceInfo?: IReferenceInfo;

  createdBy: string; // IUser._id
}
