"use strict";

const mongoose =
    require("mongoose");

const crypto =
    require("crypto");

/* =========================================================
   SKYRA - PAYMENT MODEL
   File: backend/src/models/Payment.js

   Phase 13 stores the Razorpay order and verified payment.
   A Booking is deliberately NOT created in this phase.
   ========================================================= */

const PAYMENT_STATUSES = [
    "ORDER_CREATED",
    "VERIFIED",
    "FAILED"
];

function createPaymentReference() {
    return `SKY-PAY-${
        crypto.randomBytes(4)
            .toString("hex")
            .toUpperCase()
    }`;
}

const paymentSchema =
    new mongoose.Schema(
        {
            reference: {
                type: String,
                required: true,
                unique: true,
                index: true,
                default: createPaymentReference
            },

            userId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                required: true,
                index: true
            },

            holdId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "SeatHold",
                required: true,
                unique: true,
                index: true
            },

            showId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Show",
                required: true,
                index: true
            },

            eventId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Event",
                required: true,
                index: true
            },

            venueId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Venue",
                required: true,
                index: true
            },

            bookingId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Booking",
                index: true,
                sparse: true,
                default: undefined
            },

            status: {
                type: String,
                enum: PAYMENT_STATUSES,
                default: "ORDER_CREATED",
                required: true,
                index: true
            },

            gateway: {
                type: String,
                enum: ["RAZORPAY"],
                default: "RAZORPAY",
                required: true
            },

            currency: {
                type: String,
                default: "INR",
                uppercase: true,
                trim: true,
                required: true
            },

            subtotal: {
                type: Number,
                required: true,
                min: 0
            },

            convenienceFee: {
                type: Number,
                required: true,
                min: 0
            },

            grandTotal: {
                type: Number,
                required: true,
                min: 1
            },

            amountPaise: {
                type: Number,
                required: true,
                min: 100
            },

            email: {
                type: String,
                trim: true,
                lowercase: true,
                maxlength: 160,
                default: null
            },

            phone: {
                type: String,
                trim: true,
                maxlength: 24,
                default: null
            },

            razorpayOrderId: {
                type: String,
                required: true,
                unique: true,
                index: true,
                trim: true
            },

            razorpayPaymentId: {
                type: String,
                unique: true,
                sparse: true,
                index: true,
                trim: true,
                // IMPORTANT: keep this field MISSING until Razorpay
                // returns a real payment id. A sparse unique index
                // ignores missing fields, but explicit null values
                // can collide across multiple Payment documents.
                default: undefined
            },

            razorpaySignature: {
                type: String,
                select: false,
                trim: true,
                default: null
            },

            gatewayOrderStatus: {
                type: String,
                trim: true,
                default: null
            },

            gatewayPaymentStatus: {
                type: String,
                trim: true,
                default: null
            },

            paymentMethod: {
                type: String,
                trim: true,
                default: null
            },

            /*
               Phase 16 refund metadata.
               Payment.status remains VERIFIED because the original payment
               was valid; refund lifecycle is tracked separately.
            */
            refundStatus: {
                type: String,
                enum: ["NONE", "PENDING", "REFUNDED", "FAILED"],
                default: "NONE",
                required: true,
                index: true
            },

            refundAmountPaise: {
                type: Number,
                min: 0,
                default: 0
            },

            razorpayRefundId: {
                type: String,
                trim: true,
                default: undefined,
                sparse: true,
                index: true
            },

            refundGatewayStatus: {
                type: String,
                trim: true,
                default: null
            },

            refundedAt: {
                type: Date,
                default: null
            },

            refundFailureReason: {
                type: String,
                trim: true,
                maxlength: 500,
                default: null
            },

            verifiedAt: {
                type: Date,
                default: null
            },

            failedAt: {
                type: Date,
                default: null
            },

            failureReason: {
                type: String,
                trim: true,
                maxlength: 500,
                default: null
            }
        },
        {
            timestamps: true
        }
    );

paymentSchema.index({
    userId: 1,
    createdAt: -1
});

paymentSchema.index({
    showId: 1,
    status: 1,
    createdAt: -1
});

paymentSchema.set("toJSON", {
    virtuals: true,
    transform: (
        document,
        result
    ) => {
        delete result.razorpaySignature;
        delete result.__v;
        return result;
    }
});

module.exports =
    mongoose.models.Payment ||
    mongoose.model(
        "Payment",
        paymentSchema
    );

module.exports.PAYMENT_STATUSES =
    PAYMENT_STATUSES;
