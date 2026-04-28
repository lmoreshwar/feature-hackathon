import { ChangeDetectionStrategy, Component, OnInit, ViewChild, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

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
  IFeature,
  ITestSuite,
  TEST_SUITE_STATUSES,
  TestSuiteStatus,
} from '../../core/models';
import { FeaturesService } from '../../core/services/features.service';
import { TestSuitesService } from '../../core/services/test-suites.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { StatusTagComponent } from '../../shared/components/status-tag/status-tag.component';
import { EpochPipe } from '../../shared/pipes/epoch.pipe';
import { TestSuiteFormDrawerComponent } from './test-suite-form-drawer.component';

@Component({
  selector: 'app-test-suites',
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
    TestSuiteFormDrawerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './test-suites.component.html',
  styleUrl: './test-suites.component.scss',
})
export class TestSuitesComponent implements OnInit {
  private readonly suitesService = inject(TestSuitesService);
  private readonly featuresService = inject(FeaturesService);
  private readonly message = inject(NzMessageService);

  protected readonly statuses = TEST_SUITE_STATUSES;
  protected readonly suites = signal<ITestSuite[]>([]);
  protected readonly features = signal<IFeature[]>([]);
  protected readonly loading = signal(false);
  protected readonly total = signal(0);
  protected readonly pageIndex = signal(1);
  protected readonly pageSize = signal(10);

  protected readonly searchControl = new FormControl<string>('', { nonNullable: true });
  protected readonly statusControl = new FormControl<TestSuiteStatus | null>(null);
  protected readonly featureControl = new FormControl<string | null>(null);

  @ViewChild(TestSuiteFormDrawerComponent) private drawer?: TestSuiteFormDrawerComponent;

  ngOnInit(): void {
    this.searchControl.valueChanges.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => {
      this.pageIndex.set(1);
      this.fetch();
    });
    this.statusControl.valueChanges.pipe(distinctUntilChanged()).subscribe(() => {
      this.pageIndex.set(1);
      this.fetch();
    });
    this.featureControl.valueChanges.pipe(distinctUntilChanged()).subscribe(() => {
      this.pageIndex.set(1);
      this.fetch();
    });

    this.loadFeatures();
    this.fetch();
  }

  protected onQueryParamsChange(p: NzTableQueryParams): void {
    this.pageIndex.set(p.pageIndex);
    this.pageSize.set(p.pageSize);
    this.fetch();
  }

  protected refresh(): void {
    this.loadFeatures();
    this.fetch();
  }

  protected openCreate(): void {
    this.drawer?.openCreate(this.featureControl.value ?? undefined);
  }

  protected openEdit(s: ITestSuite): void {
    this.drawer?.openEdit(s);
  }

  protected onSaved(): void {
    this.fetch();
  }

  protected archive(s: ITestSuite): void {
    this.suitesService.archive(s._id).subscribe({
      next: () => {
        this.message.success(`Suite "${s.moduleName}" archived`);
        this.fetch();
      },
    });
  }

  protected delete(s: ITestSuite): void {
    this.suitesService.remove(s._id).subscribe({
      next: () => {
        this.message.success(`Suite "${s.moduleName}" deleted`);
        this.fetch();
      },
    });
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
    const filters: Record<string, unknown> = {};
    if (this.statusControl.value) filters['status'] = this.statusControl.value;
    if (this.featureControl.value) filters['featureId'] = this.featureControl.value;

    this.suitesService
      .search({
        pageIndex: this.pageIndex(),
        pageSize: this.pageSize(),
        search: this.searchControl.value?.trim() || undefined,
        filters,
        sort: { createdAt: 'desc' },
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => {
          this.suites.set(res.items);
          this.total.set(res.total);
        },
        error: () => {
          this.suites.set([]);
          this.total.set(0);
        },
      });
  }
}
