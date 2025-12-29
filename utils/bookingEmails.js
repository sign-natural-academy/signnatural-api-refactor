// utils/bookingEmails.js
import { sendMail } from "./email.js";

/**
 * Booking confirmation email (booker)
 */
export async function sendBookingConfirmation({
  to,
  name,
  itemTitle,
  itemType,
  bookingId,
}) {
  const subject = `Booking confirmed — ${itemTitle}`;

  const text = `Hi ${name || "there"},

Your booking for the ${itemType} "${itemTitle}" has been received successfully.

Booking reference: ${bookingId}

We’ll notify you if there are any updates.

— Sign Natural Academy`;

  const html = `
    <div style="font-family: Arial, sans-serif; color:#222;">
      <p>Hi ${name || "there"},</p>
      <p>Your booking for the <strong>${itemType}</strong> below has been received:</p>
      <p><strong>${itemTitle}</strong></p>
      <p><strong>Booking reference:</strong> ${bookingId}</p>
      <p>We’ll notify you if there are any updates.</p>
      <hr/>
      <small>Sign Natural Academy</small>
    </div>
  `;

  return sendMail({
    to,
    subject,
    text,
    html,
  });
}

/**
 * Attendee confirmation email
 */
export async function sendAttendeeConfirmation({
  to,
  itemTitle,
  itemType,
}) {
  const subject = `You’ve been registered — ${itemTitle}`;

  const text = `Hello,

You have been registered for the ${itemType} "${itemTitle}".

If you have questions, please contact the person who made the booking.

— Sign Natural Academy`;

  const html = `
    <div style="font-family: Arial, sans-serif; color:#222;">
      <p>Hello,</p>
      <p>You have been registered for the <strong>${itemType}</strong>:</p>
      <p><strong>${itemTitle}</strong></p>
      <p>If you have questions, please contact the person who made the booking.</p>
      <hr/>
      <small>Sign Natural Academy</small>
    </div>
  `;

  return sendMail({
    to,
    subject,
    text,
    html,
  });
}
