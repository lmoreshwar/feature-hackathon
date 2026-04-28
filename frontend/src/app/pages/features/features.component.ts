import { ChangeDetectionStrategy, Component, OnInit, ViewChild, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';

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

import { FeatureFormDrawerComponent } from './feature-form-drawer.component';
import { FEATURE_STATUSES, FeatureRecord, FeatureStatus } from './features.models';
import { FeaturesService } from './features.service';

const STATUS_COLORS: Record<FeatureStatus, string> = {
  DRAFT: 'default',
  ACTIVE: 'green',
  ARCHIVED: 'gold',
};

@Component({
  selector: 'app-features',
  standalone: true,
  imports: [
    DatePipe,
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
    FeatureFormDrawerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './features.component.html',
  styleUrl: './features.component.scss',
})
export class FeaturesComponent implements OnInit {
  private readonly featuresService = inject(FeaturesService);
  private readonly message = inject(NzMessageService);

  protected readonly statuses = FEATURE_STATUSES;
  protected readonly statusColors = STATUS_COLORS;

  protected readonly features = signal<FeatureRecord[]>([]);
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

  protected openEdit(feature: FeatureRecord): void {
    this.drawer?.openEdit(feature);
  }

  protected onSaved(): void {
    this.fetch();
  }

  protected delete(feature: FeatureRecord): void {
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
    if (value === undefined || value === null) {
      return '#bfbfbf';
    }
    if (value >= 80) {
      return '#52c41a';
    }
    if (value >= 50) {
      return '#1677ff';
    }
    if (value >= 20) {
      return '#faad14';
    }
    return '#ff4d4f';
  }

  private fetch(): void {
    this.loading.set(true);
    this.featuresService
      .list({
        page: this.pageIndex(),
        limit: this.pageSize(),
        search: this.searchControl.value,
        status: this.statusControl.value ?? undefined,
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (result) => {
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
