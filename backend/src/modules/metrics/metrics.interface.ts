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
  status: 'COVERED' | 'PARTIAL' | 'GAP';
}
