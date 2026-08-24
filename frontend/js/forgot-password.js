/* =========================================================
   SKYRA - FORGOT PASSWORD JAVASCRIPT
   File: frontend/js/forgot-password.js

   Used by:
   - forgot-password.html

   Handles:
   - Lucide icons
   - Current year
   - Email validation
   - Forgot password API request
   - Loading state
   - Success state
   - Resend reset link
   - Error messages
   ========================================================= */

"use strict";


/* =========================================================
   1. API CONFIGURATION
   ========================================================= */

const SKYRA_FORGOT_API_BASE_URL =
    window.SKYRA_CONFIG?.API_BASE_URL ||
    "http://localhost:5000/api";


/* =========================================================
   2. STATE
   ========================================================= */

let lastResetEmail = "";


/* =========================================================
   3. DOM READY
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initializeForgotLucideIcons();

        initializeForgotCurrentYear();

        initializeForgotPasswordForm();

        initializeResendResetLink();

    }
);


/* =========================================================
   4. LUCIDE ICONS
   ========================================================= */

function initializeForgotLucideIcons() {

    if (
        typeof lucide !== "undefined"
    ) {

        lucide.createIcons();

    }

}


/* =========================================================
   5. CURRENT YEAR
   ========================================================= */

function initializeForgotCurrentYear() {

    const yearElement =
        document.getElementById(
            "authCurrentYear"
        );


    if (!yearElement) {
        return;
    }


    yearElement.textContent =
        new Date().getFullYear();

}


/* =========================================================
   6. INITIALIZE FORM
   ========================================================= */

function initializeForgotPasswordForm() {

    const form =
        document.getElementById(
            "forgotPasswordForm"
        );

    const emailInput =
        document.getElementById(
            "forgotEmail"
        );


    if (!form || !emailInput) {
        return;
    }


    /* ---------------------------------------------
       Clear validation error while typing
       --------------------------------------------- */

    emailInput.addEventListener(
        "input",
        () => {

            clearForgotEmailError();

            clearForgotMessage();

        }
    );


    /* ---------------------------------------------
       Submit
       --------------------------------------------- */

    form.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();


            clearForgotMessage();


            const email =
                emailInput.value
                    .trim()
                    .toLowerCase();


            if (
                !validateForgotEmail(email)
            ) {
                return;
            }


            await sendPasswordResetRequest(
                email
            );

        }
    );

}


/* =========================================================
   7. EMAIL VALIDATION
   ========================================================= */

function validateForgotEmail(
    email
) {

    const emailInput =
        document.getElementById(
            "forgotEmail"
        );

    const errorElement =
        document.getElementById(
            "forgotEmailError"
        );


    if (!emailInput || !errorElement) {
        return false;
    }


    /* Empty */

    if (!email) {

        showForgotEmailError(
            "Email address is required."
        );

        return false;

    }


    /* Invalid format */

    if (
        !isValidForgotEmail(email)
    ) {

        showForgotEmailError(
            "Enter a valid email address."
        );

        return false;

    }


    emailInput.classList.remove(
        "error"
    );


    emailInput.classList.add(
        "success"
    );


    return true;

}


/* =========================================================
   8. VALID EMAIL
   ========================================================= */

function isValidForgotEmail(
    email
) {

    const emailPattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


    return emailPattern.test(
        email
    );

}


/* =========================================================
   9. EMAIL ERROR
   ========================================================= */

function showForgotEmailError(
    message
) {

    const emailInput =
        document.getElementById(
            "forgotEmail"
        );

    const errorElement =
        document.getElementById(
            "forgotEmailError"
        );


    if (emailInput) {

        emailInput.classList.add(
            "error"
        );

        emailInput.classList.remove(
            "success"
        );

        emailInput.setAttribute(
            "aria-invalid",
            "true"
        );

    }


    if (errorElement) {

        errorElement.textContent =
            message;

    }

}


/* =========================================================
   10. CLEAR EMAIL ERROR
   ========================================================= */

function clearForgotEmailError() {

    const emailInput =
        document.getElementById(
            "forgotEmail"
        );

    const errorElement =
        document.getElementById(
            "forgotEmailError"
        );


    if (emailInput) {

        emailInput.classList.remove(
            "error",
            "success"
        );

        emailInput.removeAttribute(
            "aria-invalid"
        );

    }


    if (errorElement) {

        errorElement.textContent = "";

    }

}


/* =========================================================
   11. SEND RESET REQUEST
   ========================================================= */

async function sendPasswordResetRequest(
    email,
    isResend = false
) {

    setForgotLoading(
        true,
        isResend
    );


    try {

        const response =
            await fetch(
                `${SKYRA_FORGOT_API_BASE_URL}/auth/forgot-password`,
                {

                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify({

                            email

                        })

                }
            );


        const data =
            await parseForgotResponse(
                response
            );


        if (!response.ok) {

            throw new Error(
                data?.message ||
                "Unable to send the password reset link."
            );

        }


        /*
           Important security behaviour:

           The server should ideally return the same
           success response whether or not an account
           exists for this email.

           This prevents attackers from discovering
           registered SKYRA accounts.
        */


        lastResetEmail =
            email;


        showForgotSuccessView(
            email
        );


        if (isResend) {

            showForgotMessage(
                "A new reset link has been sent.",
                "success"
            );

        }

    } catch (error) {

        console.error(
            "SKYRA forgot password error:",
            error
        );


        if (
            error instanceof TypeError
        ) {

            showForgotMessage(
                "Unable to connect to the SKYRA server. Make sure the backend is running.",
                "error"
            );

        } else {

            showForgotMessage(
                error.message ||
                "Something went wrong. Please try again.",
                "error"
            );

        }

    } finally {

        setForgotLoading(
            false,
            isResend
        );

    }

}


