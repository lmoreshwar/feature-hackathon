import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import {
  ApiEnvelope,
  CreateRequirementPayload,
  EMPTY_PAGE,
  IRequirementSource,
  PaginatedResult,
  SearchRequest,
  UpdateRequirementPayload,
} from '../models';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class RequirementsService {
  private readonly api = inject(ApiService);
  private readonly base = '/requirements';

  search(request: SearchRequest): Observable<PaginatedResult<IRequirementSource>> {
    return this.api
      .post<ApiEnvelope<PaginatedResult<IRequirementSource>>, SearchRequest>(
        `${this.base}/search`,
        request,
      )
      .pipe(map((res) => res.data ?? EMPTY_PAGE<IRequirementSource>()));
  }

  listByFeature(featureId: string): Observable<IRequirementSource[]> {
    return this.api
      .get<ApiEnvelope<IRequirementSource[]>>(
        `${this.base}/by-feature/${featureId}`,
      )
      .pipe(map((res) => res.data ?? []));
  }

  getById(id: string): Observable<IRequirementSource | null> {
    return this.api
      .get<ApiEnvelope<IRequirementSource>>(`${this.base}/${id}`)
      .pipe(map((res) => res.data ?? null));
  }

  create(
    payload: CreateRequirementPayload,
  ): Observable<IRequirementSource | null> {
    return this.api
      .post<ApiEnvelope<IRequirementSource>, CreateRequirementPayload>(
        this.base,
        payload,
      )
      .pipe(map((res) => res.data ?? null));
  }

  update(
    id: string,
    payload: UpdateRequirementPayload,
  ): Observable<IRequirementSource | null> {
    return this.api
      .patch<ApiEnvelope<IRequirementSource>, UpdateRequirementPayload>(
        `${this.base}/${id}`,
        payload,
      )
      .pipe(map((res) => res.data ?? null));
  }

  markProcessed(id: string): Observable<IRequirementSource | null> {
    return this.api
      .post<ApiEnvelope<IRequirementSource>>(`${this.base}/${id}/mark-processed`)
      .pipe(map((res) => res.data ?? null));
  }

  markFailed(id: string): Observable<IRequirementSource | null> {
    return this.api
      .post<ApiEnvelope<IRequirementSource>>(`${this.base}/${id}/mark-failed`)
      .pipe(map((res) => res.data ?? null));
  }

  remove(id: string): Observable<void> {
    return this.api
      .delete<ApiEnvelope<unknown>>(`${this.base}/${id}`)
      .pipe(map(() => undefined));
  }
}
