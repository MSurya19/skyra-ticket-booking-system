    /* =========================================================
   SKYRA - ORGANISER CREATE EVENT
   File:
   frontend/js/organiser/create-event.js

   Phase 7 backend-connected frontend:
   - Event form validation
   - Live customer preview
   - Character counters
   - Poster / banner image preview
   - Event completion checklist
   - Real backend Event creation
   - Real backend DRAFT creation/update
   - Organiser identity derived from JWT
   - Unsaved-change protection

   API:
   - POST  /api/organiser/events
   - PATCH /api/organiser/events/:eventId
   - DELETE /api/organiser/events/:eventId

   Note:
   - LocalStorage is used only as a small draft-form cache.
   - It is no longer the source of truth for Event records.
   ========================================================= */

"use strict";


/* =========================================================
   1. STORAGE KEYS
   Only unsaved form draft state is stored locally.
   ========================================================= */

const SKYRA_CREATE_EVENT_STORAGE = {
    DRAFT: "skyra_organiser_event_draft"
};


/* =========================================================
   2. STATE
   ========================================================= */

const organiserCreateEventState = {

    dirty:
        false,

    saving:
        false,

    posterFile:
        null,

    bannerFile:
        null,

    posterPreviewUrl:
        null,

    bannerPreviewUrl:
        null,

    createdEvent:
        null

};


/* =========================================================
   3. DOM READY
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initializeCreateEventPage();

    }
);


/* =========================================================
   4. INITIALIZE
   ========================================================= */

function initializeCreateEventPage() {

    initializeCreateEventUser();

    refreshCreateEventSidebarCounts();

    initializeCreateEventNavigation();

    initializeCreateEventSearch();

    initializeCreateEventForm();

    initializeCreateEventCharacterCounters();

    initializeCreateEventLivePreview();

    initializeCreateEventUploads();

    initializeCreateEventDraft();

    initializeCreateEventModals();

    initializeCreateEventBeforeUnload();

    updateCreateEventChecklist();

    updateCreateEventPreview();

    refreshCreateEventIcons();

}


/* =========================================================
   5. USER
   ========================================================= */

function initializeCreateEventUser() {

    const sharedUser = window.SKYRA_COMMON?.getUser?.();
    const organiser =
        sharedUser && String(sharedUser.role || "").toUpperCase() === "ORGANISER"
            ? sharedUser
            : { name: "Organiser", email: "", role: "ORGANISER" };

    const name = String(organiser.name || organiser.fullName || "Organiser");
    const initials = createEventInitials(name);

    setCreateEventText("sidebarUserName", name);
    setCreateEventText("sidebarUserInitials", initials);
    setCreateEventText("topbarUserName", name);
    setCreateEventText("topbarUserInitials", initials);
    setCreateEventText("dropdownUserName", name);
    setCreateEventText("dropdownUserInitials", initials);
    setCreateEventText("dropdownUserEmail", organiser.email || "");

}


/* =========================================================
   PHASE 7 - REAL SIDEBAR COUNTS
   ========================================================= */

async function refreshCreateEventSidebarCounts() {

    if (
        !window.SKYRA_API ||
        typeof window.SKYRA_API
            .getOrganiserEvents !==
            "function"
    ) {

        return;

    }


    try {

        const response =
            await window.SKYRA_API
                .getOrganiserEvents({
                    limit:
                        100
                });


        const events =
            response?.data?.events ||
            response?.events ||
            [];


        if (
            !Array.isArray(
                events
            )
        ) {

            return;

        }


        const showCount =
            events.reduce(
                (
                    total,
                    event
                ) =>
                    total +
                    Math.max(
                        0,
                        Number(
                            event?.showCount ||
                            0
                        ) ||
                        0
                    ),
                0
            );


        setCreateEventText(
            "sidebarEventCount",
            events.length
        );


        setCreateEventText(
            "sidebarShowCount",
            showCount
        );

    } catch (error) {

        console.warn(
            "Unable to refresh Event sidebar counts.",
            error
        );

    }

}


/* =========================================================
   6. NAVIGATION ACTIVE STATE
   ========================================================= */

function initializeCreateEventNavigation() {

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
                    "./create-event.html";


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
   7. SEARCH
   ========================================================= */

function initializeCreateEventSearch() {

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
                    `./manage-events.html?search=${
                        encodeURIComponent(
                            query
                        )
                    }`;

            }
        );

}


/* =========================================================
   8. FORM INITIALIZATION
   ========================================================= */

