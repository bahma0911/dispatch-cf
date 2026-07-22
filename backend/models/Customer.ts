import { model } from '../db';

export interface ICustomer {
  _id?: string;
  name: string;
  phone: string;
  address: string;
  type: 'NORMAL' | 'ACCOUNT_HOLDER';
  creditBalance: number;
  createdAt?: string;
}

export const Customer = model('Customer');
