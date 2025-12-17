import Joi from "joi";

export const createBookingSchema = Joi.object({
  itemType: Joi.string()
    .valid("Course", "Workshop", "Product")
    .required(),

  itemId: Joi.string().required(),

  price: Joi.number().min(0).optional(),

  scheduledAt: Joi.date().iso().optional(),

  bookingFor: Joi.object({
    fullName: Joi.string().min(2).required(),
    email: Joi.string().email().optional(),
    phone: Joi.string().optional(),
  }).required(),

  guestInfo: Joi.when("$isGuest", {
    is: true,
    then: Joi.object({
      fullName: Joi.string().required(),
      email: Joi.string().email().required(),
      phone: Joi.string().required(),
    }).required(),
    otherwise: Joi.forbidden(),
  }),
});

export const updateBookingStatusSchema = Joi.object({
  status: Joi.string()
    .valid("pending", "confirmed", "cancelled", "completed")
    .required(),
});
