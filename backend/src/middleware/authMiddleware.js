"use strict";

/* =========================================================
   SKYRA - AUTHENTICATION MIDDLEWARE

   File:
   backend/src/middleware/authMiddleware.js

   Purpose:
   - Read JWT from Authorization header
   - Verify JWT signature and expiry
   - Extract authenticated user ID
   - Load latest User from MongoDB
   - Reject deleted users
   - Reject suspended users
   - Reject JWTs issued before a password change
   - Attach authenticated user to req.user

   Expected request header:

   Authorization: Bearer <JWT_TOKEN>
   ========================================================= */


const jwt =
    require("jsonwebtoken");


const User =
    require("../models/User");


const ApiError =
    require("../utils/ApiError");


const asyncHandler =
    require("../utils/asyncHandler");


const env =
    require("../config/env");


const {
    HTTP_STATUS,
    USER_STATUS
} =
    require("../utils/constants");



/* =========================================================
   1. EXTRACT BEARER TOKEN

   Expected:

   Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

   Returns:
   JWT string

   If missing/invalid:
   returns null
   ========================================================= */

function extractBearerToken(
    req
) {

    const authorizationHeader =
        req.get(
            "authorization"
        );


    if (!authorizationHeader) {

        return null;

    }


    const match =
        authorizationHeader.match(
            /^Bearer\s+(.+)$/i
        );


    if (!match) {

        return null;

    }


    const token =
        match[1]?.trim();


    return token ||
        null;

}



/* =========================================================
   2. VERIFY JWT

   Tokens are signed inside authService.js using:

   jwt.sign(
       {
           sub: user._id,
           role: user.role
       },
       JWT_SECRET
   )

   So decoded.sub contains the MongoDB User ID.
   ========================================================= */

function verifyAccessToken(
    token
) {

    if (
        !env.JWT_SECRET ||
        !String(
            env.JWT_SECRET
        ).trim()
    ) {

        throw new ApiError(

            HTTP_STATUS.INTERNAL_SERVER_ERROR,

            "JWT configuration is missing."

        );

    }


    try {

        return jwt.verify(
            token,
            env.JWT_SECRET,
            {

                /*
                   authService.js currently signs with the
                   default HS256 algorithm.

                   Explicit verification prevents accepting
                   unexpected algorithms.
                */

                algorithms: [
                    "HS256"
                ]

            }
        );

    } catch (error) {

        /* =================================================
           EXPIRED TOKEN
           ================================================= */

        if (
            error.name ===
            "TokenExpiredError"
        ) {

            throw new ApiError(

                HTTP_STATUS.UNAUTHORIZED,

                "Authentication token has expired. Please login again."

            );

        }


        /* =================================================
           INVALID TOKEN
           ================================================= */

        if (
            error.name ===
            "JsonWebTokenError" ||
            error.name ===
            "NotBeforeError"
        ) {

            throw new ApiError(

                HTTP_STATUS.UNAUTHORIZED,

                "Invalid authentication token."

            );

        }


        throw error;

    }

}



/* =========================================================
   3. AUTHENTICATION MIDDLEWARE

   Usage later:

   router.get(
       "/me",
       authMiddleware,
       getMe
   );

   Or:

   router.get(
       "/admin/users",
       authMiddleware,
       requireRole("ADMIN"),
       getUsers
   );
   ========================================================= */

const authMiddleware =
    asyncHandler(
        async (
            req,
            res,
            next
        ) => {

            /* =================================================
               STEP 1
               READ JWT
               ================================================= */

            const token =
                extractBearerToken(
                    req
                );


            if (!token) {

                throw new ApiError(

                    HTTP_STATUS.UNAUTHORIZED,

                    "Authentication required. Please provide a valid Bearer token."

                );

            }



            /* =================================================
               STEP 2
               VERIFY JWT
               ================================================= */

            const decoded =
                verifyAccessToken(
                    token
                );



            /* =================================================
               STEP 3
               GET USER ID FROM JWT

               authService uses:

               sub = user._id
               ================================================= */

            const userId =
                decoded?.sub;


            if (
                !userId ||
                typeof userId !==
                    "string"
            ) {

                throw new ApiError(

                    HTTP_STATUS.UNAUTHORIZED,

                    "Invalid authentication token."

                );

            }



            /* =================================================
               STEP 4
               LOAD CURRENT USER FROM DATABASE

               We deliberately query MongoDB instead of trusting
               all information inside the JWT.

               Why?

               User may have been:
               - suspended
               - changed role
               - deleted
               - changed password
               ================================================= */

            const user =
                await User.findById(
                    userId
                );


            /* =================================================
               USER WAS DELETED
               ================================================= */

            if (!user) {

                throw new ApiError(

                    HTTP_STATUS.UNAUTHORIZED,

                    "The account associated with this authentication token no longer exists."

                );

            }



            /* =================================================
               STEP 5
               CHECK ACCOUNT STATUS

               Admin can suspend Customer / Organiser accounts.

               A previously issued JWT must not allow a suspended
               account to continue accessing protected APIs.
               ================================================= */

            if (
                user.status !==
                USER_STATUS.ACTIVE
            ) {

                throw new ApiError(

                    HTTP_STATUS.FORBIDDEN,

                    "Your account is currently suspended."

                );

            }



            /* =================================================
               STEP 6
               CHECK PASSWORD CHANGE

               Example:

               Login at 10:00
                   ↓
               JWT issued

               Password reset at 10:30
                   ↓
               passwordChangedAt = 10:30

               Old token issued at 10:00 must become invalid.
               ================================================= */

            if (
                decoded.iat &&
                user.changedPasswordAfter(
                    decoded.iat
                )
            ) {

                throw new ApiError(

                    HTTP_STATUS.UNAUTHORIZED,

                    "Password was changed after this token was issued. Please login again."

                );

            }



            /* =================================================
               STEP 7
               ATTACH AUTHENTICATED USER TO REQUEST

               Controllers and role middleware can now use:

               req.user._id
               req.user.name
               req.user.email
               req.user.role
               req.user.status
               ================================================= */

            req.user =
                user;



            /* =================================================
               STEP 8
               OPTIONAL AUTH METADATA

               Useful later during debugging/testing without
               relying directly on JWT payload everywhere.
               ================================================= */

            req.auth = {

                userId:
                    user._id.toString(),

                role:
                    user.role,

                issuedAt:
                    decoded.iat ||
                    null,

                expiresAt:
                    decoded.exp ||
                    null

            };


            return next();

        }
    );



/* =========================================================
   4. EXPORT HELPERS

   Main export:
   authMiddleware

   Helpers are also exported because they can be useful
   during automated authentication tests.
   ========================================================= */

module.exports =
    authMiddleware;


module.exports.authMiddleware =
    authMiddleware;


module.exports.extractBearerToken =
    extractBearerToken;


module.exports.verifyAccessToken =
    verifyAccessToken;