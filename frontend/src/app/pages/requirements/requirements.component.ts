import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
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
import { RequirementsService } from '../../core/services/requirements.service';
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
  private readonly requirementsService = inject(RequirementsService);
  private readonly featuresService = inject(FeaturesService);
  private readonly suitesService = inject(TestSuitesService);
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

  protected featureName(id: string): string {
    return this.features().find((f) => f._id === id)?.name ?? '—';
  }

  protected describe(r: IRequirementSource): string {
    if (r.jiraId) return `Jira: ${r.jiraId}`;
    if (r.confluenceUrl) return `Confluence: ${r.confluenceUrl}`;
    if (r.requirementText) return r.requirementText;
    return '—';
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
