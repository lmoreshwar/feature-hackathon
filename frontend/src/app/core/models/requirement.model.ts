import { IBaseCollection } from './common.models';

export type RequirementStatus = 'PENDING' | 'PROCESSED' | 'FAILED';

export const REQUIREMENT_STATUSES: readonly RequirementStatus[] = [
  'PENDING',
  'PROCESSED',
  'FAILED',
] as const;

export interface IRequirementSource extends IBaseCollection {
  featureId: string;
  testSuiteId?: string;
  jiraId?: string;
  confluenceUrl?: string;
  requirementText?: string;
  rawContent?: string;
  status: RequirementStatus;
  createdBy: string;
}

export interface CreateRequirementPayload {
  featureId: string;
  testSuiteId?: string;
  jiraId?: string;
  confluenceUrl?: string;
  requirementText?: string;
  rawContent?: string;
  status?: RequirementStatus;
}

export interface UpdateRequirementPayload {
  jiraId?: string;
  confluenceUrl?: string;
  requirementText?: string;
  rawContent?: string;
  status?: RequirementStatus;
}
