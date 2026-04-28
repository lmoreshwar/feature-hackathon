import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
  signal,
} from '@angular/core';
import { FormArray, FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';

import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { finalize } from 'rxjs';

import {
  CreateTestCasePayload,
  IFeature,
  ITestCase,
  ITestSuite,
  TEST_CASE_PRIORITIES,
  TEST_CASE_TYPES,
  TestCasePriority,
  TestCaseType,
  UpdateTestCasePayload,
} from '../../core/models';
import { TestCasesService } from '../../core/services/test-cases.service';
import { TestSuitesService } from '../../core/services/test-suites.service';
import { toErrorMessage } from '../../shared/utils/error.util';

@Component({
  selector: 'app-test-case-form-drawer',
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
    NzIconModule,
    NzSwitchModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './test-case-form-drawer.component.html',
  styles: [
    `
      .alert { margin-bottom: 12px; }
      .lines { display: flex; flex-direction: column; gap: 8px; margin-bottom: 8px; }
      .line-row { display: flex; align-items: center; gap: 8px; }
      .step-num { font-weight: 600; color: #4f46e5; width: 24px; text-align: right; }
    `,
  ],
})
export class TestCaseFormDrawerComponent {
  private readonly fb = inject(FormBuilder);
  private readonly testCasesService = inject(TestCasesService);
  private readonly suitesService = inject(TestSuitesService);
  private readonly message = inject(NzMessageService);

  protected readonly priorities = TEST_CASE_PRIORITIES;
  protected readonly types = TEST_CASE_TYPES;

  protected readonly visible = signal(false);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly availableSuites = signal<ITestSuite[]>([]);

  private editingId: string | null = null;

  @Input() features: IFeature[] = [];
  @Input() suites: ITestSuite[] = [];
  @Output() readonly saved = new EventEmitter<ITestCase>();

  protected readonly form = this.fb.nonNullable.group({
    featureId: this.fb.nonNullable.control('', [Validators.required]),
    testSuiteId: this.fb.nonNullable.control('', [Validators.required]),
    title: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(3)]),
    description: this.fb.nonNullable.control(''),
    expectedResult: this.fb.nonNullable.control('', [Validators.required]),
    testData: this.fb.nonNullable.control(''),
    tagsCsv: this.fb.nonNullable.control(''),
    comments: this.fb.nonNullable.control(''),
    automationFeasible: this.fb.nonNullable.control(false),
    priority: this.fb.nonNullable.control<TestCasePriority>('MEDIUM', [Validators.required]),
    type: this.fb.nonNullable.control<TestCaseType>('FUNCTIONAL', [Validators.required]),
    steps: this.fb.array<FormControl<string>>([]),
    preconditions: this.fb.array<FormControl<string>>([]),
  });

  get steps(): FormArray<FormControl<string>> {
    return this.form.controls.steps;
  }

  get preconditions(): FormArray<FormControl<string>> {
    return this.form.controls.preconditions;
  }

  openCreate(opts: { featureId?: string; testSuiteId?: string } = {}): void {
    this.editingId = null;
    this.errorMessage.set(null);
    this.form.reset({
      featureId: opts.featureId ?? '',
      testSuiteId: opts.testSuiteId ?? '',
      title: '',
      description: '',
      expectedResult: '',
      testData: '',
      tagsCsv: '',
      comments: '',
      automationFeasible: false,
      priority: 'MEDIUM',
      type: 'FUNCTIONAL',
    });
    this.steps.clear();
    this.preconditions.clear();
    this.addStep();
    if (opts.featureId) {
      this.loadSuitesFor(opts.featureId);
    } else {
      this.availableSuites.set(this.suites);
    }
    this.visible.set(true);
  }

  openEdit(tc: ITestCase): void {
    this.editingId = tc._id;
    this.errorMessage.set(null);
    this.form.reset({
      featureId: tc.featureId,
      testSuiteId: tc.testSuiteId,
      title: tc.title,
      description: tc.description ?? '',
      expectedResult: tc.expectedResult,
      testData: tc.testData ?? '',
      // Show user-facing tags but hide the auto-managed "Automation"
      // string — the toggle below is the source of truth for that.
      tagsCsv: (tc.tags ?? [])
        .filter((t) => t.toLowerCase() !== 'automation')
        .join(', '),
      comments: tc.comments ?? '',
      automationFeasible: !!tc.automationFeasible,
      priority: tc.priority,
      type: tc.type,
    });
    this.steps.clear();
    (tc.steps ?? []).forEach((s) => this.steps.push(this.fb.nonNullable.control(s)));
    if (this.steps.length === 0) this.addStep();
    this.preconditions.clear();
    (tc.preconditions ?? []).forEach((p) => this.preconditions.push(this.fb.nonNullable.control(p)));

    this.loadSuitesFor(tc.featureId);
    this.visible.set(true);
  }

  protected parseTags(csv: string): string[] {
    return (csv ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
      .slice(0, 8);
  }

  protected loadSuitesFor(featureId: string): void {
    this.suitesService.listByFeature(featureId).subscribe({
      next: (s) => this.availableSuites.set(s),
    });
  }

  protected onFeatureChange(id: string): void {
    if (id) this.loadSuitesFor(id);
  }

  protected addStep(): void {
    this.steps.push(this.fb.nonNullable.control(''));
  }

  protected removeStep(i: number): void {
    this.steps.removeAt(i);
  }

  protected addPrecondition(): void {
    this.preconditions.push(this.fb.nonNullable.control(''));
  }

  protected removePrecondition(i: number): void {
    this.preconditions.removeAt(i);
  }

  protected get isEditing(): boolean {
    return this.editingId !== null;
  }

  protected get drawerTitle(): string {
    return this.isEditing ? 'Edit test case' : 'New test case';
  }

  protected close(): void {
    if (this.submitting()) return;
    this.visible.set(false);
  }

  protected submit(): void {
    if (this.submitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const steps = (v.steps ?? []).map((s) => (s ?? '').trim()).filter(Boolean);
    const preconditions = (v.preconditions ?? []).map((p) => (p ?? '').trim()).filter(Boolean);

    if (steps.length === 0) {
      this.errorMessage.set('Please add at least one step.');
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    const request$ = this.isEditing
      ? this.testCasesService.update(this.editingId as string, this.toUpdate(v, steps, preconditions))
      : this.testCasesService.create(this.toCreate(v, steps, preconditions));

    request$.pipe(finalize(() => this.submitting.set(false))).subscribe({
      next: (saved) => {
        if (saved) {
          this.message.success(this.isEditing ? 'Test case updated' : 'Test case created');
          this.saved.emit(saved);
          this.visible.set(false);
        }
      },
      error: (e: unknown) => this.errorMessage.set(toErrorMessage(e)),
    });
  }

  private toCreate(
    v: ReturnType<typeof this.form.getRawValue>,
    steps: string[],
    preconditions: string[],
  ): CreateTestCasePayload {
    return {
      featureId: v.featureId,
      testSuiteId: v.testSuiteId,
      title: v.title.trim(),
      description: v.description.trim() || undefined,
      expectedResult: v.expectedResult.trim(),
      testData: v.testData.trim() || undefined,
      tags: this.parseTags(v.tagsCsv),
      comments: v.comments.trim() || undefined,
      automationFeasible: v.automationFeasible,
      priority: v.priority,
      type: v.type,
      steps,
      ...(preconditions.length ? { preconditions } : {}),
    };
  }

  private toUpdate(
    v: ReturnType<typeof this.form.getRawValue>,
    steps: string[],
    preconditions: string[],
  ): UpdateTestCasePayload {
    return {
      title: v.title.trim(),
      description: v.description.trim() || undefined,
      expectedResult: v.expectedResult.trim(),
      testData: v.testData.trim() || undefined,
      tags: this.parseTags(v.tagsCsv),
      comments: v.comments.trim() || undefined,
      automationFeasible: v.automationFeasible,
      priority: v.priority,
      type: v.type,
      steps,
      preconditions,
    };
  }
}
