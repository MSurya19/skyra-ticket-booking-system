"use strict";

const {
    getMailTransporter,
    getMailFrom,
    isMailConfigured
} = require("../config/mail");


/* =========================================================
   SKYRA - EMAIL SERVICE
   File: backend/src/services/emailService.js

   Handles:
   - Generic email sending
   - Password reset email
   - Reusable foundation for booking/QR emails later
   ========================================================= */


/* =========================================================
   1. GET FRONTEND BASE URL
   ========================================================= */

function getFrontendBaseUrl() {

    /*
     * FRONTEND_URL currently contains:
     *
     * http://127.0.0.1:5500,http://localhost:5500
     *
     * We only need one origin when generating email links.
     */

    const frontendUrls =
        String(
            process.env.FRONTEND_URL ||
            "http://localhost:5500"
        )
            .split(",")
            .map((url) => url.trim())
            .filter(Boolean);


    /*
     * During local development prefer localhost
     * because that is the URL currently used for SKYRA.
     */

    const localhostUrl =
        frontendUrls.find(
            (url) =>
                url.includes("localhost")
        );


    const baseUrl =
        localhostUrl ||
        frontendUrls[0] ||
        "http://localhost:5500";


    return baseUrl.replace(/\/+$/, "");
}


/* =========================================================
   2. GENERIC SEND EMAIL
   ========================================================= */

async function sendEmail({
    to,
    subject,
    text,
    html,
    attachments = []
}) {

    if (!to) {
        throw new Error(
            "Email recipient is required."
        );
    }


    if (!subject) {
        throw new Error(
            "Email subject is required."
        );
    }


    /*
     * We do not crash the whole application simply because
     * email has not been configured.
     */

    if (!isMailConfigured()) {

        const error =
            new Error(
                "SKYRA email service is not configured."
            );

        error.code =
            "EMAIL_NOT_CONFIGURED";

        throw error;
    }


    const transporter =
        getMailTransporter();


    if (!transporter) {

        const error =
            new Error(
                "Unable to initialize SKYRA email service."
            );

        error.code =
            "EMAIL_TRANSPORT_UNAVAILABLE";

        throw error;
    }


    const mailOptions = {

        from:
            getMailFrom(),

        to,

        subject,

        text,

        html,

        attachments:
            Array.isArray(attachments)
                ? attachments
                : []
    };


    try {

        const info =
            await transporter.sendMail(
                mailOptions
            );


        return {
            success: true,

            messageId:
                info.messageId,

            accepted:
                info.accepted || [],

            rejected:
                info.rejected || []
        };

    } catch (error) {

        console.error(
            "[SKYRA MAIL] Email delivery failed:",
            error.message
        );


        const mailError =
            new Error(
                "Unable to send email at this time."
            );

        mailError.code =
            "EMAIL_SEND_FAILED";

        mailError.cause =
            error;

        throw mailError;
    }
}


/* =========================================================
   3. PASSWORD RESET EMAIL
   ========================================================= */