/* =========================================================
   12. LOADING STATE
   ========================================================= */

function setForgotLoading(
    loading,
    isResend = false
) {

    if (isResend) {

        const resendButton =
            document.getElementById(
                "resendResetLinkButton"
            );


        if (resendButton) {

            resendButton.disabled =
                loading;


            resendButton.innerHTML =
                loading
                    ? `
                        Sending...
                    `
                    : `
                        Didn't receive the email?
                        <strong>
                            Send again
                        </strong>
                    `;

        }


        return;

    }


    const button =
        document.getElementById(
            "forgotPasswordButton"
        );

    const text =
        document.getElementById(
            "forgotPasswordButtonText"
        );

    const arrow =
        document.getElementById(
            "forgotPasswordButtonArrow"
        );

    const loader =
        document.getElementById(
            "forgotPasswordButtonLoader"
        );


    if (!button) {
        return;
    }


    button.disabled =
        loading;


    if (text) {

        text.textContent =
            loading
                ? "Sending reset link..."
                : "Send Reset Link";

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
   13. SUCCESS VIEW
   ========================================================= */

function showForgotSuccessView(
    email
) {

    const formView =
        document.getElementById(
            "forgotPasswordFormView"
        );

    const successView =
        document.getElementById(
            "forgotPasswordSuccessView"
        );

    const successEmail =
        document.getElementById(
            "forgotSuccessEmail"
        );


    if (formView) {

        formView.hidden =
            true;

    }


    if (successView) {

        successView.hidden =
            false;

    }


    if (successEmail) {

        successEmail.textContent =
            email;

    }


    initializeForgotLucideIcons();

}


/* =========================================================
   14. RESEND RESET LINK
   ========================================================= */

function initializeResendResetLink() {

    const resendButton =
        document.getElementById(
            "resendResetLinkButton"
        );


    if (!resendButton) {
        return;
    }


    resendButton.addEventListener(
        "click",
        async () => {

            if (!lastResetEmail) {

                showForgotMessage(
                    "Enter your email again to request a new reset link.",
                    "error"
                );

                showForgotFormView();

                return;

            }


            await sendPasswordResetRequest(
                lastResetEmail,
                true
            );

        }
    );

}


/* =========================================================
   15. RETURN TO FORM VIEW
   ========================================================= */

function showForgotFormView() {

    const formView =
        document.getElementById(
            "forgotPasswordFormView"
        );

    const successView =
        document.getElementById(
            "forgotPasswordSuccessView"
        );


    if (formView) {

        formView.hidden =
            false;

    }


    if (successView) {

        successView.hidden =
            true;

    }


    initializeForgotLucideIcons();

}


/* =========================================================
   16. MESSAGE
   ========================================================= */

function showForgotMessage(
    message,
    type = "error"
) {

    const container =
        document.getElementById(
            "forgotPasswordMessage"
        );

    const text =
        document.getElementById(
            "forgotPasswordMessageText"
        );


    /*
       The message container is inside the original
       form view.

       When the success view is displayed there may
       be no visible message box, so a small temporary
       message is added to the success view instead.
    */

    const successView =
        document.getElementById(
            "forgotPasswordSuccessView"
        );


    if (
        successView &&
        !successView.hidden
    ) {

        showForgotSuccessNotification(
            message,
            type
        );

        return;

    }


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


    initializeForgotLucideIcons();

}


/* =========================================================
   17. SUCCESS VIEW NOTIFICATION
   ========================================================= */

function showForgotSuccessNotification(
    message,
    type
) {

    const successView =
        document.getElementById(
            "forgotPasswordSuccessView"
        );


    if (!successView) {
        return;
    }


    const existing =
        successView.querySelector(
            ".forgot-resend-message"
        );


    if (existing) {

        existing.remove();

    }


    const notification =
        document.createElement(
            "div"
        );


    notification.className =
        "auth-message forgot-resend-message";


    if (type === "success") {

        notification.classList.add(
            "success"
        );

    }


    notification.innerHTML = `

        <div class="auth-message-icon">

            <i data-lucide="${
                type === "success"
                    ? "circle-check"
                    : "circle-alert"
            }"></i>

        </div>

        <span></span>

    `;


    notification.querySelector(
        "span"
    ).textContent =
        message;


    successView.insertBefore(
        notification,
        successView.children[3] || null
    );


    initializeForgotLucideIcons();


    window.setTimeout(
        () => {

            notification.remove();

        },
        3500
    );

}


/* =========================================================
   18. CLEAR MESSAGE
   ========================================================= */

function clearForgotMessage() {

    const container =
        document.getElementById(
            "forgotPasswordMessage"
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
   19. SAFE JSON PARSING
   ========================================================= */

async function parseForgotResponse(
    response
) {

    try {

        return await response.json();

    } catch {

        return {};

    }

}


/* =========================================================
   END OF FORGOT PASSWORD JAVASCRIPT
   ========================================================= */