import { HttpErrorResponse } from '@angular/common/http';
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
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { finalize } from 'rxjs';

import { formatError } from '../../core/interceptors/error.interceptor';
import {
  CreateFeaturePayload,
  FEATURE_STATUSES,
  FeatureRecord,
  FeatureStatus,
  UpdateFeaturePayload,
} from './features.models';
import { FeaturesService } from './features.service';

interface FeatureForm {
  name: FormControl<string>;
  description: FormControl<string>;
  status: FormControl<FeatureStatus>;
  totalSuites: FormControl<number | null>;
  totalTestCases: FormControl<number | null>;
  coveragePercentage: FormControl<number | null>;
}

interface FeatureFormValue {
  name: string;
  description: string;
  status: FeatureStatus;
  totalSuites: number | null;
  totalTestCases: number | null;
  coveragePercentage: number | null;
}

@Component({
  selector: 'app-feature-form-drawer',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NzDrawerModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzButtonModule,
    NzAlertModule,
    NzSpinModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './feature-form-drawer.component.html',
  styleUrl: './feature-form-drawer.component.scss',
})
export class FeatureFormDrawerComponent {
  private readonly fb = inject(FormBuilder);
  private readonly featuresService = inject(FeaturesService);
  private readonly message = inject(NzMessageService);

  protected readonly statuses = FEATURE_STATUSES;

  protected readonly visible = signal(false);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  private editingId: string | null = null;

  /** Emits the saved feature after a successful create or update. */
  @Output() readonly saved = new EventEmitter<FeatureRecord>();

  /** Width of the drawer in pixels. Defaults to 480 for a comfortable form size. */
  @Input() drawerWidth = 480;

  protected readonly form = this.fb.nonNullable.group<FeatureForm>({
    name: this.fb.nonNullable.control('', {
      validators: [Validators.required, Validators.minLength(2)],
    }),
    description: this.fb.nonNullable.control(''),
    status: this.fb.nonNullable.control<FeatureStatus>('DRAFT', {
      validators: [Validators.required],
    }),
    totalSuites: this.fb.control<number | null>(null, [Validators.min(0)]),
    totalTestCases: this.fb.control<number | null>(null, [Validators.min(0)]),
    coveragePercentage: this.fb.control<number | null>(null, [
      Validators.min(0),
      Validators.max(100),
    ]),
  });

  openCreate(): void {
    this.editingId = null;
    this.errorMessage.set(null);
    this.form.reset({
      name: '',
      description: '',
      status: 'DRAFT',
      totalSuites: null,
      totalTestCases: null,
      coveragePercentage: null,
    });
    this.form.controls.status.disable({ emitEvent: false });
    this.visible.set(true);
  }

  openEdit(feature: FeatureRecord): void {
    this.editingId = feature._id;
    this.errorMessage.set(null);
    this.form.reset({
      name: feature.name,
      description: feature.description ?? '',
      status: feature.status,
      totalSuites: feature.totalSuites ?? null,
      totalTestCases: feature.totalTestCases ?? null,
      coveragePercentage: feature.coveragePercentage ?? null,
    });
    this.form.controls.status.enable({ emitEvent: false });
    this.visible.set(true);
  }

  protected close(): void {
    if (this.submitting()) {
      return;
    }
    this.visible.set(false);
  }

  protected get isEditing(): boolean {
    return this.editingId !== null;
  }

  protected get drawerTitle(): string {
    return this.isEditing ? 'Edit feature' : 'New feature';
  }

  protected submit(): void {
    if (this.submitting()) {
      return;
    }

    if (this.form.invalid) {
      Object.values(this.form.controls).forEach((control) => {
        control.markAsDirty();
        control.updateValueAndValidity({ onlySelf: true });
      });
      return;
    }

    this.errorMessage.set(null);
    this.submitting.set(true);

    const value = this.form.getRawValue();
    const description = value.description.trim();

    const request$ = this.isEditing
      ? this.featuresService.update(this.editingId as string, this.toUpdatePayload(value, description))
      : this.featuresService.create(this.toCreatePayload(value, description));

    request$.pipe(finalize(() => this.submitting.set(false))).subscribe({
      next: (saved) => {
        if (saved) {
          this.message.success(this.isEditing ? 'Feature updated' : 'Feature created');
          this.saved.emit(saved);
          this.visible.set(false);
        }
      },
      error: (error: unknown) => {
        this.errorMessage.set(this.toMessage(error));
      },
    });
  }

  private toCreatePayload(value: FeatureFormValue, description: string): CreateFeaturePayload {
    return {
      name: value.name.trim(),
      ...(description ? { description } : {}),
    };
  }

  private toUpdatePayload(value: FeatureFormValue, description: string): UpdateFeaturePayload {
    return {
      name: value.name.trim(),
      description,
      status: value.status,
      ...(value.totalSuites !== null ? { totalSuites: value.totalSuites } : {}),
      ...(value.totalTestCases !== null ? { totalTestCases: value.totalTestCases } : {}),
      ...(value.coveragePercentage !== null
        ? { coveragePercentage: value.coveragePercentage }
        : {}),
    };
  }

  private toMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      return formatError(error);
    }
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return 'Something went wrong. Please try again.';
  }
}
