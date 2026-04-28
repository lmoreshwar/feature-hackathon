import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import {
  ApiEnvelope,
  MaskedIntegration,
  UpsertIntegrationPayload,
} from '../models';
import { ApiService } from './api.service';

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
  linkType?: string;
}

export interface JiraTicketResult {
  primary: JiraTicketSummary & { description?: string; labels?: string[] };
  related: JiraTicketSummary[];
}

@Injectable({ providedIn: 'root' })
export class IntegrationsService {
  private readonly api = inject(ApiService);
  private readonly base = '/integrations';

  getMine(): Observable<MaskedIntegration | null> {
    return this.api
      .get<ApiEnvelope<MaskedIntegration | null>>(`${this.base}/me`)
      .pipe(map((res) => res.data ?? null));
  }

  upsertMine(
    payload: UpsertIntegrationPayload,
  ): Observable<MaskedIntegration | null> {
    return this.api
      .put<ApiEnvelope<MaskedIntegration>, UpsertIntegrationPayload>(
        `${this.base}/me`,
        payload,
      )
      .pipe(map((res) => res.data ?? null));
  }

  clearSection(
    section: IntegrationSection,
  ): Observable<MaskedIntegration | null> {
    return this.api
      .delete<ApiEnvelope<MaskedIntegration | null>>(
        `${this.base}/me/${section}`,
      )
      .pipe(map((res) => res.data ?? null));
  }

  testConnection(section: IntegrationSection): Observable<ConnectionTestResult> {
    return this.api
      .post<ApiEnvelope<ConnectionTestResult>>(
        `${this.base}/me/${section}/test`,
      )
      .pipe(
        map(
          (res) =>
            res.data ?? {
              ok: false,
              section,
              message: res.message ?? 'No response from server',
            },
        ),
      );
  }

  fetchJiraIssue(key: string): Observable<JiraTicketResult> {
    return this.api
      .get<ApiEnvelope<JiraTicketResult>>(
        `${this.base}/jira/issues/${encodeURIComponent(key.trim())}`,
      )
      .pipe(
        map((res) => {
          if (!res.data) {
            throw new Error(res.message ?? 'Empty response from Jira');
          }
          return res.data;
        }),
      );
  }
}
