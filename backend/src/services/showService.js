"use strict";

const mongoose =
    require("mongoose");

const Show =
    require("../models/Show");

const ShowSeat =
    require("../models/ShowSeat");

const Event =
    require("../models/Event");

const Venue =
    require("../models/Venue");

const showSeatService =
    require("./showSeatService");

const ApiError =
    require("../utils/ApiError");

const {
    HTTP_STATUS
} =
    require("../utils/constants");


/* =========================================================
   SKYRA - SHOW SERVICE
   File: backend/src/services/showService.js

   Phase 9 rules:
   - Organiser may use only own PUBLISHED Event
   - Venue must be ACTIVE, not deleted, layout configured
   - Pricing is rebuilt from server-side Venue categories
   - Client cannot invent capacity/category metadata
   - Show + ShowSeat creation is one MongoDB transaction
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
   OBJECT ID
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


/* =========================================================
   IST DATE/TIME HELPERS

   The current SKYRA UI does not contain a timezone selector.
   Its venue/project data is India-oriented, so Phase 8 uses
   Asia/Kolkata (+05:30) explicitly instead of depending on
   the server machine's timezone.
   ========================================================= */

function createIndiaDateTime(
    date,
    time
) {

    const value =
        new Date(
            `${date}T${time}:00+05:30`
        );


    if (
        Number.isNaN(
            value.getTime()
        )
    ) {

        throw new ApiError(
            STATUS_BAD_REQUEST,
            "Invalid show date or time."
        );

    }


    return value;

}


function calculateSchedule(
    event,
    data
) {

    const startsAt =
        createIndiaDateTime(
            data.date,
            data.time
        );


    if (
        startsAt.getTime() <=
        Date.now()
    ) {

        throw new ApiError(
            STATUS_BAD_REQUEST,
            "Show start time must be in the future.",
            [
                {
                    field:
                        "date",

                    message:
                        "Show start time must be in the future."
                }
            ]
        );

    }


    let entryOpensAt =
        null;


    if (data.entryTime) {

        entryOpensAt =
            createIndiaDateTime(
                data.date,
                data.entryTime
            );


        if (
            entryOpensAt >=
            startsAt
        ) {

            throw new ApiError(
                STATUS_BAD_REQUEST,
                "Entry opening time must be before the show start time.",
                [
                    {
                        field:
                            "entryTime",

                        message:
                            "Entry opening time must be before the show start time."
                    }
                ]
            );

        }

    }


    const durationMinutes =
        Number(
            event.duration ||
            0
        );


    const endsAt =
        durationMinutes >
            0
            ? new Date(
                startsAt.getTime() +
                durationMinutes *
                    60 *
                    1000
            )
            : null;


    const bookingCloseMinutes =
        Number(
            data.bookingCloseMinutes ??
            30
        );


    const bookingClosesAt =
        new Date(
            startsAt.getTime() -
            bookingCloseMinutes *
                60 *
                1000
        );


    return {

        startsAt,

        endsAt,

        entryOpensAt,

        bookingClosesAt,

        bookingCloseMinutes

    };

}


/* =========================================================
   EVENT OWNERSHIP
   ========================================================= */

async function requirePublishedOwnedEvent(
    organiserId,
    eventId,
    session =
        null
) {

    requireObjectId(
        organiserId,
        "organiserId"
    );


    requireObjectId(
        eventId,
        "eventId"
    );


    const query =
        Event.findOne({

            _id:
                eventId,

            organiserId,

            deleted:
                false,

            status:
                "PUBLISHED"

        });


    if (session) {

        query.session(
            session
        );

    }


    const event =
        await query;


    if (!event) {

        throw new ApiError(
            STATUS_NOT_FOUND,
            "Published Event not found."
        );

    }


    return event;

}


/* =========================================================
   VENUE
   ========================================================= */

function getActiveVenueCategories(
    venue
) {

    return (
        Array.isArray(
            venue.seatCategories
        )
            ? venue.seatCategories
            : []
    )
        .filter(
            (category) =>
                String(
                    category.status ||
                    "ACTIVE"
                )
                    .toUpperCase() ===
                    "ACTIVE" &&
                Number(
                    category.capacity ||
                    0
                ) >
                    0
        );

}


