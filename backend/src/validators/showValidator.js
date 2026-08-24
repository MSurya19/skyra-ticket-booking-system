"use strict";

const mongoose =
    require("mongoose");


/* =========================================================
   SKYRA - SHOW VALIDATOR
   File: backend/src/validators/showValidator.js
   ========================================================= */


const SHOW_STATUSES = [
    "SCHEDULED",
    "COMPLETED",
    "CANCELLED"
];


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
    ).trim();

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


function createValidationResult(
    value,
    errors
) {

    const valid =
        errors.length ===
        0;


    return {

        valid,

        isValid:
            valid,

        value,

        data:
            value,

        sanitizedData:
            value,

        errors

    };

}


function validObjectId(
    value
) {

    return (
        Boolean(
            value
        ) &&
        mongoose.Types.ObjectId
            .isValid(
                value
            )
    );

}


function validDateString(
    value
) {

    if (
        !/^\d{4}-\d{2}-\d{2}$/
            .test(
                value
            )
    ) {

        return false;

    }


    const [
        year,
        month,
        day
    ] =
        value
            .split("-")
            .map(Number);


    const date =
        new Date(
            Date.UTC(
                year,
                month -
                    1,
                day
            )
        );


    return (
        date.getUTCFullYear() ===
            year &&
        date.getUTCMonth() ===
            month -
                1 &&
        date.getUTCDate() ===
            day
    );

}


function validTimeString(
    value
) {

    return /^([01]\d|2[0-3]):[0-5]\d$/
        .test(
            value
        );

}


function sanitizePricing(
    pricing
) {

    if (
        !Array.isArray(
            pricing
        )
    ) {

        return [];

    }


    return pricing.map(
        (item) => ({

            categoryId:
                cleanText(
                    item?.categoryId ||
                    item?.id
                ),

            price:
                Number(
                    item?.price
                )

        })
    );

}


/* =========================================================
   CREATE SHOW
   ========================================================= */

function validateCreateShow(
    payload = {}
) {

    const value = {

        eventId:
            cleanText(
                payload.eventId
            ),

        venueId:
            cleanText(
                payload.venueId
            ),

        date:
            cleanText(
                payload.date
            ),

        time:
            cleanText(
                payload.time
            ),

        entryTime:
            cleanText(
                payload.entryTime
            ) ||
            null,

        bookingCloseMinutes:
            payload.bookingCloseMinutes ===
                "" ||
            payload.bookingCloseMinutes ===
                null ||
            payload.bookingCloseMinutes ===
                undefined
                ? 30
                : Number(
                    payload.bookingCloseMinutes
                ),

        instructions:
            String(
                payload.instructions ||
                ""
            ).trim(),

        pricing:
            sanitizePricing(
                payload.pricing
            )

    };


    const errors = [];


    if (
        !validObjectId(
            value.eventId
        )
    ) {

        addError(
            errors,
            "eventId",
            "Select a valid Event."
        );

    }


    if (
        !validObjectId(
            value.venueId
        )
    ) {

        addError(
            errors,
            "venueId",
            "Select a valid Venue."
        );

    }


    if (
        !validDateString(
            value.date
        )
    ) {

        addError(
            errors,
            "date",
            "Enter a valid show date."
        );

    }


    if (
        !validTimeString(
            value.time
        )
    ) {

        addError(
            errors,
            "time",
            "Enter a valid show start time."
        );

    }


    if (
        value.entryTime &&
        !validTimeString(
            value.entryTime
        )
    ) {

        addError(
            errors,
            "entryTime",
            "Enter a valid entry opening time."
        );

    }


    if (
        value.entryTime &&
        value.time &&
        validTimeString(
            value.entryTime
        ) &&
        validTimeString(
            value.time
        ) &&
        value.entryTime >=
            value.time
    ) {

        addError(
            errors,
            "entryTime",
            "Entry opening time must be before the show start time."
        );

    }


    if (
        !Number.isInteger(
            value.bookingCloseMinutes
        ) ||
        value.bookingCloseMinutes <
            0 ||
        value.bookingCloseMinutes >
            1440
    ) {

        addError(
            errors,
            "bookingCloseMinutes",
            "Booking close time must be between 0 and 1440 minutes."
        );

    }


    if (
        value.instructions.length >
        800
    ) {

        addError(
            errors,
            "instructions",
            "Show instructions cannot exceed 800 characters."
        );

    }


    if (
        !value.pricing.length
    ) {

        addError(
            errors,
            "pricing",
            "Configure ticket pricing for the Venue seat categories."
        );

    }


    const seen =
        new Set();


    value.pricing
        .forEach(
            (
                item,
                index
            ) => {

                if (
                    !validObjectId(
                        item.categoryId
                    )
                ) {

                    addError(
                        errors,
                        `pricing.${index}.categoryId`,
                        "Invalid seat category."
                    );

                }


                if (
                    !Number.isFinite(
                        item.price
                    ) ||
                    item.price <=
                        0 ||
                    item.price >
                        1000000
                ) {

                    addError(
                        errors,
                        `pricing.${index}.price`,
                        "Ticket price must be between 1 and 1000000."
                    );

                }


                if (
                    seen.has(
                        item.categoryId
                    )
                ) {

                    addError(
                        errors,
                        `pricing.${index}.categoryId`,
                        "Duplicate seat category pricing is not allowed."
                    );

                }


                seen.add(
                    item.categoryId
                );

            }
        );


    return createValidationResult(
        value,
        errors
    );

}


