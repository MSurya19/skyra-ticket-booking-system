"use strict";

const mongoose =
    require("mongoose");

const Venue =
    require("../models/Venue");

const Seat =
    require("../models/Seat");

const ApiError =
    require("../utils/ApiError");

const {
    HTTP_STATUS
} =
    require("../utils/constants");


/* =========================================================
   SKYRA - VENUE SERVICE
   File: backend/src/services/venueService.js

   Phase 4:
   - Create venues
   - Prevent duplicate venue name + city
   - Get all venues
   - Search/filter venues
   - Get one venue
   - Update venue metadata
   - Soft delete venue
   - Protect seat-management fields

   Phase 5:
   - Create seat categories
   - Update seat categories
   - Delete seat categories
   - Prevent duplicate category names
   - Prevent duplicate category codes
   - Protect category capacity

   Phase 6:
   - Read permanent physical Seat records
   - Save/replace a Venue physical Seat Layout
   - Preserve existing Seat IDs when row + number remain
   - Validate Seat Category ownership
   - Recalculate Venue capacity
   - Recalculate embedded Seat Category capacities
   - Maintain layoutConfigured
   - Use MongoDB transactions for layout consistency

   Important:
   AVAILABLE / HELD / BOOKED / OFFERED are NOT stored here.
   Those states belong to future ShowSeat records.
   ========================================================= */


/* =========================================================
   1. VENUE METADATA FIELDS
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
   2. SEAT CATEGORY METADATA FIELDS

   capacity is intentionally excluded.

   It will be maintained from physical Seat records
   during Phase 6.
   ========================================================= */

const SEAT_CATEGORY_METADATA_FIELDS = [
    "name",
    "code",
    "status",
    "description"
];


/* =========================================================
   PHASE 6 - PHYSICAL SEAT LIMIT

   Matches venueValidator.js.

   This is a defensive service-level limit as well, so a
   controller/route cannot accidentally bypass the validator.
   ========================================================= */

const MAX_PHYSICAL_SEATS_PER_LAYOUT =
    5000;


/* =========================================================
   3. NORMALIZE STRING
   ========================================================= */

function normalizeText(
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


/* =========================================================
   4. NORMALIZE CATEGORY IDENTITY

   Used for case-insensitive duplicate checks.

   Premium
   PREMIUM
   premium

   are considered the same category name.
   ========================================================= */

function normalizeSeatCategoryIdentity(
    value
) {

    return normalizeText(
        value
    )
        .toLowerCase();

}


/* =========================================================
   5. NORMALIZE CATEGORY CODE
   ========================================================= */

function normalizeSeatCategoryCode(
    value
) {

    return normalizeText(
        value
    )
        .toUpperCase();

}


/* =========================================================
   6. ESCAPE REGEX
   ========================================================= */

function escapeRegExp(
    value
) {

    return String(
        value
    )
        .replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
        );

}


/* =========================================================
   7. EXACT CASE-INSENSITIVE REGEX
   ========================================================= */

function createExactRegex(
    value
) {

    return new RegExp(
        `^${escapeRegExp(
            normalizeText(
                value
            )
        )}$`,
        "i"
    );

}


/* =========================================================
   8. SEARCH REGEX
   ========================================================= */

function createSearchRegex(
    value
) {

    return new RegExp(
        escapeRegExp(
            normalizeText(
                value
            )
        ),
        "i"
    );

}


/* =========================================================
   9. PICK SAFE VENUE METADATA

   Protect:

   capacity
   seatCategories
   layoutConfigured
   deleted
   deletedAt
   ========================================================= */

function pickVenueMetadata(
    data = {}
) {

    const source =
        data &&
        typeof data ===
            "object" &&
        !Array.isArray(
            data
        )
            ? data
            : {};


    const result = {};


    for (
        const field of
        VENUE_METADATA_FIELDS
    ) {

        if (
            Object.prototype
                .hasOwnProperty.call(
                    source,
                    field
                )
        ) {

            result[field] =
                source[field];

        }

    }


    return result;

}


/* =========================================================
   10. PICK SAFE SEAT CATEGORY METADATA

   Protect:

   _id
   id
   capacity
   createdAt
   updatedAt
   ========================================================= */

