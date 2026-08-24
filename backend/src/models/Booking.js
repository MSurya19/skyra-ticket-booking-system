"use strict";

const mongoose = require("mongoose");
const crypto = require("crypto");

/* =========================================================
   SKYRA - BOOKING MODEL
   Phase 14
   ========================================================= */

const BOOKING_STATUSES = [
    "CONFIRMED",
    "CANCELLED"
];

function createBookingReference() {
    const year = new Date().getFullYear();
    const token = crypto.randomBytes(4).toString("hex").toUpperCase();
    return `SKY-BK-${year}-${token}`;
}

const bookingSeatSchema = new mongoose.Schema(
    {
        showSeatId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ShowSeat",
            required: true
        },
        categoryId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },
        row: {
            type: String,
            required: true,
            trim: true,
            uppercase: true
        },
        number: {
            type: Number,
            required: true
        },
        label: {
            type: String,
            required: true,
            trim: true,
            uppercase: true
        },
        categoryName: {
            type: String,
            required: true,
            trim: true
        },
        price: {
            type: Number,
            required: true,
            min: 0
        }
    },
    {
        _id: false
    }
);

const bookingSchema = new mongoose.Schema(
    {
        reference: {
            type: String,
            required: true,
            unique: true,
            index: true,
            default: createBookingReference
        },

        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        organiserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
            index: true
        },

        paymentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Payment",
            required: true,
            unique: true,
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

        eventTitle: {
            type: String,
            required: true,
            trim: true
        },

        eventType: {
            type: String,
            default: null,
            trim: true
        },

        venueName: {
            type: String,
            required: true,
            trim: true
        },

        venueCity: {
            type: String,
            default: null,
            trim: true
        },

        date: {
            type: String,
            required: true,
            trim: true
        },

        time: {
            type: String,
            required: true,
            trim: true
        },

        startsAt: {
            type: Date,
            required: true,
            index: true
        },

        seats: {
            type: [bookingSeatSchema],
            required: true,
            validate: {
                validator: (value) => Array.isArray(value) && value.length >= 1,
                message: "Booking must contain at least one seat."
            }
        },

        seatCount: {
            type: Number,
            required: true,
            min: 1,
            max: 6
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

        currency: {
            type: String,
            default: "INR",
            uppercase: true,
            trim: true,
            required: true
        },

        razorpayOrderId: {
            type: String,
            required: true,
            trim: true
        },

        razorpayPaymentId: {
            type: String,
            required: true,
            trim: true,
            index: true
        },

        paymentMethod: {
            type: String,
            default: null,
            trim: true
        },

        status: {
            type: String,
            enum: BOOKING_STATUSES,
            default: "CONFIRMED",
            required: true,
            index: true
        },

        confirmedAt: {
            type: Date,
            default: Date.now,
            required: true
        },

        cancelledAt: {
            type: Date,
            default: null
        },

        cancellationReason: {
            type: String,
            trim: true,
            maxlength: 500,
            default: null
        },

        refundStatus: {
            type: String,
            enum: ["NONE", "PENDING", "REFUNDED", "FAILED"],
            default: "NONE",
            index: true
        },

        refundAmount: {
            type: Number,
            min: 0,
            default: 0
        },

        refundId: {
            type: String,
            trim: true,
            default: null
        },

        qrPayload: {
            type: String,
            trim: true,
            default: null
        },

        qrDataUrl: {
            type: String,
            default: null,
            select: false
        },

        ticketEmailedAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

bookingSchema.index({
    userId: 1,
    startsAt: 1,
    status: 1
});

bookingSchema.index({
    showId: 1,
    status: 1,
    createdAt: -1
});

bookingSchema.index({
    organiserId: 1,
    status: 1,
    createdAt: -1
});

bookingSchema.set("toJSON", {
    virtuals: true,
    transform: (document, result) => {
        delete result.__v;
        delete result.qrDataUrl;
        return result;
    }
});

const Booking =
    mongoose.models.Booking ||
    mongoose.model("Booking", bookingSchema);

module.exports = Booking;
module.exports.BOOKING_STATUSES = BOOKING_STATUSES;
