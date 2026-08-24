"use strict";

/* =========================================================
   SKYRA - AUTHENTICATION SERVICE

   File:
   backend/src/services/authService.js

   Responsibilities:
   - Register Customer / Organiser
   - Prevent public Admin registration
   - Check duplicate email
   - Login users
   - Verify account status
   - Generate JWT access token
   - Fetch authenticated user
   - Generate password-reset token
   - Reset password securely

   This file does NOT:
   - read req / res
   - send HTTP responses
   - validate form structure
   - send email directly

   Those responsibilities belong to:
   validators/
   controllers/
   emailService.js
   ========================================================= */


const jwt =
    require("jsonwebtoken");

const crypto =
    require("crypto");


const User =
    require("../models/User");

const ApiError =
    require("../utils/ApiError");

const env =
    require("../config/env");

const {
    sendPasswordResetEmail
} =
    require("./emailService");


const {
    USER_ROLES,
    USER_STATUS,
    HTTP_STATUS
} =
    require("../utils/constants");


/* =========================================================
   generateResetToken.js

   We will create this file shortly.

   It will export:

   generateResetToken()
   hashResetToken()
   ========================================================= */

const {
    generateResetToken,
    hashResetToken
} =
    require("../utils/generateResetToken");


/* =========================================================
   1. AUTHENTICATION CONFIGURATION
   ========================================================= */

const ACCESS_TOKEN_EXPIRES_IN =
    "7d";

const PASSWORD_RESET_MINUTES =
    15;


/* =========================================================
   2. ENSURE JWT SECRET EXISTS

   JWT_SECRET becomes mandatory from Phase 2 onward.
   ========================================================= */

function ensureJwtSecret() {

    if (
        !env.JWT_SECRET ||
        !String(env.JWT_SECRET).trim()
    ) {

        throw new ApiError(
            HTTP_STATUS.INTERNAL_SERVER_ERROR,
            "JWT configuration is missing."
        );

    }

}


/* =========================================================
   3. GENERATE JWT ACCESS TOKEN

   JWT payload contains only the minimum identity data.

   Example payload:

   {
       sub: "MongoDB user id",
       role: "CUSTOMER"
   }

   sub = subject
   ========================================================= */

function generateAccessToken(
    user
) {

    ensureJwtSecret();


    return jwt.sign(
        {

            sub:
                user._id.toString(),

            role:
                user.role

        },
        env.JWT_SECRET,
        {

            expiresIn:
                ACCESS_TOKEN_EXPIRES_IN

        }
    );

}


/* =========================================================
   4. CREATE SAFE USER OBJECT
   ========================================================= */

function createSafeUser(
    user
) {

    if (!user) {

        return null;

    }


    if (
        typeof user.toSafeObject ===
        "function"
    ) {

        return user.toSafeObject();

    }


    const object =
        typeof user.toObject ===
        "function"
            ? user.toObject()
            : {
                ...user
            };


    delete object.password;

    delete object.resetPasswordToken;

    delete object.resetPasswordExpiresAt;


    return object;

}


/* =========================================================
   5. REGISTER USER

   Public registration supports only:

   CUSTOMER
   ORGANISER

   ADMIN is blocked here AGAIN even though authValidator.js
   already blocks it.

   This is defense-in-depth.
   ========================================================= */

async function registerUser(
    registrationData
) {

    const {

        name,
        email,
        password,
        role,
        phone,
        city,
        state,
        country,
        organiserProfile

    } =
        registrationData;


    /* =====================================================
       PUBLIC ROLE CHECK
       ===================================================== */

    const allowedRoles = [

        USER_ROLES.CUSTOMER,

        USER_ROLES.ORGANISER

    ];


    if (
        !allowedRoles.includes(
            role
        )
    ) {

        throw new ApiError(
            HTTP_STATUS.FORBIDDEN,
            "Public registration is allowed only for Customer or Organiser accounts."
        );

    }


    /* =====================================================
       DUPLICATE EMAIL CHECK

       MongoDB unique index still remains the final protection
       against race conditions.
       ===================================================== */

    const existingUser =
        await User.findOne({

            email:
                email.toLowerCase()

        });


    if (existingUser) {

        throw new ApiError(
            HTTP_STATUS.CONFLICT,
            "Email already exists.",
            [
                {

                    field:
                        "email",

                    message:
                        "An account with this email already exists."

                }
            ]
        );

    }


    /* =====================================================
       USER PAYLOAD

       Never allow client-controlled fields such as:

       status
       emailVerified
       resetPasswordToken
       passwordChangedAt
       ===================================================== */

    const userData = {

        name,

        email:
            email.toLowerCase(),

        password,

        role

    };


    if (phone) {

        userData.phone =
            phone;

    }


    if (city) {

        userData.city =
            city;

    }


    if (state) {

        userData.state =
            state;

    }


    if (country) {

        userData.country =
            country;

    }


    if (
        role ===
        USER_ROLES.ORGANISER
    ) {

        userData.organiserProfile =
            organiserProfile || {

                businessName:
                    null,

                contactPerson:
                    name,

                description:
                    null

            };

    }


    /* =====================================================
       CREATE USER

       User.js pre-save middleware automatically hashes
       the password using bcrypt.
       ===================================================== */

    const user =
        await User.create(
            userData
        );


    /* =====================================================
       GENERATE JWT

       Registration returns a token so the account can be
       authenticated immediately if the frontend wants that
       behavior.

       The controller can decide whether to use it.
       ===================================================== */

    const token =
        generateAccessToken(
            user
        );


    return {

        user:
            createSafeUser(
                user
            ),

        token

    };

}


