"use strict";

const mongoose =
    require("mongoose");

const Event =
    require("../models/Event");

const Show =
    require("../models/Show");

const ShowSeat =
    require("../models/ShowSeat");

const ApiError =
    require("../utils/ApiError");

const {
    HTTP_STATUS
} =
    require("../utils/constants");


/* =========================================================
   SKYRA - EVENT SERVICE
   File: backend/src/services/eventService.js

   Phase 7 Organiser Event CRUD.

   Ownership rule:
   Every query includes organiserId.
   One organiser cannot read/update/delete another organiser's
   events even if they know the MongoDB Event ID.
   ========================================================= */


const STATUS_BAD_REQUEST =
    HTTP_STATUS?.BAD_REQUEST ||
    400;

const STATUS_NOT_FOUND =
    HTTP_STATUS?.NOT_FOUND ||
    404;


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


function serializeEvent(
    event
) {

    if (!event) {

        return null;

    }


    const object =
        typeof event.toObject ===
            "function"
            ? event.toObject({
                virtuals:
                    true
            })
            : {
                ...event
            };


    object.id =
        String(
            object._id ||
            object.id
        );


    object.showCount =
        Math.max(
            0,
            Number(
                object.showCount ||
                0
            ) ||
            0
        );


    object.poster =
        object.posterUrl ||
        null;


    object.banner =
        object.bannerUrl ||
        null;


    return object;

}


async function requireOwnedEvent(
    organiserId,
    eventId
) {

    requireObjectId(
        organiserId,
        "organiserId"
    );


    requireObjectId(
        eventId,
        "eventId"
    );


    const event =
        await Event.findOne({

            _id:
                eventId,

            organiserId,

            deleted:
                false

        });


    if (!event) {

        throw new ApiError(
            STATUS_NOT_FOUND,
            "Event not found."
        );

    }


    return event;

}


/* =========================================================
   CREATE
   ========================================================= */

async function createEvent(
    organiserId,
    eventData
) {

    requireObjectId(
        organiserId,
        "organiserId"
    );


    const event =
        await Event.create({

            ...eventData,

            organiserId

        });


    return serializeEvent(
        event
    );

}


/* =========================================================
   LIST
   ========================================================= */

async function getOrganiserEvents(
    organiserId,
    query = {}
) {

    requireObjectId(
        organiserId,
        "organiserId"
    );


    const filter = {

        organiserId,

        deleted:
            false

    };


    if (
        query.status &&
        query.status !==
            "ALL"
    ) {

        filter.status =
            query.status;

    }


    if (
        query.type &&
        query.type !==
            "ALL"
    ) {

        filter.type =
            query.type;

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
                title:
                    expression
            },

            {
                genre:
                    expression
            },

            {
                language:
                    expression
            },

            {
                creator:
                    expression
            },

            {
                performers:
                    expression
            },

            {
                tags:
                    expression
            }

        ];

    }


    const page =
        query.page ||
        1;


    const limit =
        query.limit ||
        100;


    let sort = {

        createdAt:
            -1

    };


    switch (
        query.sort
    ) {

        case "OLDEST":

            sort = {

                createdAt:
                    1

            };

            break;


        case "TITLE_ASC":

            sort = {

                title:
                    1

            };

            break;


        case "TITLE_DESC":

            sort = {

                title:
                    -1

            };

            break;

    }


    const [
        events,
        total
    ] =
        await Promise.all([

            Event
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

            Event.countDocuments(
                filter
            )

        ]);


    const serializedEvents =
        await attachOrganiserShowCounts(
            events
        );


    return {

        events:
            serializedEvents,

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

async function getEventById(
    organiserId,
    eventId
) {

    const event =
        await requireOwnedEvent(
            organiserId,
            eventId
        );


    const [
        serialized
    ] =
        await attachOrganiserShowCounts(
            [
                event
            ]
        );


    return serialized;

}


/* =========================================================
   UPDATE
   ========================================================= */

async function updateEvent(
    organiserId,
    eventId,
    updateData
) {

    const event =
        await requireOwnedEvent(
            organiserId,
            eventId
        );


    Object.keys(
        updateData
    ).forEach(
        (field) => {

            event[
                field
            ] =
                updateData[
                    field
                ];

        }
    );


    await event.save();


    return serializeEvent(
        event
    );

}


/* =========================================================
   SOFT DELETE
   ========================================================= */

async function deleteEvent(
    organiserId,
    eventId
) {

    const event =
        await requireOwnedEvent(
            organiserId,
            eventId
        );


    /*
       Phase 8+ will strengthen this rule by checking Shows and
       active bookings before destructive actions.
    */

    event.deleted =
        true;

    event.deletedAt =
        new Date();

    event.status =
        "ARCHIVED";


    await event.save();


    return serializeEvent(
        event
    );

}



/* =========================================================
   PHASE 10 - CUSTOMER EVENT DISCOVERY
   ========================================================= */


function escapeRegex(
    value
) {

    return String(
        value || ""
    ).replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
    );

}