function initializeCreateEventForm() {

    const form =
        document.getElementById(
            "createEventForm"
        );


    if (!form) {

        return;

    }


    form.addEventListener(
        "submit",
        handleCreateEventSubmit
    );


    form
        .querySelectorAll(
            "input, select, textarea"
        )
        .forEach(
            (field) => {

                field.addEventListener(
                    "input",
                    () => {

                        markCreateEventDirty();

                        clearCreateEventFieldError(
                            field.id
                        );

                        updateCreateEventPreview();

                        updateCreateEventChecklist();

                        updateCreateEventCharacterCounters();

                    }
                );


                field.addEventListener(
                    "change",
                    () => {

                        markCreateEventDirty();

                        clearCreateEventFieldError(
                            field.id
                        );

                        updateCreateEventPreview();

                        updateCreateEventChecklist();

                    }
                );

            }
        );

}


/* =========================================================
   9. DIRTY STATE
   ========================================================= */

function markCreateEventDirty() {

    organiserCreateEventState.dirty =
        true;

}


/* =========================================================
   10. CHARACTER COUNTERS
   ========================================================= */

function initializeCreateEventCharacterCounters() {

    updateCreateEventCharacterCounters();


    document
        .getElementById(
            "eventTitle"
        )
        ?.addEventListener(
            "input",
            updateCreateEventCharacterCounters
        );


    document
        .getElementById(
            "eventDescription"
        )
        ?.addEventListener(
            "input",
            updateCreateEventCharacterCounters
        );

}


/* =========================================================
   11. UPDATE COUNTERS
   ========================================================= */

function updateCreateEventCharacterCounters() {

    const title =
        document
            .getElementById(
                "eventTitle"
            )
            ?.value ||
        "";


    const description =
        document
            .getElementById(
                "eventDescription"
            )
            ?.value ||
        "";


    setCreateEventText(
        "eventTitleCount",
        `${title.length} / 120`
    );


    setCreateEventText(
        "eventDescriptionCount",
        `${description.length} / 1500`
    );

}


/* =========================================================
   12. LIVE PREVIEW INITIALIZATION
   ========================================================= */

function initializeCreateEventLivePreview() {

    [
        "eventTitle",
        "eventType",
        "eventGenre",
        "eventLanguage",
        "eventDuration",
        "eventDescription"
    ]
        .forEach(
            (id) => {

                const element =
                    document.getElementById(
                        id
                    );


                element?.addEventListener(
                    "input",
                    updateCreateEventPreview
                );


                element?.addEventListener(
                    "change",
                    updateCreateEventPreview
                );

            }
        );

}


/* =========================================================
   13. UPDATE LIVE PREVIEW
   ========================================================= */

function updateCreateEventPreview() {

    const data =
        getCreateEventFormData();


    setCreateEventText(
        "eventLiveTitle",
        data.title ||
        "Your event title"
    );


    setCreateEventText(
        "eventLiveGenre",
        data.genre ||
        "Genre / Category"
    );


    setCreateEventText(
        "eventLiveDescription",
        data.description ||
        "Event description will appear here while you complete the form."
    );


    setCreateEventText(
        "eventLiveType",
        formatCreateEventType(
            data.type
        )
    );


    setCreateEventText(
        "eventLiveLanguage",
        data.language ||
        "Language"
    );


    setCreateEventText(
        "eventLiveDuration",
        data.duration
            ? `${data.duration} min`
            : "Duration"
    );

}


/* =========================================================
   14. IMAGE UPLOAD INITIALIZATION
   ========================================================= */

function initializeCreateEventUploads() {

    /*
       POSTER
    */

    document
        .getElementById(
            "selectEventPosterButton"
        )
        ?.addEventListener(
            "click",
            () => {

                document
                    .getElementById(
                        "eventPoster"
                    )
                    ?.click();

            }
        );


    document
        .getElementById(
            "eventPosterUploadBox"
        )
        ?.addEventListener(
            "click",
            (event) => {

                if (
                    event.target.closest(
                        "#removeEventPoster"
                    )
                ) {

                    return;

                }


                if (
                    event.target.closest(
                        "#selectEventPosterButton"
                    )
                ) {

                    return;

                }

            }
        );


    document
        .getElementById(
            "eventPoster"
        )
        ?.addEventListener(
            "change",
            handleEventPosterSelection
        );


    document
        .getElementById(
            "removeEventPoster"
        )
        ?.addEventListener(
            "click",
            removeEventPoster
        );


    /*
       BANNER
    */

    document
        .getElementById(
            "selectEventBannerButton"
        )
        ?.addEventListener(
            "click",
            () => {

                document
                    .getElementById(
                        "eventBanner"
                    )
                    ?.click();

            }
        );


    document
        .getElementById(
            "eventBanner"
        )
        ?.addEventListener(
            "change",
            handleEventBannerSelection
        );


    document
        .getElementById(
            "removeEventBanner"
        )
        ?.addEventListener(
            "click",
            removeEventBanner
        );

}


