/* =========================================================
   SKYRA - ADMIN CREATE VENUE
   File:
   frontend/js/admin/create-venue.js

   Current frontend phase:
   - Venue metadata form
   - Validation
   - Live preview
   - Draft persistence
   - Duplicate venue protection
   - Runtime localStorage creation
   - Future backend API hook

   Important architecture:
   Creating Venue DOES NOT create physical seats.

   New venue initially:
   capacity = 0
   categories = []
   layoutConfigured = false

   Future backend:
   POST /api/admin/venues

   Backend authorization:
   authMiddleware
   authorizeRoles("ADMIN")
   ========================================================= */

"use strict";


/* =========================================================
   1. STORAGE KEYS
   Only unsaved form draft state is local. Venue records are
   always loaded/saved through the backend.
   ========================================================= */

const SKYRA_CREATE_VENUE_STORAGE = {
    CREATE_DRAFT: "skyra_admin_create_venue_draft"
};


/* =========================================================
   3. STATE
   ========================================================= */

const adminCreateVenueState = {

    dirty:
        false,

    creating:
        false,

    pendingAction:
        "VENUES",

    pendingVenue:
        null,

    draftLoaded:
        false

};


/* =========================================================
   4. DOM READY
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initializeAdminCreateVenuePage();

    }
);


/* =========================================================
   5. INITIALIZE
   ========================================================= */

function initializeAdminCreateVenuePage() {

    initializeCreateVenueAdminUser();

    initializeCreateVenueNavigation();

    initializeCreateVenueForm();

    initializeCreateVenuePreview();

    initializeCreateVenueDraft();

    initializeCreateVenueModal();

    initializeCreateVenueTopSearch();

    updateCreateVenueSidebarCount();

    refreshCreateVenueIcons();

}


/* =========================================================
   6. ADMIN USER
   ========================================================= */

function initializeCreateVenueAdminUser() {

    const sharedUser =
        window.SKYRA_COMMON
            ?.getUser?.();


    let admin = {

        name:
            "SKYRA Admin",

        email:
            "",

        role:
            "ADMIN"

    };


    if (
        sharedUser &&
        String(
            sharedUser.role ||
            ""
        ).toUpperCase() ===
        "ADMIN"
    ) {

        admin = {

            ...admin,
            ...sharedUser

        };

    }


    const name =
        String(
            admin.name ||
            admin.fullName ||
            "SKYRA Admin"
        );


    const initials =
        createVenueInitials(
            name
        );


    setCreateVenueText(
        "sidebarUserName",
        name
    );


    setCreateVenueText(
        "sidebarUserInitials",
        initials
    );


    setCreateVenueText(
        "topbarUserName",
        name
    );


    setCreateVenueText(
        "topbarUserInitials",
        initials
    );


    setCreateVenueText(
        "dropdownUserName",
        name
    );


    setCreateVenueText(
        "dropdownUserInitials",
        initials
    );


    setCreateVenueText(
        "dropdownUserEmail",
        admin.email ||
        ""
    );

}


/* =========================================================
   7. NAVIGATION
   ========================================================= */

function initializeCreateVenueNavigation() {

    document
        .querySelectorAll(
            ".sidebar-nav .sidebar-link"
        )
        .forEach(
            (link) => {

                const active =
                    link.getAttribute(
                        "href"
                    ) ===
                    "./venues.html";


                link.classList.toggle(
                    "active",
                    active
                );


                if (active) {

                    link.setAttribute(
                        "aria-current",
                        "page"
                    );

                } else {

                    link.removeAttribute(
                        "aria-current"
                    );

                }

            }
        );

}


/* =========================================================
   8. FORM INITIALIZATION
   ========================================================= */

