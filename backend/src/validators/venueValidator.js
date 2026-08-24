"use strict";

const mongoose =
    require("mongoose");


/* =========================================================
   SKYRA - VENUE VALIDATOR
   File: backend/src/validators/venueValidator.js

   Phase 4:
   - Validate venue creation
   - Validate venue updates
   - Validate venue MongoDB IDs
   - Validate venue-list query parameters

   Phase 5:
   - Validate seat-category creation
   - Validate seat-category updates
   - Validate category MongoDB IDs
   - Sanitize category payloads

   Phase 6:
   - Validate complete physical Seat Layout payloads
   - Normalize row / number / label values
   - Validate embedded category IDs used by seats
   - Reject duplicate physical seats inside one layout
   - Allow an empty array to intentionally clear a layout

   Important:
   - capacity cannot be changed through venue metadata APIs
   - seatCategories cannot be changed through venue metadata APIs
   - layoutConfigured cannot be changed through venue metadata APIs
   - category capacity cannot be changed through category metadata APIs

   Capacity is controlled by physical Seat records in Phase 6.
   ========================================================= */


/* =========================================================
   1. ALLOWED VALUES
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
   2. ALLOWED VENUE METADATA FIELDS
   ========================================================= */

const VENUE_METADATA_FIELDS = [
    "name",
    "type",
    "status",
    "description",
    "address",
    "city",
    "state",
    "country",
    "postalCode"
];


/* =========================================================
   3. ALLOWED SEAT CATEGORY METADATA FIELDS

   capacity is deliberately excluded.

   Phase 6 Seat Layout will calculate category capacity
   from physical Seat records.
   ========================================================= */

const SEAT_CATEGORY_METADATA_FIELDS = [
    "name",
    "code",
    "status",
    "description"
];


/* =========================================================
   PHASE 6 - PHYSICAL SEAT FIELDS

   The client may send additional values such as:

   id
   venueId

   Those are deliberately NOT trusted here.

   venueId comes from the authenticated route parameter and
   MongoDB _id values are controlled by the backend.
   ========================================================= */

const PHYSICAL_SEAT_FIELDS = [
    "row",
    "number",
    "label",
    "categoryId",
    "active"
];


/*
   Safety limit for one browser-managed physical layout.

   The current Seat Layout UI can generate large batches, but
   SKYRA should reject unexpectedly massive request bodies.
*/
const MAX_PHYSICAL_SEATS_PER_LAYOUT =
    5000;


/* =========================================================
   4. BASIC STRING HELPERS
   ========================================================= */

function cleanText(
    value
) {

    if (
        value === undefined ||
        value === null
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
        value === undefined ||
        value === null
    ) {

        return "";

    }


    return String(
        value
    )
        .trim();

}


/* =========================================================
   5. NORMALIZE VENUE ENUM VALUES
   ========================================================= */

function normalizeVenueType(
    value
) {

    return cleanText(
        value
    )
        .toUpperCase();

}


function normalizeVenueStatus(
    value
) {

    return cleanText(
        value
    )
        .toUpperCase();

}


/* =========================================================
   6. NORMALIZE SEAT CATEGORY VALUES
   ========================================================= */

function normalizeSeatCategoryStatus(
    value
) {

    return cleanText(
        value
    )
        .toUpperCase();

}


function normalizeSeatCategoryCode(
    value
) {

    return cleanText(
        value
    )
        .toUpperCase();

}


/* =========================================================
   PHASE 6 - NORMALIZE PHYSICAL SEAT ROW
   ========================================================= */

function normalizePhysicalSeatRow(
    value
) {

    return cleanText(
        value
    )
        .toUpperCase();

}


/* =========================================================
   7. CREATE VALIDATION RESULT

   validationMiddleware.js can consume these aliases:

   {
       valid,
       isValid,
       errors,
       value,
       data,
       sanitizedData
   }
   ========================================================= */

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


/* =========================================================
   8. ADD FIELD ERROR
   ========================================================= */

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


/* =========================================================
   9. SANITIZE VENUE PAYLOAD

   Only approved Venue metadata fields are copied.

   These are deliberately ignored:

   {
       capacity,
       seatCategories,
       layoutConfigured,
       deleted,
       deletedAt
   }
   ========================================================= */

