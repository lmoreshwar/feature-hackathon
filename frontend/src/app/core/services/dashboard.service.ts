import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import {
  ApiEnvelope,
  DashboardMetrics,
  FeatureMetrics,
  TraceabilityRow,
} from '../models';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly api = inject(ApiService);
  private readonly base = '/dashboard';

  getMetrics(): Observable<DashboardMetrics> {
    return this.api
      .get<ApiEnvelope<DashboardMetrics>>(`${this.base}/metrics`)
      .pipe(
        map(
          (res) =>
            res.data ?? {
              totalFeatures: 0,
              totalTestSuites: 0,
              totalTestCases: 0,
              approvedTestCases: 0,
              automatedTestCases: 0,
              passedExecutions: 0,
              failedExecutions: 0,
              coveragePercentage: 0,
            },
        ),
      );
  }

  getTraceability(featureId?: string): Observable<TraceabilityRow[]> {
    return this.api
      .get<ApiEnvelope<TraceabilityRow[]>>(
        `${this.base}/traceability`,
        featureId ? { featureId } : undefined,
      )
      .pipe(map((res) => res.data ?? []));
  }

  getFeatureMetrics(featureId: string): Observable<FeatureMetrics | null> {
    return this.api
      .get<ApiEnvelope<FeatureMetrics>>(`${this.base}/feature/${featureId}`)
      .pipe(map((res) => res.data ?? null));
  }
}
