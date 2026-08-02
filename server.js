import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.js';
import problemRoutes from './routes/problems.js';
import { fetchZerotracData } from './services/zerotrac.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
let PORT = parseInt(process.env.PORT, 10) || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/leetcode-tracker';

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Serverless Initialization Middleware
let isDbConnected = false;
let isZerotracLoaded = false;

app.use('/api', async (req, res, next) => {
  try {
    // 1. Ensure DB Connection
    if (!isDbConnected) {
      console.log(`[Serverless] Connecting to MongoDB...`);
      const db = await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
      isDbConnected = db.connections[0].readyState === 1;
      console.log(`[Serverless] MongoDB Connected.`);
    }
    
    // 2. Ensure Zerotrac Data
    if (!isZerotracLoaded) {
      console.log(`[Serverless] Pre-loading Zerotrac data...`);
      await fetchZerotracData();
      isZerotracLoaded = true;
    }
    
    next();
  } catch (err) {
    console.error('[Serverless] Initialization Error:', err);
    res.status(500).json({ error: 'Server initialization failed. Please try again.' });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/problems', problemRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date()
  });
});

// Serve frontend for root
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Helper to start listening with port retry
function listenOnPort(port) {
  const server = app.listen(port, () => {
    console.log(`\n🚀 LeetCode Rating Tracker is running at: http://localhost:${port}\n`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[Port ${port} in use] Retrying on port ${port + 1}...`);
      listenOnPort(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });
}

// Database connection & Startup (For local development only)
async function startServer() {
  if (process.env.VERCEL) return; // Skip local startup on Vercel

  try {
    console.log(`Connecting to MongoDB at: ${MONGODB_URI}...`);
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    isDbConnected = true;
    console.log('MongoDB connected successfully!');
  } catch (err) {
    console.warn(`[MongoDB Warning] Could not connect to MongoDB: ${err.message}`);
  }

  // Pre-load Zerotrac problem ratings
  await fetchZerotracData();
  isZerotracLoaded = true;

  listenOnPort(PORT);
}

startServer();

// Export the app for Vercel Serverless
export default app;