function sanitizeVenuePayload(
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


    const sanitized = {};


    if (
        Object.prototype
            .hasOwnProperty.call(
                source,
                "name"
            )
    ) {

        sanitized.name =
            cleanText(
                source.name
            );

    }


    if (
        Object.prototype
            .hasOwnProperty.call(
                source,
                "type"
            )
    ) {

        sanitized.type =
            normalizeVenueType(
                source.type
            );

    }


    if (
        Object.prototype
            .hasOwnProperty.call(
                source,
                "status"
            )
    ) {

        sanitized.status =
            normalizeVenueStatus(
                source.status
            );

    }


    if (
        Object.prototype
            .hasOwnProperty.call(
                source,
                "description"
            )
    ) {

        sanitized.description =
            cleanMultilineText(
                source.description
            );

    }


    if (
        Object.prototype
            .hasOwnProperty.call(
                source,
                "address"
            )
    ) {

        sanitized.address =
            cleanText(
                source.address
            );

    }


    if (
        Object.prototype
            .hasOwnProperty.call(
                source,
                "city"
            )
    ) {

        sanitized.city =
            cleanText(
                source.city
            );

    }


    if (
        Object.prototype
            .hasOwnProperty.call(
                source,
                "state"
            )
    ) {

        sanitized.state =
            cleanText(
                source.state
            );

    }


    if (
        Object.prototype
            .hasOwnProperty.call(
                source,
                "country"
            )
    ) {

        sanitized.country =
            cleanText(
                source.country
            );

    }


    if (
        Object.prototype
            .hasOwnProperty.call(
                source,
                "postalCode"
            )
    ) {

        sanitized.postalCode =
            cleanText(
                source.postalCode
            );

    }


    return sanitized;

}


/* =========================================================
   10. SANITIZE SEAT CATEGORY PAYLOAD

   Allowed:

   {
       name,
       code,
       status,
       description
   }

   Deliberately ignored:

   {
       _id,
       id,
       capacity,
       createdAt,
       updatedAt
   }
   ========================================================= */

function sanitizeSeatCategoryPayload(
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


    const sanitized = {};


    if (
        Object.prototype
            .hasOwnProperty.call(
                source,
                "name"
            )
    ) {

        sanitized.name =
            cleanText(
                source.name
            );

    }


    if (
        Object.prototype
            .hasOwnProperty.call(
                source,
                "code"
            )
    ) {

        sanitized.code =
            normalizeSeatCategoryCode(
                source.code
            );

    }


    if (
        Object.prototype
            .hasOwnProperty.call(
                source,
                "status"
            )
    ) {

        sanitized.status =
            normalizeSeatCategoryStatus(
                source.status
            );

    }


    if (
        Object.prototype
            .hasOwnProperty.call(
                source,
                "description"
            )
    ) {

        sanitized.description =
            cleanMultilineText(
                source.description
            );

    }


    return sanitized;

}


/* =========================================================
   PHASE 6 - SANITIZE PHYSICAL SEAT LAYOUT PAYLOAD

   Accepted request shapes:

   [
       {
           row: "A",
           number: 1,
           label: "A1",
           categoryId: "...",
           active: true
       }
   ]

   or:

   {
       seats: [...]
   }

   Important security rules:

   - client seat id is ignored
   - client venueId is ignored
   - label is derived from row + number
   - route venueId remains authoritative
   ========================================================= */

function sanitizeSeatLayoutPayload(
    payload = []
) {

    let source = null;


    if (
        Array.isArray(
            payload
        )
    ) {

        source =
            payload;

    } else if (
        payload &&
        typeof payload ===
            "object" &&
        Array.isArray(
            payload.seats
        )
    ) {

        source =
            payload.seats;

    }


    if (!source) {

        return null;

    }


    return source.map(
        (
            rawSeat
        ) => {

            const sourceSeat =
                rawSeat &&
                typeof rawSeat ===
                    "object" &&
                !Array.isArray(
                    rawSeat
                )
                    ? rawSeat
                    : {};


            const row =
                normalizePhysicalSeatRow(
                    sourceSeat.row
                );


            const number =
                sourceSeat.number ===
                    undefined ||
                sourceSeat.number ===
                    null ||
                sourceSeat.number ===
                    ""
                    ? NaN
                    : Number(
                        sourceSeat.number
                    );


            const categoryId =
                cleanText(
                    sourceSeat.categoryId
                );


            const active =
                Object.prototype
                    .hasOwnProperty.call(
                        sourceSeat,
                        "active"
                    )
                    ? sourceSeat.active
                    : true;


            const label =
                row &&
                Number.isInteger(
                    number
                )
                    ? `${row}${number}`
                    : cleanText(
                        sourceSeat.label
                    )
                        .toUpperCase();


            return {

                row,

                number,

                label,

                categoryId,

                active

            };

        }
    );

}


