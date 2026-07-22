import fs from 'fs';
import path from 'path';

// Simple helper to generate unique IDs
export function generateId(): string {
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
}

const DATA_DIR = path.join(process.cwd(), 'backend', 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');

// Ensure database directory and file exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

interface DbData {
  users: any[];
  customers: any[];
  drivers: any[];
  orders: any[];
  smsConfig?: any;
}

const defaultData: DbData = {
  users: [],
  smsConfig: {
    localAddress: 'https://api.sms-gate.app:443',
    publicAddress: 'https://api.sms-gate.app',
    username: '2U4EAD',
    password: 'opw1ykltcxnsa9',
    deviceId: 'VKcoNgx7H3sDBNGGHbq8Z',
    activeAddressType: 'public'
  },
  customers: [
    // Pre-seed some customers for testing
    {
      _id: 'cust-1',
      name: 'Chala Kebede',
      phone: '555-0101',
      address: 'Bole, Behind Friendship Mall, Addis Ababa',
      type: 'NORMAL',
      creditBalance: 0.0
    },
    {
      _id: 'cust-2',
      name: 'Ambo Mineral Water',
      phone: '555-0202',
      address: 'Lideta, Industrial Zone, Addis Ababa',
      type: 'ACCOUNT_HOLDER',
      creditBalance: 1250.0
    },
    {
      _id: 'cust-3',
      name: 'Marta Hailu',
      phone: '555-0303',
      address: 'Megenagna, Diaspora Building, Addis Ababa',
      type: 'NORMAL',
      creditBalance: 0.0
    }
  ],
  drivers: [
    // Pre-seed some drivers for testing
    {
      _id: 'drv-1',
      name: 'Dawit Hailu',
      phone: '555-1001',
      status: 'AVAILABLE'
    },
    {
      _id: 'drv-2',
      name: 'Selamawit Tekle',
      phone: '555-1002',
      status: 'AVAILABLE'
    },
    {
      _id: 'drv-3',
      name: 'Yared Yosef',
      phone: '555-1003',
      status: 'BUSY'
    }
  ],
  orders: [
    // Pre-seed some orders for testing
    {
      _id: 'ord-1',
      orderNumber: 1001,
      customer: 'cust-1',
      driver: 'drv-1',
      pickupAddress: 'Mercato, Shola',
      deliveryAddress: 'Bole, Behind Friendship Mall, Addis Ababa',
      fee: 150.0,
      paymentType: 'CASH',
      paymentStatus: 'PAID',
      orderStatus: 'DELIVERED',
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    },
    {
      _id: 'ord-2',
      orderNumber: 1002,
      customer: 'cust-2',
      driver: 'drv-2',
      pickupAddress: 'Lideta, Industrial Zone',
      deliveryAddress: 'Megenagna, Diaspora Building, Addis Ababa',
      fee: 450.0,
      paymentType: 'CREDIT',
      paymentStatus: 'UNPAID',
      orderStatus: 'DISPATCHED',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    }
  ]
};

// If file doesn't exist, seed it
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2), 'utf-8');
}

export class MockDatabase {
  private static load(): DbData {
    try {
      if (!fs.existsSync(DATA_FILE)) {
        return defaultData;
      }
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(raw);
    } catch (e) {
      console.error('Error loading mock database, resetting...', e);
      return defaultData;
    }
  }

  private static save(data: DbData): void {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.error('Error saving mock database', e);
    }
  }

  static getCollection(name: keyof DbData): any[] {
    const data = this.load();
    return data[name] || [];
  }

  static saveCollection(name: keyof DbData, items: any[]): void {
    const data = this.load();
    data[name] = items;
    this.save(data);
  }

  static clear(): void {
    this.save(defaultData);
  }

  static getSmsConfig(): any {
    const data = this.load();
    return (data as any).smsConfig || {
      localAddress: '',
      publicAddress: '',
      username: '',
      password: '',
      deviceId: '',
      activeAddressType: 'simulated'
    };
  }

  static saveSmsConfig(config: any): void {
    const data = this.load();
    (data as any).smsConfig = config;
    this.save(data);
  }
}

