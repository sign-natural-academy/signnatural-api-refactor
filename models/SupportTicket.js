// models/SupportTicket.js
import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // 1
    senderRole: { type: String, enum: ['user', 'admin', 'superuser'], required: true }, // 2
    text: { type: String, trim: true, required: true }, // 3
  },
  { _id: false, timestamps: { createdAt: true, updatedAt: false } } // 4
);

const SupportTicketSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // 5
    subject: { type: String, trim: true, required: true }, // 6
    category: { type: String, trim: true }, // 7 (billing, course, workshop, other)
    status: { type: String, enum: ['open', 'in_progress', 'resolved', 'closed'], default: 'open' }, // 8
    messages: { type: [MessageSchema], default: [] }, // 9
    lastMessageAt: { type: Date }, // 10
    priority: { type: String, enum: ['low', 'normal', 'high'], default: 'normal' }, // 11 (optional)
  },
  { timestamps: true } // 12
);

SupportTicketSchema.index({ createdAt: -1 }); // 13
SupportTicketSchema.index({ status: 1, lastMessageAt: -1 }); // 14
SupportTicketSchema.index({ user: 1, status: 1 }); // 15

const SupportTicket = mongoose.model('SupportTicket', SupportTicketSchema); // 16
export default SupportTicket; // 17