function pickSeatCategoryMetadata(
    data = {}
) {

    const source =
        data &&
        typeof data ===
            "object" &&
        !Array.isArray(
            data
        )
            ? data
            : {};


    const result = {};


    for (
        const field of
        SEAT_CATEGORY_METADATA_FIELDS
    ) {

        if (
            Object.prototype
                .hasOwnProperty.call(
                    source,
                    field
                )
        ) {

            result[field] =
                source[field];

        }

    }


    /*
       Normalize code at service level too.

       This is defense-in-depth in addition
       to venueValidator.js.
    */

    if (
        Object.prototype
            .hasOwnProperty.call(
                result,
                "code"
            )
    ) {

        result.code =
            normalizeSeatCategoryCode(
                result.code
            );

    }


    return result;

}


/* =========================================================
   11. VALIDATE MONGODB VENUE ID
   ========================================================= */

function ensureValidVenueId(
    venueId
) {

    const normalizedId =
        normalizeText(
            venueId
        );


    if (
        !normalizedId ||
        !mongoose.Types.ObjectId
            .isValid(
                normalizedId
            )
    ) {

        throw new ApiError(
            HTTP_STATUS.BAD_REQUEST,
            "Invalid venue ID.",
            [
                {
                    field:
                        "venueId",

                    message:
                        "A valid venue ID is required."
                }
            ]
        );

    }


    return normalizedId;

}


/* =========================================================
   12. VALIDATE MONGODB CATEGORY ID
   ========================================================= */

function ensureValidSeatCategoryId(
    categoryId
) {

    const normalizedId =
        normalizeText(
            categoryId
        );


    if (
        !normalizedId ||
        !mongoose.Types.ObjectId
            .isValid(
                normalizedId
            )
    ) {

        throw new ApiError(
            HTTP_STATUS.BAD_REQUEST,
            "Invalid seat category ID.",
            [
                {
                    field:
                        "categoryId",

                    message:
                        "A valid seat category ID is required."
                }
            ]
        );

    }


    return normalizedId;

}


/* =========================================================
   13. FIND DUPLICATE VENUE
   ========================================================= */

async function findDuplicateVenue({
    name,
    city,
    excludeVenueId = null
}) {

    if (
        !name ||
        !city
    ) {

        return null;

    }


    const filter = {

        name:
            createExactRegex(
                name
            ),

        city:
            createExactRegex(
                city
            ),

        deleted:
            false

    };


    if (
        excludeVenueId &&
        mongoose.Types.ObjectId
            .isValid(
                excludeVenueId
            )
    ) {

        filter._id = {

            $ne:
                excludeVenueId

        };

    }


    return Venue
        .findOne(
            filter
        )
        .select(
            "_id name city"
        )
        .lean();

}


/* =========================================================
   14. THROW DUPLICATE VENUE ERROR
   ========================================================= */

function throwDuplicateVenueError() {

    throw new ApiError(
        HTTP_STATUS.CONFLICT,
        "Venue already exists.",
        [
            {
                field:
                    "name",

                message:
                    "A venue with this name already exists in the same city."
            }
        ]
    );

}


/* =========================================================
   15. CREATE VENUE
   ========================================================= */

async function createVenue(
    venueData
) {

    const metadata =
        pickVenueMetadata(
            venueData
        );


    const duplicate =
        await findDuplicateVenue({

            name:
                metadata.name,

            city:
                metadata.city

        });


    if (duplicate) {

        throwDuplicateVenueError();

    }


    const venue =
        new Venue({

            ...metadata,

            capacity:
                0,

            seatCategories:
                [],

            layoutConfigured:
                false,

            deleted:
                false,

            deletedAt:
                null

        });


    await venue.save();


    return venue;

}


/* =========================================================
   16. BUILD VENUE LIST FILTER
   ========================================================= */

function buildVenueFilter(
    options = {}
) {

    const filter = {

        deleted:
            false

    };


    /* STATUS */

    if (options.status) {

        filter.status =
            normalizeText(
                options.status
            )
                .toUpperCase();

    }


    /* TYPE */

    if (options.type) {

        filter.type =
            normalizeText(
                options.type
            )
                .toUpperCase();

    }


    /* CITY */

    if (options.city) {

        filter.city =
            createExactRegex(
                options.city
            );

    }


    /* SEARCH */

    if (options.search) {

        const searchRegex =
            createSearchRegex(
                options.search
            );


        filter.$or = [

            {
                name:
                    searchRegex
            },

            {
                city:
                    searchRegex
            },

            {
                state:
                    searchRegex
            },

            {
                country:
                    searchRegex
            },

            {
                address:
                    searchRegex
            },

            {
                postalCode:
                    searchRegex
            }

        ];

    }


    return filter;

}


/* =========================================================
   17. GET ALL VENUES
   ========================================================= */

