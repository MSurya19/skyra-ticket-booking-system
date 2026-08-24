"use strict";

const mongoose = require("mongoose");

const Booking = require("../models/Booking");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const { HTTP_STATUS } = require("../utils/constants");
const qrService = require("./qrService");
const emailService = require("./emailService");

const STATUS_BAD_REQUEST = HTTP_STATUS?.BAD_REQUEST || 400;
const STATUS_NOT_FOUND = HTTP_STATUS?.NOT_FOUND || 404;
const STATUS_CONFLICT = HTTP_STATUS?.CONFLICT || 409;

function requireObjectId(value, fieldName) {
    if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new ApiError(
            STATUS_BAD_REQUEST,
            `Invalid ${fieldName}.`
        );
    }

    return String(value);
}

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

function formatSeatLabels(seats) {
    return Array.isArray(seats)
        ? seats.map((seat) => seat.label).join(", ")
        : "";
}

function serializeTicketBooking(booking) {
    const value =
        typeof booking.toObject === "function"
            ? booking.toObject()
            : { ...booking };

    delete value.__v;
    delete value.qrDataUrl;

    return {
        ...value,
        id: String(value._id),
        _id: String(value._id),
        userId: String(value.userId),
        organiserId: value.organiserId ? String(value.organiserId) : null,
        paymentId: String(value.paymentId),
        holdId: String(value.holdId),
        showId: String(value.showId),
        eventId: String(value.eventId),
        venueId: String(value.venueId),
        seats: Array.isArray(value.seats)
            ? value.seats.map((seat) => ({
                ...seat,
                showSeatId: String(seat.showSeatId),
                categoryId: String(seat.categoryId)
            }))
            : []
    };
}

function buildTicketView(booking) {
    return {
        bookingId: String(booking._id),
        reference: booking.reference,
        status: booking.status,
        eventTitle: booking.eventTitle,
        eventType: booking.eventType || null,
        venueName: booking.venueName,
        venueCity: booking.venueCity || null,
        date: booking.date,
        time: booking.time,
        startsAt: booking.startsAt,
        seats: booking.seats.map((seat) => ({
            label: seat.label,
            categoryName: seat.categoryName,
            price: Number(seat.price)
        })),
        seatCount: Number(booking.seatCount),
        subtotal: Number(booking.subtotal),
        convenienceFee: Number(booking.convenienceFee),
        grandTotal: Number(booking.grandTotal),
        currency: booking.currency,
        paymentMethod: booking.paymentMethod || null,
        confirmedAt: booking.confirmedAt,
        qrPayload: booking.qrPayload || booking.reference,
        ticketEmailedAt: booking.ticketEmailedAt || null
    };
}

async function loadOwnedBooking(userId, bookingId, { includeQr = false } = {}) {
    requireObjectId(userId, "userId");
    requireObjectId(bookingId, "bookingId");

    let query = Booking.findOne({
        _id: bookingId,
        userId
    });

    if (includeQr) {
        query = query.select("+qrDataUrl");
    }

    const booking = await query;

    if (!booking) {
        throw new ApiError(
            STATUS_NOT_FOUND,
            "Booking not found."
        );
    }

    if (booking.status !== "CONFIRMED") {
        throw new ApiError(
            STATUS_CONFLICT,
            "QR tickets are available only for confirmed bookings."
        );
    }

    return booking;
}

async function ensureQrTicket(userId, bookingId) {
    const booking = await loadOwnedBooking(
        userId,
        bookingId,
        { includeQr: true }
    );

    const payload = qrService.buildQrPayload(booking.reference);

    if (!booking.qrDataUrl || booking.qrPayload !== payload) {
        booking.qrPayload = payload;
        booking.qrDataUrl = await qrService.generateQrDataUrl(booking.reference);
        await booking.save();
    }

    return {
        booking: serializeTicketBooking(booking),
        ticket: buildTicketView(booking),
        qrDataUrl: booking.qrDataUrl
    };
}

