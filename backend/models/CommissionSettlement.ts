import { model } from '../db';

export interface ICommissionSettlement {
  _id?: string;
  driver: string;
  driverName: string;
  driverPhone: string;
  amount: number;
  settledAt?: string;
}

export const CommissionSettlement = model('CommissionSettlement');