/* =========================================================
   6. LOGIN USER

   Login flow:

   email
      ↓
   find user + password
      ↓
   bcrypt compare
      ↓
   verify account ACTIVE
      ↓
   create JWT
   ========================================================= */

async function loginUser(
    credentials
) {

    const {

        email,
        password

    } =
        credentials;


    /* =====================================================
       PASSWORD IS select:false IN USER MODEL

       So login explicitly requests it using:

       .select("+password")
       ===================================================== */

    const user =
        await User
            .findOne({

                email:
                    email.toLowerCase()

            })
            .select(
                "+password"
            );


    /* =====================================================
       GENERIC INVALID CREDENTIAL RESPONSE

       Do not reveal whether:

       email is wrong
       OR
       password is wrong
       ===================================================== */

    if (!user) {

        throw new ApiError(
            HTTP_STATUS.UNAUTHORIZED,
            "Invalid email or password."
        );

    }


    const passwordMatches =
        await user.comparePassword(
            password
        );


    if (!passwordMatches) {

        throw new ApiError(
            HTTP_STATUS.UNAUTHORIZED,
            "Invalid email or password."
        );

    }


    /* =====================================================
       ACCOUNT STATUS
       ===================================================== */

    if (
        user.status !==
        USER_STATUS.ACTIVE
    ) {

        throw new ApiError(
            HTTP_STATUS.FORBIDDEN,
            "Your account is currently suspended."
        );

    }


    /* =====================================================
       UPDATE LAST LOGIN
       ===================================================== */

    user.lastLoginAt =
        new Date();


    await user.save({

        validateBeforeSave:
            false

    });


    /* =====================================================
       GENERATE TOKEN
       ===================================================== */

    const token =
        generateAccessToken(
            user
        );


    return {

        user:
            createSafeUser(
                user
            ),

        token

    };

}


/* =========================================================
   7. GET AUTHENTICATED USER

   authMiddleware.js will later extract user ID from JWT.

   This service can then retrieve the latest user record.

   Important:
   We always trust the database more than old JWT role/status
   information.
   ========================================================= */

async function getCurrentUser(
    userId
) {

    const user =
        await User.findById(
            userId
        );


    if (!user) {

        throw new ApiError(
            HTTP_STATUS.UNAUTHORIZED,
            "Authentication session is no longer valid."
        );

    }


    if (
        user.status !==
        USER_STATUS.ACTIVE
    ) {

        throw new ApiError(
            HTTP_STATUS.FORBIDDEN,
            "Your account is currently suspended."
        );

    }


    return createSafeUser(
        user
    );

}


/* =========================================================
   8. REQUEST PASSWORD RESET

   Security flow:

   User enters email
       ↓
   Generate cryptographically secure random token
       ↓
   Hash token using SHA-256
       ↓
   Store only HASH in MongoDB
       ↓
   Raw token goes into reset URL

   Example:

   frontend/reset-password.html?token=RAW_TOKEN

   IMPORTANT:
   Controller should always send a generic response so users
   cannot discover which email addresses are registered.
   ========================================================= */