function createBookingEmailHtml(user, booking) {
    const seats = formatSeatLabels(booking.seats);

    return `
<!doctype html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>SKYRA Booking Confirmed</title>
</head>
<body style="margin:0;background:#07101e;font-family:Arial,Helvetica,sans-serif;color:#eaf0ff;">
    <div style="max-width:640px;margin:0 auto;padding:28px 18px;">
        <div style="background:#0d1728;border:1px solid #24324c;border-radius:18px;overflow:hidden;">
            <div style="padding:26px;background:linear-gradient(135deg,#4f46e5,#7c3aed);">
                <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;opacity:.85;">SKYRA</div>
                <h1 style="margin:8px 0 0;font-size:28px;color:#fff;">Booking confirmed</h1>
            </div>

            <div style="padding:26px;">
                <p style="margin-top:0;color:#cbd5e1;">Hi ${escapeHtml(user.name || "Customer")}, your ticket is ready.</p>

                <div style="padding:18px;border:1px solid #263752;border-radius:14px;background:#0a1322;">
                    <div style="font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:1.4px;">Booking Reference</div>
                    <div style="font-size:22px;font-weight:700;margin-top:6px;color:#ffffff;">${escapeHtml(booking.reference)}</div>

                    <div style="height:1px;background:#25344d;margin:18px 0;"></div>

                    <div style="font-size:19px;font-weight:700;color:#fff;">${escapeHtml(booking.eventTitle)}</div>
                    <div style="margin-top:8px;color:#cbd5e1;">${escapeHtml(booking.venueName)}${booking.venueCity ? `, ${escapeHtml(booking.venueCity)}` : ""}</div>
                    <div style="margin-top:6px;color:#cbd5e1;">${escapeHtml(booking.date)} • ${escapeHtml(booking.time)}</div>
                    <div style="margin-top:6px;color:#cbd5e1;">Seats: <strong style="color:#fff;">${escapeHtml(seats)}</strong></div>
                    <div style="margin-top:6px;color:#cbd5e1;">Total: <strong style="color:#fff;">${escapeHtml(formatMoney(booking.grandTotal, booking.currency))}</strong></div>
                </div>

                <div style="text-align:center;padding:24px 0 4px;">
                    <img src="cid:skyra-booking-qr" alt="SKYRA QR Ticket" width="230" height="230" style="display:block;margin:0 auto;background:#fff;padding:10px;border-radius:14px;">
                    <div style="margin-top:12px;color:#94a3b8;font-size:13px;">Scan this QR to open the secure SKYRA ticket verification page.</div>
                </div>

                <p style="margin:24px 0 0;color:#94a3b8;font-size:13px;line-height:1.6;">
                    Keep this email or open My Bookings in SKYRA when you arrive at the venue.
                </p>
            </div>
        </div>
    </div>
</body>
</html>`;
}

function createBookingEmailText(user, booking) {
    return [
        `Hi ${user.name || "Customer"},`,
        "",
        "Your SKYRA booking is confirmed.",
        `Booking Reference: ${booking.reference}`,
        `Event: ${booking.eventTitle}`,
        `Venue: ${booking.venueName}${booking.venueCity ? `, ${booking.venueCity}` : ""}`,
        `Date: ${booking.date}`,
        `Time: ${booking.time}`,
        `Seats: ${formatSeatLabels(booking.seats)}`,
        `Total: ${formatMoney(booking.grandTotal, booking.currency)}`,
        "",
        "The QR ticket is attached to this email. Scan it to open the secure SKYRA ticket verification page.",
        "",
        "SKYRA"
    ].join("\n");
}

async function sendBookingTicketEmail(userId, bookingId) {
    const ticketResult = await ensureQrTicket(userId, bookingId);

    const booking = await Booking
        .findOne({
            _id: bookingId,
            userId
        })
        .select("+qrDataUrl");

    if (!booking) {
        throw new ApiError(
            STATUS_NOT_FOUND,
            "Booking not found."
        );
    }

    const user = await User.findById(userId);

    if (!user || !user.email) {
        throw new ApiError(
            STATUS_CONFLICT,
            "The customer account does not have an email address for ticket delivery."
        );
    }

    const qrBuffer = await qrService.generateQrPngBuffer(booking.reference);

    const info = await emailService.sendEmail({
        to: user.email,
        subject: `SKYRA Booking Confirmed - ${booking.reference}`,
        text: createBookingEmailText(user, booking),
        html: createBookingEmailHtml(user, booking),
        attachments: [
            {
                filename: `${booking.reference}-QR.png`,
                content: qrBuffer,
                contentType: "image/png",
                cid: "skyra-booking-qr"
            }
        ]
    });

    booking.ticketEmailedAt = new Date();
    await booking.save();

    return {
        booking: serializeTicketBooking(booking),
        ticket: {
            ...ticketResult.ticket,
            ticketEmailedAt: booking.ticketEmailedAt
        },
        delivery: {
            sent: true,
            to: user.email,
            messageId: info?.messageId || null,
            accepted: Array.isArray(info?.accepted) ? info.accepted : [],
            rejected: Array.isArray(info?.rejected) ? info.rejected : []
        }
    };
}

module.exports = {
    ensureQrTicket,
    sendBookingTicketEmail,
    buildTicketView
};