async function getVenues(
    options = {}
) {

    const page =
        Number.isInteger(
            Number(
                options.page
            )
        ) &&
        Number(
            options.page
        ) >
            0
            ? Number(
                options.page
            )
            : 1;


    const requestedLimit =
        Number(
            options.limit
        );


    const limit =
        Number.isInteger(
            requestedLimit
        ) &&
        requestedLimit >
            0
            ? Math.min(
                requestedLimit,
                100
            )
            : 20;


    const skip =
        (
            page -
            1
        ) *
        limit;


    const filter =
        buildVenueFilter(
            options
        );


    const [
        venues,
        total
    ] =
        await Promise.all([

            Venue
                .find(
                    filter
                )
                .sort({
                    name:
                        1,

                    city:
                        1
                })
                .skip(
                    skip
                )
                .limit(
                    limit
                ),

            Venue
                .countDocuments(
                    filter
                )

        ]);


    const totalPages =
        Math.max(
            1,
            Math.ceil(
                total /
                limit
            )
        );


    return {

        venues,

        pagination: {

            page,

            limit,

            total,

            totalPages,

            hasNextPage:
                page <
                totalPages,

            hasPreviousPage:
                page >
                1

        }

    };

}


/* =========================================================
   18. GET VENUE BY ID
   ========================================================= */

async function getVenueById(
    venueId
) {

    const id =
        ensureValidVenueId(
            venueId
        );


    const venue =
        await Venue.findOne({

            _id:
                id,

            deleted:
                false

        });


    if (!venue) {

        throw new ApiError(
            HTTP_STATUS.NOT_FOUND,
            "Venue not found."
        );

    }


    return venue;

}


/* =========================================================
   19. REQUIRE VENUE DOCUMENT
   ========================================================= */

async function requireVenue(
    venueId
) {

    return getVenueById(
        venueId
    );

}


/* =========================================================
   20. VALIDATE POSTAL CODE AGAINST EXISTING COUNTRY
   ========================================================= */

function validateVenuePostalCode(
    country,
    postalCode
) {

    if (
        postalCode ===
            undefined ||
        postalCode ===
            null
    ) {

        return;

    }


    const normalizedCountry =
        normalizeText(
            country
        )
            .toLowerCase();


    const normalizedPostalCode =
        normalizeText(
            postalCode
        );


    if (
        normalizedCountry ===
            "india" &&
        !/^[1-9][0-9]{5}$/
            .test(
                normalizedPostalCode
            )
    ) {

        throw new ApiError(
            HTTP_STATUS.BAD_REQUEST,
            "Invalid venue information.",
            [
                {
                    field:
                        "postalCode",

                    message:
                        "Enter a valid 6-digit Indian PIN code."
                }
            ]
        );

    }

}


/* =========================================================
   21. UPDATE VENUE
   ========================================================= */

async function updateVenue(
    venueId,
    updateData
) {

    const venue =
        await requireVenue(
            venueId
        );


    const metadata =
        pickVenueMetadata(
            updateData
        );


    if (
        Object.keys(
            metadata
        ).length ===
        0
    ) {

        throw new ApiError(
            HTTP_STATUS.BAD_REQUEST,
            "No venue information was provided for update."
        );

    }


    const finalName =
        metadata.name ??
        venue.name;


    const finalCity =
        metadata.city ??
        venue.city;


    if (
        Object.prototype
            .hasOwnProperty.call(
                metadata,
                "name"
            ) ||
        Object.prototype
            .hasOwnProperty.call(
                metadata,
                "city"
            )
    ) {

        const duplicate =
            await findDuplicateVenue({

                name:
                    finalName,

                city:
                    finalCity,

                excludeVenueId:
                    venue._id
                        .toString()

            });


        if (duplicate) {

            throwDuplicateVenueError();

        }

    }


    const finalCountry =
        metadata.country ??
        venue.country;


    const finalPostalCode =
        metadata.postalCode ??
        venue.postalCode;


    validateVenuePostalCode(
        finalCountry,
        finalPostalCode
    );


    for (
        const [
            field,
            value
        ] of
        Object.entries(
            metadata
        )
    ) {

        venue[field] =
            value;

    }


    /*
       Protected:

       venue.capacity
       venue.seatCategories
       venue.layoutConfigured
    */


    await venue.save();


    return venue;

}


/* =========================================================
   22. SOFT DELETE VENUE
   ========================================================= */

