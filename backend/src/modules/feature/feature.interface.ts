import { IFeature } from '../../interfaces/IFeature';

export type FeatureStatus = IFeature['status'];

export interface FeatureRecord extends IFeature {}

export interface PaginatedFeatures {
  items: FeatureRecord[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
