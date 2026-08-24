"use strict";

/* =========================================================
   SKYRA - ROLE AUTHORIZATION MIDDLEWARE

   File:
   backend/src/middleware/roleMiddleware.js

   Purpose:
   - Restrict routes by user role
   - Work AFTER authMiddleware.js
   - Allow one or multiple roles
   - Return 401 if authentication middleware was not used
   - Return 403 if user is authenticated but not authorized

   Example:

   router.get(
       "/admin/users",
       authMiddleware,
       requireRole("ADMIN"),
       getUsers
   );

   Example with multiple roles:

   requireRole(
       "CUSTOMER",
       "ORGANISER"
   )
   ========================================================= */


const ApiError =
    require("../utils/ApiError");


const {
    USER_ROLES,
    HTTP_STATUS
} =
    require("../utils/constants");



/* =========================================================
   1. VALID APPLICATION ROLES
   ========================================================= */

const VALID_ROLES =
    Object.values(
        USER_ROLES
    );



/* =========================================================
   2. NORMALIZE ROLE
   ========================================================= */

function normalizeRole(
    role
) {

    if (
        role === undefined ||
        role === null
    ) {

        return "";

    }


    return String(
        role
    )
        .trim()
        .toUpperCase();

}



/* =========================================================
   3. REQUIRE ROLE

   Usage:

   requireRole("ADMIN")

   requireRole(
       "CUSTOMER",
       "ORGANISER"
   )

   You may also pass:

   requireRole(
       USER_ROLES.ADMIN
   )
   ========================================================= */

function requireRole(
    ...allowedRoles
) {

    /* =====================================================
       NORMALIZE CONFIGURED ROLES
       ===================================================== */

    const normalizedRoles =
        allowedRoles
            .flat()
            .map(
                normalizeRole
            )
            .filter(Boolean);


    /* =====================================================
       CONFIGURATION VALIDATION
       ===================================================== */

    if (
        normalizedRoles.length ===
        0
    ) {

        throw new TypeError(
            "requireRole() needs at least one allowed role."
        );

    }


    const invalidRoles =
        normalizedRoles.filter(
            (role) =>
                !VALID_ROLES.includes(
                    role
                )
        );


    if (
        invalidRoles.length >
        0
    ) {

        throw new TypeError(
            `Invalid role supplied to requireRole(): ${invalidRoles.join(", ")}`
        );

    }



    /* =====================================================
       EXPRESS MIDDLEWARE
       ===================================================== */

    return (
        req,
        res,
        next
    ) => {

        /* =================================================
           AUTHENTICATION CHECK

           authMiddleware should run before this middleware.

           Expected:

           req.user = User document
           ================================================= */

        if (
            !req.user
        ) {

            return next(

                new ApiError(

                    HTTP_STATUS.UNAUTHORIZED,

                    "Authentication is required."

                )

            );

        }



        /* =================================================
           GET CURRENT USER ROLE
           ================================================= */

        const currentRole =
            normalizeRole(
                req.user.role
            );


        if (!currentRole) {

            return next(

                new ApiError(

                    HTTP_STATUS.FORBIDDEN,

                    "Your account does not have a valid role."

                )

            );

        }



        /* =================================================
           AUTHORIZATION CHECK
           ================================================= */

        if (
            !normalizedRoles.includes(
                currentRole
            )
        ) {

            return next(

                new ApiError(

                    HTTP_STATUS.FORBIDDEN,

                    "You do not have permission to access this resource."

                )

            );

        }



        /* =================================================
           USER IS AUTHORIZED
           ================================================= */

        return next();

    };

}



/* =========================================================
   4. CONVENIENCE MIDDLEWARE

   These are optional helpers.

   Instead of:

   requireRole(USER_ROLES.ADMIN)

   routes can use:

   adminOnly
   ========================================================= */

const adminOnly =
    requireRole(
        USER_ROLES.ADMIN
    );


const organiserOnly =
    requireRole(
        USER_ROLES.ORGANISER
    );


const customerOnly =
    requireRole(
        USER_ROLES.CUSTOMER
    );


const customerOrOrganiser =
    requireRole(

        USER_ROLES.CUSTOMER,

        USER_ROLES.ORGANISER

    );



/* =========================================================
   5. EXPORT
   ========================================================= */

module.exports = {

    requireRole,

    adminOnly,

    organiserOnly,

    customerOnly,

    customerOrOrganiser

};