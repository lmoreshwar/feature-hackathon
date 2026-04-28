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
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule, NzTableQueryParams } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
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
import {
  ExecutionsService,
  GitRepo,
  GitWorkflow,
} from '../../core/services/executions.service';
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

interface GitTriggerForm {
  featureId: FormControl<string>;
  branch: FormControl<string>;
  buildName: FormControl<string>;
  repoUrl: FormControl<string>;
  testPath: FormControl<string>;
}

interface WorkflowTriggerForm {
  featureId: FormControl<string>;
  repo: FormControl<string>;
  branch: FormControl<string>;
  workflowFile: FormControl<string>;
  buildName: FormControl<string>;
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
    NzTabsModule,
    NzStatisticModule,
    NzTagModule,
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

  // -- "Run from Git" tab state -----------------------------------------
  protected readonly gitForm = this.fb.nonNullable.group<GitTriggerForm>({
    featureId: this.fb.nonNullable.control('', [Validators.required]),
    branch: this.fb.nonNullable.control('', [Validators.required]),
    buildName: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(2)]),
    repoUrl: this.fb.nonNullable.control(''),
    testPath: this.fb.nonNullable.control(''),
  });
  protected readonly gitBranches = signal<string[]>([]);
  protected readonly gitBranchesLoading = signal(false);
  protected readonly gitBranchesError = signal<string | null>(null);
  protected readonly gitTriggering = signal(false);
  protected readonly lastGitExecution = signal<ITestExecution | null>(null);

  // -- "Run on BrowserStack" (unified Repo → Branch → yml) state --------
  protected readonly workflowForm = this.fb.nonNullable.group<WorkflowTriggerForm>({
    featureId: this.fb.nonNullable.control('', [Validators.required]),
    repo: this.fb.nonNullable.control('', [Validators.required]),
    branch: this.fb.nonNullable.control('', [Validators.required]),
    // yml is OPTIONAL: when picked we use workflow_dispatch; when empty we
    // fall back to clone + `npx playwright test` on the backend host.
    workflowFile: this.fb.nonNullable.control(''),
    buildName: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(2)]),
  });
  protected readonly repos = signal<GitRepo[]>([]);
  protected readonly reposLoading = signal(false);
  protected readonly reposError = signal<string | null>(null);
  protected readonly workflows = signal<GitWorkflow[]>([]);
  protected readonly workflowsLoading = signal(false);
  protected readonly workflowsError = signal<string | null>(null);
  protected readonly workflowTriggering = signal(false);
  protected readonly lastWorkflowExecution = signal<ITestExecution | null>(null);

  private readonly pollTrigger = new Subject<void>();

  ngOnInit(): void {
    this.loadFeatures();
    this.fetch();
    // Cascade: load repos → onRepoSelected loads branches + workflows.
    this.loadRepos();

    this.form.controls.featureId.valueChanges.pipe(distinctUntilChanged()).subscribe((id) => {
      this.form.controls.testSuiteId.setValue('');
      if (id) {
        this.suitesService.listByFeature(id).subscribe({ next: (s) => this.suites.set(s) });
      } else {
        this.suites.set([]);
      }
    });

    // Repo change → reset & reload branches + workflows scoped to that repo.
    this.workflowForm.controls.repo.valueChanges
      .pipe(distinctUntilChanged())
      .subscribe((repo) => {
        this.workflowForm.patchValue({ branch: '', workflowFile: '' });
        this.gitBranches.set([]);
        this.workflows.set([]);
        if (repo) {
          this.loadGitBranches(repo);
          this.loadWorkflows(repo);
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

  protected loadRepos(): void {
    this.reposLoading.set(true);
    this.reposError.set(null);
    this.executionsService
      .listGitRepos()
      .pipe(finalize(() => this.reposLoading.set(false)))
      .subscribe({
        next: (list) => {
          this.repos.set(list);
          if (!this.workflowForm.controls.repo.value && list.length) {
            // Default to first (the saved repo is hoisted to the top).
            this.workflowForm.patchValue({ repo: list[0].fullName });
          }
        },
        error: (e: unknown) => this.reposError.set(toErrorMessage(e)),
      });
  }

  protected loadGitBranches(repo?: string): void {
    this.gitBranchesLoading.set(true);
    this.gitBranchesError.set(null);
    this.executionsService
      .listGitBranches(repo)
      .pipe(finalize(() => this.gitBranchesLoading.set(false)))
      .subscribe({
        next: (branches) => {
          this.gitBranches.set(branches);
          // Auto-select first branch (saved default is hoisted to the top).
          if (!this.workflowForm.controls.branch.value && branches.length) {
            this.workflowForm.patchValue({ branch: branches[0] });
          }
        },
        error: (e: unknown) => this.gitBranchesError.set(toErrorMessage(e)),
      });
  }

  protected triggerFromGit(): void {
    if (this.gitTriggering()) return;
    if (this.gitForm.invalid) {
      this.gitForm.markAllAsTouched();
      return;
    }
    const v = this.gitForm.getRawValue();
    this.gitTriggering.set(true);
    this.errorMessage.set(null);

    this.executionsService
      .runFromGit({
        featureId: v.featureId,
        branch: v.branch.trim(),
        buildName: v.buildName.trim(),
        ...(v.repoUrl.trim() ? { repoUrl: v.repoUrl.trim() } : {}),
        ...(v.testPath.trim() ? { testPath: v.testPath.trim() } : {}),
      })
      .pipe(finalize(() => this.gitTriggering.set(false)))
      .subscribe({
        next: (saved) => {
          if (saved) {
            this.lastGitExecution.set(saved);
            this.message.success(
              `Cloning ${v.branch} & launching Playwright on BrowserStack…`,
            );
            this.gitForm.patchValue({ buildName: '' });
            this.fetch();
            this.pollTrigger.next();
          }
        },
        error: (e: unknown) => this.errorMessage.set(toErrorMessage(e)),
      });
  }

  protected loadWorkflows(repo?: string): void {
    this.workflowsLoading.set(true);
    this.workflowsError.set(null);
    this.executionsService
      .listGitWorkflows(repo)
      .pipe(finalize(() => this.workflowsLoading.set(false)))
      .subscribe({
        next: (list) => this.workflows.set(list),
        error: (e: unknown) => this.workflowsError.set(toErrorMessage(e)),
      });
  }

  /**
   * Unified trigger:
   * - When a yml workflow file is selected → fire GitHub Actions
   *   `workflow_dispatch` and track the run / BrowserStack sessions.
   * - When yml is empty → clone the repo on the backend host and run
   *   `npx playwright test` directly. Same KPI card either way.
   */
  protected triggerWorkflow(): void {
    if (this.workflowTriggering()) return;
    if (this.workflowForm.invalid) {
      this.workflowForm.markAllAsTouched();
      return;
    }
    const v = this.workflowForm.getRawValue();
    this.workflowTriggering.set(true);
    this.errorMessage.set(null);

    const finishOk = (saved: ITestExecution | null, label: string) => {
      if (saved) {
        this.lastWorkflowExecution.set(saved);
        this.message.success(label);
        this.workflowForm.patchValue({ buildName: '' });
        this.fetch();
        this.pollTrigger.next();
      }
    };

    if (v.workflowFile) {
      this.executionsService
        .runWorkflow({
          featureId: v.featureId,
          repo: v.repo,
          workflowFile: v.workflowFile,
          branch: v.branch.trim(),
          buildName: v.buildName.trim(),
        })
        .pipe(finalize(() => this.workflowTriggering.set(false)))
        .subscribe({
          next: (saved) =>
            finishOk(saved, `Dispatched ${v.workflowFile} on ${v.branch} — tracking the run…`),
          error: (e: unknown) => this.errorMessage.set(toErrorMessage(e)),
        });
    } else {
      // Fallback: clone repo and run `npx playwright test` directly.
      const repoUrl = this.repoCloneUrlOf(v.repo);
      this.executionsService
        .runFromGit({
          featureId: v.featureId,
          branch: v.branch.trim(),
          buildName: v.buildName.trim(),
          ...(repoUrl ? { repoUrl } : {}),
        })
        .pipe(finalize(() => this.workflowTriggering.set(false)))
        .subscribe({
          next: (saved) =>
            finishOk(saved, `Cloning ${v.repo} @ ${v.branch} & running Playwright…`),
          error: (e: unknown) => this.errorMessage.set(toErrorMessage(e)),
        });
    }
  }

  protected workflowShortName(path: string): string {
    return path.split('/').pop() ?? path;
  }

  protected repoCloneUrlOf(fullName: string): string | null {
    const r = this.repos().find((x) => x.fullName === fullName);
    return r ? `${r.htmlUrl}.git` : null;
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
          // Keep the "Run from Git" / "Workflow" result cards live by
          // re-syncing the most recently triggered execution from the
          // polled list.
          const trackedGit = this.lastGitExecution();
          if (trackedGit) {
            const fresh = res.items.find((i) => i._id === trackedGit._id);
            if (fresh) this.lastGitExecution.set(fresh);
          }
          const trackedWf = this.lastWorkflowExecution();
          if (trackedWf) {
            const fresh = res.items.find((i) => i._id === trackedWf._id);
            if (fresh) this.lastWorkflowExecution.set(fresh);
          }
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
