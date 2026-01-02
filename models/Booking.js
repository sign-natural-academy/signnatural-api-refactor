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
    },
     
    /**
     * Person responsible for the booking
     * - user → auto-filled
     * - guest → provided manually
     */
    contact: {
      name: { type: String, required: true },
      email: { type: String, required: true, lowercase: true },
      phone: { type: String },
    },

    /**
     * Additional people (optional)
     */
    attendees: [
      {
        email: { type: String, lowercase: true },
      },
    ],

    itemType: {
      type: String,
      enum: ["Course", "Workshop", "Product"],
      required: true,
    },

    item: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "itemType",
    },

    price: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled", "completed"],
      default: "pending",
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
 * Prevent duplicate ACTIVE bookings for logged-in users
 */
BookingSchema.index(
  { user: 1, itemType: 1, item: 1 },
  {
    unique: true,
    partialFilterExpression: {
      user: { $type: "objectId" },
      status: { $in: ["pending", "confirmed"] },
    },
  }
);

export default mongoose.model("Booking", BookingSchema);
