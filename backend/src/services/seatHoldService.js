"use strict";

const mongoose =
    require("mongoose");

const SeatHold =
    require("../models/SeatHold");

const ShowSeat =
    require("../models/ShowSeat");

const Payment =
    require("../models/Payment");

const Show =
    require("../models/Show");

const Event =
    require("../models/Event");

const ApiError =
    require("../utils/ApiError");

const {
    HTTP_STATUS
} =
    require("../utils/constants");


/* =========================================================
   SKYRA - SEAT HOLD SERVICE
   File: backend/src/services/seatHoldService.js

   Phase 11 responsibilities:
   - validate a bookable Show
   - atomically convert AVAILABLE ShowSeats -> HELD
   - create one temporary SeatHold
   - expose only the owning Customer's hold
   - release/expire holds and return seats to AVAILABLE

   Phase 12 will stress-test the same atomic update path with
   simultaneous customers.
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


function getHoldMinutes() {

    const configured =
        Number(
            process.env
                .SEAT_HOLD_MINUTES ||
            10
        );


    if (
        !Number.isFinite(
            configured
        )
    ) {

        return 10;

    }


    return Math.min(
        30,
        Math.max(
            1,
            Math.floor(
                configured
            )
        )
    );

}


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
            `Invalid ${fieldName}.`,
            [
                {
                    field:
                        fieldName,

                    message:
                        `Invalid ${fieldName}.`
                }
            ]
        );

    }


    return String(
        value
    );

}


function sameObjectIdSet(
    first = [],
    second = []
) {

    const firstIds =
        first
            .map(String)
            .sort();


    const secondIds =
        second
            .map(String)
            .sort();


    return (
        firstIds.length ===
            secondIds.length &&
        firstIds.every(
            (
                value,
                index
            ) =>
                value ===
                secondIds[index]
        )
    );

}


async function requireBookableShow(
    showId,
    session
) {

    requireObjectId(
        showId,
        "showId"
    );


    const now =
        new Date();


    const show =
        await Show.findOne({

            _id:
                showId,

            status:
                "SCHEDULED",

            startsAt: {
                $gt:
                    now
            },

            seatsGenerated:
                true

        })
            .session(
                session
            );


    if (!show) {

        throw new ApiError(
            STATUS_NOT_FOUND,
            "Bookable Show not found."
        );

    }


    if (
        show.bookingClosesAt &&
        new Date(
            show.bookingClosesAt
        ) <=
        now
    ) {

        throw new ApiError(
            STATUS_CONFLICT,
            "Booking has closed for this Show."
        );

    }


    const event =
        await Event.findOne({

            _id:
                show.eventId,

            status:
                "PUBLISHED",

            deleted:
                false

        })
            .session(
                session
            );


    if (!event) {

        throw new ApiError(
            STATUS_NOT_FOUND,
            "Published Event not found."
        );

    }


    return {
        show,
        event
    };

}


async function serializeSeatHold(
    hold
) {

    if (!hold) {

        return null;

    }


    const object =
        typeof hold.toObject ===
            "function"
            ? hold.toObject({
                virtuals:
                    true
            })
            : {
                ...hold
            };


    const [
        show,
        event,
        seats
    ] =
        await Promise.all([

            Show.findById(
                object.showId
            )
                .lean(),

            Event.findById(
                object.eventId
            )
                .lean(),

            ShowSeat.find({
                _id: {
                    $in:
                        object.showSeatIds ||
                        []
                }
            })
                .sort({
                    row:
                        1,

                    number:
                        1
                })
                .lean()

        ]);


    const publicSeats =
        seats.map(
            (seat) => ({

                id:
                    String(
                        seat._id
                    ),

                _id:
                    String(
                        seat._id
                    ),

                row:
                    seat.row,

                number:
                    seat.number,

                label:
                    seat.label,

                categoryId:
                    String(
                        seat.categoryId
                    ),

                category:
                    seat.categoryName,

                categoryName:
                    seat.categoryName,

                price:
                    Number(
                        seat.price
                    ),

                status:
                    seat.status

            })
        );


    const subtotal =
        publicSeats.reduce(
            (
                total,
                seat
            ) =>
                total +
                Number(
                    seat.price ||
                    0
                ),
            0
        );


    const configuredConvenienceFee =
        Number(
            process.env
                .SKYRA_CONVENIENCE_FEE ||
            99
        );


    const convenienceFee =
        Number.isFinite(
            configuredConvenienceFee
        )
            ? Math.max(
                0,
                Math.round(
                    configuredConvenienceFee
                )
            )
            : 99;


    const grandTotal =
        subtotal +
        convenienceFee;


    const expiresAt =
        new Date(
            object.expiresAt
        );


    const createdAt =
        new Date(
            object.createdAt
        );


    const remainingMs =
        Math.max(
            0,
            expiresAt.getTime() -
            Date.now()
        );


    return {

        id:
            String(
                object._id
            ),

        _id:
            String(
                object._id
            ),

        userId:
            String(
                object.userId
            ),

        showId:
            String(
                object.showId
            ),

        eventId:
            String(
                object.eventId
            ),

        venueId:
            String(
                object.venueId
            ),

        status:
            object.status,

        seatIds:
            (
                object.showSeatIds ||
                []
            ).map(String),

        seats:
            publicSeats,

        seatCount:
            publicSeats.length,

        subtotal,

        convenienceFee,

        grandTotal,

        createdAt:
            object.createdAt,

        expiresAt:
            object.expiresAt,

        remainingMs,

        holdDurationMs:
            Number.isFinite(
                createdAt.getTime()
            ) &&
            Number.isFinite(
                expiresAt.getTime()
            )
                ? Math.max(
                    0,
                    expiresAt.getTime() -
                    createdAt.getTime()
                )
                : getHoldMinutes() *
                    60 *
                    1000,

        releasedAt:
            object.releasedAt ||
            null,

        expiredAt:
            object.expiredAt ||
            null,

        consumedAt:
            object.consumedAt ||
            null,

        releaseReason:
            object.releaseReason ||
            null,

        show:
            show
                ? {
                    id:
                        String(
                            show._id
                        ),

                    _id:
                        String(
                            show._id
                        ),

                    eventId:
                        String(
                            show.eventId
                        ),

                    eventTitle:
                        show.eventTitle,

                    eventType:
                        show.eventType,

                    venueId:
                        String(
                            show.venueId
                        ),

                    venueName:
                        show.venueName,

                    venueCity:
                        show.venueCity ||
                        "",

                    date:
                        show.date,

                    time:
                        show.time,

                    entryTime:
                        show.entryTime ||
                        null,

                    startsAt:
                        show.startsAt,

                    bookingClosesAt:
                        show.bookingClosesAt ||
                        null,

                    capacity:
                        Number(
                            show.capacity ||
                            0
                        )
                }
                : null,

        event:
            event
                ? {
                    id:
                        String(
                            event._id
                        ),

                    _id:
                        String(
                            event._id
                        ),

                    title:
                        event.title,

                    type:
                        event.type,

                    genre:
                        event.genre,

                    language:
                        event.language ||
                        "",

                    duration:
                        event.duration,

                    ageRating:
                        event.ageRating ||
                        "",

                    posterUrl:
                        event.posterUrl ||
                        "",

                    bannerUrl:
                        event.bannerUrl ||
                        ""
                }
                : null,

        venue: show
            ? {
                id:
                    String(
                        show.venueId
                    ),

                _id:
                    String(
                        show.venueId
                    ),

                name:
                    show.venueName,

                shortName:
                    show.venueName,

                city:
                    show.venueCity ||
                    ""
            }
            : null

    };

}


async function releaseExpiredHolds(
    now = new Date()
) {

    const session =
        await mongoose
            .startSession();


    let expiredCount =
        0;


    try {

        await session.withTransaction(
            async () => {

                const expired =
                    await SeatHold.find({

                        status:
                            "ACTIVE",

                        expiresAt: {
                            $lte:
                                now
                        }

                    })
                        .select(
                            "_id"
                        )
                        .session(
                            session
                        )
                        .lean();


                if (!expired.length) {

                    return;

                }


                const candidateHoldIds =
                    expired.map(
                        (hold) =>
                            hold._id
                    );


                /*
                   Once Razorpay is VERIFIED, the customer has paid.
                   Do not let the ordinary hold-expiry sweep release
                   paid seats in the small window before Phase 14
                   finalizes the Booking.
                */
                const verifiedPayments =
                    await Payment.find({
                        holdId: {
                            $in:
                                candidateHoldIds
                        },
                        status:
                            "VERIFIED"
                    })
                        .select(
                            "holdId"
                        )
                        .session(
                            session
                        )
                        .lean();


                const protectedHoldIds =
                    new Set(
                        verifiedPayments.map(
                            (payment) =>
                                String(
                                    payment.holdId
                                )
                        )
                    );


                const holdIds =
                    candidateHoldIds.filter(
                        (holdId) =>
                            !protectedHoldIds.has(
                                String(holdId)
                            )
                    );


                if (!holdIds.length) {
                    return;
                }


                await ShowSeat.updateMany(
                    {
                        holdId: {
                            $in:
                                holdIds
                        },

                        status:
                            "HELD"
                    },
                    {
                        $set: {
                            status:
                                "AVAILABLE"
                        },

                        $unset: {
                            holdId:
                                "",

                            heldByUserId:
                                "",

                            holdExpiresAt:
                                ""
                        }
                    },
                    {
                        session
                    }
                );


                const result =
                    await SeatHold.updateMany(
                        {
                            _id: {
                                $in:
                                    holdIds
                            },

                            status:
                                "ACTIVE"
                        },
                        {
                            $set: {
                                status:
                                    "EXPIRED",

                                expiredAt:
                                    now,

                                releaseReason:
                                    "HOLD_EXPIRED"
                            }
                        },
                        {
                            session
                        }
                    );


                expiredCount =
                    Number(
                        result.modifiedCount ??
                        result.nModified ??
                        0
                    );

            }
        );

    } finally {

        await session
            .endSession();

    }


    return expiredCount;

}


