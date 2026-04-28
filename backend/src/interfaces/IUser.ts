import { IBaseCollection } from './IBase';

// =====================================================
// USER
// =====================================================


export interface IUser extends IBaseCollection {
  email: string;
  passwordHash: string;
}
