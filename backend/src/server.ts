import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes';
import requestRoutes from './routes/requestRoutes';
import taskRoutes from './routes/taskRoutes';
import aiRoutes from './routes/aiRoutes';
import departmentRoutes from './routes/departmentRoutes';
import workflowRoutes from './routes/workflowRoutes';
import auditRoutes from './routes/auditRoutes';
import notificationRoutes from './routes/notificationRoutes';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${req.method}] ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/notifications', notificationRoutes);

import { startSlaDaemon, runSlaScan } from './services/slaDaemon';

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    platform: 'WorkPulse Core',
    databaseMode: (process.env.SUPABASE_URL || process.env.DATABASE_URL) ? 'Supabase/PostgreSQL (Persistent)' : 'Local In-Memory Repository (Seed Active)',
    slaDaemon: 'Active',
    timestamp: new Date().toISOString()
  });
});

// On-demand SLA Scan trigger
app.post('/api/health/sla-scan', async (req, res) => {
  const result = await runSlaScan();
  res.json({ success: true, ...result });
});

// Global 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'ENDPOINT_NOT_FOUND', message: `Route ${req.originalUrl} not found.` }
  });
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`  🚀 WorkPulse Backend Server running on port ${PORT}`);
  console.log(`  🏢 Seed Organization: Acme Technologies (Active)`);
  console.log(`  🤖 Pulse AI Copilot: Online & Tools Registered`);
  console.log(`  📦 Storage: ${(process.env.SUPABASE_URL || process.env.DATABASE_URL) ? 'Connected to Supabase/PostgreSQL (Persistent)' : 'Local Seed Repository'}`);
  console.log(`====================================================`);

  startSlaDaemon(30000);
});
