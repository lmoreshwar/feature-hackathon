import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, EMPTY, Observable, catchError, map, of, tap } from 'rxjs';

import { ApiService } from '../services/api.service';
import {
  ApiEnvelope,
  AuthSession,
  AuthUser,
  LoginRequest,
  LoginResponse,
  MeResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
} from './auth.models';
import { TokenService } from './token.service';

/**
 * Single source of truth for the user's authentication state.
 *
 * - Exposes a reactive `currentUser` signal/observable for UI binding.
 * - Centralises the login / logout / refresh / me HTTP calls so no other
 *   service or component talks to the auth endpoints directly.
 * - Surfaces a single `refreshAccessToken$` observable that the
 *   `authInterceptor` can subscribe to without spawning concurrent refresh
 *   calls (handled inside the interceptor via shared state).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly tokenService = inject(TokenService);
  private readonly router = inject(Router);

  private readonly userState = signal<AuthUser | null>(this.tokenService.getUser());

  readonly currentUser = this.userState.asReadonly();
  readonly isAuthenticated = computed(() => !!this.userState());

  private readonly userSubject = new BehaviorSubject<AuthUser | null>(this.tokenService.getUser());
  readonly currentUser$ = this.userSubject.asObservable();

  login(payload: LoginRequest): Observable<AuthSession> {
    return this.api.post<LoginResponse, LoginRequest>('/auth/login', payload).pipe(
      map((response) => this.extractSession(response)),
      tap((session) => this.persistSession(session)),
    );
  }

  logout(): Observable<void> {
    const hasToken = this.tokenService.hasAccessToken();

    const request$: Observable<unknown> = hasToken
      ? this.api.post<ApiEnvelope<unknown>>('/auth/logout', {}).pipe(
          catchError(() => of(null)),
        )
      : of(null);

    return request$.pipe(
      map(() => undefined),
      tap(() => {
        this.clearSession();
        void this.router.navigate(['/login']);
      }),
    );
  }

  /**
   * Clears the local session without touching the network. Used by the auth
   * interceptor when refresh fails so that we do not get into an infinite
   * 401 → refresh → 401 loop.
   */
  forceLogout(redirect = true): void {
    this.clearSession();
    if (redirect) {
      void this.router.navigate(['/login']);
    }
  }

  loadProfile(): Observable<AuthUser | null> {
    if (!this.tokenService.hasAccessToken()) {
      return of(null);
    }

    return this.api.get<MeResponse>('/auth/me').pipe(
      map((response) => response.data ?? null),
      tap((user) => {
        if (user) {
          this.tokenService.setUser(user);
          this.userState.set(user);
          this.userSubject.next(user);
        }
      }),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          this.clearSession();
        }
        return EMPTY;
      }),
    );
  }

  /**
   * Calls the refresh endpoint and updates stored tokens. Returns the new
   * access token so callers (e.g. the interceptor) can replay the original
   * request. Emits an error if no refresh token is available or the refresh
   * call fails.
   */
  refreshAccessToken(): Observable<string> {
    const refreshToken = this.tokenService.getRefreshToken();
    if (!refreshToken) {
      return new Observable<string>((subscriber) => {
        subscriber.error(new Error('No refresh token available'));
      });
    }

    const body: RefreshTokenRequest = { refreshToken };

    return this.api
      .post<RefreshTokenResponse, RefreshTokenRequest>('/auth/refresh', body)
      .pipe(
        map((response) => {
          const data = response.data;
          if (!data) {
            throw new Error('Invalid refresh response');
          }

          const newAccessToken = data.tokens?.accessToken ?? data.accessToken;
          if (!newAccessToken) {
            throw new Error('Refresh response did not contain an access token');
          }

          const newRefreshToken = data.tokens?.refreshToken ?? data.refreshToken ?? refreshToken;
          this.tokenService.setTokens(newAccessToken, newRefreshToken);

          if (data.user) {
            this.tokenService.setUser(data.user);
            this.userState.set(data.user);
            this.userSubject.next(data.user);
          }

          return newAccessToken;
        }),
      );
  }

  hydrateFromStorage(): void {
    const user = this.tokenService.getUser();
    this.userState.set(user);
    this.userSubject.next(user);
  }

  private extractSession(response: LoginResponse): AuthSession {
    const data = response.data;
    if (!data) {
      throw new Error(response.message ?? 'Login failed: empty response');
    }

    const accessToken = data.tokens?.accessToken;
    const refreshToken = data.tokens?.refreshToken;
    const user = data.user;

    if (!accessToken || !refreshToken || !user) {
      throw new Error('Login failed: malformed response');
    }

    return { user, accessToken, refreshToken };
  }

  private persistSession(session: AuthSession): void {
    this.tokenService.setTokens(session.accessToken, session.refreshToken);
    this.tokenService.setUser(session.user);
    this.userState.set(session.user);
    this.userSubject.next(session.user);
  }

  private clearSession(): void {
    this.tokenService.clear();
    this.userState.set(null);
    this.userSubject.next(null);
  }
}