async function sendPasswordResetEmail({
    to,
    name,
    resetToken,
    expiresInMinutes = 15
}) {

    if (!resetToken) {
        throw new Error(
            "Password reset token is required."
        );
    }


    const frontendBaseUrl =
        getFrontendBaseUrl();


    const resetUrl =
        `${frontendBaseUrl}/reset-password.html?token=${encodeURIComponent(
            resetToken
        )}`;


    const safeName =
        String(
            name ||
            "SKYRA user"
        ).trim();


    const subject =
        "Reset your SKYRA password";


    const text =
`Hi ${safeName},

We received a request to reset the password for your SKYRA account.

Open the link below to create a new password:

${resetUrl}

This password reset link will expire in approximately ${expiresInMinutes} minutes.

If you did not request a password reset, you can safely ignore this email.

For your security, never share this reset link with anyone.

SKYRA
Your Seats. Your Moments.`;


    const html =
`
<!DOCTYPE html>

<html lang="en">

<head>

    <meta charset="UTF-8">

    <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
    >

    <title>
        Reset your SKYRA password
    </title>

</head>


<body
    style="
        margin:0;
        padding:0;
        background:#06101f;
        font-family:Arial,Helvetica,sans-serif;
        color:#e2e8f0;
    "
>

    <table
        role="presentation"
        width="100%"
        cellspacing="0"
        cellpadding="0"
        border="0"
        style="
            width:100%;
            background:#06101f;
            padding:32px 16px;
        "
    >

        <tr>

            <td align="center">

                <table
                    role="presentation"
                    width="100%"
                    cellspacing="0"
                    cellpadding="0"
                    border="0"
                    style="
                        width:100%;
                        max-width:600px;
                        background:#0a1728;
                        border:1px solid #20324d;
                        border-radius:16px;
                        overflow:hidden;
                    "
                >


                    <!-- Header -->

                    <tr>

                        <td
                            style="
                                padding:28px 32px;
                                background:
                                    linear-gradient(
                                        135deg,
                                        #312e81,
                                        #4c1d95
                                    );
                            "
                        >

                            <div
                                style="
                                    font-size:26px;
                                    font-weight:700;
                                    letter-spacing:2px;
                                    color:#ffffff;
                                "
                            >
                                SKYRA
                            </div>

                            <div
                                style="
                                    margin-top:6px;
                                    font-size:13px;
                                    color:#ddd6fe;
                                "
                            >
                                Your Seats. Your Moments.
                            </div>

                        </td>

                    </tr>


                    <!-- Content -->

                    <tr>

                        <td
                            style="
                                padding:36px 32px;
                            "
                        >

                            <div
                                style="
                                    margin-bottom:10px;
                                    color:#818cf8;
                                    font-size:12px;
                                    font-weight:700;
                                    letter-spacing:1px;
                                    text-transform:uppercase;
                                "
                            >
                                Account Security
                            </div>


                            <h1
                                style="
                                    margin:0 0 18px;
                                    color:#ffffff;
                                    font-size:26px;
                                    line-height:1.3;
                                "
                            >
                                Reset your password
                            </h1>


                            <p
                                style="
                                    margin:0 0 18px;
                                    color:#cbd5e1;
                                    font-size:15px;
                                    line-height:1.7;
                                "
                            >
                                Hi ${escapeHtml(safeName)},
                            </p>


                            <p
                                style="
                                    margin:0 0 24px;
                                    color:#94a3b8;
                                    font-size:15px;
                                    line-height:1.7;
                                "
                            >
                                We received a request to reset
                                the password for your SKYRA
                                account. Click the button below
                                to create a new password.
                            </p>


                            <!-- Reset Button -->

                            <table
                                role="presentation"
                                cellspacing="0"
                                cellpadding="0"
                                border="0"
                            >

                                <tr>

                                    <td
                                        style="
                                            border-radius:10px;
                                            background:#6366f1;
                                        "
                                    >

                                        <a
                                            href="${escapeHtml(resetUrl)}"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style="
                                                display:inline-block;
                                                padding:14px 24px;
                                                color:#ffffff;
                                                font-size:14px;
                                                font-weight:700;
                                                text-decoration:none;
                                            "
                                        >
                                            Reset Password
                                        </a>

                                    </td>

                                </tr>

                            </table>


                            <p
                                style="
                                    margin:26px 0 0;
                                    color:#94a3b8;
                                    font-size:13px;
                                    line-height:1.7;
                                "
                            >
                                This reset link will expire in
                                approximately
                                <strong
                                    style="
                                        color:#c4b5fd;
                                    "
                                >
                                    ${Number(expiresInMinutes)} minutes
                                </strong>.
                            </p>


                            <div
                                style="
                                    margin:24px 0;
                                    border-top:1px solid #20324d;
                                "
                            ></div>


                            <p
                                style="
                                    margin:0;
                                    color:#64748b;
                                    font-size:12px;
                                    line-height:1.7;
                                "
                            >
                                If you did not request this
                                password reset, you can safely
                                ignore this email. Your password
                                will remain unchanged.
                            </p>


                            <p
                                style="
                                    margin:16px 0 0;
                                    color:#64748b;
                                    font-size:12px;
                                    line-height:1.7;
                                "
                            >
                                For security, never share this
                                password reset link with anyone.
                            </p>

                        </td>

                    </tr>


                    <!-- Footer -->

                    <tr>

                        <td
                            style="
                                padding:20px 32px;
                                border-top:1px solid #20324d;
                                background:#081321;
                                color:#64748b;
                                font-size:11px;
                                line-height:1.6;
                                text-align:center;
                            "
                        >

                            © ${new Date().getFullYear()} SKYRA

                            <br>

                            Movies • Concerts • Live Experiences

                        </td>

                    </tr>


                </table>

            </td>

        </tr>

    </table>

</body>

</html>
`;


    return sendEmail({
        to,
        subject,
        text,
        html
    });
}


/* =========================================================
   4. HTML ESCAPE

   Prevent user-controlled values such as a person's name
   from becoming HTML inside the email.
   ========================================================= */

function escapeHtml(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =========================================================
   5. EXPORTS
   ========================================================= */

module.exports = {
    sendEmail,
    sendPasswordResetEmail,
    getFrontendBaseUrl
};