/* =========================================================
   11. COMMON VENUE FIELD VALIDATION
   ========================================================= */

function validateVenueFields(
    venue,
    {
        partial = false
    } = {}
) {

    const errors = [];


    /* ---------------------------------------------------------
       NAME
       --------------------------------------------------------- */

    if (
        !partial ||
        Object.prototype
            .hasOwnProperty.call(
                venue,
                "name"
            )
    ) {

        if (!venue.name) {

            addError(
                errors,
                "name",
                "Venue name is required."
            );

        } else if (
            venue.name.length <
            3
        ) {

            addError(
                errors,
                "name",
                "Venue name must contain at least 3 characters."
            );

        } else if (
            venue.name.length >
            100
        ) {

            addError(
                errors,
                "name",
                "Venue name cannot exceed 100 characters."
            );

        }

    }


    /* ---------------------------------------------------------
       TYPE
       --------------------------------------------------------- */

    if (
        !partial ||
        Object.prototype
            .hasOwnProperty.call(
                venue,
                "type"
            )
    ) {

        if (!venue.type) {

            addError(
                errors,
                "type",
                "Please select a venue type."
            );

        } else if (
            !VENUE_TYPES.includes(
                venue.type
            )
        ) {

            addError(
                errors,
                "type",
                "Invalid venue type."
            );

        }

    }


    /* ---------------------------------------------------------
       STATUS
       --------------------------------------------------------- */

    if (
        !partial ||
        Object.prototype
            .hasOwnProperty.call(
                venue,
                "status"
            )
    ) {

        if (!venue.status) {

            addError(
                errors,
                "status",
                "Venue status is required."
            );

        } else if (
            !VENUE_STATUSES.includes(
                venue.status
            )
        ) {

            addError(
                errors,
                "status",
                "Venue status must be ACTIVE or INACTIVE."
            );

        }

    }


    /* ---------------------------------------------------------
       DESCRIPTION
       --------------------------------------------------------- */

    if (
        Object.prototype
            .hasOwnProperty.call(
                venue,
                "description"
            ) &&
        venue.description.length >
            500
    ) {

        addError(
            errors,
            "description",
            "Venue description cannot exceed 500 characters."
        );

    }


    /* ---------------------------------------------------------
       ADDRESS
       --------------------------------------------------------- */

    if (
        !partial ||
        Object.prototype
            .hasOwnProperty.call(
                venue,
                "address"
            )
    ) {

        if (!venue.address) {

            addError(
                errors,
                "address",
                "Venue address is required."
            );

        } else if (
            venue.address.length <
            4
        ) {

            addError(
                errors,
                "address",
                "Please enter a valid venue address."
            );

        } else if (
            venue.address.length >
            180
        ) {

            addError(
                errors,
                "address",
                "Venue address cannot exceed 180 characters."
            );

        }

    }


    /* ---------------------------------------------------------
       CITY
       --------------------------------------------------------- */

    if (
        !partial ||
        Object.prototype
            .hasOwnProperty.call(
                venue,
                "city"
            )
    ) {

        if (!venue.city) {

            addError(
                errors,
                "city",
                "City is required."
            );

        } else if (
            venue.city.length >
            80
        ) {

            addError(
                errors,
                "city",
                "City cannot exceed 80 characters."
            );

        }

    }


    /* ---------------------------------------------------------
       STATE / REGION
       --------------------------------------------------------- */

    if (
        !partial ||
        Object.prototype
            .hasOwnProperty.call(
                venue,
                "state"
            )
    ) {

        if (!venue.state) {

            addError(
                errors,
                "state",
                "State or region is required."
            );

        } else if (
            venue.state.length >
            80
        ) {

            addError(
                errors,
                "state",
                "State or region cannot exceed 80 characters."
            );

        }

    }


    /* ---------------------------------------------------------
       COUNTRY
       --------------------------------------------------------- */

    if (
        !partial ||
        Object.prototype
            .hasOwnProperty.call(
                venue,
                "country"
            )
    ) {

        if (!venue.country) {

            addError(
                errors,
                "country",
                "Country is required."
            );

        } else if (
            venue.country.length >
            80
        ) {

            addError(
                errors,
                "country",
                "Country cannot exceed 80 characters."
            );

        }

    }


    /* ---------------------------------------------------------
       POSTAL / PIN CODE
       --------------------------------------------------------- */

    if (
        !partial ||
        Object.prototype
            .hasOwnProperty.call(
                venue,
                "postalCode"
            )
    ) {

        if (!venue.postalCode) {

            addError(
                errors,
                "postalCode",
                "Postal or PIN code is required."
            );

        } else if (
            venue.postalCode.length >
            12
        ) {

            addError(
                errors,
                "postalCode",
                "Postal or PIN code cannot exceed 12 characters."
            );

        } else {

            /*
               Match SKYRA frontend:

               India PIN:
               - exactly 6 digits
               - first digit cannot be zero
            */

            const country =
                cleanText(
                    venue.country
                )
                    .toLowerCase();


            if (
                country ===
                    "india" &&
                !/^[1-9][0-9]{5}$/
                    .test(
                        venue.postalCode
                    )
            ) {

                addError(
                    errors,
                    "postalCode",
                    "Enter a valid 6-digit Indian PIN code."
                );

            }

        }

    }


    return errors;

}


