import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export type HttpQueryParams = Record<
  string,
  string | number | boolean | ReadonlyArray<string | number | boolean> | null | undefined
>;

/**
 * Thin wrapper around `HttpClient` that centralises the API base URL and
 * shields components from having to know absolute endpoint paths.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl.replace(/\/+$/, '');

  get<T>(path: string, params?: HttpQueryParams): Observable<T> {
    return this.http.get<T>(this.url(path), { params: this.buildParams(params) });
  }

  post<T, B = unknown>(path: string, body?: B, params?: HttpQueryParams): Observable<T> {
    return this.http.post<T>(this.url(path), body ?? {}, { params: this.buildParams(params) });
  }

  put<T, B = unknown>(path: string, body?: B): Observable<T> {
    return this.http.put<T>(this.url(path), body ?? {});
  }

  patch<T, B = unknown>(path: string, body?: B): Observable<T> {
    return this.http.patch<T>(this.url(path), body ?? {});
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(this.url(path));
  }

  url(path: string): string {
    const normalised = path.startsWith('/') ? path : `/${path}`;
    return `${this.baseUrl}${normalised}`;
  }

  private buildParams(params?: HttpQueryParams): HttpParams | undefined {
    if (!params) {
      return undefined;
    }

    let httpParams = new HttpParams();
    for (const [key, value] of Object.entries(params)) {
      if (value === null || value === undefined) {
        continue;
      }

      if (Array.isArray(value)) {
        for (const item of value) {
          httpParams = httpParams.append(key, String(item));
        }
        continue;
      }

      httpParams = httpParams.set(key, String(value));
    }

    return httpParams;
  }
}
