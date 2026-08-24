    "use strict";

/* =========================================================
   SKYRA - ENVIRONMENT CONFIGURATION

   File:
   backend/src/config/env.js

   Purpose:
   - Load variables from backend/.env
   - Convert numeric values safely
   - Validate important configuration
   - Provide one centralized configuration object

   IMPORTANT:
   Never place passwords, API secrets or MongoDB credentials
   directly inside this file.
   ========================================================= */


const path =
    require("path");

const dotenv =
    require("dotenv");


/* =========================================================
   1. LOAD .env FILE

   Our .env file is located at:

   ticket-booking-system/
   └── backend/
       └── .env

   env.js is located at:

   backend/src/config/env.js

   ../../.env moves from:
   src/config → src → backend
   ========================================================= */

dotenv.config({

    path:
        path.resolve(
            __dirname,
            "../../.env"
        )

});


/* =========================================================
   2. REQUIRED ENVIRONMENT VARIABLE HELPER
   ========================================================= */

function requireEnv(
    key
) {

    const value =
        process.env[key];


    if (
        value === undefined ||
        value === null ||
        String(value).trim() === ""
    ) {

        throw new Error(
            `[SKYRA CONFIG] Missing required environment variable: ${key}`
        );

    }


    return String(value).trim();

}


/* =========================================================
   3. OPTIONAL STRING HELPER
   ========================================================= */

function getOptionalEnv(
    key,
    defaultValue = ""
) {

    const value =
        process.env[key];


    if (
        value === undefined ||
        value === null ||
        String(value).trim() === ""
    ) {

        return defaultValue;

    }


    return String(value).trim();

}


/* =========================================================
   4. NUMBER ENVIRONMENT VARIABLE HELPER
   ========================================================= */

function getNumberEnv(
    key,
    defaultValue,
    options = {}
) {

    const rawValue =
        process.env[key];


    if (
        rawValue === undefined ||
        rawValue === null ||
        String(rawValue).trim() === ""
    ) {

        return defaultValue;

    }


    const number =
        Number(rawValue);


    if (
        !Number.isFinite(number)
    ) {

        throw new Error(
            `[SKYRA CONFIG] ${key} must be a valid number.`
        );

    }


    if (
        options.integer &&
        !Number.isInteger(number)
    ) {

        throw new Error(
            `[SKYRA CONFIG] ${key} must be an integer.`
        );

    }


    if (
        options.min !== undefined &&
        number < options.min
    ) {

        throw new Error(
            `[SKYRA CONFIG] ${key} must be at least ${options.min}.`
        );

    }


    if (
        options.max !== undefined &&
        number > options.max
    ) {

        throw new Error(
            `[SKYRA CONFIG] ${key} must not exceed ${options.max}.`
        );

    }


    return number;

}


/* =========================================================
   5. NODE ENVIRONMENT
   ========================================================= */

const NODE_ENV =
    getOptionalEnv(
        "NODE_ENV",
        "development"
    )
        .toLowerCase();


const validNodeEnvironments = [

    "development",

    "test",

    "production"

];


if (
    !validNodeEnvironments.includes(
        NODE_ENV
    )
) {

    throw new Error(
        "[SKYRA CONFIG] NODE_ENV must be development, test or production."
    );

}


/* =========================================================
   6. SERVER CONFIGURATION
   ========================================================= */

const PORT =
    getNumberEnv(
        "PORT",
        5000,
        {

            integer:
                true,

            min:
                1,

            max:
                65535

        }
    );


/* =========================================================
   7. DATABASE CONFIGURATION

   MongoDB is required during Phase 1 because server.js
   must connect to MongoDB Atlas before accepting requests.
   ========================================================= */

const MONGO_URI =
    requireEnv(
        "MONGO_URI"
    );


/* =========================================================
   8. JWT CONFIGURATION

   JWT authentication is implemented in Phase 2.

   We load JWT_SECRET now but do NOT make it mandatory during
   Phase 1.

   During Phase 2 we will validate that it exists before
   authentication is allowed.
   ========================================================= */

const JWT_SECRET =
    getOptionalEnv(
        "JWT_SECRET",
        ""
    );


/* =========================================================
   9. FRONTEND CONFIGURATION

   Used later for:
   - CORS
   - password reset links
   - email links
   ========================================================= */

const FRONTEND_URL =
    getOptionalEnv(
        "FRONTEND_URL",
        "http://127.0.0.1:5500"
    );


/* =========================================================
   10. SEAT HOLD CONFIGURATION

   Server time is authoritative.

   Frontend countdown is only a display.
   ========================================================= */

const SEAT_HOLD_MINUTES =
    getNumberEnv(
        "SEAT_HOLD_MINUTES",
        10,
        {

            integer:
                true,

            min:
                1

        }
    );


/* =========================================================
   11. WAITLIST OFFER CONFIGURATION
   ========================================================= */

const WAITLIST_OFFER_MINUTES =
    getNumberEnv(
        "WAITLIST_OFFER_MINUTES",
        10,
        {

            integer:
                true,

            min:
                1

        }
    );


/* =========================================================
   12. RAZORPAY CONFIGURATION

   These are optional during Phase 1.

   They become required when we implement the payment phase.
   ========================================================= */

const RAZORPAY_KEY_ID =
    getOptionalEnv(
        "RAZORPAY_KEY_ID",
        ""
    );


const RAZORPAY_KEY_SECRET =
    getOptionalEnv(
        "RAZORPAY_KEY_SECRET",
        ""
    );


const RAZORPAY_WEBHOOK_SECRET =
    getOptionalEnv(
        "RAZORPAY_WEBHOOK_SECRET",
        ""
    );


/* =========================================================
   13. EMAIL CONFIGURATION

   Optional during Phase 1.

   These will be used later for:
   - password reset email
   - booking confirmation
   - QR ticket email
   - waitlist offer email
   ========================================================= */

const EMAIL_HOST =
    getOptionalEnv(
        "EMAIL_HOST",
        ""
    );


const EMAIL_PORT =
    getNumberEnv(
        "EMAIL_PORT",
        587,
        {

            integer:
                true,

            min:
                1,

            max:
                65535

        }
    );


const EMAIL_USER =
    getOptionalEnv(
        "EMAIL_USER",
        ""
    );


const EMAIL_PASSWORD =
    getOptionalEnv(
        "EMAIL_PASSWORD",
        ""
    );


/* =========================================================
   14. FINAL ENVIRONMENT OBJECT
   ========================================================= */

const env =
    Object.freeze({

        /* Application */

        NODE_ENV,

        PORT,


        /* Database */

        MONGO_URI,


        /* Authentication */

        JWT_SECRET,


        /* Frontend */

        FRONTEND_URL,


        /* Booking */

        SEAT_HOLD_MINUTES,

        WAITLIST_OFFER_MINUTES,


        /* Razorpay */

        RAZORPAY_KEY_ID,

        RAZORPAY_KEY_SECRET,

        RAZORPAY_WEBHOOK_SECRET,


        /* Email */

        EMAIL_HOST,

        EMAIL_PORT,

        EMAIL_USER,

        EMAIL_PASSWORD,


        /* Convenience flags */

        IS_DEVELOPMENT:
            NODE_ENV ===
            "development",

        IS_TEST:
            NODE_ENV ===
            "test",

        IS_PRODUCTION:
            NODE_ENV ===
            "production"

    });


/* =========================================================
   15. EXPORT
   ========================================================= */

module.exports =
    env;