async function requestPasswordReset(
    email
) {

    const normalizedEmail =
        String(email || "")
            .trim()
            .toLowerCase();


    const user =
        await User.findOne({

            email:
                normalizedEmail

        });


    /* =====================================================
       USER DOES NOT EXIST

       Do not throw 404.

       The controller should send the same generic response
       whether or not the account exists.
       ===================================================== */

    if (!user) {

        return {

            userExists:
                false,

            resetToken:
                null,

            expiresAt:
                null,

            emailSent:
                false

        };

    }


    /* =====================================================
       GENERATE RESET TOKEN

       Only the SHA-256 hash is stored in MongoDB.
       The raw token is used only to build the reset link.
       ===================================================== */

    const {

        token,
        hashedToken,
        expiresAt

    } =
        generateResetToken(
            PASSWORD_RESET_MINUTES
        );


    user.resetPasswordToken =
        hashedToken;


    user.resetPasswordExpiresAt =
        expiresAt;


    await user.save({

        validateBeforeSave:
            false

    });


    /* =====================================================
       SEND PASSWORD RESET EMAIL

       emailService.js creates the final reset URL:

       http://localhost:5500/reset-password.html?token=...

       If sending fails, remove the newly-created token so an
       undelivered reset link does not remain active.
       ===================================================== */

    try {

        await sendPasswordResetEmail({

            to:
                user.email,

            name:
                user.name,

            resetToken:
                token,

            expiresInMinutes:
                PASSWORD_RESET_MINUTES

        });

    } catch (error) {

        user.resetPasswordToken =
            null;

        user.resetPasswordExpiresAt =
            null;


        try {

            await user.save({

                validateBeforeSave:
                    false

            });

        } catch (cleanupError) {

            console.error(
                "[SKYRA AUTH] Unable to clear failed password-reset token:",
                cleanupError.message
            );

        }


        console.error(
            "[SKYRA AUTH] Password-reset email failed:",
            error.message
        );


        /*
         * During development, surface the mail error so SMTP
         * configuration problems are easy to diagnose.
         *
         * In production, keep the public forgot-password flow
         * generic to avoid account enumeration.
         */

        if (
            String(env.NODE_ENV || "development")
                .toLowerCase() ===
            "development"
        ) {

            throw new ApiError(
                HTTP_STATUS.INTERNAL_SERVER_ERROR,
                "Password reset email could not be sent. Check the email configuration."
            );

        }


        return {

            userExists:
                true,

            resetToken:
                null,

            expiresAt:
                null,

            emailSent:
                false

        };

    }


    return {

        userExists:
            true,

        /*
         * Kept for compatibility with the current controller.
         * The controller may expose this only in development.
         * Production responses must never expose the raw token.
         */

        resetToken:
            token,

        expiresAt,

        emailSent:
            true,

        user: {

            id:
                user._id.toString(),

            name:
                user.name,

            email:
                user.email

        }

    };

}



/* =========================================================
   9. RESET PASSWORD

   Input:
   - raw token from URL
   - new password

   Database contains:
   - SHA-256 hash only
   ========================================================= */

async function resetPassword(
    rawToken,
    newPassword
) {

    if (!rawToken) {

        throw new ApiError(
            HTTP_STATUS.BAD_REQUEST,
            "Password reset token is required."
        );

    }


    /* =====================================================
       HASH RECEIVED TOKEN
       ===================================================== */

    const hashedToken =
        hashResetToken(
            rawToken
        );


    /* =====================================================
       FIND VALID NON-EXPIRED TOKEN
       ===================================================== */

    const user =
        await User
            .findOne({

                resetPasswordToken:
                    hashedToken,

                resetPasswordExpiresAt: {

                    $gt:
                        new Date()

                }

            })
            .select(
                "+resetPasswordToken +resetPasswordExpiresAt"
            );


    if (!user) {

        throw new ApiError(
            HTTP_STATUS.BAD_REQUEST,
            "Password reset token is invalid or has expired."
        );

    }


    /* =====================================================
       SET NEW PASSWORD

       User.js pre-save middleware will automatically hash it.
       ===================================================== */

    user.password =
        newPassword;


    /* =====================================================
       REMOVE RESET TOKEN

       Reset links must be one-time use.
       ===================================================== */

    user.resetPasswordToken =
        null;


    user.resetPasswordExpiresAt =
        null;


    await user.save();


    return {

        user:
            createSafeUser(
                user
            )

    };

}


/* =========================================================
   10. VERIFY PASSWORD RESET TOKEN

   Optional helper used later if the frontend wants to check
   whether a reset link is still valid before showing the
   password form.
   ========================================================= */

async function verifyPasswordResetToken(
    rawToken
) {

    if (!rawToken) {

        return false;

    }


    const hashedToken =
        hashResetToken(
            rawToken
        );


    const user =
        await User.exists({

            resetPasswordToken:
                hashedToken,

            resetPasswordExpiresAt: {

                $gt:
                    new Date()

            }

        });


    return Boolean(
        user
    );

}


/* =========================================================
   11. VERIFY USER EXISTS

   Useful internally in authentication-related operations.
   ========================================================= */

async function findUserByEmail(
    email
) {

    if (!email) {

        return null;

    }


    return User.findOne({

        email:
            email
                .trim()
                .toLowerCase()

    });

}


/* =========================================================
   12. HASH UTILITY FALLBACK CHECK

   This small utility ensures the service can validate the
   implementation contract later.

   This does not expose any secret.
   ========================================================= */

function validateResetTokenHash(
    rawToken,
    expectedHash
) {

    if (
        !rawToken ||
        !expectedHash
    ) {

        return false;

    }


    const actualHash =
        crypto
            .createHash(
                "sha256"
            )
            .update(
                rawToken
            )
            .digest(
                "hex"
            );


    return actualHash ===
        expectedHash;

}


/* =========================================================
   13. EXPORT
   ========================================================= */

module.exports = {

    registerUser,

    loginUser,

    getCurrentUser,

    requestPasswordReset,

    resetPassword,

    verifyPasswordResetToken,

    findUserByEmail,

    generateAccessToken,

    validateResetTokenHash

};