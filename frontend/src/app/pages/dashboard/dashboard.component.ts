import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { finalize } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { DashboardMetrics } from '../../core/models';
import { DashboardService } from '../../core/services/dashboard.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

interface MetricCard {
  title: string;
  key: keyof DashboardMetrics;
  icon: string;
  color: string;
  isPercent?: boolean;
}

const EMPTY_METRICS: DashboardMetrics = {
  totalFeatures: 0,
  totalTestSuites: 0,
  totalTestCases: 0,
  approvedTestCases: 0,
  automatedTestCases: 0,
  passedExecutions: 0,
  failedExecutions: 0,
  coveragePercentage: 0,
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    NzCardModule,
    NzGridModule,
    NzStatisticModule,
    NzIconModule,
    NzTagModule,
    NzButtonModule,
    NzSpinModule,
    NzProgressModule,
    PageHeaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly dashboardService = inject(DashboardService);

  protected readonly currentUser = this.authService.currentUser;
  protected readonly loading = signal(false);
  protected readonly metrics = signal<DashboardMetrics>(EMPTY_METRICS);

  protected readonly cards: MetricCard[] = [
    { title: 'Total Features', key: 'totalFeatures', icon: 'appstore', color: '#4f46e5' },
    { title: 'Total Test Suites', key: 'totalTestSuites', icon: 'folder', color: '#1677ff' },
    { title: 'Total Test Cases', key: 'totalTestCases', icon: 'check-square', color: '#13c2c2' },
    { title: 'Approved Test Cases', key: 'approvedTestCases', icon: 'check-circle', color: '#52c41a' },
    { title: 'Automated Test Cases', key: 'automatedTestCases', icon: 'experiment', color: '#722ed1' },
    { title: 'Passed Executions', key: 'passedExecutions', icon: 'thunderbolt', color: '#52c41a' },
    { title: 'Failed Executions', key: 'failedExecutions', icon: 'warning', color: '#ff4d4f' },
    { title: 'Coverage', key: 'coveragePercentage', icon: 'cluster', color: '#fa8c16', isPercent: true },
  ];

  ngOnInit(): void {
    this.refresh();
  }

  protected refresh(): void {
    this.loading.set(true);
    this.dashboardService
      .getMetrics()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (data) => this.metrics.set(data),
        error: () => this.metrics.set(EMPTY_METRICS),
      });
  }

  protected getValue(card: MetricCard): number {
    return this.metrics()[card.key] ?? 0;
  }

  protected formatValue(card: MetricCard): string {
    const value = this.getValue(card);
    return card.isPercent ? `${value}%` : value.toLocaleString();
  }
}
