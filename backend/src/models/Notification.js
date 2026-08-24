"use strict";

const mongoose = require("mongoose");

const NOTIFICATION_TYPES = [
    "WAITLIST_OFFER",
    "BOOKING_CONFIRMED",
    "BOOKING_CANCELLED",
    "REFUND_UPDATED",
    "SYSTEM"
];

const notificationSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        type: {
            type: String,
            enum: NOTIFICATION_TYPES,
            required: true,
            index: true
        },

        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 140
        },

        message: {
            type: String,
            required: true,
            trim: true,
            maxlength: 1000
        },

        read: {
            type: Boolean,
            default: false,
            required: true,
            index: true
        },

        readAt: {
            type: Date,
            default: null
        },

        bookingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Booking",
            default: null,
            index: true
        },

        paymentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Payment",
            default: null
        },

        showId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Show",
            default: null,
            index: true
        },

        eventId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Event",
            default: null,
            index: true
        },

        waitlistId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Waitlist",
            default: null,
            index: true
        },

        offerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "WaitlistOffer",
            default: null,
            index: true
        },

        actionUrl: {
            type: String,
            trim: true,
            default: null,
            maxlength: 500
        },

        actionLabel: {
            type: String,
            trim: true,
            default: null,
            maxlength: 80
        },

        dedupeKey: {
            type: String,
            trim: true,
            default: undefined
        }
    },
    {
        timestamps: true
    }
);

notificationSchema.index(
    { userId: 1, createdAt: -1 }
);

notificationSchema.index(
    { userId: 1, read: 1, createdAt: -1 }
);

notificationSchema.index(
    { dedupeKey: 1 },
    {
        unique: true,
        sparse: true
    }
);

module.exports = mongoose.model(
    "Notification",
    notificationSchema
);

module.exports.NOTIFICATION_TYPES =
    NOTIFICATION_TYPES;