// Mimic a Mongoose Model
export class Model<T extends { _id?: string; [key: string]: any }> {
  constructor(private collectionName: keyof DbData) {}

  private getItems(): T[] {
    return MockDatabase.getCollection(this.collectionName);
  }

  private saveItems(items: T[]): void {
    MockDatabase.saveCollection(this.collectionName, items);
  }

  async find(query: Partial<T> | ((item: T) => boolean) = {}): Promise<T[]> {
    const items = this.getItems();
    if (typeof query === 'function') {
      return items.filter(query);
    }
    return items.filter((item) => {
      for (const key in query) {
        if (query[key] !== undefined && item[key] !== query[key]) {
          return false;
        }
      }
      return true;
    });
  }

  async findOne(query: Partial<T> | ((item: T) => boolean) = {}): Promise<T | null> {
    const results = await this.find(query);
    return results.length > 0 ? results[0] : null;
  }

  async findById(id: string): Promise<T | null> {
    return this.findOne({ _id: id } as any);
  }

  async create(doc: Omit<T, '_id'> & { _id?: string }): Promise<T> {
    const items = this.getItems();
    const newDoc = {
      _id: doc._id || generateId(),
      ...doc,
      createdAt: doc.createdAt || new Date().toISOString()
    } as unknown as T;

    // Handle auto-increment order number for orders
    if (this.collectionName === 'orders' && !newDoc.orderNumber) {
      const maxNum = items.reduce((max, item: any) => Math.max(max, Number(item.orderNumber) || 1000), 1000);
      (newDoc as any).orderNumber = maxNum + 1;
    }

    items.push(newDoc);
    this.saveItems(items);
    return newDoc;
  }

  async findByIdAndUpdate(id: string, update: Partial<T>): Promise<T | null> {
    const items = this.getItems();
    const index = items.findIndex((item) => item._id === id);
    if (index === -1) return null;

    const updated = {
      ...items[index],
      ...update
    };
    items[index] = updated;
    this.saveItems(items);
    return updated;
  }

  async updateOne(query: Partial<T>, update: Partial<T>): Promise<{ modifiedCount: number }> {
    const items = this.getItems();
    let modifiedCount = 0;
    const updatedItems = items.map((item) => {
      let matches = true;
      for (const key in query) {
        if (item[key] !== query[key]) {
          matches = false;
          break;
        }
      }
      if (matches) {
        modifiedCount++;
        return { ...item, ...update };
      }
      return item;
    });

    if (modifiedCount > 0) {
      this.saveItems(updatedItems);
    }
    return { modifiedCount };
  }

  async countDocuments(query: Partial<T> = {}): Promise<number> {
    const results = await this.find(query);
    return results.length;
  }

  // Populate references
  async populate(items: any[], paths: string | string[]): Promise<any[]> {
    const fields = Array.isArray(paths) ? paths : [paths];
    const result = [...items];

    for (const field of fields) {
      if (field === 'customer') {
        const customers = MockDatabase.getCollection('customers');
        for (const item of result) {
          if (typeof item.customer === 'string') {
            item.customer = customers.find((c) => c._id === item.customer) || item.customer;
          }
        }
      } else if (field === 'driver') {
        const drivers = MockDatabase.getCollection('drivers');
        for (const item of result) {
          if (typeof item.driver === 'string') {
            item.driver = drivers.find((d) => d._id === item.driver) || item.driver;
          }
        }
      }
    }
    return result;
  }
}

// Schema and connection mock to satisfy Mongoose requirements
export const Schema = class {};
export const model = (name: string, schema?: any) => {
  const collectionMap: { [key: string]: keyof DbData } = {
    Customer: 'customers',
    Driver: 'drivers',
    Order: 'orders',
    User: 'users'
  };
  return new Model(collectionMap[name] || (name.toLowerCase() + 's' as keyof DbData));
};

export const mongooseMock = {
  Schema,
  model,
  connect: async () => console.log('Mock MongoDB Connected Successfully (File-based)'),
  connection: {
    readyState: 1
  }
};