function initializeCreateVenueForm() {

    const form =
        document.getElementById(
            "createVenueForm"
        );


    if (!form) {

        return;

    }


    /*
       INPUT CHANGE TRACKING
    */

    form
        .querySelectorAll(
            "input, select, textarea"
        )
        .forEach(
            (field) => {

                field.addEventListener(
                    "input",
                    () => {

                        adminCreateVenueState.dirty =
                            true;


                        clearCreateVenueFieldError(
                            field.name
                        );


                        updateCreateVenuePreview();

                    }
                );


                field.addEventListener(
                    "change",
                    () => {

                        adminCreateVenueState.dirty =
                            true;


                        clearCreateVenueFieldError(
                            field.name
                        );


                        updateCreateVenuePreview();

                    }
                );

            }
        );


    /*
       DESCRIPTION COUNTER
    */

    document
        .getElementById(
            "venueDescription"
        )
        ?.addEventListener(
            "input",
            updateCreateVenueDescriptionCounter
        );


    /*
       SUBMIT
    */

    form.addEventListener(
        "submit",
        handleCreateVenueSubmit
    );


    /*
       SAVE DRAFT
    */

    document
        .getElementById(
            "saveVenueDraftButton"
        )
        ?.addEventListener(
            "click",
            saveCreateVenueDraft
        );


    /*
       BEFORE LEAVING
    */

    window.addEventListener(
        "beforeunload",
        (event) => {

            if (
                !adminCreateVenueState.dirty ||
                adminCreateVenueState.creating
            ) {

                return;

            }


            event.preventDefault();

            event.returnValue =
                "";

        }
    );

}


/* =========================================================
   9. SUBMIT
   ========================================================= */

function handleCreateVenueSubmit(
    event
) {

    event.preventDefault();


    if (
        adminCreateVenueState.creating
    ) {

        return;

    }


    const submitter =
        event.submitter;


    const action =
        submitter?.dataset
            ?.createAction ||
        "VENUES";


    adminCreateVenueState.pendingAction =
        action;


    const venue =
        collectCreateVenueFormData();


    const valid =
        validateCreateVenue(
            venue
        );


    if (!valid) {

        showCreateVenueToast(
            "Please correct the highlighted venue information.",
            "error",
            "Check Venue Details"
        );


        focusFirstCreateVenueError();

        return;

    }


    if (
        isDuplicateCreateVenue(
            venue
        )
    ) {

        setCreateVenueFieldError(
            "name",
            "A venue with this name already exists in the same city."
        );


        document
            .getElementById(
                "venueName"
            )
            ?.focus();


        showCreateVenueToast(
            "This venue already exists in the selected city.",
            "error",
            "Duplicate Venue"
        );


        return;

    }


    adminCreateVenueState.pendingVenue =
        venue;


    openCreateVenueConfirmation();

}


/* =========================================================
   10. COLLECT FORM DATA
   ========================================================= */

function collectCreateVenueFormData() {

    const name =
        getCreateVenueValue(
            "venueName"
        );


    const type =
        getCreateVenueValue(
            "venueType"
        );


    const status =
        getCreateVenueValue(
            "venueStatus"
        ) ||
        "ACTIVE";


    const description =
        getCreateVenueValue(
            "venueDescription"
        );


    const address =
        getCreateVenueValue(
            "venueAddress"
        );


    const city =
        getCreateVenueValue(
            "venueCity"
        );


    const state =
        getCreateVenueValue(
            "venueState"
        );


    const country =
        getCreateVenueValue(
            "venueCountry"
        ) ||
        "India";


    const postalCode =
        getCreateVenueValue(
            "venuePostalCode"
        );


    return {

        name:
            cleanCreateVenueText(
                name
            ),

        type:
            normalizeCreateVenueType(
                type
            ),

        status:
            normalizeCreateVenueStatus(
                status
            ),

        description:
            cleanCreateVenueText(
                description
            ),

        address:
            cleanCreateVenueText(
                address
            ),

        city:
            cleanCreateVenueText(
                city
            ),

        state:
            cleanCreateVenueText(
                state
            ),

        country:
            cleanCreateVenueText(
                country
            ),

        postalCode:
            cleanCreateVenueText(
                postalCode
            )

    };

}


/* =========================================================
   11. VALIDATION
   ========================================================= */