async function requireSchedulableVenue(
    venueId,
    session =
        null
) {

    requireObjectId(
        venueId,
        "venueId"
    );


    const query =
        Venue.findOne({

            _id:
                venueId,

            deleted:
                false,

            status:
                "ACTIVE",

            layoutConfigured:
                true

        });


    if (session) {

        query.session(
            session
        );

    }


    const venue =
        await query;


    if (!venue) {

        throw new ApiError(
            STATUS_NOT_FOUND,
            "Active configured Venue not found."
        );

    }


    const categories =
        getActiveVenueCategories(
            venue
        );


    if (
        !categories.length
    ) {

        throw new ApiError(
            STATUS_BAD_REQUEST,
            "Venue has no active seat categories with configured seats."
        );

    }


    return {
        venue,
        categories
    };

}


/* =========================================================
   SERVER-AUTHORITATIVE PRICING
   ========================================================= */

function buildServerPricing(
    venueCategories,
    clientPricing
) {

    const priceByCategory =
        new Map(
            (
                Array.isArray(
                    clientPricing
                )
                    ? clientPricing
                    : []
            ).map(
                (item) => [
                    String(
                        item.categoryId
                    ),
                    Number(
                        item.price
                    )
                ]
            )
        );


    const allowedIds =
        new Set(
            venueCategories.map(
                (category) =>
                    String(
                        category._id
                    )
            )
        );


    for (
        const suppliedId
        of priceByCategory.keys()
    ) {

        if (
            !allowedIds.has(
                suppliedId
            )
        ) {

            throw new ApiError(
                STATUS_BAD_REQUEST,
                "Pricing contains a seat category that does not belong to this Venue."
            );

        }

    }


    const pricing =
        venueCategories.map(
            (category) => {

                const categoryId =
                    String(
                        category._id
                    );


                const price =
                    priceByCategory.get(
                        categoryId
                    );


                if (
                    !Number.isFinite(
                        price
                    ) ||
                    price <=
                        0 ||
                    price >
                        1000000
                ) {

                    throw new ApiError(
                        STATUS_BAD_REQUEST,
                        `Enter a valid ticket price for ${category.name}.`,
                        [
                            {
                                field:
                                    "pricing",

                                message:
                                    `Enter a valid ticket price for ${category.name}.`
                            }
                        ]
                    );

                }


                return {

                    categoryId:
                        category._id,

                    categoryName:
                        category.name,

                    capacity:
                        Number(
                            category.capacity ||
                            0
                        ),

                    price

                };

            }
        );


    return pricing;

}


/* =========================================================
   VENUE OPTION SERIALIZATION
   ========================================================= */

function serializeVenueOption(
    venue
) {

    const categories =
        getActiveVenueCategories(
            venue
        )
            .map(
                (category) => ({

                    id:
                        String(
                            category._id
                        ),

                    _id:
                        category._id,

                    categoryId:
                        String(
                            category._id
                        ),

                    name:
                        category.name,

                    code:
                        category.code,

                    description:
                        category.description ||
                        "",

                    capacity:
                        Number(
                            category.capacity ||
                            0
                        ),

                    status:
                        category.status ||
                        "ACTIVE"

                })
            );


    return {

        id:
            String(
                venue._id
            ),

        _id:
            venue._id,

        name:
            venue.name,

        type:
            venue.type,

        city:
            venue.city,

        state:
            venue.state,

        country:
            venue.country,

        address:
            venue.address,

        capacity:
            Number(
                venue.capacity ||
                0
            ),

        layoutConfigured:
            Boolean(
                venue.layoutConfigured
            ),

        categories,

        seatCategories:
            categories

    };

}


async function getSchedulableVenues() {

    const venues =
        await Venue.find({

            deleted:
                false,

            status:
                "ACTIVE",

            layoutConfigured:
                true

        })
            .sort({
                city:
                    1,

                name:
                    1
            });


    return venues
        .filter(
            (venue) =>
                getActiveVenueCategories(
                    venue
                ).length >
                0
        )
        .map(
            serializeVenueOption
        );

}


async function getSchedulableVenueById(
    venueId
) {

    const {
        venue
    } =
        await requireSchedulableVenue(
            venueId
        );


    return serializeVenueOption(
        venue
    );

}


/* =========================================================
   DUPLICATE SLOT
   ========================================================= */

