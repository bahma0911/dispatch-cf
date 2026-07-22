import { model } from '../db';

export interface IOrder {
  _id?: string;
  orderNumber?: number;
  customer: string | any; // Ref: Customer id or inline walk-in customer object
  driver: string; // Ref: Driver id
  pickupAddress: string;
  deliveryAddress: string;
  fee: number;
  paymentType: 'CASH' | 'CREDIT';
  paymentStatus: 'UNPAID' | 'PAID' | 'SETTLED';
  orderStatus: 'PENDING' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED';
  createdAt?: string;
}

export const Order = model('Order');
