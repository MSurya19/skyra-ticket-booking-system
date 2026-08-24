"use strict";

/* =========================================================
   SKYRA - AUTHENTICATION VALIDATORS

   File:
   backend/src/validators/authValidator.js

   Purpose:
   Validate request data for:

   - Customer / Organiser registration
   - Login
   - Forgot password
   - Reset password

   No external validation library is required.

   Every validator returns:

   {
       isValid: true/false,
       errors: [],
       data: { sanitized values }
   }

   The next file:
   middleware/validationMiddleware.js

   will use these validators before requests reach
   authController.js.
   ========================================================= */


const {
    USER_ROLES
} =
    require("../utils/constants");


/* =========================================================
   1. BASIC HELPERS
   ========================================================= */

function isPlainObject(
    value
) {

    return (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value)
    );

}


function normalizeString(
    value
) {

    if (
        value === undefined ||
        value === null
    ) {

        return "";

    }


    return String(value).trim();

}


function normalizeEmail(
    value
) {

    return normalizeString(
        value
    ).toLowerCase();

}


function normalizeRole(
    value
) {

    return normalizeString(
        value
    ).toUpperCase();

}


/* =========================================================
   2. EMAIL VALIDATION
   ========================================================= */

function isValidEmail(
    email
) {

    /*
       Intentionally practical rather than attempting to
       implement the full RFC email specification.
    */

    const emailPattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


    return emailPattern.test(
        email
    );

}


/* =========================================================
   3. PHONE VALIDATION

   Phone is optional.

   Allows:
   +91 9876543210
   98765-43210
   (044) 12345678
   ========================================================= */

function isValidPhone(
    phone
) {

    if (!phone) {

        return true;

    }


    const phonePattern =
        /^[0-9+\-()\s]{7,20}$/;


    return phonePattern.test(
        phone
    );

}


/* =========================================================
   4. PASSWORD VALIDATION

   Current SKYRA requirement:
   - minimum 8 characters
   - maximum 72 characters

   We are not forcing special symbols/uppercase because the
   User model currently only requires a minimum length.

   Keeping validation and model rules aligned prevents one
   layer from accepting data another layer rejects.
   ========================================================= */

function validatePasswordValue(
    password,
    field = "password"
) {

    const errors = [];


    if (
        typeof password !==
        "string"
    ) {

        errors.push({

            field,

            message:
                "Password is required."

        });


        return errors;

    }


    if (
        password.length <
        8
    ) {

        errors.push({

            field,

            message:
                "Password must contain at least 8 characters."

        });

    }


    if (
        password.length >
        72
    ) {

        errors.push({

            field,

            message:
                "Password cannot exceed 72 characters."

        });

    }


    return errors;

}


/* =========================================================
   5. ERROR HELPER
   ========================================================= */

function addError(
    errors,
    field,
    message
) {

    errors.push({

        field,

        message

    });

}


/* =========================================================
   6. REGISTRATION VALIDATOR

   Public registration allows ONLY:

   CUSTOMER
   ORGANISER

   ADMIN registration is deliberately rejected here.

   Example Customer request:

   {
       "name": "Surya",
       "email": "surya@example.com",
       "password": "Password123",
       "confirmPassword": "Password123",
       "role": "CUSTOMER"
   }

   Example Organiser request:

   {
       "name": "Arjun",
       "email": "arjun@example.com",
       "password": "Password123",
       "role": "ORGANISER",
       "organiserProfile": {
           "businessName": "Skyline Events",
           "contactPerson": "Arjun"
       }
   }
   ========================================================= */

