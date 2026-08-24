/* =========================================================
   SKYRA - RESET PASSWORD JAVASCRIPT
   File: frontend/js/reset-password.js

   Used by:
   - reset-password.html

   Handles:
   - Reset token from URL
   - Password visibility
   - Password strength
   - Password requirements
   - Confirm password validation
   - Reset password API call
   - Invalid / expired link state
   - Loading state
   - Success state
   ========================================================= */

"use strict";


/* =========================================================
   1. API CONFIGURATION
   ========================================================= */

const SKYRA_RESET_API_BASE_URL =
    window.SKYRA_CONFIG?.API_BASE_URL ||
    "http://localhost:5000/api";


/* =========================================================
   2. STATE
   ========================================================= */

let skyraResetToken = "";


/* =========================================================
   3. DOM READY
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initializeResetLucideIcons();

        initializeResetCurrentYear();

        initializeResetToken();

        initializeResetPasswordToggles();

        initializeResetPasswordValidation();

        initializeResetPasswordForm();

    }
);


/* =========================================================
   4. LUCIDE ICONS
   ========================================================= */

function initializeResetLucideIcons() {

    if (
        typeof lucide !== "undefined"
    ) {

        lucide.createIcons();

    }

}


/* =========================================================
   5. CURRENT YEAR
   ========================================================= */

function initializeResetCurrentYear() {

    const year =
        document.getElementById(
            "authCurrentYear"
        );


    if (!year) {
        return;
    }


    year.textContent =
        new Date().getFullYear();

}


/* =========================================================
   6. RESET TOKEN
   ========================================================= */

function initializeResetToken() {

    const params =
        new URLSearchParams(
            window.location.search
        );


    skyraResetToken =
        params.get("token")?.trim() || "";


    const hiddenInput =
        document.getElementById(
            "resetToken"
        );


    if (hiddenInput) {

        hiddenInput.value =
            skyraResetToken;

    }


    /*
       We only check whether a token exists here.

       The backend is responsible for deciding whether
       the token is valid, expired or already used.
    */

    if (!skyraResetToken) {

        showInvalidResetToken(
            "This password reset link is missing or invalid."
        );

    }

}


/* =========================================================
   7. PASSWORD VISIBILITY
   ========================================================= */

function initializeResetPasswordToggles() {

    const togglePairs = [

        {
            buttonId:
                "newPasswordToggle",

            inputId:
                "newPassword"
        },

        {
            buttonId:
                "confirmNewPasswordToggle",

            inputId:
                "confirmNewPassword"
        }

    ];


    togglePairs.forEach(
        ({ buttonId, inputId }) => {

            const button =
                document.getElementById(
                    buttonId
                );

            const input =
                document.getElementById(
                    inputId
                );


            if (!button || !input) {
                return;
            }


            button.addEventListener(
                "click",
                () => {

                    const hidden =
                        input.type ===
                        "password";


                    input.type =
                        hidden
                            ? "text"
                            : "password";


                    button.setAttribute(
                        "aria-pressed",
                        String(hidden)
                    );


                    button.setAttribute(
                        "aria-label",
                        hidden
                            ? "Hide password"
                            : "Show password"
                    );


                    button.innerHTML =
                        hidden
                            ? `<i data-lucide="eye-off"></i>`
                            : `<i data-lucide="eye"></i>`;


                    initializeResetLucideIcons();


                    input.focus();

                }
            );

        }
    );

}


/* =========================================================
   8. PASSWORD VALIDATION INITIALIZATION
   ========================================================= */

function initializeResetPasswordValidation() {

    const passwordInput =
        document.getElementById(
            "newPassword"
        );

    const confirmInput =
        document.getElementById(
            "confirmNewPassword"
        );


    if (passwordInput) {

        passwordInput.addEventListener(
            "input",
            () => {

                clearResetInputError(
                    passwordInput,
                    "newPasswordError"
                );


                updateResetPasswordStrength(
                    passwordInput.value
                );


                updatePasswordRequirements(
                    passwordInput.value
                );


                /*
                   If confirm password already contains a
                   value, re-check matching while typing.
                */

                if (
                    confirmInput?.value
                ) {

                    validateConfirmPasswordLive();

                }

            }
        );

    }


    if (confirmInput) {

        confirmInput.addEventListener(
            "input",
            () => {

                clearResetInputError(
                    confirmInput,
                    "confirmNewPasswordError"
                );


                validateConfirmPasswordLive();

            }
        );

    }

}