/* =========================================================
   15. POSTER SELECTION
   ========================================================= */

function handleEventPosterSelection(
    event
) {

    const file =
        event.target.files?.[0];


    if (!file) {

        return;

    }


    if (
        !validateCreateEventImage(
            file
        )
    ) {

        event.target.value =
            "";

        return;

    }


    revokeCreateEventObjectURL(
        organiserCreateEventState
            .posterPreviewUrl
    );


    organiserCreateEventState.posterFile =
        file;


    organiserCreateEventState.posterPreviewUrl =
        URL.createObjectURL(
            file
        );


    const image =
        document.getElementById(
            "eventPosterPreviewImage"
        );


    if (image) {

        image.src =
            organiserCreateEventState
                .posterPreviewUrl;

    }


    const preview =
        document.getElementById(
            "eventPosterPreview"
        );


    const placeholder =
        document.getElementById(
            "selectEventPosterButton"
        );


    if (preview) {

        preview.hidden =
            false;

    }


    if (placeholder) {

        placeholder.hidden =
            true;

    }


    updateLivePosterImage(
        organiserCreateEventState
            .posterPreviewUrl
    );


    markCreateEventDirty();

    updateCreateEventChecklist();

    refreshCreateEventIcons();

}


/* =========================================================
   16. BANNER SELECTION
   ========================================================= */

function handleEventBannerSelection(
    event
) {

    const file =
        event.target.files?.[0];


    if (!file) {

        return;

    }


    if (
        !validateCreateEventImage(
            file
        )
    ) {

        event.target.value =
            "";

        return;

    }


    revokeCreateEventObjectURL(
        organiserCreateEventState
            .bannerPreviewUrl
    );


    organiserCreateEventState.bannerFile =
        file;


    organiserCreateEventState.bannerPreviewUrl =
        URL.createObjectURL(
            file
        );


    const image =
        document.getElementById(
            "eventBannerPreviewImage"
        );


    if (image) {

        image.src =
            organiserCreateEventState
                .bannerPreviewUrl;

    }


    const preview =
        document.getElementById(
            "eventBannerPreview"
        );


    const placeholder =
        document.getElementById(
            "selectEventBannerButton"
        );


    if (preview) {

        preview.hidden =
            false;

    }


    if (placeholder) {

        placeholder.hidden =
            true;

    }


    markCreateEventDirty();

    refreshCreateEventIcons();

}


/* =========================================================
   17. VALIDATE IMAGE
   ========================================================= */

function validateCreateEventImage(
    file
) {

    const allowedTypes = [

        "image/jpeg",
        "image/png",
        "image/webp"

    ];


    if (
        !allowedTypes.includes(
            file.type
        )
    ) {

        showCreateEventToast(
            "Please select a PNG, JPG or WEBP image.",
            "error",
            "Unsupported Image"
        );


        return false;

    }


    const maximumSize =
        5 *
        1024 *
        1024;


    if (
        file.size >
        maximumSize
    ) {

        showCreateEventToast(
            "Image size must be below 5 MB.",
            "error",
            "Image Too Large"
        );


        return false;

    }


    return true;

}


/* =========================================================
   18. REMOVE POSTER
   ========================================================= */

function removeEventPoster(
    event
) {

    event?.stopPropagation();


    revokeCreateEventObjectURL(
        organiserCreateEventState
            .posterPreviewUrl
    );


    organiserCreateEventState.posterFile =
        null;


    organiserCreateEventState.posterPreviewUrl =
        null;


    const input =
        document.getElementById(
            "eventPoster"
        );


    if (input) {

        input.value =
            "";

    }


    const preview =
        document.getElementById(
            "eventPosterPreview"
        );


    const placeholder =
        document.getElementById(
            "selectEventPosterButton"
        );


    if (preview) {

        preview.hidden =
            true;

    }


    if (placeholder) {

        placeholder.hidden =
            false;

    }


    resetLivePosterImage();

    markCreateEventDirty();

    updateCreateEventChecklist();

    refreshCreateEventIcons();

}


/* =========================================================
   19. REMOVE BANNER
   ========================================================= */

function removeEventBanner(
    event
) {

    event?.stopPropagation();


    revokeCreateEventObjectURL(
        organiserCreateEventState
            .bannerPreviewUrl
    );


    organiserCreateEventState.bannerFile =
        null;


    organiserCreateEventState.bannerPreviewUrl =
        null;


    const input =
        document.getElementById(
            "eventBanner"
        );


    if (input) {

        input.value =
            "";

    }


    const preview =
        document.getElementById(
            "eventBannerPreview"
        );


    const placeholder =
        document.getElementById(
            "selectEventBannerButton"
        );


    if (preview) {

        preview.hidden =
            true;

    }


    if (placeholder) {

        placeholder.hidden =
            false;

    }


    markCreateEventDirty();

    refreshCreateEventIcons();

}


