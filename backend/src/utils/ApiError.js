"use strict";

/* =========================================================
   SKYRA - API ERROR UTILITY

   File:
   backend/src/utils/ApiError.js

   Purpose:
   Creates consistent application errors that can be handled
   by the global errorMiddleware.js.

   Example:

   throw new ApiError(
       404,
       "Venue not found."
   );

   Instead of manually writing:

   res.status(404).json(...)
   ========================================================= */


/* =========================================================
   API ERROR CLASS
   ========================================================= */

class ApiError extends Error {

    constructor(
        statusCode,
        message = "Something went wrong.",
        errors = [],
        stack = ""
    ) {

        /*
           Call the built-in Error constructor.

           This creates:
           - message
           - stack trace
        */

        super(message);


        /* =====================================================
           HTTP STATUS CODE

           Examples:

           400 → Bad Request
           401 → Unauthorized
           403 → Forbidden
           404 → Not Found
           409 → Conflict
           500 → Internal Server Error
           ===================================================== */

        this.statusCode =
            Number(statusCode) || 500;


        /* =====================================================
           SUCCESS

           Since this object represents an error,
           success must always be false.
           ===================================================== */

        this.success =
            false;


        /* =====================================================
           MESSAGE
           ===================================================== */

        this.message =
            message;


        /* =====================================================
           ADDITIONAL ERROR DETAILS

           Useful later for validation errors.

           Example:

           errors: [
               {
                   field: "email",
                   message: "Email is required."
               }
           ]
           ===================================================== */

        this.errors =
            Array.isArray(errors)
                ? errors
                : [];


        /* =====================================================
           OPERATIONAL ERROR FLAG

           This tells us that the error was intentionally
           created by our application.

           Examples:

           User not found
           Invalid password
           Seat already held
           Venue not found

           These are expected application errors.
           ===================================================== */

        this.isOperational =
            true;


        /* =====================================================
           ERROR NAME
           ===================================================== */

        this.name =
            this.constructor.name;


        /* =====================================================
           STACK TRACE
           ===================================================== */

        if (stack) {

            this.stack =
                stack;

        } else {

            Error.captureStackTrace(
                this,
                this.constructor
            );

        }

    }

}


/* =========================================================
   EXPORT
   ========================================================= */

module.exports =
    ApiError;