function customerShortDescription(
    description
) {

    const text =
        String(
            description ||
            ""
        )
            .trim()
            .replace(
                /\s+/g,
                " "
            );


    if (
        text.length <=
        180
    ) {

        return text;

    }


    return `${text.slice(
        0,
        177
    )}...`;

}


function startOfIndiaTodayUTC() {

    /*
       Current SKYRA scheduling is India-oriented.
       Convert current instant to an Asia/Kolkata calendar date,
       then construct midnight at +05:30.
    */

    const parts =
        new Intl.DateTimeFormat(
            "en-CA",
            {
                timeZone:
                    "Asia/Kolkata",

                year:
                    "numeric",

                month:
                    "2-digit",

                day:
                    "2-digit"
            }
        )
            .formatToParts(
                new Date()
            )
            .reduce(
                (
                    result,
                    part
                ) => {

                    if (
                        part.type !==
                        "literal"
                    ) {

                        result[
                            part.type
                        ] =
                            part.value;

                    }


                    return result;

                },
                {}
            );


    return new Date(
        `${parts.year}-${parts.month}-${parts.day}T00:00:00+05:30`
    );

}


function eventDateFilterMatches(
    shows,
    filter
) {

    if (
        !filter ||
        filter ===
            "ALL"
    ) {

        return true;

    }


    if (!shows.length) {

        return false;

    }


    const today =
        startOfIndiaTodayUTC();


    const endToday =
        new Date(
            today.getTime() +
            24 *
            60 *
            60 *
            1000
        );


    const dayOfWeek =
        Number(
            new Intl.DateTimeFormat(
                "en-US",
                {
                    timeZone:
                        "Asia/Kolkata",

                    weekday:
                        "short"
                }
            )
                .format(
                    today
                )
                .replace(
                    /Sun|Mon|Tue|Wed|Thu|Fri|Sat/,
                    (
                        value
                    ) => ({
                        Sun: 0,
                        Mon: 1,
                        Tue: 2,
                        Wed: 3,
                        Thu: 4,
                        Fri: 5,
                        Sat: 6
                    })[
                        value
                    ]
                )
        );


    const weekStart =
        new Date(
            today.getTime() -
            (
                (
                    dayOfWeek +
                    6
                ) %
                7
            ) *
            24 *
            60 *
            60 *
            1000
        );


    const weekEnd =
        new Date(
            weekStart.getTime() +
            7 *
            24 *
            60 *
            60 *
            1000
        );


    const indiaYearMonth =
        new Intl.DateTimeFormat(
            "en-CA",
            {
                timeZone:
                    "Asia/Kolkata",

                year:
                    "numeric",

                month:
                    "2-digit"
            }
        ).format(
            new Date()
        );


    return shows.some(
        (show) => {

            const startsAt =
                new Date(
                    show.startsAt
                );


            switch (filter) {

                case "TODAY":

                    return (
                        startsAt >=
                            today &&
                        startsAt <
                            endToday
                    );


                case "THIS_WEEK":

                    return (
                        startsAt >=
                            weekStart &&
                        startsAt <
                            weekEnd
                    );


                case "THIS_MONTH":

                    return (
                        new Intl.DateTimeFormat(
                            "en-CA",
                            {
                                timeZone:
                                    "Asia/Kolkata",

                                year:
                                    "numeric",

                                month:
                                    "2-digit"
                            }
                        ).format(
                            startsAt
                        ) ===
                        indiaYearMonth
                    );


                case "UPCOMING":

                    return (
                        startsAt.getTime() >
                        Date.now()
                    );


                default:

                    return true;

            }

        }
    );

}