/* =========================================================
   20. LIVE POSTER IMAGE
   ========================================================= */

function updateLivePosterImage(
    url
) {

    const poster =
        document.getElementById(
            "eventLivePoster"
        );


    if (!poster) {

        return;

    }


    poster.classList.add(
        "has-image"
    );


    poster.style.backgroundImage =
        `linear-gradient(
            180deg,
            rgba(2, 6, 23, 0.02),
            rgba(2, 6, 23, 0.56)
        ),
        url("${url}")`;


    poster.innerHTML =
        "";

}


/* =========================================================
   21. RESET LIVE POSTER
   ========================================================= */

function resetLivePosterImage() {

    const poster =
        document.getElementById(
            "eventLivePoster"
        );


    if (!poster) {

        return;

    }


    poster.classList.remove(
        "has-image"
    );


    poster.style.backgroundImage =
        "";


    poster.innerHTML = `

        <div>

            <i data-lucide="image"></i>

            <span>
                Event Poster
            </span>

        </div>

    `;


    refreshCreateEventIcons();

}


/* =========================================================
   22. CHECKLIST
   ========================================================= */

function updateCreateEventChecklist() {

    const data =
        getCreateEventFormData();


    const requirements = [

        {
            id:
                "checkEventTitle",

            complete:
                data.title.length >=
                3
        },

        {
            id:
                "checkEventType",

            complete:
                Boolean(
                    data.type
                )
        },

        {
            id:
                "checkEventGenre",

            complete:
                Boolean(
                    data.genre
                )
        },

        {
            id:
                "checkEventDescription",

            complete:
                data.description.length >=
                20
        },

        {
            id:
                "checkEventPoster",

            complete:
                Boolean(
                    organiserCreateEventState
                        .posterFile
                )
        }

    ];


    requirements.forEach(
        (requirement) => {

            updateCreateEventChecklistItem(
                requirement.id,
                requirement.complete
            );

        }
    );


    const completed =
        requirements.filter(
            (item) =>
                item.complete
        ).length;


    const percentage =
        Math.round(
            (
                completed /
                requirements.length
            ) *
            100
        );


    setCreateEventText(
        "eventCompletionPercentage",
        `${percentage}%`
    );

}


/* =========================================================
   23. CHECKLIST ITEM
   ========================================================= */

function updateCreateEventChecklistItem(
    id,
    complete
) {

    const element =
        document.getElementById(
            id
        );


    if (!element) {

        return;

    }


    element.classList.toggle(
        "completed",
        complete
    );


    const iconContainer =
        element.querySelector(
            ":scope > span"
        );


    if (!iconContainer) {

        return;

    }


    iconContainer.innerHTML =
        complete
            ? `<i data-lucide="circle-check-big"></i>`
            : `<i data-lucide="circle"></i>`;

}


/* =========================================================
   24. FORM DATA
   ========================================================= */

function getCreateEventFormData() {

    return {

        title:
            getCreateEventValue(
                "eventTitle"
            ),

        type:
            getCreateEventValue(
                "eventType"
            ),

        genre:
            getCreateEventValue(
                "eventGenre"
            ),

        language:
            getCreateEventValue(
                "eventLanguage"
            ),

        duration:
            getCreateEventValue(
                "eventDuration"
            ),

        ageRating:
            getCreateEventValue(
                "eventAgeRating"
            ),

        description:
            getCreateEventValue(
                "eventDescription"
            ),

        performers:
            getCreateEventValue(
                "eventPerformers"
            ),

        creator:
            getCreateEventValue(
                "eventCreator"
            ),

        tags:
            getCreateEventValue(
                "eventTags"
            )

    };

}


/* =========================================================
   25. GET VALUE
   ========================================================= */

function getCreateEventValue(
    id
) {

    return document
        .getElementById(
            id
        )
        ?.value
        ?.trim() ||
        "";

}


/* =========================================================
   26. VALIDATION
   ========================================================= */

