"use strict";

const mongoose =
    require("mongoose");


/* =========================================================
   SKYRA - SEAT HOLD MODEL
   File: backend/src/models/SeatHold.js

   A SeatHold temporarily reserves one or more ShowSeat
   documents for one authenticated Customer.
   ========================================================= */


const SEAT_HOLD_STATUSES = [
    "ACTIVE",
    "RELEASED",
    "EXPIRED",
    "CONSUMED"
];


const seatHoldSchema =
    new mongoose.Schema(
        {

            userId: {

                type:
                    mongoose.Schema.Types.ObjectId,

                ref:
                    "User",

                required:
                    true,

                index:
                    true

            },


            showId: {

                type:
                    mongoose.Schema.Types.ObjectId,

                ref:
                    "Show",

                required:
                    true,

                index:
                    true

            },


            eventId: {

                type:
                    mongoose.Schema.Types.ObjectId,

                ref:
                    "Event",

                required:
                    true,

                index:
                    true

            },


            venueId: {

                type:
                    mongoose.Schema.Types.ObjectId,

                ref:
                    "Venue",

                required:
                    true,

                index:
                    true

            },


            showSeatIds: {

                type: [
                    {
                        type:
                            mongoose.Schema.Types.ObjectId,

                        ref:
                            "ShowSeat"
                    }
                ],

                required:
                    true,

                validate: {
                    validator:
                        (value) =>
                            Array.isArray(
                                value
                            ) &&
                            value.length >=
                                1 &&
                            value.length <=
                                6,

                    message:
                        "A seat hold must contain between 1 and 6 seats."
                }

            },


            status: {

                type:
                    String,

                enum:
                    SEAT_HOLD_STATUSES,

                default:
                    "ACTIVE",

                required:
                    true,

                index:
                    true

            },


            expiresAt: {

                type:
                    Date,

                required:
                    true,

                index:
                    true

            },


            releasedAt: {

                type:
                    Date,

                default:
                    null

            },


            expiredAt: {

                type:
                    Date,

                default:
                    null

            },


            consumedAt: {

                type:
                    Date,

                default:
                    null

            },


            consumedByBookingId: {

                type:
                    mongoose.Schema.Types.ObjectId,

                ref:
                    "Booking",

                default:
                    null,

                index:
                    true

            },


            releaseReason: {

                type:
                    String,

                trim:
                    true,

                maxlength:
                    120,

                default:
                    null

            }

        },
        {

            timestamps:
                true

        }
    );


/*
   One Customer may have only one ACTIVE checkout hold at a
   time. This is also a database-level guard against duplicate
   holds being created from multiple tabs.
*/
seatHoldSchema.index(
    {
        userId:
            1,

        status:
            1
    },
    {
        unique:
            true,

        partialFilterExpression: {
            status:
                "ACTIVE"
        },

        name:
            "one_active_hold_per_customer"
    }
);


seatHoldSchema.index({
    showId:
        1,

    status:
        1,

    expiresAt:
        1
});


seatHoldSchema.index({
    status:
        1,

    expiresAt:
        1
});


seatHoldSchema.set(
    "toJSON",
    {
        virtuals:
            true
    }
);


seatHoldSchema.set(
    "toObject",
    {
        virtuals:
            true
    }
);


const SeatHold =
    mongoose.model(
        "SeatHold",
        seatHoldSchema
    );


module.exports =
    SeatHold;


module.exports.SEAT_HOLD_STATUSES =
    SEAT_HOLD_STATUSES;