async function ensureVenueSlotAvailable(
    venueId,
    startsAt,
    ignoreShowId =
        null,
    session =
        null
) {

    const filter = {

        venueId,

        startsAt,

        status:
            "SCHEDULED"

    };


    if (ignoreShowId) {

        filter._id = {
            $ne:
                ignoreShowId
        };

    }


    const query =
        Show.exists(
            filter
        );


    if (session) {

        query.session(
            session
        );

    }


    const existing =
        await query;


    if (existing) {

        throw new ApiError(
            STATUS_CONFLICT,
            "Another scheduled Show already uses this Venue at the same start time."
        );

    }

}


/* =========================================================
   SERIALIZE
   ========================================================= */

function serializeShow(
    show
) {

    if (!show) {

        return null;

    }


    const object =
        typeof show.toObject ===
            "function"
            ? show.toObject({
                virtuals:
                    true
            })
            : {
                ...show
            };


    object.id =
        String(
            object._id ||
            object.id
        );


    object.eventId =
        String(
            object.eventId?._id ||
            object.eventId
        );


    object.venueId =
        String(
            object.venueId?._id ||
            object.venueId
        );


    object.organiserId =
        String(
            object.organiserId?._id ||
            object.organiserId
        );


    object.soldSeats =
        Math.max(
            0,
            Number(
                object.soldSeats ||
                0
            ) ||
            0
        );


    object.revenue =
        Math.max(
            0,
            Number(
                object.revenue ||
                0
            ) ||
            0
        );


    return object;

}


/* =========================================================
   CREATE
   ========================================================= */

async function createShow(
    organiserId,
    data
) {

    const session =
        await mongoose
            .startSession();


    let createdShow =
        null;


    try {

        await session.withTransaction(
            async () => {

                const event =
                    await requirePublishedOwnedEvent(
                        organiserId,
                        data.eventId,
                        session
                    );


                const {
                    venue,
                    categories
                } =
                    await requireSchedulableVenue(
                        data.venueId,
                        session
                    );


                const schedule =
                    calculateSchedule(
                        event,
                        data
                    );


                await ensureVenueSlotAvailable(
                    venue._id,
                    schedule.startsAt,
                    null,
                    session
                );


                const pricing =
                    buildServerPricing(
                        categories,
                        data.pricing
                    );


                /*
                   Phase 8 calculated capacity from cached Venue
                   category capacities.

                   Phase 9 immediately rebuilds capacity from the
                   actual active physical Seat documents while
                   generating ShowSeat records.
                */
                const preliminaryCapacity =
                    categories.reduce(
                        (
                            total,
                            category
                        ) =>
                            total +
                            Number(
                                category.capacity ||
                                0
                            ),
                        0
                    );


                const show =
                    new Show({

                        organiserId,

                        eventId:
                            event._id,

                        venueId:
                            venue._id,

                        eventTitle:
                            event.title,

                        eventType:
                            event.type,

                        venueName:
                            venue.name,

                        venueCity:
                            venue.city,

                        date:
                            data.date,

                        time:
                            data.time,

                        entryTime:
                            data.entryTime ||
                            null,

                        startsAt:
                            schedule.startsAt,

                        endsAt:
                            schedule.endsAt,

                        entryOpensAt:
                            schedule.entryOpensAt,

                        bookingCloseMinutes:
                            schedule.bookingCloseMinutes,

                        bookingClosesAt:
                            schedule.bookingClosesAt,

                        instructions:
                            data.instructions ||
                            "",

                        capacity:
                            preliminaryCapacity,

                        pricing,

                        soldSeats:
                            0,

                        revenue:
                            0,

                        seatsGenerated:
                            false,

                        seatsGeneratedAt:
                            null,

                        status:
                            "SCHEDULED"

                    });


                await show.save({
                    session
                });


                await showSeatService
                    .generateShowSeats(
                        show,
                        {
                            session
                        }
                    );


                createdShow =
                    serializeShow(
                        show
                    );

            }
        );


        return createdShow;

    } finally {

        await session.endSession();

    }

}


/* =========================================================
   LIST
   ========================================================= */

