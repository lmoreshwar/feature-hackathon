import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';

import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { distinctUntilChanged, finalize, forkJoin } from 'rxjs';

import {
  IFeature,
  IPageElement,
  ITestCase,
  ITestCaseElementMapping,
  ITestSuite,
  SCRIPT_TYPES,
  ScriptType,
} from '../../core/models';
import { FeaturesService } from '../../core/services/features.service';
import { MappingsService } from '../../core/services/mappings.service';
import { PageElementsService } from '../../core/services/page-elements.service';
import { TestCasesService } from '../../core/services/test-cases.service';
import { TestSuitesService } from '../../core/services/test-suites.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { StatusTagComponent } from '../../shared/components/status-tag/status-tag.component';
import { toErrorMessage } from '../../shared/utils/error.util';

interface PickerForm {
  featureId: FormControl<string>;
  testSuiteId: FormControl<string>;
  testCaseId: FormControl<string>;
  scriptType: FormControl<ScriptType>;
  elementIds: FormControl<string[]>;
}

@Component({
  selector: 'app-mappings',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NzCardModule,
    NzFormModule,
    NzInputModule,
    NzSelectModule,
    NzCheckboxModule,
    NzButtonModule,
    NzAlertModule,
    NzGridModule,
    NzIconModule,
    NzTooltipModule,
    NzSpinModule,
    NzTagModule,
    NzEmptyModule,
    PageHeaderComponent,
    StatusTagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mappings.component.html',
  styleUrl: './mappings.component.scss',
})
export class MappingsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly mappingsService = inject(MappingsService);
  private readonly featuresService = inject(FeaturesService);
  private readonly suitesService = inject(TestSuitesService);
  private readonly testCasesService = inject(TestCasesService);
  private readonly elementsService = inject(PageElementsService);
  private readonly message = inject(NzMessageService);

  protected readonly scriptTypes = SCRIPT_TYPES;
  protected readonly features = signal<IFeature[]>([]);
  protected readonly suites = signal<ITestSuite[]>([]);
  protected readonly testCases = signal<ITestCase[]>([]);
  protected readonly pageElements = signal<IPageElement[]>([]);
  protected readonly mapping = signal<ITestCaseElementMapping | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly generating = signal(false);
  protected readonly pushing = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group<PickerForm>({
    featureId: this.fb.nonNullable.control('', [Validators.required]),
    testSuiteId: this.fb.nonNullable.control('', [Validators.required]),
    testCaseId: this.fb.nonNullable.control('', [Validators.required]),
    scriptType: this.fb.nonNullable.control<ScriptType>('PLAYWRIGHT', [Validators.required]),
    elementIds: this.fb.nonNullable.control<string[]>([]),
  });

  ngOnInit(): void {
    this.featuresService.search({ pageIndex: 1, pageSize: 200 }).subscribe({
      next: (res) => this.features.set(res.items),
    });

    this.form.controls.featureId.valueChanges.pipe(distinctUntilChanged()).subscribe((id) => {
      this.form.patchValue({ testSuiteId: '', testCaseId: '', elementIds: [] });
      this.mapping.set(null);
      this.testCases.set([]);
      if (!id) {
        this.suites.set([]);
        this.pageElements.set([]);
        return;
      }
      forkJoin({
        suites: this.suitesService.listByFeature(id),
        elements: this.elementsService.listByFeature(id),
      }).subscribe({
        next: ({ suites, elements }) => {
          this.suites.set(suites);
          this.pageElements.set(elements);
        },
      });
    });

    this.form.controls.testSuiteId.valueChanges.pipe(distinctUntilChanged()).subscribe((id) => {
      this.form.patchValue({ testCaseId: '', elementIds: [] });
      this.mapping.set(null);
      if (!id) {
        this.testCases.set([]);
        return;
      }
      this.testCasesService.listBySuite(id).subscribe({
        next: (tc) => this.testCases.set(tc),
      });
    });

    this.form.controls.testCaseId.valueChanges.pipe(distinctUntilChanged()).subscribe((id) => {
      if (!id) {
        this.mapping.set(null);
        this.form.patchValue({ elementIds: [] });
        return;
      }
      this.loading.set(true);
      this.mappingsService
        .getByTestCase(id)
        .pipe(finalize(() => this.loading.set(false)))
        .subscribe({
          next: (m) => {
            this.mapping.set(m);
            this.form.patchValue({
              elementIds: m?.elementIds ?? [],
              scriptType: m?.scriptType ?? 'PLAYWRIGHT',
            });
          },
        });
    });
  }

  protected save(): void {
    if (this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    if (v.elementIds.length === 0) {
      this.errorMessage.set('Pick at least one page element to map.');
      return;
    }
    this.errorMessage.set(null);
    this.saving.set(true);
    this.mappingsService
      .upsert({
        featureId: v.featureId,
        testSuiteId: v.testSuiteId,
        testCaseId: v.testCaseId,
        elementIds: v.elementIds,
        scriptType: v.scriptType,
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (saved) => {
          if (saved) {
            this.mapping.set(saved);
            this.message.success('Mapping saved');
          }
        },
        error: (e: unknown) => this.errorMessage.set(toErrorMessage(e)),
      });
  }

  protected generate(): void {
    const m = this.mapping();
    if (!m) {
      this.message.warning('Save the mapping first.');
      return;
    }
    this.generating.set(true);
    this.mappingsService
      .generateScript(m._id, this.form.controls.scriptType.value)
      .pipe(finalize(() => this.generating.set(false)))
      .subscribe({
        next: (updated) => {
          if (updated) {
            this.mapping.set(updated);
            this.message.success('Script generated');
          }
        },
      });
  }

  protected pushToGit(): void {
    const m = this.mapping();
    if (!m || !m.generatedScript) {
      this.message.warning('Generate a script before pushing to Git.');
      return;
    }
    this.pushing.set(true);
    this.mappingsService
      .pushToGit(m._id, { message: `chore(qa): mapping for ${m.testCaseId}` })
      .pipe(finalize(() => this.pushing.set(false)))
      .subscribe({
        next: (updated) => {
          if (updated) {
            this.mapping.set(updated);
            this.message.success('Pushed to Git');
          }
        },
      });
  }

  protected copyScript(): void {
    const script = this.mapping()?.generatedScript;
    if (!script) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard
        .writeText(script)
        .then(() => this.message.success('Script copied to clipboard'))
        .catch(() => this.message.error('Could not copy script'));
    }
  }

  protected toggleAllElements(checked: boolean): void {
    this.form.controls.elementIds.setValue(
      checked ? this.pageElements().map((e) => e._id) : [],
    );
  }

  protected get allChecked(): boolean {
    const els = this.pageElements();
    const selected = this.form.controls.elementIds.value;
    return els.length > 0 && selected.length === els.length;
  }

  protected get someChecked(): boolean {
    const selected = this.form.controls.elementIds.value;
    return selected.length > 0 && !this.allChecked;
  }

  protected toggleElement(id: string, checked: boolean): void {
    const current = new Set(this.form.controls.elementIds.value);
    if (checked) current.add(id);
    else current.delete(id);
    this.form.controls.elementIds.setValue([...current]);
  }

  protected isSelected(id: string): boolean {
    return this.form.controls.elementIds.value.includes(id);
  }
}
