import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { ApiService } from '../../core/services/api.service';
import {
  CreateFeaturePayload,
  DeleteFeatureResponse,
  FeatureRecord,
  FeatureResponse,
  FeatureStatus,
  ListFeaturesResponse,
  PaginatedFeatures,
  UpdateFeaturePayload,
} from './features.models';

export interface ListFeaturesQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: FeatureStatus;
  createdBy?: string;
}

const EMPTY_PAGE: PaginatedFeatures = {
  items: [],
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 0,
};

@Injectable({ providedIn: 'root' })
export class FeaturesService {
  private readonly api = inject(ApiService);

  list(query: ListFeaturesQuery = {}): Observable<PaginatedFeatures> {
    return this.api
      .get<ListFeaturesResponse>('/features', {
        page: query.page,
        limit: query.limit,
        search: query.search?.trim() || undefined,
        status: query.status,
        createdBy: query.createdBy,
      })
      .pipe(map((res) => res.data ?? EMPTY_PAGE));
  }

  get(id: string): Observable<FeatureRecord | null> {
    return this.api
      .get<FeatureResponse>(`/features/${id}`)
      .pipe(map((res) => res.data ?? null));
  }

  create(payload: CreateFeaturePayload): Observable<FeatureRecord | null> {
    return this.api
      .post<FeatureResponse, CreateFeaturePayload>('/features', payload)
      .pipe(map((res) => res.data ?? null));
  }

  update(id: string, payload: UpdateFeaturePayload): Observable<FeatureRecord | null> {
    return this.api
      .patch<FeatureResponse, UpdateFeaturePayload>(`/features/${id}`, payload)
      .pipe(map((res) => res.data ?? null));
  }

  remove(id: string): Observable<void> {
    return this.api.delete<DeleteFeatureResponse>(`/features/${id}`).pipe(map(() => undefined));
  }
}
