"use strict";

const mongoose =
    require("mongoose");


/* =========================================================
   SKYRA - EVENT VALIDATOR
   File: backend/src/validators/eventValidator.js

   Matches the current Organiser Event frontend contract.
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


const EVENT_FIELDS = [
    "title",
    "type",
    "genre",
    "language",
    "duration",
    "ageRating",
    "description",
    "performers",
    "creator",
    "tags",
    "posterUrl",
    "bannerUrl",
    "posterFileName",
    "bannerFileName",
    "status"
];


/* =========================================================
   BASIC HELPERS
   ========================================================= */

function cleanText(
    value
) {

    if (
        value ===
            undefined ||
        value ===
            null
    ) {

        return "";

    }


    return String(
        value
    )
        .trim()
        .replace(
            /\s+/g,
            " "
        );

}


function cleanMultilineText(
    value
) {

    if (
        value ===
            undefined ||
        value ===
            null
    ) {

        return "";

    }


    return String(
        value
    ).trim();

}


function createValidationResult(
    value,
    errors
) {

    const valid =
        errors.length === 0;


    return {

        valid,

        isValid:
            valid,

        errors,

        value,

        data:
            value,

        sanitizedData:
            value

    };

}


function addError(
    errors,
    field,
    message
) {

    errors.push({

        field,

        message

    });

}