function validateCreateVenue(
    venue
) {

    clearAllCreateVenueErrors();


    let valid =
        true;


    /*
       NAME
    */

    if (!venue.name) {

        setCreateVenueFieldError(
            "name",
            "Venue name is required."
        );


        valid =
            false;

    } else if (
        venue.name.length <
        3
    ) {

        setCreateVenueFieldError(
            "name",
            "Venue name must contain at least 3 characters."
        );


        valid =
            false;

    }


    /*
       TYPE
    */

    if (!venue.type) {

        setCreateVenueFieldError(
            "type",
            "Please select a venue type."
        );


        valid =
            false;

    }


    /*
       ADDRESS
    */

    if (!venue.address) {

        setCreateVenueFieldError(
            "address",
            "Venue address is required."
        );


        valid =
            false;

    } else if (
        venue.address.length <
        4
    ) {

        setCreateVenueFieldError(
            "address",
            "Please enter a valid venue address."
        );


        valid =
            false;

    }


    /*
       CITY
    */

    if (!venue.city) {

        setCreateVenueFieldError(
            "city",
            "City is required."
        );


        valid =
            false;

    }


    /*
       STATE
    */

    if (!venue.state) {

        setCreateVenueFieldError(
            "state",
            "State or region is required."
        );


        valid =
            false;

    }


    /*
       COUNTRY
    */

    if (!venue.country) {

        setCreateVenueFieldError(
            "country",
            "Country is required."
        );


        valid =
            false;

    }


    /*
       POSTAL CODE
    */

    if (!venue.postalCode) {

        setCreateVenueFieldError(
            "postalCode",
            "Postal or PIN code is required."
        );


        valid =
            false;

    } else if (
        venue.country
            .toLowerCase() ===
            "india" &&
        !/^[1-9][0-9]{5}$/.test(
            venue.postalCode
        )
    ) {

        setCreateVenueFieldError(
            "postalCode",
            "Enter a valid 6-digit Indian PIN code."
        );


        valid =
            false;

    }


    return valid;

}


/* =========================================================
   12. FIELD ERROR MAP
   ========================================================= */

function getCreateVenueFieldConfig(
    fieldName
) {

    const map = {

        name: {

            inputId:
                "venueName",

            errorId:
                "venueNameError"

        },

        type: {

            inputId:
                "venueType",

            errorId:
                "venueTypeError"

        },

        address: {

            inputId:
                "venueAddress",

            errorId:
                "venueAddressError"

        },

        city: {

            inputId:
                "venueCity",

            errorId:
                "venueCityError"

        },

        state: {

            inputId:
                "venueState",

            errorId:
                "venueStateError"

        },

        country: {

            inputId:
                "venueCountry",

            errorId:
                "venueCountryError"

        },

        postalCode: {

            inputId:
                "venuePostalCode",

            errorId:
                "venuePostalCodeError"

        }

    };


    return map[
        fieldName
    ] ||
    null;

}


/* =========================================================
   13. SET FIELD ERROR
   ========================================================= */

function setCreateVenueFieldError(
    fieldName,
    message
) {

    const config =
        getCreateVenueFieldConfig(
            fieldName
        );


    if (!config) {

        return;

    }


    const input =
        document.getElementById(
            config.inputId
        );


    const error =
        document.getElementById(
            config.errorId
        );


    input
        ?.classList
        .add(
            "is-invalid"
        );


    input
        ?.closest(
            ".admin-input-control, .admin-select-control"
        )
        ?.classList
        .add(
            "is-invalid"
        );


    if (error) {

        error.textContent =
            message;


        error.hidden =
            false;

    }

}


/* =========================================================
   14. CLEAR FIELD ERROR
   ========================================================= */

function clearCreateVenueFieldError(
    fieldName
) {

    const config =
        getCreateVenueFieldConfig(
            fieldName
        );


    if (!config) {

        return;

    }


    const input =
        document.getElementById(
            config.inputId
        );


    const error =
        document.getElementById(
            config.errorId
        );


    input
        ?.classList
        .remove(
            "is-invalid"
        );


    input
        ?.closest(
            ".admin-input-control, .admin-select-control"
        )
        ?.classList
        .remove(
            "is-invalid"
        );


    if (error) {

        error.hidden =
            true;


        error.textContent =
            "";

    }

}


/* =========================================================
   15. CLEAR ALL ERRORS
   ========================================================= */

function clearAllCreateVenueErrors() {

    [

        "name",
        "type",
        "address",
        "city",
        "state",
        "country",
        "postalCode"

    ].forEach(
        clearCreateVenueFieldError
    );

}


/* =========================================================
   16. FOCUS FIRST ERROR
   ========================================================= */

function focusFirstCreateVenueError() {

    const invalid =
        document.querySelector(
            ".admin-create-venue-form .is-invalid"
        );


    if (!invalid) {

        return;

    }


    const focusable =
        invalid.matches(
            "input, select, textarea"
        )
            ? invalid
            : invalid.querySelector(
                "input, select, textarea"
            );


    focusable?.focus();

}


