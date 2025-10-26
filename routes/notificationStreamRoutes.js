// routes/notificationStreamRoutes.js
import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { addClient } from '../utils/sseHub.js';

const router = express.Router();

/**
 * GET /api/notifications/stream?token=JWT
 * SSE stream. We use a query token because EventSource cannot set custom headers.
 */
// routes/notificationStreamRoutes.js
router.get('/stream', async (req, res) => {
  try {
    const token = req.query.token;
    if (!token) return res.status(401).end();

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('_id role');
    if (!user) return res.status(401).end();

    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders?.();

    // Standard first message so onmessage handlers fire everywhere
    res.write(`data: ${JSON.stringify({ kind: 'connected', role: user.role })}\n\n`);
    // Keep your named hello event if you like
    res.write(`event: hello\ndata: ${JSON.stringify({ ok: true })}\n\n`);

    addClient({ res, user }); // your hub

    const interval = setInterval(() => {
      try { res.write(':\n\n'); } catch {}
    }, 25000);

    const cleanup = () => clearInterval(interval);
    res.on('close', cleanup);
    res.on('finish', cleanup);
  } catch {
    res.status(401).end();
  }
});


export default router;