async function getOrganiserShows(
    organiserId,
    query = {}
) {

    requireObjectId(
        organiserId,
        "organiserId"
    );


    const filter = {

        organiserId

    };


    if (
        query.status &&
        query.status !==
            "ALL"
    ) {

        filter.status =
            query.status;

    }


    if (query.eventId) {

        filter.eventId =
            query.eventId;

    }


    if (query.venueId) {

        filter.venueId =
            query.venueId;

    }


    if (query.search) {

        const escaped =
            String(
                query.search
            )
                .replace(
                    /[.*+?^${}()|[\]\\]/g,
                    "\\$&"
                );


        const expression =
            new RegExp(
                escaped,
                "i"
            );


        filter.$or = [

            {
                reference:
                    expression
            },

            {
                eventTitle:
                    expression
            },

            {
                venueName:
                    expression
            },

            {
                venueCity:
                    expression
            }

        ];

    }


    let sort = {
        startsAt:
            1
    };


    switch (
        query.sort
    ) {

        case "DATE_DESC":

            sort = {
                startsAt:
                    -1
            };

            break;


        case "CREATED_DESC":

            sort = {
                createdAt:
                    -1
            };

            break;


        case "CREATED_ASC":

            sort = {
                createdAt:
                    1
            };

            break;

    }


    const page =
        query.page ||
        1;


    const limit =
        query.limit ||
        100;


    const [
        shows,
        total
    ] =
        await Promise.all([

            Show
                .find(
                    filter
                )
                .sort(
                    sort
                )
                .skip(
                    (
                        page -
                        1
                    ) *
                    limit
                )
                .limit(
                    limit
                ),

            Show.countDocuments(
                filter
            )

        ]);


    return {

        shows:
            shows.map(
                serializeShow
            ),

        pagination: {

            page,

            limit,

            total,

            totalPages:
                Math.max(
                    1,
                    Math.ceil(
                        total /
                        limit
                    )
                )

        }

    };

}


/* =========================================================
   GET ONE
   ========================================================= */

async function requireOwnedShow(
    organiserId,
    showId
) {

    requireObjectId(
        organiserId,
        "organiserId"
    );


    requireObjectId(
        showId,
        "showId"
    );


    const show =
        await Show.findOne({

            _id:
                showId,

            organiserId

        });


    if (!show) {

        throw new ApiError(
            STATUS_NOT_FOUND,
            "Show not found."
        );

    }


    return show;

}


async function getShowById(
    organiserId,
    showId
) {

    return serializeShow(
        await requireOwnedShow(
            organiserId,
            showId
        )
    );

}


/* =========================================================
   UPDATE SCHEDULE / PRICING
   ========================================================= */

