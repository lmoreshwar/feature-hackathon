import { BadRequestException, Injectable } from '@nestjs/common';

import { IntegrationDocument } from '../../common/schemas';
import { decryptSecret } from '../../common/utils/crypto.util';
import { IntegrationRepository } from './integration.repository';

export type IntegrationSection =
  | 'jira'
  | 'confluence'
  | 'llm'
  | 'git'
  | 'browserstack';

export interface ConnectionTestResult {
  ok: boolean;
  section: IntegrationSection;
  message: string;
  account?: string;
  details?: Record<string, unknown>;
}

const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Performs a lightweight authenticated "whoami" style call against each
 * third-party so the user can verify their integration credentials without
 * having to trigger a real workflow (script gen, BrowserStack run, etc.).
 *
 * Each provider exposes a stable, low-cost identity endpoint:
 *   - Jira / Confluence Cloud: GET /rest/api/<v>/myself|user/current (Basic)
 *   - LLM (OpenAI/Anthropic):   list models / models endpoint (Bearer | x-api-key)
 *   - Git:                      GET /user (GitHub/GitLab/Bitbucket variants)
 *   - BrowserStack:             GET /automate/plan.json (Basic)
 */
@Injectable()
export class IntegrationTesterService {
  constructor(private readonly repository: IntegrationRepository) {}

  async test(
    userId: string,
    section: IntegrationSection,
  ): Promise<ConnectionTestResult> {
    const doc = await this.repository.findByUserId(userId);
    if (!doc) {
      throw new BadRequestException(
        'No integration settings saved yet. Save the section first, then test.',
      );
    }

    switch (section) {
      case 'jira':
        return this.testJira(doc);
      case 'confluence':
        return this.testConfluence(doc);
      case 'llm':
        return this.testLlm(doc);
      case 'git':
        return this.testGit(doc);
      case 'browserstack':
        return this.testBrowserStack(doc);
      default:
        throw new BadRequestException(`Unknown integration section: ${section}`);
    }
  }

  // ---------- Jira ----------
  private async testJira(doc: IntegrationDocument): Promise<ConnectionTestResult> {
    const cfg = doc.jira;
    if (!cfg?.baseUrl || !cfg.email || !cfg.apiTokenEncrypted) {
      return this.missing('jira');
    }

    const url = this.join(cfg.baseUrl, '/rest/api/3/myself');
    const auth = this.basicAuth(cfg.email, decryptSecret(cfg.apiTokenEncrypted));

    return this.runJsonProbe('jira', url, {
      headers: { Authorization: auth, Accept: 'application/json' },
      pickAccount: (body) =>
        (body?.['emailAddress'] as string | undefined) ??
        (body?.['displayName'] as string | undefined) ??
        cfg.email,
      successMessage: 'Jira authenticated successfully',
    });
  }

  // ---------- Confluence ----------
  private async testConfluence(
    doc: IntegrationDocument,
  ): Promise<ConnectionTestResult> {
    const cfg = doc.confluence;
    if (!cfg?.baseUrl || !cfg.email || !cfg.apiTokenEncrypted) {
      return this.missing('confluence');
    }

    const url = this.join(cfg.baseUrl, '/wiki/rest/api/user/current');
    const auth = this.basicAuth(cfg.email, decryptSecret(cfg.apiTokenEncrypted));

    return this.runJsonProbe('confluence', url, {
      headers: { Authorization: auth, Accept: 'application/json' },
      pickAccount: (body) =>
        (body?.['email'] as string | undefined) ??
        (body?.['displayName'] as string | undefined) ??
        cfg.email,
      successMessage: 'Confluence authenticated successfully',
    });
  }