async function buildCustomerEventRecords(
    events
) {

    const eventIds =
        events.map(
            (event) =>
                event._id
        );


    if (!eventIds.length) {

        return [];

    }


    const shows =
        await Show.find({

            eventId: {
                $in:
                    eventIds
            },

            status:
                "SCHEDULED",

            startsAt: {
                $gt:
                    new Date()
            },

            seatsGenerated:
                true

        })
            .sort({
                startsAt:
                    1
            })
            .lean();


    const showIds =
        shows.map(
            (show) =>
                show._id
        );


    const availability =
        showIds.length
            ? await ShowSeat.aggregate([
                {
                    $match: {
                        showId: {
                            $in:
                                showIds
                        }
                    }
                },
                {
                    $group: {
                        _id:
                            "$showId",

                        totalSeats: {
                            $sum:
                                1
                        },

                        availableSeats: {
                            $sum: {
                                $cond: [
                                    {
                                        $eq: [
                                            "$status",
                                            "AVAILABLE"
                                        ]
                                    },
                                    1,
                                    0
                                ]
                            }
                        }
                    }
                }
            ])
            : [];


    const availabilityMap =
        new Map(
            availability.map(
                (entry) => [
                    String(
                        entry._id
                    ),
                    {
                        totalSeats:
                            Number(
                                entry.totalSeats ||
                                0
                            ),

                        availableSeats:
                            Number(
                                entry.availableSeats ||
                                0
                            )
                    }
                ]
            )
        );


    const showsByEvent =
        new Map();


    shows.forEach(
        (show) => {

            const key =
                String(
                    show.eventId
                );


            if (
                !showsByEvent.has(
                    key
                )
            ) {

                showsByEvent.set(
                    key,
                    []
                );

            }


            showsByEvent
                .get(
                    key
                )
                .push(
                    show
                );

        }
    );


    return events.map(
        (event) => {

            const object =
                typeof event.toObject ===
                    "function"
                    ? event.toObject({
                        virtuals:
                            true
                    })
                    : {
                        ...event
                    };


            const eventShows =
                showsByEvent.get(
                    String(
                        object._id
                    )
                ) ||
                [];


            const nextShow =
                eventShows[0] ||
                null;


            let startingPrice =
                null;


            eventShows.forEach(
                (show) => {

                    (
                        show.pricing ||
                        []
                    ).forEach(
                        (category) => {

                            const value =
                                Number(
                                    category.price
                                );


                            if (
                                Number.isFinite(
                                    value
                                ) &&
                                (
                                    startingPrice ===
                                        null ||
                                    value <
                                        startingPrice
                                )
                            ) {

                                startingPrice =
                                    value;

                            }

                        }
                    );

                }
            );


            const nextAvailability =
                nextShow
                    ? availabilityMap.get(
                        String(
                            nextShow._id
                        )
                    ) || {
                        totalSeats:
                            Number(
                                nextShow.capacity ||
                                0
                            ),

                        availableSeats:
                            Math.max(
                                0,
                                Number(
                                    nextShow.capacity ||
                                    0
                                ) -
                                Number(
                                    nextShow.soldSeats ||
                                    0
                                )
                            )
                    }
                    : null;


            return {

                id:
                    String(
                        object._id
                    ),

                _id:
                    String(
                        object._id
                    ),

                title:
                    object.title,

                type:
                    object.type,

                category:
                    object.genre,

                genre:
                    object.genre,

                language:
                    object.language ||
                    "",

                duration:
                    object.duration,

                ageRating:
                    object.ageRating ||
                    "",

                description:
                    object.description,

                shortDescription:
                    customerShortDescription(
                        object.description
                    ),

                performers:
                    Array.isArray(
                        object.performers
                    )
                        ? object.performers
                        : [],

                creator:
                    object.creator ||
                    "",

                tags:
                    Array.isArray(
                        object.tags
                    )
                        ? object.tags
                        : [],

                posterUrl:
                    object.posterUrl ||
                    "",

                bannerUrl:
                    object.bannerUrl ||
                    "",

                poster:
                    object.posterUrl ||
                    null,

                banner:
                    object.bannerUrl ||
                    null,

                publishedAt:
                    object.publishedAt ||
                    null,

                showCount:
                    eventShows.length,

                startingPrice,

                cities:
                    [
                        ...new Set(
                            eventShows
                                .map(
                                    (show) =>
                                        String(
                                            show.venueCity ||
                                            ""
                                        ).trim()
                                )
                                .filter(Boolean)
                        )
                    ],

                nextShow:
                    nextShow
                        ? {
                            id:
                                String(
                                    nextShow._id
                                ),

                            _id:
                                String(
                                    nextShow._id
                                ),

                            date:
                                nextShow.date,

                            time:
                                nextShow.time,

                            doorsOpen:
                                nextShow.entryTime ||
                                null,

                            startsAt:
                                nextShow.startsAt,

                            venueId:
                                String(
                                    nextShow.venueId
                                ),

                            venueName:
                                nextShow.venueName,

                            venueCity:
                                nextShow.venueCity ||
                                "",

                            startingPrice:
                                (
                                    nextShow.pricing ||
                                    []
                                ).reduce(
                                    (
                                        minimum,
                                        category
                                    ) => {

                                        const price =
                                            Number(
                                                category.price
                                            );


                                        if (
                                            !Number.isFinite(
                                                price
                                            )
                                        ) {

                                            return minimum;

                                        }


                                        return minimum ===
                                            null
                                            ? price
                                            : Math.min(
                                                minimum,
                                                price
                                            );

                                    },
                                    null
                                ),

                            totalSeats:
                                nextAvailability
                                    ?.totalSeats ||
                                0,

                            availableSeats:
                                nextAvailability
                                    ?.availableSeats ||
                                0
                        }
                        : null

            };

        }
    );

}


