"use strict";

const mongoose =
    require("mongoose");

const Show =
    require("../models/Show");

const ShowSeat =
    require("../models/ShowSeat");

const Seat =
    require("../models/Seat");

const ApiError =
    require("../utils/ApiError");

const {
    HTTP_STATUS
} =
    require("../utils/constants");


/* =========================================================
   SKYRA - SHOW SEAT SERVICE
   File: backend/src/services/showSeatService.js

   Phase 9 responsibilities:
   - Copy active physical Seat records into ShowSeat.
   - Snapshot category name and ticket price.
   - Every generated ShowSeat starts AVAILABLE.
   - Keep generation idempotent / duplicate-safe.
   ========================================================= */


const STATUS_BAD_REQUEST =
    HTTP_STATUS?.BAD_REQUEST ||
    400;

const STATUS_NOT_FOUND =
    HTTP_STATUS?.NOT_FOUND ||
    404;

const STATUS_CONFLICT =
    HTTP_STATUS?.CONFLICT ||
    409;


/* =========================================================
   HELPERS
   ========================================================= */

function requireObjectId(
    value,
    fieldName
) {

    if (
        !mongoose.Types.ObjectId
            .isValid(
                value
            )
    ) {

        throw new ApiError(
            STATUS_BAD_REQUEST,
            `Invalid ${fieldName}.`
        );

    }


    return String(
        value
    );

}


function pricingMapFromShow(
    show
) {

    return new Map(
        (
            Array.isArray(
                show.pricing
            )
                ? show.pricing
                : []
        ).map(
            (item) => [
                String(
                    item.categoryId
                ),
                {
                    categoryId:
                        item.categoryId,

                    categoryName:
                        item.categoryName,

                    price:
                        Number(
                            item.price
                        )
                }
            ]
        )
    );

}


function buildCategoryCounts(
    showSeats
) {

    const counts =
        new Map();


    showSeats.forEach(
        (seat) => {

            const key =
                String(
                    seat.categoryId
                );


            counts.set(
                key,
                (
                    counts.get(
                        key
                    ) ||
                    0
                ) +
                1
            );

        }
    );


    return counts;

}


/* =========================================================
   GENERATE SHOWSEATS FOR ONE SHOW

   This function assumes the Show has already been validated
   by Show Service.

   When session is supplied, Show + ShowSeat creation is
   atomic inside the same MongoDB transaction.
   ========================================================= */

async function generateShowSeats(
    show,
    {
        session =
            null,
        rejectIfExisting =
            true
    } = {}
) {

    if (
        !show ||
        !show._id
    ) {

        throw new ApiError(
            STATUS_BAD_REQUEST,
            "A valid Show is required for seat generation."
        );

    }


    const existingQuery =
        ShowSeat.countDocuments({

            showId:
                show._id

        });


    if (session) {

        existingQuery.session(
            session
        );

    }


    const existingCount =
        await existingQuery;


    if (
        existingCount >
        0
    ) {

        if (rejectIfExisting) {

            throw new ApiError(
                STATUS_CONFLICT,
                "ShowSeats have already been generated for this Show."
            );

        }


        return {

            created:
                false,

            seatCount:
                existingCount

        };

    }


    const seatQuery =
        Seat.find({

            venueId:
                show.venueId,

            active:
                true

        })
            .sort({
                row:
                    1,

                number:
                    1
            });


    if (session) {

        seatQuery.session(
            session
        );

    }


    const physicalSeats =
        await seatQuery;


    if (
        !physicalSeats.length
    ) {

        throw new ApiError(
            STATUS_BAD_REQUEST,
            "The selected Venue has no active physical seats."
        );

    }


    const pricingMap =
        pricingMapFromShow(
            show
        );


    if (
        !pricingMap.size
    ) {

        throw new ApiError(
            STATUS_BAD_REQUEST,
            "Show pricing is missing."
        );

    }


    const documents =
        physicalSeats.map(
            (seat) => {

                const pricing =
                    pricingMap.get(
                        String(
                            seat.categoryId
                        )
                    );


                if (!pricing) {

                    throw new ApiError(
                        STATUS_BAD_REQUEST,
                        `Seat ${seat.label} belongs to a category that has no Show price.`
                    );

                }


                return {

                    showId:
                        show._id,

                    venueId:
                        show.venueId,

                    physicalSeatId:
                        seat._id,

                    categoryId:
                        seat.categoryId,

                    row:
                        seat.row,

                    number:
                        seat.number,

                    label:
                        seat.label,

                    categoryName:
                        pricing.categoryName,

                    price:
                        pricing.price,

                    status:
                        "AVAILABLE"

                };

            }
        );


    try {

        await ShowSeat.insertMany(
            documents,
            {
                ordered:
                    true,

                ...(session
                    ? {
                        session
                    }
                    : {})
            }
        );

    } catch (error) {

        if (
            error &&
            error.code ===
                11000
        ) {

            throw new ApiError(
                STATUS_CONFLICT,
                "Duplicate ShowSeat generation was blocked."
            );

        }


        throw error;

    }


    /*
       Physical Seat documents are the Phase 9 source of truth
       for Show capacity. Rebuild cached category capacities
       from the generated ShowSeat set.
    */

    const categoryCounts =
        buildCategoryCounts(
            documents
        );


    show.capacity =
        documents.length;


    show.pricing.forEach(
        (item) => {

            item.capacity =
                categoryCounts.get(
                    String(
                        item.categoryId
                    )
                ) ||
                0;

        }
    );


    show.seatsGenerated =
        true;

    show.seatsGeneratedAt =
        new Date();


    await show.save(
        session
            ? {
                session
            }
            : undefined
    );


    return {

        created:
            true,

        seatCount:
            documents.length

    };

}


