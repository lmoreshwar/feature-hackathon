import { ApiEnvelope } from '../../core/auth/auth.models';

export interface UserRecord {
  _id: string;
  email: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaginatedUsers {
  items: UserRecord[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export type ListUsersResponse = ApiEnvelope<PaginatedUsers>;
export type UserResponse = ApiEnvelope<UserRecord>;
export type DeleteUserResponse = ApiEnvelope<{ deleted: boolean } | unknown>;

export interface CreateUserPayload {
  email: string;
  password: string;
}

export interface UpdateUserPayload {
  email?: string;
  password?: string;
}