async function getCustomerEvents(
    query = {}
) {

    const filter = {

        deleted:
            false,

        status:
            "PUBLISHED"

    };


    if (
        query.type &&
        query.type !==
            "ALL" &&
        query.type !==
            "EVENT"
    ) {

        filter.type =
            query.type;

    }


    if (
        query.language &&
        query.language !==
            "ALL"
    ) {

        filter.language =
            new RegExp(
                escapeRegex(
                    query.language
                ),
                "i"
            );

    }


    /*
       Fetch published Event records first, then apply
       show-derived city/date/price filters. This keeps Event
       and Show as separate database concepts.
    */

    const events =
        await Event.find(
            filter
        )
            .sort({
                publishedAt:
                    -1,

                createdAt:
                    -1
            });


    let records =
        await buildCustomerEventRecords(
            events
        );


    if (query.search) {

        const needle =
            String(
                query.search
            )
                .trim()
                .toLowerCase();


        records =
            records.filter(
                (event) => {

                    const searchable = [

                        event.title,

                        event.type,

                        event.genre,

                        event.language,

                        event.description,

                        event.creator,

                        ...(event.performers || []),

                        ...(event.tags || []),

                        ...(event.cities || []),

                        event.nextShow
                            ?.venueName

                    ]
                        .filter(Boolean)
                        .join(" ")
                        .toLowerCase();


                    return searchable.includes(
                        needle
                    );

                }
            );

    }


    if (
        query.city &&
        query.city !==
            "ALL"
    ) {

        const city =
            String(
                query.city
            )
                .trim()
                .toLowerCase();


        records =
            records.filter(
                (event) =>
                    (
                        event.cities ||
                        []
                    ).some(
                        (value) =>
                            String(
                                value
                            )
                                .toLowerCase() ===
                            city
                    )
            );

    }


    if (
        query.date &&
        query.date !==
            "ALL"
    ) {

        const eventIds =
            records.map(
                (event) =>
                    event.id
            );


        const shows =
            eventIds.length
                ? await Show.find({

                    eventId: {
                        $in:
                            eventIds
                    },

                    status:
                        "SCHEDULED",

                    startsAt: {
                        $gt:
                            new Date()
                    },

                    seatsGenerated:
                        true

                }).lean()
                : [];


        const showsByEvent =
            new Map();


        shows.forEach(
            (show) => {

                const key =
                    String(
                        show.eventId
                    );


                if (
                    !showsByEvent.has(
                        key
                    )
                ) {

                    showsByEvent.set(
                        key,
                        []
                    );

                }


                showsByEvent
                    .get(
                        key
                    )
                    .push(
                        show
                    );

            }
        );


        records =
            records.filter(
                (event) =>
                    eventDateFilterMatches(
                        showsByEvent.get(
                            event.id
                        ) ||
                        [],
                        query.date
                    )
            );

    }


    switch (
        query.sort
    ) {

        case "DATE_ASC":

            records.sort(
                (
                    first,
                    second
                ) => {

                    const firstTime =
                        first.nextShow
                            ? new Date(
                                first.nextShow
                                    .startsAt
                            ).getTime()
                            : Number
                                .MAX_SAFE_INTEGER;


                    const secondTime =
                        second.nextShow
                            ? new Date(
                                second.nextShow
                                    .startsAt
                            ).getTime()
                            : Number
                                .MAX_SAFE_INTEGER;


                    return firstTime -
                        secondTime;

                }
            );

            break;


        case "PRICE_ASC":

            records.sort(
                (
                    first,
                    second
                ) =>
                    (
                        first.startingPrice ??
                        Number
                            .MAX_SAFE_INTEGER
                    ) -
                    (
                        second.startingPrice ??
                        Number
                            .MAX_SAFE_INTEGER
                    )
            );

            break;


        case "PRICE_DESC":

            records.sort(
                (
                    first,
                    second
                ) =>
                    (
                        second.startingPrice ??
                        -1
                    ) -
                    (
                        first.startingPrice ??
                        -1
                    )
            );

            break;


        case "TITLE_ASC":

            records.sort(
                (
                    first,
                    second
                ) =>
                    String(
                        first.title
                    ).localeCompare(
                        String(
                            second.title
                        )
                    )
            );

            break;


        case "POPULAR":
        default:

            /*
               No analytics/popularity collection exists yet.
               Use count of upcoming bookable Shows as the
               deterministic Phase-10 ranking proxy.
            */

            records.sort(
                (
                    first,
                    second
                ) =>
                    second.showCount -
                    first.showCount
                    ||
                    (
                        first.nextShow &&
                        second.nextShow
                            ? new Date(
                                first.nextShow
                                    .startsAt
                            ).getTime() -
                            new Date(
                                second.nextShow
                                    .startsAt
                            ).getTime()
                            : 0
                    )
            );

            break;

    }


    const total =
        records.length;


    const page =
        query.page ||
        1;


    const limit =
        query.limit ||
        100;


    const start =
        (
            page -
            1
        ) *
        limit;


    return {

        events:
            records.slice(
                start,
                start +
                limit
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


async function getCustomerEventById(
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


    const records =
        await buildCustomerEventRecords(
            [
                event
            ]
        );


    return records[0];

}


/* =========================================================
   PHASE 10 - ORGANISER SHOW COUNT

   Manage Events "With Shows" now uses real Show documents
   instead of the old Phase-7 placeholder value.
   ========================================================= */

async function attachOrganiserShowCounts(
    events
) {

    if (!events.length) {

        return [];

    }


    const counts =
        await Show.aggregate([
            {
                $match: {
                    eventId: {
                        $in:
                            events.map(
                                (event) =>
                                    event._id
                            )
                    },

                    status: {
                        $ne:
                            "CANCELLED"
                    }
                }
            },
            {
                $group: {
                    _id:
                        "$eventId",

                    count: {
                        $sum:
                            1
                    }
                }
            }
        ]);


    const countMap =
        new Map(
            counts.map(
                (item) => [
                    String(
                        item._id
                    ),
                    Number(
                        item.count ||
                        0
                    )
                ]
            )
        );


    return events.map(
        (event) => {

            const serialized =
                serializeEvent(
                    event
                );


            serialized.showCount =
                countMap.get(
                    String(
                        event._id
                    )
                ) ||
                0;


            return serialized;

        }
    );

}


module.exports = {

    createEvent,

    getOrganiserEvents,

    getEventById,

    updateEvent,

    deleteEvent,

    serializeEvent,

    requireOwnedEvent,

    getCustomerEvents,

    getCustomerEventById,

    attachOrganiserShowCounts

};
