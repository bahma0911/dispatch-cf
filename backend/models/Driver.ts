import { model } from '../db';

export interface IDriver {
  _id?: string;
  name: string;
  phone: string;
  status: 'AVAILABLE' | 'BUSY' | 'INACTIVE';
  commissionBalance: number;
  createdAt?: string;
}

export const Driver = model('Driver');
