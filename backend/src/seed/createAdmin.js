"use strict";

/* =========================================================
   SKYRA - ADMIN SEED SCRIPT

   File:
   backend/src/seed/createAdmin.js

   Purpose:
   - Create the first SKYRA Admin account securely
   - Prevent Admin creation through public registration
   - Read Admin credentials from .env
   - Prevent accidental privilege escalation
   - Use User.js password hashing middleware

   Run later using:

   node src/seed/createAdmin.js
   ========================================================= */


const mongoose =
    require("mongoose");


const connectDB =
    require("../config/db");


/*
   Requiring env.js also loads backend/.env.
*/
require("../config/env");


const User =
    require("../models/User");


const {
    USER_ROLES,
    USER_STATUS
} =
    require("../utils/constants");


/* =========================================================
   1. READ ADMIN ENVIRONMENT VARIABLES

   These will be added to backend/.env later:

   ADMIN_NAME=SKYRA Admin
   ADMIN_EMAIL=admin@skyra.com
   ADMIN_PASSWORD=StrongPassword
   ========================================================= */

const ADMIN_NAME =
    process.env.ADMIN_NAME?.trim();


const ADMIN_EMAIL =
    process.env.ADMIN_EMAIL
        ?.trim()
        .toLowerCase();


const ADMIN_PASSWORD =
    process.env.ADMIN_PASSWORD;


/* =========================================================
   2. BASIC EMAIL VALIDATION
   ========================================================= */

function isValidEmail(
    email
) {

    const emailPattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


    return emailPattern.test(
        email
    );

}


/* =========================================================
   3. VALIDATE ADMIN CONFIGURATION

   We fail immediately if required environment variables
   are missing or invalid.
   ========================================================= */

function validateAdminConfiguration() {

    const errors =
        [];


    /* =====================================================
       ADMIN NAME
       ===================================================== */

    if (!ADMIN_NAME) {

        errors.push(
            "ADMIN_NAME is missing."
        );

    } else {

        if (
            ADMIN_NAME.length <
            2
        ) {

            errors.push(
                "ADMIN_NAME must contain at least 2 characters."
            );

        }


        if (
            ADMIN_NAME.length >
            100
        ) {

            errors.push(
                "ADMIN_NAME cannot exceed 100 characters."
            );

        }

    }


    /* =====================================================
       ADMIN EMAIL
       ===================================================== */

    if (!ADMIN_EMAIL) {

        errors.push(
            "ADMIN_EMAIL is missing."
        );

    } else if (
        !isValidEmail(
            ADMIN_EMAIL
        )
    ) {

        errors.push(
            "ADMIN_EMAIL must be a valid email address."
        );

    }


    /* =====================================================
       ADMIN PASSWORD

       Must match our User model / authentication rules.
       bcrypt safely supports passwords up to 72 bytes, so we
       keep the same practical 8–72 character boundary used
       by authValidator.js.
       ===================================================== */

    if (!ADMIN_PASSWORD) {

        errors.push(
            "ADMIN_PASSWORD is missing."
        );

    } else {

        if (
            ADMIN_PASSWORD.length <
            8
        ) {

            errors.push(
                "ADMIN_PASSWORD must contain at least 8 characters."
            );

        }


        if (
            ADMIN_PASSWORD.length >
            72
        ) {

            errors.push(
                "ADMIN_PASSWORD cannot exceed 72 characters."
            );

        }

    }


    if (
        errors.length >
        0
    ) {

        console.error(
            "\nAdmin configuration is invalid:\n"
        );


        errors.forEach(
            (
                error,
                index
            ) => {

                console.error(
                    `${index + 1}. ${error}`
                );

            }
        );


        console.error(
            "\nUpdate backend/.env and run the seed again.\n"
        );


        return false;

    }


    return true;

}


/* =========================================================
   4. CREATE ADMIN

   Security behavior:

   CASE 1:
   Email does not exist
       → Create ADMIN

   CASE 2:
   Email already belongs to ADMIN
       → Do nothing

   CASE 3:
   Email belongs to CUSTOMER / ORGANISER
       → Refuse to elevate automatically

   We never silently convert a Customer or Organiser
   into an Admin.
   ========================================================= */