async function updateShow(
    organiserId,
    showId,
    updateData
) {

    const show =
        await requireOwnedShow(
            organiserId,
            showId
        );


    if (
        show.status !==
        "SCHEDULED"
    ) {

        throw new ApiError(
            STATUS_CONFLICT,
            "Only scheduled Shows can be edited."
        );

    }


    if (
        show.startsAt &&
        show.startsAt.getTime() <=
            Date.now()
    ) {

        throw new ApiError(
            STATUS_CONFLICT,
            "Past Shows cannot be edited."
        );

    }


    /*
       Once ShowSeats exist, the Venue and seat-category
       pricing snapshot are frozen.

       Replacing either one would desynchronise the Show
       from its generated ShowSeat records.

       Later booking/refund phases rely on this immutability.
    */

    if (
        Boolean(
            show.seatsGenerated
        )
    ) {

        if (
            Object.prototype
                .hasOwnProperty.call(
                    updateData,
                    "venueId"
                ) &&
            String(
                updateData.venueId
            ) !==
            String(
                show.venueId
            )
        ) {

            throw new ApiError(
                STATUS_CONFLICT,
                "Venue cannot be changed after ShowSeats are generated."
            );

        }


        if (
            Object.prototype
                .hasOwnProperty.call(
                    updateData,
                    "pricing"
                )
        ) {

            throw new ApiError(
                STATUS_CONFLICT,
                "Show pricing cannot be changed after ShowSeats are generated."
            );

        }


        const merged = {

            eventId:
                updateData.eventId ||
                String(
                    show.eventId
                ),

            date:
                updateData.date ||
                show.date,

            time:
                updateData.time ||
                show.time,

            entryTime:
                Object.prototype
                    .hasOwnProperty.call(
                        updateData,
                        "entryTime"
                    )
                    ? updateData.entryTime
                    : show.entryTime,

            bookingCloseMinutes:
                Object.prototype
                    .hasOwnProperty.call(
                        updateData,
                        "bookingCloseMinutes"
                    )
                    ? updateData.bookingCloseMinutes
                    : show.bookingCloseMinutes,

            instructions:
                Object.prototype
                    .hasOwnProperty.call(
                        updateData,
                        "instructions"
                    )
                    ? updateData.instructions
                    : show.instructions

        };


        const event =
            await requirePublishedOwnedEvent(
                organiserId,
                merged.eventId
            );


        const schedule =
            calculateSchedule(
                event,
                merged
            );


        await ensureVenueSlotAvailable(
            show.venueId,
            schedule.startsAt,
            show._id
        );


        show.eventId =
            event._id;

        show.eventTitle =
            event.title;

        show.eventType =
            event.type;

        show.date =
            merged.date;

        show.time =
            merged.time;

        show.entryTime =
            merged.entryTime ||
            null;

        show.startsAt =
            schedule.startsAt;

        show.endsAt =
            schedule.endsAt;

        show.entryOpensAt =
            schedule.entryOpensAt;

        show.bookingCloseMinutes =
            schedule.bookingCloseMinutes;

        show.bookingClosesAt =
            schedule.bookingClosesAt;

        show.instructions =
            merged.instructions ||
            "";


        /*
           Do NOT rebuild:
           venueId / venueName / venueCity
           capacity / pricing
           generated ShowSeat snapshots
        */

        await show.save();


        return serializeShow(
            show
        );

    }


    /*
       Compatibility path for a Phase 8 Show that has not yet
       received ShowSeat records. It can still be edited until
       the Phase 9 backfill endpoint generates its seats.
    */

    const merged = {

        eventId:
            updateData.eventId ||
            String(
                show.eventId
            ),

        venueId:
            updateData.venueId ||
            String(
                show.venueId
            ),

        date:
            updateData.date ||
            show.date,

        time:
            updateData.time ||
            show.time,

        entryTime:
            Object.prototype
                .hasOwnProperty.call(
                    updateData,
                    "entryTime"
                )
                ? updateData.entryTime
                : show.entryTime,

        bookingCloseMinutes:
            Object.prototype
                .hasOwnProperty.call(
                    updateData,
                    "bookingCloseMinutes"
                )
                ? updateData.bookingCloseMinutes
                : show.bookingCloseMinutes,

        instructions:
            Object.prototype
                .hasOwnProperty.call(
                    updateData,
                    "instructions"
                )
                ? updateData.instructions
                : show.instructions,

        pricing:
            Object.prototype
                .hasOwnProperty.call(
                    updateData,
                    "pricing"
                )
                ? updateData.pricing
                : show.pricing.map(
                    (item) => ({
                        categoryId:
                            String(
                                item.categoryId
                            ),

                        price:
                            item.price
                    })
                )

    };


    const event =
        await requirePublishedOwnedEvent(
            organiserId,
            merged.eventId
        );


    const {
        venue,
        categories
    } =
        await requireSchedulableVenue(
            merged.venueId
        );


    const schedule =
        calculateSchedule(
            event,
            merged
        );


    await ensureVenueSlotAvailable(
        venue._id,
        schedule.startsAt,
        show._id
    );


    const pricing =
        buildServerPricing(
            categories,
            merged.pricing
        );


    const capacity =
        categories.reduce(
            (
                total,
                category
            ) =>
                total +
                Number(
                    category.capacity ||
                    0
                ),
            0
        );


    show.eventId =
        event._id;

    show.venueId =
        venue._id;

    show.eventTitle =
        event.title;

    show.eventType =
        event.type;

    show.venueName =
        venue.name;

    show.venueCity =
        venue.city;

    show.date =
        merged.date;

    show.time =
        merged.time;

    show.entryTime =
        merged.entryTime ||
        null;

    show.startsAt =
        schedule.startsAt;

    show.endsAt =
        schedule.endsAt;

    show.entryOpensAt =
        schedule.entryOpensAt;

    show.bookingCloseMinutes =
        schedule.bookingCloseMinutes;

    show.bookingClosesAt =
        schedule.bookingClosesAt;

    show.instructions =
        merged.instructions ||
        "";

    show.capacity =
        capacity;

    show.pricing =
        pricing;


    await show.save();


    return serializeShow(
        show
    );

}


/* =========================================================
   CANCEL
   ========================================================= */