function validateCreateEventForm(
    data
) {

    clearAllCreateEventErrors();


    let valid =
        true;


    if (
        data.title.length <
        3
    ) {

        setCreateEventFieldError(
            "eventTitle",
            "Event title must contain at least 3 characters."
        );


        valid =
            false;

    }


    if (!data.type) {

        setCreateEventFieldError(
            "eventType",
            "Select an event type."
        );


        valid =
            false;

    }


    if (!data.genre) {

        setCreateEventFieldError(
            "eventGenre",
            "Enter a genre or category."
        );


        valid =
            false;

    }


    if (
        data.description.length <
        20
    ) {

        setCreateEventFieldError(
            "eventDescription",
            "Description must contain at least 20 characters."
        );


        valid =
            false;

    }


    if (
        data.duration
    ) {

        const duration =
            Number(
                data.duration
            );


        if (
            !Number.isFinite(
                duration
            ) ||
            duration <=
                0 ||
            duration >
                1000
        ) {

            showCreateEventToast(
                "Duration must be between 1 and 1000 minutes.",
                "error",
                "Invalid Duration"
            );


            valid =
                false;

        }

    }


    if (!valid) {

        const firstError =
            document.querySelector(
                ".organiser-field-error:not([hidden])"
            );


        firstError
            ?.closest(
                ".organiser-form-group"
            )
            ?.scrollIntoView({
                behavior:
                    "smooth",

                block:
                    "center"
            });

    }


    return valid;

}


/* =========================================================
   27. SET FIELD ERROR
   ========================================================= */

function setCreateEventFieldError(
    fieldId,
    message
) {

    const field =
        document.getElementById(
            fieldId
        );


    const error =
        document.getElementById(
            `${fieldId}Error`
        );


    field?.classList.add(
        "error"
    );


    field
        ?.closest(
            ".organiser-input-wrapper, .organiser-select-wrapper, .organiser-textarea-wrapper"
        )
        ?.classList.add(
            "error"
        );


    if (error) {

        error.textContent =
            message;


        error.hidden =
            false;

    }

}


/* =========================================================
   28. CLEAR FIELD ERROR
   ========================================================= */

function clearCreateEventFieldError(
    fieldId
) {

    const field =
        document.getElementById(
            fieldId
        );


    const error =
        document.getElementById(
            `${fieldId}Error`
        );


    field?.classList.remove(
        "error"
    );


    field
        ?.closest(
            ".organiser-input-wrapper, .organiser-select-wrapper, .organiser-textarea-wrapper"
        )
        ?.classList.remove(
            "error"
        );


    if (error) {

        error.hidden =
            true;


        error.textContent =
            "";

    }

}


/* =========================================================
   29. CLEAR ALL ERRORS
   ========================================================= */

function clearAllCreateEventErrors() {

    [
        "eventTitle",
        "eventType",
        "eventGenre",
        "eventDescription"
    ]
        .forEach(
            clearCreateEventFieldError
        );

}


/* =========================================================
   30. FORM SUBMIT - REAL BACKEND
   ========================================================= */

async function handleCreateEventSubmit(
    event
) {

    event.preventDefault();


    if (
        organiserCreateEventState.saving
    ) {

        return;

    }


    const data =
        getCreateEventFormData();


    if (
        !validateCreateEventForm(
            data
        )
    ) {

        return;

    }


    if (
        !window.SKYRA_API ||
        typeof window.SKYRA_API
            .createEvent !==
            "function" ||
        typeof window.SKYRA_API
            .updateEvent !==
            "function"
    ) {

        showCreateEventToast(
            "Event API is unavailable. Make sure Phase 7 common.js is loaded.",
            "error",
            "API Unavailable"
        );

        return;

    }


    setCreateEventSaving(
        true
    );


    try {

        const payload =
            createEventPayload(
                data,
                "PUBLISHED"
            );


        const existingDraftId =
            (
                String(
                    organiserCreateEventState
                        .createdEvent
                        ?.status ||
                    ""
                ).toUpperCase() ===
                "DRAFT"
            )
                ? String(
                    organiserCreateEventState
                        .createdEvent
                        ?.id ||
                    organiserCreateEventState
                        .createdEvent
                        ?._id ||
                    ""
                ).trim()
                : "";


        const response =
            existingDraftId
                ? await window.SKYRA_API
                    .updateEvent(
                        existingDraftId,
                        payload
                    )
                : await window.SKYRA_API
                    .createEvent(
                        payload
                    );


        const createdEvent =
            response?.data?.event ||
            response?.event ||
            null;


        if (
            !createdEvent ||
            !(
                createdEvent.id ||
                createdEvent._id
            )
        ) {

            throw new Error(
                "Backend did not return the created Event."
            );

        }


        organiserCreateEventState.createdEvent =
            createdEvent;


        organiserCreateEventState.dirty =
            false;


        removeStoredCreateEventDraft();


        const eventId =
            String(
                createdEvent.id ||
                createdEvent._id
            );


        const createShowButton =
            document.getElementById(
                "createShowForEventButton"
            );


        if (createShowButton) {

            createShowButton.href =
                `./create-show.html?event=${
                    encodeURIComponent(
                        eventId
                    )
                }`;

        }


        await refreshCreateEventSidebarCounts();


        openEventCreatedModal();


        showCreateEventToast(
            existingDraftId
                ? "Draft published successfully."
                : "Event created successfully.",
            "success",
            existingDraftId
                ? "Event Published"
                : "Event Created"
        );

    } catch (error) {

        console.error(
            "Create event failed:",
            error
        );


        showCreateEventToast(
            error?.message ||
            "Unable to create this event.",
            "error",
            "Creation Failed"
        );

    } finally {

        setCreateEventSaving(
            false
        );

    }

}