async function softDeleteVenue(
    venueId
) {

    const venue =
        await requireVenue(
            venueId
        );


    venue.deleted =
        true;

    venue.deletedAt =
        new Date();

    venue.status =
        "INACTIVE";


    await venue.save();


    return venue;

}


/* =========================================================
   23. VENUE EXISTS
   ========================================================= */

async function venueExists(
    venueId
) {

    if (
        !venueId ||
        !mongoose.Types.ObjectId
            .isValid(
                venueId
            )
    ) {

        return false;

    }


    const venue =
        await Venue.exists({

            _id:
                venueId,

            deleted:
                false

        });


    return Boolean(
        venue
    );

}


/* =========================================================
   24. GET ACTIVE VENUES
   ========================================================= */

async function getActiveVenues() {

    return Venue
        .find({

            status:
                "ACTIVE",

            deleted:
                false

        })
        .sort({

            city:
                1,

            name:
                1

        });

}


/* =========================================================
   25. GET VENUE COUNTS
   ========================================================= */

async function getVenueCounts() {

    const [
        total,
        active,
        inactive,
        configured
    ] =
        await Promise.all([

            Venue.countDocuments({

                deleted:
                    false

            }),

            Venue.countDocuments({

                deleted:
                    false,

                status:
                    "ACTIVE"

            }),

            Venue.countDocuments({

                deleted:
                    false,

                status:
                    "INACTIVE"

            }),

            Venue.countDocuments({

                deleted:
                    false,

                layoutConfigured:
                    true

            })

        ]);


    return {

        total,

        active,

        inactive,

        configured,

        notConfigured:
            Math.max(
                total -
                configured,
                0
            )

    };

}


/* =========================================================
   PHASE 5 - SEAT CATEGORY SERVICES
   ========================================================= */


/* =========================================================
   26. FIND CATEGORY BY ID
   ========================================================= */

function findSeatCategoryById(
    venue,
    categoryId
) {

    const id =
        ensureValidSeatCategoryId(
            categoryId
        );


    const category =
        venue.seatCategories
            .id(
                id
            );


    if (!category) {

        throw new ApiError(
            HTTP_STATUS.NOT_FOUND,
            "Seat category not found.",
            [
                {
                    field:
                        "categoryId",

                    message:
                        "The requested seat category could not be found."
                }
            ]
        );

    }


    return category;

}


/* =========================================================
   27. FIND DUPLICATE CATEGORY

   Duplicate rules inside ONE Venue:

   Same name
   OR
   same code

   = duplicate category

   During update, current category is ignored.
   ========================================================= */

function findDuplicateSeatCategory(
    venue,
    {
        name,
        code,
        excludeCategoryId = null
    } = {}
) {

    const normalizedName =
        normalizeSeatCategoryIdentity(
            name
        );


    const normalizedCode =
        normalizeSeatCategoryCode(
            code
        );


    return (
        venue.seatCategories.find(
            (category) => {

                const categoryId =
                    category._id
                        .toString();


                if (
                    excludeCategoryId &&
                    categoryId ===
                        String(
                            excludeCategoryId
                        )
                ) {

                    return false;

                }


                const sameName =
                    normalizedName &&
                    normalizeSeatCategoryIdentity(
                        category.name
                    ) ===
                        normalizedName;


                const sameCode =
                    normalizedCode &&
                    normalizeSeatCategoryCode(
                        category.code
                    ) ===
                        normalizedCode;


                return (
                    sameName ||
                    sameCode
                );

            }
        )
        ||
        null
    );

}


/* =========================================================
   28. THROW DUPLICATE CATEGORY ERROR
   ========================================================= */

function throwDuplicateSeatCategoryError(
    duplicateCategory,
    incomingCategory
) {

    const errors = [];


    const incomingName =
        normalizeSeatCategoryIdentity(
            incomingCategory?.name
        );


    const incomingCode =
        normalizeSeatCategoryCode(
            incomingCategory?.code
        );


    if (
        incomingName &&
        normalizeSeatCategoryIdentity(
            duplicateCategory?.name
        ) ===
            incomingName
    ) {

        errors.push({

            field:
                "name",

            message:
                "A category with this name already exists for this venue."

        });

    }


    if (
        incomingCode &&
        normalizeSeatCategoryCode(
            duplicateCategory?.code
        ) ===
            incomingCode
    ) {

        errors.push({

            field:
                "code",

            message:
                "This category code is already used in this venue."

        });

    }


    throw new ApiError(
        HTTP_STATUS.CONFLICT,
        "Seat category already exists.",
        errors.length
            ? errors
            : [
                {
                    field:
                        "category",

                    message:
                        "A matching seat category already exists."
                }
            ]
    );

}


