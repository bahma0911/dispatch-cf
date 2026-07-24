export interface Customer {
  _id: string;
  name: string;
  phone: string;
  address: string;
  type: 'NORMAL' | 'ACCOUNT_HOLDER';
  creditBalance: number;
}

export interface Driver {
  _id: string;
  name: string;
  phone: string;
  status: 'AVAILABLE' | 'BUSY' | 'INACTIVE';
  commissionBalance: number;
}

export interface Order {
  _id: string;
  orderNumber?: number;
  customer: Customer | string;
  driver: Driver | string;
  pickupAddress: string;
  deliveryAddress: string;
  fee: number;
  paymentType: 'CASH' | 'CREDIT';
  paymentStatus: 'UNPAID' | 'PAID' | 'SETTLED';
  orderStatus: 'PENDING' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED';
  createdAt: string;
}

export interface User {
  id: string;
  username: string;
  name: string;
  role: string;
}

export interface SmsLog {
  id: string;
  recipientName: string;
  recipientPhone: string;
  role: 'CUSTOMER' | 'DRIVER';
  message: string;
  timestamp: string;
  status: 'SENT' | 'SIMULATED' | 'FAILED';
  error?: string;
}
