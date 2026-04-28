import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { distinctUntilChanged, finalize } from 'rxjs';

import { IFeature, TraceabilityRow } from '../../core/models';
import { DashboardService } from '../../core/services/dashboard.service';
import { FeaturesService } from '../../core/services/features.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { StatusTagComponent } from '../../shared/components/status-tag/status-tag.component';

@Component({
  selector: 'app-traceability',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NzCardModule,
    NzTableModule,
    NzButtonModule,
    NzSelectModule,
    NzIconModule,
    NzTagModule,
    NzSpinModule,
    NzEmptyModule,
    PageHeaderComponent,
    StatusTagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './traceability.component.html',
  styleUrl: './traceability.component.scss',
})
export class TraceabilityComponent implements OnInit {
  private readonly dashboardService = inject(DashboardService);
  private readonly featuresService = inject(FeaturesService);

  protected readonly rows = signal<TraceabilityRow[]>([]);
  protected readonly features = signal<IFeature[]>([]);
  protected readonly loading = signal(false);

  protected readonly featureFilter = new FormControl<string | null>(null);

  ngOnInit(): void {
    this.loadFeatures();
    this.featureFilter.valueChanges.pipe(distinctUntilChanged()).subscribe(() => this.fetch());
    this.fetch();
  }

  protected refresh(): void {
    this.fetch();
  }

  protected featureName(id: string): string {
    return this.features().find((f) => f._id === id)?.name ?? '—';
  }

  private loadFeatures(): void {
    this.featuresService.search({ pageIndex: 1, pageSize: 200 }).subscribe({
      next: (res) => this.features.set(res.items),
    });
  }

  private fetch(): void {
    this.loading.set(true);
    this.dashboardService
      .getTraceability(this.featureFilter.value ?? undefined)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (rows) => this.rows.set(rows),
        error: () => this.rows.set([]),
      });
  }
}
