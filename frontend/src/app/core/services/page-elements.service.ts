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
