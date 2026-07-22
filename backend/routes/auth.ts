import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { authRateLimiter } from '../middleware/rateLimiter';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'delivery-app-secure-jwt-secret-key-2026';

// Seed a default admin/dispatcher on first start
export async function seedDefaultUser() {
  try {
    const existing = await User.findOne({ username: 'admin' });
    if (!existing) {
      const passwordHash = await bcrypt.hash('password123', 10);
      await User.create({
        username: 'admin',
        passwordHash,
        name: 'Abebe Kebede (Admin)',
        role: 'ADMIN'
      });
      console.log('Seeded default admin user (username: "admin", password: "password123")');
    }

    const existingDispatcher = await User.findOne({ username: 'dispatch' });
    if (!existingDispatcher) {
      const passwordHash = await bcrypt.hash('password123', 10);
      await User.create({
        username: 'dispatch',
        passwordHash,
        name: 'Almaz Tesfaye (Dispatch)',
        role: 'DISPATCHER'
      });
      console.log('Seeded default dispatcher user (username: "dispatch", password: "password123")');
    }
  } catch (err) {
    console.error('Error seeding default users', err);
  }
}

/**
 * @route POST /api/auth/register
 * @desc Create a new Dispatcher account
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, password, name, role } = req.body;

    if (!username || !password || !name) {
      res.status(400).json({ error: 'Username, password, and name are required' });
      return;
    }

    const existing = await User.findOne({ username });
    if (existing) {
      res.status(400).json({ error: 'Username already exists' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      username,
      passwordHash,
      name,
      role: role || 'DISPATCHER'
    });

    res.status(201).json({
      message: 'Dispatcher registered successfully',
      user: {
        id: newUser._id,
        username: newUser.username,
        name: newUser.name,
        role: newUser.role
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route POST /api/auth/login
 * @desc Login with username & password to retrieve JWT
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    const user = await User.findOne({ username });
    if (!user) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    const token = jwt.sign(
      {
        userId: user._id,
        username: user.username,
        name: user.name,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        role: user.role
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route GET /api/auth/me
 * @desc Retrieve current logged-in dispatcher profile
 */
router.get('/me', authenticateToken, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await User.findById(authReq.user.userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        role: user.role
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