/* =========================================================
   UPDATE SHOW

   Same schedule/pricing contract as create.
   Fields are optional.
   ========================================================= */

function validateUpdateShow(
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


    const value = {};


    const errors = [];


    [
        "eventId",
        "venueId",
        "date",
        "time",
        "entryTime",
        "bookingCloseMinutes",
        "instructions",
        "pricing"
    ].forEach(
        (field) => {

            if (
                Object.prototype
                    .hasOwnProperty.call(
                        source,
                        field
                    )
            ) {

                value[
                    field
                ] =
                    source[
                        field
                    ];

            }

        }
    );


    if (
        Object.keys(
            value
        ).length ===
        0
    ) {

        addError(
            errors,
            "body",
            "Provide at least one Show field to update."
        );


        return createValidationResult(
            value,
            errors
        );

    }


    if (
        Object.prototype
            .hasOwnProperty.call(
                value,
                "eventId"
            )
    ) {

        value.eventId =
            cleanText(
                value.eventId
            );


        if (
            !validObjectId(
                value.eventId
            )
        ) {

            addError(
                errors,
                "eventId",
                "Select a valid Event."
            );

        }

    }


    if (
        Object.prototype
            .hasOwnProperty.call(
                value,
                "venueId"
            )
    ) {

        value.venueId =
            cleanText(
                value.venueId
            );


        if (
            !validObjectId(
                value.venueId
            )
        ) {

            addError(
                errors,
                "venueId",
                "Select a valid Venue."
            );

        }

    }


    if (
        Object.prototype
            .hasOwnProperty.call(
                value,
                "date"
            )
    ) {

        value.date =
            cleanText(
                value.date
            );


        if (
            !validDateString(
                value.date
            )
        ) {

            addError(
                errors,
                "date",
                "Enter a valid show date."
            );

        }

    }


    if (
        Object.prototype
            .hasOwnProperty.call(
                value,
                "time"
            )
    ) {

        value.time =
            cleanText(
                value.time
            );


        if (
            !validTimeString(
                value.time
            )
        ) {

            addError(
                errors,
                "time",
                "Enter a valid show start time."
            );

        }

    }


    if (
        Object.prototype
            .hasOwnProperty.call(
                value,
                "entryTime"
            )
    ) {

        value.entryTime =
            cleanText(
                value.entryTime
            ) ||
            null;


        if (
            value.entryTime &&
            !validTimeString(
                value.entryTime
            )
        ) {

            addError(
                errors,
                "entryTime",
                "Enter a valid entry opening time."
            );

        }

    }


    if (
        Object.prototype
            .hasOwnProperty.call(
                value,
                "bookingCloseMinutes"
            )
    ) {

        value.bookingCloseMinutes =
            Number(
                value.bookingCloseMinutes
            );


        if (
            !Number.isInteger(
                value.bookingCloseMinutes
            ) ||
            value.bookingCloseMinutes <
                0 ||
            value.bookingCloseMinutes >
                1440
        ) {

            addError(
                errors,
                "bookingCloseMinutes",
                "Booking close time must be between 0 and 1440 minutes."
            );

        }

    }


    if (
        Object.prototype
            .hasOwnProperty.call(
                value,
                "instructions"
            )
    ) {

        value.instructions =
            String(
                value.instructions ||
                ""
            ).trim();


        if (
            value.instructions.length >
            800
        ) {

            addError(
                errors,
                "instructions",
                "Show instructions cannot exceed 800 characters."
            );

        }

    }


    if (
        Object.prototype
            .hasOwnProperty.call(
                value,
                "pricing"
            )
    ) {

        value.pricing =
            sanitizePricing(
                value.pricing
            );


        if (
            !value.pricing.length
        ) {

            addError(
                errors,
                "pricing",
                "Configure ticket pricing for the Venue seat categories."
            );

        }


        const seen =
            new Set();


        value.pricing
            .forEach(
                (
                    item,
                    index
                ) => {

                    if (
                        !validObjectId(
                            item.categoryId
                        )
                    ) {

                        addError(
                            errors,
                            `pricing.${index}.categoryId`,
                            "Invalid seat category."
                        );

                    }


                    if (
                        !Number.isFinite(
                            item.price
                        ) ||
                        item.price <=
                            0 ||
                        item.price >
                            1000000
                    ) {

                        addError(
                            errors,
                            `pricing.${index}.price`,
                            "Ticket price must be between 1 and 1000000."
                        );

                    }


                    if (
                        seen.has(
                            item.categoryId
                        )
                    ) {

                        addError(
                            errors,
                            `pricing.${index}.categoryId`,
                            "Duplicate seat category pricing is not allowed."
                        );

                    }


                    seen.add(
                        item.categoryId
                    );

                }
            );

    }


    return createValidationResult(
        value,
        errors
    );

}