/* =========================================================
   12. COMMON SEAT CATEGORY FIELD VALIDATION

   Frontend contract:

   name:
       2 - 40 characters

   code:
       2 - 30 characters
       A-Z, 0-9, underscore only

   status:
       ACTIVE | INACTIVE

   description:
       optional
       maximum 180
   ========================================================= */

function validateSeatCategoryFields(
    category,
    {
        partial = false
    } = {}
) {

    const errors = [];


    /* ---------------------------------------------------------
       NAME
       --------------------------------------------------------- */

    if (
        !partial ||
        Object.prototype
            .hasOwnProperty.call(
                category,
                "name"
            )
    ) {

        if (!category.name) {

            addError(
                errors,
                "name",
                "Category name is required."
            );

        } else if (
            category.name.length <
            2
        ) {

            addError(
                errors,
                "name",
                "Category name must contain at least 2 characters."
            );

        } else if (
            category.name.length >
            40
        ) {

            addError(
                errors,
                "name",
                "Category name cannot exceed 40 characters."
            );

        }

    }


    /* ---------------------------------------------------------
       CODE
       --------------------------------------------------------- */

    if (
        !partial ||
        Object.prototype
            .hasOwnProperty.call(
                category,
                "code"
            )
    ) {

        if (!category.code) {

            addError(
                errors,
                "code",
                "Category code is required."
            );

        } else if (
            category.code.length <
            2
        ) {

            addError(
                errors,
                "code",
                "Category code must contain at least 2 characters."
            );

        } else if (
            category.code.length >
            30
        ) {

            addError(
                errors,
                "code",
                "Category code cannot exceed 30 characters."
            );

        } else if (
            !/^[A-Z0-9_]{2,30}$/
                .test(
                    category.code
                )
        ) {

            addError(
                errors,
                "code",
                "Use only uppercase letters, numbers and underscores."
            );

        }

    }


    /* ---------------------------------------------------------
       STATUS
       --------------------------------------------------------- */

    if (
        !partial ||
        Object.prototype
            .hasOwnProperty.call(
                category,
                "status"
            )
    ) {

        if (!category.status) {

            addError(
                errors,
                "status",
                "Category status is required."
            );

        } else if (
            !SEAT_CATEGORY_STATUSES
                .includes(
                    category.status
                )
        ) {

            addError(
                errors,
                "status",
                "Category status must be ACTIVE or INACTIVE."
            );

        }

    }


    /* ---------------------------------------------------------
       DESCRIPTION
       --------------------------------------------------------- */

    if (
        Object.prototype
            .hasOwnProperty.call(
                category,
                "description"
            ) &&
        category.description.length >
            180
    ) {

        addError(
            errors,
            "description",
            "Category description cannot exceed 180 characters."
        );

    }


    return errors;

}


