import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import usageRoutes from './routes/usage.js';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// API routes
app.use('/api/usage', usageRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('API endpoints:');
  console.log(`  GET /api/usage?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`);
  console.log(`  GET /api/usage/members`);
  console.log(`  GET /api/usage/status`);
  console.log(`  GET /api/health`);
});
