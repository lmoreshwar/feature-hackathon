import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { NzMessageService } from 'ng-zorro-antd/message';
import { catchError, throwError } from 'rxjs';

interface ServerErrorBody {
  message?: string | string[];
  error?: string;
  success?: boolean;
}

const SILENT_PATHS = ['/auth/login', '/auth/refresh', '/auth/me'];

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const message = inject(NzMessageService);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        const silent = SILENT_PATHS.some((path) => req.url.includes(path));
        if (!silent) {
          const text = formatError(error);
          if (text) {
            message.error(text);
          }
        }
      }
      return throwError(() => error);
    }),
  );
};

export function formatError(error: HttpErrorResponse): string {
  if (error.status === 0) {
    return 'Cannot reach the server. Please check your connection.';
  }

  const body = (error.error ?? {}) as ServerErrorBody;
  const raw = body.message ?? body.error ?? error.statusText;

  if (Array.isArray(raw)) {
    return raw.join(', ');
  }

  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw;
  }

  return `Request failed with status ${error.status}`;
}
