"use strict";

/* =========================================================
   SKYRA - USER MODEL

   File:
   backend/src/models/User.js

   Purpose:
   - Store Customer accounts
   - Store Organiser accounts
   - Store Admin accounts
   - Hash passwords securely using bcrypt
   - Support JWT authentication
   - Support forgot/reset password
   - Support Admin suspend/reactivate functionality

   IMPORTANT:
   Public registration will only allow:
   - CUSTOMER
   - ORGANISER

   ADMIN accounts will be created using:
   backend/src/seed/createAdmin.js
   ========================================================= */


const mongoose =
    require("mongoose");

const bcrypt =
    require("bcryptjs");


const {
    USER_ROLES,
    USER_STATUS
} =
    require("../utils/constants");



/* =========================================================
   1. ORGANISER PROFILE SUB-SCHEMA

   Customer and Admin accounts do not need this information.

   Organiser accounts can store additional business details
   inside the same User document.
   ========================================================= */

const organiserProfileSchema =
    new mongoose.Schema(
        {

            businessName: {

                type:
                    String,

                trim:
                    true,

                maxlength: [
                    120,
                    "Business name cannot exceed 120 characters."
                ],

                default:
                    null

            },


            contactPerson: {

                type:
                    String,

                trim:
                    true,

                maxlength: [
                    100,
                    "Contact person cannot exceed 100 characters."
                ],

                default:
                    null

            },


            description: {

                type:
                    String,

                trim:
                    true,

                maxlength: [
                    500,
                    "Organiser description cannot exceed 500 characters."
                ],

                default:
                    null

            }

        },
        {

            /*
               We do not need a separate MongoDB _id
               for this embedded profile.
            */

            _id:
                false

        }
    );



/* =========================================================
   2. USER SCHEMA
   ========================================================= */

const userSchema =
    new mongoose.Schema(
        {

            /* =================================================
               NAME
               ================================================= */

            name: {

                type:
                    String,

                required: [
                    true,
                    "Name is required."
                ],

                trim:
                    true,

                minlength: [
                    2,
                    "Name must contain at least 2 characters."
                ],

                maxlength: [
                    100,
                    "Name cannot exceed 100 characters."
                ]

            },



            /* =================================================
               EMAIL
               ================================================= */

            email: {

                type:
                    String,

                required: [
                    true,
                    "Email is required."
                ],

                trim:
                    true,

                lowercase:
                    true,

                maxlength: [
                    150,
                    "Email cannot exceed 150 characters."
                ]

            },



            /* =================================================
               PASSWORD

               select: false means password will not normally
               be returned by MongoDB queries.

               When login needs the password we will explicitly
               request it using:

               .select("+password")
               ================================================= */

            password: {

                type:
                    String,

                required: [
                    true,
                    "Password is required."
                ],

                minlength: [
                    8,
                    "Password must contain at least 8 characters."
                ],

                select:
                    false

            },



            /* =================================================
               ROLE
               ================================================= */

            role: {

                type:
                    String,

                enum: {

                    values:
                        Object.values(
                            USER_ROLES
                        ),

                    message:
                        "Invalid user role."

                },

                default:
                    USER_ROLES.CUSTOMER,

                required:
                    true,

                index:
                    true

            },



            /* =================================================
               ACCOUNT STATUS

               Admin can later change:

               ACTIVE
                  ↓
               SUSPENDED

               Suspended users cannot login/use protected APIs.
               ================================================= */

            status: {

                type:
                    String,

                enum: {

                    values:
                        Object.values(
                            USER_STATUS
                        ),

                    message:
                        "Invalid user status."

                },

                default:
                    USER_STATUS.ACTIVE,

                required:
                    true,

                index:
                    true

            },



            /* =================================================
               PHONE
               ================================================= */

            phone: {

                type:
                    String,

                trim:
                    true,

                maxlength: [
                    20,
                    "Phone number cannot exceed 20 characters."
                ],

                default:
                    null

            },



            /* =================================================
               LOCATION
               ================================================= */

            city: {

                type:
                    String,

                trim:
                    true,

                maxlength:
                    80,

                default:
                    null

            },


            state: {

                type:
                    String,

                trim:
                    true,

                maxlength:
                    80,

                default:
                    null

            },


            country: {

                type:
                    String,

                trim:
                    true,

                maxlength:
                    80,

                default:
                    "India"

            },



            /* =================================================
               EMAIL VERIFICATION

               We keep these fields because Admin Users and
               Organisers pages can display verification state.

               Actual email verification can be implemented
               separately if required.
               ================================================= */

            emailVerified: {

                type:
                    Boolean,

                default:
                    false

            },


            emailVerifiedAt: {

                type:
                    Date,

                default:
                    null

            },



            /* =================================================
               ORGANISER PROFILE
               ================================================= */

            organiserProfile: {

                type:
                    organiserProfileSchema,

                default:
                    null

            },



            /* =================================================
               PASSWORD RESET

               We will NEVER store the raw reset token.

               Forgot password flow:

               raw token
                  ↓
               send to user
                  ↓
               SHA-256 hash
                  ↓
               save hash here
               ================================================= */

            resetPasswordToken: {

                type:
                    String,

                select:
                    false,

                default:
                    null

            },


            resetPasswordExpiresAt: {

                type:
                    Date,

                select:
                    false,

                default:
                    null

            },



            /* =================================================
               PASSWORD SECURITY METADATA
               ================================================= */

            passwordChangedAt: {

                type:
                    Date,

                default:
                    null

            },



            /* =================================================
               LOGIN METADATA
               ================================================= */

            lastLoginAt: {

                type:
                    Date,

                default:
                    null

            }

        },
        {

            timestamps:
                true,

            versionKey:
                false

        }
    );



