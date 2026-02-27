import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import usageRoutes from './routes/usage.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
const isProduction = process.env.NODE_ENV === 'production';

app.use(cors());
app.use(express.json());

// API routes
app.use('/api/usage', usageRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// In production, serve the Vite-built frontend
if (isProduction) {
  const clientDist = path.join(__dirname, '..', 'dist');
  app.use(express.static(clientDist));

  // SPA fallback — serve index.html for any non-API route
  app.get('/{*splat}', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  if (isProduction) {
    console.log('Serving static frontend from dist/');
  }
});
