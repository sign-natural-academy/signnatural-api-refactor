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
export async function sendBookingStatusEmail(booking) {
  const recipientEmail =
    booking.user?.email || booking.contact?.email;

  if (!recipientEmail) return;

  const itemTitle =
    booking.item?.title || booking.item?.name || "your booking";

  const statusText = booking.status.toUpperCase();

  const subject = `Booking ${statusText} — Sign Natural Academy`;

  const text = `
Hello,

Your booking for "${itemTitle}" is now marked as ${booking.status}.

If you have any questions, please contact us.

— Sign Natural Academy
`;

  const html = `
  <div style="font-family: Arial, sans-serif; color:#222;">
    <p>Hello,</p>
    <p>
      Your booking for <strong>${itemTitle}</strong> has been
      <strong>${booking.status}</strong>.
    </p>

    ${
      booking.status === "confirmed"
        ? "<p>We look forward to having you.</p>"
        : ""
    }

    ${
      booking.status === "cancelled"
        ? "<p>If this was a mistake, please contact support.</p>"
        : ""
    }

    ${
      booking.status === "completed"
        ? "<p>Thank you for participating!</p>"
        : ""
    }

    <hr />
    <small>Sign Natural Academy</small>
  </div>
  `;

  try {
    await sendMail({
      to: recipientEmail,
      subject,
      text,
      html,
    });
  } catch (err) {
    // IMPORTANT: never block booking updates
    console.warn(
      "Booking status email failed:",
      err?.message || err
    );
  }
}