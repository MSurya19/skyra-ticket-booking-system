"use strict";

const mongoose = require("mongoose");

function text(value) {
    return String(value ?? "").trim();
}

function result(value, errors) {
    const valid = errors.length === 0;
    return {
        valid,
        isValid: valid,
        value,
        data: value,
        sanitizedData: value,
        errors
    };
}

function addError(errors, field, message) {
    errors.push({ field, message });
}

function validateCreateBooking(body = {}) {
    const errors = [];
    const paymentId = text(body.paymentId);

    if (!mongoose.Types.ObjectId.isValid(paymentId)) {
        addError(
            errors,
            "paymentId",
            "A valid verified Payment ID is required."
        );
    }

    return result({ paymentId }, errors);
}

function validateBookingParams(params = {}) {
    const errors = [];
    const bookingId = text(params.bookingId || params.id);

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
        addError(
            errors,
            "bookingId",
            "A valid Booking ID is required."
        );
    }

    return result({ bookingId }, errors);
}

function validateBookingReferenceParams(params = {}) {
    const errors = [];
    const reference = text(params.reference).toUpperCase();

    if (!/^SKY-BK-\d{4}-[A-F0-9]{8}$/.test(reference)) {
        addError(
            errors,
            "reference",
            "A valid SKYRA booking reference is required."
        );
    }

    return result({ reference }, errors);
}

module.exports = {
    validateCreateBooking,
    validateBookingParams,
    validateBookingReferenceParams
};