  // ---------- LLM ----------
  private async testLlm(doc: IntegrationDocument): Promise<ConnectionTestResult> {
    const cfg = doc.llm;
    if (!cfg?.provider || !cfg.apiKeyEncrypted) {
      return this.missing('llm');
    }
    const apiKey = decryptSecret(cfg.apiKeyEncrypted);

    if (cfg.provider === 'OPENAI') {
      return this.runJsonProbe('llm', 'https://api.openai.com/v1/models', {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
        pickAccount: () => `OpenAI · model ${cfg.model}`,
        successMessage: 'OpenAI key accepted',
      });
    }

    if (cfg.provider === 'ANTHROPIC') {
      return this.runJsonProbe('llm', 'https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          Accept: 'application/json',
        },
        pickAccount: () => `Anthropic · model ${cfg.model}`,
        successMessage: 'Anthropic key accepted',
      });
    }

    // Azure OpenAI: needs a deployment-aware probe; do a generic GET on the
    // resource root with the api-key header.
    return this.runJsonProbe(
      'llm',
      'https://api.openai.com/v1/models',
      {
        headers: { 'api-key': apiKey, Accept: 'application/json' },
        pickAccount: () => `Azure OpenAI · model ${cfg.model}`,
        successMessage: 'Azure OpenAI key accepted',
      },
    );
  }

  // ---------- Git ----------
  private async testGit(doc: IntegrationDocument): Promise<ConnectionTestResult> {
    const cfg = doc.git;
    if (!cfg?.provider || !cfg.tokenEncrypted) {
      return this.missing('git');
    }
    const token = decryptSecret(cfg.tokenEncrypted);

    if (cfg.provider === 'GITHUB') {
      return this.runJsonProbe('git', 'https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'quantum-ai-test',
        },
        pickAccount: (body) =>
          (body?.['login'] as string | undefined) ??
          (body?.['name'] as string | undefined),
        successMessage: 'GitHub authenticated successfully',
      });
    }

    if (cfg.provider === 'GITLAB') {
      return this.runJsonProbe('git', 'https://gitlab.com/api/v4/user', {
        headers: {
          'PRIVATE-TOKEN': token,
          Accept: 'application/json',
        },
        pickAccount: (body) =>
          (body?.['username'] as string | undefined) ??
          (body?.['name'] as string | undefined),
        successMessage: 'GitLab authenticated successfully',
      });
    }

    // Bitbucket Cloud: app password = Basic auth with username:appPassword.
    // We only have the token, so try Bearer first, then fall back to Basic.
    return this.runJsonProbe('git', 'https://api.bitbucket.org/2.0/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      pickAccount: (body) =>
        (body?.['username'] as string | undefined) ??
        (body?.['display_name'] as string | undefined),
      successMessage: 'Bitbucket authenticated successfully',
    });
  }

  // ---------- BrowserStack ----------
  private async testBrowserStack(
    doc: IntegrationDocument,
  ): Promise<ConnectionTestResult> {
    const cfg = doc.browserstack;
    if (!cfg?.username || !cfg.accessKeyEncrypted) {
      return this.missing('browserstack');
    }
    const accessKey = decryptSecret(cfg.accessKeyEncrypted);

    return this.runJsonProbe(
      'browserstack',
      'https://api.browserstack.com/automate/plan.json',
      {
        headers: {
          Authorization: this.basicAuth(cfg.username, accessKey),
          Accept: 'application/json',
        },
        pickAccount: (body) =>
          `${cfg.username} · plan ${(body?.['automate_plan'] as string | undefined) ?? 'unknown'}`,
        successMessage: 'BrowserStack authenticated successfully',
      },
    );
  }

  // ---------- helpers ----------

  private missing(section: IntegrationSection): ConnectionTestResult {
    return {
      ok: false,
      section,
      message:
        'No saved credentials for this section. Save the form, then test the connection.',
    };
  }

  private async runJsonProbe(
    section: IntegrationSection,
    url: string,
    opts: {
      headers: Record<string, string>;
      pickAccount?: (body: Record<string, unknown> | undefined) => string | undefined;
      successMessage: string;
    },
  ): Promise<ConnectionTestResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: opts.headers,
        signal: controller.signal,
      });

      const text = await res.text();
      let body: Record<string, unknown> | undefined;
      try {
        body = text ? (JSON.parse(text) as Record<string, unknown>) : undefined;
      } catch {
        body = undefined;
      }

      if (!res.ok) {
        return {
          ok: false,
          section,
          message: `Authentication failed (HTTP ${res.status}). ${this.shortError(body, text)}`,
        };
      }

      return {
        ok: true,
        section,
        message: opts.successMessage,
        account: opts.pickAccount?.(body),
      };
    } catch (e: unknown) {
      const reason =
        e instanceof Error
          ? e.name === 'AbortError'
            ? `Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`
            : e.message
          : 'Unknown network error';
      return {
        ok: false,
        section,
        message: `Could not reach ${this.host(url)}: ${reason}`,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private shortError(
    body: Record<string, unknown> | undefined,
    fallback: string,
  ): string {
    if (!body) {
      return (fallback || '').slice(0, 160);
    }
    const candidates = [
      body['error_description'],
      body['error'],
      body['message'],
      (body['errorMessages'] as string[] | undefined)?.[0],
    ];
    const msg = candidates.find((c) => typeof c === 'string') as
      | string
      | undefined;
    return msg ?? 'Check the credentials and base URL.';
  }

  private basicAuth(user: string, pass: string): string {
    return `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
  }

  private host(url: string): string {
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  }

  private join(base: string, path: string): string {
    const left = base.replace(/\/+$/, '');
    // Avoid duplicating /wiki for Confluence base URLs that already include it.
    if (path.startsWith('/wiki') && /\/wiki(\/|$)/.test(left)) {
      return `${left}${path.replace(/^\/wiki/, '')}`;
    }
    return `${left}${path.startsWith('/') ? path : `/${path}`}`;
  }
}