/* =========================================================
   29. CREATE SEAT CATEGORY

   POST
   /api/admin/venues/:venueId/categories

   New category always starts with:

   capacity = 0
   ========================================================= */

async function createSeatCategory(
    venueId,
    categoryData
) {

    const venue =
        await requireVenue(
            venueId
        );


    const metadata =
        pickSeatCategoryMetadata(
            categoryData
        );


    /*
       Defense-in-depth.

       Route validator should already guarantee
       required fields, but service rejects an
       empty safe payload too.
    */

    if (
        Object.keys(
            metadata
        ).length ===
        0
    ) {

        throw new ApiError(
            HTTP_STATUS.BAD_REQUEST,
            "No seat category information was provided."
        );

    }


    const duplicate =
        findDuplicateSeatCategory(
            venue,
            {

                name:
                    metadata.name,

                code:
                    metadata.code

            }
        );


    if (duplicate) {

        throwDuplicateSeatCategoryError(
            duplicate,
            metadata
        );

    }


    venue.seatCategories.push({

        ...metadata,

        /*
           Category capacity is never accepted
           from frontend input.
        */
        capacity:
            0

    });


    await venue.save();


    const category =
        venue.seatCategories[
            venue.seatCategories.length -
            1
        ];


    return category;

}


/* =========================================================
   30. GET SEAT CATEGORY

   Internal helper and useful for testing.
   ========================================================= */

async function getSeatCategory(
    venueId,
    categoryId
) {

    const venue =
        await requireVenue(
            venueId
        );


    return findSeatCategoryById(
        venue,
        categoryId
    );

}


/* =========================================================
   31. UPDATE SEAT CATEGORY

   PATCH
   /api/admin/venues/:venueId/categories/:categoryId

   Editable:

   name
   code
   status
   description

   Protected:

   _id
   capacity
   createdAt
   updatedAt
   ========================================================= */

async function updateSeatCategory(
    venueId,
    categoryId,
    updateData
) {

    const venue =
        await requireVenue(
            venueId
        );


    const category =
        findSeatCategoryById(
            venue,
            categoryId
        );


    const metadata =
        pickSeatCategoryMetadata(
            updateData
        );


    if (
        Object.keys(
            metadata
        ).length ===
        0
    ) {

        throw new ApiError(
            HTTP_STATUS.BAD_REQUEST,
            "No seat category information was provided for update."
        );

    }


    /*
       Determine final values because PATCH may
       contain only name OR code.
    */

    const finalName =
        Object.prototype
            .hasOwnProperty.call(
                metadata,
                "name"
            )
            ? metadata.name
            : category.name;


    const finalCode =
        Object.prototype
            .hasOwnProperty.call(
                metadata,
                "code"
            )
            ? metadata.code
            : category.code;


    const duplicate =
        findDuplicateSeatCategory(
            venue,
            {

                name:
                    finalName,

                code:
                    finalCode,

                excludeCategoryId:
                    category._id
                        .toString()

            }
        );


    if (duplicate) {

        throwDuplicateSeatCategoryError(
            duplicate,
            {

                name:
                    finalName,

                code:
                    finalCode

            }
        );

    }


    for (
        const [
            field,
            value
        ] of
        Object.entries(
            metadata
        )
    ) {

        category[field] =
            value;

    }


    /*
       DO NOT modify:

       category._id
       category.capacity
    */


    await venue.save();


    return category;

}


/* =========================================================
   32. DELETE SEAT CATEGORY

   DELETE
   /api/admin/venues/:venueId/categories/:categoryId

   Rule:

   If physical seats are assigned:

   capacity > 0

   deletion is blocked.

   This rule is also enforced by the frontend,
   but backend MUST enforce it too.
   ========================================================= */

async function deleteSeatCategory(
    venueId,
    categoryId
) {

    const venue =
        await requireVenue(
            venueId
        );


    const category =
        findSeatCategoryById(
            venue,
            categoryId
        );


    /*
       Phase 6 source of truth:

       Count actual physical Seat documents before deleting
       an embedded category. The cached category.capacity
       value is only derived metadata.
    */

    const assignedSeats =
        await Seat.countDocuments({

            venueId:
                venue._id,

            categoryId:
                category._id

        });


    if (
        assignedSeats >
        0
    ) {

        throw new ApiError(
            HTTP_STATUS.CONFLICT,
            "Seat category is in use.",
            [
                {
                    field:
                        "categoryId",

                    message:
                        `${assignedSeats} physical seat${
                            assignedSeats === 1
                                ? ""
                                : "s"
                        } are assigned to this category. Reassign or remove those seats before deleting the category.`
                }
            ]
        );

    }


    const deletedCategory =
        category.toObject({
            virtuals:
                true
        });


    venue.seatCategories.pull(
        category._id
    );


    await venue.save();


    return deletedCategory;

}


