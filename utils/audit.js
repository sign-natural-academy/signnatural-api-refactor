// utils/audit.js
import AuditLog from '../models/AuditLog.js';             // 1) Use the model we just created

/**
 * Record an audit event. Call this after a successful admin action.
 * @param {Object} options
 * @param {ObjectId} options.actorId      - User _id of admin
 * @param {String} options.action         - 'TESTIMONIAL_APPROVED'|'BOOKING_STATUS_CHANGED'|...
 * @param {String} options.entityType     - 'Testimonial'|'Booking'|'User'|'Product'|'Course'|'Workshop'
 * @param {String} options.entityId       - e.g., String(document._id)
 * @param {Object} options.meta           - safe metadata (no secrets/PII)
 * @param {Object} options.req            - Express req for ip and user-agent
 */
export async function logAudit({
  actorId,
  action,
  entityType,
  entityId,
  meta = {},
  req,
}) {
  const ip =
    // 2) Prefer proxy headers if present (Render sets X-Forwarded-For)
    req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
    req?.ip ||
    undefined;

  const userAgent = req?.headers?.['user-agent'];        // 3) Capture agent

  await AuditLog.create({                                // 4) Persist a new record
    actor: actorId,
    action,
    entityType,
    entityId: String(entityId),
    meta,
    ip,
    userAgent,
  });
}
