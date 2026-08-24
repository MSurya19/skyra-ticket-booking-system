"use strict";

const mongoose =
    require("mongoose");


/* =========================================================
   SKYRA - SEAT HOLD VALIDATOR
   File: backend/src/validators/holdValidator.js
   ========================================================= */


const MAX_SEATS_PER_HOLD =
    6;


function cleanText(
    value
) {

    return String(
        value ??
        ""
    ).trim();

}


function isObjectId(
    value
) {

    return Boolean(
        value
    ) &&
        mongoose.Types.ObjectId
            .isValid(
                value
            );

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


function result(
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


function validateCreateHold(
    body = {}
) {

    const showId =
        cleanText(
            body.showId
        );


    const rawSeatIds =
        Array.isArray(
            body.seatIds
        )
            ? body.seatIds
            : [];


    const seatIds =
        [
            ...new Set(
                rawSeatIds
                    .map(
                        cleanText
                    )
                    .filter(Boolean)
            )
        ];


    const errors =
        [];


    if (
        !isObjectId(
            showId
        )
    ) {

        addError(
            errors,
            "showId",
            "A valid Show ID is required."
        );

    }


    if (
        !Array.isArray(
            body.seatIds
        ) ||
        rawSeatIds.length <
            1
    ) {

        addError(
            errors,
            "seatIds",
            "Select at least one seat."
        );

    }


    if (
        rawSeatIds.length >
        MAX_SEATS_PER_HOLD
    ) {

        addError(
            errors,
            "seatIds",
            `A maximum of ${MAX_SEATS_PER_HOLD} seats can be held at once.`
        );

    }


    if (
        seatIds.length !==
        rawSeatIds.length
    ) {

        addError(
            errors,
            "seatIds",
            "Duplicate seat IDs are not allowed."
        );

    }


    seatIds.forEach(
        (
            seatId,
            index
        ) => {

            if (
                !isObjectId(
                    seatId
                )
            ) {

                addError(
                    errors,
                    `seatIds.${index}`,
                    "Each seat ID must be a valid ShowSeat ID."
                );

            }

        }
    );


    return result(
        {
            showId,
            seatIds
        },
        errors
    );

}


function validateHoldParams(
    params = {}
) {

    const holdId =
        cleanText(
            params.holdId ||
            params.id
        );


    const errors =
        [];


    if (
        !isObjectId(
            holdId
        )
    ) {

        addError(
            errors,
            "holdId",
            "A valid SeatHold ID is required."
        );

    }


    return result(
        {
            holdId
        },
        errors
    );

}


function validateActiveHoldQuery(
    query = {}
) {

    const showId =
        cleanText(
            query.showId
        );


    const errors =
        [];


    if (
        showId &&
        !isObjectId(
            showId
        )
    ) {

        addError(
            errors,
            "showId",
            "Show ID must be valid."
        );

    }


    return result(
        {
            showId
        },
        errors
    );

}


module.exports = {

    MAX_SEATS_PER_HOLD,

    validateCreateHold,

    validateHoldParams,

    validateActiveHoldQuery

};