/* =========================================================
   33. GET SEAT CATEGORIES FOR VENUE

   Not currently required as a separate frontend API,
   because GET /api/admin/venues already returns
   seatCategories.

   Still useful internally and for future APIs.
   ========================================================= */

async function getSeatCategories(
    venueId
) {

    const venue =
        await requireVenue(
            venueId
        );


    return venue.seatCategories;

}


/* =========================================================
   PHASE 6 - PHYSICAL SEAT LAYOUT SERVICES
   ========================================================= */


/* =========================================================
   34. NORMALIZE ONE PHYSICAL SEAT
   ========================================================= */

function normalizePhysicalSeat(
    rawSeat,
    index = 0
) {

    const source =
        rawSeat &&
        typeof rawSeat ===
            "object" &&
        !Array.isArray(
            rawSeat
        )
            ? rawSeat
            : {};


    const row =
        normalizeText(
            source.row
        )
            .toUpperCase();


    const number =
        source.number ===
            undefined ||
        source.number ===
            null ||
        source.number ===
            ""
            ? NaN
            : Number(
                source.number
            );


    const categoryId =
        normalizeText(
            source.categoryId
        );


    const active =
        Object.prototype
            .hasOwnProperty.call(
                source,
                "active"
            )
            ? source.active
            : true;


    const errors = [];


    if (
        !/^[A-Z]{1,3}$/
            .test(
                row
            )
    ) {

        errors.push({

            field:
                `seats.${index}.row`,

            message:
                "Seat row must contain 1 to 3 letters."

        });

    }


    if (
        !Number.isInteger(
            number
        ) ||
        number <
            1 ||
        number >
            999
    ) {

        errors.push({

            field:
                `seats.${index}.number`,

            message:
                "Seat number must be an integer between 1 and 999."

        });

    }


    if (
        !categoryId ||
        !mongoose.Types
            .ObjectId
            .isValid(
                categoryId
            )
    ) {

        errors.push({

            field:
                `seats.${index}.categoryId`,

            message:
                "Seat category ID must be a valid MongoDB ObjectId."

        });

    }


    if (
        typeof active !==
        "boolean"
    ) {

        errors.push({

            field:
                `seats.${index}.active`,

            message:
                "Seat active status must be true or false."

        });

    }


    if (
        errors.length
    ) {

        throw new ApiError(
            HTTP_STATUS.BAD_REQUEST,
            "Invalid physical seat.",
            errors
        );

    }


    return {

        row,

        number,

        label:
            `${row}${number}`,

        categoryId,

        active

    };

}


/* =========================================================
   35. NORMALIZE COMPLETE PHYSICAL SEAT LAYOUT

   Accepted:
   - array of physical Seats
   - { seats: [...] }

   [] intentionally clears the layout.
   ========================================================= */

function normalizeSeatLayout(
    seatData
) {

    let source =
        null;


    if (
        Array.isArray(
            seatData
        )
    ) {

        source =
            seatData;

    } else if (
        seatData &&
        typeof seatData ===
            "object" &&
        Array.isArray(
            seatData.seats
        )
    ) {

        source =
            seatData.seats;

    }


    if (!source) {

        throw new ApiError(
            HTTP_STATUS.BAD_REQUEST,
            "Invalid seat layout.",
            [
                {
                    field:
                        "body",

                    message:
                        "Seat layout must be an array of physical seats."
                }
            ]
        );

    }


    if (
        source.length >
        MAX_PHYSICAL_SEATS_PER_LAYOUT
    ) {

        throw new ApiError(
            HTTP_STATUS.BAD_REQUEST,
            "Seat layout is too large.",
            [
                {
                    field:
                        "seats",

                    message:
                        `Seat layout cannot exceed ${MAX_PHYSICAL_SEATS_PER_LAYOUT} physical seats.`
                }
            ]
        );

    }


    const normalized =
        source.map(
            (
                seat,
                index
            ) =>
                normalizePhysicalSeat(
                    seat,
                    index
                )
        );


    const seen =
        new Set();


    for (
        let index = 0;
        index <
        normalized.length;
        index++
    ) {

        const seat =
            normalized[
                index
            ];


        const key =
            `${seat.row}:${seat.number}`;


        if (
            seen.has(
                key
            )
        ) {

            throw new ApiError(
                HTTP_STATUS.BAD_REQUEST,
                "Duplicate physical seat.",
                [
                    {
                        field:
                            `seats.${index}.label`,

                        message:
                            `Duplicate physical seat ${seat.label}.`
                    }
                ]
            );

        }


        seen.add(
            key
        );

    }


    return normalized;

}