async function createSeatHold(
    userId,
    data
) {

    requireObjectId(
        userId,
        "userId"
    );


    const showId =
        requireObjectId(
            data.showId,
            "showId"
        );


    const seatIds =
        [
            ...new Set(
                (
                    data.seatIds ||
                    []
                ).map(
                    (value) =>
                        requireObjectId(
                            value,
                            "seatId"
                        )
                )
            )
        ];


    if (
        seatIds.length <
            1 ||
        seatIds.length >
            6
    ) {

        throw new ApiError(
            STATUS_BAD_REQUEST,
            "Select between 1 and 6 seats."
        );

    }


    /*
       Do not depend only on the background sweep. Clean up
       already-expired holds before attempting a new one.
    */
    await releaseExpiredHolds();


    const now =
        new Date();


    const expiresAt =
        new Date(
            now.getTime() +
            getHoldMinutes() *
            60 *
            1000
        );


    const session =
        await mongoose
            .startSession();


    let resultingHoldId =
        null;


    try {

        await session.withTransaction(
            async () => {

                const {
                    show
                } =
                    await requireBookableShow(
                        showId,
                        session
                    );


                const existing =
                    await SeatHold.findOne({

                        userId,

                        status:
                            "ACTIVE",

                        expiresAt: {
                            $gt:
                                now
                        }

                    })
                        .session(
                            session
                        );


                if (existing) {

                    if (
                        String(
                            existing.showId
                        ) ===
                            String(
                                showId
                            ) &&
                        sameObjectIdSet(
                            existing.showSeatIds,
                            seatIds
                        )
                    ) {

                        resultingHoldId =
                            existing._id;

                        return;

                    }


                    throw new ApiError(
                        STATUS_CONFLICT,
                        "You already have an active seat hold. Release it before holding different seats."
                    );

                }


                const holdId =
                    new mongoose
                        .Types
                        .ObjectId();


                /*
                   Atomic conditional update:
                   only ShowSeats that are still AVAILABLE match.

                   If another customer wins first, matchedCount is
                   smaller than the requested seat count and the
                   transaction is rolled back.
                */
                const updateResult =
                    await ShowSeat.updateMany(
                        {
                            _id: {
                                $in:
                                    seatIds
                            },

                            showId:
                                show._id,

                            status:
                                "AVAILABLE"
                        },
                        {
                            $set: {
                                status:
                                    "HELD",

                                holdId,

                                heldByUserId:
                                    userId,

                                holdExpiresAt:
                                    expiresAt
                            }
                        },
                        {
                            session
                        }
                    );


                const matchedCount =
                    Number(
                        updateResult.matchedCount ??
                        updateResult.n ??
                        0
                    );


                if (
                    matchedCount !==
                    seatIds.length
                ) {

                    throw new ApiError(
                        STATUS_CONFLICT,
                        "One or more selected seats are no longer available.",
                        [
                            {
                                field:
                                    "seatIds",

                                message:
                                    "Refresh the seat map and choose AVAILABLE seats."
                            }
                        ]
                    );

                }


                await SeatHold.create(
                    [
                        {
                            _id:
                                holdId,

                            userId,

                            showId:
                                show._id,

                            eventId:
                                show.eventId,

                            venueId:
                                show.venueId,

                            showSeatIds:
                                seatIds,

                            status:
                                "ACTIVE",

                            expiresAt
                        }
                    ],
                    {
                        session
                    }
                );


                resultingHoldId =
                    holdId;

            }
        );

    } catch (error) {

        if (
            error?.code ===
            11000
        ) {

            throw new ApiError(
                STATUS_CONFLICT,
                "An active seat hold already exists for this customer."
            );

        }


        throw error;

    } finally {

        await session
            .endSession();

    }


    return getSeatHoldById(
        userId,
        resultingHoldId
    );

}


