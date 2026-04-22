import express from "express";
import User from "../user.js";
import nodemailer from "nodemailer";

const router = express.Router();
const OTP_TTL_MS = 5 * 60 * 1000;
const PLACEHOLDER_VALUES = ["yourgmail@gmail.com", "your_app_password"];
const GMAIL_APP_PASSWORD_REGEX = /^[a-zA-Z0-9]{16}$/;
const isProduction = process.env.NODE_ENV === "production";
const getSanitizedEmailUser = () => process.env.EMAIL_USER?.trim();
const getSanitizedEmailPass = () => process.env.EMAIL_PASS?.replace(/\s+/g, "").trim();

const getMailConfigError = () => {
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

const getMailSendErrorMessage = (error) => {
    const message = error?.message?.toLowerCase() || "";

    if (
        error?.code === "EAUTH"
        || message.includes("invalid login")
        || message.includes("username and password not accepted")
        || message.includes("missing credentials")
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

const createTransporter = () =>
    nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: getSanitizedEmailUser(),
            pass: getSanitizedEmailPass(),
        },
    });

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

const isValidEmail = (email) => /\S+@\S+\.\S+/.test(email);

const sendOtpHandler = async (req, res) => {

    let email = "";
    let otp = "";
    let otpSaved = false;

    try {

        email = req.body.email?.trim().toLowerCase() || "";

        if (!email || !isValidEmail(email)) {
            return res.status(400).json({ message: "Valid email is required" });
        }

        otp = generateOtp();

        await User.findOneAndUpdate(
            { email },
            {
                $set: {
                    email,
                    otp,
                    otpExpires: new Date(Date.now() + OTP_TTL_MS),
                },
            },
            {
                upsert: true,
                new: true,
                setDefaultsOnInsert: true,
            }
        );
        otpSaved = true;

        const mailConfigError = getMailConfigError();

        if (mailConfigError) {
            if (!isProduction) {
                console.warn("OTP mail disabled in development:", mailConfigError);
                console.log(`DEV OTP for ${email}: ${otp}`);
                return res.json({
                    message: "OTP generated for development mode (email not sent)",
                    devOtp: otp,
                });
            }

            return res.status(500).json({ message: mailConfigError });
        }

        const transporter = createTransporter();

        try {
            await transporter.sendMail({
                from: getSanitizedEmailUser(),
                to: email,
                subject: "Your OTP Code - Login Verification",
                text: `Your OTP is ${otp}. It expires in 5 minutes.`,
            });
        } catch (error) {
            if (!isProduction) {
                console.warn("OTP mail failed in development:", error.message);
                console.log(`DEV OTP for ${email}: ${otp}`);
                return res.json({
                    message: "OTP generated for development mode (email not sent)",
                    devOtp: otp,
                });
            }

            throw error;
        }

        res.json({ message: "OTP sent successfully" });

    } catch (error) {
        console.error("Send OTP Error:", error);

        if (!isProduction && otpSaved && email && otp) {
            console.warn("Falling back to dev OTP response due to send OTP error.");
            console.log(`DEV OTP for ${email}: ${otp}`);
            return res.json({
                message: "OTP generated for development mode (email not sent)",
                devOtp: otp,
            });
        }

        res.status(500).json({ message: getMailSendErrorMessage(error) });
    }
};

router.post("/sendotp", sendOtpHandler);
router.post("/send-otp", sendOtpHandler);


router.post("/verifyotp", async (req, res) => {

    try {

        const email = req.body.email?.trim().toLowerCase();
        const otp = req.body.otp?.trim();

        if (!email || !otp) {
            return res.status(400).json({ message: "Email and OTP are required" });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({ message: "User not found" });
        }

        if (user.otp !== otp) {
            return res.status(400).json({ message: "Invalid OTP" });
        }

        if (!user.otpExpires || user.otpExpires.getTime() < Date.now()) {
            return res.status(400).json({ message: "OTP expired" });
        }


        await User.updateOne(
            { _id: user._id },
            {
                $unset: {
                    otp: 1,
                    otpExpires: 1,
                },
            }
        );

        res.json({
            message: "Login successful",
            user: {
                id: String(user._id),
                email: user.email,
                cartItemsCount: Array.isArray(user.cartItems) ? user.cartItems.length : 0,
                ordersCount: Array.isArray(user.orders) ? user.orders.length : 0,
            },
        });

    } catch (error) {
        console.error("Verify OTP Error:", error);
        res.status(500).json({ message: "Server error while verifying OTP" });
    }
});

export default router;