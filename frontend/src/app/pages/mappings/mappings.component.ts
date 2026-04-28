import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormControl, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';

import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzCollapseModule } from 'ng-zorro-antd/collapse';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { distinctUntilChanged, finalize, forkJoin } from 'rxjs';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

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
import {
  BulkGenerateResult,
  MappingStepSuggestion,
  MappingsService,
} from '../../core/services/mappings.service';
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
    FormsModule,
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
    NzCollapseModule,
    NzDividerModule,
    NzStatisticModule,
    NzTabsModule,
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
  protected readonly suggesting = signal(false);
  protected readonly stepSuggestions = signal<MappingStepSuggestion[]>([]);
  protected readonly errorMessage = signal<string | null>(null);

  // ----- Bulk Playwright bundle state -----
  protected readonly bundleFeatureId = new FormControl<string>('', {
    nonNullable: true,
  });
  protected readonly bundle = signal<BulkGenerateResult | null>(null);
  protected readonly bundleLoading = signal(false);
  protected readonly bundlePushing = signal(false);
  protected readonly bundleZipping = signal(false);

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
        this.stepSuggestions.set([]);
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
            this.stepSuggestions.set([]);
          },
        });
    });
  }

  protected suggest(): void {
    if (this.suggesting()) return;
    const testCaseId = this.form.controls.testCaseId.value;
    if (!testCaseId) {
      this.message.warning('Pick a test case first.');
      return;
    }
    this.errorMessage.set(null);
    this.suggesting.set(true);
    this.mappingsService
      .suggest(testCaseId)
      .pipe(finalize(() => this.suggesting.set(false)))
      .subscribe({
        next: (res) => {
          if (!res) return;
          this.stepSuggestions.set(res.steps);
          this.form.controls.elementIds.setValue(res.elementIds);
          const matched = res.steps.filter((s) => s.elementId).length;
          this.message.success(
            `AI suggested mappings for ${matched}/${res.steps.length} steps. Review and edit before saving.`,
          );
        },
        error: (e: unknown) => this.errorMessage.set(toErrorMessage(e)),
      });
  }

  protected setStepElement(stepIndex: number, elementId: string | null): void {
    const updated = this.stepSuggestions().map((s) =>
      s.stepIndex === stepIndex
        ? {
            ...s,
            elementId,
            elementName: elementId
              ? this.pageElements().find((e) => e._id === elementId)?.elementName
              : undefined,
            selector: elementId
              ? this.pageElements().find((e) => e._id === elementId)?.selector
              : undefined,
            confidence: undefined,
            reason: 'manual',
          }
        : s,
    );
    this.stepSuggestions.set(updated);
    const ids = Array.from(
      new Set(
        updated
          .map((s) => s.elementId)
          .filter((v): v is string => Boolean(v)),
      ),
    );
    this.form.controls.elementIds.setValue(ids);
  }

  protected clearSuggestions(): void {
    this.stepSuggestions.set([]);
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

  // ============================================================
  // Bulk Playwright bundle  (POMs + spec files for one feature)
  // ============================================================

  protected featureNameOf(id: string | null | undefined): string {
    if (!id) return '';
    return this.features().find((f) => f._id === id)?.name ?? id;
  }

  protected runBundleGeneration(): void {
    const featureId = this.bundleFeatureId.value;
    if (!featureId) {
      this.message.warning('Pick a feature first.');
      return;
    }
    this.bundleLoading.set(true);
    this.bundle.set(null);
    this.mappingsService
      .bulkGenerateForFeature(featureId, 'PLAYWRIGHT')
      .pipe(finalize(() => this.bundleLoading.set(false)))
      .subscribe({
        next: (res) => {
          this.bundle.set(res);
          if (res.specFiles.length === 0) {
            this.message.warning(
              'No automation-feasible APPROVED test cases found for this feature.',
            );
          } else {
            this.message.success(
              `Generated ${res.specFiles.length} spec file(s) and ${res.pomFiles.length} page object(s).`,
            );
          }
        },
        error: (e: unknown) => {
          this.message.error(toErrorMessage(e));
        },
      });
  }

  protected async downloadBundleZip(): Promise<void> {
    const b = this.bundle();
    if (!b) return;
    if (b.pomFiles.length === 0 && b.specFiles.length === 0) {
      this.message.warning('Nothing to download yet.');
      return;
    }
    this.bundleZipping.set(true);
    try {
      const featureName =
        this.featureNameOf(b.featureId)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '') || 'feature';
      const zip = new JSZip();
      const root = zip.folder(`playwright-${featureName}`)!;
      const pages = root.folder('pages')!;
      const tests = root.folder('tests')!;

      b.pomFiles.forEach((p) => pages.file(p.fileName, p.content));
      b.specFiles.forEach((s) => tests.file(s.fileName, s.content));

      // A README that explains how to run the bundle.
      root.file(
        'README.md',
        this.buildBundleReadme(b, featureName),
      );

      // Reasonable default playwright config.
      root.file('playwright.config.ts', this.buildPlaywrightConfig());

      const blob = await zip.generateAsync({ type: 'blob' });
      saveAs(blob, `playwright-${featureName}-bundle.zip`);
      this.message.success('Bundle downloaded');
    } catch (e) {
      this.message.error(toErrorMessage(e));
    } finally {
      this.bundleZipping.set(false);
    }
  }

  protected pushBundleToGit(): void {
    const b = this.bundle();
    if (!b) return;
    const ids = b.specFiles.map((s) => s.mappingId).filter(Boolean);
    if (ids.length === 0) {
      this.message.warning('No mappings to push.');
      return;
    }
    this.bundlePushing.set(true);
    this.mappingsService
      .bulkPushToGit(ids)
      .pipe(finalize(() => this.bundlePushing.set(false)))
      .subscribe({
        next: (r) => {
          this.message.success(
            `Pushed ${r.pushed} mapping(s) to Git${r.skipped ? `, ${r.skipped} skipped` : ''}.`,
          );
        },
        error: (e: unknown) => this.message.error(toErrorMessage(e)),
      });
  }

  protected copyToClipboard(content: string, label: string): void {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard
        .writeText(content)
        .then(() => this.message.success(`${label} copied`))
        .catch(() => this.message.error(`Could not copy ${label}`));
    }
  }

  private buildBundleReadme(
    b: BulkGenerateResult,
    featureName: string,
  ): string {
    return `# Playwright bundle for ${featureName}

Generated by AI Test Engineer on ${new Date().toISOString()}.

## Contents
- \`pages/\` — Page Object files (one per crawled page)
- \`tests/\` — Spec files (one per automation-feasible test case)
- \`playwright.config.ts\` — minimal Playwright configuration

## Stats
- Page objects:  ${b.pomFiles.length}
- Spec files:    ${b.specFiles.length}
- Generated OK:  ${b.processed}
- Skipped:       ${b.skipped}

## How to run
\`\`\`bash
npm install -D @playwright/test
npx playwright install
npx playwright test
\`\`\`

## Notes
${b.warnings.map((w) => `- ${w}`).join('\n') || '- (none)'}
`;
  }

  private buildPlaywrightConfig(): string {
    return `import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
`;
  }
}
