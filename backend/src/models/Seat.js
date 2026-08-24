"use strict";

const mongoose =
    require("mongoose");


/* =========================================================
   SKYRA - PHYSICAL SEAT MODEL
   File: backend/src/models/Seat.js

   PURPOSE
   ---------------------------------------------------------
   A Seat is a permanent physical seat belonging to a Venue.

   Example:

   Venue
      └── Seat
            ├── A1
            ├── A2
            ├── A3
            └── B1

   Each Seat references one embedded Venue Seat Category
   through categoryId.

   IMPORTANT
   ---------------------------------------------------------
   AVAILABLE / HELD / BOOKED / OFFERED are NOT stored here.

   Those statuses belong to ShowSeat and are created
   separately for every Show.
   ========================================================= */


/* =========================================================
   1. PHYSICAL SEAT SCHEMA
   ========================================================= */

const seatSchema =
    new mongoose.Schema(
        {

            /* -------------------------------------------------
               VENUE

               Physical Seat belongs to exactly one Venue.
               ------------------------------------------------- */

            venueId: {

                type:
                    mongoose.Schema.Types.ObjectId,

                ref:
                    "Venue",

                required:
                    [
                        true,
                        "Venue ID is required."
                    ],

                index:
                    true

            },


            /* -------------------------------------------------
               ROW

               Examples:
               A
               B
               AA
               AB
               ------------------------------------------------- */

            row: {

                type:
                    String,

                required:
                    [
                        true,
                        "Seat row is required."
                    ],

                trim:
                    true,

                uppercase:
                    true,

                minlength:
                    [
                        1,
                        "Seat row is required."
                    ],

                maxlength:
                    [
                        3,
                        "Seat row cannot exceed 3 characters."
                    ],

                match:
                    [
                        /^[A-Z]{1,3}$/,
                        "Seat row must contain letters only."
                    ]

            },


            /* -------------------------------------------------
               NUMBER

               Example:
               A1  -> number = 1
               A25 -> number = 25
               ------------------------------------------------- */

            number: {

                type:
                    Number,

                required:
                    [
                        true,
                        "Seat number is required."
                    ],

                min:
                    [
                        1,
                        "Seat number must be at least 1."
                    ],

                max:
                    [
                        999,
                        "Seat number cannot exceed 999."
                    ],

                validate: {

                    validator:
                        Number.isInteger,

                    message:
                        "Seat number must be an integer."

                }

            },


            /* -------------------------------------------------
               LABEL

               Canonical physical seat label.

               Examples:
               A1
               A2
               AA10
               ------------------------------------------------- */

            label: {

                type:
                    String,

                required:
                    [
                        true,
                        "Seat label is required."
                    ],

                trim:
                    true,

                uppercase:
                    true,

                maxlength:
                    [
                        6,
                        "Seat label cannot exceed 6 characters."
                    ],

                match:
                    [
                        /^[A-Z]{1,3}[1-9][0-9]{0,2}$/,
                        "Seat label must be a valid row and seat number such as A1 or AA10."
                    ]

            },


            /* -------------------------------------------------
               SEAT CATEGORY

               categoryId points to the _id of an embedded
               seatCategories item inside the Venue document.

               It is intentionally NOT a Mongoose ref because
               SeatCategory is not a separate MongoDB model.
               ------------------------------------------------- */

            categoryId: {

                type:
                    mongoose.Schema.Types.ObjectId,

                required:
                    [
                        true,
                        "Seat category ID is required."
                    ],

                index:
                    true

            },


            /* -------------------------------------------------
               ACTIVE

               true:
               seat may be used when future Shows are generated.

               false:
               physical seat exists but is disabled.

               This is NOT booking availability.
               ------------------------------------------------- */

            active: {

                type:
                    Boolean,

                default:
                    true,

                index:
                    true

            }

        },
        {

            timestamps:
                true

        }
    );


/* =========================================================
   2. UNIQUE PHYSICAL-SEAT RULES

   A Venue cannot contain the same row + number twice.

   It also cannot contain the same label twice.
   ========================================================= */

seatSchema.index(
    {
        venueId:
            1,

        row:
            1,

        number:
            1
    },
    {
        unique:
            true,

        name:
            "unique_venue_row_number"
    }
);


seatSchema.index(
    {
        venueId:
            1,

        label:
            1
    },
    {
        unique:
            true,

        name:
            "unique_venue_seat_label"
    }
);


/* =========================================================
   3. COMMON LOOKUP INDEX
   ========================================================= */

seatSchema.index({
    venueId:
        1,

    categoryId:
        1,

    active:
        1
});


/* =========================================================
   4. NORMALIZATION BEFORE VALIDATION

   Keep row and label predictable even when the service
   receives lowercase values.
   ========================================================= */

seatSchema.pre(
    "validate",
    function () {

        if (this.row) {

            this.row =
                String(
                    this.row
                )
                    .trim()
                    .toUpperCase();

        }


        if (
            this.number !==
                undefined &&
            this.number !==
                null &&
            this.row
        ) {

            /*
               The physical label is derived from row + number.
               Do not trust a conflicting client-provided label.

               IMPORTANT:
               This middleware is synchronous, so it does not
               receive or call next().
            */

            this.label =
                `${
                    this.row
                }${
                    Number(
                        this.number
                    )
                }`;

        }

    }
);


/* =========================================================
   5. SERIALIZATION
   ========================================================= */

seatSchema.set(
    "toJSON",
    {
        virtuals:
            true
    }
);


seatSchema.set(
    "toObject",
    {
        virtuals:
            true
    }
);


/* =========================================================
   6. MODEL
   ========================================================= */

const Seat =
    mongoose.model(
        "Seat",
        seatSchema
    );


module.exports =
    Seat;
