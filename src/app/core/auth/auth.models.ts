export interface LoginRequest {
  readonly email: string;
  readonly password: string;
}

export interface LoginResponse {
  readonly accessToken: string;
  readonly expiresMinutes: number;
  readonly accessTokenExpiresAtUtc: string;
  readonly refreshToken: string;
  readonly refreshTokenExpiresAtUtc: string;
  readonly email: string;
  readonly roles: readonly string[];
}

export interface CurrentUser {
  readonly userId: string;
  readonly email: string;
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
}