async function cancelShow(
    organiserId,
    showId,
    {
        reason =
            ""
    } = {}
) {

    const show =
        await requireOwnedShow(
            organiserId,
            showId
        );


    if (
        show.status ===
        "CANCELLED"
    ) {

        throw new ApiError(
            STATUS_CONFLICT,
            "Show is already cancelled."
        );

    }


    if (
        show.status ===
        "COMPLETED" ||
        (
            show.startsAt &&
            show.startsAt.getTime() <=
                Date.now()
        )
    ) {

        throw new ApiError(
            STATUS_CONFLICT,
            "Past or completed Shows cannot be cancelled."
        );

    }


    /*
       Booking/refund logic belongs to later phases.
       Phase 8 has no confirmed Booking creation yet.
    */

    show.status =
        "CANCELLED";

    show.cancelledAt =
        new Date();

    show.cancellationReason =
        String(
            reason ||
            ""
        )
            .trim()
            .slice(
                0,
                300
            );


    await show.save();


    return serializeShow(
        show
    );

}



/* =========================================================
   PHASE 10 - CUSTOMER SHOW DISCOVERY
   ========================================================= */


function customerShowFilter(
    extra = {}
) {

    return {

        status:
            "SCHEDULED",

        startsAt: {
            $gt:
                new Date()
        },

        seatsGenerated:
            true,

        ...extra

    };

}


async function requirePublishedCustomerEvent(
    eventId
) {

    requireObjectId(
        eventId,
        "eventId"
    );


    const event =
        await Event.findOne({

            _id:
                eventId,

            deleted:
                false,

            status:
                "PUBLISHED"

        });


    if (!event) {

        throw new ApiError(
            STATUS_NOT_FOUND,
            "Event not found."
        );

    }


    return event;

}


async function buildCustomerShowRecords(
    shows
) {

    if (!shows.length) {

        return [];

    }


    const showIds =
        shows.map(
            (show) =>
                show._id
        );


    const venueIds =
        [
            ...new Set(
                shows.map(
                    (show) =>
                        String(
                            show.venueId
                        )
                )
            )
        ];


    const [
        seatRows,
        venues
    ] =
        await Promise.all([

            ShowSeat.find({

                showId: {
                    $in:
                        showIds
                }

            })
                .select(
                    "showId categoryId categoryName price status"
                )
                .lean(),

            Venue.find({

                _id: {
                    $in:
                        venueIds
                },

                deleted:
                    false

            })
                .select(
                    "name type address city state country capacity"
                )
                .lean()

        ]);


    const venueMap =
        new Map(
            venues.map(
                (venue) => [
                    String(
                        venue._id
                    ),
                    venue
                ]
            )
        );


    const seatSummaryByShow =
        new Map();


    seatRows.forEach(
        (seat) => {

            const showKey =
                String(
                    seat.showId
                );


            if (
                !seatSummaryByShow.has(
                    showKey
                )
            ) {

                seatSummaryByShow.set(
                    showKey,
                    {
                        total:
                            0,

                        available:
                            0,

                        byCategory:
                            new Map()
                    }
                );

            }


            const summary =
                seatSummaryByShow.get(
                    showKey
                );


            summary.total +=
                1;


            if (
                seat.status ===
                "AVAILABLE"
            ) {

                summary.available +=
                    1;

            }


            const categoryKey =
                String(
                    seat.categoryId
                );


            if (
                !summary.byCategory.has(
                    categoryKey
                )
            ) {

                summary.byCategory.set(
                    categoryKey,
                    {
                        total:
                            0,

                        available:
                            0
                    }
                );

            }


            const categorySummary =
                summary.byCategory.get(
                    categoryKey
                );


            categorySummary.total +=
                1;


            if (
                seat.status ===
                "AVAILABLE"
            ) {

                categorySummary.available +=
                    1;

            }

        }
    );


    return shows.map(
        (show) => {

            const object =
                typeof show.toObject ===
                    "function"
                    ? show.toObject({
                        virtuals:
                            true
                    })
                    : {
                        ...show
                    };


            const summary =
                seatSummaryByShow.get(
                    String(
                        object._id
                    )
                ) ||
                {
                    total:
                        0,

                    available:
                        0,

                    byCategory:
                        new Map()
                };


            const venue =
                venueMap.get(
                    String(
                        object.venueId
                    )
                ) ||
                null;


            const seatCategories =
                (
                    object.pricing ||
                    []
                ).map(
                    (category) => {

                        const counts =
                            summary
                                .byCategory
                                .get(
                                    String(
                                        category.categoryId
                                    )
                                ) ||
                            {
                                total:
                                    Number(
                                        category.capacity ||
                                        0
                                    ),

                                available:
                                    Math.max(
                                        0,
                                        Number(
                                            category.capacity ||
                                            0
                                        )
                                    )
                            };


                        return {

                            categoryId:
                                String(
                                    category.categoryId
                                ),

                            name:
                                category.categoryName,

                            categoryName:
                                category.categoryName,

                            price:
                                Number(
                                    category.price
                                ),

                            totalSeats:
                                Number(
                                    counts.total ||
                                    0
                                ),

                            availableSeats:
                                Number(
                                    counts.available ||
                                    0
                                ),

                            soldOut:
                                Number(
                                    counts.available ||
                                    0
                                ) <=
                                0

                        };

                    }
                );


            const startingPrice =
                seatCategories.reduce(
                    (
                        minimum,
                        category
                    ) =>
                        minimum ===
                            null
                            ? category.price
                            : Math.min(
                                minimum,
                                category.price
                            ),
                    null
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

                eventId:
                    String(
                        object.eventId
                    ),

                eventTitle:
                    object.eventTitle,

                eventType:
                    object.eventType,

                venueId:
                    String(
                        object.venueId
                    ),

                venueName:
                    object.venueName,

                venueCity:
                    object.venueCity ||
                    "",

                venue:
                    venue
                        ? {
                            id:
                                String(
                                    venue._id
                                ),

                            _id:
                                String(
                                    venue._id
                                ),

                            name:
                                venue.name,

                            shortName:
                                venue.name,

                            type:
                                venue.type,

                            address:
                                venue.address,

                            city:
                                venue.city,

                            state:
                                venue.state,

                            country:
                                venue.country,

                            capacity:
                                Number(
                                    venue.capacity ||
                                    0
                                )
                        }
                        : {
                            id:
                                String(
                                    object.venueId
                                ),

                            _id:
                                String(
                                    object.venueId
                                ),

                            name:
                                object.venueName,

                            shortName:
                                object.venueName,

                            city:
                                object.venueCity ||
                                ""
                        },

                date:
                    object.date,

                time:
                    object.time,

                entryTime:
                    object.entryTime ||
                    null,

                doorsOpen:
                    object.entryTime ||
                    null,

                startsAt:
                    object.startsAt,

                endsAt:
                    object.endsAt ||
                    null,

                bookingClosesAt:
                    object.bookingClosesAt ||
                    null,

                instructions:
                    object.instructions ||
                    "",

                capacity:
                    Number(
                        object.capacity ||
                        0
                    ),

                totalSeats:
                    Number(
                        summary.total ||
                        0
                    ),

                availableSeats:
                    Number(
                        summary.available ||
                        0
                    ),

                soldOut:
                    Number(
                        summary.available ||
                        0
                    ) <=
                    0,

                startingPrice,

                seatCategories,

                status:
                    "SCHEDULED"

            };

        }
    );

}


