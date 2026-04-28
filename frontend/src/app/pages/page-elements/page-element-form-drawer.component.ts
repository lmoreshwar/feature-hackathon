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
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { finalize } from 'rxjs';

import {
  CreatePageElementPayload,
  IFeature,
  IPageElement,
  PAGE_ELEMENT_TYPES,
  PAGE_SELECTOR_TYPES,
  PageElementType,
  PageSelectorType,
  UpdatePageElementPayload,
} from '../../core/models';
import { PageElementsService } from '../../core/services/page-elements.service';
import { toErrorMessage } from '../../shared/utils/error.util';

interface ElementForm {
  featureId: FormControl<string>;
  pageUrl: FormControl<string>;
  pageName: FormControl<string>;
  elementName: FormControl<string>;
  elementType: FormControl<PageElementType>;
  selector: FormControl<string>;
  selectorType: FormControl<PageSelectorType>;
  isStable: FormControl<boolean>;
}

@Component({
  selector: 'app-page-element-form-drawer',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NzDrawerModule,
    NzFormModule,
    NzInputModule,
    NzSelectModule,
    NzSwitchModule,
    NzButtonModule,
    NzAlertModule,
    NzSpinModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './page-element-form-drawer.component.html',
})
export class PageElementFormDrawerComponent {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(PageElementsService);
  private readonly message = inject(NzMessageService);

  protected readonly elementTypes = PAGE_ELEMENT_TYPES;
  protected readonly selectorTypes = PAGE_SELECTOR_TYPES;

  protected readonly visible = signal(false);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  private editingId: string | null = null;

  @Input() features: IFeature[] = [];
  @Output() readonly saved = new EventEmitter<IPageElement>();

  protected readonly form = this.fb.nonNullable.group<ElementForm>({
    featureId: this.fb.nonNullable.control('', [Validators.required]),
    pageUrl: this.fb.nonNullable.control('', [Validators.required]),
    pageName: this.fb.nonNullable.control(''),
    elementName: this.fb.nonNullable.control('', [Validators.required]),
    elementType: this.fb.nonNullable.control<PageElementType>('BUTTON', [Validators.required]),
    selector: this.fb.nonNullable.control('', [Validators.required]),
    selectorType: this.fb.nonNullable.control<PageSelectorType>('CSS', [Validators.required]),
    isStable: this.fb.nonNullable.control(true),
  });

  openCreate(opts: { featureId?: string; pageUrl?: string } = {}): void {
    this.editingId = null;
    this.errorMessage.set(null);
    this.form.reset({
      featureId: opts.featureId ?? '',
      pageUrl: opts.pageUrl ?? '',
      pageName: '',
      elementName: '',
      elementType: 'BUTTON',
      selector: '',
      selectorType: 'CSS',
      isStable: true,
    });
    this.form.controls.featureId.enable();
    this.visible.set(true);
  }

  openEdit(el: IPageElement): void {
    this.editingId = el._id;
    this.errorMessage.set(null);
    this.form.reset({
      featureId: el.featureId,
      pageUrl: el.pageUrl,
      pageName: el.pageName ?? '',
      elementName: el.elementName,
      elementType: el.elementType,
      selector: el.selector,
      selectorType: el.selectorType,
      isStable: el.isStable,
    });
    this.form.controls.featureId.disable();
    this.visible.set(true);
  }

  protected get isEditing(): boolean {
    return this.editingId !== null;
  }

  protected get drawerTitle(): string {
    return this.isEditing ? 'Edit page element' : 'New page element';
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

    this.submitting.set(true);
    this.errorMessage.set(null);
    const v = this.form.getRawValue();

    const request$ = this.isEditing
      ? this.service.update(this.editingId as string, this.toUpdate(v))
      : this.service.create(this.toCreate(v));

    request$.pipe(finalize(() => this.submitting.set(false))).subscribe({
      next: (saved) => {
        if (saved) {
          this.message.success(this.isEditing ? 'Element updated' : 'Element created');
          this.saved.emit(saved);
          this.visible.set(false);
        }
      },
      error: (e: unknown) => this.errorMessage.set(toErrorMessage(e)),
    });
  }

  private toCreate(v: ReturnType<typeof this.form.getRawValue>): CreatePageElementPayload {
    return {
      featureId: v.featureId,
      pageUrl: v.pageUrl.trim(),
      pageName: v.pageName.trim() || undefined,
      elementName: v.elementName.trim(),
      elementType: v.elementType,
      selector: v.selector.trim(),
      selectorType: v.selectorType,
      isStable: v.isStable,
    };
  }

  private toUpdate(v: ReturnType<typeof this.form.getRawValue>): UpdatePageElementPayload {
    return {
      pageUrl: v.pageUrl.trim(),
      pageName: v.pageName.trim() || undefined,
      elementName: v.elementName.trim(),
      elementType: v.elementType,
      selector: v.selector.trim(),
      selectorType: v.selectorType,
      isStable: v.isStable,
    };
  }
}