function validateRegister(
    body
) {

    const source =
        isPlainObject(body)
            ? body
            : {};


    const errors = [];


    /* =====================================================
       NAME
       ===================================================== */

    const name =
        normalizeString(
            source.name
        );


    if (!name) {

        addError(
            errors,
            "name",
            "Name is required."
        );

    } else {

        if (
            name.length <
            2
        ) {

            addError(
                errors,
                "name",
                "Name must contain at least 2 characters."
            );

        }


        if (
            name.length >
            100
        ) {

            addError(
                errors,
                "name",
                "Name cannot exceed 100 characters."
            );

        }

    }



    /* =====================================================
       EMAIL
       ===================================================== */

    const email =
        normalizeEmail(
            source.email
        );


    if (!email) {

        addError(
            errors,
            "email",
            "Email is required."
        );

    } else if (
        !isValidEmail(
            email
        )
    ) {

        addError(
            errors,
            "email",
            "Please provide a valid email address."
        );

    } else if (
        email.length >
        150
    ) {

        addError(
            errors,
            "email",
            "Email cannot exceed 150 characters."
        );

    }



    /* =====================================================
       PASSWORD
       ===================================================== */

    const password =
        source.password;


    errors.push(
        ...validatePasswordValue(
            password,
            "password"
        )
    );



    /* =====================================================
       CONFIRM PASSWORD

       confirmPassword is not stored in MongoDB.

       If the frontend sends it, it must match.
       ===================================================== */

    if (
        source.confirmPassword !==
        undefined
    ) {

        if (
            typeof source.confirmPassword !==
            "string"
        ) {

            addError(
                errors,
                "confirmPassword",
                "Confirm password must be a string."
            );

        } else if (
            source.confirmPassword !==
            password
        ) {

            addError(
                errors,
                "confirmPassword",
                "Passwords do not match."
            );

        }

    }



    /* =====================================================
       ROLE
       ===================================================== */

    const role =
        normalizeRole(
            source.role
        );


    const allowedPublicRoles = [

        USER_ROLES.CUSTOMER,

        USER_ROLES.ORGANISER

    ];


    if (!role) {

        addError(
            errors,
            "role",
            "Role is required."
        );

    } else if (
        !allowedPublicRoles.includes(
            role
        )
    ) {

        addError(
            errors,
            "role",
            "Public registration is allowed only for CUSTOMER or ORGANISER."
        );

    }



    /* =====================================================
       OPTIONAL PHONE
       ===================================================== */

    const phone =
        normalizeString(
            source.phone
        );


    if (
        phone &&
        !isValidPhone(
            phone
        )
    ) {

        addError(
            errors,
            "phone",
            "Please provide a valid phone number."
        );

    }



    /* =====================================================
       OPTIONAL LOCATION
       ===================================================== */

    const city =
        normalizeString(
            source.city
        );


    const state =
        normalizeString(
            source.state
        );


    const country =
        normalizeString(
            source.country
        );


    if (
        city.length >
        80
    ) {

        addError(
            errors,
            "city",
            "City cannot exceed 80 characters."
        );

    }


    if (
        state.length >
        80
    ) {

        addError(
            errors,
            "state",
            "State cannot exceed 80 characters."
        );

    }


    if (
        country.length >
        80
    ) {

        addError(
            errors,
            "country",
            "Country cannot exceed 80 characters."
        );

    }



    /* =====================================================
       ORGANISER PROFILE

       We support both:

       organiserProfile: {
           businessName: "...",
           contactPerson: "...",
           description: "..."
       }

       and flat values:

       businessName: "..."
       contactPerson: "..."
       description: "..."

       This gives us flexibility when the frontend is
       connected later.
       ===================================================== */

    const suppliedOrganiserProfile =
        isPlainObject(
            source.organiserProfile
        )
            ? source.organiserProfile
            : {};


    const businessName =
        normalizeString(
            suppliedOrganiserProfile.businessName ??
            source.businessName
        );


    const contactPerson =
        normalizeString(
            suppliedOrganiserProfile.contactPerson ??
            source.contactPerson
        );


    const organiserDescription =
        normalizeString(
            suppliedOrganiserProfile.description ??
            source.organiserDescription ??
            (
                role ===
                USER_ROLES.ORGANISER
                    ? source.description
                    : ""
            )
        );


    if (
        businessName.length >
        120
    ) {

        addError(
            errors,
            "organiserProfile.businessName",
            "Business name cannot exceed 120 characters."
        );

    }


    if (
        contactPerson.length >
        100
    ) {

        addError(
            errors,
            "organiserProfile.contactPerson",
            "Contact person cannot exceed 100 characters."
        );

    }


    if (
        organiserDescription.length >
        500
    ) {

        addError(
            errors,
            "organiserProfile.description",
            "Organiser description cannot exceed 500 characters."
        );

    }



    /* =====================================================
       SANITIZED DATA

       Only explicitly allowed fields are returned.

       This prevents clients from registering with fields
       such as:

       status: "ACTIVE"
       emailVerified: true
       resetPasswordToken: "..."
       ===================================================== */

    const data = {

        name,

        email,

        password,

        role

    };


    if (phone) {

        data.phone =
            phone;

    }


    if (city) {

        data.city =
            city;

    }


    if (state) {

        data.state =
            state;

    }


    if (country) {

        data.country =
            country;

    }


    if (
        role ===
        USER_ROLES.ORGANISER
    ) {

        data.organiserProfile = {

            businessName:
                businessName ||
                null,

            contactPerson:
                contactPerson ||
                name ||
                null,

            description:
                organiserDescription ||
                null

        };

    }



    return {

        isValid:
            errors.length ===
            0,

        errors,

        data

    };

}


