import { ChangeDetectionStrategy, Component, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule, NzTableQueryParams } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { debounceTime, distinctUntilChanged, finalize, forkJoin } from 'rxjs';

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
    RouterLink,
    NzCardModule,
    NzCheckboxModule,
    NzDividerModule,
    NzTableModule,
    NzButtonModule,
    NzInputModule,
    NzIconModule,
    NzTagModule,
    NzEmptyModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzStatisticModule,
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

  // KPI counts (independent of current page filters / pagination — they
  // reflect the whole DB so the demo always shows real numbers).
  protected readonly totalAll = signal(0);
  protected readonly totalApproved = signal(0);
  protected readonly totalAutomation = signal(0);

  protected readonly searchControl = new FormControl<string>('', { nonNullable: true });
  protected readonly statusControl = new FormControl<TestCaseStatus | null>(null);
  protected readonly featureControl = new FormControl<string | null>(null);
  protected readonly suiteControl = new FormControl<string | null>(null);
  protected readonly priorityControl = new FormControl<TestCasePriority | null>(null);
  protected readonly typeControl = new FormControl<TestCaseType | null>(null);
  protected readonly automationControl = new FormControl<'all' | 'yes' | 'no'>('all', {
    nonNullable: true,
  });

  // Bulk-selection state (Set keeps lookup O(1) for the table row toggles).
  private readonly selectedIds = signal<Set<string>>(new Set());
  protected readonly selectedCount = computed(() => this.selectedIds().size);
  protected readonly bulkBusy = signal(false);
  protected readonly recomputing = signal(false);

  @ViewChild(TestCaseFormDrawerComponent) private drawer?: TestCaseFormDrawerComponent;

  ngOnInit(): void {
    this.searchControl.valueChanges.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => {
      this.pageIndex.set(1);
      this.fetch();
    });

    [this.statusControl, this.priorityControl, this.typeControl, this.suiteControl, this.automationControl].forEach(
      (c) =>
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
    this.refreshKpis();
  }

  // ---------- KPI counts ----------
  private refreshKpis(): void {
    const empty = { pageIndex: 1, pageSize: 1 } as const;
    forkJoin({
      all: this.testCasesService.search({ ...empty }),
      approved: this.testCasesService.search({
        ...empty,
        filters: { status: 'APPROVED' },
      }),
      automation: this.testCasesService.search({
        ...empty,
        filters: { automationFeasible: true },
      }),
    }).subscribe({
      next: ({ all, approved, automation }) => {
        this.totalAll.set(all.total ?? 0);
        this.totalApproved.set(approved.total ?? 0);
        this.totalAutomation.set(automation.total ?? 0);
      },
    });
  }

  // ---------- bulk selection ----------
  protected isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  protected toggleRow(id: string, checked: boolean): void {
    const next = new Set(this.selectedIds());
    if (checked) next.add(id);
    else next.delete(id);
    this.selectedIds.set(next);
  }

  protected get allSelected(): boolean {
    const items = this.testCases();
    if (items.length === 0) return false;
    const sel = this.selectedIds();
    return items.every((tc) => sel.has(tc._id));
  }

  protected get someSelected(): boolean {
    const items = this.testCases();
    const sel = this.selectedIds();
    const count = items.filter((tc) => sel.has(tc._id)).length;
    return count > 0 && count < items.length;
  }

  protected toggleAll(checked: boolean): void {
    const items = this.testCases();
    const next = new Set(this.selectedIds());
    if (checked) {
      items.forEach((tc) => next.add(tc._id));
    } else {
      items.forEach((tc) => next.delete(tc._id));
    }
    this.selectedIds.set(next);
  }

  protected clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  protected bulkApprove(): void {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0) return;
    this.bulkBusy.set(true);
    this.testCasesService
      .bulkApprove(ids)
      .pipe(finalize(() => this.bulkBusy.set(false)))
      .subscribe({
        next: (r) => {
          this.message.success(`Approved ${r.updated} test case(s)`);
          this.clearSelection();
          this.fetch();
          this.refreshKpis();
        },
      });
  }

  protected bulkReject(): void {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0) return;
    this.bulkBusy.set(true);
    this.testCasesService
      .bulkReject(ids)
      .pipe(finalize(() => this.bulkBusy.set(false)))
      .subscribe({
        next: (r) => {
          this.message.success(`Rejected ${r.updated} test case(s)`);
          this.clearSelection();
          this.fetch();
          this.refreshKpis();
        },
      });
  }

  /**
   * Re-runs the automation-feasibility heuristic on existing test cases
   * (scoped by the active feature/suite filter when set, otherwise the
   * whole DB) and refreshes the table + KPI cards. Useful after relaxing
   * the prompt rules so historical rows that were marked manual get
   * flipped back to automation when they qualify.
   */
  protected recomputeAutomation(): void {
    if (this.recomputing()) return;
    this.recomputing.set(true);
    const scope: { featureId?: string; testSuiteId?: string } = {};
    if (this.featureControl.value) scope.featureId = this.featureControl.value;
    if (this.suiteControl.value) scope.testSuiteId = this.suiteControl.value;

    this.testCasesService
      .recomputeAutomation(scope)
      .pipe(finalize(() => this.recomputing.set(false)))
      .subscribe({
        next: (r) => {
          if (r.changed === 0) {
            this.message.info(
              `Re-evaluated ${r.scanned} test case(s); nothing to change.`,
            );
          } else {
            this.message.success(
              `Re-evaluated ${r.scanned} test case(s); flipped ${r.changed} to match the new rules.`,
            );
          }
          this.fetch();
          this.refreshKpis();
        },
      });
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
        this.refreshKpis();
      },
    });
  }

  protected reject(tc: ITestCase): void {
    this.testCasesService.reject(tc._id).subscribe({
      next: () => {
        this.message.success('Rejected');
        this.fetch();
        this.refreshKpis();
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
        this.refreshKpis();
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
    const tags = (tc.tags ?? [])
      .map(
        (t) =>
          `<span style="display:inline-block;margin:0 4px 4px 0;padding:0 6px;border:1px solid #d9d9d9;border-radius:10px;font-size:11px;">${this.escape(t)}</span>`,
      )
      .join('');
    const automationBadge = tc.automationFeasible
      ? '<span style="display:inline-block;padding:1px 8px;background:#e6f4ff;color:#0958d9;border:1px solid #91caff;border-radius:10px;font-size:11px;">Automation feasible</span>'
      : '<span style="color:rgba(0,0,0,0.45);">Manual only</span>';
    return `
      <p><strong>Description</strong></p>
      <p>${this.escape(tc.description ?? '—')}</p>
      <p><strong>Automation</strong></p>
      <p>${automationBadge}</p>
      <p><strong>Tags</strong></p>
      <p>${tags || '—'}</p>
      <p><strong>Preconditions</strong></p>
      <ul>${pre || '<li>—</li>'}</ul>
      <p><strong>Steps</strong></p>
      <ol>${steps || '<li>—</li>'}</ol>
      <p><strong>Test data</strong></p>
      <pre style="white-space:pre-wrap;background:#fafafa;padding:8px;border-radius:4px;">${this.escape(tc.testData ?? '—')}</pre>
      <p><strong>Expected result</strong></p>
      <p>${this.escape(tc.expectedResult)}</p>
      <p><strong>Comments</strong></p>
      <p>${this.escape(tc.comments ?? '—')}</p>
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
    if (this.automationControl.value === 'yes') filters['automationFeasible'] = true;
    else if (this.automationControl.value === 'no') filters['automationFeasible'] = false;

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
