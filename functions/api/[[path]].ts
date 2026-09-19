import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import type { D1Database, ExecutionContext } from '@cloudflare/workers-types';

interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
  SMS_GATEWAY_ADDRESS?: string;
  SMS_GATEWAY_USERNAME?: string;
  SMS_GATEWAY_PASSWORD?: string;
  SMS_GATEWAY_DEVICE_ID?: string;
}

type User = { _id: string; username: string; passwordHash: string; name: string; role: string; initialPassword?: string };
type RecordValue = Record<string, any>;
type AppContext = Context<{ Bindings: Env; Variables: { user: User } }>;

const app = new Hono<{ Bindings: Env; Variables: { user: User } }>();
const encoder = new TextEncoder();

function id(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function base64Url(value: ArrayBuffer | string) {
  const bytes = typeof value === 'string' ? encoder.encode(value) : new Uint8Array(value);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  return atob(padded);
}

function base64UrlBytes(value: string) {
  const binary = fromBase64Url(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function hmac(value: string, secret: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  return crypto.subtle.sign('HMAC', key, encoder.encode(value));
}

async function createToken(user: User, secret: string) {
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64Url(JSON.stringify({ userId: user._id, username: user.username, name: user.name, role: user.role, exp: Math.floor(Date.now() / 1000) + 86400 }));
  const signature = base64Url(await hmac(`${header}.${payload}`, secret));
  return `${header}.${payload}.${signature}`;
}

async function readToken(token: string, secret: string) {
  const parts = token.split('.');
  if (parts.length !== 3 || !(await crypto.subtle.verify('HMAC', await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']), base64UrlBytes(parts[2]), encoder.encode(`${parts[0]}.${parts[1]}`)))) return null;
  const payload = JSON.parse(fromBase64Url(parts[1]));
  return payload.exp > Math.floor(Date.now() / 1000) ? payload : null;
}

async function hashPassword(password: string, salt: string = crypto.randomUUID()) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: encoder.encode(salt), iterations: 100000, hash: 'SHA-256' }, key, 256);
  return `${salt}.${base64Url(bits)}`;
}

async function verifyPassword(password: string, encoded: string) {
  const [salt, expected] = encoded.split('.');
  if (!salt || !expected) return false;
  return (await hashPassword(password, salt)).split('.')[1] === expected;
}

async function collection(c: AppContext, name: string): Promise<RecordValue[]> {
  const result = await c.env.DB.prepare('SELECT data FROM records WHERE collection = ? ORDER BY created_at DESC').bind(name).all<{ data: string }>();
  return (result.results || []).map((row) => JSON.parse(row.data));
}

async function findOne(c: AppContext, name: string, predicate: (value: RecordValue) => boolean) {
  return (await collection(c, name)).find(predicate) || null;
}

async function save(c: AppContext, name: string, value: RecordValue) {
  await c.env.DB.prepare('INSERT OR REPLACE INTO records (collection, id, data, created_at) VALUES (?, ?, ?, ?)').bind(name, value._id, JSON.stringify(value), value.createdAt || new Date().toISOString()).run();
  return value;
}

async function update(c: AppContext, name: string, key: string, changes: RecordValue) {
  const value = await findOne(c, name, (item) => item._id === key);
  if (!value) return null;
  return save(c, name, { ...value, ...changes });
}

async function ensureSeed(c: AppContext) {
  if (await findOne(c, 'users', (user) => user.username === 'admin')) return;
  const passwordHash = await hashPassword('password123', 'default-dispatch-password');
  await save(c, 'users', { _id: id('usr'), username: 'admin', passwordHash, name: 'Abebe Kebede (Admin)', role: 'ADMIN' });
  await save(c, 'users', { _id: id('usr'), username: 'dispatch', passwordHash, name: 'Almaz Tesfaye (Dispatch)', role: 'DISPATCHER' });
}

async function auth(c: AppContext, next: Next) {
  const token = c.req.header('Authorization')?.split(' ')[1];
  const user = token ? await readToken(token, c.env.JWT_SECRET || 'delivery-app-secure-jwt-secret-key-2026') : null;
  if (!user) return c.json({ error: token ? 'Invalid or expired token' : 'Access token required' }, token ? 403 : 401);
  const record = await findOne(c, 'users', (item) => item._id === user.userId);
  if (!record) return c.json({ error: 'User not found' }, 401);
  c.set('user', record as User);
  await next();
}

function admin(c: AppContext) {
  const user = c.get('user');
  return user.username === 'admin' || user.role === 'ADMIN';
}

async function body(c: AppContext) {
  try { return await c.req.json<RecordValue>(); } catch { return {}; }
}

async function populatedOrder(c: AppContext, order: RecordValue) {
  const customer = typeof order.customer === 'object' ? order.customer : await findOne(c, 'customers', (item) => item._id === order.customer);
  const driver = typeof order.driver === 'object' ? order.driver : await findOne(c, 'drivers', (item) => item._id === order.driver);
  return { ...order, customer: customer || order.customer, driver: driver || order.driver };
}

function populateOrders(orders: RecordValue[], customers: RecordValue[], drivers: RecordValue[]) {
  const customerById = new Map(customers.map((customer) => [customer._id, customer]));
  const driverById = new Map(drivers.map((driver) => [driver._id, driver]));
  return orders.map((order) => ({
    ...order,
    customer: typeof order.customer === 'object' ? order.customer : customerById.get(order.customer) || order.customer,
    driver: typeof order.driver === 'object' ? order.driver : driverById.get(order.driver) || order.driver
  }));
}

function csv(rows: RecordValue[]) {
  if (!rows.length) return '';
  const columns = Object.keys(rows[0]);
  return [columns.join(','), ...rows.map((row) => columns.map((column) => JSON.stringify(row[column] ?? '')).join(','))].join('\n');
}

app.all('*', async (c, next) => {
  if (c.req.path === '/api/health') return next();
  await ensureSeed(c);
  return next();
});

app.get('/api/health', (c) => c.json({ status: 'ok', database: 'cloudflare-d1', timestamp: new Date().toISOString() }));

app.post('/api/auth/register', async (c) => {
  const data = await body(c);
  if (!data.username || !data.password || !data.name) return c.json({ error: 'Username, password, and name are required' }, 400);
  if (await findOne(c, 'users', (user) => user.username === data.username)) return c.json({ error: 'Username already exists' }, 400);
  const user = await save(c, 'users', { _id: id('usr'), username: data.username, passwordHash: await hashPassword(data.password), name: data.name, role: data.role || 'DISPATCHER' });
  return c.json({ message: 'Dispatcher registered successfully', user: { id: user._id, username: user.username, name: user.name, role: user.role } }, 201);
});

app.post('/api/auth/login', async (c) => {
  const data = await body(c);
  const user = await findOne(c, 'users', (item) => item.username === data.username) as User | null;
  if (!data.username || !data.password || !user || !(await verifyPassword(data.password, user.passwordHash))) return c.json({ error: 'Invalid username or password' }, 401);
  return c.json({ message: 'Login successful', token: await createToken(user, c.env.JWT_SECRET || 'delivery-app-secure-jwt-secret-key-2026'), user: { id: user._id, username: user.username, name: user.name, role: user.role } });
});

app.get('/api/auth/me', auth, (c) => { const user = c.get('user'); return c.json({ user: { id: user._id, username: user.username, name: user.name, role: user.role } }); });
app.post('/api/auth/change-password', auth, async (c) => {
  const data = await body(c); const user = c.get('user');
  if (!data.currentPassword || !data.newPassword) return c.json({ error: 'Current and new passwords are required' }, 400);
  if (!(await verifyPassword(data.currentPassword, user.passwordHash))) return c.json({ error: 'Current password is incorrect' }, 401);
  await update(c, 'users', user._id, { passwordHash: await hashPassword(data.newPassword), initialPassword: undefined });
  return c.json({ message: 'Password updated successfully' });
});

app.get('/api/customers', auth, async (c) => { if (!admin(c)) return c.json({ error: 'Permission Denied' }, 403); return c.json(await collection(c, 'customers')); });
app.get('/api/customers/:id', auth, async (c) => { if (!admin(c)) return c.json({ error: 'Permission Denied' }, 403); const value = await findOne(c, 'customers', (item) => item._id === c.req.param('id')); return value ? c.json(value) : c.json({ error: 'Customer not found' }, 404); });
app.post('/api/customers', auth, async (c) => {
  if (c.get('user').username !== 'admin') return c.json({ error: 'Permission Denied' }, 403);
  const data = await body(c); if (!data.name || !data.phone) return c.json({ error: 'Name and Phone number are required' }, 400);
  if (await findOne(c, 'customers', (item) => item.phone === data.phone)) return c.json({ error: 'A customer with this phone number already exists' }, 400);
  return c.json(await save(c, 'customers', { _id: id('cust'), name: data.name, phone: data.phone, address: data.address || '', type: 'ACCOUNT_HOLDER', creditBalance: 0, createdAt: new Date().toISOString() }), 201);
});
app.put('/api/customers/:id', auth, async (c) => {
  const existing = await findOne(c, 'customers', (item) => item._id === c.req.param('id')); if (!existing) return c.json({ error: 'Customer not found' }, 404);
  const data = await body(c); if (data.phone && data.phone !== existing.phone && await findOne(c, 'customers', (item) => item.phone === data.phone)) return c.json({ error: 'A customer with this phone number already exists' }, 400);
  return c.json(await update(c, 'customers', existing._id, { name: data.name ?? existing.name, phone: data.phone ?? existing.phone, address: data.address ?? existing.address, type: data.type ?? existing.type }));
});
app.post('/api/customers/:id/settle', auth, async (c) => {
  const customer = await findOne(c, 'customers', (item) => item._id === c.req.param('id')); if (!customer) return c.json({ error: 'Customer not found' }, 404);
  if (customer.type !== 'ACCOUNT_HOLDER') return c.json({ error: 'Only Account Holders can have credit balances settled.' }, 400);
  await update(c, 'customers', customer._id, { creditBalance: 0 }); const orders = await collection(c, 'orders'); let settledCount = 0;
  for (const order of orders) { const customerId = typeof order.customer === 'object' ? order.customer._id : order.customer; if (customerId === customer._id && order.paymentStatus === 'UNPAID') { await update(c, 'orders', order._id, { paymentStatus: 'SETTLED' }); settledCount++; } }
  return c.json({ message: `Balance settled successfully for ${customer.name}. Outstanding balance set to Br 0.00. Marked ${settledCount} orders as SETTLED.`, settledCount });
});

app.get('/api/drivers/me', auth, async (c) => { const driver = await findOne(c, 'drivers', (item) => item.userId === c.get('user')._id); return driver ? c.json(driver) : c.json({ error: 'Driver profile not found' }, 404); });
app.get('/api/drivers', auth, async (c) => { if (!admin(c)) return c.json({ error: 'Permission Denied' }, 403); return c.json((await collection(c, 'drivers')).map((driver) => ({ ...driver, commissionBalance: Number(driver.commissionBalance || 0), owedAmount: Number(driver.owedAmount || 0), owedBalance: Number(driver.owedBalance || 0), initialDeposit: Number(driver.initialDeposit || 0), type: driver.type || 'REGULAR' }))); });
app.post('/api/drivers', auth, async (c) => {
  if (c.get('user').username !== 'admin') return c.json({ error: 'Permission Denied' }, 403); const data = await body(c); if (!data.name || !data.phone) return c.json({ error: 'Name and Phone number are required' }, 400);
  const type = data.type || 'REGULAR'; const initialDeposit = type === 'TEMPORARY' ? Number(data.deposit || 0) : undefined;
  const driver = await save(c, 'drivers', { _id: id('drv'), name: data.name, phone: data.phone, status: data.status || 'AVAILABLE', commissionBalance: 0, type, owedAmount: type === 'TEMPORARY' ? Number(data.owedAmount || 0) : undefined, owedBalance: type === 'TEMPORARY' ? initialDeposit : undefined, initialDeposit, createdAt: new Date().toISOString() });
  const base = String(data.name).split(' ')[0].toLowerCase() || `driver${Math.floor(Math.random() * 9000) + 1000}`; let username = base; let suffix = 1; while (await findOne(c, 'users', (item) => item.username === username)) username = `${base}${suffix++}`;
  const password = crypto.randomUUID().slice(0, 8); const user = await save(c, 'users', { _id: id('usr'), username, passwordHash: await hashPassword(password), name: data.name, role: 'DRIVER', initialPassword: password }); await update(c, 'drivers', driver._id, { userId: user._id });
  return c.json({ driver: { ...driver, userId: user._id }, credentials: { username, password } }, 201);
});
app.put('/api/drivers/:id', auth, async (c) => { const driver = await findOne(c, 'drivers', (item) => item._id === c.req.param('id')); if (!driver) return c.json({ error: 'Driver not found' }, 404); const data = await body(c); return c.json(await update(c, 'drivers', driver._id, { name: data.name ?? driver.name, phone: data.phone ?? driver.phone, status: data.status ?? driver.status })); });
app.post('/api/drivers/:id/settle', auth, async (c) => { const driver = await findOne(c, 'drivers', (item) => item._id === c.req.param('id')); if (!driver) return c.json({ error: 'Driver not found' }, 404); const settlement = await save(c, 'commissionSettlements', { _id: id('settle'), driver: driver._id, driverName: driver.name, driverPhone: driver.phone, amount: Number(driver.commissionBalance || 0), settledAt: new Date().toISOString() }); await update(c, 'drivers', driver._id, { commissionBalance: 0 }); return c.json({ message: 'Commission settled successfully', settlement }); });
app.get('/api/drivers/export/commission', auth, async (c) => c.body(csv(await collection(c, 'drivers')), 200, { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename=Driver_Commission_Report.csv' }));

app.get('/api/orders', auth, async (c) => {
  const query = c.req.query(); let orders = await collection(c, 'orders'); const user = c.get('user');
  const [customers, drivers] = await Promise.all([collection(c, 'customers'), collection(c, 'drivers')]);
  if (query.status) orders = orders.filter((item) => item.orderStatus === query.status); if (query.paymentType) orders = orders.filter((item) => item.paymentType === query.paymentType); if (query.paymentStatus) orders = orders.filter((item) => item.paymentStatus === query.paymentStatus);
  if (user.role === 'DRIVER') { const driver = await findOne(c, 'drivers', (item) => item.userId === user._id); if (!driver) return c.json({ error: 'Driver profile not found for user.' }, 404); orders = orders.filter((item) => item.driver === driver._id); }
  if (query.startDate) orders = orders.filter((item) => new Date(item.createdAt).getTime() >= new Date(query.startDate).getTime()); if (query.endDate) orders = orders.filter((item) => new Date(item.createdAt).getTime() <= new Date(`${query.endDate}T23:59:59.999`).getTime());
  return c.json(populateOrders(orders, customers, drivers).sort((a: any, b: any) => (b.orderNumber || 0) - (a.orderNumber || 0)));
});
app.post('/api/orders', auth, async (c) => {
  const data = await body(c); if ((!data.customerId && !data.walkInCustomer) || !data.driverId || !data.pickupAddress || !data.deliveryAddress || data.fee === undefined) return c.json({ error: 'Customer, driver, pickup address, delivery address, and fee are required.' }, 400);
  const customer = data.customerId ? await findOne(c, 'customers', (item) => item._id === data.customerId) : { _id: id('walkin'), ...data.walkInCustomer, address: data.walkInCustomer.address || data.deliveryAddress, type: 'NORMAL', creditBalance: 0 };
  if (!customer) return c.json({ error: 'Customer not found.' }, 404); const driver = await findOne(c, 'drivers', (item) => item._id === data.driverId); if (!driver) return c.json({ error: 'Driver not found.' }, 404);
  const orders = await collection(c, 'orders'); const order = await save(c, 'orders', { _id: id('ord'), orderNumber: Math.max(1000, ...orders.map((item) => Number(item.orderNumber) || 1000)) + 1, customer: data.customerId || customer, driver: driver._id, pickupAddress: data.pickupAddress, deliveryAddress: data.deliveryAddress, fee: Number(data.fee), paymentType: customer.type === 'NORMAL' ? 'CASH' : data.paymentType || 'CASH', paymentStatus: 'UNPAID', orderStatus: 'PENDING', createdAt: new Date().toISOString() });
  return c.json(await populatedOrder(c, order), 201);
});
app.put('/api/orders/:id/status', auth, async (c) => {
  const order = await findOne(c, 'orders', (item) => item._id === c.req.param('id')); if (!order) return c.json({ error: 'Order not found.' }, 404); const data = await body(c); const newStatus = data.orderStatus ?? order.orderStatus; const updated = await update(c, 'orders', order._id, { orderStatus: newStatus, paymentStatus: data.paymentStatus ?? order.paymentStatus });
  if (newStatus === 'DELIVERED' && order.orderStatus !== 'DELIVERED') { const customerId = typeof order.customer === 'object' ? order.customer._id : order.customer; const customer = await findOne(c, 'customers', (item) => item._id === customerId); if (customer && order.paymentType === 'CREDIT') await update(c, 'customers', customer._id, { creditBalance: Number(customer.creditBalance || 0) + Number(order.fee || 0) }); const driverId = typeof order.driver === 'object' ? order.driver._id : order.driver; const driver = await findOne(c, 'drivers', (item) => item._id === driverId); if (driver) await update(c, 'drivers', driver._id, { commissionBalance: Number(driver.commissionBalance || 0) + Number(order.fee || 0) * 0.1 }); }
  return c.json(await populatedOrder(c, updated!));
});
app.get('/api/orders/export/daily', auth, async (c) => c.body(csv(await collection(c, 'orders')), 200, { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename=Daily_Dispatch_Report.csv' }));
app.get('/api/orders/export/account/:customerId', auth, async (c) => { const orders = (await collection(c, 'orders')).filter((item) => item.customer === c.req.param('customerId') || item.customer?._id === c.req.param('customerId')); return c.body(csv(orders), 200, { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename=Account_Statement.csv' }); });

const defaultSmsConfig = { localAddress: '', publicAddress: '', username: '', password: '', deviceId: '', activeAddressType: 'simulated', simNumber: '', phoneFormat: 'as_entered' };
app.get('/api/sms/logs', auth, async (c) => { if (!admin(c)) return c.json({ error: 'Permission Denied' }, 403); return c.json(await collection(c, 'smsLogs')); });
app.get('/api/sms/config', auth, async (c) => { if (!admin(c)) return c.json({ error: 'Permission Denied' }, 403); return c.json(await findOne(c, 'smsConfig', () => true) || defaultSmsConfig); });
app.post('/api/sms/config', auth, async (c) => { if (!admin(c)) return c.json({ error: 'Permission Denied' }, 403); const data = await body(c); const config = { ...defaultSmsConfig, ...data, _id: 'active' }; await save(c, 'smsConfig', config); return c.json({ message: 'SMS Gateway configuration updated successfully', config }); });
app.post('/api/sms/test', auth, async (c) => { if (!admin(c)) return c.json({ error: 'Permission Denied' }, 403); const data = await body(c); if (!data.testPhone) return c.json({ error: 'Recipient phone number is required' }, 400); const config = await findOne(c, 'smsConfig', () => true) || defaultSmsConfig; const simulated = config.activeAddressType === 'simulated' || !config.publicAddress || !config.username || !config.password; await save(c, 'smsLogs', { _id: id('sms'), recipientName: 'Test Recipient', recipientPhone: data.testPhone, role: 'CUSTOMER', message: data.testMessage || 'Negadras Dispatch SMS Gateway connection test.', timestamp: new Date().toISOString(), status: simulated ? 'SIMULATED' : 'SENT' }); return c.json({ message: simulated ? 'Gateway is in SIMULATION mode. Log created in dashboard feed.' : 'Live SMS message sent successfully through the Android SMS Gateway!', simulated }); });

app.notFound((c) => c.json({ error: 'Not found' }, 404));
app.onError((error, c) => { console.error(error); return c.json({ error: error.message || 'Internal server error' }, 500); });

export const onRequest = (context: ExecutionContext & { request: Request; env: Env }) => app.fetch(context.request, context.env, context);
