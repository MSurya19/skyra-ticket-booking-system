"use strict";

const mongoose = require("mongoose");


/* =========================================================
   SKYRA - VENUE MODEL

   Phase 4:
   - Venue metadata
   - Venue status
   - Soft delete
   - Capacity
   - Layout configuration

   Phase 5:
   - Embedded Seat Categories
   - GENERAL / PREMIUM / VIP etc.
   - Category status
   - Category capacity
   ========================================================= */


/* =========================================================
   CONSTANTS
   ========================================================= */

const VENUE_TYPES = [
    "STADIUM",
    "ARENA",
    "CINEMA",
    "CONVENTION_HALL",
    "AUDITORIUM",
    "VENUE"
];


const VENUE_STATUSES = [
    "ACTIVE",
    "INACTIVE"
];


const SEAT_CATEGORY_STATUSES = [
    "ACTIVE",
    "INACTIVE"
];


/* =========================================================
   SEAT CATEGORY SUB-SCHEMA

   Important:

   Seat Categories belong to a Venue.

   Example:

   Venue
      ├── GENERAL
      ├── PREMIUM
      └── VIP

   Ticket price is NOT stored here.

   Organiser will later assign category prices
   separately for each Show.
   ========================================================= */

const seatCategorySchema =
    new mongoose.Schema(
        {

            /* -------------------------------------------------
               CATEGORY NAME

               Example:
               General
               Premium
               VIP
               Balcony
               Gold
               ------------------------------------------------- */

            name: {

                type:
                    String,

                required:
                    [
                        true,
                        "Seat category name is required."
                    ],

                trim:
                    true,

                minlength:
                    [
                        2,
                        "Seat category name must contain at least 2 characters."
                    ],

                maxlength:
                    [
                        40,
                        "Seat category name cannot exceed 40 characters."
                    ]

            },


            /* -------------------------------------------------
               CATEGORY CODE

               Internal readable identifier.

               Example:
               GENERAL
               PREMIUM
               VIP
               GOLD_CLASS
               ------------------------------------------------- */

            code: {

                type:
                    String,

                required:
                    [
                        true,
                        "Seat category code is required."
                    ],

                trim:
                    true,

                uppercase:
                    true,

                minlength:
                    [
                        2,
                        "Seat category code must contain at least 2 characters."
                    ],

                maxlength:
                    [
                        30,
                        "Seat category code cannot exceed 30 characters."
                    ],

                match:
                    [
                        /^[A-Z0-9_]+$/,
                        "Seat category code may contain only uppercase letters, numbers and underscores."
                    ]

            },


            /* -------------------------------------------------
               DESCRIPTION
               ------------------------------------------------- */

            description: {

                type:
                    String,

                trim:
                    true,

                maxlength:
                    [
                        180,
                        "Seat category description cannot exceed 180 characters."
                    ],

                default:
                    ""

            },


            /* -------------------------------------------------
               STATUS

               INACTIVE categories should not be used
               for new physical seat assignments.
               ------------------------------------------------- */

            status: {

                type:
                    String,

                enum: {
                    values:
                        SEAT_CATEGORY_STATUSES,

                    message:
                        "Invalid seat category status."
                },

                default:
                    "ACTIVE",

                index:
                    true

            },


            /* -------------------------------------------------
               CAPACITY

               IMPORTANT:

               Admin does NOT manually enter this.

               This represents how many physical Seat
               records belong to this category.

               Phase 6 Seat Layout will maintain it.
               ------------------------------------------------- */

            capacity: {

                type:
                    Number,

                min:
                    [
                        0,
                        "Seat category capacity cannot be negative."
                    ],

                default:
                    0

            }

        },
        {

            /*
               Every embedded category requires its own
               MongoDB ObjectId.

               This gives us:

               venue.seatCategories.id(categoryId)
            */
            _id:
                true,

            timestamps:
                true

        }
    );


/* =========================================================
   VENUE SCHEMA
   ========================================================= */

