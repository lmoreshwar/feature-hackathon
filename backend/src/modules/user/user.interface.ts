import { IBaseCollection } from '../../interfaces/IBase';

export interface IUser extends IBaseCollection {
  email: string;
  passwordHash: string;
}

export type SafeUser = Omit<IUser, 'passwordHash'>;

export interface PaginatedUsers {
  items: SafeUser[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
