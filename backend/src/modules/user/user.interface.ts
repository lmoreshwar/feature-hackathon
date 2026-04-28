import { IBaseCollection } from '../../interfaces/IBase';

export interface IUser extends IBaseCollection {
  email: string;
  passwordHash: string;
  refreshTokenHash?: string | null;
}

export type SafeUser = Omit<IUser, 'passwordHash' | 'refreshTokenHash'>;

export interface PaginatedUsers {
  items: SafeUser[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
