import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import {
  ApiEnvelope,
  CreateExecutionPayload,
  EMPTY_PAGE,
  ITestExecution,
  PaginatedResult,
  SearchRequest,
  UpdateExecutionPayload,
} from '../models';
import { ApiService } from './api.service';

export interface RunFromGitPayload {
  featureId: string;
  branch: string;
  buildName: string;
  repoUrl?: string;
  testPath?: string;
}

export interface GitWorkflow {
  id: number;
  name: string;
  path: string;
  state: string;
  htmlUrl: string;
}

export interface GitRepo {
  fullName: string;
  name: string;
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
}

export interface RunWorkflowPayload {
  featureId: string;
  repo?: string;
  workflowFile: string;
  branch: string;
  buildName: string;
}

@Injectable({ providedIn: 'root' })
export class ExecutionsService {
  private readonly api = inject(ApiService);
  private readonly base = '/test-executions';

  search(request: SearchRequest): Observable<PaginatedResult<ITestExecution>> {
    return this.api
      .post<ApiEnvelope<PaginatedResult<ITestExecution>>, SearchRequest>(
        `${this.base}/search`,
        request,
      )
      .pipe(map((res) => res.data ?? EMPTY_PAGE<ITestExecution>()));
  }

  getById(id: string): Observable<ITestExecution | null> {
    return this.api
      .get<ApiEnvelope<ITestExecution>>(`${this.base}/${id}`)
      .pipe(map((res) => res.data ?? null));
  }

  trigger(payload: CreateExecutionPayload): Observable<ITestExecution | null> {
    return this.api
      .post<ApiEnvelope<ITestExecution>, CreateExecutionPayload>(
        this.base,
        payload,
      )
      .pipe(map((res) => res.data ?? null));
  }

  /** Trigger a Playwright run from a connected git branch on BrowserStack. */
  runFromGit(payload: RunFromGitPayload): Observable<ITestExecution | null> {
    return this.api
      .post<ApiEnvelope<ITestExecution>, RunFromGitPayload>(
        `${this.base}/run-from-git`,
        payload,
      )
      .pipe(map((res) => res.data ?? null));
  }

  /** Lists every GitHub repo the saved PAT can see. */
  listGitRepos(): Observable<GitRepo[]> {
    return this.api
      .get<ApiEnvelope<{ repos: GitRepo[] }>>(`${this.base}/git/repos`)
      .pipe(map((res) => res.data?.repos ?? []));
  }

  /** Lists branches on the chosen repo (or saved repo if `repo` is omitted). */
  listGitBranches(repo?: string): Observable<string[]> {
    const url = repo
      ? `${this.base}/git/branches?repo=${encodeURIComponent(repo)}`
      : `${this.base}/git/branches`;
    return this.api
      .get<ApiEnvelope<{ branches: string[] }>>(url)
      .pipe(map((res) => res.data?.branches ?? []));
  }

  /** Lists `.github/workflows/*.yml` files on the chosen repo. */
  listGitWorkflows(repo?: string): Observable<GitWorkflow[]> {
    const url = repo
      ? `${this.base}/git/workflows?repo=${encodeURIComponent(repo)}`
      : `${this.base}/git/workflows`;
    return this.api
      .get<ApiEnvelope<{ workflows: GitWorkflow[] }>>(url)
      .pipe(map((res) => res.data?.workflows ?? []));
  }

  /** Trigger a GitHub Actions workflow_dispatch on the chosen branch. */
  runWorkflow(payload: RunWorkflowPayload): Observable<ITestExecution | null> {
    return this.api
      .post<ApiEnvelope<ITestExecution>, RunWorkflowPayload>(
        `${this.base}/run-workflow`,
        payload,
      )
      .pipe(map((res) => res.data ?? null));
  }

  update(
    id: string,
    payload: UpdateExecutionPayload,
  ): Observable<ITestExecution | null> {
    return this.api
      .patch<ApiEnvelope<ITestExecution>, UpdateExecutionPayload>(
        `${this.base}/${id}`,
        payload,
      )
      .pipe(map((res) => res.data ?? null));
  }

  cancel(id: string): Observable<ITestExecution | null> {
    return this.api
      .post<ApiEnvelope<ITestExecution>>(`${this.base}/${id}/cancel`)
      .pipe(map((res) => res.data ?? null));
  }

  remove(id: string): Observable<void> {
    return this.api
      .delete<ApiEnvelope<unknown>>(`${this.base}/${id}`)
      .pipe(map(() => undefined));
  }
}
