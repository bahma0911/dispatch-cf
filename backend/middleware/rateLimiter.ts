import { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  [ip: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

// Custom rate limiter options
export interface RateLimitOptions {
  windowMs: number; // e.g. 15 * 60 * 1000 (15 minutes)
  max: number; // max requests per windowMs
  message: string;
}

export function createRateLimiter(options: RateLimitOptions) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    if (!store[ip]) {
      store[ip] = {
        count: 1,
        resetTime: now + options.windowMs
      };
      next();
      return;
    }

    const record = store[ip];

    if (now > record.resetTime) {
      // Window expired, reset record
      record.count = 1;
      record.resetTime = now + options.windowMs;
      next();
    } else if (record.count >= options.max) {
      // Limit exceeded
      res.status(429).json({
        error: options.message,
        retryAfterMs: record.resetTime - now
      });
    } else {
      // Increment count
      record.count++;
      next();
    }
  };
}

// Default rate limiter: 100 requests per 15 minutes
export const defaultRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again after 15 minutes.'
});

// Strict rate limiter for auth routes: 10 attempts per 15 minutes
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many authentication attempts. Please try again after 15 minutes.'
});
