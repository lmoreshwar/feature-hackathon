import { Injectable } from '@angular/core';

import { AuthUser } from './auth.models';

/**
 * Encapsulates all storage of auth artifacts so that components and other
 * services never touch `localStorage` directly. Swap the storage backing here
 * (e.g. to a cookie or in-memory store) without touching the rest of the app.
 */
@Injectable({ providedIn: 'root' })
export class TokenService {
  private static readonly ACCESS_TOKEN_KEY = 'hk.accessToken';
  private static readonly REFRESH_TOKEN_KEY = 'hk.refreshToken';
  private static readonly USER_KEY = 'hk.user';

  private readonly storage: Storage | null = this.resolveStorage();

  getAccessToken(): string | null {
    return this.read(TokenService.ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return this.read(TokenService.REFRESH_TOKEN_KEY);
  }

  setAccessToken(token: string): void {
    this.write(TokenService.ACCESS_TOKEN_KEY, token);
  }

  setRefreshToken(token: string): void {
    this.write(TokenService.REFRESH_TOKEN_KEY, token);
  }

  setTokens(accessToken: string, refreshToken: string): void {
    this.setAccessToken(accessToken);
    this.setRefreshToken(refreshToken);
  }

  getUser(): AuthUser | null {
    const raw = this.read(TokenService.USER_KEY);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      this.remove(TokenService.USER_KEY);
      return null;
    }
  }

  setUser(user: AuthUser): void {
    this.write(TokenService.USER_KEY, JSON.stringify(user));
  }

  hasAccessToken(): boolean {
    return !!this.getAccessToken();
  }

  clear(): void {
    this.remove(TokenService.ACCESS_TOKEN_KEY);
    this.remove(TokenService.REFRESH_TOKEN_KEY);
    this.remove(TokenService.USER_KEY);
  }

  private resolveStorage(): Storage | null {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return null;
      }
      return window.localStorage;
    } catch {
      return null;
    }
  }

  private read(key: string): string | null {
    if (!this.storage) {
      return null;
    }
    try {
      return this.storage.getItem(key);
    } catch {
      return null;
    }
  }

  private write(key: string, value: string): void {
    if (!this.storage) {
      return;
    }
    try {
      this.storage.setItem(key, value);
    } catch {
      /* storage quota or access errors are intentionally swallowed */
    }
  }

  private remove(key: string): void {
    if (!this.storage) {
      return;
    }
    try {
      this.storage.removeItem(key);
    } catch {
      /* swallow */
    }
  }
}