/* =========================================================
   PARAMS
   ========================================================= */

function validateShowParams(
    params = {}
) {

    const showId =
        cleanText(
            params.showId ||
            params.id
        );


    const errors = [];


    if (
        !validObjectId(
            showId
        )
    ) {

        addError(
            errors,
            "showId",
            "Invalid show ID."
        );

    }


    return createValidationResult(
        {
            showId
        },
        errors
    );

}


function validateVenueParams(
    params = {}
) {

    const venueId =
        cleanText(
            params.venueId ||
            params.id
        );


    const errors = [];


    if (
        !validObjectId(
            venueId
        )
    ) {

        addError(
            errors,
            "venueId",
            "Invalid venue ID."
        );

    }


    return createValidationResult(
        {
            venueId
        },
        errors
    );

}


/* =========================================================
   CANCEL
   ========================================================= */

function validateCancelShow(
    payload = {}
) {

    const value = {

        reason:
            String(
                payload.reason ||
                payload.cancellationReason ||
                ""
            )
                .trim()
                .slice(
                    0,
                    300
                )

    };


    return createValidationResult(
        value,
        []
    );

}


/* =========================================================
   LIST QUERY
   ========================================================= */

function validateShowListQuery(
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

        eventId:
            cleanText(
                query.eventId
            ),

        venueId:
            cleanText(
                query.venueId
            ),

        sort:
            cleanText(
                query.sort ||
                "DATE_ASC"
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
        !SHOW_STATUSES.includes(
            value.status
        )
    ) {

        addError(
            errors,
            "status",
            "Invalid show status filter."
        );

    }


    if (
        value.eventId &&
        !validObjectId(
            value.eventId
        )
    ) {

        addError(
            errors,
            "eventId",
            "Invalid Event filter."
        );

    }


    if (
        value.venueId &&
        !validObjectId(
            value.venueId
        )
    ) {

        addError(
            errors,
            "venueId",
            "Invalid Venue filter."
        );

    }


    if (
        ![
            "DATE_ASC",
            "DATE_DESC",
            "CREATED_DESC",
            "CREATED_ASC"
        ].includes(
            value.sort
        )
    ) {

        addError(
            errors,
            "sort",
            "Invalid show sort option."
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

    SHOW_STATUSES,

    validateCreateShow,

    validateUpdateShow,

    validateShowParams,

    validateVenueParams,

    validateCancelShow,

    validateShowListQuery

};