/* =========================================================
   ORGANISER OWNERSHIP
   ========================================================= */

async function requireOwnedShow(
    organiserId,
    showId,
    session =
        null
) {

    requireObjectId(
        organiserId,
        "organiserId"
    );


    requireObjectId(
        showId,
        "showId"
    );


    const query =
        Show.findOne({

            _id:
                showId,

            organiserId

        });


    if (session) {

        query.session(
            session
        );

    }


    const show =
        await query;


    if (!show) {

        throw new ApiError(
            STATUS_NOT_FOUND,
            "Show not found."
        );

    }


    return show;

}


/* =========================================================
   READ SHOWSEATS
   ========================================================= */

function summarizeShowSeats(
    seats
) {

    const summary = {

        total:
            seats.length,

        available:
            0,

        held:
            0,

        booked:
            0,

        offered:
            0,

        byCategory:
            []

    };


    const categoryMap =
        new Map();


    seats.forEach(
        (seat) => {

            const status =
                String(
                    seat.status ||
                    ""
                )
                    .toUpperCase();


            switch (status) {

                case "AVAILABLE":
                    summary.available +=
                        1;
                    break;

                case "HELD":
                    summary.held +=
                        1;
                    break;

                case "BOOKED":
                    summary.booked +=
                        1;
                    break;

                case "OFFERED":
                    summary.offered +=
                        1;
                    break;

            }


            const key =
                String(
                    seat.categoryId
                );


            if (
                !categoryMap.has(
                    key
                )
            ) {

                categoryMap.set(
                    key,
                    {
                        categoryId:
                            key,

                        categoryName:
                            seat.categoryName,

                        price:
                            Number(
                                seat.price
                            ),

                        total:
                            0,

                        available:
                            0,

                        held:
                            0,

                        booked:
                            0,

                        offered:
                            0
                    }
                );

            }


            const category =
                categoryMap.get(
                    key
                );


            category.total +=
                1;


            const statusKey =
                status.toLowerCase();


            if (
                Object.prototype
                    .hasOwnProperty.call(
                        category,
                        statusKey
                    )
            ) {

                category[
                    statusKey
                ] +=
                    1;

            }

        }
    );


    summary.byCategory =
        Array.from(
            categoryMap.values()
        );


    return summary;

}


async function getOrganiserShowSeats(
    organiserId,
    showId
) {

    const show =
        await requireOwnedShow(
            organiserId,
            showId
        );


    const seats =
        await ShowSeat.find({

            showId:
                show._id

        })
            .sort({
                row:
                    1,

                number:
                    1
            });


    return {

        showId:
            String(
                show._id
            ),

        seatsGenerated:
            Boolean(
                show.seatsGenerated
            ),

        seatsGeneratedAt:
            show.seatsGeneratedAt ||
            null,

        seats,

        summary:
            summarizeShowSeats(
                seats
            )

    };

}


/* =========================================================
   ONE-TIME BACKFILL FOR PRE-PHASE-9 SHOWS

   Existing Phase 8 Shows may have been created before
   automatic ShowSeat generation existed.

   This operation is idempotent:
   - if seats already exist, it returns them as existing
   - otherwise it generates exactly once
   ========================================================= */

async function generateExistingShowSeats(
    organiserId,
    showId
) {

    const session =
        await mongoose
            .startSession();


    let result =
        null;


    try {

        await session.withTransaction(
            async () => {

                const show =
                    await requireOwnedShow(
                        organiserId,
                        showId,
                        session
                    );


                if (
                    show.status !==
                    "SCHEDULED"
                ) {

                    throw new ApiError(
                        STATUS_CONFLICT,
                        "Only scheduled Shows can generate ShowSeats."
                    );

                }


                const generation =
                    await generateShowSeats(
                        show,
                        {
                            session,
                            rejectIfExisting:
                                false
                        }
                    );


                result = {

                    showId:
                        String(
                            show._id
                        ),

                    seatsGenerated:
                        Boolean(
                            show.seatsGenerated
                        ) ||
                        generation.seatCount >
                            0,

                    seatsGeneratedAt:
                        show.seatsGeneratedAt ||
                        null,

                    created:
                        generation.created,

                    seatCount:
                        generation.seatCount

                };

            }
        );


        return result;

    } finally {

        await session.endSession();

    }

}


module.exports = {

    generateShowSeats,

    getOrganiserShowSeats,

    generateExistingShowSeats,

    summarizeShowSeats

};
