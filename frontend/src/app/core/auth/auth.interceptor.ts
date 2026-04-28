import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { BehaviorSubject, Observable, catchError, filter, switchMap, take, throwError } from 'rxjs';

import { ApiService } from '../services/api.service';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';

/**
 * Marker so that we never try to refresh a refresh-call (would loop forever).
 * Also used to skip retrying the login/logout endpoints, which legitimately
 * return 401 on bad credentials and should be surfaced to the UI.
 */
const SKIP_AUTH_PATHS = ['/auth/login', '/auth/refresh', '/auth/logout'];

/**
 * Module-scoped state shared by every invocation of the interceptor so that
 * concurrent requests during a token refresh queue up behind the in-flight
 * refresh and replay automatically once the new access token is available.
 */
let isRefreshing = false;
const refreshedToken$ = new BehaviorSubject<string | null>(null);

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokenService = inject(TokenService);
  const authService = inject(AuthService);
  const api = inject(ApiService);

  const isApiCall = req.url.startsWith(api.url(''));
  const skipAuth = SKIP_AUTH_PATHS.some((path) => req.url.includes(path));

  const authedRequest =
    isApiCall && tokenService.hasAccessToken() && !skipAuth
      ? attachToken(req, tokenService.getAccessToken() as string)
      : req;

  return next(authedRequest).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        isApiCall &&
        !skipAuth
      ) {
        return handle401(req, next, authService, tokenService);
      }
      return throwError(() => error);
    }),
  );
};

function attachToken(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });
}

function handle401(
  originalRequest: HttpRequest<unknown>,
  next: HttpHandlerFn,
  authService: AuthService,
  tokenService: TokenService,
): Observable<HttpEvent<unknown>> {
  if (!tokenService.getRefreshToken()) {
    authService.forceLogout();
    return throwError(() => new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' }));
  }

  if (isRefreshing) {
    return refreshedToken$.pipe(
      filter((token): token is string => token !== null),
      take(1),
      switchMap((token) => next(attachToken(originalRequest, token))),
    );
  }

  isRefreshing = true;
  refreshedToken$.next(null);

  return authService.refreshAccessToken().pipe(
    switchMap((newToken) => {
      isRefreshing = false;
      refreshedToken$.next(newToken);
      return next(attachToken(originalRequest, newToken));
    }),
    catchError((refreshError: unknown) => {
      isRefreshing = false;
      refreshedToken$.next(null);
      authService.forceLogout();
      return throwError(() => refreshError);
    }),
  );
}
