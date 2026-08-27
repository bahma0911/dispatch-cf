import { model } from '../db';

export interface IDriver {
  _id?: string;
  name: string;
  phone: string;
  status: 'AVAILABLE' | 'BUSY' | 'INACTIVE';
  commissionBalance: number;
  type?: 'REGULAR' | 'TEMPORARY';
  // For temporary drivers: admin-set total owed amount and runtime accumulated owed balance
  owedAmount?: number; // admin initial loan amount
  owedBalance?: number; // accumulated withheld commission toward repayment
  initialDeposit?: number; // initial deposit paid at creation (counts toward owedBalance)
  // Link to a User account created for the driver (optional)
  userId?: string;
  createdAt?: string;
}

export const Driver = model('Driver');