async function createAdmin() {

    if (
        !validateAdminConfiguration()
    ) {

        process.exitCode =
            1;

        return;

    }


    try {

        /* =================================================
           CONNECT TO MONGODB
           ================================================= */

        await connectDB();


        console.log(
            "\n========================================"
        );

        console.log(
            "       SKYRA ADMIN SEED"
        );

        console.log(
            "========================================\n"
        );


        /* =================================================
           CHECK WHETHER EMAIL ALREADY EXISTS
           ================================================= */

        const existingUser =
            await User.findOne({

                email:
                    ADMIN_EMAIL

            });


        /* =================================================
           EXISTING USER FOUND
           ================================================= */

        if (existingUser) {

            /* =============================================
               ALREADY AN ADMIN

               Do not reset password automatically.

               This prevents accidentally changing Admin
               credentials every time the seed is run.
               ============================================= */

            if (
                existingUser.role ===
                USER_ROLES.ADMIN
            ) {

                console.log(
                    "Admin account already exists."
                );

                console.log(
                    `Name  : ${existingUser.name}`
                );

                console.log(
                    `Email : ${existingUser.email}`
                );

                console.log(
                    `Role  : ${existingUser.role}`
                );

                console.log(
                    `Status: ${existingUser.status}`
                );


                console.log(
                    "\nNo changes were made."
                );


                return;

            }


            /* =============================================
               IMPORTANT SECURITY CHECK

               Never automatically promote an existing
               Customer or Organiser to Admin.
               ============================================= */

            console.error(
                "Cannot create Admin account."
            );


            console.error(
                `The email "${ADMIN_EMAIL}" is already used by a ${existingUser.role} account.`
            );


            console.error(
                "Use a different ADMIN_EMAIL."
            );


            process.exitCode =
                1;


            return;

        }


        /* =================================================
           CREATE ADMIN DOCUMENT

           Password is passed as plain text here ONLY inside
           application memory.

           User.js pre-save middleware will hash it using
           bcrypt before MongoDB receives it.
           ================================================= */

        const admin =
            await User.create({

                name:
                    ADMIN_NAME,

                email:
                    ADMIN_EMAIL,

                password:
                    ADMIN_PASSWORD,

                role:
                    USER_ROLES.ADMIN,

                status:
                    USER_STATUS.ACTIVE,

                emailVerified:
                    true,

                emailVerifiedAt:
                    new Date(),

                organiserProfile:
                    null

            });


        /* =================================================
           SUCCESS

           Never print password to terminal.
           ================================================= */

        console.log(
            "Admin account created successfully.\n"
        );


        console.log(
            `Name  : ${admin.name}`
        );

        console.log(
            `Email : ${admin.email}`
        );

        console.log(
            `Role  : ${admin.role}`
        );

        console.log(
            `Status: ${admin.status}`
        );


        console.log(
            "\nPassword has been securely hashed before storage."
        );


        console.log(
            "\nYou can use this Admin account through the normal SKYRA login endpoint."
        );

    } catch (error) {

        console.error(
            "\nFailed to create SKYRA Admin."
        );


        /* =================================================
           DUPLICATE EMAIL RACE CONDITION

           Unique MongoDB index is still the final protection.
           ================================================= */

        if (
            error?.code ===
            11000
        ) {

            console.error(
                "An account with this Admin email already exists."
            );

        } else {

            console.error(
                error?.message ||
                error
            );

        }


        process.exitCode =
            1;

    } finally {

        /* =================================================
           CLOSE DATABASE CONNECTION

           The seed is a standalone script, so unlike server.js
           it should terminate after completing its work.
           ================================================= */

        try {

            if (
                mongoose.connection.readyState !==
                0
            ) {

                await mongoose.connection.close();


                console.log(
                    "\nMongoDB connection closed."
                );

            }

        } catch (
            closeError
        ) {

            console.error(
                "Failed to close MongoDB connection:",
                closeError.message
            );


            process.exitCode =
                1;

        }

    }

}


/* =========================================================
   5. RUN SEED
   ========================================================= */

createAdmin();