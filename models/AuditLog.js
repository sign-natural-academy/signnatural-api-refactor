// models/AuditLog.js
import mongoose from 'mongoose';                      // 1) Import mongoose for schema/model

const AuditLogSchema = new mongoose.Schema(           // 2) Define the schema
  {
    actor: {                                          // 3) Who performed the action (user id)
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: { type: String, required: true },         // 4) Short verb/action (e.g., 'TESTIMONIAL_APPROVED')
    entityType: { type: String, required: true },     // 5) Domain type ('Testimonial'|'Booking'|'User'|'Product'|'Course'|'Workshop')
    entityId: { type: String, required: true },       // 6) Entity primary id (string to allow ObjectId or external ids)
    meta: { type: Object, default: {} },              // 7) Safe, non-sensitive metadata snapshot (diffs, before/after keys)
    ip: { type: String },                             // 8) Source IP captured from request
    userAgent: { type: String },                      // 9) Browser/agent string for traceability
  },
  { timestamps: { createdAt: true, updatedAt: false } } // 10) Only createdAt; no updates for immutability
);

AuditLogSchema.index({ createdAt: -1 });              // 11) Query newest-first efficiently
AuditLogSchema.index({ actor: 1, action: 1 });        // 12) Common filter combo
AuditLogSchema.index({ entityType: 1, entityId: 1 }); // 13) Entity lookup

const AuditLog = mongoose.model('AuditLog', AuditLogSchema); // 14) Compile model

export default AuditLog;                              // 15) Export for use