async function getCustomerShowsByEvent(
    eventId
) {

    const event =
        await requirePublishedCustomerEvent(
            eventId
        );


    const shows =
        await Show.find(
            customerShowFilter({
                eventId:
                    event._id
            })
        )
            .sort({
                startsAt:
                    1
            });


    return buildCustomerShowRecords(
        shows
    );

}


async function getCustomerShowById(
    showId
) {

    requireObjectId(
        showId,
        "showId"
    );


    const show =
        await Show.findOne(
            customerShowFilter({
                _id:
                    showId
            })
        );


    if (!show) {

        throw new ApiError(
            STATUS_NOT_FOUND,
            "Show not found."
        );

    }


    /*
       A scheduled Show is customer-visible only while its
       parent Event remains published and non-deleted.
    */

    await requirePublishedCustomerEvent(
        show.eventId
    );


    const [
        serialized
    ] =
        await buildCustomerShowRecords(
            [
                show
            ]
        );


    return serialized;

}


async function getCustomerShowSeats(
    showId
) {

    const show =
        await getCustomerShowById(
            showId
        );


    const seats =
        await ShowSeat.find({

            showId:
                show.id

        })
            .sort({
                row:
                    1,

                number:
                    1
            });


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


    const summary =
        showSeatService
            .summarizeShowSeats(
                seats
            );


    return {

        show,

        seats:
            publicSeats,

        summary

    };

}


module.exports = {

    createShow,

    getOrganiserShows,

    getShowById,

    updateShow,

    cancelShow,

    getSchedulableVenues,

    getSchedulableVenueById,

    serializeShow,

    getCustomerShowsByEvent,

    getCustomerShowById,

    getCustomerShowSeats,

    buildCustomerShowRecords

};
