import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';

import { TokenService } from './token.service';

export const guestGuard: CanActivateFn = (): boolean | UrlTree => {
  const router = inject(Router);
  const tokenService = inject(TokenService);

  if (tokenService.hasAccessToken()) {
    return router.createUrlTree(['/dashboard']);
  }

  return true;
};
