"use strict";

const mongoose =
    require("mongoose");

/* =========================================================
   SKYRA - PAYMENT VALIDATOR
   File: backend/src/validators/paymentValidator.js
   ========================================================= */

function text(value) {
    return String(value ?? "").trim();
}

function isObjectId(value) {
    return mongoose.Types.ObjectId.isValid(value);
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
    errors.push({
        field,
        message
    });
}

function validateContact(email, phone, errors) {
    const normalizedEmail = text(email).toLowerCase();
    const normalizedPhone = text(phone);

    if (
        normalizedEmail &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    ) {
        addError(
            errors,
            "email",
            "Enter a valid email address."
        );
    }

    if (normalizedPhone) {
        const digits = normalizedPhone.replace(/\D/g, "");
        if (digits.length < 10 || digits.length > 15) {
            addError(
                errors,
                "phone",
                "Enter a valid phone number."
            );
        }
    }

    return {
        email: normalizedEmail || null,
        phone: normalizedPhone || null
    };
}

function validateCreatePaymentOrder(body = {}) {
    const errors = [];
    const holdId = text(body.holdId);

    if (!isObjectId(holdId)) {
        addError(
            errors,
            "holdId",
            "A valid SeatHold ID is required."
        );
    }

    const contact = validateContact(
        body.email,
        body.phone,
        errors
    );

    return result(
        {
            holdId,
            ...contact
        },
        errors
    );
}

function validateVerifyPayment(body = {}) {
    const errors = [];
    const holdId = text(body.holdId);
    const razorpayOrderId = text(body.razorpayOrderId);
    const razorpayPaymentId = text(body.razorpayPaymentId);
    const razorpaySignature = text(body.razorpaySignature);

    if (!isObjectId(holdId)) {
        addError(
            errors,
            "holdId",
            "A valid SeatHold ID is required."
        );
    }

    if (!/^order_[A-Za-z0-9]+$/.test(razorpayOrderId)) {
        addError(
            errors,
            "razorpayOrderId",
            "A valid Razorpay Order ID is required."
        );
    }

    if (!/^pay_[A-Za-z0-9]+$/.test(razorpayPaymentId)) {
        addError(
            errors,
            "razorpayPaymentId",
            "A valid Razorpay Payment ID is required."
        );
    }

    if (!/^[a-fA-F0-9]{64}$/.test(razorpaySignature)) {
        addError(
            errors,
            "razorpaySignature",
            "A valid Razorpay signature is required."
        );
    }

    const contact = validateContact(
        body.email,
        body.phone,
        errors
    );

    return result(
        {
            holdId,
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature,
            ...contact
        },
        errors
    );
}

function validatePaymentParams(params = {}) {
    const errors = [];
    const paymentId = text(
        params.paymentId ||
        params.id
    );

    if (!isObjectId(paymentId)) {
        addError(
            errors,
            "paymentId",
            "A valid Payment ID is required."
        );
    }

    return result(
        { paymentId },
        errors
    );
}

function validatePaymentHoldParams(params = {}) {
    const errors = [];
    const holdId = text(params.holdId);

    if (!isObjectId(holdId)) {
        addError(
            errors,
            "holdId",
            "A valid SeatHold ID is required."
        );
    }

    return result(
        { holdId },
        errors
    );
}

module.exports = {
    validateCreatePaymentOrder,
    validateVerifyPayment,
    validatePaymentParams,
    validatePaymentHoldParams
};
