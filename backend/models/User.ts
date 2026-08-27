import { model } from '../db';

export interface IUser {
  _id?: string;
  username: string;
  passwordHash: string;
  name: string;
  role: 'DISPATCHER' | 'ADMIN' | 'DRIVER';
  createdAt?: string;
  // initial plain-text password returned to admin at creation time.
  // Cleared when the user updates their password.
  initialPassword?: string;
}

export const User = model('User');
