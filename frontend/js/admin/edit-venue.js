/* =========================================================
   SKYRA - ADMIN EDIT VENUE
   File:
   frontend/js/admin/edit-venue.js

   Responsibilities:
   - Load venue by ?id=
   - Edit venue metadata
   - Preserve capacity
   - Preserve seat categories
   - Preserve physical seat configuration
   - Runtime/localStorage editing during frontend phase
   - Default venue override support
   - Future backend API integration

   Future backend:
   GET   /api/admin/venues/:id
   PATCH /api/admin/venues/:id

   Backend authorization:
   authMiddleware
   authorizeRoles("ADMIN")
   ========================================================= */

"use strict";


/* =========================================================
   3. STATE
   ========================================================= */

const adminEditVenueState = {

    venueId:
        null,

    source:
        null,

    originalVenue:
        null,

    venue:
        null,

    dirty:
        false,

    loading:
        false,

    saving:
        false

};


/* =========================================================
   4. DOM READY
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initializeAdminEditVenuePage();

    }
);


/* =========================================================
   5. INITIALIZE
   ========================================================= */

async function initializeAdminEditVenuePage() {

    initializeEditVenueAdminUser();

    initializeEditVenueNavigation();

    initializeEditVenueFormEvents();

    initializeEditVenueModals();

    initializeEditVenueTopSearch();

    updateEditVenueSidebarCount();


    const params =
        new URLSearchParams(
            window.location.search
        );


    adminEditVenueState.venueId =
        params.get(
            "id"
        );


    if (
        !adminEditVenueState
            .venueId
    ) {

        showEditVenueNotFound(
            "No venue ID was supplied in the page URL."
        );


        return;

    }


    await loadEditVenue(
        adminEditVenueState
            .venueId
    );


    refreshEditVenueIcons();

}


/* =========================================================
   6. ADMIN USER
   ========================================================= */

function initializeEditVenueAdminUser() {

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
        createEditVenueInitials(
            name
        );


    setEditVenueText(
        "sidebarUserName",
        name
    );


    setEditVenueText(
        "sidebarUserInitials",
        initials
    );


    setEditVenueText(
        "topbarUserName",
        name
    );


    setEditVenueText(
        "topbarUserInitials",
        initials
    );


    setEditVenueText(
        "dropdownUserName",
        name
    );


    setEditVenueText(
        "dropdownUserInitials",
        initials
    );


    setEditVenueText(
        "dropdownUserEmail",
        admin.email ||
        ""
    );

}


/* =========================================================
   7. NAVIGATION
   ========================================================= */

