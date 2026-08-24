"use strict";

/* =========================================================
   SKYRA - PASSWORD RESET TOKEN UTILITY

   File:
   backend/src/utils/generateResetToken.js

   Purpose:
   - Generate a cryptographically secure reset token
   - Hash the token before storing it in MongoDB
   - Create an expiry time for the reset link

   Security model:

   Raw token
      ↓
   Sent to user in reset URL

   SHA-256 hash
      ↓
   Stored in MongoDB

   This means the database never stores the raw reset token.
   ========================================================= */


const crypto =
    require("crypto");


/* =========================================================
   1. HASH RESET TOKEN

   Input:
   raw reset token

   Output:
   SHA-256 hexadecimal hash
   ========================================================= */

function hashResetToken(
    token
) {

    if (
        !token ||
        typeof token !==
            "string"
    ) {

        throw new TypeError(
            "A valid reset token is required."
        );

    }


    return crypto
        .createHash(
            "sha256"
        )
        .update(
            token
        )
        .digest(
            "hex"
        );

}


/* =========================================================
   2. GENERATE RESET TOKEN

   Default expiry:
   15 minutes

   Returns:

   {
       token,
       hashedToken,
       expiresAt
   }
   ========================================================= */

function generateResetToken(
    expiryMinutes = 15
) {

    /* =====================================================
       VALIDATE EXPIRY
       ===================================================== */

    const minutes =
        Number(
            expiryMinutes
        );


    if (
        !Number.isFinite(
            minutes
        ) ||
        minutes <=
            0
    ) {

        throw new TypeError(
            "Reset token expiry must be a positive number of minutes."
        );

    }


    /* =====================================================
       GENERATE RAW TOKEN

       32 random bytes produce a strong token.

       Example output:

       a7c4e1f9...
       ===================================================== */

    const token =
        crypto
            .randomBytes(
                32
            )
            .toString(
                "hex"
            );


    /* =====================================================
       HASH TOKEN

       Only this hash will be stored in MongoDB.
       ===================================================== */

    const hashedToken =
        hashResetToken(
            token
        );


    /* =====================================================
       CREATE EXPIRY DATE
       ===================================================== */

    const expiresAt =
        new Date(
            Date.now() +
            minutes *
                60 *
                1000
        );


    /* =====================================================
       RETURN
       ===================================================== */

    return {

        token,

        hashedToken,

        expiresAt

    };

}


/* =========================================================
   3. EXPORT
   ========================================================= */

module.exports = {

    generateResetToken,

    hashResetToken

};