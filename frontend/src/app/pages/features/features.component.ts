import { ChangeDetectionStrategy, Component, OnInit, ViewChild, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule, NzTableQueryParams } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { debounceTime, distinctUntilChanged, finalize } from 'rxjs';

import {
  FEATURE_STATUSES,
  FeatureStatus,
  IFeature,
  PaginatedResult,
} from '../../core/models';
import { FeaturesService } from '../../core/services/features.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { StatusTagComponent } from '../../shared/components/status-tag/status-tag.component';
import { EpochPipe } from '../../shared/pipes/epoch.pipe';
import { FeatureFormDrawerComponent } from './feature-form-drawer.component';

@Component({
  selector: 'app-features',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NzCardModule,
    NzTableModule,
    NzButtonModule,
    NzInputModule,
    NzIconModule,
    NzTagModule,
    NzEmptyModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzProgressModule,
    NzTooltipModule,
    EpochPipe,
    PageHeaderComponent,
    StatusTagComponent,
    FeatureFormDrawerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './features.component.html',
  styleUrl: './features.component.scss',
})
export class FeaturesComponent implements OnInit {
  private readonly featuresService = inject(FeaturesService);
  private readonly message = inject(NzMessageService);
  private readonly router = inject(Router);

  protected readonly statuses = FEATURE_STATUSES;

  protected readonly features = signal<IFeature[]>([]);
  protected readonly loading = signal(false);
  protected readonly total = signal(0);
  protected readonly pageIndex = signal(1);
  protected readonly pageSize = signal(10);

  protected readonly searchControl = new FormControl<string>('', { nonNullable: true });
  protected readonly statusControl = new FormControl<FeatureStatus | null>(null);

  @ViewChild(FeatureFormDrawerComponent) private drawer?: FeatureFormDrawerComponent;

  ngOnInit(): void {
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(() => {
        this.pageIndex.set(1);
        this.fetch();
      });

    this.statusControl.valueChanges.pipe(distinctUntilChanged()).subscribe(() => {
      this.pageIndex.set(1);
      this.fetch();
    });

    this.fetch();
  }

  protected onQueryParamsChange(params: NzTableQueryParams): void {
    this.pageIndex.set(params.pageIndex);
    this.pageSize.set(params.pageSize);
    this.fetch();
  }

  protected refresh(): void {
    this.fetch();
  }

  protected openCreate(): void {
    this.drawer?.openCreate();
  }

  protected openEdit(feature: IFeature): void {
    this.drawer?.openEdit(feature);
  }

  protected onSaved(): void {
    this.fetch();
  }

  protected openDetails(feature: IFeature): void {
    void this.router.navigate(['/features', feature._id]);
  }

  protected archive(feature: IFeature): void {
    this.featuresService.archive(feature._id).subscribe({
      next: () => {
        this.message.success(`Feature "${feature.name}" archived`);
        this.fetch();
      },
    });
  }

  protected delete(feature: IFeature): void {
    this.featuresService.remove(feature._id).subscribe({
      next: () => {
        this.message.success(`Feature "${feature.name}" deleted`);
        const remainingOnPage = this.features().length - 1;
        if (remainingOnPage <= 0 && this.pageIndex() > 1) {
          this.pageIndex.update((p) => p - 1);
        }
        this.fetch();
      },
    });
  }

  protected coverageColor(value: number | undefined): string {
    if (value === undefined || value === null) return '#bfbfbf';
    if (value >= 80) return '#52c41a';
    if (value >= 50) return '#1677ff';
    if (value >= 20) return '#faad14';
    return '#ff4d4f';
  }

  private fetch(): void {
    this.loading.set(true);
    const filters: Record<string, unknown> = {};
    if (this.statusControl.value) {
      filters['status'] = this.statusControl.value;
    }

    this.featuresService
      .search({
        pageIndex: this.pageIndex(),
        pageSize: this.pageSize(),
        search: this.searchControl.value?.trim() || undefined,
        filters,
        sort: { createdAt: 'desc' },
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (result: PaginatedResult<IFeature>) => {
          this.features.set(result.items);
          this.total.set(result.total);
        },
        error: () => {
          this.features.set([]);
          this.total.set(0);
        },
      });
  }
}
