/* =========================================================
   SKYRA - AUTHENTICATION JAVASCRIPT
   File: frontend/js/auth.js

   Used by:
   - login.html
   - register.html

   Handles:
   - Lucide icons
   - Current year
   - Password visibility
   - Login validation
   - Register validation
   - Customer / Organiser role selection
   - Password strength
   - Loading states
   - API requests
   - JWT storage
   - Role-based redirects
   - Remember email
   - Success / error messages
   ========================================================= */

"use strict";


/* =========================================================
   1. CONFIGURATION

   Later config.js can define:

   window.SKYRA_CONFIG = {
       API_BASE_URL: "http://localhost:5000/api"
   };

   Until then localhost:5000/api is used.
   ========================================================= */

const SKYRA_API_BASE_URL =
    window.SKYRA_CONFIG?.API_BASE_URL ||
    "http://localhost:5000/api";


/* =========================================================
   2. STORAGE KEYS
   ========================================================= */

const STORAGE_KEYS = {

    TOKEN:
        "skyra_token",

    USER:
        "skyra_user",

    REMEMBERED_EMAIL:
        "skyra_remembered_email"

};


/* =========================================================
   3. DOM READY
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initializeLucideIcons();

        initializeAuthYear();

        initializePasswordToggles();

        initializeRoleSelection();

        initializePasswordStrength();

        initializeLoginForm();

        initializeRegisterForm();

        initializeRememberedEmail();

        initializeRegistrationSuccessMessage();

    }
);


/* =========================================================
   4. LUCIDE ICONS
   ========================================================= */

function initializeLucideIcons() {

    if (
        typeof lucide !== "undefined"
    ) {

        lucide.createIcons();

    }

}


/* =========================================================
   5. CURRENT YEAR
   ========================================================= */

function initializeAuthYear() {

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
   6. PASSWORD TOGGLES
   ========================================================= */

function initializePasswordToggles() {

    const togglePairs = [

        {
            buttonId:
                "passwordToggle",

            inputId:
                "loginPassword"
        },

        {
            buttonId:
                "registerPasswordToggle",

            inputId:
                "registerPassword"
        },

        {
            buttonId:
                "confirmPasswordToggle",

            inputId:
                "confirmPassword"
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

                    togglePasswordVisibility(
                        input,
                        button
                    );

                }
            );

        }
    );

}


/* =========================================================
   7. TOGGLE PASSWORD VISIBILITY
   ========================================================= */

function togglePasswordVisibility(
    input,
    button
) {

    const currentlyHidden =
        input.type === "password";


    input.type =
        currentlyHidden
            ? "text"
            : "password";


    button.setAttribute(
        "aria-pressed",
        String(currentlyHidden)
    );


    button.setAttribute(
        "aria-label",
        currentlyHidden
            ? "Hide password"
            : "Show password"
    );


    button.innerHTML =
        currentlyHidden
            ? `<i data-lucide="eye-off"></i>`
            : `<i data-lucide="eye"></i>`;


    initializeLucideIcons();


    input.focus();

}


/* =========================================================
   8. REGISTER ROLE SELECTION
   ========================================================= */

function initializeRoleSelection() {

    const roleCards =
        document.querySelectorAll(
            ".register-role-card"
        );


    if (!roleCards.length) {
        return;
    }


    roleCards.forEach(
        (card) => {

            const radio =
                card.querySelector(
                    'input[type="radio"][name="role"]'
                );


            if (!radio) {
                return;
            }


            if (radio.checked) {

                updateRoleCards(
                    roleCards,
                    radio
                );

            }


            card.addEventListener(
                "click",
                () => {

                    radio.checked = true;


                    updateRoleCards(
                        roleCards,
                        radio
                    );


                    clearFieldError(
                        "roleError"
                    );

                }
            );


            radio.addEventListener(
                "change",
                () => {

                    updateRoleCards(
                        roleCards,
                        radio
                    );

                }
            );

        }
    );

}