function normalizeStringArray(
    value,
    maxItems,
    maxLength
) {

    const source =
        Array.isArray(
            value
        )
            ? value
            : (
                typeof value ===
                    "string"
                    ? value.split(",")
                    : []
            );


    const seen =
        new Set();


    return source
        .map(
            (item) =>
                cleanText(
                    item
                )
        )
        .filter(Boolean)
        .filter(
            (item) => {

                const key =
                    item.toLowerCase();


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
            (item) =>
                item.slice(
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
   SANITIZE
   ========================================================= */

function sanitizeEventPayload(
    payload = {}
) {

    const source =
        payload &&
        typeof payload ===
            "object" &&
        !Array.isArray(
            payload
        )
            ? payload
            : {};


    const event = {};


    EVENT_FIELDS.forEach(
        (field) => {

            if (
                Object.prototype
                    .hasOwnProperty.call(
                        source,
                        field
                    )
            ) {

                event[
                    field
                ] =
                    source[
                        field
                    ];

            }

        }
    );


    if (
        Object.prototype
            .hasOwnProperty.call(
                event,
                "title"
            )
    ) {

        event.title =
            cleanText(
                event.title
            );

    }


    if (
        Object.prototype
            .hasOwnProperty.call(
                event,
                "type"
            )
    ) {

        event.type =
            cleanText(
                event.type
            )
                .toUpperCase();

    }


    if (
        Object.prototype
            .hasOwnProperty.call(
                event,
                "genre"
            )
    ) {

        event.genre =
            cleanText(
                event.genre
            );

    }


    if (
        Object.prototype
            .hasOwnProperty.call(
                event,
                "language"
            )
    ) {

        event.language =
            cleanText(
                event.language
            );

    }


    if (
        Object.prototype
            .hasOwnProperty.call(
                event,
                "duration"
            )
    ) {

        if (
            event.duration ===
                "" ||
            event.duration ===
                null ||
            event.duration ===
                undefined
        ) {

            event.duration =
                null;

        } else {

            event.duration =
                Number(
                    event.duration
                );

        }

    }


    if (
        Object.prototype
            .hasOwnProperty.call(
                event,
                "ageRating"
            )
    ) {

        event.ageRating =
            cleanText(
                event.ageRating
            )
                .toUpperCase();

    }


    if (
        Object.prototype
            .hasOwnProperty.call(
                event,
                "description"
            )
    ) {

        event.description =
            cleanMultilineText(
                event.description
            );

    }


    if (
        Object.prototype
            .hasOwnProperty.call(
                event,
                "performers"
            )
    ) {

        event.performers =
            normalizeStringArray(
                event.performers,
                20,
                100
            );

    }


    if (
        Object.prototype
            .hasOwnProperty.call(
                event,
                "creator"
            )
    ) {

        event.creator =
            cleanText(
                event.creator
            );

    }


    if (
        Object.prototype
            .hasOwnProperty.call(
                event,
                "tags"
            )
    ) {

        event.tags =
            normalizeStringArray(
                event.tags,
                25,
                60
            );

    }


    [
        "posterUrl",
        "bannerUrl",
        "posterFileName",
        "bannerFileName"
    ].forEach(
        (field) => {

            if (
                Object.prototype
                    .hasOwnProperty.call(
                        event,
                        field
                    )
            ) {

                event[
                    field
                ] =
                    cleanText(
                        event[
                            field
                        ]
                    );

            }

        }
    );


    if (
        Object.prototype
            .hasOwnProperty.call(
                event,
                "status"
            )
    ) {

        event.status =
            cleanText(
                event.status
            )
                .toUpperCase();

    }


    return event;

}


/* =========================================================
   FIELD VALIDATION
   ========================================================= */

function validateEventFields(
    event,
    {
        partial =
            false
    } = {}
) {

    const errors = [];


    const required =
        (
            field
        ) =>
            !partial ||
            Object.prototype
                .hasOwnProperty.call(
                    event,
                    field
                );


    if (
        required(
            "title"
        )
    ) {

        if (
            !event.title ||
            event.title.length <
                3
        ) {

            addError(
                errors,
                "title",
                "Event title must contain at least 3 characters."
            );

        } else if (
            event.title.length >
            120
        ) {

            addError(
                errors,
                "title",
                "Event title cannot exceed 120 characters."
            );

        }

    }


    if (
        required(
            "type"
        )
    ) {

        if (
            !EVENT_TYPES.includes(
                event.type
            )
        ) {

            addError(
                errors,
                "type",
                "Invalid event type."
            );

        }

    }


    if (
        required(
            "genre"
        )
    ) {

        if (!event.genre) {

            addError(
                errors,
                "genre",
                "Event genre/category is required."
            );

        } else if (
            event.genre.length >
            60
        ) {

            addError(
                errors,
                "genre",
                "Event genre/category cannot exceed 60 characters."
            );

        }

    }


    if (
        Object.prototype
            .hasOwnProperty.call(
                event,
                "language"
            ) &&
        event.language.length >
            60
    ) {

        addError(
            errors,
            "language",
            "Event language cannot exceed 60 characters."
        );

    }


    if (
        Object.prototype
            .hasOwnProperty.call(
                event,
                "duration"
            ) &&
        event.duration !==
            null
    ) {

        if (
            !Number.isInteger(
                event.duration
            ) ||
            event.duration <
                1 ||
            event.duration >
                1000
        ) {

            addError(
                errors,
                "duration",
                "Duration must be an integer between 1 and 1000 minutes."
            );

        }

    }


    if (
        Object.prototype
            .hasOwnProperty.call(
                event,
                "ageRating"
            ) &&
        !AGE_RATINGS.includes(
            event.ageRating
        )
    ) {

        addError(
            errors,
            "ageRating",
            "Invalid age rating."
        );

    }


    if (
        required(
            "description"
        )
    ) {

        if (
            !event.description ||
            event.description.length <
                20
        ) {

            addError(
                errors,
                "description",
                "Event description must contain at least 20 characters."
            );

        } else if (
            event.description.length >
            1500
        ) {

            addError(
                errors,
                "description",
                "Event description cannot exceed 1500 characters."
            );

        }

    }


    if (
        Object.prototype
            .hasOwnProperty.call(
                event,
                "creator"
            ) &&
        event.creator.length >
            120
    ) {

        addError(
            errors,
            "creator",
            "Director/host/presenter cannot exceed 120 characters."
        );

    }


    if (
        Object.prototype
            .hasOwnProperty.call(
                event,
                "posterUrl"
            ) &&
        event.posterUrl.length >
            2000
    ) {

        addError(
            errors,
            "posterUrl",
            "Poster URL is too long."
        );

    }


    if (
        Object.prototype
            .hasOwnProperty.call(
                event,
                "bannerUrl"
            ) &&
        event.bannerUrl.length >
            2000
    ) {

        addError(
            errors,
            "bannerUrl",
            "Banner URL is too long."
        );

    }


    if (
        Object.prototype
            .hasOwnProperty.call(
                event,
                "posterFileName"
            ) &&
        event.posterFileName.length >
            255
    ) {

        addError(
            errors,
            "posterFileName",
            "Poster filename is too long."
        );

    }


    if (
        Object.prototype
            .hasOwnProperty.call(
                event,
                "bannerFileName"
            ) &&
        event.bannerFileName.length >
            255
    ) {

        addError(
            errors,
            "bannerFileName",
            "Banner filename is too long."
        );

    }


    if (
        required(
            "status"
        )
    ) {

        if (
            !EVENT_STATUSES.includes(
                event.status
            )
        ) {

            addError(
                errors,
                "status",
                "Invalid event status."
            );

        }

    }


    return errors;

}


/* =========================================================
   CREATE
   ========================================================= */

function validateCreateEvent(
    payload = {}
) {

    const event =
        sanitizeEventPayload(
            payload
        );


    if (
        !Object.prototype
            .hasOwnProperty.call(
                event,
                "language"
            )
    ) {

        event.language =
            "";

    }


    if (
        !Object.prototype
            .hasOwnProperty.call(
                event,
                "duration"
            )
    ) {

        event.duration =
            null;

    }


    if (
        !Object.prototype
            .hasOwnProperty.call(
                event,
                "ageRating"
            )
    ) {

        event.ageRating =
            "";

    }


    if (
        !Object.prototype
            .hasOwnProperty.call(
                event,
                "performers"
            )
    ) {

        event.performers =
            [];

    }


    if (
        !Object.prototype
            .hasOwnProperty.call(
                event,
                "creator"
            )
    ) {

        event.creator =
            "";

    }


    if (
        !Object.prototype
            .hasOwnProperty.call(
                event,
                "tags"
            )
    ) {

        event.tags =
            [];

    }


    if (
        !Object.prototype
            .hasOwnProperty.call(
                event,
                "posterUrl"
            )
    ) {

        event.posterUrl =
            "";

    }


    if (
        !Object.prototype
            .hasOwnProperty.call(
                event,
                "bannerUrl"
            )
    ) {

        event.bannerUrl =
            "";

    }


    if (
        !Object.prototype
            .hasOwnProperty.call(
                event,
                "posterFileName"
            )
    ) {

        event.posterFileName =
            "";

    }


    if (
        !Object.prototype
            .hasOwnProperty.call(
                event,
                "bannerFileName"
            )
    ) {

        event.bannerFileName =
            "";

    }


    if (!event.status) {

        event.status =
            "PUBLISHED";

    }


    const errors =
        validateEventFields(
            event,
            {
                partial:
                    false
            }
        );


    return createValidationResult(
        event,
        errors
    );

}


/* =========================================================
   UPDATE
   ========================================================= */

function validateUpdateEvent(
    payload = {}
) {

    const event =
        sanitizeEventPayload(
            payload
        );


    const errors = [];


    if (
        Object.keys(
            event
        ).length ===
        0
    ) {

        addError(
            errors,
            "body",
            "Provide at least one event field to update."
        );


        return createValidationResult(
            event,
            errors
        );

    }


    errors.push(
        ...validateEventFields(
            event,
            {
                partial:
                    true
            }
        )
    );


    return createValidationResult(
        event,
        errors
    );

}


/* =========================================================
   PARAMS
   ========================================================= */

function validateEventParams(
    params = {}
) {

    const eventId =
        cleanText(
            params.eventId ||
            params.id
        );


    const errors = [];


    if (!eventId) {

        addError(
            errors,
            "eventId",
            "Event ID is required."
        );

    } else if (
        !mongoose.Types.ObjectId
            .isValid(
                eventId
            )
    ) {

        addError(
            errors,
            "eventId",
            "Invalid event ID."
        );

    }


    return createValidationResult(
        {
            eventId
        },
        errors
    );

}


/* =========================================================
   LIST QUERY
   ========================================================= */

function validateEventListQuery(
    query = {}
) {

    const value = {

        search:
            cleanText(
                query.search
            ),

        status:
            cleanText(
                query.status
            )
                .toUpperCase(),

        type:
            cleanText(
                query.type
            )
                .toUpperCase(),

        sort:
            cleanText(
                query.sort ||
                "NEWEST"
            )
                .toUpperCase(),

        page:
            Number(
                query.page ||
                1
            ),

        limit:
            Number(
                query.limit ||
                100
            )

    };


    const errors = [];


    if (
        value.status &&
        value.status !==
            "ALL" &&
        !EVENT_STATUSES.includes(
            value.status
        )
    ) {

        addError(
            errors,
            "status",
            "Invalid event status filter."
        );

    }


    if (
        value.type &&
        value.type !==
            "ALL" &&
        !EVENT_TYPES.includes(
            value.type
        )
    ) {

        addError(
            errors,
            "type",
            "Invalid event type filter."
        );

    }


    if (
        ![
            "NEWEST",
            "OLDEST",
            "TITLE_ASC",
            "TITLE_DESC"
        ].includes(
            value.sort
        )
    ) {

        addError(
            errors,
            "sort",
            "Invalid event sort option."
        );

    }


    if (
        !Number.isInteger(
            value.page
        ) ||
        value.page <
            1
    ) {

        addError(
            errors,
            "page",
            "Page must be a positive integer."
        );

    }


    if (
        !Number.isInteger(
            value.limit
        ) ||
        value.limit <
            1 ||
        value.limit >
            100
    ) {

        addError(
            errors,
            "limit",
            "Limit must be between 1 and 100."
        );

    }


    return createValidationResult(
        value,
        errors
    );

}



/* =========================================================
   PHASE 10 - CUSTOMER EVENT LIST QUERY

   Public/customer discovery filters used by:
   - frontend/index.html
   - customer/dashboard.html
   - customer/events.html

   Status is intentionally NOT client-selectable.
   Customer APIs always expose PUBLISHED, non-deleted Events.
   ========================================================= */

function validateCustomerEventListQuery(
    query = {}
) {

    const value = {

        search:
            cleanText(
                query.search
            ),

        type:
            cleanText(
                query.type
            )
                .toUpperCase(),

        city:
            cleanText(
                query.city
            ),

        language:
            cleanText(
                query.language
            ),

        date:
            cleanText(
                query.date ||
                "ALL"
            )
                .toUpperCase(),

        sort:
            cleanText(
                query.sort ||
                "POPULAR"
            )
                .toUpperCase(),

        page:
            Number(
                query.page ||
                1
            ),

        limit:
            Number(
                query.limit ||
                100
            )

    };


    const errors = [];


    /*
       EVENT is retained as a generic frontend tab alias.
       The persisted Event model itself uses:
       MOVIE / CONCERT / LIVE_SHOW.
    */
    if (
        value.type &&
        value.type !==
            "ALL" &&
        value.type !==
            "EVENT" &&
        !EVENT_TYPES.includes(
            value.type
        )
    ) {

        addError(
            errors,
            "type",
            "Invalid event type filter."
        );

    }


    if (
        ![
            "ALL",
            "TODAY",
            "THIS_WEEK",
            "THIS_MONTH",
            "UPCOMING"
        ].includes(
            value.date
        )
    ) {

        addError(
            errors,
            "date",
            "Invalid event date filter."
        );

    }


    if (
        ![
            "POPULAR",
            "DATE_ASC",
            "PRICE_ASC",
            "PRICE_DESC",
            "TITLE_ASC"
        ].includes(
            value.sort
        )
    ) {

        addError(
            errors,
            "sort",
            "Invalid event sort option."
        );

    }


    if (
        !Number.isInteger(
            value.page
        ) ||
        value.page <
            1
    ) {

        addError(
            errors,
            "page",
            "Page must be a positive integer."
        );

    }


    if (
        !Number.isInteger(
            value.limit
        ) ||
        value.limit <
            1 ||
        value.limit >
            100
    ) {

        addError(
            errors,
            "limit",
            "Limit must be between 1 and 100."
        );

    }


    return createValidationResult(
        value,
        errors
    );

}


module.exports = {

    EVENT_TYPES,

    EVENT_STATUSES,

    AGE_RATINGS,

    EVENT_FIELDS,

    sanitizeEventPayload,

    validateCreateEvent,

    validateUpdateEvent,

    validateEventParams,

    validateEventListQuery,

    validateCustomerEventListQuery

};
