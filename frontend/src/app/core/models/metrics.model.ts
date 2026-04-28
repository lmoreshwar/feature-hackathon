export interface DashboardMetrics {
  totalFeatures: number;
  totalTestSuites: number;
  totalTestCases: number;
  approvedTestCases: number;
  automatedTestCases: number;
  passedExecutions: number;
  failedExecutions: number;
  coveragePercentage: number;
}

export type TraceabilityStatus = 'COVERED' | 'PARTIAL' | 'GAP';

export interface TraceabilityRow {
  requirementId: string;
  requirementSource: 'JIRA' | 'CONFLUENCE' | 'TEXT' | 'UNKNOWN';
  requirementKey: string;
  featureId: string;
  testCases: Array<{
    _id: string;
    title: string;
    status: 'GENERATED' | 'APPROVED' | 'REJECTED' | 'NEEDS_REVIEW';
    automated: boolean;
  }>;
  status: TraceabilityStatus;
}

export interface FeatureMetrics {
  featureId: string;
  totalSuites: number;
  totalTestCases: number;
  approvedTestCases: number;
  automatedTestCases: number;
  totalExecutions: number;
  totalPageElements: number;
  coveragePercentage: number;
}