/* =========================================================
   17. DUPLICATE VENUE CHECK
   ========================================================= */

function isDuplicateCreateVenue() {

    /*
       MongoDB/backend is authoritative for duplicate venue
       validation. Do not compare against browser demo data.
    */
    return false;

}


/* =========================================================
   18. CREATE CONFIRMATION MODAL
   ========================================================= */

function initializeCreateVenueModal() {

    document
        .getElementById(
            "closeCreateVenueModal"
        )
        ?.addEventListener(
            "click",
            closeCreateVenueConfirmation
        );


    document
        .getElementById(
            "cancelCreateVenueButton"
        )
        ?.addEventListener(
            "click",
            closeCreateVenueConfirmation
        );


    document
        .getElementById(
            "confirmCreateVenueButton"
        )
        ?.addEventListener(
            "click",
            confirmCreateVenue
        );


    const modal =
        document.getElementById(
            "createVenueModal"
        );


    modal?.addEventListener(
        "click",
        (event) => {

            if (
                event.target ===
                modal
            ) {

                closeCreateVenueConfirmation();

            }

        }
    );

}


/* =========================================================
   19. OPEN CONFIRMATION
   ========================================================= */

function openCreateVenueConfirmation() {

    const modal =
        document.getElementById(
            "createVenueModal"
        );


    if (!modal) {

        return;

    }


    const venue =
        adminCreateVenueState
            .pendingVenue;


    const description =
        document.getElementById(
            "createVenueModalDescription"
        );


    if (
        description &&
        venue
    ) {

        description.textContent =
            adminCreateVenueState.pendingAction ===
                "CATEGORIES"
                ? `${venue.name} will be created, then you'll continue to Seat Categories.`
                : `${venue.name} will be created as a venue record.`;

    }


    modal.hidden =
        false;


    document.body.classList.add(
        "modal-open"
    );


    setTimeout(
        () => {

            document
                .getElementById(
                    "confirmCreateVenueButton"
                )
                ?.focus();

        },
        0
    );

}


/* =========================================================
   20. CLOSE CONFIRMATION
   ========================================================= */

function closeCreateVenueConfirmation() {

    const modal =
        document.getElementById(
            "createVenueModal"
        );


    if (modal) {

        modal.hidden =
            true;

    }


    document.body.classList.remove(
        "modal-open"
    );

}


/* =========================================================
   21. CONFIRM CREATION
   ========================================================= */

async function confirmCreateVenue() {

    const venue =
        adminCreateVenueState
            .pendingVenue;


    if (
        !venue ||
        adminCreateVenueState.creating
    ) {

        return;

    }


    adminCreateVenueState.creating =
        true;


    setCreateVenueSubmittingState(
        true
    );


    try {

        const createdVenue =
            await createAdminVenueRecord(
                venue
            );


        if (
            !createdVenue ||
            !createdVenue.id
        ) {

            throw new Error(
                "Venue creation did not return a valid venue."
            );

        }


        adminCreateVenueState.dirty =
            false;


        removeCreateVenueDraft();


        closeCreateVenueConfirmation();


        showCreateVenueToast(
            `${createdVenue.name} was created successfully.`,
            "success",
            "Venue Created"
        );


        const venueId =
            encodeURIComponent(
                createdVenue.id
            );


        /*
           Give the toast a short moment to display.
        */

        setTimeout(
            () => {

                if (
                    adminCreateVenueState.pendingAction ===
                    "CATEGORIES"
                ) {

                    window.location.href =
                        `./seat-categories.html?venue=${venueId}`;

                } else {

                    window.location.href =
                        "./venues.html";

                }

            },
            550
        );

    } catch (error) {

        console.error(
            "Unable to create venue:",
            error
        );


        showCreateVenueToast(
            error?.message ||
            "Unable to create the venue.",
            "error",
            "Venue Creation Failed"
        );

    } finally {

        adminCreateVenueState.creating =
            false;


        setCreateVenueSubmittingState(
            false
        );

    }

}


/* =========================================================
   22. CREATE VENUE RECORD
   ========================================================= */

