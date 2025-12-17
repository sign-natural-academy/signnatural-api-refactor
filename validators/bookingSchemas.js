import Joi from "joi";

export const createBookingSchema = Joi.object({
  itemType: Joi.string()
    .valid("Course", "Workshop", "Product")
    .required(),

  itemId: Joi.string().required(),

  price: Joi.number().min(0).optional(),

  scheduledAt: Joi.date().iso().optional(),

  /**
   * Contact is ALWAYS required
   * - auto-filled for logged-in users
   * - manually provided for guests
   */
  contact: Joi.object({
    name: Joi.string().min(2).required(),
    email: Joi.string().email().required(),
    phone: Joi.string().optional(),
  }).required(),

  attendees: Joi.array()
    .items(
      Joi.object({
        email: Joi.string().email().required(),
      })
    )
    .optional(),
});

export const updateBookingStatusSchema = Joi.object({
  status: Joi.string()
    .valid("pending", "confirmed", "cancelled", "completed")
    .required(),
});