/* =========================================================
   3. UNIQUE EMAIL INDEX

   This prevents two accounts from using the same email.

   MongoDB duplicate key error:
   code 11000

   Our Phase 1 errorMiddleware.js already converts that into
   a clean HTTP 409 response.
   ========================================================= */

userSchema.index(
    {

        email:
            1

    },
    {

        unique:
            true

    }
);



/* =========================================================
   4. ADMIN QUERY INDEX

   Useful later for:

   GET /api/admin/users

   GET /api/admin/organisers

   and filtering by account status.
   ========================================================= */

userSchema.index(
    {

        role:
            1,

        status:
            1,

        createdAt:
            -1

    }
);



/* =========================================================
   5. HASH PASSWORD BEFORE SAVE

   Example:

   User enters:

   MyPassword123

   MongoDB stores:

   $2b$12$....

   The original password is never stored.
   ========================================================= */

userSchema.pre(
    "save",
    async function () {

        /*
           If password has not changed, don't hash it again.
        */

        if (
            !this.isModified(
                "password"
            )
        ) {

            return;

        }


        const saltRounds =
            12;


        this.password =
            await bcrypt.hash(
                this.password,
                saltRounds
            );


        /*
           Initial registration does not count as a
           password change.

           This is useful later when checking whether a JWT
           was created before a password reset.
        */

        if (
            !this.isNew
        ) {

            this.passwordChangedAt =
                new Date(
                    Date.now() -
                    1000
                );

        }

    }
);



/* =========================================================
   6. COMPARE PASSWORD METHOD

   Used during login.

   Example:

   const valid =
       await user.comparePassword(password);
   ========================================================= */

userSchema.methods.comparePassword =
    async function (
        candidatePassword
    ) {

        /*
           password must have been explicitly selected using:

           .select("+password")
        */

        if (
            !this.password
        ) {

            return false;

        }


        return bcrypt.compare(
            candidatePassword,
            this.password
        );

    };



/* =========================================================
   7. CHECK PASSWORD CHANGE AFTER JWT

   JWT contains an "iat" value:

   iat = issued at

   Example:

   JWT issued:
   10:00

   Password changed:
   10:30

   That old JWT should no longer be accepted.
   ========================================================= */

userSchema.methods.changedPasswordAfter =
    function (
        jwtIssuedAt
    ) {

        if (
            !this.passwordChangedAt
        ) {

            return false;

        }


        const passwordChangedTimestamp =
            Math.floor(
                this.passwordChangedAt
                    .getTime() /
                1000
            );


        return (
            passwordChangedTimestamp >
            jwtIssuedAt
        );

    };



/* =========================================================
   8. SAFE USER OBJECT

   Use when returning User data to frontend.

   This ensures private authentication information is removed.
   ========================================================= */

userSchema.methods.toSafeObject =
    function () {

        const user =
            this.toObject();


        delete user.password;

        delete user.resetPasswordToken;

        delete user.resetPasswordExpiresAt;


        return user;

    };



/* =========================================================
   9. JSON TRANSFORMATION

   Extra safety so sensitive authentication properties do
   not accidentally appear in JSON responses.
   ========================================================= */

userSchema.set(
    "toJSON",
    {

        transform: (
            document,
            returnedObject
        ) => {

            delete returnedObject.password;

            delete returnedObject.resetPasswordToken;

            delete returnedObject.resetPasswordExpiresAt;


            return returnedObject;

        }

    }
);



/* =========================================================
   10. CREATE MODEL
   ========================================================= */

const User =
    mongoose.model(
        "User",
        userSchema
    );



/* =========================================================
   11. EXPORT MODEL
   ========================================================= */

module.exports =
    User;