async function createAdminVenueRecord(
    formVenue
) {

    /*
       Important:
       These are NOT physical seats.

       Venue starts with:
       capacity = 0
       categories = []
       layoutConfigured = false
    */

    const payload = {

        name:
            formVenue.name,

        type:
            formVenue.type,

        address:
            formVenue.address,

        city:
            formVenue.city,

        state:
            formVenue.state,

        country:
            formVenue.country,

        postalCode:
            formVenue.postalCode,

        status:
            formVenue.status,

        description:
            formVenue.description

    };


    /*
       FUTURE BACKEND

       POST /api/admin/venues
    */

    if (
        window.SKYRA_API &&
        typeof window.SKYRA_API
            .createAdminVenue ===
            "function"
    ) {

        const response =
            await window.SKYRA_API
                .createAdminVenue(
                    payload
                );


        const created =
            response?.venue ||
            response?.data?.venue ||
            response?.data ||
            response;


        if (
            created &&
            (
                created.id ||
                created._id
            )
        ) {

            return normalizeCreatedVenue(
                created
            );

        }


        throw new Error(
            "Backend did not return the created venue."
        );

    }


    throw new Error("Create venue API is unavailable.");

}




/* =========================================================
   24. NORMALIZE BACKEND CREATED VENUE
   ========================================================= */

function normalizeCreatedVenue(
    raw
) {

    return {

        ...raw,

        id:
            String(
                raw.id ||
                raw._id
            ),

        name:
            String(
                raw.name ||
                raw.venueName ||
                "Venue"
            )

    };

}


/* =========================================================
   27. SUBMITTING STATE
   ========================================================= */

function setCreateVenueSubmittingState(
    submitting
) {

    const confirmButton =
        document.getElementById(
            "confirmCreateVenueButton"
        );


    const createButton =
        document.getElementById(
            "createVenueButton"
        );


    const configureButton =
        document.getElementById(
            "createVenueConfigureButton"
        );


    const draftButton =
        document.getElementById(
            "saveVenueDraftButton"
        );


    [
        confirmButton,
        createButton,
        configureButton,
        draftButton
    ]
        .filter(Boolean)
        .forEach(
            (button) => {

                button.disabled =
                    submitting;

            }
        );


    if (confirmButton) {

        confirmButton.innerHTML =
            submitting
                ? `

                    <span class="admin-button-spinner"></span>

                    Creating...

                `
                : `

                    <i data-lucide="check"></i>

                    Confirm Creation

                `;

    }


    refreshCreateVenueIcons();

}


/* =========================================================
   28. LIVE PREVIEW INITIALIZATION
   ========================================================= */

function initializeCreateVenuePreview() {

    updateCreateVenuePreview();

    updateCreateVenueDescriptionCounter();

}


/* =========================================================
   29. UPDATE PREVIEW
   ========================================================= */

function updateCreateVenuePreview() {

    const venue =
        collectCreateVenueFormData();


    /*
       NAME
    */

    setCreateVenueText(
        "venuePreviewName",
        venue.name ||
        "New SKYRA Venue"
    );


    /*
       LOCATION
    */

    const location =
        [

            venue.city,
            venue.state

        ]
            .filter(Boolean)
            .join(", ");


    setCreateVenueText(
        "venuePreviewLocation",
        location ||
        "Add the venue location to preview it here."
    );


    /*
       TYPE
    */

    const typeVisual =
        getCreateVenueTypeVisual(
            venue.type
        );


    const typeBadge =
        document.getElementById(
            "venuePreviewType"
        );


    if (typeBadge) {

        typeBadge.textContent =
            typeVisual.label;


        typeBadge.className =
            `admin-venue-type-badge ${
                typeVisual.className
            }`;

    }


    /*
       ICON
    */

    const icon =
        document.getElementById(
            "venuePreviewIcon"
        );


    if (icon) {

        icon.setAttribute(
            "data-lucide",
            typeVisual.icon
        );

    }


    /*
       STATUS
    */

    const status =
        document.getElementById(
            "venuePreviewStatus"
        );


    if (status) {

        const active =
            venue.status !==
            "INACTIVE";


        status.className =
            `admin-venue-record-status ${
                active
                    ? "active"
                    : "inactive"
            }`;


        status.innerHTML = `

            <span></span>

            ${
                active
                    ? "Active"
                    : "Inactive"
            }

        `;

    }


    refreshCreateVenueIcons();

}


/* =========================================================
   30. TYPE VISUAL
   ========================================================= */