/* =========================================================
   31. PAYLOAD
   ========================================================= */

function createEventPayload(
    data,
    status
) {

    return {

        title:
            data.title,

        type:
            data.type,

        genre:
            data.genre,

        language:
            data.language ||
            "",

        duration:
            data.duration
                ? Number(
                    data.duration
                )
                : null,

        ageRating:
            data.ageRating ||
            "",

        description:
            data.description,

        performers:
            parseCommaSeparatedValues(
                data.performers
            ),

        creator:
            data.creator ||
            "",

        tags:
            parseCommaSeparatedValues(
                data.tags
            ),

        posterFileName:
            organiserCreateEventState
                .posterFile
                ?.name ||
            "",

        bannerFileName:
            organiserCreateEventState
                .bannerFile
                ?.name ||
            "",

        status

    };

}


/* =========================================================
   35. DRAFT INITIALIZATION
   ========================================================= */

function initializeCreateEventDraft() {

    document
        .getElementById(
            "saveEventDraftButton"
        )
        ?.addEventListener(
            "click",
            saveCreateEventDraft
        );


    restoreCreateEventDraft();

}


/* =========================================================
   36. SAVE DRAFT - REAL BACKEND
   ========================================================= */

async function saveCreateEventDraft() {

    if (
        organiserCreateEventState.saving
    ) {

        return;

    }


    const data =
        getCreateEventFormData();


    /*
       Backend DRAFT is still a real Event record.
       Therefore required Event fields must be valid before it
       can be stored in MongoDB.
    */

    if (
        !validateCreateEventForm(
            data
        )
    ) {

        showCreateEventToast(
            "Complete the required Event fields before saving the draft.",
            "warning",
            "Draft Not Saved"
        );

        return;

    }


    if (
        !window.SKYRA_API ||
        typeof window.SKYRA_API
            .createEvent !==
            "function" ||
        typeof window.SKYRA_API
            .updateEvent !==
            "function"
    ) {

        showCreateEventToast(
            "Event API is unavailable. Make sure Phase 7 common.js is loaded.",
            "error",
            "API Unavailable"
        );

        return;

    }


    const draftButton =
        document.getElementById(
            "saveEventDraftButton"
        );


    organiserCreateEventState.saving =
        true;


    if (draftButton) {

        draftButton.disabled =
            true;

    }


    try {

        const payload =
            createEventPayload(
                data,
                "DRAFT"
            );


        const existingDraftId =
            (
                String(
                    organiserCreateEventState
                        .createdEvent
                        ?.status ||
                    ""
                ).toUpperCase() ===
                "DRAFT"
            )
                ? String(
                    organiserCreateEventState
                        .createdEvent
                        ?.id ||
                    organiserCreateEventState
                        .createdEvent
                        ?._id ||
                    ""
                ).trim()
                : "";


        const response =
            existingDraftId
                ? await window.SKYRA_API
                    .updateEvent(
                        existingDraftId,
                        payload
                    )
                : await window.SKYRA_API
                    .createEvent(
                        payload
                    );


        const savedEvent =
            response?.data?.event ||
            response?.event ||
            null;


        if (
            !savedEvent ||
            !(
                savedEvent.id ||
                savedEvent._id
            )
        ) {

            throw new Error(
                "Backend did not return the saved draft Event."
            );

        }


        organiserCreateEventState.createdEvent =
            savedEvent;


        organiserCreateEventState.dirty =
            false;


        /*
           Keep a tiny form cache so reloading the Create Event
           page can restore the inputs. MongoDB remains the source
           of truth because backendEventId identifies the real draft.
        */

        try {

            localStorage.setItem(
                SKYRA_CREATE_EVENT_STORAGE
                    .DRAFT,

                JSON.stringify({

                    ...data,

                    savedAt:
                        new Date()
                            .toISOString(),

                    backendEventId:
                        String(
                            savedEvent.id ||
                            savedEvent._id
                        ),

                    backendStatus:
                        "DRAFT"

                })
            );

        } catch (storageError) {

            console.warn(
                "Draft saved to MongoDB, but local form cache could not be updated.",
                storageError
            );

        }


        setCreateEventText(
            "eventPreviewStatus",
            "Draft Saved"
        );


        await refreshCreateEventSidebarCounts();


        showCreateEventToast(
            "Event draft saved to MongoDB.",
            "success",
            "Draft Saved"
        );

    } catch (error) {

        console.error(
            "Unable to save Event draft:",
            error
        );


        showCreateEventToast(
            error?.message ||
            "Unable to save the draft.",
            "error",
            "Draft Error"
        );

    } finally {

        organiserCreateEventState.saving =
            false;


        if (draftButton) {

            draftButton.disabled =
                false;

        }

    }

}


