import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { Driver } from '../models/Driver';
import { Order } from '../models/Order';
import { CommissionSettlement } from '../models/CommissionSettlement';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { generateDriverCommissionExcel } from '../utils/excelExport';

const router = Router();

// Export commission report (admin only)
router.get('/export/commission', authenticateToken, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    if (authReq.user?.username !== 'admin' && authReq.user?.role !== 'ADMIN') {
      res.status(403).json({ error: 'Permission Denied' });
      return;
    }

    const drivers = await Driver.find();
    const orders = await Order.find({ orderStatus: 'DELIVERED' });
    const populatedOrders = await Order.populate(orders, ['driver']);
    populatedOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const settlements = await CommissionSettlement.find();
    settlements.sort((a, b) => new Date(b.settledAt).getTime() - new Date(a.settledAt).getTime());

    const buffer = generateDriverCommissionExcel(drivers, populatedOrders, settlements);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=Driver_Commission_Report.xlsx');
    res.end(buffer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// List all drivers (admin only)
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    if (authReq.user?.username !== 'admin' && authReq.user?.role !== 'ADMIN') {
      res.status(403).json({ error: 'Permission Denied: Only admin users can list drivers.' });
      return;
    }

    const list = await Driver.find();
    res.json(list.map((driver) => ({
      ...driver,
      commissionBalance: Number(driver.commissionBalance || 0),
      owedAmount: Number(driver.owedAmount || 0),
      owedBalance: Number(driver.owedBalance || 0),
      initialDeposit: Number(driver.initialDeposit || 0),
      type: driver.type || 'REGULAR'
    })));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create driver (admin only)
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    if (authReq.user?.username !== 'admin') {
      res.status(403).json({ error: 'Permission Denied: Only the admin user can register drivers.' });
      return;
    }

    const { name, phone, status, type, owedAmount, deposit } = req.body;
    if (!name || !phone) {
      res.status(400).json({ error: 'Name and Phone number are required' });
      return;
    }

    const initialDeposit = type === 'TEMPORARY' ? Number(deposit || 0) : undefined;

    const createdDriver = await Driver.create({
      name,
      phone,
      status: status || 'AVAILABLE',
      commissionBalance: 0,
      type: type || 'REGULAR',
      owedAmount: type === 'TEMPORARY' ? Number(owedAmount || 0) : undefined,
      owedBalance: type === 'TEMPORARY' ? Number(initialDeposit || 0) : undefined,
      initialDeposit: initialDeposit
    });

    // create linked user account
    const firstName = (name || '').split(' ')[0].toLowerCase() || `driver${Math.floor(Math.random() * 9000) + 1000}`;
    let username = firstName;
    let suffix = 1;
    while (await User.findOne({ username })) {
      username = `${firstName}${suffix}`;
      suffix++;
    }

    const rawPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-2);
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    const user = await User.create({
      username,
      passwordHash,
      name: name,
      role: 'DRIVER',
      initialPassword: rawPassword
    });

    await Driver.findByIdAndUpdate(createdDriver._id, { userId: user._id });

    res.status(201).json({ driver: createdDriver, credentials: { username, password: rawPassword } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get current logged-in driver's profile
router.get('/me', authenticateToken, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (authReq.user.role !== 'DRIVER') {
      res.status(403).json({ error: 'Permission Denied: Only driver accounts may access this resource.' });
      return;
    }

    const driver = await Driver.findOne((d: any) => d.userId === authReq.user!.userId || String(d.userId) === String(authReq.user!.userId));
    if (!driver) {
      res.status(404).json({ error: 'Driver profile not found for user.' });
      return;
    }

    res.json({
      driver: {
        ...driver,
        commissionBalance: Number(driver.commissionBalance || 0),
        owedAmount: Number(driver.owedAmount || 0),
        owedBalance: Number(driver.owedBalance || 0),
        initialDeposit: Number(driver.initialDeposit || 0),
        type: driver.type || 'REGULAR'
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific driver (admin or driver viewing own)
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    if (authReq.user?.username !== 'admin' && authReq.user?.role !== 'ADMIN') {
      // if driver, allow only their own record
      if (authReq.user?.role === 'DRIVER') {
        const ownDriver = await Driver.findOne((d: any) => d.userId === authReq.user!.userId || String(d.userId) === String(authReq.user!.userId));
        if (!ownDriver || ownDriver._id !== req.params.id) {
          res.status(403).json({ error: 'Permission Denied: Drivers may only view their own profile.' });
          return;
        }
      } else {
        res.status(403).json({ error: 'Permission Denied' });
        return;
      }
    }

    const driver = await Driver.findById(req.params.id);
    if (!driver) {
      res.status(404).json({ error: 'Driver not found' });
      return;
    }

    const user = driver.userId ? await User.findById(driver.userId) : null;

    res.json({
      driver: {
        ...driver,
        commissionBalance: Number(driver.commissionBalance || 0),
        owedAmount: Number(driver.owedAmount || 0),
        owedBalance: Number(driver.owedBalance || 0),
        initialDeposit: Number(driver.initialDeposit || 0),
        type: driver.type || 'REGULAR'
      },
      user: user ? { username: user.username, initialPassword: user.initialPassword } : null
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update driver profile (admin or driver self)
router.put('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const existing = await Driver.findById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Driver not found' });
      return;
    }

    if (authReq.user?.username !== 'admin' && authReq.user?.role !== 'ADMIN') {
      // allow driver to update only their own record
      if (authReq.user?.role === 'DRIVER') {
        const ownDriver = await Driver.findOne((d: any) => d.userId === authReq.user!.userId || String(d.userId) === String(authReq.user!.userId));
        if (!ownDriver || ownDriver._id !== req.params.id) {
          res.status(403).json({ error: 'Permission Denied' });
          return;
        }
      } else {
        res.status(403).json({ error: 'Permission Denied' });
        return;
      }
    }

    const { name, phone, status } = req.body;
    const updated = await Driver.findByIdAndUpdate(req.params.id, {
      name: name ?? existing.name,
      phone: phone ?? existing.phone,
      status: status ?? existing.status,
      commissionBalance: Number(existing.commissionBalance || 0)
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Settle driver commission (admin only)
router.post('/:id/settle', authenticateToken, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    if (authReq.user?.username !== 'admin' && authReq.user?.role !== 'ADMIN') {
      res.status(403).json({ error: 'Permission Denied' });
      return;
    }

    const driver = await Driver.findById(req.params.id);
    if (!driver) {
      res.status(404).json({ error: 'Driver not found' });
      return;
    }

    const amount = Number(driver.commissionBalance || 0);
    if (amount > 0) {
      await CommissionSettlement.create({
        driver: driver._id,
        driverName: driver.name,
        driverPhone: driver.phone,
        amount,
        settledAt: new Date().toISOString()
      });
    }

    await Driver.findByIdAndUpdate(req.params.id, { commissionBalance: 0.0 });

    res.json({ message: `Commission settled successfully for ${driver.name}. Balance reset to Br 0.00.` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

// Record a manual repayment toward a temporary driver's owed amount (admin only)
router.post('/:id/repay', authenticateToken, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    if (authReq.user?.username !== 'admin' && authReq.user?.role !== 'ADMIN') {
      res.status(403).json({ error: 'Permission Denied' });
      return;
    }

    const { amount } = req.body;
    const pay = Number(amount || 0);
    if (!pay || pay <= 0) {
      res.status(400).json({ error: 'A positive repayment amount is required' });
      return;
    }

    const driver = await Driver.findById(req.params.id);
    if (!driver) {
      res.status(404).json({ error: 'Driver not found' });
      return;
    }

    const newOwedBalance = Number(driver.owedBalance || 0) + pay;
    await Driver.findByIdAndUpdate(driver._id, { owedBalance: newOwedBalance });

    res.json({ message: 'Repayment recorded', owedAmount: driver.owedAmount, owedBalance: newOwedBalance });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