/* =========================================================
   9. PASSWORD REQUIREMENT STATE
   ========================================================= */

function getPasswordRequirements(
    password
) {

    return {

        length:
            password.length >= 8,

        uppercase:
            /[A-Z]/.test(password),

        lowercase:
            /[a-z]/.test(password),

        number:
            /\d/.test(password)

    };

}


/* =========================================================
   10. UPDATE REQUIREMENTS
   ========================================================= */

function updatePasswordRequirements(
    password
) {

    const requirements =
        getPasswordRequirements(
            password
        );


    updateSingleRequirement(
        "requirementLength",
        requirements.length
    );


    updateSingleRequirement(
        "requirementUppercase",
        requirements.uppercase
    );


    updateSingleRequirement(
        "requirementLowercase",
        requirements.lowercase
    );


    updateSingleRequirement(
        "requirementNumber",
        requirements.number
    );


    initializeResetLucideIcons();

}


/* =========================================================
   11. SINGLE REQUIREMENT
   ========================================================= */

function updateSingleRequirement(
    elementId,
    valid
) {

    const element =
        document.getElementById(
            elementId
        );


    if (!element) {
        return;
    }


    element.classList.toggle(
        "valid",
        valid
    );


    const icon =
        element.querySelector(
            "svg"
        );


    /*
       Lucide replaces <i> with SVG,
       therefore replace the holder HTML
       when state changes.
    */


    if (icon) {

        const wrapper =
            document.createElement(
                "i"
            );


        wrapper.setAttribute(
            "data-lucide",
            valid
                ? "circle-check"
                : "circle"
        );


        icon.replaceWith(
            wrapper
        );

    }

}


/* =========================================================
   12. PASSWORD STRENGTH
   ========================================================= */

function updateResetPasswordStrength(
    password
) {

    const container =
        document.getElementById(
            "resetPasswordStrength"
        );

    const text =
        document.getElementById(
            "resetPasswordStrengthText"
        );


    if (!container || !text) {
        return;
    }


    container.classList.remove(
        "weak",
        "fair",
        "good",
        "strong"
    );


    if (!password) {

        text.textContent =
            "Use at least 8 characters";

        return;

    }


    let score = 0;


    if (password.length >= 8) {
        score++;
    }


    if (
        /[a-z]/.test(password) &&
        /[A-Z]/.test(password)
    ) {
        score++;
    }


    if (/\d/.test(password)) {
        score++;
    }


    if (
        /[^A-Za-z0-9]/.test(password)
    ) {
        score++;
    }


    if (score <= 1) {

        container.classList.add(
            "weak"
        );

        text.textContent =
            "Weak password";

    } else if (score === 2) {

        container.classList.add(
            "fair"
        );

        text.textContent =
            "Fair password";

    } else if (score === 3) {

        container.classList.add(
            "good"
        );

        text.textContent =
            "Good password";

    } else {

        container.classList.add(
            "strong"
        );

        text.textContent =
            "Strong password";

    }

}


/* =========================================================
   13. LIVE CONFIRM PASSWORD CHECK
   ========================================================= */

function validateConfirmPasswordLive() {

    const passwordInput =
        document.getElementById(
            "newPassword"
        );

    const confirmInput =
        document.getElementById(
            "confirmNewPassword"
        );


    if (!passwordInput || !confirmInput) {
        return;
    }


    if (!confirmInput.value) {
        return;
    }


    if (
        passwordInput.value ===
        confirmInput.value
    ) {

        confirmInput.classList.remove(
            "error"
        );

        confirmInput.classList.add(
            "success"
        );


        const error =
            document.getElementById(
                "confirmNewPasswordError"
            );


        if (error) {

            error.textContent = "";

        }

    } else {

        confirmInput.classList.remove(
            "success"
        );

    }

}


/* =========================================================
   14. INITIALIZE RESET FORM
   ========================================================= */

function initializeResetPasswordForm() {

    const form =
        document.getElementById(
            "resetPasswordForm"
        );


    if (!form) {
        return;
    }


    form.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();


            clearResetMessage();


            if (!skyraResetToken) {

                showInvalidResetToken(
                    "This reset link is invalid. Request a new password reset link."
                );

                return;

            }


            const valid =
                validateResetPasswordForm();


            if (!valid) {
                return;
            }


            await submitNewPassword();

        }
    );

}


