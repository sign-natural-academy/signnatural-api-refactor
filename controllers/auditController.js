// controllers/auditController.js
import AuditLog from '../models/AuditLog.js';
import User from '../models/User.js'; // For email lookup

// GET /api/audit?actor=&action=&entityType=&from=&to=&page=&limit=
export async function listAudit(req, res) {
  const {
    actor,
    action,
    entityType,
    from,
    to,
    page = 1,
    limit = 20,
  } = req.query;

  const filter = {};

  if (actor) filter.actor = actor;
  if (action) filter.action = action;
  if (entityType) filter.entityType = entityType;

  if (from && to) {
    const fromD = new Date(from);
    const toD = new Date(to);
    if (!isNaN(fromD) && !isNaN(toD)) {
      toD.setHours(23, 59, 59, 999);
      filter.createdAt = { $gte: fromD, $lte: toD };
    }
  }

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

  // --- Fetch logs with user info ---
  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .populate('actor', 'name email')   // ⭐ Populate actor email + name
      .lean(),
    AuditLog.countDocuments(filter),
  ]);

  // --- Shape logs for frontend ---
  const items = logs.map((log) => ({
    ...log,
    actorId: log.actor?._id || log.actor,                 // for debugging/fallback
    actorEmail: log.actor?.email || 'Unknown user',       // ⭐ Human readable
    actorName: log.actor?.name || '',
  }));

  res.json({
    items,
    page: pageNum,
    limit: limitNum,
    total,
    pages: Math.ceil(total / limitNum),
  });
}
