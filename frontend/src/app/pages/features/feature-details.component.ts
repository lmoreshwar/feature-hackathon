import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzListModule } from 'ng-zorro-antd/list';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTagModule } from 'ng-zorro-antd/tag';

import { FeatureMetrics, IFeature, ITestSuite } from '../../core/models';
import { DashboardService } from '../../core/services/dashboard.service';
import { FeaturesService } from '../../core/services/features.service';
import { TestSuitesService } from '../../core/services/test-suites.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { StatusTagComponent } from '../../shared/components/status-tag/status-tag.component';
import { EpochPipe } from '../../shared/pipes/epoch.pipe';

@Component({
  selector: 'app-feature-details',
  standalone: true,
  imports: [
    RouterLink,
    NzCardModule,
    NzDescriptionsModule,
    NzGridModule,
    NzIconModule,
    NzListModule,
    NzProgressModule,
    NzSpinModule,
    NzStatisticModule,
    NzTagModule,
    NzButtonModule,
    PageHeaderComponent,
    StatusTagComponent,
    EpochPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './feature-details.component.html',
  styleUrl: './feature-details.component.scss',
})
export class FeatureDetailsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly featuresService = inject(FeaturesService);
  private readonly suitesService = inject(TestSuitesService);
  private readonly dashboardService = inject(DashboardService);

  protected readonly loading = signal(true);
  protected readonly feature = signal<IFeature | null>(null);
  protected readonly suites = signal<ITestSuite[]>([]);
  protected readonly metrics = signal<FeatureMetrics | null>(null);

  ngOnInit(): void {
    const featureId = this.route.snapshot.paramMap.get('featureId');
    if (!featureId) {
      void this.router.navigate(['/features']);
      return;
    }
    this.fetch(featureId);
  }

  private fetch(featureId: string): void {
    this.loading.set(true);
    forkJoin({
      feature: this.featuresService.getById(featureId),
      suites: this.suitesService.listByFeature(featureId),
      metrics: this.dashboardService.getFeatureMetrics(featureId),
    }).subscribe({
      next: ({ feature, suites, metrics }) => {
        this.feature.set(feature);
        this.suites.set(suites);
        this.metrics.set(metrics);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
