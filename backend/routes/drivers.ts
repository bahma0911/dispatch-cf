import { Router, Request, Response } from 'express';
import { Driver } from '../models/Driver';
import { Order } from '../models/Order';
import { CommissionSettlement } from '../models/CommissionSettlement';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { generateDriverCommissionExcel } from '../utils/excelExport';

const router = Router();

/**
 * @route GET /api/drivers/export/commission
 * @desc Export driver commission summary and completed delivery details
 */
router.get('/export/commission', authenticateToken, async (req: Request, res: Response) => {
  try {
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

/**
 * @route GET /api/drivers
 * @desc Get all drivers list
 */
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const list = await Driver.find();
    res.json(list.map((driver) => ({
      ...driver,
      commissionBalance: Number(driver.commissionBalance || 0)
    })));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route POST /api/drivers
 * @desc Save a new driver profile
 */
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    if (authReq.user?.username !== 'admin') {
      res.status(403).json({ error: 'Permission Denied: Only the admin user can register drivers.' });
      return;
    }

    const { name, phone, status } = req.body;

    if (!name || !phone) {
      res.status(400).json({ error: 'Name and Phone number are required' });
      return;
    }

    const newDriver = await Driver.create({
      name,
      phone,
      status: status || 'AVAILABLE',
      commissionBalance: 0
    });

    res.status(201).json(newDriver);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route PUT /api/drivers/:id
 * @desc Update a driver profile or change their availability
 */
router.put('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { name, phone, status } = req.body;

    const existing = await Driver.findById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Driver not found' });
      return;
    }

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

/**
 * @route POST /api/drivers/:id/settle
 * @desc Settle the driver's accumulated commission back to 0.00
 */
router.post('/:id/settle', authenticateToken, async (req: Request, res: Response) => {
  try {
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

    await Driver.findByIdAndUpdate(req.params.id, { commissionBalance: 0.00 });

    res.json({
      message: `Commission settled successfully for ${driver.name}. Balance reset to Br 0.00.`
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