function initializeEditVenueNavigation() {

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
   8. LOAD VENUE
   ========================================================= */

async function loadEditVenue(
    venueId
) {

    adminEditVenueState.loading =
        true;


    showEditVenueLoading(
        true
    );


    try {

        let result =
            await fetchEditVenueSource(
                venueId
            );


        if (
            !result ||
            !result.venue
        ) {

            showEditVenueNotFound(
                `Venue "${venueId}" could not be found.`
            );


            return;

        }


        const venue =
            normalizeEditVenue(
                result.venue
            );


        if (
            venue.deleted
        ) {

            showEditVenueNotFound(
                "This venue is no longer available."
            );


            return;

        }


        adminEditVenueState.source =
            result.source;


        adminEditVenueState.venue =
            cloneEditVenue(
                venue
            );


        adminEditVenueState.originalVenue =
            cloneEditVenue(
                venue
            );


        adminEditVenueState.dirty =
            false;


        populateEditVenueForm(
            venue
        );


        renderEditVenueConfiguration(
            venue
        );


        updateEditVenueLinks(
            venue.id
        );


        showEditVenuePage();

    } catch (error) {

        console.error(
            "Unable to load venue:",
            error
        );


        showEditVenueNotFound(
            "Unable to load this venue record."
        );

    } finally {

        adminEditVenueState.loading =
            false;


        showEditVenueLoading(
            false
        );

    }

}


/* =========================================================
   9. FETCH VENUE - MONGODB ONLY
   ========================================================= */
async function fetchEditVenueSource(venueId) {
    if (!window.SKYRA_API || typeof window.SKYRA_API.getAdminVenue !== "function") {
        throw new Error("Admin venue API is unavailable.");
    }
    const response = await window.SKYRA_API.getAdminVenue(venueId);
    const venue = response?.venue || response?.data?.venue || response?.data || response;
    return venue ? { venue, source: "API" } : null;
}

/* =========================================================
   10. NORMALIZE
   ========================================================= */

function normalizeEditVenue(
    raw
) {

    const categories =
        Array.isArray(
            raw.categories
        )
            ? raw.categories
                .map(
                    (
                        category,
                        index
                    ) => ({

                        id:
                            String(
                                category.id ||
                                category._id ||
                                `category_${index}`
                            ),

                        name:
                            String(
                                category.name ||
                                category.categoryName ||
                                `Category ${
                                    index + 1
                                }`
                            ),

                        capacity:
                            Math.max(
                                0,
                                Number(
                                    category.capacity ??
                                    category.seatCount ??
                                    0
                                ) ||
                                0
                            )

                    })
                )
            : [];


    return {

        id:
            String(
                raw.id ||
                raw._id ||
                ""
            ),

        name:
            String(
                raw.name ||
                raw.venueName ||
                ""
            ),

        type:
            normalizeEditVenueType(
                raw.type ||
                raw.venueType
            ),

        address:
            String(
                raw.address ||
                raw.location?.address ||
                ""
            ),

        city:
            String(
                raw.city ||
                raw.location?.city ||
                ""
            ),

        state:
            String(
                raw.state ||
                raw.location?.state ||
                ""
            ),

        country:
            String(
                raw.country ||
                raw.location?.country ||
                "India"
            ),

        postalCode:
            String(
                raw.postalCode ||
                raw.pincode ||
                raw.zipCode ||
                ""
            ),

        status:
            normalizeEditVenueStatus(
                raw.status
            ),

        description:
            String(
                raw.description ||
                ""
            ),

        capacity:
            Math.max(
                0,
                Number(
                    raw.capacity ??
                    raw.totalSeats ??
                    raw.seatCount ??
                    0
                ) ||
                0
            ),

        categories,

        layoutConfigured:
            Boolean(
                raw.layoutConfigured ??
                raw.hasSeatLayout ??
                false
            ),

        createdAt:
            raw.createdAt ||
            null,

        updatedAt:
            raw.updatedAt ||
            null,

        deleted:
            Boolean(
                raw.deleted
            )

    };

}


/* =========================================================
   11. POPULATE FORM
   ========================================================= */

function populateEditVenueForm(
    venue
) {

    setEditVenueValue(
        "venueName",
        venue.name
    );


    setEditVenueValue(
        "venueType",
        venue.type
    );


    setEditVenueValue(
        "venueStatus",
        venue.status
    );


    setEditVenueValue(
        "venueDescription",
        venue.description
    );


    setEditVenueValue(
        "venueAddress",
        venue.address
    );


    setEditVenueValue(
        "venueCity",
        venue.city
    );


    setEditVenueValue(
        "venueState",
        venue.state
    );


    setEditVenueValue(
        "venueCountry",
        venue.country
    );


    setEditVenueValue(
        "venuePostalCode",
        venue.postalCode
    );


    setEditVenueText(
        "editVenueRecordId",
        venue.id
    );


    updateEditVenueDescriptionCounter();

    updateEditVenuePreview();

}


/* =========================================================
   12. FORM EVENTS
   ========================================================= */

function initializeEditVenueFormEvents() {

    const form =
        document.getElementById(
            "editVenueForm"
        );


    if (!form) {

        return;

    }


    form
        .querySelectorAll(
            "input, select, textarea"
        )
        .forEach(
            (field) => {

                field.addEventListener(
                    "input",
                    () => {

                        adminEditVenueState.dirty =
                            true;


                        clearEditVenueFieldError(
                            field.name
                        );


                        updateEditVenuePreview();

                    }
                );


                field.addEventListener(
                    "change",
                    () => {

                        adminEditVenueState.dirty =
                            true;


                        clearEditVenueFieldError(
                            field.name
                        );


                        updateEditVenuePreview();

                    }
                );

            }
        );


    document
        .getElementById(
            "venueDescription"
        )
        ?.addEventListener(
            "input",
            updateEditVenueDescriptionCounter
        );


    form.addEventListener(
        "submit",
        handleEditVenueSubmit
    );


    document
        .getElementById(
            "resetVenueChangesButton"
        )
        ?.addEventListener(
            "click",
            openResetVenueModal
        );


    window.addEventListener(
        "beforeunload",
        (event) => {

            if (
                !adminEditVenueState.dirty ||
                adminEditVenueState.saving
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
   13. COLLECT DATA
   ========================================================= */

function collectEditVenueFormData() {

    return {

        name:
            cleanEditVenueText(
                getEditVenueValue(
                    "venueName"
                )
            ),

        type:
            normalizeEditVenueType(
                getEditVenueValue(
                    "venueType"
                )
            ),

        status:
            normalizeEditVenueStatus(
                getEditVenueValue(
                    "venueStatus"
                )
            ),

        description:
            cleanEditVenueText(
                getEditVenueValue(
                    "venueDescription"
                )
            ),

        address:
            cleanEditVenueText(
                getEditVenueValue(
                    "venueAddress"
                )
            ),

        city:
            cleanEditVenueText(
                getEditVenueValue(
                    "venueCity"
                )
            ),

        state:
            cleanEditVenueText(
                getEditVenueValue(
                    "venueState"
                )
            ),

        country:
            cleanEditVenueText(
                getEditVenueValue(
                    "venueCountry"
                )
            ),

        postalCode:
            cleanEditVenueText(
                getEditVenueValue(
                    "venuePostalCode"
                )
            )

    };

}


/* =========================================================
   14. SUBMIT
   ========================================================= */

function handleEditVenueSubmit(
    event
) {

    event.preventDefault();


    if (
        adminEditVenueState.saving
    ) {

        return;

    }


    const venue =
        collectEditVenueFormData();


    if (
        !validateEditVenue(
            venue
        )
    ) {

        showEditVenueToast(
            "Please correct the highlighted venue information.",
            "error",
            "Check Venue Details"
        );


        focusFirstEditVenueError();

        return;

    }


    if (
        isDuplicateEditedVenue(
            venue
        )
    ) {

        setEditVenueFieldError(
            "name",
            "Another venue with this name already exists in the same city."
        );


        document
            .getElementById(
                "venueName"
            )
            ?.focus();


        return;

    }


    adminEditVenueState.venue = {

        ...adminEditVenueState
            .venue,

        ...venue

    };


    openUpdateVenueModal();

}


/* =========================================================
   15. VALIDATE
   ========================================================= */

function validateEditVenue(
    venue
) {

    clearAllEditVenueErrors();


    let valid =
        true;


    if (!venue.name) {

        setEditVenueFieldError(
            "name",
            "Venue name is required."
        );


        valid =
            false;

    } else if (
        venue.name.length <
        3
    ) {

        setEditVenueFieldError(
            "name",
            "Venue name must contain at least 3 characters."
        );


        valid =
            false;

    }


    if (!venue.type) {

        setEditVenueFieldError(
            "type",
            "Please select a venue type."
        );


        valid =
            false;

    }


    if (!venue.address) {

        setEditVenueFieldError(
            "address",
            "Venue address is required."
        );


        valid =
            false;

    }


    if (!venue.city) {

        setEditVenueFieldError(
            "city",
            "City is required."
        );


        valid =
            false;

    }


    if (!venue.state) {

        setEditVenueFieldError(
            "state",
            "State or region is required."
        );


        valid =
            false;

    }


    if (!venue.country) {

        setEditVenueFieldError(
            "country",
            "Country is required."
        );


        valid =
            false;

    }


    if (!venue.postalCode) {

        setEditVenueFieldError(
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

        setEditVenueFieldError(
            "postalCode",
            "Enter a valid 6-digit Indian PIN code."
        );


        valid =
            false;

    }


    return valid;

}


/* =========================================================
   16. ERROR CONFIG
   ========================================================= */

function getEditVenueErrorConfig(
    field
) {

    const config = {

        name: {
            input:
                "venueName",
            error:
                "venueNameError"
        },

        type: {
            input:
                "venueType",
            error:
                "venueTypeError"
        },

        address: {
            input:
                "venueAddress",
            error:
                "venueAddressError"
        },

        city: {
            input:
                "venueCity",
            error:
                "venueCityError"
        },

        state: {
            input:
                "venueState",
            error:
                "venueStateError"
        },

        country: {
            input:
                "venueCountry",
            error:
                "venueCountryError"
        },

        postalCode: {
            input:
                "venuePostalCode",
            error:
                "venuePostalCodeError"
        }

    };


    return config[
        field
    ] ||
    null;

}


/* =========================================================
   17. SET ERROR
   ========================================================= */

function setEditVenueFieldError(
    field,
    message
) {

    const config =
        getEditVenueErrorConfig(
            field
        );


    if (!config) {

        return;

    }


    const input =
        document.getElementById(
            config.input
        );


    const error =
        document.getElementById(
            config.error
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
   18. CLEAR ERROR
   ========================================================= */

function clearEditVenueFieldError(
    field
) {

    const config =
        getEditVenueErrorConfig(
            field
        );


    if (!config) {

        return;

    }


    const input =
        document.getElementById(
            config.input
        );


    const error =
        document.getElementById(
            config.error
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
   19. CLEAR ALL ERRORS
   ========================================================= */

function clearAllEditVenueErrors() {

    [

        "name",
        "type",
        "address",
        "city",
        "state",
        "country",
        "postalCode"

    ].forEach(
        clearEditVenueFieldError
    );

}


/* =========================================================
   20. FIRST ERROR
   ========================================================= */

function focusFirstEditVenueError() {

    const invalid =
        document.querySelector(
            "#editVenueForm .is-invalid"
        );


    if (!invalid) {

        return;

    }


    const field =
        invalid.matches(
            "input, select"
        )
            ? invalid
            : invalid.querySelector(
                "input, select"
            );


    field?.focus();

}


/* =========================================================
   21. DUPLICATE CHECK
   ========================================================= */

function isDuplicateEditedVenue() {

    /* Backend/MongoDB performs the authoritative duplicate check. */
    return false;

}


/* =========================================================
   23. UPDATE MODAL
   ========================================================= */

function initializeEditVenueModals() {

    document
        .getElementById(
            "closeUpdateVenueModal"
        )
        ?.addEventListener(
            "click",
            closeUpdateVenueModal
        );


    document
        .getElementById(
            "cancelUpdateVenueButton"
        )
        ?.addEventListener(
            "click",
            closeUpdateVenueModal
        );


    document
        .getElementById(
            "confirmUpdateVenueButton"
        )
        ?.addEventListener(
            "click",
            confirmUpdateVenue
        );


    document
        .getElementById(
            "closeResetVenueModal"
        )
        ?.addEventListener(
            "click",
            closeResetVenueModal
        );


    document
        .getElementById(
            "cancelResetVenueButton"
        )
        ?.addEventListener(
            "click",
            closeResetVenueModal
        );


    document
        .getElementById(
            "confirmResetVenueButton"
        )
        ?.addEventListener(
            "click",
            resetEditVenueForm
        );


    [
        "updateVenueModal",
        "resetVenueModal"
    ]
        .forEach(
            (id) => {

                const modal =
                    document.getElementById(
                        id
                    );


                modal?.addEventListener(
                    "click",
                    (event) => {

                        if (
                            event.target !==
                            modal
                        ) {

                            return;

                        }


                        if (
                            id ===
                            "updateVenueModal"
                        ) {

                            closeUpdateVenueModal();

                        } else {

                            closeResetVenueModal();

                        }

                    }
                );

            }
        );

}


/* =========================================================
   24. OPEN UPDATE
   ========================================================= */

function openUpdateVenueModal() {

    const modal =
        document.getElementById(
            "updateVenueModal"
        );


    if (!modal) {

        return;

    }


    const venue =
        adminEditVenueState
            .venue;


    const description =
        document.getElementById(
            "updateVenueModalDescription"
        );


    if (
        description &&
        venue
    ) {

        description.textContent =
            `${venue.name} will be updated. Existing seat categories and physical seats will remain unchanged.`;

    }


    modal.hidden =
        false;


    document.body.classList.add(
        "modal-open"
    );

}


/* =========================================================
   25. CLOSE UPDATE
   ========================================================= */

function closeUpdateVenueModal() {

    const modal =
        document.getElementById(
            "updateVenueModal"
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
   26. CONFIRM UPDATE
   ========================================================= */

async function confirmUpdateVenue() {

    if (
        adminEditVenueState.saving ||
        !adminEditVenueState.venue
    ) {

        return;

    }


    adminEditVenueState.saving =
        true;


    setEditVenueSaving(
        true
    );


    try {

        const metadata =
            collectEditVenueFormData();


        const updated =
            await saveEditedVenue(
                metadata
            );


        if (!updated) {

            throw new Error(
                "Venue update failed."
            );

        }


        const normalized =
            normalizeEditVenue(
                updated
            );


        adminEditVenueState.venue =
            cloneEditVenue(
                normalized
            );


        adminEditVenueState.originalVenue =
            cloneEditVenue(
                normalized
            );


        adminEditVenueState.dirty =
            false;


        closeUpdateVenueModal();


        populateEditVenueForm(
            normalized
        );


        renderEditVenueConfiguration(
            normalized
        );


        showEditVenueToast(
            `${normalized.name} was updated successfully.`,
            "success",
            "Venue Updated"
        );

    } catch (error) {

        console.error(
            "Unable to update venue:",
            error
        );


        showEditVenueToast(
            error?.message ||
            "Unable to update the venue.",
            "error",
            "Update Failed"
        );

    } finally {

        adminEditVenueState.saving =
            false;


        setEditVenueSaving(
            false
        );

    }

}


/* =========================================================
   27. SAVE EDITED VENUE
   ========================================================= */

async function saveEditedVenue(
    metadata
) {

    const venueId =
        adminEditVenueState
            .venueId;


    /*
       Only metadata is sent from this form.
       Capacity/categories/layout are not editable here.
    */

    const payload = {

        name:
            metadata.name,

        type:
            metadata.type,

        address:
            metadata.address,

        city:
            metadata.city,

        state:
            metadata.state,

        country:
            metadata.country,

        postalCode:
            metadata.postalCode,

        status:
            metadata.status,

        description:
            metadata.description

    };


    /*
       FUTURE BACKEND

       PATCH /api/admin/venues/:id
    */

    if (
        window.SKYRA_API &&
        typeof window.SKYRA_API
            .updateAdminVenue ===
            "function"
    ) {

        const response =
            await window.SKYRA_API
                .updateAdminVenue(
                    venueId,
                    payload
                );


        const venue =
            response?.venue ||
            response?.data?.venue ||
            response?.data ||
            response;


        if (!venue) {

            throw new Error(
                "Backend did not return the updated venue."
            );

        }


        return venue;

    }

    throw new Error("Update venue API is unavailable.");

}




/* =========================================================
   30. RESET MODAL
   ========================================================= */

function openResetVenueModal() {

    if (
        !adminEditVenueState.dirty
    ) {

        showEditVenueToast(
            "There are no unsaved changes to reset.",
            "info",
            "Nothing to Reset"
        );


        return;

    }


    const modal =
        document.getElementById(
            "resetVenueModal"
        );


    if (modal) {

        modal.hidden =
            false;


        document.body.classList.add(
            "modal-open"
        );

    }

}


/* =========================================================
   31. CLOSE RESET
   ========================================================= */

function closeResetVenueModal() {

    const modal =
        document.getElementById(
            "resetVenueModal"
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
   32. RESET FORM
   ========================================================= */

function resetEditVenueForm() {

    const original =
        adminEditVenueState
            .originalVenue;


    if (!original) {

        return;

    }


    adminEditVenueState.venue =
        cloneEditVenue(
            original
        );


    adminEditVenueState.dirty =
        false;


    clearAllEditVenueErrors();


    populateEditVenueForm(
        original
    );


    closeResetVenueModal();


    showEditVenueToast(
        "Unsaved venue changes were reset.",
        "info",
        "Changes Reset"
    );

}


/* =========================================================
   33. LIVE PREVIEW
   ========================================================= */

function updateEditVenuePreview() {

    const metadata =
        collectEditVenueFormData();


    const original =
        adminEditVenueState
            .originalVenue ||
        {
            capacity:
                0,
            categories:
                [],
            layoutConfigured:
                false
        };


    setEditVenueText(
        "venuePreviewName",
        metadata.name ||
        "Venue"
    );


    const location =
        [

            metadata.city,
            metadata.state

        ]
            .filter(Boolean)
            .join(", ");


    setEditVenueText(
        "venuePreviewLocation",
        location ||
        "Location unavailable"
    );


    const visual =
        getEditVenueTypeVisual(
            metadata.type
        );


    const badge =
        document.getElementById(
            "venuePreviewType"
        );


    if (badge) {

        badge.textContent =
            visual.label;


        badge.className =
            `admin-venue-type-badge ${
                visual.className
            }`;

    }


    const icon =
        document.getElementById(
            "venuePreviewIcon"
        );


    if (icon) {

        icon.setAttribute(
            "data-lucide",
            visual.icon
        );

    }


    const status =
        document.getElementById(
            "venuePreviewStatus"
        );


    if (status) {

        const active =
            metadata.status !==
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


    setEditVenueText(
        "venuePreviewCapacity",
        formatEditVenueNumber(
            original.capacity
        )
    );


    setEditVenueText(
        "venuePreviewCategoryCount",
        original.categories
            ?.length ||
        0
    );


    renderEditVenueLayoutPreview(
        original.layoutConfigured
    );


    refreshEditVenueIcons();

}


/* =========================================================
   34. CONFIGURATION
   ========================================================= */

function renderEditVenueConfiguration(
    venue
) {

    setEditVenueText(
        "editVenueSeatCount",
        formatEditVenueNumber(
            venue.capacity
        )
    );


    setEditVenueText(
        "editVenueCategoryCount",
        venue.categories.length
    );


    setEditVenueText(
        "editVenueLayoutDescription",
        venue.layoutConfigured
            ? "Physical seat layout is configured."
            : "Physical seat layout is still pending."
    );


    setEditVenueText(
        "venuePreviewCapacity",
        formatEditVenueNumber(
            venue.capacity
        )
    );


    setEditVenueText(
        "venuePreviewCategoryCount",
        venue.categories.length
    );


    renderEditVenueLayoutPreview(
        venue.layoutConfigured
    );

}


/* =========================================================
   35. LAYOUT PREVIEW
   ========================================================= */

function renderEditVenueLayoutPreview(
    configured
) {

    const element =
        document.getElementById(
            "venuePreviewLayoutStatus"
        );


    if (!element) {

        return;

    }


    element.className =
        `admin-venue-layout-status ${
            configured
                ? "configured"
                : "pending"
        }`;


    element.innerHTML = `

        <i
            data-lucide="${
                configured
                    ? "circle-check-big"
                    : "clock-3"
            }"
        ></i>

        ${
            configured
                ? "Layout Configured"
                : "Layout Pending"
        }

    `;

}


/* =========================================================
   36. UPDATE LINKS
   ========================================================= */

function updateEditVenueLinks(
    venueId
) {

    const encoded =
        encodeURIComponent(
            venueId
        );


    const categoryLink =
        document.getElementById(
            "editVenueCategoriesLink"
        );


    if (categoryLink) {

        categoryLink.href =
            `./seat-categories.html?venue=${encoded}`;

    }


    const layoutLink =
        document.getElementById(
            "editVenueLayoutLink"
        );


    if (layoutLink) {

        layoutLink.href =
            `./seat-layout.html?venue=${encoded}`;

    }

}


/* =========================================================
   37. SAVING STATE
   ========================================================= */

function setEditVenueSaving(
    saving
) {

    const updateButton =
        document.getElementById(
            "updateVenueButton"
        );


    const resetButton =
        document.getElementById(
            "resetVenueChangesButton"
        );


    const confirmButton =
        document.getElementById(
            "confirmUpdateVenueButton"
        );


    [
        updateButton,
        resetButton,
        confirmButton
    ]
        .filter(Boolean)
        .forEach(
            (button) => {

                button.disabled =
                    saving;

            }
        );


    if (confirmButton) {

        confirmButton.innerHTML =
            saving
                ? `

                    <span class="admin-button-spinner"></span>

                    Updating...

                `
                : `

                    <i data-lucide="save"></i>

                    Confirm Update

                `;

    }


    refreshEditVenueIcons();

}


/* =========================================================
   38. DESCRIPTION COUNTER
   ========================================================= */

function updateEditVenueDescriptionCounter() {

    const textarea =
        document.getElementById(
            "venueDescription"
        );


    if (!textarea) {

        return;

    }


    setEditVenueText(
        "venueDescriptionCount",
        `${textarea.value.length} / 500`
    );

}


/* =========================================================
   39. SHOW PAGE
   ========================================================= */

function showEditVenuePage() {

    const loading =
        document.getElementById(
            "editVenueLoading"
        );


    const notFound =
        document.getElementById(
            "editVenueNotFound"
        );


    const page =
        document.getElementById(
            "editVenuePageArea"
        );


    if (loading) {

        loading.hidden =
            true;

    }


    if (notFound) {

        notFound.hidden =
            true;

    }


    if (page) {

        page.hidden =
            false;

    }

}


/* =========================================================
   40. LOADING
   ========================================================= */

function showEditVenueLoading(
    show
) {

    const element =
        document.getElementById(
            "editVenueLoading"
        );


    if (element) {

        element.hidden =
            !show;

    }

}


/* =========================================================
   41. NOT FOUND
   ========================================================= */

function showEditVenueNotFound(
    message
) {

    showEditVenueLoading(
        false
    );


    const page =
        document.getElementById(
            "editVenuePageArea"
        );


    const notFound =
        document.getElementById(
            "editVenueNotFound"
        );


    if (page) {

        page.hidden =
            true;

    }


    if (notFound) {

        notFound.hidden =
            false;

    }


    setEditVenueText(
        "editVenueNotFoundText",
        message
    );


    refreshEditVenueIcons();

}


/* =========================================================
   44. SIDEBAR COUNT
   ========================================================= */

function updateEditVenueSidebarCount() {

    if (
        !window.SKYRA_API ||
        typeof window.SKYRA_API.getAdminVenues !== "function"
    ) {
        setEditVenueText("sidebarVenueCount", "—");
        return;
    }

    window.SKYRA_API.getAdminVenues()
        .then((response) => {
            const venues = response?.venues || response?.data?.venues || response?.data || response;
            setEditVenueText(
                "sidebarVenueCount",
                Array.isArray(venues) ? venues.length : 0
            );
        })
        .catch(() => setEditVenueText("sidebarVenueCount", "—"));

}


/* =========================================================
   45. TOP SEARCH
   ========================================================= */

function initializeEditVenueTopSearch() {

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
   46. TYPE NORMALIZATION
   ========================================================= */

function normalizeEditVenueType(
    value
) {

    const type =
        String(
            value ||
            ""
        )
            .trim()
            .toUpperCase()
            .replace(
                /\s+/g,
                "_"
            );


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
   47. STATUS NORMALIZATION
   ========================================================= */

function normalizeEditVenueStatus(
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
   48. TYPE VISUAL
   ========================================================= */

function getEditVenueTypeVisual(
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
   49. IDENTITY
   ========================================================= */

function normalizeEditVenueIdentity(
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
   50. CLEAN TEXT
   ========================================================= */

function cleanEditVenueText(
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
   51. GET VALUE
   ========================================================= */

function getEditVenueValue(
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
   52. SET VALUE
   ========================================================= */

function setEditVenueValue(
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
   53. NUMBER
   ========================================================= */

function formatEditVenueNumber(
    value
) {

    const number =
        Number(
            value
        );


    return Number.isFinite(
        number
    )
        ? new Intl.NumberFormat(
            "en-IN"
        ).format(
            number
        )
        : "0";

}


/* =========================================================
   54. INITIALS
   ========================================================= */

function createEditVenueInitials(
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
   55. CLONE
   ========================================================= */

function cloneEditVenue(
    value
) {

    try {

        return structuredClone(
            value
        );

    } catch {

        return JSON.parse(
            JSON.stringify(
                value
            )
        );

    }

}


/* =========================================================
   56. TEXT
   ========================================================= */

function setEditVenueText(
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
   57. TOAST
   ========================================================= */

function showEditVenueToast(
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
   58. ICONS
   ========================================================= */

function refreshEditVenueIcons() {

    if (
        typeof lucide !==
        "undefined"
    ) {

        lucide.createIcons();

    }

}


/* =========================================================
   59. PUBLIC API
   ========================================================= */

window.SKYRA_ADMIN_EDIT_VENUE_PAGE = {

    getVenue:
        () =>
            adminEditVenueState.venue
                ? cloneEditVenue(
                    adminEditVenueState
                        .venue
                )
                : null,

    getOriginalVenue:
        () =>
            adminEditVenueState
                .originalVenue
                ? cloneEditVenue(
                    adminEditVenueState
                        .originalVenue
                )
                : null,

    getFormData:
        collectEditVenueFormData,

    reset:
        resetEditVenueForm,

    reload:
        () =>
            loadEditVenue(
                adminEditVenueState
                    .venueId
            )

};


/* =========================================================
   END SKYRA ADMIN EDIT VENUE
   ========================================================= */