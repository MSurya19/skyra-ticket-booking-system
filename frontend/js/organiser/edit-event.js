/* =========================================================
   SKYRA - ORGANISER EDIT EVENT
   File:
   frontend/js/organiser/edit-event.js

   Reads:
   edit-event.html?id=<eventId>

   Phase 7 backend-connected frontend:
   - Loads Event by MongoDB ID from the Organiser API
   - Form validation
   - Live preview
   - Image preview
   - Reset unsaved changes
   - Saves edits through PATCH
   - Backend validates Organiser ownership

   API:
   - GET   /api/organiser/events/:eventId
   - PATCH /api/organiser/events/:eventId

   MongoDB/backend is the source of truth.
   No mock or local event-record fallback is used.
   ========================================================= */

"use strict";


/* =========================================================
   3. STATE
   ========================================================= */

const organiserEditEventState = {

    eventId:
        null,

    originalEvent:
        null,

    currentEvent:
        null,

    runtimeEvent:
        false,

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
        null

};


/* =========================================================
   4. DOM READY
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initializeEditEventPage();

    }
);


/* =========================================================
   5. INITIALIZE PAGE
   ========================================================= */

async function initializeEditEventPage() {

    initializeEditEventUser();

    initializeEditEventNavigation();

    initializeEditEventSearch();

    initializeEditEventForm();

    initializeEditEventUploads();

    initializeEditEventModals();

    initializeEditEventBeforeUnload();


    const params =
        new URLSearchParams(
            window.location.search
        );


    organiserEditEventState.eventId =
        params.get(
            "id"
        );


    if (
        !organiserEditEventState
            .eventId
    ) {

        showEditEventNotFound();

        return;

    }


    try {

        const event =
            await loadEditEvent(
                organiserEditEventState
                    .eventId
            );


        if (!event) {

            showEditEventNotFound();

            return;

        }


        organiserEditEventState.originalEvent =
            cloneEditEvent(
                event
            );


        organiserEditEventState.currentEvent =
            cloneEditEvent(
                event
            );


        populateEditEventForm(
            event
        );


        renderEditEventMetadata(
            event
        );


        updateEditEventPreview();

        updateEditEventCharacterCounters();

        showEditEventWorkspace();

        refreshEditEventIcons();

    } catch (error) {

        console.error(
            "Unable to load event:",
            error
        );


        showEditEventNotFound();

    }

}


/* =========================================================
   6. LOAD EVENT - REAL BACKEND
   ========================================================= */

async function loadEditEvent(
    eventId
) {

    if (
        !window.SKYRA_API ||
        typeof window.SKYRA_API
            .getEvent !==
            "function"
    ) {

        throw new Error(
            "Event API is unavailable. Make sure Phase 7 common.js is loaded."
        );

    }


    const response =
        await window.SKYRA_API
            .getEvent(
                eventId
            );


    const event =
        response?.data?.event ||
        response?.event ||
        null;


    if (!event) {

        return null;

    }


    organiserEditEventState.runtimeEvent =
        false;


    return normalizeEditEvent(
        event
    );

}


/* =========================================================
   7. NORMALIZE EVENT
   ========================================================= */

function normalizeEditEvent(
    raw
) {

    return {

        id:
            String(
                raw.id ||
                raw._id ||
                ""
            ),

        title:
            String(
                raw.title ||
                raw.name ||
                ""
            ),

        type:
            normalizeEditEventType(
                raw.type ||
                raw.eventType
            ),

        genre:
            String(
                raw.genre ||
                raw.category ||
                ""
            ),

        language:
            String(
                raw.language ||
                ""
            ),

        duration:
            raw.duration
                ? Number(
                    raw.duration
                )
                : null,

        ageRating:
            String(
                raw.ageRating ||
                ""
            ),

        description:
            String(
                raw.description ||
                ""
            ),

        performers:
            normalizeEditEventArray(
                raw.performers
            ),

        creator:
            String(
                raw.creator ||
                ""
            ),

        tags:
            normalizeEditEventArray(
                raw.tags
            ),

        poster:
            raw.poster ||
            raw.posterUrl ||
            raw.image ||
            null,

        banner:
            raw.banner ||
            raw.bannerUrl ||
            null,

        posterFileName:
            raw.posterFileName ||
            null,

        bannerFileName:
            raw.bannerFileName ||
            null,

        status:
            normalizeEditEventStatus(
                raw.status
            ),

        showCount:
            Math.max(
                0,
                Number(
                    raw.showCount ??
                    raw.totalShows ??
                    raw.shows?.length ??
                    0
                ) || 0
            ),

        createdAt:
            raw.createdAt ||
            new Date()
                .toISOString(),

        updatedAt:
            raw.updatedAt ||
            null

    };

}