/* =========================================================
   37. RESTORE DRAFT
   ========================================================= */

function restoreCreateEventDraft() {

    let draft;


    try {

        draft =
            JSON.parse(
                localStorage.getItem(
                    SKYRA_CREATE_EVENT_STORAGE
                        .DRAFT
                )
            );

    } catch {

        draft =
            null;

    }


    if (!draft) {

        return;

    }


    if (
        draft.backendEventId
    ) {

        organiserCreateEventState.createdEvent = {

            id:
                String(
                    draft.backendEventId
                ),

            _id:
                String(
                    draft.backendEventId
                ),

            status:
                "DRAFT"

        };

    }


    setCreateEventInputValue(
        "eventTitle",
        draft.title
    );


    setCreateEventInputValue(
        "eventType",
        draft.type
    );


    setCreateEventInputValue(
        "eventGenre",
        draft.genre
    );


    setCreateEventInputValue(
        "eventLanguage",
        draft.language
    );


    setCreateEventInputValue(
        "eventDuration",
        draft.duration
    );


    setCreateEventInputValue(
        "eventAgeRating",
        draft.ageRating
    );


    setCreateEventInputValue(
        "eventDescription",
        draft.description
    );


    setCreateEventInputValue(
        "eventPerformers",
        draft.performers
    );


    setCreateEventInputValue(
        "eventCreator",
        draft.creator
    );


    setCreateEventInputValue(
        "eventTags",
        draft.tags
    );


    setCreateEventText(
        "eventPreviewStatus",
        "Draft Restored"
    );


    organiserCreateEventState.dirty =
        false;


    updateCreateEventPreview();

    updateCreateEventChecklist();

    updateCreateEventCharacterCounters();

}


/* =========================================================
   38. REMOVE DRAFT
   ========================================================= */

function removeStoredCreateEventDraft() {

    try {

        localStorage.removeItem(
            SKYRA_CREATE_EVENT_STORAGE
                .DRAFT
        );

    } catch {

        /* Ignore development storage error. */

    }

}


/* =========================================================
   39. MODALS
   ========================================================= */

function initializeCreateEventModals() {

    document
        .getElementById(
            "closeDiscardEventModal"
        )
        ?.addEventListener(
            "click",
            closeDiscardEventModal
        );


    document
        .getElementById(
            "continueEventEditingButton"
        )
        ?.addEventListener(
            "click",
            closeDiscardEventModal
        );


    document
        .getElementById(
            "confirmDiscardEventButton"
        )
        ?.addEventListener(
            "click",
            discardCreateEventChanges
        );


    document
        .getElementById(
            "discardEventModal"
        )
        ?.addEventListener(
            "click",
            (event) => {

                if (
                    event.target.id ===
                    "discardEventModal"
                ) {

                    closeDiscardEventModal();

                }

            }
        );

}


/* =========================================================
   40. OPEN CREATED MODAL
   ========================================================= */

function openEventCreatedModal() {

    const modal =
        document.getElementById(
            "eventCreatedModal"
        );


    if (modal) {

        modal.hidden =
            false;

    }


    refreshCreateEventIcons();

}


/* =========================================================
   41. CLOSE DISCARD MODAL
   ========================================================= */

function closeDiscardEventModal() {

    const modal =
        document.getElementById(
            "discardEventModal"
        );


    if (modal) {

        modal.hidden =
            true;

    }

}


/* =========================================================
   42. DISCARD CHANGES
   ========================================================= */

