import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';

import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { finalize } from 'rxjs';

import {
  GIT_PROVIDERS,
  GitProvider,
  LLM_PROVIDERS,
  LlmProvider,
  MaskedIntegration,
  UpsertIntegrationPayload,
} from '../../core/models';
import {
  ConnectionTestResult,
  IntegrationSection,
  IntegrationsService,
} from '../../core/services/integrations.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { toErrorMessage } from '../../shared/utils/error.util';

@Component({
  selector: 'app-integrations',
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
    NzIconModule,
    NzTooltipModule,
    NzPopconfirmModule,
    NzSpinModule,
    NzTabsModule,
    PageHeaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './integrations.component.html',
  styleUrl: './integrations.component.scss',
})
export class IntegrationsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(IntegrationsService);
  private readonly message = inject(NzMessageService);

  protected readonly llmProviders = LLM_PROVIDERS;
  protected readonly gitProviders = GIT_PROVIDERS;

  protected readonly loading = signal(false);
  protected readonly saving = signal<IntegrationSection | null>(null);
  protected readonly testing = signal<IntegrationSection | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly current = signal<MaskedIntegration | null>(null);
  protected readonly tokenVisible = signal<Record<string, boolean>>({});
  protected readonly testResults = signal<
    Partial<Record<IntegrationSection, ConnectionTestResult>>
  >({});

  protected readonly jiraForm = this.fb.nonNullable.group({
    baseUrl: this.fb.nonNullable.control('', [Validators.required]),
    email: this.fb.nonNullable.control('', [Validators.required, Validators.email]),
    apiToken: this.fb.nonNullable.control(''),
  });

  protected readonly confluenceForm = this.fb.nonNullable.group({
    baseUrl: this.fb.nonNullable.control('', [Validators.required]),
    email: this.fb.nonNullable.control('', [Validators.required, Validators.email]),
    apiToken: this.fb.nonNullable.control(''),
  });

  protected readonly llmForm = this.fb.nonNullable.group({
    provider: this.fb.nonNullable.control<LlmProvider>('OPENAI', [Validators.required]),
    apiKey: this.fb.nonNullable.control(''),
    model: this.fb.nonNullable.control('', [Validators.required]),
  });

  protected readonly gitForm = this.fb.nonNullable.group({
    provider: this.fb.nonNullable.control<GitProvider>('GITHUB', [Validators.required]),
    repoUrl: this.fb.nonNullable.control('', [Validators.required]),
    token: this.fb.nonNullable.control(''),
    branch: this.fb.nonNullable.control('main', [Validators.required]),
  });

  protected readonly bsForm = this.fb.nonNullable.group({
    username: this.fb.nonNullable.control('', [Validators.required]),
    accessKey: this.fb.nonNullable.control(''),
  });

  ngOnInit(): void {
    this.refresh();
  }

  protected refresh(): void {
    this.loading.set(true);
    this.service
      .getMine()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (data) => {
          this.current.set(data);
          this.hydrate(data);
        },
        error: () => this.current.set(null),
      });
  }

  protected toggleTokenVisible(key: string): void {
    this.tokenVisible.update((v) => ({ ...v, [key]: !v[key] }));
  }

  protected isVisible(key: string): boolean {
    return !!this.tokenVisible()[key];
  }

  protected save(section: IntegrationSection): void {
    if (this.saving()) return;
    const payload = this.toPayload(section);
    if (!payload) return;

    this.saving.set(section);
    this.errorMessage.set(null);
    this.service
      .upsertMine(payload)
      .pipe(finalize(() => this.saving.set(null)))
      .subscribe({
        next: (data) => {
          this.current.set(data);
          this.hydrate(data);
          this.message.success(`${this.label(section)} saved`);
        },
        error: (e: unknown) => this.errorMessage.set(toErrorMessage(e)),
      });
  }

  protected clear(section: IntegrationSection): void {
    this.service.clearSection(section).subscribe({
      next: (data) => {
        this.current.set(data);
        this.hydrate(data);
        this.testResults.update((r) => {
          const next = { ...r };
          delete next[section];
          return next;
        });
        this.message.success(`${this.label(section)} cleared`);
      },
    });
  }

  protected testConnection(section: IntegrationSection): void {
    if (this.testing()) return;
    if (!this.hasSavedSection(section)) {
      this.message.warning(
        `Save your ${this.label(section)} settings before testing the connection.`,
      );
      return;
    }

    this.testing.set(section);
    this.service
      .testConnection(section)
      .pipe(finalize(() => this.testing.set(null)))
      .subscribe({
        next: (result) => {
          this.testResults.update((r) => ({ ...r, [section]: result }));
          if (result.ok) {
            this.message.success(result.message);
          } else {
            this.message.error(result.message);
          }
        },
        error: (e: unknown) => {
          const msg = toErrorMessage(e);
          this.testResults.update((r) => ({
            ...r,
            [section]: { ok: false, section, message: msg },
          }));
          this.message.error(msg);
        },
      });
  }

  protected hasSavedSection(section: IntegrationSection): boolean {
    const c = this.current();
    if (!c) return false;
    switch (section) {
      case 'jira':
        return !!c.jira;
      case 'confluence':
        return !!c.confluence;
      case 'llm':
        return !!c.llm;
      case 'git':
        return !!c.git;
      case 'browserstack':
        return !!c.browserstack;
    }
  }

  protected testResult(section: IntegrationSection): ConnectionTestResult | undefined {
    return this.testResults()[section];
  }

  private label(section: IntegrationSection): string {
    return section.charAt(0).toUpperCase() + section.slice(1);
  }

  private toPayload(section: IntegrationSection): UpsertIntegrationPayload | null {
    switch (section) {
      case 'jira': {
        if (this.jiraForm.invalid) {
          this.jiraForm.markAllAsTouched();
          return null;
        }
        const v = this.jiraForm.getRawValue();
        if (!v.apiToken && !this.current()?.jira?.apiTokenMasked) {
          this.message.warning('Provide an API token to save Jira settings.');
          return null;
        }
        return {
          jira: {
            baseUrl: v.baseUrl.trim(),
            email: v.email.trim(),
            apiToken: v.apiToken || '',
          },
        };
      }
      case 'confluence': {
        if (this.confluenceForm.invalid) {
          this.confluenceForm.markAllAsTouched();
          return null;
        }
        const v = this.confluenceForm.getRawValue();
        if (!v.apiToken && !this.current()?.confluence?.apiTokenMasked) {
          this.message.warning('Provide an API token to save Confluence settings.');
          return null;
        }
        return {
          confluence: {
            baseUrl: v.baseUrl.trim(),
            email: v.email.trim(),
            apiToken: v.apiToken || '',
          },
        };
      }
      case 'llm': {
        if (this.llmForm.invalid) {
          this.llmForm.markAllAsTouched();
          return null;
        }
        const v = this.llmForm.getRawValue();
        if (!v.apiKey && !this.current()?.llm?.apiKeyMasked) {
          this.message.warning('Provide an API key to save LLM settings.');
          return null;
        }
        return { llm: { provider: v.provider, apiKey: v.apiKey || '', model: v.model.trim() } };
      }
      case 'git': {
        if (this.gitForm.invalid) {
          this.gitForm.markAllAsTouched();
          return null;
        }
        const v = this.gitForm.getRawValue();
        if (!v.token && !this.current()?.git?.tokenMasked) {
          this.message.warning('Provide a token to save Git settings.');
          return null;
        }
        return {
          git: {
            provider: v.provider,
            repoUrl: v.repoUrl.trim(),
            token: v.token || '',
            branch: v.branch.trim(),
          },
        };
      }
      case 'browserstack': {
        if (this.bsForm.invalid) {
          this.bsForm.markAllAsTouched();
          return null;
        }
        const v = this.bsForm.getRawValue();
        if (!v.accessKey && !this.current()?.browserstack?.accessKeyMasked) {
          this.message.warning('Provide an access key to save BrowserStack settings.');
          return null;
        }
        return {
          browserstack: { username: v.username.trim(), accessKey: v.accessKey || '' },
        };
      }
    }
    return null;
  }

  private hydrate(data: MaskedIntegration | null): void {
    if (!data) {
      this.jiraForm.reset({ baseUrl: '', email: '', apiToken: '' });
      this.confluenceForm.reset({ baseUrl: '', email: '', apiToken: '' });
      this.llmForm.reset({ provider: 'OPENAI', apiKey: '', model: '' });
      this.gitForm.reset({ provider: 'GITHUB', repoUrl: '', token: '', branch: 'main' });
      this.bsForm.reset({ username: '', accessKey: '' });
      return;
    }

    if (data.jira) {
      this.jiraForm.reset({
        baseUrl: data.jira.baseUrl,
        email: data.jira.email,
        apiToken: '',
      });
    }
    if (data.confluence) {
      this.confluenceForm.reset({
        baseUrl: data.confluence.baseUrl,
        email: data.confluence.email,
        apiToken: '',
      });
    }
    if (data.llm) {
      this.llmForm.reset({
        provider: data.llm.provider,
        apiKey: '',
        model: data.llm.model,
      });
    }
    if (data.git) {
      this.gitForm.reset({
        provider: data.git.provider,
        repoUrl: data.git.repoUrl,
        token: '',
        branch: data.git.branch,
      });
    }
    if (data.browserstack) {
      this.bsForm.reset({
        username: data.browserstack.username,
        accessKey: '',
      });
    }
  }
}
