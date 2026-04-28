import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';

import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule, NzTableQueryParams } from 'ng-zorro-antd/table';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { Subject, distinctUntilChanged, finalize, switchMap, timer } from 'rxjs';

import {
  EXECUTION_PROVIDERS,
  EXECUTION_STATUSES,
  ExecutionProvider,
  ExecutionStatus,
  IFeature,
  ITestExecution,
  ITestSuite,
} from '../../core/models';
import { ExecutionsService } from '../../core/services/executions.service';
import { FeaturesService } from '../../core/services/features.service';
import { TestSuitesService } from '../../core/services/test-suites.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { StatusTagComponent } from '../../shared/components/status-tag/status-tag.component';
import { EpochPipe } from '../../shared/pipes/epoch.pipe';
import { toErrorMessage } from '../../shared/utils/error.util';

interface TriggerForm {
  featureId: FormControl<string>;
  testSuiteId: FormControl<string>;
  buildName: FormControl<string>;
  provider: FormControl<ExecutionProvider>;
}

const POLL_INTERVAL_MS = 4000;
const ACTIVE_STATUSES: ReadonlySet<ExecutionStatus> = new Set([
  'QUEUED',
  'RUNNING',
]);

@Component({
  selector: 'app-executions',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NzCardModule,
    NzFormModule,
    NzInputModule,
    NzSelectModule,
    NzButtonModule,
    NzAlertModule,
    NzGridModule,
    NzTableModule,
    NzIconModule,
    NzTooltipModule,
    NzEmptyModule,
    NzPopconfirmModule,
    EpochPipe,
    PageHeaderComponent,
    StatusTagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './executions.component.html',
  styleUrl: './executions.component.scss',
})
export class ExecutionsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly executionsService = inject(ExecutionsService);
  private readonly featuresService = inject(FeaturesService);
  private readonly suitesService = inject(TestSuitesService);
  private readonly message = inject(NzMessageService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly providers = EXECUTION_PROVIDERS;
  protected readonly statuses = EXECUTION_STATUSES;

  protected readonly features = signal<IFeature[]>([]);
  protected readonly suites = signal<ITestSuite[]>([]);
  protected readonly executions = signal<ITestExecution[]>([]);
  protected readonly loading = signal(false);
  protected readonly triggering = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly total = signal(0);
  protected readonly pageIndex = signal(1);
  protected readonly pageSize = signal(10);

  protected readonly statusFilter = new FormControl<ExecutionStatus | null>(null);
  protected readonly featureFilter = new FormControl<string | null>(null);

  protected readonly form = this.fb.nonNullable.group<TriggerForm>({
    featureId: this.fb.nonNullable.control('', [Validators.required]),
    testSuiteId: this.fb.nonNullable.control(''),
    buildName: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(2)]),
    provider: this.fb.nonNullable.control<ExecutionProvider>('BROWSERSTACK', [Validators.required]),
  });

  private readonly pollTrigger = new Subject<void>();

  ngOnInit(): void {
    this.loadFeatures();
    this.fetch();

    this.form.controls.featureId.valueChanges.pipe(distinctUntilChanged()).subscribe((id) => {
      this.form.controls.testSuiteId.setValue('');
      if (id) {
        this.suitesService.listByFeature(id).subscribe({ next: (s) => this.suites.set(s) });
      } else {
        this.suites.set([]);
      }
    });

    [this.statusFilter, this.featureFilter].forEach((c) =>
      c.valueChanges.pipe(distinctUntilChanged()).subscribe(() => {
        this.pageIndex.set(1);
        this.fetch();
      }),
    );

    // Auto-refresh while any execution is QUEUED/RUNNING. The runner mutates
    // the same execution document on the server (status/passed/failed/urls),
    // so we just re-fetch the visible page until everything is settled.
    this.pollTrigger
      .pipe(
        switchMap(() => timer(POLL_INTERVAL_MS, POLL_INTERVAL_MS)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        if (this.hasActiveBuild()) {
          this.fetch(true);
        }
      });
    this.pollTrigger.next();
  }

  protected hasActiveBuild(): boolean {
    return this.executions().some((e) => ACTIVE_STATUSES.has(e.status));
  }

  protected isHttpUrl(value: string | undefined | null): boolean {
    if (!value) return false;
    return /^https?:\/\//i.test(value.trim());
  }

  protected onQueryParamsChange(p: NzTableQueryParams): void {
    this.pageIndex.set(p.pageIndex);
    this.pageSize.set(p.pageSize);
    this.fetch();
  }

  protected refresh(): void {
    this.fetch();
  }

  protected trigger(): void {
    if (this.triggering()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.triggering.set(true);
    this.errorMessage.set(null);

    this.executionsService
      .trigger({
        featureId: v.featureId,
        ...(v.testSuiteId ? { testSuiteId: v.testSuiteId } : {}),
        buildName: v.buildName.trim(),
        provider: v.provider,
      })
      .pipe(finalize(() => this.triggering.set(false)))
      .subscribe({
        next: (saved) => {
          if (saved) {
            const where =
              saved.provider === 'BROWSERSTACK'
                ? 'queued on BrowserStack'
                : 'queued';
            this.message.success(`Build "${saved.buildName}" ${where}`);
            this.form.patchValue({ buildName: '' });
            this.fetch();
            this.pollTrigger.next();
          }
        },
        error: (e: unknown) => this.errorMessage.set(toErrorMessage(e)),
      });
  }

  protected cancel(e: ITestExecution): void {
    this.executionsService.cancel(e._id).subscribe({
      next: () => {
        this.message.success('Execution cancelled');
        this.fetch();
      },
    });
  }

  protected delete(e: ITestExecution): void {
    this.executionsService.remove(e._id).subscribe({
      next: () => {
        this.message.success('Execution deleted');
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

  private fetch(silent = false): void {
    if (!silent) this.loading.set(true);
    const filters: Record<string, unknown> = {};
    if (this.statusFilter.value) filters['status'] = this.statusFilter.value;
    if (this.featureFilter.value) filters['featureId'] = this.featureFilter.value;

    this.executionsService
      .search({
        pageIndex: this.pageIndex(),
        pageSize: this.pageSize(),
        filters,
        sort: { createdAt: 'desc' },
      })
      .pipe(finalize(() => !silent && this.loading.set(false)))
      .subscribe({
        next: (res) => {
          this.executions.set(res.items);
          this.total.set(res.total);
        },
        error: () => {
          if (!silent) {
            this.executions.set([]);
            this.total.set(0);
          }
        },
      });
  }
}
