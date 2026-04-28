import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { decryptSecret } from '../../common/utils/crypto.util';
import { IntegrationRepository } from './integration.repository';

export type JiraRelation = 'PRIMARY' | 'PARENT' | 'SUBTASK' | 'LINKED';

export interface JiraTicketSummary {
  key: string;
  summary: string;
  status?: string;
  statusCategory?: string;
  issueType?: string;
  priority?: string;
  assignee?: string;
  reporter?: string;
  url: string;
  relation: JiraRelation;
  /** For LINKED relation only — e.g. "blocks", "is blocked by". */
  linkType?: string;
}

export interface JiraTicketResult {
  primary: JiraTicketSummary & { description?: string; labels?: string[] };
  related: JiraTicketSummary[];
}

interface JiraIssueResponse {
  key: string;
  fields: {
    summary?: string;
    description?: unknown;
    labels?: string[];
    status?: { name?: string; statusCategory?: { name?: string } };
    priority?: { name?: string };
    issuetype?: { name?: string };
    assignee?: { displayName?: string; emailAddress?: string };
    reporter?: { displayName?: string; emailAddress?: string };
    parent?: {
      key: string;
      fields?: {
        summary?: string;
        status?: { name?: string };
        priority?: { name?: string };
        issuetype?: { name?: string };
      };
    };
    subtasks?: Array<{
      key: string;
      fields?: {
        summary?: string;
        status?: { name?: string };
        priority?: { name?: string };
        issuetype?: { name?: string };
      };
    }>;
    issuelinks?: Array<{
      type?: { inward?: string; outward?: string };
      inwardIssue?: {
        key: string;
        fields?: {
          summary?: string;
          status?: { name?: string };
          priority?: { name?: string };
          issuetype?: { name?: string };
        };
      };
      outwardIssue?: {
        key: string;
        fields?: {
          summary?: string;
          status?: { name?: string };
          priority?: { name?: string };
          issuetype?: { name?: string };
        };
      };
    }>;
  };
}

const REQUEST_TIMEOUT_MS = 15_000;
const FIELDS = [
  'summary',
  'description',
  'status',
  'priority',
  'issuetype',
  'parent',
  'subtasks',
  'issuelinks',
  'labels',
  'assignee',
  'reporter',
].join(',');

/**
 * Pulls a Jira issue plus its parent / sub-tasks / linked issues using the
 * user's saved Jira integration credentials. Designed for the Requirements
 * page so testers can paste a ticket key and get the full context in one shot
 * (no need to hop between tabs).
 */
@Injectable()
export class JiraFetcherService {
  constructor(private readonly repository: IntegrationRepository) {}

  async fetchTicket(userId: string, key: string): Promise<JiraTicketResult> {
    const ticketKey = (key || '').trim().toUpperCase();
    if (!ticketKey) {
      throw new BadRequestException('Jira ticket key is required.');
    }
    if (!/^[A-Z][A-Z0-9_]+-\d+$/.test(ticketKey)) {
      throw new BadRequestException(
        `"${ticketKey}" doesn't look like a Jira key (e.g. PROJ-123).`,
      );
    }

    const doc = await this.repository.findByUserId(userId);
    const cfg = doc?.jira;
    if (!cfg?.baseUrl || !cfg.email || !cfg.apiTokenEncrypted) {
      throw new BadRequestException(
        'Jira integration is not configured. Set it up in Settings → Integrations.',
      );
    }

    const baseUrl = cfg.baseUrl.replace(/\/+$/, '');
    const url = `${baseUrl}/rest/api/3/issue/${encodeURIComponent(
      ticketKey,
    )}?fields=${FIELDS}`;
    const auth = `Basic ${Buffer.from(
      `${cfg.email}:${decryptSecret(cfg.apiTokenEncrypted)}`,
    ).toString('base64')}`;

    const issue = await this.callJira(url, auth);
    return this.toResult(issue, baseUrl);
  }

  // ---------- HTTP ----------

