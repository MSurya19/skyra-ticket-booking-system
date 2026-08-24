"use strict";

/* =========================================================
   SKYRA - GLOBAL ERROR MIDDLEWARE

   File:
   backend/src/middleware/errorMiddleware.js

   Purpose:
   - Handle all backend errors in one place
   - Convert known Mongoose/MongoDB errors into clean responses
   - Handle ApiError errors
   - Prevent internal stack traces from leaking in production
   - Keep API error responses consistent

   Final response format:

   {
       success: false,
       message: "...",
       errors: []
   }
   ========================================================= */


const mongoose =
    require("mongoose");


const ApiError =
    require("../utils/ApiError");


const env =
    require("../config/env");


const {
    HTTP_STATUS
} =
    require("../utils/constants");



/* =========================================================
   1. NORMALIZE UNKNOWN ERRORS
   ========================================================= */

function normalizeError(
    error
) {

    /*
       If the error is already an ApiError,
       leave it unchanged.
    */

    if (
        error instanceof ApiError
    ) {

        return error;

    }



    /* =====================================================
       MONGOOSE VALIDATION ERROR

       Example:

       User.create({
           email: ""
       });

       Mongoose may generate:

       ValidationError
       ===================================================== */

    if (
        error instanceof
        mongoose.Error.ValidationError
    ) {

        const errors =
            Object.values(
                error.errors
            ).map(
                (item) => ({

                    field:
                        item.path,

                    message:
                        item.message

                })
            );


        return new ApiError(

            HTTP_STATUS.BAD_REQUEST,

            "Validation failed.",

            errors

        );

    }



    /* =====================================================
       MONGOOSE CAST ERROR

       Example:

       GET /api/venues/abc

       MongoDB ObjectId should normally look like:

       507f1f77bcf86cd799439011

       Invalid IDs can generate CastError.
       ===================================================== */

    if (
        error instanceof
        mongoose.Error.CastError
    ) {

        return new ApiError(

            HTTP_STATUS.BAD_REQUEST,

            `Invalid ${error.path}: ${error.value}`

        );

    }



    /* =====================================================
       MONGODB DUPLICATE KEY

       MongoDB error code 11000 occurs when a unique index
       is violated.

       Example:

       customer@gmail.com already exists
       and another user registers with the same email.
       ===================================================== */

    if (
        error &&
        error.code ===
        11000
    ) {

        const duplicateFields =
            Object.keys(
                error.keyPattern ||
                error.keyValue ||
                {}
            );


        const errors =
            duplicateFields.map(
                (field) => ({

                    field,

                    message:
                        `${formatFieldName(field)} already exists.`

                })
            );


        let message =
            "A record with the provided value already exists.";


        if (
            duplicateFields.length ===
            1
        ) {

            message =
                `${formatFieldName(
                    duplicateFields[0]
                )} already exists.`;

        }


        return new ApiError(

            HTTP_STATUS.CONFLICT,

            message,

            errors

        );

    }



    /* =====================================================
       INVALID JSON BODY

       Example request:

       {
           "email": "test@gmail.com",
       }

       Notice the invalid trailing comma.

       Express JSON parser generates SyntaxError.
       ===================================================== */

    if (
        error instanceof SyntaxError &&
        error.status === 400 &&
        Object.prototype.hasOwnProperty.call(
            error,
            "body"
        )
    ) {

        return new ApiError(

            HTTP_STATUS.BAD_REQUEST,

            "Invalid JSON request body."

        );

    }



    /* =====================================================
       REQUEST ENTITY TOO LARGE

       Useful if the JSON payload exceeds the configured
       Express body limit.
       ===================================================== */

    if (
        error &&
        error.type ===
        "entity.too.large"
    ) {

        return new ApiError(

            413,

            "Request payload is too large."

        );

    }



    /* =====================================================
       UNKNOWN ERROR

       Anything we do not recognize becomes HTTP 500.
       ===================================================== */

    const internalError =
        new ApiError(

            HTTP_STATUS.INTERNAL_SERVER_ERROR,

            env.IS_PRODUCTION
                ? "Internal server error."
                : (
                    error?.message ||
                    "Internal server error."
                )

        );


    /*
       Preserve the original stack during development so
       debugging is easier.
    */

    if (
        error?.stack
    ) {

        internalError.stack =
            error.stack;

    }


    return internalError;

}



/* =========================================================
   2. FORMAT FIELD NAME
   ========================================================= */

function formatFieldName(
    field
) {

    if (!field) {

        return "Value";

    }


    const formatted =
        String(field)
            .replace(
                /([A-Z])/g,
                " $1"
            )
            .replace(
                /_/g,
                " "
            )
            .trim();


    return (
        formatted
            .charAt(0)
            .toUpperCase() +
        formatted.slice(1)
    );

}



/* =========================================================
   3. NOT FOUND MIDDLEWARE

   This will be placed AFTER all valid routes in app.js.

   Example:

   GET /api/abcxyz

   No route exists.

   Result:

   404 Route not found.
   ========================================================= */

const notFoundMiddleware =
    (
        req,
        res,
        next
    ) => {

        next(

            new ApiError(

                HTTP_STATUS.NOT_FOUND,

                `Route not found: ${req.method} ${req.originalUrl}`

            )

        );

    };



/* =========================================================
   4. GLOBAL ERROR HANDLER

   IMPORTANT:

   Express recognizes error middleware because it contains
   FOUR parameters:

   error,
   req,
   res,
   next

   Do not remove "next" even if it is not normally used.
   ========================================================= */

const errorMiddleware =
    (
        error,
        req,
        res,
        next
    ) => {

        /*
           If response headers were already sent, allow
           Express to finish handling the error.
        */

        if (
            res.headersSent
        ) {

            return next(
                error
            );

        }


        const normalizedError =
            normalizeError(
                error
            );


        const statusCode =
            normalizedError.statusCode ||
            HTTP_STATUS.INTERNAL_SERVER_ERROR;



        /* =================================================
           SERVER LOGGING
           ================================================= */

        if (
            statusCode >=
            500
        ) {

            console.error(
                "\n[SKYRA ERROR]"
            );

            console.error(
                `${req.method} ${req.originalUrl}`
            );

            console.error(
                normalizedError.stack ||
                normalizedError.message
            );

        } else if (
            env.IS_DEVELOPMENT
        ) {

            console.warn(
                `[SKYRA ${
                    statusCode
                }] ${
                    req.method
                } ${
                    req.originalUrl
                } - ${
                    normalizedError.message
                }`
            );

        }



        /* =================================================
           RESPONSE BODY
           ================================================= */

        const response = {

            success:
                false,

            message:
                normalizedError.message ||
                "Something went wrong.",

            errors:
                Array.isArray(
                    normalizedError.errors
                )
                    ? normalizedError.errors
                    : []

        };



        /* =================================================
           DEVELOPMENT STACK TRACE

           Helpful locally.

           NEVER return stack traces in production because
           they can expose internal application information.
           ================================================= */

        if (
            env.IS_DEVELOPMENT
        ) {

            response.stack =
                normalizedError.stack;

        }



        /* =================================================
           SEND RESPONSE
           ================================================= */

        return res
            .status(
                statusCode
            )
            .json(
                response
            );

    };



/* =========================================================
   5. EXPORT
   ========================================================= */

module.exports = {

    notFoundMiddleware,

    errorMiddleware

};