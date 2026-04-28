import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import {
  ApiEnvelope,
  CreateFeaturePayload,
  EMPTY_PAGE,
  IFeature,
  PaginatedResult,
  SearchRequest,
  UpdateFeaturePayload,
} from '../models';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class FeaturesService {
  private readonly api = inject(ApiService);
  private readonly base = '/features';

  search(request: SearchRequest): Observable<PaginatedResult<IFeature>> {
    return this.api
      .post<ApiEnvelope<PaginatedResult<IFeature>>, SearchRequest>(
        `${this.base}/search`,
        request,
      )
      .pipe(map((res) => res.data ?? EMPTY_PAGE<IFeature>()));
  }

  getById(id: string): Observable<IFeature | null> {
    return this.api
      .get<ApiEnvelope<IFeature>>(`${this.base}/${id}`)
      .pipe(map((res) => res.data ?? null));
  }

  create(payload: CreateFeaturePayload): Observable<IFeature | null> {
    return this.api
      .post<ApiEnvelope<IFeature>, CreateFeaturePayload>(this.base, payload)
      .pipe(map((res) => res.data ?? null));
  }

  update(
    id: string,
    payload: UpdateFeaturePayload,
  ): Observable<IFeature | null> {
    return this.api
      .patch<ApiEnvelope<IFeature>, UpdateFeaturePayload>(
        `${this.base}/${id}`,
        payload,
      )
      .pipe(map((res) => res.data ?? null));
  }

  archive(id: string): Observable<IFeature | null> {
    return this.api
      .post<ApiEnvelope<IFeature>>(`${this.base}/${id}/archive`)
      .pipe(map((res) => res.data ?? null));
  }

  remove(id: string): Observable<void> {
    return this.api
      .delete<ApiEnvelope<unknown>>(`${this.base}/${id}`)
      .pipe(map(() => undefined));
  }
}
