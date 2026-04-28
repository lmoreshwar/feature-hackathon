import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzListModule } from 'ng-zorro-antd/list';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { debounceTime, distinctUntilChanged } from 'rxjs';

import { ITestCase } from '../../core/models';
import { TestCasesService } from '../../core/services/test-cases.service';
import {
  CoverageInputType,
  CoverageReviewResult,
} from '../../core/services/test-cases.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { StatusTagComponent } from '../../shared/components/status-tag/status-tag.component';

@Component({
  selector: 'app-coverage-review',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    NzAlertModule,
    NzBadgeModule,
    NzButtonModule,
    NzCardModule,
    NzDescriptionsModule,
    NzDividerModule,
    NzEmptyModule,
    NzFormModule,
    NzGridModule,
    NzIconModule,
    NzInputModule,
    NzListModule,
    NzProgressModule,
    NzRadioModule,
    NzSpinModule,
    NzStatisticModule,
    NzTagModule,
    NzTooltipModule,
    PageHeaderComponent,
    StatusTagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './coverage-review.component.html',
  styleUrl: './coverage-review.component.scss',
})
export class CoverageReviewComponent implements OnInit {
  private readonly testCasesService = inject(TestCasesService);
  private readonly message = inject(NzMessageService);

  // ---- input state ----
  protected readonly inputType = signal<CoverageInputType>('text');
  protected readonly jiraId = signal('');
  protected readonly confluenceUrl = signal('');
  protected readonly text = signal('');

  // ---- coverage result ----
  protected readonly loading = signal(false);
  protected readonly result = signal<CoverageReviewResult | null>(null);
  protected readonly error = signal<string | null>(null);

  // ---- approved test cases (right pane) ----
  protected readonly approved = signal<ITestCase[]>([]);
  protected readonly approvedTotal = signal(0);
  protected readonly approvedLoading = signal(false);
  protected readonly approvedSearch = new FormControl<string>('', {
    nonNullable: true,
  });

  protected readonly automationCount = computed(
    () => this.approved().filter((t) => t.automationFeasible).length,
  );

  ngOnInit(): void {
    this.loadApproved('');
    this.approvedSearch.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged())
      .subscribe((q) => this.loadApproved(q ?? ''));
  }

  private loadApproved(query: string): void {
    this.approvedLoading.set(true);
    this.testCasesService
      .search({
        pageIndex: 1,
        pageSize: 100,
        search: query?.trim() || undefined,
        filters: { status: 'APPROVED' },
        sort: { updatedAt: 'desc' },
      })
      .subscribe({
        next: (res) => {
          this.approved.set(res.items);
          this.approvedTotal.set(res.total ?? 0);
          this.approvedLoading.set(false);
        },
        error: () => {
          this.approved.set([]);
          this.approvedTotal.set(0);
          this.approvedLoading.set(false);
        },
      });
  }

  protected setInputType(type: CoverageInputType): void {
    this.inputType.set(type);
    this.error.set(null);
  }

  protected get coverageColor(): string {
    const pct = this.result()?.percentage ?? 0;
    if (pct >= 80) return '#52c41a';
    if (pct >= 50) return '#faad14';
    return '#ff4d4f';
  }

  protected get coverageLabel(): string {
    const pct = this.result()?.percentage ?? 0;
    if (pct >= 80) return 'Excellent coverage';
    if (pct >= 50) return 'Partial coverage';
    if (pct > 0) return 'Low coverage';
    return 'No coverage';
  }

  protected get canRun(): boolean {
    if (this.loading()) return false;
    const t = this.inputType();
    if (t === 'text') return this.text().trim().length > 0;
    if (t === 'jira') return this.jiraId().trim().length > 0;
    return this.confluenceUrl().trim().length > 0;
  }

  protected run(): void {
    if (!this.canRun) return;
    this.loading.set(true);
    this.error.set(null);
    this.result.set(null);

    const type = this.inputType();
    this.testCasesService
      .coverage({
        inputType: type,
        jiraId: type === 'jira' ? this.jiraId().trim() : undefined,
        confluenceUrl:
          type === 'confluence' ? this.confluenceUrl().trim() : undefined,
        text: type === 'text' ? this.text().trim() || undefined : undefined,
      })
      .subscribe({
        next: (res) => {
          this.result.set(res);
          this.loading.set(false);
          this.message.success(`Coverage: ${res.percentage}%`);
        },
        error: (err: Error) => {
          this.loading.set(false);
          this.error.set(err.message ?? 'Coverage analysis failed');
        },
      });
  }

  protected reset(): void {
    this.jiraId.set('');
    this.confluenceUrl.set('');
    this.text.set('');
    this.result.set(null);
    this.error.set(null);
  }

  protected browseConfluence(): void {
    this.message.info(
      'Confluence picker is not available yet. Paste the Confluence page URL above — the backend will fetch its content.',
    );
  }
}
