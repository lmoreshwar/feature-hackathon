import { ChangeDetectionStrategy, Component, OnInit, ViewChild, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule, NzTableQueryParams } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { debounceTime, distinctUntilChanged, finalize } from 'rxjs';

import {
  IFeature,
  ITestCase,
  ITestSuite,
  TEST_CASE_PRIORITIES,
  TEST_CASE_STATUSES,
  TEST_CASE_TYPES,
  TestCasePriority,
  TestCaseStatus,
  TestCaseType,
} from '../../core/models';
import { FeaturesService } from '../../core/services/features.service';
import { TestCasesService } from '../../core/services/test-cases.service';
import { TestSuitesService } from '../../core/services/test-suites.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { StatusTagComponent } from '../../shared/components/status-tag/status-tag.component';
import { EpochPipe } from '../../shared/pipes/epoch.pipe';
import { TestCaseFormDrawerComponent } from './test-case-form-drawer.component';

@Component({
  selector: 'app-test-cases',
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
    NzTooltipModule,
    NzModalModule,
    EpochPipe,
    PageHeaderComponent,
    StatusTagComponent,
    TestCaseFormDrawerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './test-cases.component.html',
  styleUrl: './test-cases.component.scss',
})
export class TestCasesComponent implements OnInit {
  private readonly testCasesService = inject(TestCasesService);
  private readonly suitesService = inject(TestSuitesService);
  private readonly featuresService = inject(FeaturesService);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);

  protected readonly statuses = TEST_CASE_STATUSES;
  protected readonly priorities = TEST_CASE_PRIORITIES;
  protected readonly types = TEST_CASE_TYPES;

  protected readonly testCases = signal<ITestCase[]>([]);
  protected readonly features = signal<IFeature[]>([]);
  protected readonly suites = signal<ITestSuite[]>([]);
  protected readonly loading = signal(false);
  protected readonly total = signal(0);
  protected readonly pageIndex = signal(1);
  protected readonly pageSize = signal(10);

  protected readonly searchControl = new FormControl<string>('', { nonNullable: true });
  protected readonly statusControl = new FormControl<TestCaseStatus | null>(null);
  protected readonly featureControl = new FormControl<string | null>(null);
  protected readonly suiteControl = new FormControl<string | null>(null);
  protected readonly priorityControl = new FormControl<TestCasePriority | null>(null);
  protected readonly typeControl = new FormControl<TestCaseType | null>(null);

  @ViewChild(TestCaseFormDrawerComponent) private drawer?: TestCaseFormDrawerComponent;

  ngOnInit(): void {
    this.searchControl.valueChanges.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => {
      this.pageIndex.set(1);
      this.fetch();
    });

    [this.statusControl, this.priorityControl, this.typeControl, this.suiteControl].forEach((c) =>
      c.valueChanges.pipe(distinctUntilChanged()).subscribe(() => {
        this.pageIndex.set(1);
        this.fetch();
      }),
    );

    this.featureControl.valueChanges.pipe(distinctUntilChanged()).subscribe((id) => {
      this.suiteControl.setValue(null);
      if (id) {
        this.suitesService.listByFeature(id).subscribe({ next: (s) => this.suites.set(s) });
      } else {
        this.suites.set([]);
      }
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
    this.fetch();
  }

  protected openCreate(): void {
    this.drawer?.openCreate({
      featureId: this.featureControl.value ?? undefined,
      testSuiteId: this.suiteControl.value ?? undefined,
    });
  }

  protected openEdit(tc: ITestCase): void {
    this.drawer?.openEdit(tc);
  }

  protected onSaved(): void {
    this.fetch();
  }

  protected approve(tc: ITestCase): void {
    this.testCasesService.approve(tc._id).subscribe({
      next: () => {
        this.message.success('Approved');
        this.fetch();
      },
    });
  }

  protected reject(tc: ITestCase): void {
    this.testCasesService.reject(tc._id).subscribe({
      next: () => {
        this.message.success('Rejected');
        this.fetch();
      },
    });
  }

  protected needsReview(tc: ITestCase): void {
    this.testCasesService.needsReview(tc._id).subscribe({
      next: () => {
        this.message.success('Marked for review');
        this.fetch();
      },
    });
  }

  protected delete(tc: ITestCase): void {
    this.testCasesService.remove(tc._id).subscribe({
      next: () => {
        this.message.success('Test case deleted');
        this.fetch();
      },
    });
  }

  protected viewSteps(tc: ITestCase): void {
    this.modal.info({
      nzTitle: tc.title,
      nzWidth: 640,
      nzContent: this.buildStepsHtml(tc),
      nzOkText: 'Close',
    });
  }

  protected featureName(id: string): string {
    return this.features().find((f) => f._id === id)?.name ?? '—';
  }

  private buildStepsHtml(tc: ITestCase): string {
    const pre = (tc.preconditions ?? []).map((p) => `<li>${this.escape(p)}</li>`).join('');
    const steps = (tc.steps ?? []).map((s, i) => `<li>${i + 1}. ${this.escape(s)}</li>`).join('');
    return `
      <p><strong>Description</strong></p>
      <p>${this.escape(tc.description ?? '—')}</p>
      <p><strong>Preconditions</strong></p>
      <ul>${pre || '<li>—</li>'}</ul>
      <p><strong>Steps</strong></p>
      <ol>${steps || '<li>—</li>'}</ol>
      <p><strong>Expected result</strong></p>
      <p>${this.escape(tc.expectedResult)}</p>
    `;
  }

  private escape(value: string): string {
    return (value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
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
    if (this.suiteControl.value) filters['testSuiteId'] = this.suiteControl.value;
    if (this.priorityControl.value) filters['priority'] = this.priorityControl.value;
    if (this.typeControl.value) filters['type'] = this.typeControl.value;

    this.testCasesService
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
          this.testCases.set(res.items);
          this.total.set(res.total);
        },
        error: () => {
          this.testCases.set([]);
          this.total.set(0);
        },
      });
  }
}
