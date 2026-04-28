import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import {
  ApiEnvelope,
  CreatePageElementPayload,
  EMPTY_PAGE,
  IPageElement,
  PaginatedResult,
  SearchRequest,
  UpdatePageElementPayload,
} from '../models';
import { ApiService } from './api.service';

export type CrawlAuthMethod = 'none' | 'token' | 'credentials';
export type PomFramework = 'PLAYWRIGHT' | 'CYPRESS' | 'SELENIUM';

export interface PageGroup {
  pageUrl: string;
  pageName: string;
  className: string;
  elements: IPageElement[];
}

export interface PomFile {
  className: string;
  fileName: string;
  content: string;
  pageUrl: string;
  pageName: string;
  elementCount: number;
}

export interface CapturedElementDto {
  clientId: string;
  pageUrl: string;
  pageTitle?: string;
  elementName: string;
  elementType: string;
  selector: string;
  selectorType: string;
}

export interface StartCapturePayload {
  featureId: string;
  pageUrl: string;
  pageName?: string;
  authMethod: CrawlAuthMethod;
  loginUrl?: string;
  authToken?: string;
  username?: string;
  password?: string;
}

export interface CrawlPagePayload {
  featureId: string;
  pageUrl: string;
  pageName?: string;
  authMethod: CrawlAuthMethod;
  loginUrl?: string;
  authToken?: string;
  username?: string;
  password?: string;
  aiNaming?: boolean;
}

@Injectable({ providedIn: 'root' })
export class PageElementsService {
  private readonly api = inject(ApiService);
  private readonly base = '/page-elements';

  search(request: SearchRequest): Observable<PaginatedResult<IPageElement>> {
    return this.api
      .post<ApiEnvelope<PaginatedResult<IPageElement>>, SearchRequest>(
        `${this.base}/search`,
        request,
      )
      .pipe(map((res) => res.data ?? EMPTY_PAGE<IPageElement>()));
  }

  listByFeature(featureId: string): Observable<IPageElement[]> {
    return this.api
      .get<ApiEnvelope<IPageElement[]>>(`${this.base}/by-feature/${featureId}`)
      .pipe(map((res) => res.data ?? []));
  }

  getById(id: string): Observable<IPageElement | null> {
    return this.api
      .get<ApiEnvelope<IPageElement>>(`${this.base}/${id}`)
      .pipe(map((res) => res.data ?? null));
  }

  create(payload: CreatePageElementPayload): Observable<IPageElement | null> {
    return this.api
      .post<ApiEnvelope<IPageElement>, CreatePageElementPayload>(
        this.base,
        payload,
      )
      .pipe(map((res) => res.data ?? null));
  }

  bulkCreate(payload: CreatePageElementPayload[]): Observable<IPageElement[]> {
    return this.api
      .post<
        ApiEnvelope<IPageElement[]>,
        { elements: CreatePageElementPayload[] }
      >(`${this.base}/bulk`, { elements: payload })
      .pipe(map((res) => res.data ?? []));
  }

  crawl(payload: CrawlPagePayload): Observable<IPageElement[]> {
    return this.api
      .post<ApiEnvelope<IPageElement[]>, CrawlPagePayload>(
        `${this.base}/crawl`,
        payload,
      )
      .pipe(map((res) => res.data ?? []));
  }

  pagesByFeature(featureId: string): Observable<PageGroup[]> {
    return this.api
      .get<ApiEnvelope<PageGroup[]>>(
        `${this.base}/by-feature/${featureId}/pages`,
      )
      .pipe(map((res) => res.data ?? []));
  }

  pomByFeature(
    featureId: string,
    framework: PomFramework,
  ): Observable<PomFile[]> {
    return this.api
      .get<ApiEnvelope<PomFile[]>>(
        `${this.base}/by-feature/${featureId}/pom?framework=${framework}`,
      )
      .pipe(map((res) => res.data ?? []));
  }

  startCapture(
    payload: StartCapturePayload,
  ): Observable<{ sessionId: string }> {
    return this.api
      .post<ApiEnvelope<{ sessionId: string }>, StartCapturePayload>(
        `${this.base}/capture/start`,
        payload,
      )
      .pipe(map((res) => res.data ?? { sessionId: '' }));
  }

  captureList(sessionId: string): Observable<CapturedElementDto[]> {
    return this.api
      .get<ApiEnvelope<CapturedElementDto[]>>(
        `${this.base}/capture/${sessionId}`,
      )
      .pipe(map((res) => res.data ?? []));
  }

  captureSave(sessionId: string): Observable<IPageElement[]> {
    return this.api
      .post<ApiEnvelope<IPageElement[]>, Record<string, never>>(
        `${this.base}/capture/${sessionId}/save`,
        {},
      )
      .pipe(map((res) => res.data ?? []));
  }

  captureStop(sessionId: string): Observable<{ count: number }> {
    return this.api
      .post<ApiEnvelope<{ count: number }>, Record<string, never>>(
        `${this.base}/capture/${sessionId}/stop`,
        {},
      )
      .pipe(map((res) => res.data ?? { count: 0 }));
  }

  update(
    id: string,
    payload: UpdatePageElementPayload,
  ): Observable<IPageElement | null> {
    return this.api
      .patch<ApiEnvelope<IPageElement>, UpdatePageElementPayload>(
        `${this.base}/${id}`,
        payload,
      )
      .pipe(map((res) => res.data ?? null));
  }

  remove(id: string): Observable<void> {
    return this.api
      .delete<ApiEnvelope<unknown>>(`${this.base}/${id}`)
      .pipe(map(() => undefined));
  }
}
