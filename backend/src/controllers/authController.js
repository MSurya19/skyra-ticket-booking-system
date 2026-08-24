"use strict";

/* =========================================================
   SKYRA - AUTHENTICATION CONTROLLER

   File:
   backend/src/controllers/authController.js

   Purpose:
   Convert HTTP requests into calls to authService and send
   consistent HTTP responses back to the frontend.

   Handles:
   - Register
   - Login
   - Get current authenticated user
   - Forgot password
   - Reset password

   Business logic remains inside:
   services/authService.js
   ========================================================= */


const asyncHandler =
    require("../utils/asyncHandler");


const ApiError =
    require("../utils/ApiError");


const env =
    require("../config/env");


const {

    HTTP_STATUS

} =
    require("../utils/constants");


const {

    registerUser,
    loginUser,
    getCurrentUser,
    requestPasswordReset,
    resetPassword

} =
    require("../services/authService");


/* =========================================================
   1. REGISTER

   POST /api/auth/register

   Body example:

   {
       "name": "Surya",
       "email": "surya@example.com",
       "password": "Password123",
       "confirmPassword": "Password123",
       "role": "CUSTOMER"
   }

   Organiser registration can additionally contain:

   {
       "organiserProfile": {
           "businessName": "Skyline Events",
           "contactPerson": "Surya"
       }
   }
   ========================================================= */

const register =
    asyncHandler(
        async (
            req,
            res
        ) => {

            /*
               req.body has already been sanitized by:

               validationMiddleware.js
                   ↓
               authValidator.js
            */

            const result =
                await registerUser(
                    req.body
                );


            return res
                .status(
                    HTTP_STATUS.CREATED
                )
                .json({

                    success:
                        true,

                    message:
                        "Account registered successfully.",

                    data: {

                        user:
                            result.user,

                        token:
                            result.token

                    }

                });

        }
    );


/* =========================================================
   2. LOGIN

   POST /api/auth/login

   Body:

   {
       "email": "surya@example.com",
       "password": "Password123"
   }

   Response includes:
   - authenticated user
   - JWT token
   ========================================================= */

const login =
    asyncHandler(
        async (
            req,
            res
        ) => {

            const result =
                await loginUser(
                    req.body
                );


            return res
                .status(
                    HTTP_STATUS.OK
                )
                .json({

                    success:
                        true,

                    message:
                        "Login successful.",

                    data: {

                        user:
                            result.user,

                        token:
                            result.token

                    }

                });

        }
    );


/* =========================================================
   3. GET CURRENT USER

   GET /api/auth/me

   Protected by authMiddleware.js.

   authMiddleware will later set:

   req.user

   Example:

   req.user = {
       _id: "...",
       role: "CUSTOMER",
       ...
   };
   ========================================================= */

const getMe =
    asyncHandler(
        async (
            req,
            res
        ) => {

            /*
               Support the possible ID properties used by the
               authentication middleware.

               Main expected value:

               req.user._id
            */

            const userId =
                req.user?._id ||
                req.user?.id ||
                req.user?.userId;


            if (!userId) {

                throw new ApiError(

                    HTTP_STATUS.UNAUTHORIZED,

                    "Authentication is required."

                );

            }


            /*
               Fetch fresh data from MongoDB instead of simply
               returning old JWT information.

               This ensures account status and profile changes
               are always current.
            */

            const user =
                await getCurrentUser(
                    userId
                );


            return res
                .status(
                    HTTP_STATUS.OK
                )
                .json({

                    success:
                        true,

                    message:
                        "Authenticated user retrieved successfully.",

                    data: {

                        user

                    }

                });

        }
    );


/* =========================================================
   4. FORGOT PASSWORD

   POST /api/auth/forgot-password

   Body:

   {
       "email": "surya@example.com"
   }

   Security:

   We return the SAME public response whether the email
   exists or not.

   This avoids account enumeration.

   During development only, the reset token may be returned
   so we can test Phase 2 before emailService.js is built.
   ========================================================= */

const forgotPassword =
    asyncHandler(
        async (
            req,
            res
        ) => {

            const {

                email

            } =
                req.body;


            const result =
                await requestPasswordReset(
                    email
                );


            /* =================================================
               GENERIC RESPONSE

               Do not say:
               "Email not found."

               Someone could otherwise use this API to discover
               which email addresses have SKYRA accounts.
               ================================================= */

            const response = {

                success:
                    true,

                message:
                    "If an account exists for this email, password reset instructions have been generated."

            };


            /* =================================================
               DEVELOPMENT-ONLY RESET TOKEN

               Email delivery is implemented later.

               For now this lets us test:

               forgot-password
                    ↓
               receive dev token
                    ↓
               reset-password/:token

               NEVER expose this token in production.
               ================================================= */

            if (
                env.IS_DEVELOPMENT &&
                result.userExists &&
                result.resetToken
            ) {

                response.data = {

                    developmentResetToken:
                        result.resetToken,

                    expiresAt:
                        result.expiresAt

                };

            }


            return res
                .status(
                    HTTP_STATUS.OK
                )
                .json(
                    response
                );

        }
    );


/* =========================================================
   5. RESET PASSWORD

   POST /api/auth/reset-password/:token

   Example:

   POST
   /api/auth/reset-password/ABC123...

   Body:

   {
       "password": "NewPassword123",
       "confirmPassword": "NewPassword123"
   }

   authValidator will sanitize body so normally only:

   {
       password
   }

   reaches this controller.
   ========================================================= */

const resetPasswordController =
    asyncHandler(
        async (
            req,
            res
        ) => {

            const token =
                req.params?.token;


            const password =
                req.body?.password;


            if (!token) {

                throw new ApiError(

                    HTTP_STATUS.BAD_REQUEST,

                    "Password reset token is required."

                );

            }


            if (!password) {

                throw new ApiError(

                    HTTP_STATUS.BAD_REQUEST,

                    "New password is required."

                );

            }


            const result =
                await resetPassword(
                    token,
                    password
                );


            return res
                .status(
                    HTTP_STATUS.OK
                )
                .json({

                    success:
                        true,

                    message:
                        "Password reset successfully. You can now login using your new password.",

                    data: {

                        user:
                            result.user

                    }

                });

        }
    );


/* =========================================================
   6. EXPORT CONTROLLERS
   ========================================================= */

module.exports = {

    register,

    login,

    getMe,

    forgotPassword,

    resetPassword:
        resetPasswordController

};