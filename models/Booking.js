// models/Booking.js
import mongoose from 'mongoose';

const BookingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // IMPORTANT: these must match the Mongoose model names you registered
  // e.g. mongoose.model('Course', CourseSchema)
  itemType: { type: String, enum: ['Course', 'Workshop', 'Product'], required: true },

  // refPath points to itemType and Mongoose uses that string to find the model
  item: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'itemType' },

  price: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'confirmed', 'cancelled', 'completed'], default: 'pending' },
  payment: {
    provider: String,
    providerId: String,
    amount: Number,
    currency: String,
    paid: { type: Boolean, default: false }
  },
  scheduledAt: { type: Date },
  meta: { type: Object }
}, { timestamps: true });

// create a partial unique index for non-cancelled bookings
BookingSchema.index(
  { user: 1, itemType: 1, item: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['pending', 'confirmed'] } } }
);


export default mongoose.model('Booking', BookingSchema);
