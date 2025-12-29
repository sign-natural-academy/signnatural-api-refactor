// utils/email.js
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * sendMail
 * - Generic email sender (replacement for nodemailer)
 * - Keeps same signature so existing code does not break
 */
export async function sendMail({
  to,
  subject,
  text,
  html,
  from = process.env.EMAIL_FROM,
}) {
  if (!to) throw new Error('sendMail: "to" is required');

  return resend.emails.send({
    from,
    to,
    subject,
    text,
    html,
  });
}

/**
 * sendOtpEmail
 * - Used for signup / verification
 * - Logic unchanged, delivery via Resend
 */
export async function sendOtpEmail(to, otp, name = "") {
  if (!to) throw new Error('sendOtpEmail: "to" is required');

  const expires = process.env.OTP_EXPIRES_MINUTES || 10;
  const from = process.env.EMAIL_FROM || "Sign Natural <hello@signnatural.com>";

  const subject = "Verify your email — Sign Natural Academy";

  const text = `Hi ${name || "there"},

Your verification code is ${otp}.
This code expires in ${expires} minutes.

— Sign Natural Academy`;

  const html = `
    <div style="font-family: Arial, sans-serif; color:#222;">
      <p>Hi ${name || "there"},</p>
      <p>Your Sign Natural verification code is:</p>
      <h2 style="letter-spacing:4px">${otp}</h2>
      <p>This code expires in ${expires} minutes.</p>
      <p>If you didn't request this, please ignore this email.</p>
      <hr/>
      <small>Sign Natural Academy</small>
    </div>
  `;

  return sendMail({ to, subject, text, html, from });
}

/**
 * Backward compatibility export
 * (in case something imports default)
 */
export default {
  sendMail,
  sendOtpEmail,
};
