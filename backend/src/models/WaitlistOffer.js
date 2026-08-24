"use strict";

const mongoose = require("mongoose");


/* =========================================================
   SKYRA - WAITLIST OFFER MODEL
   File: backend/src/models/WaitlistOffer.js

   A released ShowSeat is temporarily reserved for exactly one
   waiting customer. The offer itself is historical and is not
   deleted after expiry.
   ========================================================= */


const WAITLIST_OFFER_STATUSES = [
    "ACTIVE",
    "CLAIMED",
    "EXPIRED",
    "CANCELLED"
];


const waitlistOfferSchema =
    new mongoose.Schema(
        {

            waitlistId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Waitlist",
                required: true,
                index: true
            },

            userId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                required: true,
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

            categoryId: {
                type: mongoose.Schema.Types.ObjectId,
                required: true,
                index: true
            },

            categoryName: {
                type: String,
                required: true,
                trim: true,
                maxlength: 60
            },

            showSeatId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "ShowSeat",
                required: true,
                index: true
            },

            seatLabel: {
                type: String,
                required: true,
                trim: true,
                uppercase: true,
                maxlength: 6
            },

            price: {
                type: Number,
                required: true,
                min: 1
            },

            status: {
                type: String,
                enum: WAITLIST_OFFER_STATUSES,
                default: "ACTIVE",
                required: true,
                index: true
            },

            offeredAt: {
                type: Date,
                default: Date.now,
                required: true
            },

            expiresAt: {
                type: Date,
                required: true,
                index: true
            },

            claimedAt: {
                type: Date,
                default: null
            },

            expiredAt: {
                type: Date,
                default: null
            },

            cancelledAt: {
                type: Date,
                default: null
            },

            holdId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "SeatHold",
                default: null,
                index: true
            },

            bookingId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Booking",
                default: null,
                index: true
            },

            /*
               If a claimed offer's checkout hold later expires,
               requeuedAt prevents the same abandoned claim from
               re-offering its seat more than once.
            */
            requeuedAt: {
                type: Date,
                default: null,
                index: true
            },

            /*
               Present only while status=ACTIVE.
               Sparse unique keys protect both the seat and queue entry
               from receiving two simultaneous active offers.
            */
            activeSeatKey: {
                type: String,
                trim: true,
                default: undefined
            },

            activeWaitlistKey: {
                type: String,
                trim: true,
                default: undefined
            }

        },
        {
            timestamps: true
        }
    );


waitlistOfferSchema.index(
    {
        activeSeatKey: 1
    },
    {
        unique: true,
        sparse: true,
        name: "unique_active_waitlist_offer_seat"
    }
);


waitlistOfferSchema.index(
    {
        activeWaitlistKey: 1
    },
    {
        unique: true,
        sparse: true,
        name: "unique_active_waitlist_offer_entry"
    }
);


waitlistOfferSchema.index({
    status: 1,
    expiresAt: 1
});


waitlistOfferSchema.index({
    showId: 1,
    categoryId: 1,
    status: 1,
    offeredAt: 1
});


waitlistOfferSchema.set("toJSON", {
    virtuals: true
});


waitlistOfferSchema.set("toObject", {
    virtuals: true
});


const WaitlistOffer =
    mongoose.model(
        "WaitlistOffer",
        waitlistOfferSchema
    );


module.exports = WaitlistOffer;
module.exports.WAITLIST_OFFER_STATUSES =
    WAITLIST_OFFER_STATUSES;