/* =========================================================
   10. USER
   ========================================================= */

function initializeEditEventUser() {

    const sharedUser = window.SKYRA_COMMON?.getUser?.();
    const organiser =
        sharedUser && String(sharedUser.role || "").toUpperCase() === "ORGANISER"
            ? sharedUser
            : { name: "Organiser", email: "", role: "ORGANISER" };

    const name = String(organiser.name || organiser.fullName || "Organiser");
    const initials = createEditEventInitials(name);

    setEditEventText("sidebarUserName", name);
    setEditEventText("sidebarUserInitials", initials);
    setEditEventText("topbarUserName", name);
    setEditEventText("topbarUserInitials", initials);
    setEditEventText("dropdownUserName", name);
    setEditEventText("dropdownUserInitials", initials);
    setEditEventText("dropdownUserEmail", organiser.email || "");

}


/* =========================================================
   11. ACTIVE NAVIGATION
   ========================================================= */

function initializeEditEventNavigation() {

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
                    "./manage-events.html";


                link.classList.toggle(
                    "active",
                    active
                );


                if (active) {

                    link.setAttribute(
                        "aria-current",
                        "page"
                    );

                }

            }
        );

}


/* =========================================================
   12. SEARCH
   ========================================================= */

function initializeEditEventSearch() {

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
   13. FORM
   ========================================================= */

function initializeEditEventForm() {

    const form =
        document.getElementById(
            "editEventForm"
        );


    if (!form) {

        return;

    }


    form.addEventListener(
        "submit",
        handleEditEventSubmit
    );


    form
        .querySelectorAll(
            "input, select, textarea"
        )
        .forEach(
            (field) => {

                field.addEventListener(
                    "input",
                    handleEditEventFieldChange
                );


                field.addEventListener(
                    "change",
                    handleEditEventFieldChange
                );

            }
        );

}


/* =========================================================
   14. FIELD CHANGE
   ========================================================= */

function handleEditEventFieldChange(
    event
) {

    organiserEditEventState.dirty =
        true;


    clearEditEventFieldError(
        event.target.id
    );


    updateEditEventPreview();

    updateEditEventCharacterCounters();

}


/* =========================================================
   15. POPULATE FORM
   ========================================================= */

function populateEditEventForm(
    event
) {

    setEditEventInput(
        "eventTitle",
        event.title
    );


    setEditEventInput(
        "eventType",
        event.type
    );


    setEditEventInput(
        "eventGenre",
        event.genre
    );


    ensureEditEventSelectOption(
        "eventLanguage",
        event.language
    );


    setEditEventInput(
        "eventDuration",
        event.duration
    );


    ensureEditEventSelectOption(
        "eventAgeRating",
        event.ageRating
    );


    setEditEventInput(
        "eventStatus",
        event.status
    );


    setEditEventInput(
        "eventDescription",
        event.description
    );


    setEditEventInput(
        "eventPerformers",
        event.performers.join(
            ", "
        )
    );


    setEditEventInput(
        "eventCreator",
        event.creator
    );


    setEditEventInput(
        "eventTags",
        event.tags.join(
            ", "
        )
    );


    if (event.poster) {

        showExistingEditEventPoster(
            event.poster
        );

    }


    if (event.banner) {

        showExistingEditEventBanner(
            event.banner
        );

    }


    organiserEditEventState.dirty =
        false;

}


/* =========================================================
   16. FORM DATA
   ========================================================= */

function getEditEventFormData() {

    return {

        title:
            getEditEventValue(
                "eventTitle"
            ),

        type:
            getEditEventValue(
                "eventType"
            ),

        genre:
            getEditEventValue(
                "eventGenre"
            ),

        language:
            getEditEventValue(
                "eventLanguage"
            ),

        duration:
            getEditEventValue(
                "eventDuration"
            ),

        ageRating:
            getEditEventValue(
                "eventAgeRating"
            ),

        status:
            getEditEventValue(
                "eventStatus"
            ) ||
            "PUBLISHED",

        description:
            getEditEventValue(
                "eventDescription"
            ),

        performers:
            getEditEventValue(
                "eventPerformers"
            ),

        creator:
            getEditEventValue(
                "eventCreator"
            ),

        tags:
            getEditEventValue(
                "eventTags"
            )

    };

}


/* =========================================================
   17. GET VALUE
   ========================================================= */

function getEditEventValue(
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
   18. PREVIEW
   ========================================================= */

function updateEditEventPreview() {

    const data =
        getEditEventFormData();


    setEditEventText(
        "eventLiveTitle",
        data.title ||
        "Event"
    );


    setEditEventText(
        "eventLiveGenre",
        data.genre ||
        "Genre / Category"
    );


    setEditEventText(
        "eventLiveDescription",
        data.description ||
        "Event description"
    );


    setEditEventText(
        "eventLiveType",
        formatEditEventType(
            data.type
        )
    );


    setEditEventText(
        "eventLiveLanguage",
        data.language ||
        "Language"
    );


    setEditEventText(
        "eventLiveDuration",
        data.duration
            ? `${data.duration} min`
            : "Duration"
    );


    setEditEventText(
        "eventLiveStatus",
        data.status ===
            "DRAFT"
            ? "Draft"
            : "Published"
    );

}


/* =========================================================
   19. CHARACTER COUNTERS
   ========================================================= */

function updateEditEventCharacterCounters() {

    const title =
        getEditEventValue(
            "eventTitle"
        );


    const description =
        getEditEventValue(
            "eventDescription"
        );


    setEditEventText(
        "eventTitleCount",
        `${title.length} / 120`
    );


    setEditEventText(
        "eventDescriptionCount",
        `${description.length} / 1500`
    );

}


/* =========================================================
   20. EVENT METADATA
   ========================================================= */

function renderEditEventMetadata(
    event
) {

    setEditEventText(
        "editFlowEventTitle",
        event.title
    );


    setEditEventText(
        "editFlowShowCount",
        `${
            event.showCount
        } ${
            event.showCount ===
                1
                ? "Show"
                : "Shows"
        }`
    );


    setEditEventText(
        "editEventIdLabel",
        event.id
    );


    setEditEventText(
        "editEventShowCount",
        `${
            event.showCount
        } ${
            event.showCount ===
                1
                ? "show"
                : "shows"
        }`
    );


    setEditEventText(
        "editEventCreatedAt",
        formatEditEventDateTime(
            event.createdAt
        )
    );


    setEditEventText(
        "editEventUpdatedAt",
        event.updatedAt
            ? formatEditEventDateTime(
                event.updatedAt
            )
            : "Not edited yet"
    );


    const createShow =
        document.getElementById(
            "editEventCreateShowButton"
        );


    if (createShow) {

        createShow.href =
            `./create-show.html?event=${
                encodeURIComponent(
                    event.id
                )
            }`;

    }


    renderEditEventSidebarCounts();

}


/* =========================================================
   21. SIDEBAR COUNTS - REAL BACKEND
   ========================================================= */

async function renderEditEventSidebarCounts() {

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


        setEditEventText(
            "sidebarEventCount",
            events.length
        );


        setEditEventText(
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
   22. VALIDATION
   ========================================================= */

function validateEditEventForm(
    data
) {

    clearAllEditEventErrors();


    let valid =
        true;


    if (
        data.title.length <
        3
    ) {

        setEditEventFieldError(
            "eventTitle",
            "Event title must contain at least 3 characters."
        );


        valid =
            false;

    }


    if (!data.type) {

        setEditEventFieldError(
            "eventType",
            "Select an event type."
        );


        valid =
            false;

    }


    if (!data.genre) {

        setEditEventFieldError(
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

        setEditEventFieldError(
            "eventDescription",
            "Description must contain at least 20 characters."
        );


        valid =
            false;

    }


    if (data.duration) {

        const duration =
            Number(
                data.duration
            );


        if (
            !Number.isFinite(
                duration
            ) ||
            duration <
                1 ||
            duration >
                1000
        ) {

            showEditEventToast(
                "Duration must be between 1 and 1000 minutes.",
                "error",
                "Invalid Duration"
            );


            valid =
                false;

        }

    }


    if (!valid) {

        document
            .querySelector(
                ".organiser-field-error:not([hidden])"
            )
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
   23. SUBMIT - REAL BACKEND
   ========================================================= */

async function handleEditEventSubmit(
    submitEvent
) {

    submitEvent.preventDefault();


    if (
        organiserEditEventState
            .saving
    ) {

        return;

    }


    const data =
        getEditEventFormData();


    if (
        !validateEditEventForm(
            data
        )
    ) {

        return;

    }


    if (
        !window.SKYRA_API ||
        typeof window.SKYRA_API
            .updateEvent !==
            "function"
    ) {

        showEditEventToast(
            "Event API is unavailable. Make sure Phase 7 common.js is loaded.",
            "error",
            "API Unavailable"
        );

        return;

    }


    setEditEventSaving(
        true
    );


    try {

        const update = {

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

            status:
                data.status,

            description:
                data.description,

            performers:
                parseEditEventCommaList(
                    data.performers
                ),

            creator:
                data.creator ||
                "",

            tags:
                parseEditEventCommaList(
                    data.tags
                ),

            posterFileName:
                organiserEditEventState
                    .posterFile
                    ?.name ||
                organiserEditEventState
                    .currentEvent
                    ?.posterFileName ||
                "",

            bannerFileName:
                organiserEditEventState
                    .bannerFile
                    ?.name ||
                organiserEditEventState
                    .currentEvent
                    ?.bannerFileName ||
                ""

        };


        const response =
            await window.SKYRA_API
                .updateEvent(
                    organiserEditEventState
                        .eventId,
                    update
                );


        const savedEvent =
            response?.data?.event ||
            response?.event ||
            null;


        if (!savedEvent) {

            throw new Error(
                "Backend did not return the updated Event."
            );

        }


        organiserEditEventState.currentEvent =
            normalizeEditEvent(
                savedEvent
            );


        organiserEditEventState.originalEvent =
            cloneEditEvent(
                organiserEditEventState
                    .currentEvent
            );


        organiserEditEventState.dirty =
            false;


        renderEditEventMetadata(
            organiserEditEventState
                .currentEvent
        );


        openEditEventUpdatedModal();


        showEditEventToast(
            "Event changes saved successfully.",
            "success",
            "Event Updated"
        );

    } catch (error) {

        console.error(
            "Unable to update event:",
            error
        );


        showEditEventToast(
            error?.message ||
            "Unable to save event changes.",
            "error",
            "Update Failed"
        );

    } finally {

        setEditEventSaving(
            false
        );

    }

}


/* =========================================================
   25. IMAGE INITIALIZATION
   ========================================================= */

function initializeEditEventUploads() {

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
            "eventPoster"
        )
        ?.addEventListener(
            "change",
            handleEditEventPoster
        );


    document
        .getElementById(
            "removeEventPoster"
        )
        ?.addEventListener(
            "click",
            removeEditEventPoster
        );


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
            handleEditEventBanner
        );


    document
        .getElementById(
            "removeEventBanner"
        )
        ?.addEventListener(
            "click",
            removeEditEventBanner
        );

}


/* =========================================================
   26. POSTER
   ========================================================= */

function handleEditEventPoster(
    event
) {

    const file =
        event.target.files?.[0];


    if (
        !file ||
        !validateEditEventImage(
            file
        )
    ) {

        return;

    }


    revokeEditEventURL(
        organiserEditEventState
            .posterPreviewUrl
    );


    organiserEditEventState.posterFile =
        file;


    organiserEditEventState.posterPreviewUrl =
        URL.createObjectURL(
            file
        );


    showExistingEditEventPoster(
        organiserEditEventState
            .posterPreviewUrl
    );


    organiserEditEventState.dirty =
        true;

}


/* =========================================================
   27. BANNER
   ========================================================= */

function handleEditEventBanner(
    event
) {

    const file =
        event.target.files?.[0];


    if (
        !file ||
        !validateEditEventImage(
            file
        )
    ) {

        return;

    }


    revokeEditEventURL(
        organiserEditEventState
            .bannerPreviewUrl
    );


    organiserEditEventState.bannerFile =
        file;


    organiserEditEventState.bannerPreviewUrl =
        URL.createObjectURL(
            file
        );


    showExistingEditEventBanner(
        organiserEditEventState
            .bannerPreviewUrl
    );


    organiserEditEventState.dirty =
        true;

}


/* =========================================================
   28. SHOW POSTER
   ========================================================= */

function showExistingEditEventPoster(
    url
) {

    const preview =
        document.getElementById(
            "eventPosterPreview"
        );


    const image =
        document.getElementById(
            "eventPosterPreviewImage"
        );


    const placeholder =
        document.getElementById(
            "selectEventPosterButton"
        );


    if (image) {

        image.src =
            url;

    }


    if (preview) {

        preview.hidden =
            false;

    }


    if (placeholder) {

        placeholder.hidden =
            true;

    }


    const livePoster =
        document.getElementById(
            "eventLivePoster"
        );


    if (livePoster) {

        livePoster.classList.add(
            "has-image"
        );


        livePoster.innerHTML =
            "";


        livePoster.style.backgroundImage =
            `linear-gradient(
                180deg,
                rgba(2, 6, 23, 0.02),
                rgba(2, 6, 23, 0.56)
            ),
            url("${url}")`;

    }

}


/* =========================================================
   29. SHOW BANNER
   ========================================================= */

function showExistingEditEventBanner(
    url
) {

    const preview =
        document.getElementById(
            "eventBannerPreview"
        );


    const image =
        document.getElementById(
            "eventBannerPreviewImage"
        );


    const placeholder =
        document.getElementById(
            "selectEventBannerButton"
        );


    if (image) {

        image.src =
            url;

    }


    if (preview) {

        preview.hidden =
            false;

    }


    if (placeholder) {

        placeholder.hidden =
            true;

    }

}


/* =========================================================
   30. REMOVE POSTER
   ========================================================= */

function removeEditEventPoster(
    event
) {

    event?.stopPropagation();


    organiserEditEventState.posterFile =
        null;


    revokeEditEventURL(
        organiserEditEventState
            .posterPreviewUrl
    );


    organiserEditEventState.posterPreviewUrl =
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


    resetEditEventLivePoster();


    organiserEditEventState.dirty =
        true;


    refreshEditEventIcons();

}


/* =========================================================
   31. REMOVE BANNER
   ========================================================= */

function removeEditEventBanner(
    event
) {

    event?.stopPropagation();


    organiserEditEventState.bannerFile =
        null;


    revokeEditEventURL(
        organiserEditEventState
            .bannerPreviewUrl
    );


    organiserEditEventState.bannerPreviewUrl =
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


    organiserEditEventState.dirty =
        true;

}


/* =========================================================
   32. RESET LIVE POSTER
   ========================================================= */

function resetEditEventLivePoster() {

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

}


/* =========================================================
   33. IMAGE VALIDATION
   ========================================================= */

function validateEditEventImage(
    file
) {

    const allowed = [

        "image/jpeg",
        "image/png",
        "image/webp"

    ];


    if (
        !allowed.includes(
            file.type
        )
    ) {

        showEditEventToast(
            "Use a PNG, JPG or WEBP image.",
            "error",
            "Unsupported Image"
        );


        return false;

    }


    if (
        file.size >
        5 *
        1024 *
        1024
    ) {

        showEditEventToast(
            "Image must be below 5 MB.",
            "error",
            "Image Too Large"
        );


        return false;

    }


    return true;

}


/* =========================================================
   34. MODALS
   ========================================================= */

function initializeEditEventModals() {

    document
        .getElementById(
            "resetEventChangesButton"
        )
        ?.addEventListener(
            "click",
            openResetEditEventModal
        );


    document
        .getElementById(
            "closeResetEventModal"
        )
        ?.addEventListener(
            "click",
            closeResetEditEventModal
        );


    document
        .getElementById(
            "continueEditingButton"
        )
        ?.addEventListener(
            "click",
            closeResetEditEventModal
        );


    document
        .getElementById(
            "confirmResetEventButton"
        )
        ?.addEventListener(
            "click",
            resetEditEventChanges
        );


    document
        .getElementById(
            "continueAfterSaveButton"
        )
        ?.addEventListener(
            "click",
            closeEditEventUpdatedModal
        );

}


/* =========================================================
   35. RESET MODAL
   ========================================================= */

function openResetEditEventModal() {

    if (
        !organiserEditEventState
            .dirty
    ) {

        showEditEventToast(
            "There are no unsaved changes.",
            "info",
            "Nothing to Reset"
        );


        return;

    }


    const modal =
        document.getElementById(
            "resetEventModal"
        );


    if (modal) {

        modal.hidden =
            false;

    }


    refreshEditEventIcons();

}


function closeResetEditEventModal() {

    const modal =
        document.getElementById(
            "resetEventModal"
        );


    if (modal) {

        modal.hidden =
            true;

    }

}


/* =========================================================
   36. RESET CHANGES
   ========================================================= */

function resetEditEventChanges() {

    const original =
        organiserEditEventState
            .originalEvent;


    if (!original) {

        return;

    }


    revokeEditEventURL(
        organiserEditEventState
            .posterPreviewUrl
    );


    revokeEditEventURL(
        organiserEditEventState
            .bannerPreviewUrl
    );


    organiserEditEventState.posterFile =
        null;


    organiserEditEventState.bannerFile =
        null;


    organiserEditEventState.posterPreviewUrl =
        null;


    organiserEditEventState.bannerPreviewUrl =
        null;


    resetEditEventUploadUI();


    populateEditEventForm(
        cloneEditEvent(
            original
        )
    );


    updateEditEventPreview();

    updateEditEventCharacterCounters();


    organiserEditEventState.dirty =
        false;


    closeResetEditEventModal();


    showEditEventToast(
        "Unsaved changes were reset.",
        "info",
        "Changes Reset"
    );


    refreshEditEventIcons();

}


/* =========================================================
   37. RESET UPLOAD UI
   ========================================================= */

function resetEditEventUploadUI() {

    [
        "eventPosterPreview",
        "eventBannerPreview"
    ]
        .forEach(
            (id) => {

                const element =
                    document.getElementById(
                        id
                    );


                if (element) {

                    element.hidden =
                        true;

                }

            }
        );


    [
        "selectEventPosterButton",
        "selectEventBannerButton"
    ]
        .forEach(
            (id) => {

                const element =
                    document.getElementById(
                        id
                    );


                if (element) {

                    element.hidden =
                        false;

                }

            }
        );


    resetEditEventLivePoster();

}


/* =========================================================
   38. UPDATED MODAL
   ========================================================= */

function openEditEventUpdatedModal() {

    const modal =
        document.getElementById(
            "eventUpdatedModal"
        );


    if (modal) {

        modal.hidden =
            false;

    }


    refreshEditEventIcons();

}


function closeEditEventUpdatedModal() {

    const modal =
        document.getElementById(
            "eventUpdatedModal"
        );


    if (modal) {

        modal.hidden =
            true;

    }

}


/* =========================================================
   39. SAVING STATE
   ========================================================= */

function setEditEventSaving(
    saving
) {

    organiserEditEventState.saving =
        Boolean(
            saving
        );


    const button =
        document.getElementById(
            "saveEventChangesButton"
        );


    const text =
        document.getElementById(
            "saveEventChangesText"
        );


    if (button) {

        button.disabled =
            saving;

    }


    if (text) {

        text.textContent =
            saving
                ? "Saving..."
                : "Save Changes";

    }

}


/* =========================================================
   40. ERRORS
   ========================================================= */

function setEditEventFieldError(
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


function clearEditEventFieldError(
    fieldId
) {

    document
        .getElementById(
            fieldId
        )
        ?.closest(
            ".organiser-input-wrapper, .organiser-select-wrapper, .organiser-textarea-wrapper"
        )
        ?.classList.remove(
            "error"
        );


    const error =
        document.getElementById(
            `${fieldId}Error`
        );


    if (error) {

        error.textContent =
            "";


        error.hidden =
            true;

    }

}


function clearAllEditEventErrors() {

    [
        "eventTitle",
        "eventType",
        "eventGenre",
        "eventDescription"
    ]
        .forEach(
            clearEditEventFieldError
        );

}


/* =========================================================
   41. SHOW WORKSPACE
   ========================================================= */

function showEditEventWorkspace() {

    const loading =
        document.getElementById(
            "editEventLoading"
        );


    const workspace =
        document.getElementById(
            "editEventWorkspace"
        );


    if (loading) {

        loading.hidden =
            true;

    }


    if (workspace) {

        workspace.hidden =
            false;

    }

}


/* =========================================================
   42. NOT FOUND
   ========================================================= */

function showEditEventNotFound() {

    const loading =
        document.getElementById(
            "editEventLoading"
        );


    const workspace =
        document.getElementById(
            "editEventWorkspace"
        );


    const notFound =
        document.getElementById(
            "editEventNotFound"
        );


    if (loading) {

        loading.hidden =
            true;

    }


    if (workspace) {

        workspace.hidden =
            true;

    }


    if (notFound) {

        notFound.hidden =
            false;

    }


    refreshEditEventIcons();

}


/* =========================================================
   43. BEFORE UNLOAD
   ========================================================= */

function initializeEditEventBeforeUnload() {

    window.addEventListener(
        "beforeunload",
        (event) => {

            if (
                !organiserEditEventState
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
   44. NORMALIZE TYPE
   ========================================================= */

function normalizeEditEventType(
    value
) {

    const type =
        String(
            value ||
            ""
        )
            .toUpperCase();


    if (
        type.includes(
            "MOVIE"
        )
    ) {

        return "MOVIE";

    }


    if (
        type.includes(
            "CONCERT"
        )
    ) {

        return "CONCERT";

    }


    if (
        type.includes(
            "LIVE"
        ) ||
        type.includes(
            "COMEDY"
        )
    ) {

        return "LIVE_SHOW";

    }


    return "CONCERT";

}


/* =========================================================
   45. NORMALIZE STATUS
   ========================================================= */

function normalizeEditEventStatus(
    value
) {

    const status =
        String(
            value ||
            "PUBLISHED"
        )
            .toUpperCase();


    return status ===
        "DRAFT"
        ? "DRAFT"
        : "PUBLISHED";

}


/* =========================================================
   46. ARRAY NORMALIZATION
   ========================================================= */

function normalizeEditEventArray(
    value
) {

    if (
        Array.isArray(
            value
        )
    ) {

        return value
            .map(
                String
            )
            .map(
                (item) =>
                    item.trim()
            )
            .filter(Boolean);

    }


    return parseEditEventCommaList(
        value
    );

}


/* =========================================================
   47. COMMA LIST
   ========================================================= */

function parseEditEventCommaList(
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
   48. FORMAT EVENT TYPE
   ========================================================= */

function formatEditEventType(
    type
) {

    switch (type) {

        case "MOVIE":

            return "MOVIE";


        case "LIVE_SHOW":

            return "LIVE SHOW";


        case "CONCERT":

            return "CONCERT";


        default:

            return "EVENT";

    }

}


/* =========================================================
   49. DATE
   ========================================================= */

function formatEditEventDateTime(
    value
) {

    if (!value) {

        return "—";

    }


    const date =
        new Date(
            value
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "—";

    }


    return new Intl.DateTimeFormat(
        "en-IN",
        {

            day:
                "2-digit",

            month:
                "short",

            year:
                "numeric",

            hour:
                "2-digit",

            minute:
                "2-digit"

        }
    ).format(
        date
    );

}


/* =========================================================
   50. INITIALS
   ========================================================= */

function createEditEventInitials(
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
   51. INPUT SET
   ========================================================= */

function setEditEventInput(
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
   52. ENSURE SELECT OPTION
   ========================================================= */

function ensureEditEventSelectOption(
    id,
    value
) {

    const select =
        document.getElementById(
            id
        );


    if (!select) {

        return;

    }


    const stringValue =
        String(
            value ||
            ""
        );


    if (!stringValue) {

        select.value =
            "";

        return;

    }


    const exists =
        Array.from(
            select.options
        )
            .some(
                (option) =>
                    option.value ===
                    stringValue
            );


    if (!exists) {

        const option =
            document.createElement(
                "option"
            );


        option.value =
            stringValue;


        option.textContent =
            stringValue;


        select.appendChild(
            option
        );

    }


    select.value =
        stringValue;

}


/* =========================================================
   53. SET TEXT
   ========================================================= */

function setEditEventText(
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
   54. CLONE
   ========================================================= */

function cloneEditEvent(
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
   55. URL CLEANUP
   ========================================================= */

function revokeEditEventURL(
    value
) {

    if (!value) {

        return;

    }


    try {

        URL.revokeObjectURL(
            value
        );

    } catch {

        /* Safe cleanup */

    }

}


/* =========================================================
   56. DELAY
   ========================================================= */

function editEventDelay(
    milliseconds
) {

    return new Promise(
        (resolve) => {

            window.setTimeout(
                resolve,
                milliseconds
            );

        }
    );

}


/* =========================================================
   57. TOAST
   ========================================================= */

function showEditEventToast(
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

function refreshEditEventIcons() {

    if (
        typeof lucide !==
        "undefined"
    ) {

        lucide.createIcons();

    }

}


/* =========================================================
   59. ESCAPE
   ========================================================= */

document.addEventListener(
    "keydown",
    (event) => {

        if (
            event.key !==
            "Escape"
        ) {

            return;

        }


        closeResetEditEventModal();

        closeEditEventUpdatedModal();

    }
);


/* =========================================================
   60. CLEANUP
   ========================================================= */

window.addEventListener(
    "unload",
    () => {

        revokeEditEventURL(
            organiserEditEventState
                .posterPreviewUrl
        );


        revokeEditEventURL(
            organiserEditEventState
                .bannerPreviewUrl
        );

    }
);


/* =========================================================
   61. PUBLIC API
   ========================================================= */

window.SKYRA_EDIT_EVENT_PAGE = {

    getEvent:
        () =>
            organiserEditEventState
                .currentEvent
                    ? cloneEditEvent(
                        organiserEditEventState
                            .currentEvent
                    )
                    : null,

    getFormData:
        getEditEventFormData,

    reset:
        resetEditEventChanges

};


/* =========================================================
   END SKYRA EDIT EVENT
   ========================================================= */