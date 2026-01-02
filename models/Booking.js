import mongoose from "mongoose";

const BookingSchema = new mongoose.Schema(
  {
    /**
     * Account that CREATED the booking
     * - null for guest bookings
     */
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    /**
     * Person responsible for the booking
     * - user → auto-filled
     * - guest → provided manually
     */
    contact: {
      name: { type: String, required: true },
      email: { type: String, required: true, lowercase: true, index: true },
      phone: { type: String },
    },

    /**
     * Additional people (optional)
     */
    attendees: [
      {
        email: { type: String, lowercase: true, index: true },
      },
    ],

    itemType: {
      type: String,
      enum: ["Course", "Workshop", "Product"],
      required: true,
      index: true,
    },

    item: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "itemType",
      index: true,
    },

    price: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled", "completed"],
      default: "pending",
      index: true,
    },

    payment: {
      provider: String,
      providerId: String,
      amount: Number,
      currency: String,
      paid: { type: Boolean, default: false },
    },

    scheduledAt: { type: Date },
    meta: { type: Object },
  },
  { timestamps: true }
);

/**
 * SUPPORTING (NON-UNIQUE) INDEXES
 * Business rules are enforced in controllers, not schema
 */
BookingSchema.index({ itemType: 1, item: 1, status: 1 });
BookingSchema.index({ createdAt: -1 });

export default mongoose.model("Booking", BookingSchema);