const venueSchema =
    new mongoose.Schema(
        {

            /* -------------------------------------------------
               VENUE NAME
               ------------------------------------------------- */

            name: {

                type:
                    String,

                required:
                    [
                        true,
                        "Venue name is required."
                    ],

                trim:
                    true,

                minlength:
                    [
                        2,
                        "Venue name must contain at least 2 characters."
                    ],

                maxlength:
                    [
                        100,
                        "Venue name cannot exceed 100 characters."
                    ]

            },


            /* -------------------------------------------------
               VENUE TYPE
               ------------------------------------------------- */

            type: {

                type:
                    String,

                required:
                    [
                        true,
                        "Venue type is required."
                    ],

                enum: {
                    values:
                        VENUE_TYPES,

                    message:
                        "Invalid venue type."
                },

                uppercase:
                    true,

                trim:
                    true

            },


            /* -------------------------------------------------
               DESCRIPTION
               ------------------------------------------------- */

            description: {

                type:
                    String,

                trim:
                    true,

                maxlength:
                    [
                        500,
                        "Venue description cannot exceed 500 characters."
                    ],

                default:
                    ""

            },


            /* -------------------------------------------------
               STATUS
               ------------------------------------------------- */

            status: {

                type:
                    String,

                enum: {
                    values:
                        VENUE_STATUSES,

                    message:
                        "Invalid venue status."
                },

                default:
                    "ACTIVE",

                uppercase:
                    true,

                trim:
                    true

            },


            /* -------------------------------------------------
               ADDRESS
               ------------------------------------------------- */

            address: {

                type:
                    String,

                required:
                    [
                        true,
                        "Venue address is required."
                    ],

                trim:
                    true,

                maxlength:
                    [
                        180,
                        "Venue address cannot exceed 180 characters."
                    ]

            },


            city: {

                type:
                    String,

                required:
                    [
                        true,
                        "Venue city is required."
                    ],

                trim:
                    true,

                maxlength:
                    [
                        80,
                        "City cannot exceed 80 characters."
                    ]

            },


            state: {

                type:
                    String,

                required:
                    [
                        true,
                        "Venue state is required."
                    ],

                trim:
                    true,

                maxlength:
                    [
                        80,
                        "State cannot exceed 80 characters."
                    ]

            },


            country: {

                type:
                    String,

                required:
                    [
                        true,
                        "Venue country is required."
                    ],

                trim:
                    true,

                maxlength:
                    [
                        80,
                        "Country cannot exceed 80 characters."
                    ],

                default:
                    "India"

            },


            postalCode: {

                type:
                    String,

                required:
                    [
                        true,
                        "Venue postal code is required."
                    ],

                trim:
                    true,

                maxlength:
                    [
                        12,
                        "Postal code cannot exceed 12 characters."
                    ]

            },


            /* -------------------------------------------------
               TOTAL VENUE CAPACITY

               IMPORTANT:

               This is not changed through normal Venue
               metadata editing.

               Phase 6 Seat Layout will maintain the
               actual physical seat capacity.
               ------------------------------------------------- */

            capacity: {

                type:
                    Number,

                min:
                    [
                        0,
                        "Venue capacity cannot be negative."
                    ],

                default:
                    0

            },


            /* =================================================
               PHASE 5 - SEAT CATEGORIES
               ================================================= */

            seatCategories: {

                type:
                    [seatCategorySchema],

                default:
                    []

            },


            /* -------------------------------------------------
               SEAT LAYOUT STATUS

               false:
               Physical seats are not configured.

               true:
               Venue has a physical seat layout.
               ------------------------------------------------- */

            layoutConfigured: {

                type:
                    Boolean,

                default:
                    false

            },


            /* -------------------------------------------------
               SOFT DELETE

               Venue is never immediately removed from DB.

               This protects historical Event / Show /
               Booking references.
               ------------------------------------------------- */

            deleted: {

                type:
                    Boolean,

                default:
                    false,

                index:
                    true

            },


            deletedAt: {

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
   INDEXES
   ========================================================= */


/*
   Used for:
   - venue listing
   - duplicate checks
   - city filtering
*/
venueSchema.index({
    name:
        1,

    city:
        1,

    deleted:
        1
});


/*
   Used for Admin Venue filtering.
*/
venueSchema.index({
    status:
        1,

    deleted:
        1
});


venueSchema.index({
    type:
        1,

    deleted:
        1
});


venueSchema.index({
    city:
        1,

    status:
        1,

    deleted:
        1
});


/*
   Helpful when category codes are queried
   within Venue documents.
*/
venueSchema.index({
    "seatCategories.code":
        1
});


/* =========================================================
   QUERY HELPERS
   ========================================================= */


/*
   Usage:

   Venue.find().notDeleted()
*/
venueSchema.query.notDeleted =
    function () {

        return this.where({
            deleted:
                false
        });

    };


/* =========================================================
   INSTANCE METHODS - SEAT CATEGORIES
   ========================================================= */


/*
   Find an embedded category using MongoDB ObjectId.

   Example:

   venue.getSeatCategory(categoryId)
*/
venueSchema.methods.getSeatCategory =
    function (
        categoryId
    ) {

        if (!categoryId) {
            return null;
        }


        return this.seatCategories.id(
            categoryId
        );

    };


/*
   Find category using its code.

   Example:

   PREMIUM
*/
venueSchema.methods.getSeatCategoryByCode =
    function (
        code
    ) {

        const normalizedCode =
            String(
                code ||
                ""
            )
                .trim()
                .toUpperCase();


        if (!normalizedCode) {
            return null;
        }


        return (
            this.seatCategories.find(
                (category) =>
                    String(
                        category.code
                    ).toUpperCase() ===
                    normalizedCode
            )
            ||
            null
        );

    };


/*
   Find category using its display name.

   Name comparison is case-insensitive.

   Example:

   "Premium"
   "premium"
*/
venueSchema.methods.getSeatCategoryByName =
    function (
        name
    ) {

        const normalizedName =
            String(
                name ||
                ""
            )
                .trim()
                .toLowerCase()
                .replace(
                    /\s+/g,
                    " "
                );


        if (!normalizedName) {
            return null;
        }


        return (
            this.seatCategories.find(
                (category) => {

                    const categoryName =
                        String(
                            category.name ||
                            ""
                        )
                            .trim()
                            .toLowerCase()
                            .replace(
                                /\s+/g,
                                " "
                            );


                    return (
                        categoryName ===
                        normalizedName
                    );

                }
            )
            ||
            null
        );

    };


/*
   Check whether a category has physical seats.

   Phase 5 deletion rule:

   category.capacity > 0
       → cannot delete category
*/
venueSchema.methods.isSeatCategoryInUse =
    function (
        categoryId
    ) {

        const category =
            this.getSeatCategory(
                categoryId
            );


        if (!category) {
            return false;
        }


        return (
            Number(
                category.capacity ||
                0
            ) >
            0
        );

    };


/* =========================================================
   SERIALIZATION
   ========================================================= */


/*
   Mongoose automatically provides `id`
   as a string virtual based on `_id`.

   Keep both:
   - _id  → backend / MongoDB
   - id   → convenient frontend usage
*/
venueSchema.set(
    "toJSON",
    {
        virtuals:
            true
    }
);


venueSchema.set(
    "toObject",
    {
        virtuals:
            true
    }
);


/* =========================================================
   MODEL
   ========================================================= */

const Venue =
    mongoose.model(
        "Venue",
        venueSchema
    );


module.exports =
    Venue;