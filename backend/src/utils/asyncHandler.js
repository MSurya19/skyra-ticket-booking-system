"use strict";

/* =========================================================
   SKYRA - ASYNC HANDLER UTILITY

   File:
   backend/src/utils/asyncHandler.js

   Purpose:
   Wrap asynchronous Express route handlers and automatically
   pass errors to the global error middleware.

   This avoids writing try/catch repeatedly inside every
   controller.
   ========================================================= */


/* =========================================================
   ASYNC HANDLER
   ========================================================= */

const asyncHandler =
    (requestHandler) => {

        return (
            req,
            res,
            next
        ) => {

            Promise
                .resolve(
                    requestHandler(
                        req,
                        res,
                        next
                    )
                )
                .catch(
                    next
                );

        };

    };


/* =========================================================
   EXPORT
   ========================================================= */

module.exports =
    asyncHandler;