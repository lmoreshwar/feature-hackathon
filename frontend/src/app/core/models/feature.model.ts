import { IBaseCollection } from './common.models';

export type FeatureStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export const FEATURE_STATUSES: readonly FeatureStatus[] = [
  'DRAFT',
  'ACTIVE',
  'ARCHIVED',
] as const;

export interface IFeature extends IBaseCollection {
  name: string;
  description?: string;
  status: FeatureStatus;
  totalSuites?: number;
  totalTestCases?: number;
  coveragePercentage?: number;
  createdBy?: string;
}

export interface CreateFeaturePayload {
  name: string;
  description?: string;
}

export interface UpdateFeaturePayload {
  name?: string;
  description?: string;
  status?: FeatureStatus;
  totalSuites?: number;
  totalTestCases?: number;
  coveragePercentage?: number;
}