async function discardCreateEventChanges() {

    const draftId =
        (
            String(
                organiserCreateEventState
                    .createdEvent
                    ?.status ||
                ""
            ).toUpperCase() ===
            "DRAFT"
        )
            ? String(
                organiserCreateEventState
                    .createdEvent
                    ?.id ||
                organiserCreateEventState
                    .createdEvent
                    ?._id ||
                ""
            ).trim()
            : "";


    if (draftId) {

        if (
            !window.SKYRA_API ||
            typeof window.SKYRA_API
                .deleteEvent !==
                "function"
        ) {

            showCreateEventToast(
                "Event API is unavailable. The MongoDB draft was not discarded.",
                "error",
                "Discard Failed"
            );

            return;

        }


        try {

            await window.SKYRA_API
                .deleteEvent(
                    draftId
                );

        } catch (error) {

            showCreateEventToast(
                error?.message ||
                "Unable to discard the saved draft.",
                "error",
                "Discard Failed"
            );

            return;

        }

    }


    document
        .getElementById(
            "createEventForm"
        )
        ?.reset();


    removeEventPoster();

    removeEventBanner();

    removeStoredCreateEventDraft();


    organiserCreateEventState.createdEvent =
        null;


    organiserCreateEventState.dirty =
        false;


    setCreateEventText(
        "eventPreviewStatus",
        "Draft"
    );


    clearAllCreateEventErrors();

    updateCreateEventCharacterCounters();

    updateCreateEventPreview();

    updateCreateEventChecklist();

    closeDiscardEventModal();


    await refreshCreateEventSidebarCounts();


    showCreateEventToast(
        draftId
            ? "Saved draft was discarded."
            : "Event changes were discarded.",
        "info",
        "Changes Removed"
    );

}


/* =========================================================
   43. SAVING STATE
   ========================================================= */

function setCreateEventSaving(
    saving
) {

    organiserCreateEventState.saving =
        Boolean(
            saving
        );


    const button =
        document.getElementById(
            "createEventButton"
        );


    const text =
        document.getElementById(
            "createEventButtonText"
        );


    if (button) {

        button.disabled =
            saving;

    }


    if (text) {

        text.textContent =
            saving
                ? "Creating..."
                : "Create Event";

    }

}


/* =========================================================
   44. BEFORE UNLOAD
   ========================================================= */

function initializeCreateEventBeforeUnload() {

    window.addEventListener(
        "beforeunload",
        (event) => {

            if (
                !organiserCreateEventState
                    .dirty
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
   45. PARSE COMMA VALUES
   ========================================================= */

function parseCommaSeparatedValues(
    value
) {

    if (!value) {

        return [];

    }


    return String(
        value
    )
        .split(",")
        .map(
            (item) =>
                item.trim()
        )
        .filter(Boolean);

}


/* =========================================================
   46. FORMAT TYPE
   ========================================================= */

function formatCreateEventType(
    type
) {

    switch (
        String(
            type ||
            ""
        )
    ) {

        case "MOVIE":

            return "MOVIE";


        case "CONCERT":

            return "CONCERT";


        case "LIVE_SHOW":

            return "LIVE SHOW";


        default:

            return "EVENT";

    }

}


/* =========================================================
   47. INITIALS
   ========================================================= */

function createEventInitials(
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

        return "OR";

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
   48. OBJECT URL CLEANUP
   ========================================================= */

function revokeCreateEventObjectURL(
    url
) {

    if (!url) {

        return;

    }


    try {

        URL.revokeObjectURL(
            url
        );

    } catch {

        /* Safe cleanup. */

    }

}


/* =========================================================
   49. INPUT SETTER
   ========================================================= */

function setCreateEventInputValue(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (element) {

        element.value =
            value ??
            "";

    }

}


/* =========================================================
   50. TEXT SETTER
   ========================================================= */

function setCreateEventText(
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
   51. TOAST
   ========================================================= */

function showCreateEventToast(
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
   52. ICON REFRESH
   ========================================================= */

function refreshCreateEventIcons() {

    if (
        typeof lucide !==
        "undefined"
    ) {

        lucide.createIcons();

    }

}


/* =========================================================
   53. ESCAPE KEY
   ========================================================= */

document.addEventListener(
    "keydown",
    (event) => {

        if (
            event.key ===
            "Escape"
        ) {

            closeDiscardEventModal();

        }

    }
);


/* =========================================================
   54. CLEANUP
   ========================================================= */

window.addEventListener(
    "unload",
    () => {

        revokeCreateEventObjectURL(
            organiserCreateEventState
                .posterPreviewUrl
        );


        revokeCreateEventObjectURL(
            organiserCreateEventState
                .bannerPreviewUrl
        );

    }
);


/* =========================================================
   55. PUBLIC API
   ========================================================= */

window.SKYRA_CREATE_EVENT_PAGE = {

    getFormData:
        getCreateEventFormData,

    saveDraft:
        saveCreateEventDraft,

    updatePreview:
        updateCreateEventPreview,

    getCreatedEvent:
        () =>
            organiserCreateEventState
                .createdEvent
                    ? {
                        ...organiserCreateEventState
                            .createdEvent
                    }
                    : null

};


/* =========================================================
   END SKYRA CREATE EVENT
   ========================================================= */