/* =========================================================
   13. CREATE VENUE VALIDATOR

   POST /api/admin/venues
   ========================================================= */

function validateCreateVenue(
    payload = {}
) {

    const venue =
        sanitizeVenuePayload(
            payload
        );


    if (
        !Object.prototype
            .hasOwnProperty.call(
                venue,
                "description"
            )
    ) {

        venue.description =
            "";

    }


    if (!venue.country) {

        venue.country =
            "India";

    }


    if (!venue.status) {

        venue.status =
            "ACTIVE";

    }


    const errors =
        validateVenueFields(
            venue,
            {
                partial:
                    false
            }
        );


    return createValidationResult(
        venue,
        errors
    );

}


/* =========================================================
   14. UPDATE VENUE VALIDATOR

   PATCH /api/admin/venues/:venueId
   ========================================================= */

function validateUpdateVenue(
    payload = {}
) {

    const venue =
        sanitizeVenuePayload(
            payload
        );


    const errors = [];


    const suppliedFields =
        Object.keys(
            venue
        );


    if (
        suppliedFields.length ===
        0
    ) {

        addError(
            errors,
            "body",
            "Provide at least one venue field to update."
        );


        return createValidationResult(
            venue,
            errors
        );

    }


    const fieldErrors =
        validateVenueFields(
            venue,
            {
                partial:
                    true
            }
        );


    errors.push(
        ...fieldErrors
    );


    return createValidationResult(
        venue,
        errors
    );

}


/* =========================================================
   15. CREATE SEAT CATEGORY VALIDATOR

   POST
   /api/admin/venues/:venueId/categories
   ========================================================= */

function validateCreateSeatCategory(
    payload = {}
) {

    const category =
        sanitizeSeatCategoryPayload(
            payload
        );


    /*
       Description is optional.
    */

    if (
        !Object.prototype
            .hasOwnProperty.call(
                category,
                "description"
            )
    ) {

        category.description =
            "";

    }


    /*
       New categories default ACTIVE.
    */

    if (!category.status) {

        category.status =
            "ACTIVE";

    }


    const errors =
        validateSeatCategoryFields(
            category,
            {
                partial:
                    false
            }
        );


    return createValidationResult(
        category,
        errors
    );

}


/* =========================================================
   16. UPDATE SEAT CATEGORY VALIDATOR

   PATCH
   /api/admin/venues/:venueId/categories/:categoryId
   ========================================================= */

function validateUpdateSeatCategory(
    payload = {}
) {

    const category =
        sanitizeSeatCategoryPayload(
            payload
        );


    const errors = [];


    const suppliedFields =
        Object.keys(
            category
        );


    if (
        suppliedFields.length ===
        0
    ) {

        addError(
            errors,
            "body",
            "Provide at least one seat category field to update."
        );


        return createValidationResult(
            category,
            errors
        );

    }


    const fieldErrors =
        validateSeatCategoryFields(
            category,
            {
                partial:
                    true
            }
        );


    errors.push(
        ...fieldErrors
    );


    return createValidationResult(
        category,
        errors
    );

}


/* =========================================================
   PHASE 6 - VALIDATE COMPLETE PHYSICAL SEAT LAYOUT

   Used by:

   PUT
   /api/admin/venues/:venueId/seat-layout

   Rules:
   - body must be an array or { seats: [...] }
   - [] is valid and means "clear layout"
   - row: A-Z, 1 to 3 letters
   - number: integer, 1 to 999
   - label is derived from row + number
   - categoryId must be a valid MongoDB ObjectId
   - active must be Boolean
   - duplicate row + number values are rejected

   Category ownership is checked in venueService.js because
   only the service can compare categoryId values against the
   selected Venue document.
   ========================================================= */

