import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';

import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule, NzTableQueryParams } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { debounceTime, distinctUntilChanged, finalize } from 'rxjs';

import {
  IFeature,
  IPageElement,
  PAGE_ELEMENT_TYPES,
  PageElementType,
} from '../../core/models';
import { FeaturesService } from '../../core/services/features.service';
import {
  CapturedElementDto,
  CrawlAuthMethod,
  CrawlPagePayload,
  PageElementsService,
  PomFile,
  PomFramework,
  StartCapturePayload,
} from '../../core/services/page-elements.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { toErrorMessage } from '../../shared/utils/error.util';
import { EpochPipe } from '../../shared/pipes/epoch.pipe';
import { PageElementFormDrawerComponent } from './page-element-form-drawer.component';

interface CrawlForm {
  featureId: FormControl<string>;
  pageUrl: FormControl<string>;
  pageName: FormControl<string>;
  authMethod: FormControl<CrawlAuthMethod>;
  loginUrl: FormControl<string>;
  authToken: FormControl<string>;
  username: FormControl<string>;
  password: FormControl<string>;
  aiNaming: FormControl<boolean>;
}

@Component({
  selector: 'app-page-elements',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NzCardModule,
    NzFormModule,
    NzInputModule,
    NzSelectModule,
    NzRadioModule,
    NzSwitchModule,
    NzTabsModule,
    NzDividerModule,
    NzButtonModule,
    NzAlertModule,
    NzGridModule,
    NzTableModule,
    NzTagModule,
    NzIconModule,
    NzTooltipModule,
    NzPopconfirmModule,
    NzEmptyModule,
    EpochPipe,
    PageHeaderComponent,
    PageElementFormDrawerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './page-elements.component.html',
  styleUrl: './page-elements.component.scss',
})
export class PageElementsComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly elementsService = inject(PageElementsService);
  private readonly featuresService = inject(FeaturesService);
  private readonly message = inject(NzMessageService);

  protected readonly elementTypes = PAGE_ELEMENT_TYPES;
  protected readonly elements = signal<IPageElement[]>([]);
  protected readonly features = signal<IFeature[]>([]);
  protected readonly loading = signal(false);
  protected readonly crawling = signal(false);
  protected readonly total = signal(0);
  protected readonly pageIndex = signal(1);
  protected readonly pageSize = signal(10);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly searchControl = new FormControl<string>('', { nonNullable: true });
  protected readonly featureControl = new FormControl<string | null>(null);
  protected readonly typeControl = new FormControl<PageElementType | null>(null);

  protected readonly pomFeatureControl = new FormControl<string | null>(null);
  protected readonly pomFrameworkControl = new FormControl<PomFramework>('PLAYWRIGHT', { nonNullable: true });
  protected readonly pomFiles = signal<PomFile[]>([]);
  protected readonly pomLoading = signal(false);
  protected readonly pomFrameworks: readonly PomFramework[] = ['PLAYWRIGHT', 'CYPRESS', 'SELENIUM'];

  protected readonly captureSessionId = signal<string | null>(null);
  protected readonly captureStarting = signal(false);
  protected readonly captureSaving = signal(false);
  protected readonly captureItems = signal<CapturedElementDto[]>([]);
  private capturePollHandle: ReturnType<typeof setInterval> | null = null;

  protected readonly crawlForm = this.fb.nonNullable.group<CrawlForm>({
    featureId: this.fb.nonNullable.control('', [Validators.required]),
    pageUrl: this.fb.nonNullable.control('', [Validators.required]),
    pageName: this.fb.nonNullable.control(''),
    authMethod: this.fb.nonNullable.control<CrawlAuthMethod>('none'),
    loginUrl: this.fb.nonNullable.control(''),
    authToken: this.fb.nonNullable.control(''),
    username: this.fb.nonNullable.control(''),
    password: this.fb.nonNullable.control(''),
    aiNaming: this.fb.nonNullable.control(true),
  });

  @ViewChild(PageElementFormDrawerComponent) private drawer?: PageElementFormDrawerComponent;

  ngOnInit(): void {
    this.searchControl.valueChanges.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => {
      this.pageIndex.set(1);
      this.fetch();
    });
    [this.featureControl, this.typeControl].forEach((c) =>
      c.valueChanges.pipe(distinctUntilChanged()).subscribe(() => {
        this.pageIndex.set(1);
        this.fetch();
      }),
    );

    this.crawlForm.controls.authMethod.valueChanges
      .pipe(distinctUntilChanged())
      .subscribe((method) => this.applyAuthValidators(method));
    this.applyAuthValidators(this.crawlForm.controls.authMethod.value);

    this.pomFeatureControl.valueChanges.pipe(distinctUntilChanged()).subscribe(() => this.loadPom());
    this.pomFrameworkControl.valueChanges.pipe(distinctUntilChanged()).subscribe(() => this.loadPom());

    this.loadFeatures();
    this.fetch();
  }

  private loadPom(): void {
    const featureId = this.pomFeatureControl.value;
    if (!featureId) {
      this.pomFiles.set([]);
      return;
    }
    this.pomLoading.set(true);
    this.elementsService
      .pomByFeature(featureId, this.pomFrameworkControl.value)
      .pipe(finalize(() => this.pomLoading.set(false)))
      .subscribe({
        next: (files) => this.pomFiles.set(files),
        error: () => this.pomFiles.set([]),
      });
  }

  protected refreshPom(): void {
    this.loadPom();
  }

  protected copyPom(file: PomFile): void {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    navigator.clipboard
      .writeText(file.content)
      .then(() => this.message.success(`Copied ${file.fileName}`))
      .catch(() => this.message.error('Could not copy'));
  }

  // ---------------- Manual capture mode ----------------

  protected startCapture(): void {
    if (this.captureSessionId() || this.captureStarting()) return;
    if (this.crawlForm.invalid) {
      this.crawlForm.markAllAsTouched();
      this.message.warning('Fill out the crawl form first.');
      return;
    }
    const v = this.crawlForm.getRawValue();
    const payload: StartCapturePayload = {
      featureId: v.featureId,
      pageUrl: v.pageUrl.trim(),
      pageName: v.pageName.trim() || undefined,
      authMethod: v.authMethod,
      loginUrl: v.authMethod !== 'none' ? v.loginUrl.trim() : undefined,
      authToken: v.authMethod === 'token' ? v.authToken : undefined,
      username: v.authMethod === 'credentials' ? v.username : undefined,
      password: v.authMethod === 'credentials' ? v.password : undefined,
    };
    this.captureStarting.set(true);
    this.captureItems.set([]);
    this.elementsService
      .startCapture(payload)
      .pipe(finalize(() => this.captureStarting.set(false)))
      .subscribe({
        next: ({ sessionId }) => {
          if (!sessionId) {
            this.message.error('Failed to start capture session.');
            return;
          }
          this.captureSessionId.set(sessionId);
          this.message.info('A browser window has opened. Click any element to capture it.');
          this.startCapturePolling(sessionId);
        },
        error: (e: unknown) =>
          this.message.error(`Could not start capture: ${toErrorMessage(e)}`),
      });
  }

  private startCapturePolling(sessionId: string): void {
    this.stopCapturePolling();
    this.capturePollHandle = setInterval(() => {
      this.elementsService.captureList(sessionId).subscribe({
        next: (items) => this.captureItems.set(items),
        error: () => this.stopCapturePolling(),
      });
    }, 1500);
  }

  private stopCapturePolling(): void {
    if (this.capturePollHandle !== null) {
      clearInterval(this.capturePollHandle);
      this.capturePollHandle = null;
    }
  }

  protected saveCapture(): void {
    const sessionId = this.captureSessionId();
    if (!sessionId) return;
    if (this.captureItems().length === 0) {
      this.message.warning('No elements have been captured yet.');
      return;
    }
    this.captureSaving.set(true);
    this.elementsService
      .captureSave(sessionId)
      .pipe(finalize(() => this.captureSaving.set(false)))
      .subscribe({
        next: (saved) => {
          this.message.success(`Saved ${saved.length} captured element(s).`);
          this.endCaptureSession();
          this.fetch();
        },
        error: (e: unknown) =>
          this.message.error(`Could not save: ${toErrorMessage(e)}`),
      });
  }

  protected cancelCapture(): void {
    const sessionId = this.captureSessionId();
    if (!sessionId) return;
    this.elementsService.captureStop(sessionId).subscribe({
      next: () => this.endCaptureSession(),
      error: () => this.endCaptureSession(),
    });
  }

  private endCaptureSession(): void {
    this.stopCapturePolling();
    this.captureSessionId.set(null);
    this.captureItems.set([]);
  }

  ngOnDestroy(): void {
    const sessionId = this.captureSessionId();
    if (sessionId) {
      this.elementsService.captureStop(sessionId).subscribe({
        next: () => undefined,
        error: () => undefined,
      });
    }
    this.stopCapturePolling();
  }

  protected onFeatureDropdownOpenChange(open: boolean): void {
    if (open) {
      this.loadFeatures();
    }
  }

  protected onQueryParamsChange(p: NzTableQueryParams): void {
    this.pageIndex.set(p.pageIndex);
    this.pageSize.set(p.pageSize);
    this.fetch();
  }

  protected refresh(): void {
    this.fetch();
  }

  protected openCreate(): void {
    this.drawer?.openCreate({
      featureId: this.crawlForm.controls.featureId.value || (this.featureControl.value ?? undefined),
      pageUrl: this.crawlForm.controls.pageUrl.value,
    });
  }

  protected openEdit(el: IPageElement): void {
    this.drawer?.openEdit(el);
  }

  protected onSaved(): void {
    this.fetch();
  }

  protected delete(el: IPageElement): void {
    this.elementsService.remove(el._id).subscribe({
      next: () => {
        this.message.success('Element deleted');
        this.fetch();
      },
    });
  }

  /**
   * Drives the real crawl endpoint: the backend launches a headless browser,
   * optionally signs in using the configured auth method, navigates to the
   * target page, and extracts interactive elements which are persisted via
   * the bulk-create flow.
   */
  protected runCrawl(): void {
    if (this.crawling()) return;
    if (this.crawlForm.invalid) {
      this.crawlForm.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.crawling.set(true);
    const v = this.crawlForm.getRawValue();
    const payload: CrawlPagePayload = {
      featureId: v.featureId,
      pageUrl: v.pageUrl.trim(),
      pageName: v.pageName.trim() || undefined,
      authMethod: v.authMethod,
      loginUrl: v.authMethod !== 'none' ? v.loginUrl.trim() : undefined,
      authToken: v.authMethod === 'token' ? v.authToken : undefined,
      username: v.authMethod === 'credentials' ? v.username : undefined,
      password: v.authMethod === 'credentials' ? v.password : undefined,
      aiNaming: v.aiNaming,
    };

    this.elementsService
      .crawl(payload)
      .pipe(finalize(() => this.crawling.set(false)))
      .subscribe({
        next: (saved) => {
          const prefix = this.authSummary(v.authMethod);
          this.message.success(
            `${prefix}Crawled & saved ${saved.length} element${saved.length === 1 ? '' : 's'}`,
          );
          this.fetch();
        },
        error: (e: unknown) => this.errorMessage.set(toErrorMessage(e)),
      });
  }

  protected featureName(id: string): string {
    return this.features().find((f) => f._id === id)?.name ?? '—';
  }

  private applyAuthValidators(method: CrawlAuthMethod): void {
    const { loginUrl, authToken, username, password } = this.crawlForm.controls;
    loginUrl.clearValidators();
    authToken.clearValidators();
    username.clearValidators();
    password.clearValidators();

    if (method !== 'none') {
      loginUrl.addValidators(Validators.required);
    }
    if (method === 'token') {
      authToken.addValidators(Validators.required);
    }
    if (method === 'credentials') {
      username.addValidators(Validators.required);
      password.addValidators(Validators.required);
    }

    loginUrl.updateValueAndValidity({ emitEvent: false });
    authToken.updateValueAndValidity({ emitEvent: false });
    username.updateValueAndValidity({ emitEvent: false });
    password.updateValueAndValidity({ emitEvent: false });
  }

  private authSummary(method: CrawlAuthMethod): string {
    if (method === 'token') return 'Authenticated with token. ';
    if (method === 'credentials') return 'Logged in with username & password. ';
    return '';
  }

  private loadFeatures(): void {
    this.featuresService.search({ pageIndex: 1, pageSize: 200 }).subscribe({
      next: (res) => this.features.set(res.items),
    });
  }

  private fetch(): void {
    this.loading.set(true);
    const filters: Record<string, unknown> = {};
    if (this.featureControl.value) filters['featureId'] = this.featureControl.value;
    if (this.typeControl.value) filters['elementType'] = this.typeControl.value;

    this.elementsService
      .search({
        pageIndex: this.pageIndex(),
        pageSize: this.pageSize(),
        search: this.searchControl.value?.trim() || undefined,
        filters,
        sort: { createdAt: 'desc' },
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => {
          this.elements.set(res.items);
          this.total.set(res.total);
        },
        error: () => {
          this.elements.set([]);
          this.total.set(0);
        },
      });
  }
}