async function getSeatHoldById(
    userId,
    holdId
) {

    requireObjectId(
        userId,
        "userId"
    );


    requireObjectId(
        holdId,
        "holdId"
    );


    /*
       If this hold crossed its expiry boundary, release it
       before returning the server-authoritative state.
    */
    const candidate =
        await SeatHold.findOne({

            _id:
                holdId,

            userId

        });


    if (!candidate) {

        throw new ApiError(
            STATUS_NOT_FOUND,
            "Seat hold not found."
        );

    }


    if (
        candidate.status ===
            "ACTIVE" &&
        new Date(
            candidate.expiresAt
        ) <=
        new Date()
    ) {

        await releaseExpiredHolds();

    }


    const hold =
        await SeatHold.findOne({

            _id:
                holdId,

            userId

        });


    return serializeSeatHold(
        hold
    );

}


async function getActiveSeatHold(
    userId,
    showId = ""
) {

    requireObjectId(
        userId,
        "userId"
    );


    if (showId) {

        requireObjectId(
            showId,
            "showId"
        );

    }


    await releaseExpiredHolds();


    const query = {

        userId,

        status:
            "ACTIVE",

        expiresAt: {
            $gt:
                new Date()
        }

    };


    if (showId) {

        query.showId =
            showId;

    }


    const hold =
        await SeatHold.findOne(
            query
        )
            .sort({
                createdAt:
                    -1
            });


    return serializeSeatHold(
        hold
    );

}