function getCreateVenueTypeVisual(
    type
) {

    switch (type) {

        case "STADIUM":

            return {

                label:
                    "Stadium",

                className:
                    "stadium",

                icon:
                    "landmark"

            };


        case "ARENA":

            return {

                label:
                    "Arena",

                className:
                    "arena",

                icon:
                    "circle-dot"

            };


        case "CINEMA":

            return {

                label:
                    "Cinema",

                className:
                    "cinema",

                icon:
                    "clapperboard"

            };


        case "CONVENTION_HALL":

            return {

                label:
                    "Convention Hall",

                className:
                    "hall",

                icon:
                    "building-2"

            };


        case "AUDITORIUM":

            return {

                label:
                    "Auditorium",

                className:
                    "auditorium",

                icon:
                    "presentation"

            };


        default:

            return {

                label:
                    "Venue",

                className:
                    "venue",

                icon:
                    "building-2"

            };

    }

}


/* =========================================================
   31. DESCRIPTION COUNTER
   ========================================================= */

function updateCreateVenueDescriptionCounter() {

    const textarea =
        document.getElementById(
            "venueDescription"
        );


    if (!textarea) {

        return;

    }


    setCreateVenueText(
        "venueDescriptionCount",
        `${
            textarea.value.length
        } / 500`
    );

}


/* =========================================================
   32. SAVE DRAFT
   ========================================================= */

function saveCreateVenueDraft() {

    const venue =
        collectCreateVenueFormData();


    const draft = {

        ...venue,

        savedAt:
            new Date()
                .toISOString()

    };


    try {

        localStorage.setItem(
            SKYRA_CREATE_VENUE_STORAGE
                .CREATE_DRAFT,
            JSON.stringify(
                draft
            )
        );


        adminCreateVenueState.dirty =
            false;


        showCreateVenueToast(
            "Venue draft saved in this browser.",
            "success",
            "Draft Saved"
        );

    } catch (error) {

        console.error(
            "Unable to save venue draft:",
            error
        );


        showCreateVenueToast(
            "Unable to save the venue draft.",
            "error",
            "Draft Failed"
        );

    }

}


/* =========================================================
   33. LOAD DRAFT
   ========================================================= */

function initializeCreateVenueDraft() {

    let draft;


    try {

        const stored =
            localStorage.getItem(
                SKYRA_CREATE_VENUE_STORAGE
                    .CREATE_DRAFT
            );


        if (!stored) {

            return;

        }


        draft =
            JSON.parse(
                stored
            );

    } catch {

        return;

    }


    if (
        !draft ||
        typeof draft !==
        "object"
    ) {

        return;

    }


    setCreateVenueValue(
        "venueName",
        draft.name
    );


    setCreateVenueValue(
        "venueType",
        draft.type
    );


    setCreateVenueValue(
        "venueStatus",
        draft.status ||
        "ACTIVE"
    );


    setCreateVenueValue(
        "venueDescription",
        draft.description
    );


    setCreateVenueValue(
        "venueAddress",
        draft.address
    );


    setCreateVenueValue(
        "venueCity",
        draft.city
    );


    setCreateVenueValue(
        "venueState",
        draft.state
    );


    setCreateVenueValue(
        "venueCountry",
        draft.country ||
        "India"
    );


    setCreateVenueValue(
        "venuePostalCode",
        draft.postalCode
    );


    adminCreateVenueState.draftLoaded =
        true;


    adminCreateVenueState.dirty =
        false;


    updateCreateVenueDescriptionCounter();

    updateCreateVenuePreview();


    showCreateVenueToast(
        "Your previously saved venue draft was restored.",
        "info",
        "Draft Restored"
    );

}


/* =========================================================
   34. REMOVE DRAFT
   ========================================================= */

function removeCreateVenueDraft() {

    try {

        localStorage.removeItem(
            SKYRA_CREATE_VENUE_STORAGE
                .CREATE_DRAFT
        );

    } catch {

        /* No action required */

    }

}


/* =========================================================
   35. SIDEBAR VENUE COUNT
   ========================================================= */

function updateCreateVenueSidebarCount() {

    if (
        !window.SKYRA_API ||
        typeof window.SKYRA_API.getAdminVenues !== "function"
    ) {
        setCreateVenueText("sidebarVenueCount", "—");
        return;
    }

    window.SKYRA_API.getAdminVenues()
        .then((response) => {
            const venues = response?.venues || response?.data?.venues || response?.data || response;
            setCreateVenueText(
                "sidebarVenueCount",
                Array.isArray(venues) ? venues.length : 0
            );
        })
        .catch(() => setCreateVenueText("sidebarVenueCount", "—"));

}


