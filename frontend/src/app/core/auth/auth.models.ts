/**
 * Strongly-typed contracts shared by the auth layer.
 *
 * The shapes mirror the actual NestJS backend responses (see
 * `backend/src/modules/auth/auth.controller.ts`). The backend wraps every
 * payload with `{ success, message, data }`, and `data` for auth endpoints
 * carries a nested `user` + `tokens` object.
 */

export interface AuthUser {
  _id: string;
  email: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn?: string;
  refreshTokenExpiresIn?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface AuthResponseData {
  user: AuthUser;
  tokens: TokenPair;
}

export interface RefreshTokenResponseData {
  /**
   * Backend currently returns the full `AuthResponseData` on refresh, but we
   * keep the loose shape so we can also support a future flat
   * `{ accessToken, refreshToken? }` response without breaking callers.
   */
  user?: AuthUser;
  tokens?: TokenPair;
  accessToken?: string;
  refreshToken?: string;
}

export interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: unknown;
}

export type LoginResponse = ApiEnvelope<AuthResponseData>;
export type SignupResponse = ApiEnvelope<AuthUser>;
export type RefreshTokenResponse = ApiEnvelope<RefreshTokenResponseData>;
export type MeResponse = ApiEnvelope<AuthUser>;

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}
