import nodemailer from "nodemailer";

import config from "../config/config.js";

const PLACEHOLDER_VALUES = ["yourgmail@gmail.com", "your_app_password"];
const GMAIL_APP_PASSWORD_REGEX = /^[a-zA-Z0-9]{16}$/;
const isProduction = config.NODE_ENV === "production";

export const getSanitizedEmailUser = () => config.EMAIL_USER?.trim();
export const getSanitizedEmailPass = () => config.EMAIL_PASS?.replace(/\s+/g, "").trim();

export const getMailConfigError = () => {
  const emailUser = getSanitizedEmailUser();
  const emailPass = getSanitizedEmailPass();

  if (!emailUser || !emailPass) {
    return "EMAIL_USER and EMAIL_PASS must be set in backend/.env";
  }

  if (PLACEHOLDER_VALUES.includes(emailUser) || PLACEHOLDER_VALUES.includes(emailPass)) {
    return "Replace placeholder Gmail credentials in backend/.env";
  }

  if (emailUser.endsWith("@gmail.com") && !GMAIL_APP_PASSWORD_REGEX.test(emailPass)) {
    return "For Gmail, EMAIL_PASS must be a 16-character App Password (not your normal Gmail password).";
  }

  return null;
};

export const getMailSendErrorMessage = (error) => {
  const message = error?.message?.toLowerCase() || "";

  if (
    error?.code === "EAUTH" ||
    message.includes("invalid login") ||
    message.includes("username and password not accepted") ||
    message.includes("missing credentials")
  ) {
    return "Gmail authentication failed. Use EMAIL_USER as your Gmail and EMAIL_PASS as a valid 16-character Gmail App Password.";
  }

  if (error?.code === "ECONNECTION" || error?.code === "ETIMEDOUT") {
    return "Could not connect to Gmail SMTP. Check internet/firewall and try again.";
  }

  if (error?.code === "EENVELOPE") {
    return "Invalid recipient/sender email address. Check EMAIL_USER and the entered email.";
  }

  if (error?.code === "ESOCKET") {
    return "SMTP socket error while sending OTP. Check internet/firewall and try again.";
  }

  if (!isProduction && error?.message) {
    return `Server error while sending OTP: ${error.message}`;
  }

  return "Server error while sending OTP";
};

export const createTransporter = () =>
  nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: getSanitizedEmailUser(),
      pass: getSanitizedEmailPass(),
    },
  });

export const sendOtpEmail = async (email, otp) => {
  const mailConfigError = getMailConfigError();

  if (mailConfigError) {
    if (!isProduction) {
      console.warn("OTP mail disabled in development:", mailConfigError);
      console.log(`DEV OTP for ${email}: ${otp}`);
      return { success: true, devMode: true };
    }
    return { success: false, message: mailConfigError };
  }

  const transporter = createTransporter();

  try {
    await transporter.sendMail({
      from: getSanitizedEmailUser(),
      to: email,
      subject: "Your OTP Code - Login Verification",
      text: `Your OTP is ${otp}. It expires in 5 minutes.`,
    });
    return { success: true };
  } catch (error) {
    if (!isProduction) {
      console.warn("OTP mail failed in development:", error.message);
      console.log(`DEV OTP for ${email}: ${otp}`);
      return { success: true, devMode: true };
    }
    return { success: false, message: getMailSendErrorMessage(error) };
  }
};