/* =========================================================
   15. VALIDATE FORM
   ========================================================= */

function validateResetPasswordForm() {

    const passwordInput =
        document.getElementById(
            "newPassword"
        );

    const confirmInput =
        document.getElementById(
            "confirmNewPassword"
        );


    if (!passwordInput || !confirmInput) {
        return false;
    }


    const password =
        passwordInput.value;

    const confirmPassword =
        confirmInput.value;


    let valid = true;


    const requirements =
        getPasswordRequirements(
            password
        );


    /* Password required */

    if (!password) {

        showResetInputError(
            passwordInput,
            "newPasswordError",
            "New password is required."
        );

        valid = false;

    } else if (
        !requirements.length
    ) {

        showResetInputError(
            passwordInput,
            "newPasswordError",
            "Password must contain at least 8 characters."
        );

        valid = false;

    } else if (
        !requirements.uppercase
    ) {

        showResetInputError(
            passwordInput,
            "newPasswordError",
            "Password must contain an uppercase letter."
        );

        valid = false;

    } else if (
        !requirements.lowercase
    ) {

        showResetInputError(
            passwordInput,
            "newPasswordError",
            "Password must contain a lowercase letter."
        );

        valid = false;

    } else if (
        !requirements.number
    ) {

        showResetInputError(
            passwordInput,
            "newPasswordError",
            "Password must contain at least one number."
        );

        valid = false;

    }


    /* Confirm required */

    if (!confirmPassword) {

        showResetInputError(
            confirmInput,
            "confirmNewPasswordError",
            "Confirm your new password."
        );

        valid = false;

    } else if (
        password !==
        confirmPassword
    ) {

        showResetInputError(
            confirmInput,
            "confirmNewPasswordError",
            "Passwords do not match."
        );

        valid = false;

    }


    return valid;

}


/* =========================================================
   16. SUBMIT NEW PASSWORD
   ========================================================= */

async function submitNewPassword() {

    const password =
        document.getElementById(
            "newPassword"
        ).value;


    setResetLoading(true);


    try {

        const response =
            await fetch(
                `${SKYRA_RESET_API_BASE_URL}/auth/reset-password/${
                    encodeURIComponent(
                        skyraResetToken
                    )
                }`,
                {

                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify({

                            password

                        })

                }
            );


        const data =
            await parseResetResponse(
                response
            );


        /*
           Common status codes that could mean
           invalid/expired token.
        */

        if (
            response.status === 400 ||
            response.status === 404 ||
            response.status === 410
        ) {

            const message =
                data?.message ||
                "This password reset link is invalid or has expired.";


            if (
                isLikelyTokenError(
                    message
                )
            ) {

                showInvalidResetToken(
                    message
                );

                return;

            }

        }


        if (!response.ok) {

            throw new Error(
                data?.message ||
                "Unable to reset your password."
            );

        }


        showResetSuccessView();

    } catch (error) {

        console.error(
            "SKYRA password reset error:",
            error
        );


        if (
            error instanceof TypeError
        ) {

            showResetMessage(
                "Unable to connect to the SKYRA server. Make sure the backend is running.",
                "error"
            );

        } else {

            showResetMessage(
                error.message ||
                "Unable to reset your password. Please try again.",
                "error"
            );

        }

    } finally {

        setResetLoading(false);

    }

}


/* =========================================================
   17. DETECT TOKEN ERROR
   ========================================================= */

function isLikelyTokenError(
    message
) {

    const normalized =
        String(message)
            .toLowerCase();


    return (

        normalized.includes(
            "token"
        )
        ||
        normalized.includes(
            "expired"
        )
        ||
        normalized.includes(
            "reset link"
        )
        ||
        normalized.includes(
            "invalid link"
        )

    );

}


/* =========================================================
   18. INVALID TOKEN STATE
   ========================================================= */

function showInvalidResetToken(
    message
) {

    const tokenError =
        document.getElementById(
            "resetTokenError"
        );

    const form =
        document.getElementById(
            "resetPasswordForm"
        );

    const requirements =
        document.getElementById(
            "passwordRequirements"
        );

    const securityNote =
        document.querySelector(
            ".reset-password-page .auth-security-note"
        );


    if (form) {

        form.hidden =
            true;

    }


    if (requirements) {

        requirements.hidden =
            true;

    }


    if (securityNote) {

        securityNote.hidden =
            true;

    }


    if (tokenError) {

        tokenError.hidden =
            false;


        const description =
            tokenError.querySelector(
                "p"
            );


        if (
            description &&
            message
        ) {

            description.textContent =
                message;

        }

    }


    initializeResetLucideIcons();

}


