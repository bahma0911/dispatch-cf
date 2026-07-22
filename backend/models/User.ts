import { model } from '../db';

export interface IUser {
  _id?: string;
  username: string;
  passwordHash: string;
  name: string;
  role: 'DISPATCHER' | 'ADMIN';
  createdAt?: string;
}

export const User = model('User');
