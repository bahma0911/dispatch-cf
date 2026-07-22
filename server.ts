import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

// Load environment variables
dotenv.config();

import authRouter from './backend/routes/auth';
import customersRouter from './backend/routes/customers';
import driversRouter from './backend/routes/drivers';
import ordersRouter from './backend/routes/orders';
import smsRouter from './backend/routes/sms';
import { connectDatabase } from './backend/db';
import { seedDefaultUser } from './backend/routes/auth';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  if (process.env.MONGODB_URI) {
    await connectDatabase();
  } else {
    console.warn('MONGODB_URI is not configured; using the local JSON database fallback.');
  }
  await seedDefaultUser();

  // JSON and URL-encoded body parsers
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Register backend API routes
  app.use('/api/auth', authRouter);
  app.use('/api/customers', customersRouter);
  app.use('/api/drivers', driversRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/sms', smsRouter);

  // Static API Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      database: process.env.MONGODB_URI ? 'mongodb' : 'file-fallback',
      timestamp: new Date().toISOString()
    });
  });

  // Serve static assets or mount Vite dev server
  if (process.env.NODE_ENV !== 'production') {
    console.log('Starting development server with Vite middleware...');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    console.log('Running in production mode. Serving static assets...');
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`=================================================`);
    console.log(`🚀 Dispatch & Order System listening on http://0.0.0.0:${PORT}`);
    console.log(`=================================================`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
