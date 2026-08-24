"use strict";

const crypto = require("crypto");
const QRCode = require("qrcode");

/* =========================================================
   SKYRA - SCANNABLE TICKET QR SERVICE

   The QR now contains a SIGNED VERIFICATION URL, not only a
   plain booking reference. A phone camera therefore opens a
   SKYRA verification page showing the booking details.

   The booking reference is still embedded in the QR URL:
   /ticket/verify?ref=SKY-BK-...&sig=...
   ========================================================= */

function normalizeBookingReference(reference) {
    const value = String(reference || "").trim().toUpperCase();

    if (!value) {
        throw new Error("Booking reference is required to generate a QR ticket.");
    }

    return value;
}

function getTicketSecret() {
    const value = String(
        process.env.TICKET_QR_SECRET ||
        process.env.JWT_SECRET ||
        ""
    ).trim();

    if (!value) {
        throw new Error(
            "TICKET_QR_SECRET (or JWT_SECRET) must be configured before generating ticket QR codes."
        );
    }

    return value;
}

function getTicketPublicBaseUrl() {
    const value = String(
        process.env.TICKET_PUBLIC_BASE_URL ||
        process.env.BACKEND_PUBLIC_URL ||
        `http://localhost:${process.env.PORT || 5000}`
    ).trim();

    return value.replace(/\/+$/, "");
}

function createVerificationSignature(reference) {
    const normalized = normalizeBookingReference(reference);

    return crypto
        .createHmac("sha256", getTicketSecret())
        .update(normalized, "utf8")
        .digest("hex");
}

function verifyVerificationSignature(reference, signature) {
    const normalized = normalizeBookingReference(reference);
    const provided = String(signature || "").trim().toLowerCase();

    if (!/^[a-f0-9]{64}$/.test(provided)) {
        return false;
    }

    const expected = createVerificationSignature(normalized);
    const expectedBuffer = Buffer.from(expected, "hex");
    const providedBuffer = Buffer.from(provided, "hex");

    if (expectedBuffer.length !== providedBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

function buildQrPayload(reference) {
    const normalized = normalizeBookingReference(reference);
    const signature = createVerificationSignature(normalized);
    const baseUrl = getTicketPublicBaseUrl();

    return (
        `${baseUrl}/ticket/verify` +
        `?ref=${encodeURIComponent(normalized)}` +
        `&sig=${encodeURIComponent(signature)}`
    );
}

async function generateQrDataUrl(reference) {
    const payload = buildQrPayload(reference);

    return QRCode.toDataURL(payload, {
        errorCorrectionLevel: "M",
        type: "image/png",
        width: 420,
        margin: 2
    });
}

async function generateQrPngBuffer(reference) {
    const payload = buildQrPayload(reference);

    return QRCode.toBuffer(payload, {
        errorCorrectionLevel: "M",
        type: "png",
        width: 420,
        margin: 2
    });
}

module.exports = {
    normalizeBookingReference,
    getTicketPublicBaseUrl,
    createVerificationSignature,
    verifyVerificationSignature,
    buildQrPayload,
    generateQrDataUrl,
    generateQrPngBuffer
};
