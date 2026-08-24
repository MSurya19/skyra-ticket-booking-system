"use strict";

const mongoose =
    require("mongoose");


/* =========================================================
   SKYRA - SHOW SEAT MODEL
   File: backend/src/models/ShowSeat.js

   PURPOSE
   ---------------------------------------------------------
   Seat      = permanent physical Venue seat.
   ShowSeat  = per-Show snapshot of that physical seat.

   Example:

   Venue Seat A1
       ↓ copied when Show is created
   Show 1 / A1 / AVAILABLE
   Show 2 / A1 / AVAILABLE

   Booking state belongs here, NOT in Seat.js.
   ========================================================= */


const SHOW_SEAT_STATUSES = [
    "AVAILABLE",
    "HELD",
    "BOOKED",
    "OFFERED"
];


const showSeatSchema =
    new mongoose.Schema(
        {

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


            physicalSeatId: {

                type:
                    mongoose.Schema.Types.ObjectId,

                ref:
                    "Seat",

                required:
                    true,

                index:
                    true

            },


            /*
               categoryId is the embedded Venue seat-category _id.
               It is not a separate Mongoose model.
            */

            categoryId: {

                type:
                    mongoose.Schema.Types.ObjectId,

                required:
                    true,

                index:
                    true

            },


            row: {

                type:
                    String,

                required:
                    true,

                trim:
                    true,

                uppercase:
                    true,

                maxlength:
                    3

            },


            number: {

                type:
                    Number,

                required:
                    true,

                min:
                    1,

                max:
                    999

            },


            label: {

                type:
                    String,

                required:
                    true,

                trim:
                    true,

                uppercase:
                    true,

                maxlength:
                    6

            },


            /*
               Snapshot metadata.

               If an Admin later renames a Venue category,
               this Show keeps the category name/price that
               belonged to the Show when its seats were made.
            */

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


            price: {

                type:
                    Number,

                required:
                    true,

                min:
                    1,

                max:
                    1000000

            },


            status: {

                type:
                    String,

                enum:
                    SHOW_SEAT_STATUSES,

                default:
                    "AVAILABLE",

                required:
                    true,

                index:
                    true

            },


            /*
               Phase 11 temporary-hold metadata.

               These fields are populated only while status=HELD.
               The SeatHold document remains the canonical hold record.
            */

            holdId: {

                type:
                    mongoose.Schema.Types.ObjectId,

                ref:
                    "SeatHold",

                default:
                    null,

                index:
                    true

            },


            heldByUserId: {

                type:
                    mongoose.Schema.Types.ObjectId,

                ref:
                    "User",

                default:
                    null,

                index:
                    true

            },


            holdExpiresAt: {

                type:
                    Date,

                default:
                    null,

                index:
                    true

            },


            /*
               Phase 17 waitlist-offer metadata.

               These fields are populated only while status=OFFERED.
               WaitlistOffer remains the canonical offer record.
            */

            offerId: {

                type:
                    mongoose.Schema.Types.ObjectId,

                ref:
                    "WaitlistOffer",

                default:
                    null,

                index:
                    true

            },


            waitlistId: {

                type:
                    mongoose.Schema.Types.ObjectId,

                ref:
                    "Waitlist",

                default:
                    null,

                index:
                    true

            },


            offeredToUserId: {

                type:
                    mongoose.Schema.Types.ObjectId,

                ref:
                    "User",

                default:
                    null,

                index:
                    true

            },


            offerExpiresAt: {

                type:
                    Date,

                default:
                    null,

                index:
                    true

            },


            /*
               Phase 14 confirmed-booking metadata.
               Populated only while status=BOOKED.
            */

            bookingId: {

                type:
                    mongoose.Schema.Types.ObjectId,

                ref:
                    "Booking",

                default:
                    null,

                index:
                    true

            },


            bookedByUserId: {

                type:
                    mongoose.Schema.Types.ObjectId,

                ref:
                    "User",

                default:
                    null,

                index:
                    true

            },


            bookedAt: {

                type:
                    Date,

                default:
                    null

            }

        },
        {

            timestamps:
                true

        }
    );


/* =========================================================
   UNIQUE RULES

   The same physical seat can appear only once per Show.
   A Show also cannot contain the same seat label twice.
   ========================================================= */

showSeatSchema.index(
    {
        showId:
            1,

        physicalSeatId:
            1
    },
    {
        unique:
            true,

        name:
            "unique_show_physical_seat"
    }
);


showSeatSchema.index(
    {
        showId:
            1,

        label:
            1
    },
    {
        unique:
            true,

        name:
            "unique_show_seat_label"
    }
);


/* =========================================================
   COMMON BOOKING LOOKUPS
   ========================================================= */

showSeatSchema.index({
    showId:
        1,

    status:
        1
});


showSeatSchema.index({
    showId:
        1,

    categoryId:
        1,

    status:
        1
});


/*
   Expiry sweeps and owner-hold lookups.
*/
showSeatSchema.index({
    holdId:
        1,

    status:
        1
});


/*
   Phase 17 active waitlist offer lookups.
*/
showSeatSchema.index({
    offerId:
        1,

    status:
        1
});


showSeatSchema.index({
    showId:
        1,

    categoryId:
        1,

    offeredToUserId:
        1,

    status:
        1
});


showSeatSchema.set(
    "toJSON",
    {
        virtuals:
            true
    }
);


showSeatSchema.set(
    "toObject",
    {
        virtuals:
            true
    }
);


const ShowSeat =
    mongoose.model(
        "ShowSeat",
        showSeatSchema
    );


module.exports =
    ShowSeat;


module.exports.SHOW_SEAT_STATUSES =
    SHOW_SEAT_STATUSES;
