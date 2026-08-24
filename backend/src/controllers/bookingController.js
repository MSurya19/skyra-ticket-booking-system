"use strict";

const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const bookingService = require("../services/bookingService");
const ticketService = require("../services/ticketService");
const { HTTP_STATUS } = require("../utils/constants");

const STATUS_OK = HTTP_STATUS?.OK || 200;
const STATUS_CREATED = HTTP_STATUS?.CREATED || 201;
const STATUS_UNAUTHORIZED = HTTP_STATUS?.UNAUTHORIZED || 401;

function body(req) {
    return req.validated?.body ?? req.validatedBody ?? req.body ?? {};
}

function params(req) {
    return req.validated?.params ?? req.validatedParams ?? req.params ?? {};
}

function customerId(req) {
    const value =
        req.user?._id ||
        req.user?.id ||
        req.auth?.userId ||
        req.auth?.id ||
        req.auth?.sub ||
        req.userId ||
        null;

    if (!value) {
        throw new ApiError(
            STATUS_UNAUTHORIZED,
            "Authentication required."
        );
    }

    return String(value);
}

const createBooking = asyncHandler(async (req, res) => {
    const userId = customerId(req);

    const booking = await bookingService.createBookingFromPayment(
        userId,
        body(req)
    );

    /*
       Booking confirmation must never be rolled back because SMTP is
       temporarily unavailable. Phase 15 therefore treats QR/email as
       post-confirmation delivery work.
    */
    let ticketDelivery = {
        qrGenerated: false,
        emailSent: false,
        error: null
    };

    try {
        await ticketService.ensureQrTicket(
            userId,
            booking._id
        );

        ticketDelivery.qrGenerated = true;

        await ticketService.sendBookingTicketEmail(
            userId,
            booking._id
        );

        ticketDelivery.emailSent = true;
    } catch (error) {
        ticketDelivery.error = error?.message || "Ticket delivery failed.";
    }

    return res.status(STATUS_CREATED).json({
        success: true,
        message: "Booking confirmed successfully.",
        data: {
            booking,
            ticketDelivery
        }
    });
});


const cancelBooking = asyncHandler(async (req, res) => {
    const { bookingId } = params(req);

    const result =
        await bookingService.cancelCustomerBooking(
            customerId(req),
            bookingId,
            body(req)
        );

    const refundStatus =
        String(
            result?.refund?.status ||
            result?.booking?.refundStatus ||
            ""
        ).toUpperCase();

    let message =
        "Booking cancelled successfully.";

    if (
        refundStatus ===
        "REFUNDED"
    ) {
        message =
            "Booking cancelled and refund completed successfully.";
    } else if (
        refundStatus ===
        "PENDING"
    ) {
        message =
            "Booking cancelled and the refund is being processed.";
    } else if (
        refundStatus ===
        "FAILED"
    ) {
        message =
            "Booking cancelled, but the refund could not be completed automatically.";
    }

    return res.status(STATUS_OK).json({
        success: true,
        message,
        data: result
    });
});

const getBooking = asyncHandler(async (req, res) => {
    const { bookingId } = params(req);
    const booking = await bookingService.getBookingById(
        customerId(req),
        bookingId
    );

    return res.status(STATUS_OK).json({
        success: true,
        message: "Booking retrieved successfully.",
        data: { booking }
    });
});

const getBookingByReference = asyncHandler(async (req, res) => {
    const { reference } = params(req);
    const booking = await bookingService.getBookingByReference(
        customerId(req),
        reference
    );

    return res.status(STATUS_OK).json({
        success: true,
        message: "Booking retrieved successfully.",
        data: { booking }
    });
});

const listBookings = asyncHandler(async (req, res) => {
    const bookings = await bookingService.listCustomerBookings(
        customerId(req)
    );

    return res.status(STATUS_OK).json({
        success: true,
        message: "Bookings retrieved successfully.",
        data: {
            bookings,
            count: bookings.length
        }
    });
});

const getTicket = asyncHandler(async (req, res) => {
    const { bookingId } = params(req);

    const result = await ticketService.ensureQrTicket(
        customerId(req),
        bookingId
    );

    return res.status(STATUS_OK).json({
        success: true,
        message: "QR ticket retrieved successfully.",
        data: result
    });
});

const emailTicket = asyncHandler(async (req, res) => {
    const { bookingId } = params(req);

    const result = await ticketService.sendBookingTicketEmail(
        customerId(req),
        bookingId
    );

    return res.status(STATUS_OK).json({
        success: true,
        message: "Booking confirmation email sent successfully.",
        data: result
    });
});

module.exports = {
    createBooking,
    cancelBooking,
    getBooking,
    getBookingByReference,
    listBookings,
    getTicket,
    emailTicket
};
