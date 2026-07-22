import { Router, Request, Response } from 'express';
import { Customer } from '../models/Customer';
import { Order } from '../models/Order';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

/**
 * @route GET /api/customers
 * @desc Get all customer profiles
 */
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const list = await Customer.find();
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route GET /api/customers/:id
 * @desc Get specific customer details
 */
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }
    res.json(customer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route POST /api/customers
 * @desc Create a new customer profile (Normal or Account Holder)
 */
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    if (authReq.user?.username !== 'admin') {
      res.status(403).json({ error: 'Permission Denied: Only the admin user can register customer accounts.' });
      return;
    }

    const { name, phone, address } = req.body;

    if (!name || !phone) {
      res.status(400).json({ error: 'Name and Phone number are required' });
      return;
    }

    const existing = await Customer.findOne({ phone });
    if (existing) {
      res.status(400).json({ error: 'A customer with this phone number already exists' });
      return;
    }

    const newCustomer = await Customer.create({
      name,
      phone,
      address: address || '',
      type: 'ACCOUNT_HOLDER',
      creditBalance: 0.0
    });

    res.status(201).json(newCustomer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route PUT /api/customers/:id
 * @desc Update a customer profile
 */
router.put('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { name, phone, address, type } = req.body;

    const existing = await Customer.findById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    // Check unique phone collision if phone is updated
    if (phone && phone !== existing.phone) {
      const collision = await Customer.findOne({ phone });
      if (collision) {
        res.status(400).json({ error: 'A customer with this phone number already exists' });
        return;
      }
    }

    const updated = await Customer.findByIdAndUpdate(req.params.id, {
      name: name ?? existing.name,
      phone: phone ?? existing.phone,
      address: address ?? existing.address,
      type: type ?? existing.type
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route POST /api/customers/:id/settle
 * @desc Settle creditBalance back to 0.00 and mark unpaid orders as SETTLED
 */
router.post('/:id/settle', authenticateToken, async (req: Request, res: Response) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    if (customer.type !== 'ACCOUNT_HOLDER') {
      res.status(400).json({ error: 'Only Account Holders can have credit balances settled.' });
      return;
    }

    // Settle balance
    await Customer.findByIdAndUpdate(req.params.id, { creditBalance: 0.00 });

    // Fetch all orders and filter manually to be completely bulletproof regarding string vs object structures
    const allOrders = await Order.find();
    const customerOrders = allOrders.filter((order) => {
      const oCustId = typeof order.customer === 'object' && order.customer !== null ? order.customer._id : order.customer;
      return oCustId === customer._id && order.paymentStatus === 'UNPAID';
    });

    console.log(`[SETTLE] Settling balance for ${customer.name} (${customer._id}). Found ${customerOrders.length} unpaid orders.`);

    for (const order of customerOrders) {
      await Order.findByIdAndUpdate(order._id, { paymentStatus: 'SETTLED' });
    }

    res.json({
      message: `Balance settled successfully for ${customer.name}. Outstanding balance set to Br 0.00. Marked ${customerOrders.length} orders as SETTLED.`,
      settledCount: customerOrders.length
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