function validateSeatLayout(
    payload = []
) {

    const seats =
        sanitizeSeatLayoutPayload(
            payload
        );


    const errors = [];


    if (
        !Array.isArray(
            seats
        )
    ) {

        addError(
            errors,
            "body",
            "Seat layout must be an array of physical seats."
        );


        return createValidationResult(
            seats,
            errors
        );

    }


    if (
        seats.length >
        MAX_PHYSICAL_SEATS_PER_LAYOUT
    ) {

        addError(
            errors,
            "seats",
            `Seat layout cannot exceed ${MAX_PHYSICAL_SEATS_PER_LAYOUT} physical seats.`
        );

    }


    const usedSeatKeys =
        new Set();


    seats.forEach(
        (
            seat,
            index
        ) => {

            const fieldBase =
                `seats.${index}`;


            /* -------------------------------------------------
               ROW
               ------------------------------------------------- */

            if (!seat.row) {

                addError(
                    errors,
                    `${fieldBase}.row`,
                    "Seat row is required."
                );

            } else if (
                !/^[A-Z]{1,3}$/
                    .test(
                        seat.row
                    )
            ) {

                addError(
                    errors,
                    `${fieldBase}.row`,
                    "Seat row must contain 1 to 3 letters."
                );

            }


            /* -------------------------------------------------
               NUMBER
               ------------------------------------------------- */

            if (
                !Number.isInteger(
                    seat.number
                ) ||
                seat.number <
                    1 ||
                seat.number >
                    999
            ) {

                addError(
                    errors,
                    `${fieldBase}.number`,
                    "Seat number must be an integer between 1 and 999."
                );

            }


            /* -------------------------------------------------
               CATEGORY ID
               ------------------------------------------------- */

            if (!seat.categoryId) {

                addError(
                    errors,
                    `${fieldBase}.categoryId`,
                    "Seat category ID is required."
                );

            } else if (
                !mongoose.Types
                    .ObjectId
                    .isValid(
                        seat.categoryId
                    )
            ) {

                addError(
                    errors,
                    `${fieldBase}.categoryId`,
                    "Seat category ID must be a valid MongoDB ObjectId."
                );

            }


            /* -------------------------------------------------
               ACTIVE
               ------------------------------------------------- */

            if (
                typeof seat.active !==
                "boolean"
            ) {

                addError(
                    errors,
                    `${fieldBase}.active`,
                    "Seat active status must be true or false."
                );

            }


            /* -------------------------------------------------
               CANONICAL LABEL + DUPLICATE CHECK
               ------------------------------------------------- */

            const validRow =
                /^[A-Z]{1,3}$/
                    .test(
                        seat.row
                    );


            const validNumber =
                Number.isInteger(
                    seat.number
                ) &&
                seat.number >=
                    1 &&
                seat.number <=
                    999;


            if (
                validRow &&
                validNumber
            ) {

                const canonicalLabel =
                    `${
                        seat.row
                    }${
                        seat.number
                    }`;


                seat.label =
                    canonicalLabel;


                const seatKey =
                    `${
                        seat.row
                    }:${
                        seat.number
                    }`;


                if (
                    usedSeatKeys.has(
                        seatKey
                    )
                ) {

                    addError(
                        errors,
                        `${fieldBase}.label`,
                        `Duplicate physical seat ${canonicalLabel}.`
                    );

                } else {

                    usedSeatKeys.add(
                        seatKey
                    );

                }

            }

        }
    );


    return createValidationResult(
        seats,
        errors
    );

}


/* =========================================================
   17. VENUE ID VALIDATOR
   ========================================================= */

