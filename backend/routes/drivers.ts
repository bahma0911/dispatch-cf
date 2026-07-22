import { Router, Request, Response } from 'express';
import { Driver } from '../models/Driver';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

/**
 * @route GET /api/drivers
 * @desc Get all drivers list
 */
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const list = await Driver.find();
    res.json(list);
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
      status: status || 'AVAILABLE'
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
      status: status ?? existing.status
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