/* =========================================================
   36. TOPBAR SEARCH
   ========================================================= */

function initializeCreateVenueTopSearch() {

    document
        .getElementById(
            "dashboardSearch"
        )
        ?.addEventListener(
            "keydown",
            (event) => {

                if (
                    event.key !==
                    "Enter"
                ) {

                    return;

                }


                event.preventDefault();


                const query =
                    event.target.value
                        .trim();


                if (!query) {

                    return;

                }


                window.location.href =
                    `./venues.html?search=${
                        encodeURIComponent(
                            query
                        )
                    }`;

            }
        );

}


/* =========================================================
   37. NORMALIZE TYPE
   ========================================================= */

function normalizeCreateVenueType(
    value
) {

    const type =
        String(
            value ||
            ""
        )
            .trim()
            .toUpperCase();


    const allowed = [

        "STADIUM",
        "ARENA",
        "CINEMA",
        "CONVENTION_HALL",
        "AUDITORIUM",
        "VENUE"

    ];


    return allowed.includes(
        type
    )
        ? type
        : "";

}


/* =========================================================
   38. NORMALIZE STATUS
   ========================================================= */

function normalizeCreateVenueStatus(
    value
) {

    return String(
        value ||
        "ACTIVE"
    )
        .trim()
        .toUpperCase() ===
        "INACTIVE"
            ? "INACTIVE"
            : "ACTIVE";

}


/* =========================================================
   39. NORMALIZE IDENTITY
   ========================================================= */

function normalizeCreateVenueIdentity(
    value
) {

    return String(
        value ||
        ""
    )
        .trim()
        .toLowerCase()
        .replace(
            /\s+/g,
            " "
        );

}


/* =========================================================
   40. CLEAN TEXT
   ========================================================= */

function cleanCreateVenueText(
    value
) {

    return String(
        value ||
        ""
    )
        .trim()
        .replace(
            /\s+/g,
            " "
        );

}


/* =========================================================
   41. GET VALUE
   ========================================================= */

function getCreateVenueValue(
    id
) {

    const element =
        document.getElementById(
            id
        );


    return element
        ? element.value
        : "";

}


/* =========================================================
   42. SET VALUE
   ========================================================= */

function setCreateVenueValue(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (
        element &&
        value !==
        undefined &&
        value !==
        null
    ) {

        element.value =
            value;

    }

}


/* =========================================================
   43. INITIALS
   ========================================================= */

function createVenueInitials(
    name
) {

    const parts =
        String(
            name ||
            ""
        )
            .trim()
            .split(/\s+/)
            .filter(Boolean);


    if (!parts.length) {

        return "AD";

    }


    if (
        parts.length ===
        1
    ) {

        return parts[0]
            .slice(
                0,
                2
            )
            .toUpperCase();

    }


    return (
        parts[0][0] +
        parts[
            parts.length -
            1
        ][0]
    ).toUpperCase();

}


/* =========================================================
   44. SET TEXT
   ========================================================= */

function setCreateVenueText(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (element) {

        element.textContent =
            value;

    }

}


/* =========================================================
   45. TOAST
   ========================================================= */

function showCreateVenueToast(
    message,
    type = "info",
    title = null
) {

    if (
        window.SKYRA_COMMON
            ?.showToast
    ) {

        window.SKYRA_COMMON
            .showToast(
                message,
                type,
                title
            );


        return;

    }


    console.log(
        `[SKYRA ${type}]`,
        message
    );

}


/* =========================================================
   46. ICONS
   ========================================================= */

function refreshCreateVenueIcons() {

    if (
        typeof lucide !==
        "undefined"
    ) {

        lucide.createIcons();

    }

}


/* =========================================================
   47. PUBLIC PAGE API
   ========================================================= */

window.SKYRA_ADMIN_CREATE_VENUE_PAGE = {

    getFormData: collectCreateVenueFormData,

    validate: () =>
        validateCreateVenue(
            collectCreateVenueFormData()
        ),

    saveDraft: saveCreateVenueDraft

};


/* =========================================================
   END SKYRA ADMIN CREATE VENUE
   ========================================================= */