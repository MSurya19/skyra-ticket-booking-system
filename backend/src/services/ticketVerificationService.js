"use strict";

const Booking = require("../models/Booking");
const ApiError = require("../utils/ApiError");
const { HTTP_STATUS } = require("../utils/constants");
const qrService = require("./qrService");

const STATUS_BAD_REQUEST = HTTP_STATUS?.BAD_REQUEST || 400;
const STATUS_UNAUTHORIZED = HTTP_STATUS?.UNAUTHORIZED || 401;
const STATUS_NOT_FOUND = HTTP_STATUS?.NOT_FOUND || 404;

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function formatMoney(value, currency = "INR") {
    const amount = Number(value || 0);

    try {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: String(currency || "INR").toUpperCase(),
            maximumFractionDigits: 0
        }).format(amount);
    } catch {
        return `₹${amount}`;
    }
}

function requireVerificationInput(reference, signature) {
    const ref = String(reference || "").trim();
    const sig = String(signature || "").trim();

    if (!ref || !sig) {
        throw new ApiError(
            STATUS_BAD_REQUEST,
            "Ticket reference and signature are required."
        );
    }

    return {
        reference: qrService.normalizeBookingReference(ref),
        signature: sig
    };
}

async function verifyTicket(reference, signature) {
    const input = requireVerificationInput(reference, signature);

    const signatureValid = qrService.verifyVerificationSignature(
        input.reference,
        input.signature
    );

    if (!signatureValid) {
        throw new ApiError(
            STATUS_UNAUTHORIZED,
            "Invalid SKYRA ticket signature."
        );
    }

    const booking = await Booking.findOne({
        reference: input.reference
    });

    if (!booking) {
        throw new ApiError(
            STATUS_NOT_FOUND,
            "Booking not found."
        );
    }

    const seats = Array.isArray(booking.seats)
        ? booking.seats.map((seat) => ({
            label: seat.label,
            categoryName: seat.categoryName,
            price: Number(seat.price || 0)
        }))
        : [];

    return {
        bookingId: String(booking._id),
        reference: booking.reference,
        status: booking.status,
        valid: booking.status === "CONFIRMED",
        eventTitle: booking.eventTitle,
        eventType: booking.eventType || null,
        venueName: booking.venueName,
        venueCity: booking.venueCity || null,
        date: booking.date,
        time: booking.time,
        startsAt: booking.startsAt,
        seats,
        seatCount: Number(booking.seatCount || seats.length),
        grandTotal: Number(booking.grandTotal || 0),
        currency: booking.currency || "INR",
        confirmedAt: booking.confirmedAt || null,
        cancelledAt: booking.cancelledAt || null,
        verifiedAt: new Date().toISOString()
    };
}

function renderVerificationHtml(ticket) {
    const valid = Boolean(ticket?.valid);
    const title = valid ? "Ticket Valid" : "Ticket Not Valid";
    const statusText = valid
        ? "CONFIRMED & VALID"
        : String(ticket?.status || "INVALID");

    const seatText = Array.isArray(ticket?.seats) && ticket.seats.length
        ? ticket.seats
            .map((seat) => {
                const category = seat.categoryName
                    ? ` (${seat.categoryName})`
                    : "";
                return `${seat.label}${category}`;
            })
            .join(", ")
        : "—";

    const venueText = [
        ticket?.venueName,
        ticket?.venueCity
    ].filter(Boolean).join(", ");

    return `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="robots" content="noindex,nofollow">
    <title>SKYRA Ticket Verification</title>
    <style>
        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            padding: 24px;
            background:
                radial-gradient(circle at top, #182449 0, #08101f 38%, #050a14 100%);
            color: #eef2ff;
            font-family: Inter, Arial, Helvetica, sans-serif;
        }

        .card {
            width: min(620px, 100%);
            overflow: hidden;
            border: 1px solid #273653;
            border-radius: 22px;
            background: rgba(12, 21, 38, 0.97);
            box-shadow: 0 24px 70px rgba(0, 0, 0, 0.34);
        }

        .header {
            padding: 26px;
            background: linear-gradient(135deg, #4338ca, #7c3aed);
        }

        .brand {
            margin: 0 0 8px;
            font-size: 13px;
            font-weight: 800;
            letter-spacing: 0.22em;
        }

        h1 {
            margin: 0;
            font-size: 30px;
        }

        .content {
            padding: 26px;
        }

        .status {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 22px;
            padding: 9px 13px;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 800;
            letter-spacing: 0.06em;
            background: ${valid ? "#123c2d" : "#4a2027"};
            color: ${valid ? "#86efac" : "#fda4af"};
        }

        .reference-label {
            color: #94a3b8;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.14em;
        }

        .reference {
            margin-top: 6px;
            color: #ffffff;
            font-size: 22px;
            font-weight: 800;
            word-break: break-word;
        }

        .event {
            margin: 24px 0 8px;
            font-size: 24px;
            font-weight: 800;
        }

        .venue {
            margin: 0 0 22px;
            color: #cbd5e1;
        }

        .grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
        }

        .item {
            padding: 15px;
            border: 1px solid #263650;
            border-radius: 14px;
            background: #091321;
        }

        .item span {
            display: block;
            margin-bottom: 6px;
            color: #94a3b8;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }

        .item strong {
            color: #ffffff;
            line-height: 1.45;
        }

        .note {
            margin: 22px 0 0;
            padding-top: 18px;
            border-top: 1px solid #263650;
            color: #94a3b8;
            font-size: 13px;
            line-height: 1.6;
        }

        @media (max-width: 560px) {
            .grid {
                grid-template-columns: 1fr;
            }

            h1 {
                font-size: 25px;
            }
        }
    </style>
</head>
<body>
    <main class="card">
        <header class="header">
            <p class="brand">SKYRA</p>
            <h1>${escapeHtml(title)}</h1>
        </header>

        <section class="content">
            <div class="status">${escapeHtml(statusText)}</div>

            <div class="reference-label">BOOKING REFERENCE</div>
            <div class="reference">${escapeHtml(ticket?.reference || "—")}</div>

            <div class="event">${escapeHtml(ticket?.eventTitle || "SKYRA Event")}</div>
            <p class="venue">${escapeHtml(venueText || "—")}</p>

            <div class="grid">
                <div class="item">
                    <span>Date</span>
                    <strong>${escapeHtml(ticket?.date || "—")}</strong>
                </div>

                <div class="item">
                    <span>Time</span>
                    <strong>${escapeHtml(ticket?.time || "—")}</strong>
                </div>

                <div class="item">
                    <span>Seats</span>
                    <strong>${escapeHtml(seatText)}</strong>
                </div>

                <div class="item">
                    <span>Amount</span>
                    <strong>${escapeHtml(formatMoney(ticket?.grandTotal, ticket?.currency))}</strong>
                </div>
            </div>

            <p class="note">
                This result was verified against the SKYRA booking database using
                the signed QR payload. A cancelled booking will appear as not valid
                even when the QR signature itself is authentic.
            </p>
        </section>
    </main>
</body>
</html>`;
}

module.exports = {
    verifyTicket,
    renderVerificationHtml
};
