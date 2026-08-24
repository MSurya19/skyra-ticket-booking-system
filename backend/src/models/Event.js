"use strict";

const mongoose =
    require("mongoose");


/* =========================================================
   SKYRA - EVENT MODEL
   File: backend/src/models/Event.js

   Phase 7:
   - An Event is the reusable listing/identity.
   - Venue/date/time/pricing do NOT belong here.
   - Those belong to Show records in Phase 8.
   ========================================================= */


const EVENT_TYPES = [
    "MOVIE",
    "CONCERT",
    "LIVE_SHOW"
];


const EVENT_STATUSES = [
    "PUBLISHED",
    "DRAFT",
    "ARCHIVED"
];


const AGE_RATINGS = [
    "",
    "U",
    "UA",
    "A",
    "13+",
    "16+",
    "18+"
];


const eventSchema =
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


            title: {

                type:
                    String,

                required:
                    true,

                trim:
                    true,

                minlength:
                    3,

                maxlength:
                    120

            },


            type: {

                type:
                    String,

                enum:
                    EVENT_TYPES,

                required:
                    true,

                index:
                    true

            },


            genre: {

                type:
                    String,

                required:
                    true,

                trim:
                    true,

                maxlength:
                    60

            },


            language: {

                type:
                    String,

                trim:
                    true,

                maxlength:
                    60,

                default:
                    ""

            },


            duration: {

                type:
                    Number,

                min:
                    1,

                max:
                    1000,

                default:
                    null

            },


            ageRating: {

                type:
                    String,

                enum:
                    AGE_RATINGS,

                default:
                    ""

            },


            description: {

                type:
                    String,

                required:
                    true,

                trim:
                    true,

                minlength:
                    20,

                maxlength:
                    1500

            },


            performers: {

                type:
                    [String],

                default:
                    []

            },


            creator: {

                type:
                    String,

                trim:
                    true,

                maxlength:
                    120,

                default:
                    ""

            },


            tags: {

                type:
                    [String],

                default:
                    []

            },


            /*
               Phase 7 stores media references/metadata only.

               The current frontend uses local File objects for
               previews. Actual binary/image hosting can later be
               connected through a dedicated media service.
            */

            posterUrl: {

                type:
                    String,

                trim:
                    true,

                default:
                    ""

            },


            bannerUrl: {

                type:
                    String,

                trim:
                    true,

                default:
                    ""

            },


            posterFileName: {

                type:
                    String,

                trim:
                    true,

                maxlength:
                    255,

                default:
                    ""

            },


            bannerFileName: {

                type:
                    String,

                trim:
                    true,

                maxlength:
                    255,

                default:
                    ""

            },


            status: {

                type:
                    String,

                enum:
                    EVENT_STATUSES,

                default:
                    "PUBLISHED",

                index:
                    true

            },


            publishedAt: {

                type:
                    Date,

                default:
                    null

            },


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

eventSchema.index(
    {
        organiserId:
            1,

        deleted:
            1,

        status:
            1,

        createdAt:
            -1
    }
);


eventSchema.index(
    {
        organiserId:
            1,

        type:
            1,

        createdAt:
            -1
    }
);


/* =========================================================
   NORMALIZATION
   ========================================================= */

eventSchema.pre(
    "validate",
    function () {

        if (this.type) {

            this.type =
                String(
                    this.type
                )
                    .trim()
                    .toUpperCase();

        }


        if (this.status) {

            this.status =
                String(
                    this.status
                )
                    .trim()
                    .toUpperCase();

        }


        if (this.ageRating) {

            this.ageRating =
                String(
                    this.ageRating
                )
                    .trim()
                    .toUpperCase();

        }


        if (
            this.status ===
                "PUBLISHED" &&
            !this.publishedAt
        ) {

            this.publishedAt =
                new Date();

        }


        if (
            this.status !==
            "PUBLISHED" &&
            this.isModified(
                "status"
            )
        ) {

            this.publishedAt =
                null;

        }


        this.performers =
            normalizeStringArray(
                this.performers,
                20,
                100
            );


        this.tags =
            normalizeStringArray(
                this.tags,
                25,
                60
            );

    }
);


function normalizeStringArray(
    values,
    maxItems,
    maxLength
) {

    const list =
        Array.isArray(
            values
        )
            ? values
            : [];


    const seen =
        new Set();


    return list
        .map(
            (value) =>
                String(
                    value || ""
                ).trim()
        )
        .filter(Boolean)
        .filter(
            (value) => {

                const key =
                    value.toLowerCase();


                if (
                    seen.has(
                        key
                    )
                ) {

                    return false;

                }


                seen.add(
                    key
                );


                return true;

            }
        )
        .map(
            (value) =>
                value.slice(
                    0,
                    maxLength
                )
        )
        .slice(
            0,
            maxItems
        );

}


/* =========================================================
   JSON
   ========================================================= */

eventSchema.set(
    "toJSON",
    {

        virtuals:
            true

    }
);


eventSchema.set(
    "toObject",
    {

        virtuals:
            true

    }
);


module.exports =
    mongoose.model(
        "Event",
        eventSchema
    );


module.exports.EVENT_TYPES =
    EVENT_TYPES;

module.exports.EVENT_STATUSES =
    EVENT_STATUSES;

module.exports.AGE_RATINGS =
    AGE_RATINGS;