/* =========================================================
   9. UPDATE ROLE CARDS
   ========================================================= */

function updateRoleCards(
    roleCards,
    activeRadio
) {

    roleCards.forEach(
        (card) => {

            const radio =
                card.querySelector(
                    'input[type="radio"]'
                );


            const isActive =
                radio === activeRadio &&
                radio.checked;


            card.classList.toggle(
                "active",
                isActive
            );

        }
    );

}


/* =========================================================
   10. PASSWORD STRENGTH
   ========================================================= */

function initializePasswordStrength() {

    const passwordInput =
        document.getElementById(
            "registerPassword"
        );

    const strengthContainer =
        document.getElementById(
            "passwordStrength"
        );

    const strengthText =
        document.getElementById(
            "passwordStrengthText"
        );


    if (
        !passwordInput ||
        !strengthContainer ||
        !strengthText
    ) {
        return;
    }


    passwordInput.addEventListener(
        "input",
        () => {

            updatePasswordStrength(
                passwordInput.value,
                strengthContainer,
                strengthText
            );

        }
    );

}


/* =========================================================
   11. CALCULATE PASSWORD STRENGTH
   ========================================================= */

function calculatePasswordStrength(
    password
) {

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


    return score;

}


/* =========================================================
   12. UPDATE PASSWORD STRENGTH UI
   ========================================================= */

function updatePasswordStrength(
    password,
    container,
    textElement
) {

    container.classList.remove(
        "weak",
        "fair",
        "good",
        "strong"
    );


    if (!password) {

        textElement.textContent =
            "Use at least 8 characters";

        return;

    }


    const score =
        calculatePasswordStrength(
            password
        );


    if (score <= 1) {

        container.classList.add(
            "weak"
        );

        textElement.textContent =
            "Weak password";

    } else if (score === 2) {

        container.classList.add(
            "fair"
        );

        textElement.textContent =
            "Fair password";

    } else if (score === 3) {

        container.classList.add(
            "good"
        );

        textElement.textContent =
            "Good password";

    } else {

        container.classList.add(
            "strong"
        );

        textElement.textContent =
            "Strong password";

    }

}


/* =========================================================
   13. LOGIN FORM
   ========================================================= */

function initializeLoginForm() {

    const form =
        document.getElementById(
            "loginForm"
        );


    if (!form) {
        return;
    }


    const emailInput =
        document.getElementById(
            "loginEmail"
        );

    const passwordInput =
        document.getElementById(
            "loginPassword"
        );


    /* Clear errors while typing */

    emailInput?.addEventListener(
        "input",
        () => {

            clearInputError(
                emailInput,
                "emailError"
            );

        }
    );


    passwordInput?.addEventListener(
        "input",
        () => {

            clearInputError(
                passwordInput,
                "passwordError"
            );

        }
    );


    /* Submit */

    form.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();


            clearLoginMessage();


            const isValid =
                validateLoginForm();


            if (!isValid) {
                return;
            }


            await handleLogin();

        }
    );

}


/* =========================================================
   14. VALIDATE LOGIN FORM
   ========================================================= */

function validateLoginForm() {

    const emailInput =
        document.getElementById(
            "loginEmail"
        );

    const passwordInput =
        document.getElementById(
            "loginPassword"
        );


    if (!emailInput || !passwordInput) {
        return false;
    }


    const email =
        emailInput.value.trim();

    const password =
        passwordInput.value;


    let valid = true;


    /* Email */

    if (!email) {

        setInputError(
            emailInput,
            "emailError",
            "Email address is required."
        );

        valid = false;

    } else if (
        !isValidEmail(email)
    ) {

        setInputError(
            emailInput,
            "emailError",
            "Enter a valid email address."
        );

        valid = false;

    }


    /* Password */

    if (!password) {

        setInputError(
            passwordInput,
            "passwordError",
            "Password is required."
        );

        valid = false;

    }


    return valid;

}


/* =========================================================
   15. HANDLE LOGIN
   ========================================================= */

