import { ChangeDetectionStrategy, Component, OnInit, ViewChild, inject, signal } from '@angular/core';
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
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { debounceTime, distinctUntilChanged, finalize } from 'rxjs';

import {
  CreatePageElementPayload,
  IFeature,
  IPageElement,
  PAGE_ELEMENT_TYPES,
  PageElementType,
} from '../../core/models';
import { FeaturesService } from '../../core/services/features.service';
import { PageElementsService } from '../../core/services/page-elements.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { EpochPipe } from '../../shared/pipes/epoch.pipe';
import { PageElementFormDrawerComponent } from './page-element-form-drawer.component';

interface CrawlForm {
  featureId: FormControl<string>;
  pageUrl: FormControl<string>;
  pageName: FormControl<string>;
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
export class PageElementsComponent implements OnInit {
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

  protected readonly crawlForm = this.fb.nonNullable.group<CrawlForm>({
    featureId: this.fb.nonNullable.control('', [Validators.required]),
    pageUrl: this.fb.nonNullable.control('', [Validators.required]),
    pageName: this.fb.nonNullable.control(''),
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
   * Mock crawl: in absence of a real crawler, generates a representative
   * element set for the URL and persists them via the bulk-create API.
   * Replace `mockCrawl()` with a real network call when the crawler ships.
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
    const payloads: CreatePageElementPayload[] = this.mockCrawl(v);

    this.elementsService
      .bulkCreate(payloads)
      .pipe(finalize(() => this.crawling.set(false)))
      .subscribe({
        next: (saved) => {
          this.message.success(`Crawled & saved ${saved.length} elements`);
          this.fetch();
        },
        error: () => this.errorMessage.set('Crawl failed. Please try again.'),
      });
  }

  protected featureName(id: string): string {
    return this.features().find((f) => f._id === id)?.name ?? '—';
  }

  private mockCrawl(v: { featureId: string; pageUrl: string; pageName: string }): CreatePageElementPayload[] {
    const base = {
      featureId: v.featureId,
      pageUrl: v.pageUrl.trim(),
      pageName: v.pageName.trim() || undefined,
      isStable: true,
    } as const;
    return [
      { ...base, elementName: 'Email input', elementType: 'INPUT', selector: 'input[name="email"]', selectorType: 'CSS' },
      { ...base, elementName: 'Password input', elementType: 'INPUT', selector: 'input[name="password"]', selectorType: 'CSS' },
      { ...base, elementName: 'Submit button', elementType: 'BUTTON', selector: 'button[type="submit"]', selectorType: 'CSS' },
      { ...base, elementName: 'Forgot password link', elementType: 'LINK', selector: 'a.forgot-password', selectorType: 'CSS' },
    ];
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