async function releaseSeatHold(
    userId,
    holdId
) {

    requireObjectId(
        userId,
        "userId"
    );


    requireObjectId(
        holdId,
        "holdId"
    );


    const session =
        await mongoose
            .startSession();


    try {

        await session.withTransaction(
            async () => {

                const hold =
                    await SeatHold.findOne({

                        _id:
                            holdId,

                        userId

                    })
                        .session(
                            session
                        );


                if (!hold) {

                    throw new ApiError(
                        STATUS_NOT_FOUND,
                        "Seat hold not found."
                    );

                }


                if (
                    hold.status !==
                    "ACTIVE"
                ) {

                    return;

                }


                const verifiedPayment =
                    await Payment.findOne({
                        holdId:
                            hold._id,

                        userId,

                        status:
                            "VERIFIED"
                    })
                        .select(
                            "_id"
                        )
                        .session(
                            session
                        )
                        .lean();


                if (verifiedPayment) {

                    throw new ApiError(
                        STATUS_CONFLICT,
                        "This SeatHold has a verified payment and must be finalized as a Booking."
                    );

                }


                const now =
                    new Date();


                const expired =
                    new Date(
                        hold.expiresAt
                    ) <=
                    now;


                await ShowSeat.updateMany(
                    {
                        holdId:
                            hold._id,

                        status:
                            "HELD"
                    },
                    {
                        $set: {
                            status:
                                "AVAILABLE"
                        },

                        $unset: {
                            holdId:
                                "",

                            heldByUserId:
                                "",

                            holdExpiresAt:
                                ""
                        }
                    },
                    {
                        session
                    }
                );


                hold.status =
                    expired
                        ? "EXPIRED"
                        : "RELEASED";


                hold.releaseReason =
                    expired
                        ? "HOLD_EXPIRED"
                        : "CUSTOMER_RELEASED";


                if (expired) {

                    hold.expiredAt =
                        now;

                } else {

                    hold.releasedAt =
                        now;

                }


                await hold.save({
                    session
                });

            }
        );

    } finally {

        await session
            .endSession();

    }


    return getSeatHoldById(
        userId,
        holdId
    );

}


module.exports = {

    getHoldMinutes,

    createSeatHold,

    getSeatHoldById,

    getActiveSeatHold,

    releaseSeatHold,

    releaseExpiredHolds,

    serializeSeatHold

};
