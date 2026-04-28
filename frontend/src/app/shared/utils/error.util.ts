import { HttpErrorResponse } from '@angular/common/http';

import { formatError } from '../../core/interceptors/error.interceptor';

export function toErrorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    return formatError(error);
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}
