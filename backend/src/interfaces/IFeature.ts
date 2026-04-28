import { IBaseCollection } from './IBase';

// =====================================================
// FEATURE
// =====================================================


export interface IFeature extends IBaseCollection {
  name: string;
  description?: string;

  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

  totalSuites?: number;
  totalTestCases?: number;
  coveragePercentage?: number;

  createdBy?: string; // IUser._id
}
