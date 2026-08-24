"use strict";

const mongoose = require("mongoose");

const Waitlist = require("../models/Waitlist");
const WaitlistOffer = require("../models/WaitlistOffer");
const ShowSeat = require("../models/ShowSeat");
const Show = require("../models/Show");
const Event = require("../models/Event");
const SeatHold = require("../models/SeatHold");
const Booking = require("../models/Booking");

const seatHoldService = require("./seatHoldService");
const notificationService = require("./notificationService");

const ApiError = require("../utils/ApiError");
const { HTTP_STATUS } = require("../utils/constants");


const STATUS_BAD_REQUEST =
    HTTP_STATUS?.BAD_REQUEST || 400;

const STATUS_NOT_FOUND =
    HTTP_STATUS?.NOT_FOUND || 404;

const STATUS_CONFLICT =
    HTTP_STATUS?.CONFLICT || 409;


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
                    field: fieldName,
                    message: `Invalid ${fieldName}.`
                }
            ]
        );

    }


    return String(value);

}


function getOfferMinutes() {

    const configured =
        Number(
            process.env
                .WAITLIST_OFFER_MINUTES ||
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


function buildActiveKey(
    userId,
    showId,
    categoryId
) {

    return [
        String(userId),
        String(showId),
        String(categoryId)
    ].join(":");

}


async function requireWaitlistableShow(
    showId,
    session = null
) {

    requireObjectId(
        showId,
        "showId"
    );


    const now =
        new Date();


    let showQuery =
        Show.findOne({
            _id: showId,
            status: "SCHEDULED",
            startsAt: {
                $gt: now
            },
            seatsGenerated: true
        });


    if (session) {
        showQuery =
            showQuery.session(
                session
            );
    }


    const show =
        await showQuery;


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
        ) <= now
    ) {

        throw new ApiError(
            STATUS_CONFLICT,
            "Booking has closed for this Show."
        );

    }


    let eventQuery =
        Event.findOne({
            _id: show.eventId,
            status: "PUBLISHED",
            deleted: false
        });


    if (session) {
        eventQuery =
            eventQuery.session(
                session
            );
    }


    const event =
        await eventQuery;


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


async function getQueuePosition(
    entry
) {

    if (
        !entry ||
        entry.status !==
            "WAITING"
    ) {

        return null;

    }


    const ahead =
        await Waitlist.countDocuments({
            showId:
                entry.showId,
            categoryId:
                entry.categoryId,
            status:
                "WAITING",
            $or: [
                {
                    joinedAt: {
                        $lt:
                            entry.joinedAt
                    }
                },
                {
                    joinedAt:
                        entry.joinedAt,
                    _id: {
                        $lt:
                            entry._id
                    }
                }
            ]
        });


    return ahead + 1;

}


function serializeOffer(
    offer
) {

    if (!offer) {
        return null;
    }


    const value =
        typeof offer.toObject ===
            "function"
            ? offer.toObject()
            : {
                ...offer
            };


    return {
        ...value,
        id:
            String(
                value._id
            ),
        _id:
            String(
                value._id
            ),
        waitlistId:
            String(
                value.waitlistId
            ),
        userId:
            String(
                value.userId
            ),
        showId:
            String(
                value.showId
            ),
        eventId:
            String(
                value.eventId
            ),
        venueId:
            String(
                value.venueId
            ),
        categoryId:
            String(
                value.categoryId
            ),
        showSeatId:
            String(
                value.showSeatId
            ),
        holdId:
            value.holdId
                ? String(
                    value.holdId
                )
                : null,
        bookingId:
            value.bookingId
                ? String(
                    value.bookingId
                )
                : null,
        seatIds: [
            String(
                value.showSeatId
            )
        ]
    };

}


async function serializeWaitlistEntry(
    entry,
    options = {}
) {

    if (!entry) {
        return null;
    }


    const value =
        typeof entry.toObject ===
            "function"
            ? entry.toObject()
            : {
                ...entry
            };


    const [
        show,
        offer,
        position
    ] =
        await Promise.all([

            options.show ||
            Show.findById(
                value.showId
            )
                .lean(),

            options.offer !== undefined
                ? options.offer
                : value.activeOfferId
                    ? WaitlistOffer.findById(
                        value.activeOfferId
                    )
                        .lean()
                    : Promise.resolve(
                        null
                    ),

            getQueuePosition(
                entry
            )

        ]);


    const showId =
        String(
            value.showId
        );

    const eventId =
        String(
            value.eventId
        );

    const venueId =
        String(
            value.venueId
        );

    const categoryId =
        String(
            value.categoryId
        );


    const publicOffer =
        serializeOffer(
            offer
        );


    return {

        ...value,

        id:
            String(
                value._id
            ),

        _id:
            String(
                value._id
            ),

        userId:
            String(
                value.userId
            ),

        showId,

        eventId,

        venueId,

        categoryId,

        category:
            value.categoryName,

        position,

        queuePosition:
            position,

        waitlistPosition:
            position,

        joinedAt:
            value.joinedAt,

        offerId:
            publicOffer?.id ||
            null,

        offerExpiresAt:
            publicOffer?.expiresAt ||
            null,

        offeredSeatIds:
            publicOffer?.seatIds ||
            [],

        offer:
            publicOffer,

        event: {
            id:
                eventId,
            _id:
                eventId,
            title:
                show?.eventTitle ||
                "SKYRA Event",
            type:
                show?.eventType ||
                ""
        },

        show: {
            id:
                showId,
            _id:
                showId,
            eventId,
            venueId,
            eventTitle:
                show?.eventTitle ||
                "",
            eventType:
                show?.eventType ||
                "",
            date:
                show?.date ||
                null,
            time:
                show?.time ||
                null,
            startsAt:
                show?.startsAt ||
                null,
            status:
                show?.status ||
                null
        },

        venue: {
            id:
                venueId,
            _id:
                venueId,
            name:
                show?.venueName ||
                "Venue",
            shortName:
                show?.venueName ||
                "Venue",
            city:
                show?.venueCity ||
                ""
        }

    };

}


async function joinWaitlist(
    userId,
    payload = {}
) {

    requireObjectId(
        userId,
        "userId"
    );


    const showId =
        requireObjectId(
            payload.showId,
            "showId"
        );


    const categoryId =
        requireObjectId(
            payload.categoryId,
            "categoryId"
        );


    const activeKey =
        buildActiveKey(
            userId,
            showId,
            categoryId
        );


    const existing =
        await Waitlist.findOne({
            activeKey
        });


    if (existing) {

        return serializeWaitlistEntry(
            existing
        );

    }


    const session =
        await mongoose
            .startSession();


    let createdId =
        null;


    try {

        await session.withTransaction(
            async () => {

                const {
                    show
                } =
                    await requireWaitlistableShow(
                        showId,
                        session
                    );


                const categorySeat =
                    await ShowSeat.findOne({
                        showId:
                            show._id,
                        categoryId
                    })
                        .select(
                            "categoryName"
                        )
                        .session(
                            session
                        )
                        .lean();


                if (!categorySeat) {

                    throw new ApiError(
                        STATUS_NOT_FOUND,
                        "Seat category not found for this Show."
                    );

                }


                /*
                   Customers join only after the category is sold out.
                   HELD/OFFERED/BOOKED all count as unavailable.
                */
                const availableSeat =
                    await ShowSeat.findOne({
                        showId:
                            show._id,
                        categoryId,
                        status:
                            "AVAILABLE"
                    })
                        .select(
                            "_id"
                        )
                        .session(
                            session
                        )
                        .lean();


                if (availableSeat) {

                    throw new ApiError(
                        STATUS_CONFLICT,
                        "Seats are still available in this category. Select a seat instead of joining the waitlist."
                    );

                }


                const alreadyActive =
                    await Waitlist.findOne({
                        activeKey
                    })
                        .session(
                            session
                        );


                if (alreadyActive) {

                    createdId =
                        alreadyActive._id;

                    return;

                }


                const created =
                    await Waitlist.create(
                        [
                            {
                                userId,
                                showId:
                                    show._id,
                                eventId:
                                    show.eventId,
                                venueId:
                                    show.venueId,
                                categoryId,
                                categoryName:
                                    categorySeat
                                        .categoryName,
                                status:
                                    "WAITING",
                                joinedAt:
                                    new Date(),
                                activeKey
                            }
                        ],
                        {
                            session
                        }
                    );


                createdId =
                    created[0]._id;

            }
        );

    } catch (error) {

        if (
            error?.code ===
            11000
        ) {

            const duplicate =
                await Waitlist.findOne({
                    activeKey
                });


            if (duplicate) {

                return serializeWaitlistEntry(
                    duplicate
                );

            }

        }


        throw error;

    } finally {

        await session
            .endSession();

    }


    const entry =
        await Waitlist.findById(
            createdId
        );


    return serializeWaitlistEntry(
        entry
    );

}


async function listMyWaitlist(
    userId
) {

    requireObjectId(
        userId,
        "userId"
    );


    /*
       Reads are also a safe reconciliation point if the background
       timer was briefly paused or the server restarted.
    */
    await processExpiredOffers();


    const entries =
        await Waitlist.find({
            userId
        })
            .sort({
                createdAt:
                    -1
            })
            .limit(
                100
            );


    return Promise.all(
        entries.map(
            (entry) =>
                serializeWaitlistEntry(
                    entry
                )
        )
    );

}


async function leaveWaitlist(
    userId,
    waitlistId
) {

    requireObjectId(
        userId,
        "userId"
    );

    requireObjectId(
        waitlistId,
        "waitlistId"
    );


    const entry =
        await Waitlist.findOne({
            _id:
                waitlistId,
            userId
        });


    if (!entry) {

        throw new ApiError(
            STATUS_NOT_FOUND,
            "Waitlist entry not found."
        );

    }


    if (
        entry.status ===
        "LEFT"
    ) {

        return serializeWaitlistEntry(
            entry
        );

    }


    if (
        entry.status !==
        "WAITING"
    ) {

        throw new ApiError(
            STATUS_CONFLICT,
            "Only a waiting queue entry can be left."
        );

    }


    entry.status =
        "LEFT";

    entry.leftAt =
        new Date();

    entry.activeKey =
        undefined;


    await entry.save();


    return serializeWaitlistEntry(
        entry
    );

}


async function assignSeatsWithSession(
    {
        showId,
        seatIds,
        session
    }
) {

    const createdOfferIds =
        [];


    const seats =
        await ShowSeat.find({
            _id: {
                $in:
                    seatIds
            },
            showId,
            status:
                "AVAILABLE"
        })
            .sort({
                row:
                    1,
                number:
                    1
            })
            .session(
                session
            );


    for (
        const seat of
        seats
    ) {

        const nextEntry =
            await Waitlist.findOne({
                showId:
                    seat.showId,
                categoryId:
                    seat.categoryId,
                status:
                    "WAITING"
            })
                .sort({
                    joinedAt:
                        1,
                    _id:
                        1
                })
                .session(
                    session
                );


        if (!nextEntry) {

            continue;

        }


        const now =
            new Date();

        const expiresAt =
            new Date(
                now.getTime() +
                getOfferMinutes() *
                60 *
                1000
            );

        const offerId =
            new mongoose
                .Types
                .ObjectId();


        const seatResult =
            await ShowSeat.updateOne(
                {
                    _id:
                        seat._id,
                    showId:
                        seat.showId,
                    status:
                        "AVAILABLE"
                },
                {
                    $set: {
                        status:
                            "OFFERED",
                        offerId,
                        waitlistId:
                            nextEntry._id,
                        offeredToUserId:
                            nextEntry.userId,
                        offerExpiresAt:
                            expiresAt
                    }
                },
                {
                    session
                }
            );


        if (
            seatResult.modifiedCount !==
            1
        ) {

            continue;

        }


        const waitlistResult =
            await Waitlist.updateOne(
                {
                    _id:
                        nextEntry._id,
                    status:
                        "WAITING"
                },
                {
                    $set: {
                        status:
                            "OFFERED",
                        activeOfferId:
                            offerId,
                        offeredAt:
                            now
                    }
                },
                {
                    session
                }
            );


        if (
            waitlistResult.modifiedCount !==
            1
        ) {

            throw new ApiError(
                STATUS_CONFLICT,
                "Waitlist queue changed while assigning an offer."
            );

        }


        await WaitlistOffer.create(
            [
                {
                    _id:
                        offerId,
                    waitlistId:
                        nextEntry._id,
                    userId:
                        nextEntry.userId,
                    showId:
                        seat.showId,
                    eventId:
                        nextEntry.eventId,
                    venueId:
                        nextEntry.venueId,
                    categoryId:
                        seat.categoryId,
                    categoryName:
                        seat.categoryName,
                    showSeatId:
                        seat._id,
                    seatLabel:
                        seat.label,
                    price:
                        Number(
                            seat.price
                        ),
                    status:
                        "ACTIVE",
                    offeredAt:
                        now,
                    expiresAt,
                    activeSeatKey:
                        String(
                            seat._id
                        ),
                    activeWaitlistKey:
                        String(
                            nextEntry._id
                        )
                }
            ],
            {
                session
            }
        );


        /*
           Phase 18:
           Creating the waitlist notification in the SAME MongoDB
           transaction keeps the offer and its in-app alert consistent.
        */
        await notificationService
            .notifyWaitlistOffer(
                {
                    userId:
                        nextEntry.userId,
                    waitlistId:
                        nextEntry._id,
                    offerId,
                    showId:
                        seat.showId,
                    eventId:
                        nextEntry.eventId,
                    categoryName:
                        seat.categoryName,
                    seatLabel:
                        seat.label,
                    expiresAt
                },
                {
                    session
                }
            );


        createdOfferIds.push(
            offerId
        );

    }


    return createdOfferIds;

}


async function assignReleasedSeatsToWaitlist(
    {
        showId,
        seatIds = [],
        session = null
    }
) {

    requireObjectId(
        showId,
        "showId"
    );


    const normalizedSeatIds =
        [
            ...new Set(
                seatIds.map(
                    (value) =>
                        requireObjectId(
                            value,
                            "seatId"
                        )
                )
            )
        ];


    if (
        normalizedSeatIds.length ===
        0
    ) {

        return [];

    }


    if (session) {

        return assignSeatsWithSession({
            showId,
            seatIds:
                normalizedSeatIds,
            session
        });

    }


    const ownSession =
        await mongoose
            .startSession();

    let createdOfferIds =
        [];


    try {

        await ownSession.withTransaction(
            async () => {

                createdOfferIds =
                    await assignSeatsWithSession({
                        showId,
                        seatIds:
                            normalizedSeatIds,
                        session:
                            ownSession
                    });

            }
        );

    } finally {

        await ownSession
            .endSession();

    }


    return createdOfferIds;

}


async function expireOneOffer(
    offerId
) {

    const session =
        await mongoose
            .startSession();

    let expired =
        false;

    let reoffered =
        0;


    try {

        await session.withTransaction(
            async () => {

                const now =
                    new Date();


                const offer =
                    await WaitlistOffer.findOne({
                        _id:
                            offerId,
                        status:
                            "ACTIVE",
                        expiresAt: {
                            $lte:
                                now
                        }
                    })
                        .session(
                            session
                        );


                if (!offer) {
                    return;
                }


                const seatResult =
                    await ShowSeat.updateOne(
                        {
                            _id:
                                offer.showSeatId,
                            status:
                                "OFFERED",
                            offerId:
                                offer._id
                        },
                        {
                            $set: {
                                status:
                                    "AVAILABLE",
                                offerId:
                                    null,
                                waitlistId:
                                    null,
                                offeredToUserId:
                                    null,
                                offerExpiresAt:
                                    null
                            }
                        },
                        {
                            session
                        }
                    );


                await Waitlist.updateOne(
                    {
                        _id:
                            offer.waitlistId,
                        status:
                            "OFFERED",
                        activeOfferId:
                            offer._id
                    },
                    {
                        $set: {
                            status:
                                "EXPIRED",
                            expiredAt:
                                now,
                            activeOfferId:
                                null
                        },
                        $unset: {
                            activeKey:
                                ""
                        }
                    },
                    {
                        session
                    }
                );


                await WaitlistOffer.updateOne(
                    {
                        _id:
                            offer._id,
                        status:
                            "ACTIVE"
                    },
                    {
                        $set: {
                            status:
                                "EXPIRED",
                            expiredAt:
                                now
                        },
                        $unset: {
                            activeSeatKey:
                                "",
                            activeWaitlistKey:
                                ""
                        }
                    },
                    {
                        session
                    }
                );


                expired =
                    true;


                if (
                    seatResult.modifiedCount ===
                    1
                ) {

                    const newOffers =
                        await assignSeatsWithSession({
                            showId:
                                offer.showId,
                            seatIds: [
                                offer.showSeatId
                            ],
                            session
                        });


                    reoffered =
                        newOffers.length;

                }

            }
        );

    } finally {

        await session
            .endSession();

    }


    return {
        expired,
        reoffered
    };

}


async function reconcileAbandonedClaim(
    offerId
) {

    const offer =
        await WaitlistOffer.findOne({
            _id:
                offerId,
            status:
                "CLAIMED",
            holdId: {
                $ne:
                    null
            },
            requeuedAt:
                null
        })
            .lean();


    if (!offer) {

        return {
            requeued:
                false,
            reoffered:
                0
        };

    }


    const hold =
        await SeatHold.findById(
            offer.holdId
        )
            .select(
                "status"
            )
            .lean();


    if (!hold) {

        return {
            requeued:
                false,
            reoffered:
                0
        };

    }


    if (
        hold.status ===
        "CONSUMED"
    ) {

        const booking =
            await Booking.findOne({
                holdId:
                    offer.holdId
            })
                .select(
                    "_id"
                )
                .lean();


        if (booking) {

            await WaitlistOffer.updateOne(
                {
                    _id:
                        offer._id
                },
                {
                    $set: {
                        bookingId:
                            booking._id
                    }
                }
            );

        }


        return {
            requeued:
                false,
            reoffered:
                0
        };

    }


    if (
        ![
            "EXPIRED",
            "RELEASED"
        ].includes(
            hold.status
        )
    ) {

        return {
            requeued:
                false,
            reoffered:
                0
        };

    }


    const session =
        await mongoose
            .startSession();

    let reoffered =
        0;

    let requeued =
        false;


    try {

        await session.withTransaction(
            async () => {

                const current =
                    await WaitlistOffer.findOne({
                        _id:
                            offer._id,
                        status:
                            "CLAIMED",
                        requeuedAt:
                            null
                    })
                        .session(
                            session
                        );


                if (!current) {
                    return;
                }


                current.requeuedAt =
                    new Date();


                await current.save({
                    session
                });


                const seat =
                    await ShowSeat.findOne({
                        _id:
                            current.showSeatId,
                        showId:
                            current.showId,
                        status:
                            "AVAILABLE"
                    })
                        .session(
                            session
                        )
                        .lean();


                requeued =
                    true;


                if (!seat) {
                    return;
                }


                const newOffers =
                    await assignSeatsWithSession({
                        showId:
                            current.showId,
                        seatIds: [
                            current.showSeatId
                        ],
                        session
                    });


                reoffered =
                    newOffers.length;

            }
        );

    } finally {

        await session
            .endSession();

    }


    return {
        requeued,
        reoffered
    };

}


async function processExpiredOffers() {

    const now =
        new Date();


    const expiredCandidates =
        await WaitlistOffer.find({
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
            .sort({
                expiresAt:
                    1
            })
            .limit(
                100
            )
            .lean();


    let expiredCount =
        0;

    let reofferedCount =
        0;


    for (
        const candidate of
        expiredCandidates
    ) {

        const result =
            await expireOneOffer(
                candidate._id
            );


        if (result.expired) {
            expiredCount +=
                1;
        }


        reofferedCount +=
            Number(
                result.reoffered ||
                0
            );

    }


    /*
       A customer may claim an offer, receive a normal SeatHold, then
       abandon checkout. Once that hold expires/releases, put the seat
       back through the waitlist instead of exposing it publicly.
    */
    const abandonedCandidates =
        await WaitlistOffer.find({
            status:
                "CLAIMED",
            holdId: {
                $ne:
                    null
            },
            requeuedAt:
                null
        })
            .select(
                "_id"
            )
            .sort({
                claimedAt:
                    1
            })
            .limit(
                100
            )
            .lean();


    let abandonedRequeued =
        0;


    for (
        const candidate of
        abandonedCandidates
    ) {

        const result =
            await reconcileAbandonedClaim(
                candidate._id
            );


        if (result.requeued) {
            abandonedRequeued +=
                1;
        }


        reofferedCount +=
            Number(
                result.reoffered ||
                0
            );

    }


    return {
        expired:
            expiredCount,
        reoffered:
            reofferedCount,
        abandonedRequeued
    };

}


async function claimWaitlistOffer(
    userId,
    offerId
) {

    requireObjectId(
        userId,
        "userId"
    );

    requireObjectId(
        offerId,
        "offerId"
    );


    await seatHoldService
        .releaseExpiredHolds();

    await processExpiredOffers();


    const existingOffer =
        await WaitlistOffer.findOne({
            _id:
                offerId,
            userId
        });


    if (!existingOffer) {

        throw new ApiError(
            STATUS_NOT_FOUND,
            "Waitlist offer not found."
        );

    }


    /*
       Idempotent retry after a successful claim.
    */
    if (
        existingOffer.status ===
            "CLAIMED" &&
        existingOffer.holdId
    ) {

        const hold =
            await seatHoldService
                .getSeatHoldById(
                    userId,
                    existingOffer.holdId
                );


        const entry =
            await Waitlist.findById(
                existingOffer.waitlistId
            );


        return {
            waitlist:
                await serializeWaitlistEntry(
                    entry
                ),
            offer:
                serializeOffer(
                    existingOffer
                ),
            hold
        };

    }


    if (
        existingOffer.status !==
        "ACTIVE"
    ) {

        throw new ApiError(
            STATUS_CONFLICT,
            "This waitlist offer is no longer active."
        );

    }


    const session =
        await mongoose
            .startSession();

    let holdId =
        null;


    try {

        await session.withTransaction(
            async () => {

                const now =
                    new Date();


                const offer =
                    await WaitlistOffer.findOne({
                        _id:
                            offerId,
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


                if (!offer) {

                    throw new ApiError(
                        STATUS_CONFLICT,
                        "This waitlist offer has expired."
                    );

                }


                const waitlist =
                    await Waitlist.findOne({
                        _id:
                            offer.waitlistId,
                        userId,
                        status:
                            "OFFERED",
                        activeOfferId:
                            offer._id
                    })
                        .session(
                            session
                        );


                if (!waitlist) {

                    throw new ApiError(
                        STATUS_CONFLICT,
                        "Waitlist entry is no longer eligible for this offer."
                    );

                }


                const {
                    show
                } =
                    await requireWaitlistableShow(
                        offer.showId,
                        session
                    );


                const existingHold =
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


                if (existingHold) {

                    throw new ApiError(
                        STATUS_CONFLICT,
                        "You already have an active seat hold. Complete or release it before claiming this offer."
                    );

                }


                holdId =
                    new mongoose
                        .Types
                        .ObjectId();


                const holdExpiresAt =
                    new Date(
                        now.getTime() +
                        seatHoldService
                            .getHoldMinutes() *
                        60 *
                        1000
                    );


                const seatResult =
                    await ShowSeat.updateOne(
                        {
                            _id:
                                offer.showSeatId,
                            showId:
                                offer.showId,
                            status:
                                "OFFERED",
                            offerId:
                                offer._id,
                            waitlistId:
                                offer.waitlistId,
                            offeredToUserId:
                                userId,
                            offerExpiresAt: {
                                $gt:
                                    now
                            }
                        },
                        {
                            $set: {
                                status:
                                    "HELD",
                                holdId,
                                heldByUserId:
                                    userId,
                                holdExpiresAt
                            },
                            $unset: {
                                offerId:
                                    "",
                                waitlistId:
                                    "",
                                offeredToUserId:
                                    "",
                                offerExpiresAt:
                                    ""
                            }
                        },
                        {
                            session
                        }
                    );


                if (
                    seatResult.modifiedCount !==
                    1
                ) {

                    throw new ApiError(
                        STATUS_CONFLICT,
                        "The offered seat is no longer available for this offer."
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
                            showSeatIds: [
                                offer.showSeatId
                            ],
                            status:
                                "ACTIVE",
                            expiresAt:
                                holdExpiresAt
                        }
                    ],
                    {
                        session
                    }
                );


                await WaitlistOffer.updateOne(
                    {
                        _id:
                            offer._id,
                        status:
                            "ACTIVE"
                    },
                    {
                        $set: {
                            status:
                                "CLAIMED",
                            holdId,
                            claimedAt:
                                now
                        },
                        $unset: {
                            activeSeatKey:
                                "",
                            activeWaitlistKey:
                                ""
                        }
                    },
                    {
                        session
                    }
                );


                await Waitlist.updateOne(
                    {
                        _id:
                            waitlist._id,
                        status:
                            "OFFERED",
                        activeOfferId:
                            offer._id
                    },
                    {
                        $set: {
                            status:
                                "CLAIMED",
                            claimedAt:
                                now,
                            activeOfferId:
                                null
                        },
                        $unset: {
                            activeKey:
                                ""
                        }
                    },
                    {
                        session
                    }
                );

            }
        );

    } finally {

        await session
            .endSession();

    }


    const [
        hold,
        updatedOffer,
        updatedEntry
    ] =
        await Promise.all([

            seatHoldService
                .getSeatHoldById(
                    userId,
                    holdId
                ),

            WaitlistOffer.findById(
                offerId
            ),

            Waitlist.findById(
                existingOffer.waitlistId
            )

        ]);


    return {
        waitlist:
            await serializeWaitlistEntry(
                updatedEntry
            ),
        offer:
            serializeOffer(
                updatedOffer
            ),
        hold
    };

}


module.exports = {

    getOfferMinutes,

    joinWaitlist,

    listMyWaitlist,

    leaveWaitlist,

    claimWaitlistOffer,

    assignReleasedSeatsToWaitlist,

    processExpiredOffers,

    serializeWaitlistEntry

};
