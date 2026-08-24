"use strict";

/* =========================================================
   SKYRA - AUTHENTICATION ROUTES

   File:
   backend/src/routes/authRoutes.js

   Base route will be:

   /api/auth

   Endpoints:

   POST /api/auth/register
   POST /api/auth/login
   GET  /api/auth/me
   POST /api/auth/forgot-password
   POST /api/auth/reset-password/:token

   Development authorization checks:

   GET /api/auth/check/customer
   GET /api/auth/check/organiser
   GET /api/auth/check/admin
   ========================================================= */


const express =
    require("express");


const router =
    express.Router();


/* =========================================================
   CONTROLLERS
   ========================================================= */

const {

    register,
    login,
    getMe,
    forgotPassword,
    resetPassword

} =
    require("../controllers/authController");


/* =========================================================
   AUTH VALIDATORS
   ========================================================= */

const {

    validateRegister,
    validateLogin,
    validateForgotPassword,
    validateResetPassword,
    validateResetToken

} =
    require("../validators/authValidator");


/* =========================================================
   VALIDATION MIDDLEWARE
   ========================================================= */

const {

    validateBody,
    validateParam

} =
    require("../middleware/validationMiddleware");


/* =========================================================
   AUTHENTICATION MIDDLEWARE
   ========================================================= */

const authMiddleware =
    require("../middleware/authMiddleware");


/* =========================================================
   ROLE MIDDLEWARE

   These three role-check routes help us test Phase 2.

   They can also be removed later once Admin, Organiser and
   Customer modules have their real protected routes.
   ========================================================= */

const {

    customerOnly,
    organiserOnly,
    adminOnly

} =
    require("../middleware/roleMiddleware");


/* =========================================================
   1. REGISTER

   POST /api/auth/register

   PUBLIC ROUTE

   Allowed:
   CUSTOMER
   ORGANISER

   ADMIN public registration is blocked by:
   - authValidator.js
   - authService.js
   ========================================================= */

router.post(
    "/register",

    validateBody(
        validateRegister
    ),

    register
);


/* =========================================================
   2. LOGIN

   POST /api/auth/login

   PUBLIC ROUTE

   All valid account roles can use the same login:

   CUSTOMER
   ORGANISER
   ADMIN
   ========================================================= */

router.post(
    "/login",

    validateBody(
        validateLogin
    ),

    login
);


/* =========================================================
   3. GET CURRENT AUTHENTICATED USER

   GET /api/auth/me

   PROTECTED ROUTE

   Header:

   Authorization: Bearer <JWT>
   ========================================================= */

router.get(
    "/me",

    authMiddleware,

    getMe
);


/* =========================================================
   4. FORGOT PASSWORD

   POST /api/auth/forgot-password

   PUBLIC ROUTE

   Body:

   {
       "email": "user@example.com"
   }
   ========================================================= */

router.post(
    "/forgot-password",

    validateBody(
        validateForgotPassword
    ),

    forgotPassword
);


/* =========================================================
   5. RESET PASSWORD

   POST /api/auth/reset-password/:token

   PUBLIC ROUTE

   Example:

   POST
   /api/auth/reset-password/abc123...

   Body:

   {
       "password": "NewPassword123",
       "confirmPassword": "NewPassword123"
   }

   Validation order:

   1. Validate token
   2. Validate password
   3. Controller
   ========================================================= */

router.post(
    "/reset-password/:token",

    validateParam(
        "token",
        validateResetToken
    ),

    validateBody(
        validateResetPassword
    ),

    resetPassword
);


/* =========================================================
   6. CUSTOMER ROLE CHECK

   GET /api/auth/check/customer

   Used during Phase 2 testing.

   CUSTOMER     → 200
   ORGANISER    → 403
   ADMIN        → 403
   No JWT       → 401
   ========================================================= */

router.get(
    "/check/customer",

    authMiddleware,

    customerOnly,

    (
        req,
        res
    ) => {

        return res
            .status(200)
            .json({

                success:
                    true,

                message:
                    "Customer authorization successful.",

                data: {

                    userId:
                        req.user._id,

                    role:
                        req.user.role

                }

            });

    }
);


/* =========================================================
   7. ORGANISER ROLE CHECK

   GET /api/auth/check/organiser

   CUSTOMER     → 403
   ORGANISER    → 200
   ADMIN        → 403
   ========================================================= */

router.get(
    "/check/organiser",

    authMiddleware,

    organiserOnly,

    (
        req,
        res
    ) => {

        return res
            .status(200)
            .json({

                success:
                    true,

                message:
                    "Organiser authorization successful.",

                data: {

                    userId:
                        req.user._id,

                    role:
                        req.user.role

                }

            });

    }
);


/* =========================================================
   8. ADMIN ROLE CHECK

   GET /api/auth/check/admin

   CUSTOMER     → 403
   ORGANISER    → 403
   ADMIN        → 200

   This will be useful after createAdmin.js is completed.
   ========================================================= */

router.get(
    "/check/admin",

    authMiddleware,

    adminOnly,

    (
        req,
        res
    ) => {

        return res
            .status(200)
            .json({

                success:
                    true,

                message:
                    "Admin authorization successful.",

                data: {

                    userId:
                        req.user._id,

                    role:
                        req.user.role

                }

            });

    }
);


/* =========================================================
   9. EXPORT ROUTER
   ========================================================= */

module.exports =
    router;