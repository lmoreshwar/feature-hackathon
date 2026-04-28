import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

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
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { distinctUntilChanged, finalize } from 'rxjs';

import {
  CreateRequirementPayload,
  IFeature,
  IRequirementSource,
  ITestSuite,
  REQUIREMENT_STATUSES,
  RequirementStatus,
} from '../../core/models';
import { FeaturesService } from '../../core/services/features.service';
import {
  IntegrationsService,
  JiraTicketResult,
  JiraTicketSummary,
} from '../../core/services/integrations.service';
import {
  GenerateTestCasesResult,
  RequirementsService,
} from '../../core/services/requirements.service';
import { TestSuitesService } from '../../core/services/test-suites.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { StatusTagComponent } from '../../shared/components/status-tag/status-tag.component';
import { EpochPipe } from '../../shared/pipes/epoch.pipe';
import { toErrorMessage } from '../../shared/utils/error.util';

interface RequirementForm {
  featureId: FormControl<string>;
  testSuiteId: FormControl<string>;
  jiraId: FormControl<string>;
  confluenceUrl: FormControl<string>;
  requirementText: FormControl<string>;
}

@Component({
  selector: 'app-requirements',
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
    NzTagModule,
    NzIconModule,
    NzTooltipModule,
    NzPopconfirmModule,
    NzEmptyModule,
    NzTabsModule,
    EpochPipe,
    PageHeaderComponent,
    StatusTagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './requirements.component.html',
  styleUrl: './requirements.component.scss',
})
export class RequirementsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly requirementsService = inject(RequirementsService);
  private readonly featuresService = inject(FeaturesService);
  private readonly suitesService = inject(TestSuitesService);
  private readonly integrationsService = inject(IntegrationsService);
  private readonly message = inject(NzMessageService);

  protected readonly statuses = REQUIREMENT_STATUSES;
  protected readonly features = signal<IFeature[]>([]);
  protected readonly suites = signal<ITestSuite[]>([]);

  protected readonly requirements = signal<IRequirementSource[]>([]);
  protected readonly loading = signal(false);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly total = signal(0);
  protected readonly pageIndex = signal(1);
  protected readonly pageSize = signal(10);

  protected readonly statusFilter = new FormControl<RequirementStatus | null>(null);
  protected readonly featureFilter = new FormControl<string | null>(null);

  protected readonly jiraLoading = signal(false);
  protected readonly jiraError = signal<string | null>(null);
  protected readonly jiraTicket = signal<JiraTicketResult | null>(null);

  protected readonly generatingId = signal<string | null>(null);
  protected readonly lastGeneration = signal<GenerateTestCasesResult | null>(null);

  protected readonly form = this.fb.nonNullable.group<RequirementForm>({
    featureId: this.fb.nonNullable.control('', [Validators.required]),
    testSuiteId: this.fb.nonNullable.control(''),
    jiraId: this.fb.nonNullable.control(''),
    confluenceUrl: this.fb.nonNullable.control(''),
    requirementText: this.fb.nonNullable.control(''),
  });

  ngOnInit(): void {
    this.statusFilter.valueChanges.pipe(distinctUntilChanged()).subscribe(() => {
      this.pageIndex.set(1);
      this.fetch();
    });
    this.featureFilter.valueChanges.pipe(distinctUntilChanged()).subscribe(() => {
      this.pageIndex.set(1);
      this.fetch();
    });
    this.form.controls.featureId.valueChanges.pipe(distinctUntilChanged()).subscribe((id) => {
      this.form.controls.testSuiteId.setValue('');
      if (id) {
        this.suitesService.listByFeature(id).subscribe({
          next: (s) => this.suites.set(s),
        });
      } else {
        this.suites.set([]);
      }
    });
    this.form.controls.jiraId.valueChanges.pipe(distinctUntilChanged()).subscribe((v) => {
      const t = this.jiraTicket();
      if (t && (v || '').trim().toUpperCase() !== t.primary.key) {
        this.clearJiraPreview();
      }
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

  protected submit(): void {
    if (this.submitting()) return;
    this.errorMessage.set(null);

    const v = this.form.getRawValue();
    if (!v.jiraId.trim() && !v.confluenceUrl.trim() && !v.requirementText.trim()) {
      this.errorMessage.set('Provide at least one of Jira ID, Confluence URL, or requirement text.');
      return;
    }
    if (this.form.invalid) {
      this.form.controls.featureId.markAsDirty();
      this.form.controls.featureId.updateValueAndValidity();
      return;
    }

    const payload: CreateRequirementPayload = {
      featureId: v.featureId,
      ...(v.testSuiteId ? { testSuiteId: v.testSuiteId } : {}),
      ...(v.jiraId.trim() ? { jiraId: v.jiraId.trim() } : {}),
      ...(v.confluenceUrl.trim() ? { confluenceUrl: v.confluenceUrl.trim() } : {}),
      ...(v.requirementText.trim() ? { requirementText: v.requirementText.trim() } : {}),
    };

    this.submitting.set(true);
    this.requirementsService
      .create(payload)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (saved) => {
          if (saved) {
            this.message.success('Requirement created');
            this.form.reset({
              featureId: v.featureId,
              testSuiteId: '',
              jiraId: '',
              confluenceUrl: '',
              requirementText: '',
            });
            this.clearJiraPreview();
            this.fetch();
          }
        },
        error: (e: unknown) => this.errorMessage.set(toErrorMessage(e)),
      });
  }

  protected markProcessed(r: IRequirementSource): void {
    this.requirementsService.markProcessed(r._id).subscribe({
      next: () => {
        this.message.success('Marked as PROCESSED');
        this.fetch();
      },
    });
  }

  protected markFailed(r: IRequirementSource): void {
    this.requirementsService.markFailed(r._id).subscribe({
      next: () => {
        this.message.success('Marked as FAILED');
        this.fetch();
      },
    });
  }

  protected delete(r: IRequirementSource): void {
    this.requirementsService.remove(r._id).subscribe({
      next: () => {
        this.message.success('Requirement deleted');
        this.fetch();
      },
    });
  }

  protected generateTestCases(r: IRequirementSource): void {
    if (this.generatingId()) return;

    this.generatingId.set(r._id);
    this.lastGeneration.set(null);
    const loadingId = this.message.loading(
      'Generating test cases from this requirement…',
      { nzDuration: 0 },
    ).messageId;

    this.requirementsService
      .generateTestCases(r._id)
      .pipe(finalize(() => {
        this.generatingId.set(null);
        this.message.remove(loadingId);
      }))
      .subscribe({
        next: (result) => {
          this.lastGeneration.set(result);
          if (result.generated > 0) {
            this.message.success(
              `Generated ${result.generated} test case${result.generated === 1 ? '' : 's'} (${result.source.toLowerCase()})`,
            );
            for (const w of result.warnings ?? []) {
              this.message.warning(w);
            }
          } else {
            this.message.warning('No test cases were generated.');
          }
          this.fetch();
        },
        error: (e: unknown) => {
          this.message.error(toErrorMessage(e));
        },
      });
  }

  protected openGeneratedTestCases(r: GenerateTestCasesResult): void {
    void this.router.navigate(['/test-cases'], {
      queryParams: { featureId: r.requirement.featureId },
    });
  }

  protected dismissGeneration(): void {
    this.lastGeneration.set(null);
  }

  protected featureName(id: string): string {
    return this.features().find((f) => f._id === id)?.name ?? '—';
  }

  protected describe(r: IRequirementSource): string {
    if (r.jiraId) return `Jira: ${r.jiraId}`;
    if (r.confluenceUrl) return `Confluence: ${r.confluenceUrl}`;
    if (r.requirementText) return r.requirementText;
    return '—';
  }

  protected fetchJira(): void {
    if (this.jiraLoading()) return;
    const key = (this.form.controls.jiraId.value || '').trim();
    if (!key) {
      this.jiraError.set('Enter a Jira ticket key first (e.g. PROJ-123).');
      return;
    }

    this.jiraError.set(null);
    this.jiraLoading.set(true);
    this.integrationsService
      .fetchJiraIssue(key)
      .pipe(finalize(() => this.jiraLoading.set(false)))
      .subscribe({
        next: (result) => {
          this.jiraTicket.set(result);
          this.message.success(
            `Loaded ${result.primary.key} (${result.related.length} related)`,
          );
        },
        error: (e: unknown) => {
          this.jiraTicket.set(null);
          this.jiraError.set(toErrorMessage(e));
        },
      });
  }

  protected clearJiraPreview(): void {
    this.jiraTicket.set(null);
    this.jiraError.set(null);
  }

  protected useJiraAsRequirementText(t: JiraTicketSummary | null): void {
    const ticket = this.jiraTicket();
    if (!ticket) return;
    const target = t ?? ticket.primary;
    const desc = (ticket.primary.description ?? '').trim();
    const lines = [
      `[${target.key}] ${target.summary}`,
      ...(target === ticket.primary && desc ? ['', desc] : []),
    ];
    this.form.controls.requirementText.setValue(lines.join('\n'));
    this.form.controls.requirementText.markAsDirty();
    this.message.success('Copied Jira summary into requirement text');
  }

  protected relationColor(relation: JiraTicketSummary['relation']): string {
    switch (relation) {
      case 'PARENT':
        return 'purple';
      case 'SUBTASK':
        return 'blue';
      case 'LINKED':
        return 'gold';
      default:
        return 'green';
    }
  }

  private loadFeatures(): void {
    this.featuresService.search({ pageIndex: 1, pageSize: 200 }).subscribe({
      next: (res) => this.features.set(res.items),
    });
  }

  private fetch(): void {
    this.loading.set(true);
    const filters: Record<string, unknown> = {};
    if (this.statusFilter.value) filters['status'] = this.statusFilter.value;
    if (this.featureFilter.value) filters['featureId'] = this.featureFilter.value;

    this.requirementsService
      .search({
        pageIndex: this.pageIndex(),
        pageSize: this.pageSize(),
        filters,
        sort: { createdAt: 'desc' },
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => {
          this.requirements.set(res.items);
          this.total.set(res.total);
        },
        error: () => {
          this.requirements.set([]);
          this.total.set(0);
        },
      });
  }
}