async function handleLogin() {

    const emailInput =
        document.getElementById(
            "loginEmail"
        );

    const passwordInput =
        document.getElementById(
            "loginPassword"
        );

    const rememberInput =
        document.getElementById(
            "rememberMe"
        );


    const email =
        emailInput.value
            .trim()
            .toLowerCase();

    const password =
        passwordInput.value;

    const rememberMe =
        Boolean(
            rememberInput?.checked
        );


    setLoginLoading(true);


    try {

        const response =
            await fetch(
                `${SKYRA_API_BASE_URL}/auth/login`,
                {

                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify({

                            email,
                            password

                        })

                }
            );


        const data =
            await parseResponseJSON(
                response
            );


        if (!response.ok) {

            throw new Error(
                data?.message ||
                "Unable to login. Check your email and password."
            );

        }


        /*
           Current SKYRA backend response:

           {
               success: true,
               message: "Login successful.",
               data: {
                   token: "...",
                   user: {
                       _id: "...",
                       name: "...",
                       email: "...",
                       role: "CUSTOMER"
                   }
               }
           }

           The fallback to the root object is kept so this
           frontend remains tolerant if the response shape is
           simplified later.
        */


        const authPayload =
            data?.data ||
            data;


        const token =
            authPayload?.token ||
            authPayload?.accessToken;


        const user =
            authPayload?.user;


        if (!token || !user) {

            throw new Error(
                "Login response is incomplete."
            );

        }


        saveAuthentication(
            token,
            user,
            rememberMe
        );


        handleRememberEmail(
            email,
            rememberMe
        );


        showLoginMessage(
            "Login successful. Redirecting...",
            "success"
        );


        window.setTimeout(
            () => {

                redirectUserByRole(
                    user.role
                );

            },
            650
        );

    } catch (error) {

        console.error(
            "SKYRA login error:",
            error
        );


        if (
            error instanceof TypeError
        ) {

            showLoginMessage(
                "Unable to connect to the SKYRA server. Make sure the backend is running.",
                "error"
            );

        } else {

            showLoginMessage(
                error.message ||
                "Login failed. Please try again.",
                "error"
            );

        }

    } finally {

        setLoginLoading(false);

    }

}


/* =========================================================
   16. LOGIN LOADING STATE
   ========================================================= */

