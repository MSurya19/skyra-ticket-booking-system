"use strict";

const nodemailer = require("nodemailer");

/*
=========================================================
SKYRA - MAIL CONFIGURATION
File: backend/src/config/mail.js

Purpose:
- Create Nodemailer SMTP transporter
- Keep email credentials inside .env
- Support Gmail SMTP / other SMTP providers
- Do not crash the backend when mail is not configured yet
=========================================================
*/

let transporter = null;


/* =========================================================
   1. READ MAIL CONFIGURATION
   ========================================================= */

function getMailConfig() {
    const host =
        String(process.env.MAIL_HOST || "").trim();

    const port =
        Number(process.env.MAIL_PORT || 587);

    const secureValue =
        String(process.env.MAIL_SECURE || "")
            .trim()
            .toLowerCase();

    const secure =
        secureValue
            ? secureValue === "true"
            : port === 465;

    const user =
        String(process.env.MAIL_USER || "").trim();

    const pass =
        String(process.env.MAIL_PASS || "").trim();

    const fromName =
        String(
            process.env.MAIL_FROM_NAME ||
            "SKYRA"
        ).trim();

    const fromEmail =
        String(
            process.env.MAIL_FROM ||
            user
        ).trim();

    return {
        host,
        port,
        secure,
        user,
        pass,
        fromName,
        fromEmail
    };
}


/* =========================================================
   2. CHECK WHETHER MAIL IS CONFIGURED
   ========================================================= */

function isMailConfigured() {
    const config =
        getMailConfig();

    return Boolean(
        config.host &&
        config.port &&
        config.user &&
        config.pass
    );
}


/* =========================================================
   3. CREATE NODEMAILER TRANSPORTER

   Transporter is created only once and reused.
   ========================================================= */

function getMailTransporter() {
    if (transporter) {
        return transporter;
    }

    if (!isMailConfigured()) {
        return null;
    }

    const config =
        getMailConfig();

    transporter =
        nodemailer.createTransport({
            host: config.host,

            port: config.port,

            secure: config.secure,

            auth: {
                user: config.user,
                pass: config.pass
            },

            /*
             * Prevent connections from hanging forever
             * when the SMTP provider is unavailable.
             */
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 15000
        });

    return transporter;
}


/* =========================================================
   4. GET "FROM" ADDRESS
   ========================================================= */

function getMailFrom() {
    const config =
        getMailConfig();

    const safeName =
        config.fromName
            .replace(/"/g, "")
            .trim();

    return {
        name:
            safeName || "SKYRA",

        address:
            config.fromEmail ||
            config.user
    };
}


/* =========================================================
   5. VERIFY SMTP CONNECTION

   Useful during development/testing.

   Example:
   await verifyMailConnection();
   ========================================================= */

async function verifyMailConnection() {
    const mailTransporter =
        getMailTransporter();

    if (!mailTransporter) {
        return {
            success: false,
            configured: false,
            message:
                "Mail service is not configured."
        };
    }

    try {
        await mailTransporter.verify();

        return {
            success: true,
            configured: true,
            message:
                "Mail server connection verified successfully."
        };
    } catch (error) {
        return {
            success: false,
            configured: true,
            message:
                error.message ||
                "Unable to connect to mail server."
        };
    }
}


/* =========================================================
   6. EXPORTS
   ========================================================= */

module.exports = {
    getMailConfig,
    isMailConfigured,
    getMailTransporter,
    getMailFrom,
    verifyMailConnection
};