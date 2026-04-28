import { IBaseCollection } from './IBase';
import { IReferenceInfo } from "./IReferenceInfo";

// =====================================================
// TEST SUITE
// =====================================================


export interface ITestSuite extends IBaseCollection {
  featureId: string; // IFeature._id

  moduleName: string;
  description?: string;
  version: string;

  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests?: number;

  passPercentage: number;

  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

  referenceInfo?: IReferenceInfo;

  createdBy: string; // IUser._id
}
