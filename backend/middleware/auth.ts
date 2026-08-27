import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'delivery-app-secure-jwt-secret-key-2026';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    username: string;
    role: string;
    name: string;
  };
}

export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    console.debug('[auth] No token provided. Authorization header:', authHeader);
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      console.debug('[auth] Token verification failed:', err && (err as Error).message);
      res.status(403).json({ error: 'Invalid or expired token' });
      return;
    }
    
    console.debug('[auth] Token verified. Payload:', decoded);
    (req as AuthenticatedRequest).user = decoded as any;
    next();
  });
}
