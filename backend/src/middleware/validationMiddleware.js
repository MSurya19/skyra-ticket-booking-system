"use strict";

/* =========================================================
   SKYRA - VALIDATION MIDDLEWARE

   File:
   backend/src/middleware/validationMiddleware.js

   Purpose:
   - Run validator functions before controllers
   - Reject invalid request data
   - Replace req.body / req.params values with sanitized data
   - Forward validation errors to errorMiddleware.js

   Works with validators such as:

   validateRegister()
   validateLogin()
   validateForgotPassword()
   validateResetPassword()
   validateResetToken()
   ========================================================= */


const ApiError =
    require("../utils/ApiError");


const {
    HTTP_STATUS
} =
    require("../utils/constants");



/* =========================================================
   1. VALIDATOR FUNCTION CHECK
   ========================================================= */

function ensureValidator(
    validator
) {

    if (
        typeof validator !==
        "function"
    ) {

        throw new TypeError(
            "A valid validator function is required."
        );

    }

}



/* =========================================================
   2. VALIDATION RESULT CHECK

   Every SKYRA validator should return:

   {
       isValid: true/false,
       errors: [],
       data: {}
   }
   ========================================================= */

function normalizeValidationResult(
    result
) {

    if (
        !result ||
        typeof result !==
        "object"
    ) {

        throw new Error(
            "Validator must return a validation result object."
        );

    }


    return {

        isValid:
            result.isValid ===
            true,

        errors:
            Array.isArray(
                result.errors
            )
                ? result.errors
                : [],

        data:
            result.data &&
            typeof result.data ===
            "object"
                ? result.data
                : {}

    };

}



/* =========================================================
   3. BODY VALIDATION MIDDLEWARE

   Usage:

   router.post(
       "/register",
       validateBody(validateRegister),
       register
   );

   Flow:

   req.body
      ↓
   validator(req.body)
      ↓
   invalid → ApiError(400)
      ↓
   valid → req.body replaced with sanitized data
      ↓
   controller
   ========================================================= */

function validateBody(
    validator
) {

    ensureValidator(
        validator
    );


    return (
        req,
        res,
        next
    ) => {

        try {

            const result =
                normalizeValidationResult(
                    validator(
                        req.body
                    )
                );


            /* ===============================================
               INVALID REQUEST BODY
               =============================================== */

            if (
                !result.isValid
            ) {

                return next(

                    new ApiError(

                        HTTP_STATUS.BAD_REQUEST,

                        "Validation failed.",

                        result.errors

                    )

                );

            }


            /* ===============================================
               SANITIZED BODY

               Replace the original request body.

               Example malicious body:

               {
                   name: "User",
                   role: "CUSTOMER",
                   emailVerified: true
               }

               If validator returns only:

               {
                   name,
                   role
               }

               emailVerified disappears before controller.
               =============================================== */

            req.body =
                result.data;


            return next();

        } catch (error) {

            return next(
                error
            );

        }

    };

}



/* =========================================================
   4. SINGLE URL PARAMETER VALIDATION

   Useful for:

   POST /api/auth/reset-password/:token

   Usage:

   validateParam(
       "token",
       validateResetToken
   )

   The validator receives only:

   req.params.token
   ========================================================= */

function validateParam(
    paramName,
    validator
) {

    ensureValidator(
        validator
    );


    if (
        typeof paramName !==
            "string" ||
        !paramName.trim()
    ) {

        throw new TypeError(
            "A valid parameter name is required."
        );

    }


    const normalizedParamName =
        paramName.trim();


    return (
        req,
        res,
        next
    ) => {

        try {

            const value =
                req.params[
                    normalizedParamName
                ];


            const result =
                normalizeValidationResult(
                    validator(
                        value
                    )
                );


            if (
                !result.isValid
            ) {

                return next(

                    new ApiError(

                        HTTP_STATUS.BAD_REQUEST,

                        "Validation failed.",

                        result.errors

                    )

                );

            }


            /*
               Example:

               validateResetToken("abc")

               returns:

               {
                   data: {
                       token: "abc"
                   }
               }

               We copy validated values into req.params.
            */

            req.params = {

                ...req.params,

                ...result.data

            };


            return next();

        } catch (error) {

            return next(
                error
            );

        }

    };

}



/* =========================================================
   5. COMPLETE PARAM OBJECT VALIDATION

   This will be useful later for backend routes such as:

   /api/admin/venues/:venueId

   /api/bookings/:bookingId

   /api/shows/:showId

   Validator receives:

   req.params
   ========================================================= */

function validateParams(
    validator
) {

    ensureValidator(
        validator
    );


    return (
        req,
        res,
        next
    ) => {

        try {

            const result =
                normalizeValidationResult(
                    validator(
                        req.params
                    )
                );


            if (
                !result.isValid
            ) {

                return next(

                    new ApiError(

                        HTTP_STATUS.BAD_REQUEST,

                        "Validation failed.",

                        result.errors

                    )

                );

            }


            req.params =
                result.data;


            return next();

        } catch (error) {

            return next(
                error
            );

        }

    };

}



/* =========================================================
   6. QUERY STRING VALIDATION

   Useful later for APIs such as:

   GET /api/events?type=CONCERT&city=Chennai

   GET /api/admin/users?status=ACTIVE

   GET /api/admin/bookings?customer=...

   Validator receives:

   req.query
   ========================================================= */

function validateQuery(
    validator
) {

    ensureValidator(
        validator
    );


    return (
        req,
        res,
        next
    ) => {

        try {

            const result =
                normalizeValidationResult(
                    validator(
                        req.query
                    )
                );


            if (
                !result.isValid
            ) {

                return next(

                    new ApiError(

                        HTTP_STATUS.BAD_REQUEST,

                        "Validation failed.",

                        result.errors

                    )

                );

            }


            /*
               Express query objects can behave differently
               depending on configuration.

               Instead of replacing req.query completely,
               copy sanitized values into it.
            */

            Object.keys(
                req.query
            ).forEach(
                (key) => {

                    delete req.query[
                        key
                    ];

                }
            );


            Object.assign(
                req.query,
                result.data
            );


            return next();

        } catch (error) {

            return next(
                error
            );

        }

    };

}



/* =========================================================
   7. EXPORT
   ========================================================= */

module.exports = {

    validateBody,

    validateParam,

    validateParams,

    validateQuery

};