/* =========================================================
   19. RESET SUCCESS
   ========================================================= */

function showResetSuccessView() {

    const formView =
        document.getElementById(
            "resetPasswordFormView"
        );

    const successView =
        document.getElementById(
            "resetPasswordSuccessView"
        );


    if (formView) {

        formView.hidden =
            true;

    }


    if (successView) {

        successView.hidden =
            false;

    }


    /*
       Remove token from visible browser URL
       after successful reset.
    */

    try {

        const cleanUrl =
            `${window.location.pathname}`;


        window.history.replaceState(
            {},
            document.title,
            cleanUrl
        );

    } catch {
        /* No action required */
    }


    skyraResetToken = "";


    initializeResetLucideIcons();

}


/* =========================================================
   20. LOADING STATE
   ========================================================= */

function setResetLoading(
    loading
) {

    const button =
        document.getElementById(
            "resetPasswordButton"
        );

    const text =
        document.getElementById(
            "resetPasswordButtonText"
        );

    const arrow =
        document.getElementById(
            "resetPasswordButtonArrow"
        );

    const loader =
        document.getElementById(
            "resetPasswordButtonLoader"
        );


    if (!button) {
        return;
    }


    button.disabled =
        loading;


    if (text) {

        text.textContent =
            loading
                ? "Updating password..."
                : "Reset Password";

    }


    if (arrow) {

        arrow.hidden =
            loading;

    }


    if (loader) {

        loader.hidden =
            !loading;

    }

}


/* =========================================================
   21. INPUT ERROR
   ========================================================= */

function showResetInputError(
    input,
    errorId,
    message
) {

    if (input) {

        input.classList.add(
            "error"
        );

        input.classList.remove(
            "success"
        );

        input.setAttribute(
            "aria-invalid",
            "true"
        );

    }


    const error =
        document.getElementById(
            errorId
        );


    if (error) {

        error.textContent =
            message;

    }

}


/* =========================================================
   22. CLEAR INPUT ERROR
   ========================================================= */

function clearResetInputError(
    input,
    errorId
) {

    if (input) {

        input.classList.remove(
            "error",
            "success"
        );

        input.removeAttribute(
            "aria-invalid"
        );

    }


    const error =
        document.getElementById(
            errorId
        );


    if (error) {

        error.textContent = "";

    }

}


/* =========================================================
   23. GLOBAL RESET MESSAGE
   ========================================================= */

function showResetMessage(
    message,
    type = "error"
) {

    const container =
        document.getElementById(
            "resetPasswordMessage"
        );

    const text =
        document.getElementById(
            "resetPasswordMessageText"
        );


    if (!container || !text) {
        return;
    }


    container.hidden =
        false;


    container.classList.remove(
        "success",
        "warning"
    );


    const icon =
        container.querySelector(
            ".auth-message-icon"
        );


    if (type === "success") {

        container.classList.add(
            "success"
        );


        if (icon) {

            icon.innerHTML =
                `<i data-lucide="circle-check"></i>`;

        }

    } else if (
        type === "warning"
    ) {

        container.classList.add(
            "warning"
        );


        if (icon) {

            icon.innerHTML =
                `<i data-lucide="triangle-alert"></i>`;

        }

    } else {

        if (icon) {

            icon.innerHTML =
                `<i data-lucide="circle-alert"></i>`;

        }

    }


    text.textContent =
        message;


    initializeResetLucideIcons();

}


/* =========================================================
   24. CLEAR MESSAGE
   ========================================================= */

function clearResetMessage() {

    const container =
        document.getElementById(
            "resetPasswordMessage"
        );


    if (!container) {
        return;
    }


    container.hidden =
        true;


    container.classList.remove(
        "success",
        "warning"
    );

}


/* =========================================================
   25. SAFE JSON PARSING
   ========================================================= */

async function parseResetResponse(
    response
) {

    try {

        return await response.json();

    } catch {

        return {};

    }

}


/* =========================================================
   END OF RESET PASSWORD JAVASCRIPT
   ========================================================= */