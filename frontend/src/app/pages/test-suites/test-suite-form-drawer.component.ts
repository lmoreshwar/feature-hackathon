import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';

import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { finalize } from 'rxjs';

import {
  CreateTestSuitePayload,
  IFeature,
  ITestSuite,
  TEST_SUITE_STATUSES,
  TestSuiteStatus,
  UpdateTestSuitePayload,
} from '../../core/models';
import { TestSuitesService } from '../../core/services/test-suites.service';
import { toErrorMessage } from '../../shared/utils/error.util';

interface SuiteForm {
  featureId: FormControl<string>;
  moduleName: FormControl<string>;
  description: FormControl<string>;
  version: FormControl<string>;
  status: FormControl<TestSuiteStatus>;
  jiraId: FormControl<string>;
  confluenceUrl: FormControl<string>;
}

@Component({
  selector: 'app-test-suite-form-drawer',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NzDrawerModule,
    NzFormModule,
    NzInputModule,
    NzSelectModule,
    NzButtonModule,
    NzAlertModule,
    NzSpinModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './test-suite-form-drawer.component.html',
})
export class TestSuiteFormDrawerComponent {
  private readonly fb = inject(FormBuilder);
  private readonly suitesService = inject(TestSuitesService);
  private readonly message = inject(NzMessageService);

  protected readonly statuses = TEST_SUITE_STATUSES;
  protected readonly visible = signal(false);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  private editingId: string | null = null;

  @Input() features: IFeature[] = [];
  @Output() readonly saved = new EventEmitter<ITestSuite>();

  protected readonly form = this.fb.nonNullable.group<SuiteForm>({
    featureId: this.fb.nonNullable.control('', [Validators.required]),
    moduleName: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(2)]),
    description: this.fb.nonNullable.control(''),
    version: this.fb.nonNullable.control('1.0.0'),
    status: this.fb.nonNullable.control<TestSuiteStatus>('DRAFT', [Validators.required]),
    jiraId: this.fb.nonNullable.control(''),
    confluenceUrl: this.fb.nonNullable.control(''),
  });

  openCreate(featureId?: string): void {
    this.editingId = null;
    this.errorMessage.set(null);
    this.form.reset({
      featureId: featureId ?? '',
      moduleName: '',
      description: '',
      version: '1.0.0',
      status: 'DRAFT',
      jiraId: '',
      confluenceUrl: '',
    });
    this.form.controls.featureId.enable();
    this.form.controls.status.disable({ emitEvent: false });
    this.visible.set(true);
  }

  openEdit(suite: ITestSuite): void {
    this.editingId = suite._id;
    this.errorMessage.set(null);
    this.form.reset({
      featureId: suite.featureId,
      moduleName: suite.moduleName,
      description: suite.description ?? '',
      version: suite.version ?? '1.0.0',
      status: suite.status,
      jiraId: suite.referenceInfo?.jiraId ?? '',
      confluenceUrl: suite.referenceInfo?.confluenceUrl ?? '',
    });
    this.form.controls.featureId.disable();
    this.form.controls.status.enable({ emitEvent: false });
    this.visible.set(true);
  }

  protected get isEditing(): boolean {
    return this.editingId !== null;
  }

  protected get drawerTitle(): string {
    return this.isEditing ? 'Edit test suite' : 'New test suite';
  }

  protected close(): void {
    if (this.submitting()) return;
    this.visible.set(false);
  }

  protected submit(): void {
    if (this.submitting()) return;
    if (this.form.invalid) {
      Object.values(this.form.controls).forEach((c) => {
        c.markAsDirty();
        c.updateValueAndValidity({ onlySelf: true });
      });
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);
    const value = this.form.getRawValue();

    const referenceInfo = {
      ...(value.jiraId.trim() ? { jiraId: value.jiraId.trim() } : {}),
      ...(value.confluenceUrl.trim() ? { confluenceUrl: value.confluenceUrl.trim() } : {}),
    };
    const hasRef = Object.keys(referenceInfo).length > 0;

    const request$ = this.isEditing
      ? this.suitesService.update(this.editingId as string, this.toUpdate(value, hasRef ? referenceInfo : undefined))
      : this.suitesService.create(this.toCreate(value, hasRef ? referenceInfo : undefined));

    request$.pipe(finalize(() => this.submitting.set(false))).subscribe({
      next: (saved) => {
        if (saved) {
          this.message.success(this.isEditing ? 'Test suite updated' : 'Test suite created');
          this.saved.emit(saved);
          this.visible.set(false);
        }
      },
      error: (e: unknown) => this.errorMessage.set(toErrorMessage(e)),
    });
  }

  private toCreate(
    v: ReturnType<typeof this.form.getRawValue>,
    ref?: Record<string, string>,
  ): CreateTestSuitePayload {
    return {
      featureId: v.featureId,
      moduleName: v.moduleName.trim(),
      description: v.description.trim() || undefined,
      version: v.version.trim() || '1.0.0',
      ...(ref ? { referenceInfo: ref } : {}),
    };
  }

  private toUpdate(
    v: ReturnType<typeof this.form.getRawValue>,
    ref?: Record<string, string>,
  ): UpdateTestSuitePayload {
    return {
      moduleName: v.moduleName.trim(),
      description: v.description.trim() || undefined,
      version: v.version.trim() || undefined,
      status: v.status,
      ...(ref ? { referenceInfo: ref } : {}),
    };
  }
}
