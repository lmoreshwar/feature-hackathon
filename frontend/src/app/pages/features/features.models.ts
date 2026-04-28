import { ApiEnvelope } from '../../core/auth/auth.models';

export type FeatureStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export const FEATURE_STATUSES: readonly FeatureStatus[] = [
  'DRAFT',
  'ACTIVE',
  'ARCHIVED',
] as const;

export interface FeatureRecord {
  _id: string;
  name: string;
  description?: string;
  status: FeatureStatus;
  totalSuites?: number;
  totalTestCases?: number;
  coveragePercentage?: number;
  createdBy?: string;
  createdAt?: number | string;
  updatedAt?: number | string;
}

export interface PaginatedFeatures {
  items: FeatureRecord[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
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
  createdBy?: string;
}

export type ListFeaturesResponse = ApiEnvelope<PaginatedFeatures>;
export type FeatureResponse = ApiEnvelope<FeatureRecord>;
export type DeleteFeatureResponse = ApiEnvelope<{ id: string } | unknown>;