/* =========================================================
   36. VALIDATE CATEGORY OWNERSHIP

   Every categoryId must belong to this Venue.

   Existing INACTIVE category assignments are accepted when
   re-saving an old layout. The frontend already limits new
   row generation to ACTIVE categories.
   ========================================================= */

function validateSeatLayoutCategories(
    venue,
    seats
) {

    const categoryIds =
        new Set(
            venue.seatCategories.map(
                (category) =>
                    category._id
                        .toString()
            )
        );


    const errors = [];


    seats.forEach(
        (
            seat,
            index
        ) => {

            if (
                !categoryIds.has(
                    seat.categoryId
                )
            ) {

                errors.push({

                    field:
                        `seats.${index}.categoryId`,

                    message:
                        `Seat ${seat.label} references a category that does not belong to this venue.`

                });

            }

        }
    );


    if (
        errors.length
    ) {

        throw new ApiError(
            HTTP_STATUS.BAD_REQUEST,
            "Invalid seat category assignment.",
            errors
        );

    }

}


/* =========================================================
   37. APPLY DERIVED VENUE SEAT METADATA

   Venue.capacity
       = total physical Seats

   category.capacity
       = physical Seats assigned to that embedded category

   layoutConfigured
       = true when at least one physical Seat exists
   ========================================================= */

function applySeatLayoutMetadata(
    venue,
    seats
) {

    const categoryCounts =
        new Map();


    for (
        const seat of
        seats
    ) {

        const key =
            String(
                seat.categoryId
            );


        categoryCounts.set(
            key,
            (
                categoryCounts.get(
                    key
                ) ||
                0
            ) +
            1
        );

    }


    venue.seatCategories.forEach(
        (category) => {

            category.capacity =
                categoryCounts.get(
                    category._id
                        .toString()
                ) ||
                0;

        }
    );


    venue.capacity =
        seats.length;


    venue.layoutConfigured =
        seats.length >
        0;

}


/* =========================================================
   38. GET VENUE PHYSICAL SEATS

   GET /api/admin/venues/:venueId/seats
   ========================================================= */

async function getVenueSeats(
    venueId
) {

    const venue =
        await requireVenue(
            venueId
        );


    return Seat
        .find({

            venueId:
                venue._id

        })
        .sort({

            row:
                1,

            number:
                1

        });

}


/* =========================================================
   39. SAVE COMPLETE VENUE PHYSICAL SEAT LAYOUT

   PUT /api/admin/venues/:venueId/seat-layout

   The request represents the COMPLETE desired layout.

   Existing row + number:
       update same Seat document and preserve _id

   New row + number:
       insert Seat

   Existing Seat missing from request:
       delete Seat

   Seat mutations and Venue metadata changes are committed
   together in one MongoDB transaction.
   ========================================================= */

