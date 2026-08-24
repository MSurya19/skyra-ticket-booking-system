"use strict";

const mongoose =
    require("mongoose");

const crypto =
    require("crypto");


/* =========================================================
   SKYRA - SHOW MODEL
   File: backend/src/models/Show.js

   Event = reusable listing
   Show  = scheduled occurrence of that Event

   Phase 9 creates one ShowSeat snapshot for every active
   physical Venue Seat when a Show is created.
   ========================================================= */


const SHOW_STATUSES = [
    "SCHEDULED",
    "COMPLETED",
    "CANCELLED"
];


const pricingSchema =
    new mongoose.Schema(
        {

            categoryId: {

                type:
                    mongoose.Schema.Types.ObjectId,

                required:
                    true

            },


            categoryName: {

                type:
                    String,

                required:
                    true,

                trim:
                    true,

                maxlength:
                    60

            },


            capacity: {

                type:
                    Number,

                required:
                    true,

                min:
                    0

            },


            price: {

                type:
                    Number,

                required:
                    true,

                min:
                    1,

                max:
                    1000000

            }

        },
        {
            _id:
                false
        }
    );


const showSchema =
    new mongoose.Schema(
        {

            organiserId: {

                type:
                    mongoose.Schema.Types.ObjectId,

                ref:
                    "User",

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


            reference: {

                type:
                    String,

                required:
                    true,

                unique:
                    true,

                trim:
                    true,

                uppercase:
                    true,

                index:
                    true

            },


            /* -------------------------------------------------
               SNAPSHOT FIELDS

               These keep organiser dashboards readable even if
               Event/Venue metadata changes later.
               ------------------------------------------------- */

            eventTitle: {

                type:
                    String,

                required:
                    true,

                trim:
                    true,

                maxlength:
                    120

            },


            eventType: {

                type:
                    String,

                required:
                    true,

                trim:
                    true,

                uppercase:
                    true

            },


            venueName: {

                type:
                    String,

                required:
                    true,

                trim:
                    true,

                maxlength:
                    120

            },


            venueCity: {

                type:
                    String,

                trim:
                    true,

                maxlength:
                    80,

                default:
                    ""

            },


            /* -------------------------------------------------
               UI-FRIENDLY SCHEDULE FIELDS
               ------------------------------------------------- */

            date: {

                type:
                    String,

                required:
                    true,

                match:
                    /^\d{4}-\d{2}-\d{2}$/

            },


            time: {

                type:
                    String,

                required:
                    true,

                match:
                    /^([01]\d|2[0-3]):[0-5]\d$/

            },


            entryTime: {

                type:
                    String,

                default:
                    null,

                validate: {

                    validator:
                        function (
                            value
                        ) {

                            return (
                                value ===
                                    null ||
                                value ===
                                    "" ||
                                /^([01]\d|2[0-3]):[0-5]\d$/
                                    .test(
                                        value
                                    )
                            );

                        },

                    message:
                        "Invalid entry time."

                }

            },


            /*
               UTC instant calculated from the India-local
               date/time used by the current SKYRA UI.
            */

            startsAt: {

                type:
                    Date,

                required:
                    true,

                index:
                    true

            },


            endsAt: {

                type:
                    Date,

                default:
                    null,

                index:
                    true

            },


            entryOpensAt: {

                type:
                    Date,

                default:
                    null

            },


            bookingCloseMinutes: {

                type:
                    Number,

                min:
                    0,

                max:
                    1440,

                default:
                    30

            },


            bookingClosesAt: {

                type:
                    Date,

                default:
                    null

            },


            instructions: {

                type:
                    String,

                trim:
                    true,

                maxlength:
                    800,

                default:
                    ""

            },


            /* -------------------------------------------------
               CAPACITY / PRICING SNAPSHOT
               ------------------------------------------------- */

            capacity: {

                type:
                    Number,

                required:
                    true,

                min:
                    1

            },


            pricing: {

                type:
                    [pricingSchema],

                required:
                    true,

                validate: {

                    validator:
                        function (
                            value
                        ) {

                            return (
                                Array.isArray(
                                    value
                                ) &&
                                value.length >
                                    0
                            );

                        },

                    message:
                        "Show pricing is required."

                }

            },


            /*
               These start at 0 in Phase 8.
               Booking phases will maintain them later.
            */

            soldSeats: {

                type:
                    Number,

                min:
                    0,

                default:
                    0

            },


            revenue: {

                type:
                    Number,

                min:
                    0,

                default:
                    0

            },


            /* -------------------------------------------------
               PHASE 9 - SHOWSEAT SNAPSHOT STATE
               ------------------------------------------------- */

            seatsGenerated: {

                type:
                    Boolean,

                default:
                    false,

                index:
                    true

            },


            seatsGeneratedAt: {

                type:
                    Date,

                default:
                    null

            },


            status: {

                type:
                    String,

                enum:
                    SHOW_STATUSES,

                default:
                    "SCHEDULED",

                index:
                    true

            },


            cancelledAt: {

                type:
                    Date,

                default:
                    null

            },


            cancellationReason: {

                type:
                    String,

                trim:
                    true,

                maxlength:
                    300,

                default:
                    ""

            }

        },
        {

            timestamps:
                true

        }
    );


/* =========================================================
   INDEXES
   ========================================================= */

showSchema.index({
    organiserId:
        1,

    startsAt:
        1
});


showSchema.index({
    organiserId:
        1,

    status:
        1,

    startsAt:
        1
});


showSchema.index({
    venueId:
        1,

    startsAt:
        1
});


showSchema.index({
    eventId:
        1,

    startsAt:
        1
});


/* =========================================================
   SERVER-GENERATED REFERENCE
   ========================================================= */

showSchema.pre(
    "validate",
    function () {

        if (!this.reference) {

            this.reference =
                `SKY-SH-${
                    crypto
                        .randomBytes(
                            4
                        )
                        .toString(
                            "hex"
                        )
                        .toUpperCase()
                }`;

        }


        if (this.status) {

            this.status =
                String(
                    this.status
                )
                    .trim()
                    .toUpperCase();

        }

    }
);


showSchema.set(
    "toJSON",
    {
        virtuals:
            true
    }
);


showSchema.set(
    "toObject",
    {
        virtuals:
            true
    }
);


module.exports =
    mongoose.model(
        "Show",
        showSchema
    );


module.exports.SHOW_STATUSES =
    SHOW_STATUSES;
