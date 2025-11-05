// controllers/auditController.js
import AuditLog from '../models/AuditLog.js';                     // 1) Import model

// GET /api/audit?actor=&action=&entityType=&from=&to=&page=&limit=
export async function listAudit(req, res) {                       // 2) List endpoint
  const {
    actor,
    action,
    entityType,
    from,
    to,
    page = 1,
    limit = 20,
  } = req.query;

  const filter = {};                                              // 3) Build Mongo filter

  if (actor) filter.actor = actor;                                // 4) Filter by actor id
  if (action) filter.action = action;                             // 5) Filter by action verb
  if (entityType) filter.entityType = entityType;                 // 6) Filter by entity type

  if (from && to) {                                               // 7) Date range on createdAt
    const fromD = new Date(from);
    const toD = new Date(to);
    if (!isNaN(fromD) && !isNaN(toD)) {
      // Inclusive through end-of-day
      toD.setHours(23, 59, 59, 999);
      filter.createdAt = { $gte: fromD, $lte: toD };
    }
  }

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);           // 8) Normalize pagination
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

  const [items, total] = await Promise.all([                      // 9) Query + count in parallel
    AuditLog.find(filter)
      .sort({ createdAt: -1 })                                    // 10) Newest first
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
    AuditLog.countDocuments(filter),
  ]);

  res.json({                                                       // 11) Return a paginated payload
    items,
    page: pageNum,
    limit: limitNum,
    total,
    pages: Math.ceil(total / limitNum),
  });
}
