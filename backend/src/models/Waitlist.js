"use strict";

const mongoose = require("mongoose");


/* =========================================================
   SKYRA - WAITLIST MODEL
   File: backend/src/models/Waitlist.js

   One document represents one customer's queue position for
   one Show + seat category.

   FIFO order:
   joinedAt ASC, then _id ASC.
   ========================================================= */


const WAITLIST_STATUSES = [
    "WAITING",
    "OFFERED",
    "CLAIMED",
    "EXPIRED",
    "LEFT"
];


const waitlistSchema =
    new mongoose.Schema(
        {

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

            status: {
                type: String,
                enum: WAITLIST_STATUSES,
                default: "WAITING",
                required: true,
                index: true
            },

            joinedAt: {
                type: Date,
                default: Date.now,
                required: true,
                index: true
            },

            activeOfferId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "WaitlistOffer",
                default: null,
                index: true
            },

            offeredAt: {
                type: Date,
                default: null
            },

            claimedAt: {
                type: Date,
                default: null
            },

            expiredAt: {
                type: Date,
                default: null
            },

            leftAt: {
                type: Date,
                default: null
            },

            /*
               Present only while WAITING/OFFERED.
               A sparse unique index makes duplicate active joins
               impossible while still allowing a later rejoin after
               the prior entry reaches a terminal state.
            */
            activeKey: {
                type: String,
                trim: true,
                default: undefined
            }

        },
        {
            timestamps: true
        }
    );


waitlistSchema.index(
    {
        activeKey: 1
    },
    {
        unique: true,
        sparse: true,
        name: "unique_active_waitlist_key"
    }
);


waitlistSchema.index({
    showId: 1,
    categoryId: 1,
    status: 1,
    joinedAt: 1,
    _id: 1
});


waitlistSchema.index({
    userId: 1,
    status: 1,
    createdAt: -1
});


waitlistSchema.set("toJSON", {
    virtuals: true
});


waitlistSchema.set("toObject", {
    virtuals: true
});


const Waitlist =
    mongoose.model(
        "Waitlist",
        waitlistSchema
    );


module.exports = Waitlist;
module.exports.WAITLIST_STATUSES = WAITLIST_STATUSES;
