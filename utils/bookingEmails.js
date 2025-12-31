// utils/bookingEmails.js
import { sendMail } from "./email.js";

const BRAND_LOGO =
  process.env.EMAIL_LOGO_URL
/* ---------- Shared layout ---------- */
function emailLayout({ title, body }) {
  return `
  <div style="background:#f7f5f2;padding:24px 0;">
    <div style="
      max-width:600px;
      margin:0 auto;
      background:#ffffff;
      border-radius:12px;
      overflow:hidden;
      box-shadow:0 10px 30px rgba(0,0,0,0.06);
      font-family:Arial, Helvetica, sans-serif;
      color:#222;
    ">
      <!-- Header -->
      <div style="
        padding:20px 24px;
        background:#455f30;
        text-align:center;
      ">
        <img
          src="${BRAND_LOGO}"
          alt="Sign Natural Academy"
          width="120"
          style="
            max-width:120px;
            height:auto;
            display:block;
            margin:0 auto 8px;
          "
        />
        <div style="
          font-size:14px;
          letter-spacing:0.5px;
          color:#ffffff;
          opacity:0.9;
        ">
          Sign Natural Academy
        </div>
      </div>

      <!-- Body -->
      <div style="padding:24px;">
        <h2 style="
          margin:0 0 12px;
          font-size:20px;
          color:#222;
        ">
          ${title}
        </h2>

        <div style="
          font-size:14px;
          line-height:1.6;
          color:#444;
        ">
          ${body}
        </div>
      </div>

      <!-- Footer -->
      <div style="
        padding:16px 24px;
        background:#fafafa;
        font-size:12px;
        color:#777;
        text-align:center;
      ">
        © ${new Date().getFullYear()} Sign Natural Academy<br/>
        Learning • Craft • Community
      </div>
    </div>
  </div>
  `;
}


/* ---------- Booking confirmation (booker) ---------- */
export async function sendBookingConfirmation({
  to,
  name,
  itemTitle,
  itemType,
  bookingId,
}) {
  const subject = `Booking received — ${itemTitle}`;

  const body = `
    <p>Hi ${name || "there"},</p>

    <p>
      Your booking for the <strong>${itemType}</strong> below has been received:
    </p>

    <p style="font-size:16px;">
      <strong>${itemTitle}</strong>
    </p>

    <p>
      <strong>Booking reference:</strong><br/>
      ${bookingId}
    </p>

    <p>
      We’ll notify you as soon as there are any updates.
    </p>
  `;

  return sendMail({
    to,
    subject,
    text: `Your booking for ${itemTitle} has been received.`,
    html: emailLayout({ title: "Booking confirmed", body }),
  });
}

/* ---------- Attendee confirmation ---------- */
export async function sendAttendeeConfirmation({
  to,
  itemTitle,
  itemType,
}) {
  const subject = `You’ve been registered — ${itemTitle}`;

  const body = `
    <p>Hello,</p>

    <p>
      You have been registered for the following <strong>${itemType}</strong>:
    </p>

    <p style="font-size:16px;">
      <strong>${itemTitle}</strong>
    </p>

    <p>
      If you have any questions, please contact the person who made the booking.
    </p>
  `;

  return sendMail({
    to,
    subject,
    text: `You have been registered for ${itemTitle}.`,
    html: emailLayout({ title: "You’re registered", body }),
  });
}

/* ---------- Booking status updates ---------- */
export async function sendBookingStatusEmail(booking) {
  const recipientEmail =
    booking.user?.email || booking.contact?.email;
  if (!recipientEmail) return;

  const itemTitle =
    booking.item?.title || booking.item?.name || "your booking";

  const status = booking.status;

  const subject = `Booking ${status.toUpperCase()} — ${itemTitle}`;

  const body = `
    <p>Hello,</p>

    <p>
      Your booking for <strong>${itemTitle}</strong> is now marked as
      <strong>${status}</strong>.
    </p>

    ${
      status === "confirmed"
        ? "<p>We look forward to having you.</p>"
        : ""
    }
    ${
      status === "cancelled"
        ? "<p>If this was a mistake, please contact support.</p>"
        : ""
    }
    ${
      status === "completed"
        ? "<p>Thank you for participating!</p>"
        : ""
    }
  `;

  try {
    await sendMail({
      to: recipientEmail,
      subject,
      text: `Your booking for ${itemTitle} is now ${status}.`,
      html: emailLayout({ title: "Booking update", body }),
    });
  } catch (err) {
    console.warn("Booking status email failed:", err?.message || err);
  }
}