  private async callJira(
    url: string,
    auth: string,
  ): Promise<JiraIssueResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { Authorization: auth, Accept: 'application/json' },
        signal: controller.signal,
      });

      const text = await res.text();
      if (res.status === 404) {
        throw new NotFoundException('Jira ticket not found.');
      }
      if (res.status === 401 || res.status === 403) {
        throw new BadRequestException(
          'Jira rejected the saved credentials. Re-test the connection in Settings → Integrations.',
        );
      }
      if (!res.ok) {
        throw new BadRequestException(
          `Jira returned HTTP ${res.status}: ${text.slice(0, 200) || res.statusText}`,
        );
      }

      try {
        return JSON.parse(text) as JiraIssueResponse;
      } catch {
        throw new BadRequestException(
          'Jira returned a non-JSON response. Check the base URL.',
        );
      }
    } catch (e: unknown) {
      if (e instanceof BadRequestException || e instanceof NotFoundException) {
        throw e;
      }
      const reason =
        e instanceof Error
          ? e.name === 'AbortError'
            ? `Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`
            : e.message
          : 'Unknown network error';
      throw new BadRequestException(`Could not reach Jira: ${reason}`);
    } finally {
      clearTimeout(timer);
    }
  }

  // ---------- Mapping ----------

  private toResult(issue: JiraIssueResponse, baseUrl: string): JiraTicketResult {
    const browseUrl = (k: string): string => `${baseUrl}/browse/${k}`;
    const f = issue.fields ?? {};

    const primary: JiraTicketResult['primary'] = {
      key: issue.key,
      summary: f.summary ?? '(no summary)',
      status: f.status?.name,
      statusCategory: f.status?.statusCategory?.name,
      issueType: f.issuetype?.name,
      priority: f.priority?.name,
      assignee: f.assignee?.displayName ?? f.assignee?.emailAddress,
      reporter: f.reporter?.displayName ?? f.reporter?.emailAddress,
      url: browseUrl(issue.key),
      relation: 'PRIMARY',
      description: this.adfToText(f.description),
      labels: f.labels ?? [],
    };

    const related: JiraTicketSummary[] = [];

    if (f.parent) {
      const p = f.parent;
      related.push({
        key: p.key,
        summary: p.fields?.summary ?? '(no summary)',
        status: p.fields?.status?.name,
        priority: p.fields?.priority?.name,
        issueType: p.fields?.issuetype?.name,
        url: browseUrl(p.key),
        relation: 'PARENT',
      });
    }

    for (const st of f.subtasks ?? []) {
      related.push({
        key: st.key,
        summary: st.fields?.summary ?? '(no summary)',
        status: st.fields?.status?.name,
        priority: st.fields?.priority?.name,
        issueType: st.fields?.issuetype?.name,
        url: browseUrl(st.key),
        relation: 'SUBTASK',
      });
    }

    for (const link of f.issuelinks ?? []) {
      const inward = link.inwardIssue;
      const outward = link.outwardIssue;
      if (inward) {
        related.push({
          key: inward.key,
          summary: inward.fields?.summary ?? '(no summary)',
          status: inward.fields?.status?.name,
          priority: inward.fields?.priority?.name,
          issueType: inward.fields?.issuetype?.name,
          url: browseUrl(inward.key),
          relation: 'LINKED',
          linkType: link.type?.inward,
        });
      }
      if (outward) {
        related.push({
          key: outward.key,
          summary: outward.fields?.summary ?? '(no summary)',
          status: outward.fields?.status?.name,
          priority: outward.fields?.priority?.name,
          issueType: outward.fields?.issuetype?.name,
          url: browseUrl(outward.key),
          relation: 'LINKED',
          linkType: link.type?.outward,
        });
      }
    }

    return { primary, related };
  }

  /**
   * Jira Cloud REST v3 returns rich `description` as Atlassian Document Format
   * (ADF) JSON. We only need plain text for the requirements UI, so walk the
   * tree and collect text nodes. Falls back to an empty string for legacy /
   * unexpected shapes.
   */
  private adfToText(node: unknown): string {
    if (node == null) return '';
    if (typeof node === 'string') return node;

    const visit = (n: unknown): string => {
      if (!n || typeof n !== 'object') return '';
      const obj = n as Record<string, unknown>;

      if (obj['type'] === 'text' && typeof obj['text'] === 'string') {
        return obj['text'];
      }

      const content = obj['content'];
      if (!Array.isArray(content)) return '';

      const parts = content.map((c) => visit(c));
      const sep = this.isBlockNode(obj['type']) ? '\n' : '';
      return parts.join('') + sep;
    };

    return visit(node).replace(/\n{3,}/g, '\n\n').trim();
  }

  private isBlockNode(type: unknown): boolean {
    return (
      type === 'paragraph' ||
      type === 'heading' ||
      type === 'bulletList' ||
      type === 'orderedList' ||
      type === 'listItem' ||
      type === 'blockquote' ||
      type === 'codeBlock'
    );
  }
}