function validateVenueId(
    value
) {

    const venueId =
        cleanText(
            value
        );


    const errors = [];


    if (!venueId) {

        addError(
            errors,
            "venueId",
            "Venue ID is required."
        );

    } else if (
        !mongoose.Types
            .ObjectId
            .isValid(
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
        venueId,
        errors
    );

}


/* =========================================================
   18. CATEGORY ID VALIDATOR
   ========================================================= */

function validateSeatCategoryId(
    value
) {

    const categoryId =
        cleanText(
            value
        );


    const errors = [];


    if (!categoryId) {

        addError(
            errors,
            "categoryId",
            "Seat category ID is required."
        );

    } else if (
        !mongoose.Types
            .ObjectId
            .isValid(
                categoryId
            )
    ) {

        addError(
            errors,
            "categoryId",
            "Invalid seat category ID."
        );

    }


    return createValidationResult(
        categoryId,
        errors
    );

}


/* =========================================================
   19. VENUE PARAMS VALIDATOR

   {
       venueId
   }
   ========================================================= */

function validateVenueParams(
    params = {}
) {

    const result =
        validateVenueId(
            params.venueId ||
            params.id
        );


    return createValidationResult(
        {
            venueId:
                result.value
        },
        result.errors
    );

}


/* =========================================================
   20. VENUE + CATEGORY PARAMS VALIDATOR

   Used by:

   PATCH
   /api/admin/venues/:venueId/categories/:categoryId

   DELETE
   /api/admin/venues/:venueId/categories/:categoryId
   ========================================================= */

function validateSeatCategoryParams(
    params = {}
) {

    const venueResult =
        validateVenueId(
            params.venueId
        );


    const categoryResult =
        validateSeatCategoryId(
            params.categoryId
        );


    const errors = [

        ...venueResult.errors,

        ...categoryResult.errors

    ];


    return createValidationResult(
        {

            venueId:
                venueResult.value,

            categoryId:
                categoryResult.value

        },
        errors
    );

}


/* =========================================================
   21. VENUE LIST QUERY VALIDATOR

   GET /api/admin/venues

   Supports:

   ?search=
   ?status=
   ?type=
   ?city=
   ?page=
   ?limit=
   ========================================================= */

function validateVenueListQuery(
    query = {}
) {

    const errors = [];


    const value = {

        search:
            cleanText(
                query.search
            ),

        status:
            normalizeVenueStatus(
                query.status
            ),

        type:
            normalizeVenueType(
                query.type
            ),

        city:
            cleanText(
                query.city
            ),

        page:
            Number(
                query.page ||
                1
            ),

        limit:
            Number(
                query.limit ||
                20
            )

    };


    /* ---------------------------------------------------------
       STATUS FILTER
       --------------------------------------------------------- */

    if (
        value.status &&
        !VENUE_STATUSES.includes(
            value.status
        )
    ) {

        addError(
            errors,
            "status",
            "Invalid venue status filter."
        );

    }


    /* ---------------------------------------------------------
       TYPE FILTER
       --------------------------------------------------------- */

    if (
        value.type &&
        !VENUE_TYPES.includes(
            value.type
        )
    ) {

        addError(
            errors,
            "type",
            "Invalid venue type filter."
        );

    }


    /* ---------------------------------------------------------
       PAGE
       --------------------------------------------------------- */

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


    /* ---------------------------------------------------------
       LIMIT
       --------------------------------------------------------- */

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
   22. UTILITY - ALLOWED VENUE METADATA FIELD
   ========================================================= */

function isVenueMetadataField(
    field
) {

    return VENUE_METADATA_FIELDS
        .includes(
            field
        );

}


/* =========================================================
   23. UTILITY - ALLOWED CATEGORY METADATA FIELD
   ========================================================= */

function isSeatCategoryMetadataField(
    field
) {

    return SEAT_CATEGORY_METADATA_FIELDS
        .includes(
            field
        );

}


/* =========================================================
   24. EXPORTS
   ========================================================= */

module.exports = {

    /* Venue constants */

    VENUE_TYPES,

    VENUE_STATUSES,

    VENUE_METADATA_FIELDS,


    /* Phase 5 constants */

    SEAT_CATEGORY_STATUSES,

    SEAT_CATEGORY_METADATA_FIELDS,


    /* Phase 6 physical-seat constants */

    PHYSICAL_SEAT_FIELDS,

    MAX_PHYSICAL_SEATS_PER_LAYOUT,


    /* Shared helpers */

    cleanText,

    cleanMultilineText,


    /* Venue normalization */

    normalizeVenueType,

    normalizeVenueStatus,


    /* Category normalization */

    normalizeSeatCategoryStatus,

    normalizeSeatCategoryCode,


    /* Phase 6 normalization */

    normalizePhysicalSeatRow,


    /* Sanitizers */

    sanitizeVenuePayload,

    sanitizeSeatCategoryPayload,

    sanitizeSeatLayoutPayload,


    /* Venue validators */

    validateCreateVenue,

    validateUpdateVenue,

    validateVenueId,

    validateVenueParams,

    validateVenueListQuery,


    /* Phase 5 category validators */

    validateCreateSeatCategory,

    validateUpdateSeatCategory,

    validateSeatCategoryId,

    validateSeatCategoryParams,


    /* Phase 6 physical-seat validator */

    validateSeatLayout,


    /* Utilities */

    isVenueMetadataField,

    isSeatCategoryMetadataField

};