function setLoginLoading(
    loading
) {

    const button =
        document.getElementById(
            "loginButton"
        );

    const text =
        document.getElementById(
            "loginButtonText"
        );

    const arrow =
        document.getElementById(
            "loginButtonArrow"
        );

    const loader =
        document.getElementById(
            "loginButtonLoader"
        );


    if (!button) {
        return;
    }


    button.disabled =
        loading;


    if (text) {

        text.textContent =
            loading
                ? "Signing in..."
                : "Login";

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
   17. LOGIN MESSAGE
   ========================================================= */

function showLoginMessage(
    message,
    type = "error"
) {

    const container =
        document.getElementById(
            "loginMessage"
        );

    const text =
        document.getElementById(
            "loginMessageText"
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


    if (type === "success") {

        container.classList.add(
            "success"
        );

        container.querySelector(
            ".auth-message-icon"
        ).innerHTML =
            `<i data-lucide="circle-check"></i>`;

    } else {

        container.querySelector(
            ".auth-message-icon"
        ).innerHTML =
            `<i data-lucide="circle-alert"></i>`;

    }


    text.textContent =
        message;


    initializeLucideIcons();

}


/* =========================================================
   18. CLEAR LOGIN MESSAGE
   ========================================================= */

function clearLoginMessage() {

    const container =
        document.getElementById(
            "loginMessage"
        );


    if (!container) {
        return;
    }


    container.hidden = true;

    container.classList.remove(
        "success",
        "warning"
    );

}


/* =========================================================
   19. REGISTER FORM
   ========================================================= */

function initializeRegisterForm() {

    const form =
        document.getElementById(
            "registerForm"
        );


    if (!form) {
        return;
    }


    const fields = [

        {
            input:
                document.getElementById(
                    "registerName"
                ),

            errorId:
                "nameError"
        },

        {
            input:
                document.getElementById(
                    "registerEmail"
                ),

            errorId:
                "registerEmailError"
        },

        {
            input:
                document.getElementById(
                    "registerPhone"
                ),

            errorId:
                "phoneError"
        },

        {
            input:
                document.getElementById(
                    "registerPassword"
                ),

            errorId:
                "registerPasswordError"
        },

        {
            input:
                document.getElementById(
                    "confirmPassword"
                ),

            errorId:
                "confirmPasswordError"
        }

    ];


    fields.forEach(
        ({ input, errorId }) => {

            if (!input) {
                return;
            }


            input.addEventListener(
                "input",
                () => {

                    clearInputError(
                        input,
                        errorId
                    );

                }
            );

        }
    );


    const terms =
        document.getElementById(
            "acceptTerms"
        );


    terms?.addEventListener(
        "change",
        () => {

            clearFieldError(
                "termsError"
            );

        }
    );


    form.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();


            clearRegisterMessage();


            const valid =
                validateRegisterForm();


            if (!valid) {
                return;
            }


            await handleRegistration();

        }
    );

}


/* =========================================================
   20. VALIDATE REGISTER FORM
   ========================================================= */

function validateRegisterForm() {

    const nameInput =
        document.getElementById(
            "registerName"
        );

    const emailInput =
        document.getElementById(
            "registerEmail"
        );

    const phoneInput =
        document.getElementById(
            "registerPhone"
        );

    const passwordInput =
        document.getElementById(
            "registerPassword"
        );

    const confirmInput =
        document.getElementById(
            "confirmPassword"
        );

    const termsInput =
        document.getElementById(
            "acceptTerms"
        );

    const selectedRole =
        document.querySelector(
            'input[name="role"]:checked'
        );


    if (
        !nameInput ||
        !emailInput ||
        !passwordInput ||
        !confirmInput
    ) {

        return false;

    }


    let valid = true;


    const name =
        nameInput.value.trim();

    const email =
        emailInput.value.trim();

    const phone =
        phoneInput?.value.trim() || "";

    const password =
        passwordInput.value;

    const confirmPassword =
        confirmInput.value;


    /* Role */

    if (!selectedRole) {

        setFieldError(
            "roleError",
            "Choose Customer or Organiser."
        );

        valid = false;

    } else if (
        ![
            "CUSTOMER",
            "ORGANISER"
        ].includes(
            selectedRole.value
        )
    ) {

        setFieldError(
            "roleError",
            "Invalid account type."
        );

        valid = false;

    }


    /* Name */

    if (!name) {

        setInputError(
            nameInput,
            "nameError",
            "Full name is required."
        );

        valid = false;

    } else if (
        name.length < 2
    ) {

        setInputError(
            nameInput,
            "nameError",
            "Name must contain at least 2 characters."
        );

        valid = false;

    } else if (
        !isValidName(name)
    ) {

        setInputError(
            nameInput,
            "nameError",
            "Enter a valid full name."
        );

        valid = false;

    }


    /* Email */

    if (!email) {

        setInputError(
            emailInput,
            "registerEmailError",
            "Email address is required."
        );

        valid = false;

    } else if (
        !isValidEmail(email)
    ) {

        setInputError(
            emailInput,
            "registerEmailError",
            "Enter a valid email address."
        );

        valid = false;

    }


    /* Phone - optional */

    if (
        phone &&
        !isValidPhone(phone)
    ) {

        setInputError(
            phoneInput,
            "phoneError",
            "Enter a valid phone number."
        );

        valid = false;

    }


    /* Password */

    const passwordValidation =
        validatePassword(
            password
        );


    if (!password) {

        setInputError(
            passwordInput,
            "registerPasswordError",
            "Password is required."
        );

        valid = false;

    } else if (
        !passwordValidation.valid
    ) {

        setInputError(
            passwordInput,
            "registerPasswordError",
            passwordValidation.message
        );

        valid = false;

    }


    /* Confirm password */

    if (!confirmPassword) {

        setInputError(
            confirmInput,
            "confirmPasswordError",
            "Confirm your password."
        );

        valid = false;

    } else if (
        password !==
        confirmPassword
    ) {

        setInputError(
            confirmInput,
            "confirmPasswordError",
            "Passwords do not match."
        );

        valid = false;

    }


    /* Terms */

    if (
        termsInput &&
        !termsInput.checked
    ) {

        setFieldError(
            "termsError",
            "You must accept the Terms of Service and Privacy Policy."
        );

        valid = false;

    }


    return valid;

}


/* =========================================================
   21. HANDLE REGISTRATION
   ========================================================= */

async function handleRegistration() {

    const selectedRole =
        document.querySelector(
            'input[name="role"]:checked'
        );


    const name =
        document.getElementById(
            "registerName"
        ).value.trim();


    const email =
        document.getElementById(
            "registerEmail"
        ).value
            .trim()
            .toLowerCase();


    const phone =
        document.getElementById(
            "registerPhone"
        )?.value.trim() || "";


    const password =
        document.getElementById(
            "registerPassword"
        ).value;


    const confirmPassword =
        document.getElementById(
            "confirmPassword"
        ).value;


    const role =
        selectedRole?.value;


    setRegisterLoading(true);


    try {

        const response =
            await fetch(
                `${SKYRA_API_BASE_URL}/auth/register`,
                {

                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify({

                            name,
                            email,
                            phone:
                                phone || undefined,

                            password,
                            confirmPassword,
                            role

                        })

                }
            );


        const data =
            await parseResponseJSON(
                response
            );


        if (!response.ok) {

            throw new Error(
                data?.message ||
                "Unable to create your SKYRA account."
            );

        }


        showRegisterMessage(
            "Account created successfully. Redirecting to login...",
            "success"
        );


        window.setTimeout(
            () => {

                window.location.href =
                    `./login.html?registered=1&email=${
                        encodeURIComponent(
                            email
                        )
                    }`;

            },
            900
        );

    } catch (error) {

        console.error(
            "SKYRA registration error:",
            error
        );


        if (
            error instanceof TypeError
        ) {

            showRegisterMessage(
                "Unable to connect to the SKYRA server. Make sure the backend is running.",
                "error"
            );

        } else {

            showRegisterMessage(
                error.message ||
                "Registration failed. Please try again.",
                "error"
            );

        }

    } finally {

        setRegisterLoading(false);

    }

}


/* =========================================================
   22. REGISTER LOADING
   ========================================================= */

function setRegisterLoading(
    loading
) {

    const button =
        document.getElementById(
            "registerButton"
        );

    const text =
        document.getElementById(
            "registerButtonText"
        );

    const arrow =
        document.getElementById(
            "registerButtonArrow"
        );

    const loader =
        document.getElementById(
            "registerButtonLoader"
        );


    if (!button) {
        return;
    }


    button.disabled =
        loading;


    if (text) {

        text.textContent =
            loading
                ? "Creating account..."
                : "Create Account";

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
   23. REGISTER MESSAGE
   ========================================================= */

function showRegisterMessage(
    message,
    type = "error"
) {

    const container =
        document.getElementById(
            "registerMessage"
        );

    const text =
        document.getElementById(
            "registerMessageText"
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


    const iconContainer =
        container.querySelector(
            ".auth-message-icon"
        );


    if (type === "success") {

        container.classList.add(
            "success"
        );


        if (iconContainer) {

            iconContainer.innerHTML =
                `<i data-lucide="circle-check"></i>`;

        }

    } else {

        if (iconContainer) {

            iconContainer.innerHTML =
                `<i data-lucide="circle-alert"></i>`;

        }

    }


    text.textContent =
        message;


    initializeLucideIcons();

}


/* =========================================================
   24. CLEAR REGISTER MESSAGE
   ========================================================= */

function clearRegisterMessage() {

    const container =
        document.getElementById(
            "registerMessage"
        );


    if (!container) {
        return;
    }


    container.hidden = true;

    container.classList.remove(
        "success",
        "warning"
    );

}


/* =========================================================
   25. VALIDATE EMAIL
   ========================================================= */

function isValidEmail(
    email
) {

    /*
       Simple client validation.

       Backend still performs final validation.
    */

    const emailPattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


    return emailPattern.test(
        email
    );

}


/* =========================================================
   26. VALIDATE NAME
   ========================================================= */

function isValidName(
    name
) {

    /*
       Supports normal alphabetic names,
       spaces, apostrophes, periods and hyphens.
    */

    const namePattern =
        /^[A-Za-z][A-Za-z\s.'-]{1,79}$/;


    return namePattern.test(
        name
    );

}


/* =========================================================
   27. VALIDATE PHONE
   ========================================================= */

function isValidPhone(
    phone
) {

    /*
       Allows examples such as:

       9876543210
       +919876543210
       +91 98765 43210
       98765-43210
    */

    const cleaned =
        phone.replace(
            /[\s()-]/g,
            ""
        );


    return /^\+?\d{10,15}$/.test(
        cleaned
    );

}


/* =========================================================
   28. VALIDATE PASSWORD
   ========================================================= */

function validatePassword(
    password
) {

    if (password.length < 8) {

        return {

            valid: false,

            message:
                "Password must contain at least 8 characters."

        };

    }


    if (
        !/[A-Z]/.test(password)
    ) {

        return {

            valid: false,

            message:
                "Password must contain an uppercase letter."

        };

    }


    if (
        !/[a-z]/.test(password)
    ) {

        return {

            valid: false,

            message:
                "Password must contain a lowercase letter."

        };

    }


    if (
        !/\d/.test(password)
    ) {

        return {

            valid: false,

            message:
                "Password must contain at least one number."

        };

    }


    return {

        valid: true,

        message: ""

    };

}


/* =========================================================
   29. INPUT ERROR
   ========================================================= */

function setInputError(
    input,
    errorId,
    message
) {

    if (!input) {
        return;
    }


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


    setFieldError(
        errorId,
        message
    );

}


/* =========================================================
   30. CLEAR INPUT ERROR
   ========================================================= */

function clearInputError(
    input,
    errorId
) {

    if (input) {

        input.classList.remove(
            "error"
        );


        input.removeAttribute(
            "aria-invalid"
        );

    }


    clearFieldError(
        errorId
    );

}


/* =========================================================
   31. FIELD ERROR
   ========================================================= */

function setFieldError(
    errorId,
    message
) {

    const element =
        document.getElementById(
            errorId
        );


    if (!element) {
        return;
    }


    element.textContent =
        message;

}


/* =========================================================
   32. CLEAR FIELD ERROR
   ========================================================= */

function clearFieldError(
    errorId
) {

    const element =
        document.getElementById(
            errorId
        );


    if (!element) {
        return;
    }


    element.textContent = "";

}


/* =========================================================
   33. SAVE AUTHENTICATION
   ========================================================= */

function saveAuthentication(
    token,
    user,
    rememberMe
) {

    /*
       Remember Me:
       true  → localStorage
       false → sessionStorage

       Password is NEVER stored.
    */


    clearAuthentication();


    const storage =
        rememberMe
            ? localStorage
            : sessionStorage;


    storage.setItem(
        STORAGE_KEYS.TOKEN,
        token
    );


    storage.setItem(
        STORAGE_KEYS.USER,
        JSON.stringify(user)
    );

}


/* =========================================================
   34. CLEAR AUTHENTICATION
   ========================================================= */

function clearAuthentication() {

    localStorage.removeItem(
        STORAGE_KEYS.TOKEN
    );

    localStorage.removeItem(
        STORAGE_KEYS.USER
    );


    sessionStorage.removeItem(
        STORAGE_KEYS.TOKEN
    );

    sessionStorage.removeItem(
        STORAGE_KEYS.USER
    );

}


/* =========================================================
   35. REMEMBER EMAIL
   ========================================================= */

function handleRememberEmail(
    email,
    rememberMe
) {

    if (rememberMe) {

        localStorage.setItem(
            STORAGE_KEYS.REMEMBERED_EMAIL,
            email
        );

    } else {

        localStorage.removeItem(
            STORAGE_KEYS.REMEMBERED_EMAIL
        );

    }

}


/* =========================================================
   36. RESTORE REMEMBERED EMAIL
   ========================================================= */

function initializeRememberedEmail() {

    const emailInput =
        document.getElementById(
            "loginEmail"
        );

    const rememberCheckbox =
        document.getElementById(
            "rememberMe"
        );


    if (!emailInput) {
        return;
    }


    const params =
        new URLSearchParams(
            window.location.search
        );


    const emailFromRegistration =
        params.get("email");


    if (emailFromRegistration) {

        emailInput.value =
            emailFromRegistration;

        return;

    }


    const rememberedEmail =
        localStorage.getItem(
            STORAGE_KEYS.REMEMBERED_EMAIL
        );


    if (rememberedEmail) {

        emailInput.value =
            rememberedEmail;


        if (rememberCheckbox) {

            rememberCheckbox.checked =
                true;

        }

    }

}


/* =========================================================
   37. REGISTRATION SUCCESS MESSAGE ON LOGIN
   ========================================================= */

function initializeRegistrationSuccessMessage() {

    const loginForm =
        document.getElementById(
            "loginForm"
        );


    if (!loginForm) {
        return;
    }


    const params =
        new URLSearchParams(
            window.location.search
        );


    if (
        params.get("registered") === "1"
    ) {

        showLoginMessage(
            "Your SKYRA account has been created. Login to continue.",
            "success"
        );

    }

}


/* =========================================================
   38. ROLE REDIRECTION
   ========================================================= */

function redirectUserByRole(
    role
) {

    const normalizedRole =
        String(role || "")
            .trim()
            .toUpperCase();


    switch (normalizedRole) {

        case "CUSTOMER":

            window.location.href =
                "./customer/dashboard.html";

            break;


        case "ORGANISER":

            window.location.href =
                "./organiser/dashboard.html";

            break;


        case "ADMIN":

            window.location.href =
                "./admin/dashboard.html";

            break;


        default:

            clearAuthentication();


            showLoginMessage(
                "Your account role could not be determined.",
                "error"
            );

    }

}


/* =========================================================
   39. SAFE JSON RESPONSE
   ========================================================= */

async function parseResponseJSON(
    response
) {

    try {

        return await response.json();

    } catch {

        return {};

    }

}


/* =========================================================
   40. GET STORED TOKEN
   Used later by api.js / protected pages
   ========================================================= */

function getStoredToken() {

    return (
        localStorage.getItem(
            STORAGE_KEYS.TOKEN
        )
        ||
        sessionStorage.getItem(
            STORAGE_KEYS.TOKEN
        )
    );

}


/* =========================================================
   41. GET STORED USER
   ========================================================= */

function getStoredUser() {

    const value =
        localStorage.getItem(
            STORAGE_KEYS.USER
        )
        ||
        sessionStorage.getItem(
            STORAGE_KEYS.USER
        );


    if (!value) {
        return null;
    }


    try {

        return JSON.parse(
            value
        );

    } catch {

        return null;

    }

}


/* =========================================================
   42. EXPORT SMALL AUTH HELPERS GLOBALLY

   These will be reusable later from common.js/api.js
   while we are still using vanilla JavaScript.
   ========================================================= */

window.SKYRA_AUTH = {

    getToken:
        getStoredToken,

    getUser:
        getStoredUser,

    clear:
        clearAuthentication,

    redirectByRole:
        redirectUserByRole

};


/* =========================================================
   END OF SKYRA AUTHENTICATION JAVASCRIPT
   ========================================================= */