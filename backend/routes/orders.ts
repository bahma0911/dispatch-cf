import { Router, Request, Response } from 'express';
import { Order } from '../models/Order';
import { Customer } from '../models/Customer';
import { Driver } from '../models/Driver';
import { authenticateToken } from '../middleware/auth';
import {
  sendSMS,
  buildCustomerSMS,
  buildDriverSMS
} from '../utils/smsGateway';
import {
  generateDailyDispatchExcel,
  generateAccountStatementExcel
} from '../utils/excelExport';

const router = Router();

/**
 * @route GET /api/orders
 * @desc Get all orders with optional filtering by status, paymentType, and date range
 */
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { status, paymentType, paymentStatus, startDate, endDate } = req.query;
    
    let query: any = {};
    if (status) query.orderStatus = status;
    if (paymentType) query.paymentType = paymentType;
    if (paymentStatus) query.paymentStatus = paymentStatus;

    let orders = await Order.find(query);

    // Apply date filters if provided
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate as string).getTime() : 0;
      const end = endDate ? new Date(endDate as string).getTime() : Infinity;

      orders = orders.filter((order) => {
        const orderTime = new Date(order.createdAt).getTime();
        return orderTime >= start && orderTime <= end;
      });
    }

    // Populate customer and driver info
    const populated = await Order.populate(orders, ['customer', 'driver']);
    
    // Sort by order number descending (newest first)
    populated.sort((a, b) => (b.orderNumber || 0) - (a.orderNumber || 0));

    res.json(populated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route POST /api/orders
 * @desc Create a new order and dispatch SMS to both Customer and Driver
 */
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { customerId, walkInCustomer, driverId, pickupAddress, deliveryAddress, fee, paymentType } = req.body;

    if (!customerId && !walkInCustomer) {
      res.status(400).json({ error: 'Either customerId or walkInCustomer details are required.' });
      return;
    }

    if (!driverId || !pickupAddress || !deliveryAddress || fee === undefined) {
      res.status(400).json({ error: 'Driver, Pickup Address, Delivery Address, and Fee are required.' });
      return;
    }

    // 1. Fetch customer & driver details
    let customer: any;
    let customerStoreValue: any;

    if (customerId) {
      customer = await Customer.findById(customerId);
      if (!customer) {
        res.status(404).json({ error: 'Customer not found.' });
        return;
      }
      customerStoreValue = customerId;
    } else {
      // It's a walk-in normal customer! They are not registered.
      if (!walkInCustomer.name || !walkInCustomer.phone) {
        res.status(400).json({ error: 'Walk-In customer name and phone are required.' });
        return;
      }
      customer = {
        _id: 'walkin-' + Math.random().toString(36).substring(2, 9),
        name: walkInCustomer.name,
        phone: walkInCustomer.phone,
        address: walkInCustomer.address || deliveryAddress,
        type: 'NORMAL',
        creditBalance: 0.0
      };
      customerStoreValue = customer; // Store object directly in Order JSON
    }

    const driver = await Driver.findById(driverId);
    if (!driver) {
      res.status(404).json({ error: 'Driver not found.' });
      return;
    }

    // 2. Validate payment type based on customer type
    let finalPaymentType = paymentType || 'CASH';
    if (customer.type === 'NORMAL') {
      finalPaymentType = 'CASH'; // Normal customers can only do Cash on Delivery
    }

    // 3. Create the order
    const newOrder = await Order.create({
      customer: customerStoreValue,
      driver: driverId,
      pickupAddress,
      deliveryAddress,
      fee: Number(fee),
      paymentType: finalPaymentType,
      paymentStatus: 'UNPAID',
      orderStatus: 'PENDING'
    });

    // Populate order for SMS info
    const populatedOrder = (await Order.populate([newOrder], ['customer', 'driver']))[0];

    // 4. Send Automated SMS alerts to both parties
    const customerMsg = buildCustomerSMS(
      customer.name,
      populatedOrder.orderNumber,
      driver.name,
      driver.phone,
      finalPaymentType,
      Number(fee)
    );

    const driverMsg = buildDriverSMS(
      driver.name,
      populatedOrder.orderNumber,
      customer.name,
      customer.phone,
      pickupAddress,
      deliveryAddress,
      finalPaymentType,
      Number(fee)
    );

    // Run dispatch asynchronously
    Promise.all([
      sendSMS(customer.name, customer.phone, 'CUSTOMER', customerMsg),
      sendSMS(driver.name, driver.phone, 'DRIVER', driverMsg)
    ]).catch((err) => console.error('Error dispatching SMS notifications', err));

    res.status(201).json(populatedOrder);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route PUT /api/orders/:id/status
 * @desc Update orderStatus and paymentStatus (with creditBalance increment upon completion)
 */
router.put('/:id/status', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { orderStatus, paymentStatus } = req.body;
    
    const order = await Order.findById(req.params.id);
    if (!order) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }

    const oldStatus = order.orderStatus;
    const newStatus = orderStatus ?? oldStatus;
    const newPaymentStatus = paymentStatus ?? order.paymentStatus;

    // Save update
    const updated = await Order.findByIdAndUpdate(req.params.id, {
      orderStatus: newStatus,
      paymentStatus: newPaymentStatus
    });

    // Handle credit accumulation: if status changes to DELIVERED now and was not DELIVERED before,
    // and paymentType is CREDIT, increment customer's creditBalance.
    if (newStatus === 'DELIVERED' && oldStatus !== 'DELIVERED' && order.paymentType === 'CREDIT') {
      const custId = typeof order.customer === 'object' && order.customer !== null ? order.customer._id : order.customer;
      const customer = await Customer.findById(custId);
      if (customer && customer.type === 'ACCOUNT_HOLDER') {
        const updatedBalance = Number(customer.creditBalance || 0) + Number(order.fee);
        await Customer.findByIdAndUpdate(customer._id, { creditBalance: updatedBalance });
        console.log(`Added credit fee Br ${order.fee} to ${customer.name}. New balance: Br ${updatedBalance}`);
      }
    }

    // Add the driver's 10% commission once when the delivery is completed.
    if (newStatus === 'DELIVERED' && oldStatus !== 'DELIVERED') {
      const driverId = typeof order.driver === 'object' && order.driver !== null ? order.driver._id : order.driver;
      const driver = await Driver.findById(driverId);
      if (driver) {
        const commission = Number(order.fee || 0) * 0.10;
        const updatedCommissionBalance = Number(driver.commissionBalance || 0) + commission;
        await Driver.findByIdAndUpdate(driver._id, { commissionBalance: updatedCommissionBalance });
        console.log(`Added driver commission Br ${commission.toFixed(2)} to ${driver.name}. New balance: Br ${updatedCommissionBalance.toFixed(2)}`);
      }
    }

    const populated = (await Order.populate([updated], ['customer', 'driver']))[0];
    res.json(populated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route GET /api/orders/export/daily
 * @desc Export Daily Dispatch Log as Excel Spreadsheet
 */
router.get('/export/daily', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    let orders = await Order.find();

    if (startDate || endDate) {
      const start = startDate ? new Date(startDate as string).getTime() : 0;
      const end = endDate ? new Date(endDate as string).getTime() : Infinity;

      orders = orders.filter((order) => {
        const orderTime = new Date(order.createdAt).getTime();
        return orderTime >= start && orderTime <= end;
      });
    }

    const populated = await Order.populate(orders, ['customer', 'driver']);
    populated.sort((a, b) => (b.orderNumber || 0) - (a.orderNumber || 0));

    const buffer = generateDailyDispatchExcel(populated);

    const dateStr = startDate ? `${startDate}_to_${endDate || 'present'}` : 'all_time';
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Daily_Dispatch_Log_${dateStr}.xlsx`);
    res.end(buffer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route GET /api/orders/export/account/:customerId
 * @desc Export itemized Account Statement for a specific Account Holder as Excel Spreadsheet
 */
router.get('/export/account/:customerId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const customer = await Customer.findById(req.params.customerId);
    if (!customer) {
      res.status(404).json({ error: 'Customer not found.' });
      return;
    }

    if (customer.type !== 'ACCOUNT_HOLDER') {
      res.status(400).json({ error: 'Excel statements can only be exported for Account Holders.' });
      return;
    }

    const orders = await Order.find({ customer: customer._id });
    const populated = await Order.populate(orders, ['driver']);
    
    // Sort by date descending (newest first)
    populated.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const buffer = generateAccountStatementExcel(customer, populated);

    const safeName = customer.name.replace(/[^a-zA-Z0-9]/g, '_');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Account_Statement_${safeName}.xlsx`);
    res.end(buffer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