/* =========================================================
   7. LOGIN VALIDATOR

   Request:

   {
       "email": "surya@example.com",
       "password": "Password123"
   }
   ========================================================= */

function validateLogin(
    body
) {

    const source =
        isPlainObject(body)
            ? body
            : {};


    const errors = [];


    const email =
        normalizeEmail(
            source.email
        );


    const password =
        source.password;



    if (!email) {

        addError(
            errors,
            "email",
            "Email is required."
        );

    } else if (
        !isValidEmail(
            email
        )
    ) {

        addError(
            errors,
            "email",
            "Please provide a valid email address."
        );

    }



    if (
        typeof password !==
            "string" ||
        password.length ===
            0
    ) {

        addError(
            errors,
            "password",
            "Password is required."
        );

    }



    return {

        isValid:
            errors.length ===
            0,

        errors,

        data: {

            email,

            password

        }

    };

}


/* =========================================================
   8. FORGOT PASSWORD VALIDATOR

   Request:

   {
       "email": "surya@example.com"
   }

   Security note:
   The service/controller will later return a generic response
   even when an email does not exist, to reduce account
   enumeration risk.
   ========================================================= */

function validateForgotPassword(
    body
) {

    const source =
        isPlainObject(body)
            ? body
            : {};


    const errors = [];


    const email =
        normalizeEmail(
            source.email
        );


    if (!email) {

        addError(
            errors,
            "email",
            "Email is required."
        );

    } else if (
        !isValidEmail(
            email
        )
    ) {

        addError(
            errors,
            "email",
            "Please provide a valid email address."
        );

    }



    return {

        isValid:
            errors.length ===
            0,

        errors,

        data: {

            email

        }

    };

}


/* =========================================================
   9. RESET PASSWORD VALIDATOR

   Reset token comes from:

   req.params.token

   Body:

   {
       "password": "NewPassword123",
       "confirmPassword": "NewPassword123"
   }
   ========================================================= */

function validateResetPassword(
    body
) {

    const source =
        isPlainObject(body)
            ? body
            : {};


    const errors = [];


    const password =
        source.password;


    errors.push(
        ...validatePasswordValue(
            password,
            "password"
        )
    );


    if (
        source.confirmPassword !==
        undefined
    ) {

        if (
            typeof source.confirmPassword !==
            "string"
        ) {

            addError(
                errors,
                "confirmPassword",
                "Confirm password must be a string."
            );

        } else if (
            source.confirmPassword !==
            password
        ) {

            addError(
                errors,
                "confirmPassword",
                "Passwords do not match."
            );

        }

    }



    return {

        isValid:
            errors.length ===
            0,

        errors,

        data: {

            password

        }

    };

}


/* =========================================================
   10. RESET TOKEN PARAMETER VALIDATOR

   URL:

   POST /api/auth/reset-password/:token
   ========================================================= */

function validateResetToken(
    token
) {

    const normalizedToken =
        normalizeString(
            token
        );


    const errors = [];


    if (!normalizedToken) {

        addError(
            errors,
            "token",
            "Password reset token is required."
        );

    }


    return {

        isValid:
            errors.length ===
            0,

        errors,

        data: {

            token:
                normalizedToken

        }

    };

}


/* =========================================================
   11. EXPORT
   ========================================================= */

module.exports = {

    validateRegister,

    validateLogin,

    validateForgotPassword,

    validateResetPassword,

    validateResetToken

};