async function saveVenueSeatLayout(
    venueId,
    seatData
) {

    const id =
        ensureValidVenueId(
            venueId
        );


    const normalizedSeats =
        normalizeSeatLayout(
            seatData
        );


    const session =
        await mongoose
            .startSession();


    try {

        await session.withTransaction(
            async () => {

                const venue =
                    await Venue
                        .findOne({

                            _id:
                                id,

                            deleted:
                                false

                        })
                        .session(
                            session
                        );


                if (!venue) {

                    throw new ApiError(
                        HTTP_STATUS.NOT_FOUND,
                        "Venue not found."
                    );

                }


                validateSeatLayoutCategories(
                    venue,
                    normalizedSeats
                );


                const existingSeats =
                    await Seat
                        .find({

                            venueId:
                                venue._id

                        })
                        .session(
                            session
                        );


                const existingByKey =
                    new Map();


                existingSeats.forEach(
                    (seat) => {

                        const key =
                            `${
                                String(
                                    seat.row
                                )
                                    .trim()
                                    .toUpperCase()
                            }:${
                                Number(
                                    seat.number
                                )
                            }`;


                        existingByKey.set(
                            key,
                            seat
                        );

                    }
                );


                const desiredKeys =
                    new Set();


                const bulkOperations =
                    [];


                for (
                    const seat of
                    normalizedSeats
                ) {

                    const key =
                        `${seat.row}:${seat.number}`;


                    desiredKeys.add(
                        key
                    );


                    const existing =
                        existingByKey.get(
                            key
                        );


                    if (existing) {

                        bulkOperations.push({

                            updateOne: {

                                filter: {
                                    _id:
                                        existing._id
                                },

                                update: {
                                    $set: {

                                        row:
                                            seat.row,

                                        number:
                                            seat.number,

                                        label:
                                            seat.label,

                                        categoryId:
                                            seat.categoryId,

                                        active:
                                            seat.active

                                    }
                                }

                            }

                        });

                    } else {

                        bulkOperations.push({

                            insertOne: {

                                document: {

                                    venueId:
                                        venue._id,

                                    row:
                                        seat.row,

                                    number:
                                        seat.number,

                                    label:
                                        seat.label,

                                    categoryId:
                                        seat.categoryId,

                                    active:
                                        seat.active

                                }

                            }

                        });

                    }

                }


                const seatIdsToDelete =
                    existingSeats
                        .filter(
                            (seat) => {

                                const key =
                                    `${
                                        String(
                                            seat.row
                                        )
                                            .trim()
                                            .toUpperCase()
                                    }:${
                                        Number(
                                            seat.number
                                        )
                                    }`;


                                return (
                                    !desiredKeys.has(
                                        key
                                    )
                                );

                            }
                        )
                        .map(
                            (seat) =>
                                seat._id
                        );


                if (
                    seatIdsToDelete.length
                ) {

                    await Seat
                        .deleteMany({

                            _id: {
                                $in:
                                    seatIdsToDelete
                            },

                            venueId:
                                venue._id

                        })
                        .session(
                            session
                        );

                }


                if (
                    bulkOperations.length
                ) {

                    await Seat.bulkWrite(
                        bulkOperations,
                        {
                            ordered:
                                true,

                            session
                        }
                    );

                }


                applySeatLayoutMetadata(
                    venue,
                    normalizedSeats
                );


                await venue.save({
                    session
                });

            }
        );

    } catch (error) {

        if (
            error &&
            error.code ===
                11000
        ) {

            throw new ApiError(
                HTTP_STATUS.CONFLICT,
                "Duplicate physical seat.",
                [
                    {
                        field:
                            "seats",

                        message:
                            "The venue already contains a conflicting physical seat label or row/number."
                    }
                ]
            );

        }


        throw error;

    } finally {

        await session.endSession();

    }


    return Seat
        .find({

            venueId:
                id

        })
        .sort({

            row:
                1,

            number:
                1

        });

}


/* =========================================================
   40. REBUILD VENUE SEAT METADATA FROM DATABASE

   Maintenance/testing helper.

   Recomputes cached capacity values from actual Seat docs.
   ========================================================= */

async function rebuildVenueSeatMetadata(
    venueId
) {

    const venue =
        await requireVenue(
            venueId
        );


    const seats =
        await Seat.find({

            venueId:
                venue._id

        });


    applySeatLayoutMetadata(
        venue,
        seats
    );


    await venue.save();


    return venue;

}


/* =========================================================
   34. EXPORTS
   ========================================================= */

module.exports = {

    /* =====================================================
       PHASE 4 - VENUES
       ===================================================== */

    createVenue,

    getVenues,

    getVenueById,

    updateVenue,

    softDeleteVenue,

    venueExists,

    getActiveVenues,

    getVenueCounts,

    requireVenue,

    findDuplicateVenue,

    buildVenueFilter,

    pickVenueMetadata,


    /* =====================================================
       PHASE 5 - SEAT CATEGORIES
       ===================================================== */

    createSeatCategory,

    getSeatCategory,

    getSeatCategories,

    updateSeatCategory,

    deleteSeatCategory,

    findSeatCategoryById,

    findDuplicateSeatCategory,

    pickSeatCategoryMetadata,


    /* =====================================================
       PHASE 6 - PHYSICAL SEAT LAYOUT
       ===================================================== */

    getVenueSeats,

    saveVenueSeatLayout,

    rebuildVenueSeatMetadata,

    normalizePhysicalSeat,

    normalizeSeatLayout,

    validateSeatLayoutCategories,

    applySeatLayoutMetadata

};