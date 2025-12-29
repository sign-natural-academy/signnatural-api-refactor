// sign-natural-api/index.js
import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import connectDB from './config/db.js';

import authRoutes from './routes/authRoutes.js';
import courseRoutes from './routes/courseRoutes.js';
import workshopRoutes from './routes/workshopRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import testimonialRoutes from './routes/testimonialRoutes.js';
import productRoutes from './routes/productRoutes.js';
import reportsRoutes from './routes/reportsRoutes.js';
import auditRoutes from './routes/auditRoutes.js';  
import supportRoutes from './routes/supportRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import mediaRoutes from './routes/mediaRoutes.js';
import userSettingsRoutes from './routes/userSettingsRoutes.js'

import { notFound, errorHandler } from './middlewares/errorMiddleware.js';
import notificationRoutes from './routes/notificationRoutes.js';
import notificationStreamRoutes from './routes/notificationStreamRoutes.js';
import homeVideoRoutes from "./routes/homeVideoRoutes.js";


const app = express();

/** Behind a proxy on Render: trust X-Forwarded-* */
app.set('trust proxy', 1);

/** Security & body parsing */
app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

/** Logging */
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

/** CORS (single, centralized setup) */
const allowedOrigins = [
  process.env.FRONTEND_URL,      // e.g. https://your-site.netlify.app
  'http://localhost:5173',       // Vite dev
  'http://localhost:3000',       // CRA/other dev
].filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    // Allow non-browser clients (no Origin header)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // Soft-fail with a CORS error (shows as 200 on OPTIONS preflight)
    return callback(new Error(`CORS policy: origin ${origin} not allowed`));
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use('/api/notifications', notificationStreamRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/media', mediaRoutes);
app.use("/api/user-settings", userSettingsRoutes);
app.use("/api/home-video", homeVideoRoutes);

/** Rate limiting (after trust proxy so req.ip is correct) */
// sign-natural-api/index.js
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  //  let the SSE endpoint through
  skip: (req) => req.path === '/api/notifications/stream',
});
app.use(limiter);


/** Routes */
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/workshops', workshopRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/testimonials', testimonialRoutes);
app.use('/api/products', productRoutes);
app.use('/api/notifications', notificationRoutes)







/** Health check */
app.get('/api/health', (req, res) => {
  res.json({ ok: true, now: Date.now(), ip: req.ip });
});

/** 404 + error handlers (must be last) */
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await connectDB();
    console.log('MongoDB connected');

    // Non-blocking SMTP verification
   

    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (err) {
    console.error('Failed to start server:', err?.message || err);
    process.exit(1);
  }
}

start();
