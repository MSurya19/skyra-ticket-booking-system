/* =========================================================
   SKYRA - ORGANISER CREATE SHOW
   File:
   frontend/js/organiser/create-show.js

   Phase 8 backend-connected frontend:
   - Loads PUBLISHED organiser Events from MongoDB
   - Loads ACTIVE configured Admin Venues from backend
   - Loads Venue seat categories from backend
   - Category-level ticket pricing
   - Date/time validation
   - Live show summary
   - Creates real Show records in MongoDB
   - Supports ?event=<eventId>
   - No active mock/localStorage Show fallback

   Backend routes:
   - GET  /api/organiser/events?status=PUBLISHED
   - GET  /api/organiser/shows/venues
   - GET  /api/organiser/shows/venues/:venueId
   - POST /api/organiser/shows

   ShowSeat generation remains Phase 9.
   ========================================================= */

"use strict";


/* =========================================================
   4. STATE
   ========================================================= */

const organiserCreateShowState = {

    events:
        [],

    venues:
        [],

    selectedEvent:
        null,

    selectedVenue:
        null,

    pricing:
        [],

    creating:
        false,

    dirty:
        false,

    createdShow:
        null

};


/* =========================================================
   5. DOM READY
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initializeCreateShowPage();

    }
);


/* =========================================================
   6. INITIALIZE PAGE
   ========================================================= */

async function initializeCreateShowPage() {

    initializeCreateShowUser();

    initializeCreateShowNavigation();

    initializeCreateShowSearch();

    initializeCreateShowForm();

    setCreateShowMinimumDate();


    try {

        await loadCreateShowData();


        populateCreateShowEventOptions();

        populateCreateShowVenueOptions();

        applyCreateShowURLSelection();

        updateCreateShowPreview();

        updateCreateShowFlow();

        await renderCreateShowSidebarCounts();

        refreshCreateShowIcons();

    } catch (error) {

        console.error(
            "Unable to initialize create show:",
            error
        );


        showCreateShowToast(
            "Unable to prepare show creation data.",
            "error",
            "Show Setup Error"
        );

    }

}


/* =========================================================
   7. LOAD PAGE DATA
   ========================================================= */

async function loadCreateShowData() {

    const [
        events,
        venues
    ] =
        await Promise.all([

            loadCreateShowEvents(),

            loadCreateShowVenues()

        ]);


    organiserCreateShowState.events =
        events;


    organiserCreateShowState.venues =
        venues;

}


/* =========================================================
   8. LOAD EVENTS - PHASE 8 BACKEND
   ========================================================= */

async function loadCreateShowEvents() {

    if (
        !window.SKYRA_API ||
        typeof window.SKYRA_API
            .getOrganiserEvents !==
            "function"
    ) {

        throw new Error(
            "Organiser Event API is unavailable."
        );

    }


    const response =
        await window.SKYRA_API
            .getOrganiserEvents({
                status:
                    "PUBLISHED",
                limit:
                    100
            });


    const events =
        response?.data?.events ||
        response?.events;


    if (
        !Array.isArray(
            events
        )
    ) {

        throw new Error(
            "Invalid Event API response."
        );

    }


    return events
        .map(
            normalizeCreateShowEvent
        )
        .filter(
            (event) =>
                event.status ===
                "PUBLISHED"
        );

}


/* =========================================================
   9. LOAD VENUES - PHASE 8 BACKEND
   ========================================================= */

async function loadCreateShowVenues() {

    if (
        !window.SKYRA_API ||
        typeof window.SKYRA_API
            .getOrganiserShowVenues !==
            "function"
    ) {

        throw new Error(
            "Organiser Show Venue API is unavailable."
        );

    }


    const response =
        await window.SKYRA_API
            .getOrganiserShowVenues();


    const venues =
        response?.data?.venues ||
        response?.venues;


    if (
        !Array.isArray(
            venues
        )
    ) {

        throw new Error(
            "Invalid Venue API response."
        );

    }


    return venues
        .map(
            normalizeCreateShowVenue
        )
        .filter(
            (venue) =>
                venue.categories
                    .length >
                0
        );

}


/* =========================================================
   12. NORMALIZE EVENT
   ========================================================= */

function normalizeCreateShowEvent(
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
                "Untitled Event"
            ),

        type:
            normalizeCreateShowEventType(
                raw.type ||
                raw.eventType
            ),

        genre:
            String(
                raw.genre ||
                raw.category ||
                "General"
            ),

        language:
            String(
                raw.language ||
                "Not specified"
            ),

        status:
            normalizeCreateShowEventStatus(
                raw.status
            )

    };

}


/* =========================================================
   13. NORMALIZE VENUE
   ========================================================= */

function normalizeCreateShowVenue(
    raw
) {

    const categories =
        Array.isArray(
            raw.categories
        )
            ? raw.categories
            : (
                Array.isArray(
                    raw.seatCategories
                )
                    ? raw.seatCategories
                    : []
            );


    const normalizedCategories =
        categories
            .map(
                (
                    category,
                    index
                ) => ({

                    id:
                        String(
                            category.id ||
                            category._id ||
                            category.categoryId ||
                            `category_${index}`
                        ),

                    name:
                        String(
                            category.name ||
                            category.label ||
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
                                category.totalSeats ??
                                0
                            ) ||
                            0
                        ),

                    description:
                        String(
                            category.description ||
                            ""
                        )

                })
            );


    const calculatedCapacity =
        normalizedCategories
            .reduce(
                (
                    total,
                    category
                ) =>
                    total +
                    category.capacity,
                0
            );


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
                "Unnamed Venue"
            ),

        city:
            String(
                raw.city ||
                raw.location?.city ||
                ""
            ),

        address:
            String(
                raw.address ||
                raw.location?.address ||
                ""
            ),

        capacity:
            Math.max(
                0,
                Number(
                    raw.capacity ??
                    raw.totalSeats ??
                    calculatedCapacity
                ) ||
                calculatedCapacity
            ),

        categories:
            normalizedCategories

    };

}


/* =========================================================
   14. POPULATE EVENT OPTIONS
   ========================================================= */

function populateCreateShowEventOptions() {

    const select =
        document.getElementById(
            "showEvent"
        );


    if (!select) {

        return;

    }


    select.innerHTML = `

        <option value="">
            Select an event
        </option>

    `;


    organiserCreateShowState
        .events
        .forEach(
            (event) => {

                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    event.id;


                option.textContent =
                    `${event.title} · ${
                        formatCreateShowType(
                            event.type
                        )
                    }`;


                select.appendChild(
                    option
                );

            }
        );

}


/* =========================================================
   15. POPULATE VENUE OPTIONS
   ========================================================= */

function populateCreateShowVenueOptions() {

    const select =
        document.getElementById(
            "showVenue"
        );


    if (!select) {

        return;

    }


    select.innerHTML = `

        <option value="">
            Select a venue
        </option>

    `;


    organiserCreateShowState
        .venues
        .forEach(
            (venue) => {

                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    venue.id;


                option.textContent =
                    `${venue.name} · ${
                        venue.city
                    } · ${
                        formatCreateShowNumber(
                            venue.capacity
                        )
                    } seats`;


                select.appendChild(
                    option
                );

            }
        );

}


/* =========================================================
   16. URL EVENT PRESELECTION
   ========================================================= */

function applyCreateShowURLSelection() {

    const params =
        new URLSearchParams(
            window.location.search
        );


    const eventId =
        params.get(
            "event"
        );


    if (!eventId) {

        return;

    }


    const exists =
        organiserCreateShowState
            .events
            .some(
                (event) =>
                    event.id ===
                    eventId
            );


    if (!exists) {

        return;

    }


    const select =
        document.getElementById(
            "showEvent"
        );


    if (select) {

        select.value =
            eventId;


        handleCreateShowEventSelection();

    }

}


/* =========================================================
   17. FORM INITIALIZATION
   ========================================================= */

function initializeCreateShowForm() {

    document
        .getElementById(
            "createShowForm"
        )
        ?.addEventListener(
            "submit",
            handleCreateShowSubmit
        );


    document
        .getElementById(
            "showEvent"
        )
        ?.addEventListener(
            "change",
            handleCreateShowEventSelection
        );


    document
        .getElementById(
            "showVenue"
        )
        ?.addEventListener(
            "change",
            handleCreateShowVenueSelection
        );


    [
        "showDate",
        "showTime",
        "showEntryTime",
        "bookingCloseMinutes",
        "showInstructions"
    ]
        .forEach(
            (id) => {

                const element =
                    document.getElementById(
                        id
                    );


                element?.addEventListener(
                    "input",
                    handleCreateShowGeneralChange
                );


                element?.addEventListener(
                    "change",
                    handleCreateShowGeneralChange
                );

            }
        );


    document
        .getElementById(
            "showInstructions"
        )
        ?.addEventListener(
            "input",
            updateShowInstructionCounter
        );


    document
        .getElementById(
            "createAnotherShowButton"
        )
        ?.addEventListener(
            "click",
            resetCreateShowForm
        );

}


/* =========================================================
   18. GENERAL CHANGE
   ========================================================= */

function handleCreateShowGeneralChange(
    event
) {

    organiserCreateShowState.dirty =
        true;


    clearCreateShowFieldError(
        event.target.id
    );


    updateCreateShowPreview();

    updateCreateShowFlow();

}


/* =========================================================
   19. EVENT SELECTION
   ========================================================= */

function handleCreateShowEventSelection() {

    const eventId =
        getCreateShowValue(
            "showEvent"
        );


    organiserCreateShowState.selectedEvent =
        organiserCreateShowState
            .events
            .find(
                (event) =>
                    event.id ===
                    eventId
            ) ||
        null;


    organiserCreateShowState.dirty =
        true;


    clearCreateShowFieldError(
        "showEvent"
    );


    renderSelectedCreateShowEvent();

    updateCreateShowPreview();

    updateCreateShowFlow();

}


/* =========================================================
   20. RENDER SELECTED EVENT
   ========================================================= */

function renderSelectedCreateShowEvent() {

    const card =
        document.getElementById(
            "selectedEventCard"
        );


    const event =
        organiserCreateShowState
            .selectedEvent;


    if (!card) {

        return;

    }


    if (!event) {

        card.hidden =
            true;


        return;

    }


    card.hidden =
        false;


    setCreateShowText(
        "selectedEventTitle",
        event.title
    );


    setCreateShowText(
        "selectedEventMeta",
        `${
            formatCreateShowType(
                event.type
            )
        } · ${
            event.genre
        } · ${
            event.language
        }`
    );

}


/* =========================================================
   21. VENUE SELECTION
   ========================================================= */

function handleCreateShowVenueSelection() {

    const venueId =
        getCreateShowValue(
            "showVenue"
        );


    organiserCreateShowState.selectedVenue =
        organiserCreateShowState
            .venues
            .find(
                (venue) =>
                    venue.id ===
                    venueId
            ) ||
        null;


    organiserCreateShowState.dirty =
        true;


    clearCreateShowFieldError(
        "showVenue"
    );


    renderSelectedCreateShowVenue();

    initializeShowPricingFromVenue();

    updateCreateShowPreview();

    updateCreateShowFlow();

}


/* =========================================================
   22. VENUE SUMMARY
   ========================================================= */

function renderSelectedCreateShowVenue() {

    const card =
        document.getElementById(
            "selectedVenueCard"
        );


    const venue =
        organiserCreateShowState
            .selectedVenue;


    if (!card) {

        return;

    }


    if (!venue) {

        card.hidden =
            true;


        return;

    }


    card.hidden =
        false;


    setCreateShowText(
        "selectedVenueName",
        `${
            venue.name
        }, ${
            venue.city
        }`
    );


    setCreateShowText(
        "selectedVenueAddress",
        venue.address
    );


    setCreateShowText(
        "selectedVenueCapacity",
        formatCreateShowNumber(
            venue.capacity
        )
    );

}


/* =========================================================
   23. INITIALIZE VENUE PRICING
   ========================================================= */

function initializeShowPricingFromVenue() {

    const venue =
        organiserCreateShowState
            .selectedVenue;


    organiserCreateShowState.pricing =
        venue
            ? venue.categories.map(
                (category) => ({

                    categoryId:
                        category.id,

                    name:
                        category.name,

                    capacity:
                        category.capacity,

                    description:
                        category.description,

                    price:
                        ""

                })
            )
            : [];


    renderCreateShowPricing();

}


/* =========================================================
   24. RENDER PRICING
   ========================================================= */

function renderCreateShowPricing() {

    const placeholder =
        document.getElementById(
            "pricingPlaceholder"
        );


    const wrapper =
        document.getElementById(
            "showPricingWrapper"
        );


    const list =
        document.getElementById(
            "showPricingList"
        );


    const venue =
        organiserCreateShowState
            .selectedVenue;


    if (
        !placeholder ||
        !wrapper ||
        !list
    ) {

        return;

    }


    if (
        !venue ||
        !organiserCreateShowState
            .pricing
            .length
    ) {

        placeholder.hidden =
            false;


        wrapper.hidden =
            true;


        list.innerHTML =
            "";


        updateCreateShowPricingSummary();

        return;

    }


    placeholder.hidden =
        true;


    wrapper.hidden =
        false;


    list.innerHTML =
        organiserCreateShowState
            .pricing
            .map(
                createShowPricingRowHTML
            )
            .join("");


    initializeShowPricingInputs();

    updateCreateShowPricingSummary();

    refreshCreateShowIcons();

}


/* =========================================================
   25. PRICING ROW
   ========================================================= */

function createShowPricingRowHTML(
    category
) {

    return `

        <div
            class="organiser-show-pricing-row"
            data-pricing-category="${
                escapeCreateShowAttribute(
                    category.categoryId
                )
            }"
        >


            <div class="organiser-show-pricing-category">

                <div>

                    <i data-lucide="armchair"></i>

                </div>


                <span>

                    <strong>
                        ${
                            escapeCreateShowHTML(
                                category.name
                            )
                        }
                    </strong>

                    <small>
                        ${
                            escapeCreateShowHTML(
                                category.description ||
                                "Venue seat category"
                            )
                        }
                    </small>

                </span>

            </div>



            <div class="organiser-show-pricing-capacity">

                <strong>
                    ${
                        formatCreateShowNumber(
                            category.capacity
                        )
                    }
                </strong>

                <small>
                    seats
                </small>

            </div>



            <div class="organiser-show-price-input">

                <span>
                    ₹
                </span>


                <input
                    type="number"
                    min="1"
                    max="1000000"
                    step="1"
                    inputmode="numeric"
                    placeholder="0"
                    value="${
                        escapeCreateShowAttribute(
                            category.price
                        )
                    }"
                    data-price-input="${
                        escapeCreateShowAttribute(
                            category.categoryId
                        )
                    }"
                    aria-label="${
                        escapeCreateShowAttribute(
                            category.name
                        )
                    } ticket price"
                >

            </div>



            <div class="organiser-show-pricing-availability">

                <span></span>

                Available

            </div>

        </div>

    `;

}


/* =========================================================
   26. PRICING INPUT EVENTS
   ========================================================= */

function initializeShowPricingInputs() {

    document
        .querySelectorAll(
            "[data-price-input]"
        )
        .forEach(
            (input) => {

                input.addEventListener(
                    "input",
                    () => {

                        const categoryId =
                            input.dataset
                                .priceInput;


                        const pricing =
                            organiserCreateShowState
                                .pricing
                                .find(
                                    (item) =>
                                        item.categoryId ===
                                        categoryId
                                );


                        if (pricing) {

                            pricing.price =
                                input.value;

                        }


                        organiserCreateShowState.dirty =
                            true;


                        clearCreateShowPricingError();

                        updateCreateShowPricingSummary();

                        updateCreateShowPreview();

                        updateCreateShowFlow();

                    }
                );

            }
        );

}


/* =========================================================
   27. PRICING SUMMARY
   ========================================================= */

function updateCreateShowPricingSummary() {

    const pricing =
        organiserCreateShowState
            .pricing;


    const capacity =
        pricing.reduce(
            (
                total,
                category
            ) =>
                total +
                category.capacity,
            0
        );


    const prices =
        pricing
            .map(
                (category) =>
                    Number(
                        category.price
                    )
            )
            .filter(
                (price) =>
                    Number.isFinite(
                        price
                    ) &&
                    price >
                    0
            );


    setCreateShowText(
        "pricingTotalCapacity",
        `${formatCreateShowNumber(
            capacity
        )} seats`
    );


    if (!prices.length) {

        setCreateShowText(
            "pricingPriceRange",
            "Add prices"
        );


        return;

    }


    const minimum =
        Math.min(
            ...prices
        );


    const maximum =
        Math.max(
            ...prices
        );


    setCreateShowText(
        "pricingPriceRange",
        minimum ===
            maximum
            ? formatCreateShowCurrency(
                minimum
            )
            : `${
                formatCreateShowCurrency(
                    minimum
                )
            } – ${
                formatCreateShowCurrency(
                    maximum
                )
            }`
    );

}


/* =========================================================
   28. PREVIEW
   ========================================================= */

function updateCreateShowPreview() {

    const event =
        organiserCreateShowState
            .selectedEvent;


    const venue =
        organiserCreateShowState
            .selectedVenue;


    const date =
        getCreateShowValue(
            "showDate"
        );


    const time =
        getCreateShowValue(
            "showTime"
        );


    setCreateShowText(
        "previewShowEvent",
        event?.title ||
        "Select an event"
    );


    setCreateShowText(
        "previewShowVenue",
        venue
            ? `${
                venue.name
            }, ${
                venue.city
            }`
            : "Not selected"
    );


    setCreateShowText(
        "previewShowDate",
        date
            ? formatCreateShowDate(
                date
            )
            : "Not selected"
    );


    setCreateShowText(
        "previewShowTime",
        time
            ? formatCreateShowTime(
                time
            )
            : "Not selected"
    );


    setCreateShowText(
        "previewShowCapacity",
        venue
            ? `${
                formatCreateShowNumber(
                    venue.capacity
                )
            } seats`
            : "—"
    );


    const validPrices =
        organiserCreateShowState
            .pricing
            .map(
                (item) =>
                    Number(
                        item.price
                    )
            )
            .filter(
                (price) =>
                    Number.isFinite(
                        price
                    ) &&
                    price >
                    0
            );


    if (!validPrices.length) {

        setCreateShowText(
            "previewShowPrice",
            "Add pricing"
        );

    } else {

        const minimum =
            Math.min(
                ...validPrices
            );


        const maximum =
            Math.max(
                ...validPrices
            );


        setCreateShowText(
            "previewShowPrice",
            minimum ===
                maximum
                ? formatCreateShowCurrency(
                    minimum
                )
                : `${
                    formatCreateShowCurrency(
                        minimum
                    )
                } – ${
                    formatCreateShowCurrency(
                        maximum
                    )
                }`
        );

    }

}


/* =========================================================
   29. FLOW
   ========================================================= */

function updateCreateShowFlow() {

    const eventReady =
        Boolean(
            organiserCreateShowState
                .selectedEvent
        );


    const venueReady =
        Boolean(
            organiserCreateShowState
                .selectedVenue
        ) &&
        Boolean(
            getCreateShowValue(
                "showDate"
            )
        ) &&
        Boolean(
            getCreateShowValue(
                "showTime"
            )
        );


    const pricingReady =
        organiserCreateShowState
            .pricing
            .length >
            0 &&
        organiserCreateShowState
            .pricing
            .every(
                (item) => {

                    const price =
                        Number(
                            item.price
                        );


                    return (
                        Number.isFinite(
                            price
                        ) &&
                        price >
                        0
                    );

                }
            );


    toggleCreateShowFlowStep(
        "showFlowEventStep",
        eventReady
    );


    toggleCreateShowFlowStep(
        "showFlowVenueStep",
        venueReady
    );


    toggleCreateShowFlowStep(
        "showFlowPricingStep",
        pricingReady
    );

}


/* =========================================================
   30. TOGGLE FLOW STEP
   ========================================================= */

function toggleCreateShowFlowStep(
    id,
    active
) {

    document
        .getElementById(
            id
        )
        ?.classList.toggle(
            "active",
            active
        );

}


/* =========================================================
   31. INSTRUCTION COUNTER
   ========================================================= */

function updateShowInstructionCounter() {

    const value =
        getCreateShowValue(
            "showInstructions"
        );


    setCreateShowText(
        "showInstructionsCount",
        `${value.length} / 800`
    );

}


/* =========================================================
   32. FORM DATA
   ========================================================= */

function getCreateShowFormData() {

    return {

        eventId:
            getCreateShowValue(
                "showEvent"
            ),

        venueId:
            getCreateShowValue(
                "showVenue"
            ),

        date:
            getCreateShowValue(
                "showDate"
            ),

        time:
            getCreateShowValue(
                "showTime"
            ),

        entryTime:
            getCreateShowValue(
                "showEntryTime"
            ),

        bookingCloseMinutes:
            getCreateShowValue(
                "bookingCloseMinutes"
            ),

        instructions:
            getCreateShowValue(
                "showInstructions"
            )

    };

}


/* =========================================================
   33. VALIDATION
   ========================================================= */

function validateCreateShowForm(
    data
) {

    clearAllCreateShowErrors();


    let valid =
        true;


    if (
        !organiserCreateShowState
            .selectedEvent ||
        !data.eventId
    ) {

        setCreateShowFieldError(
            "showEvent",
            "Select an event for this show."
        );


        valid =
            false;

    }


    if (
        !organiserCreateShowState
            .selectedVenue ||
        !data.venueId
    ) {

        setCreateShowFieldError(
            "showVenue",
            "Select a venue."
        );


        valid =
            false;

    }


    if (!data.date) {

        setCreateShowFieldError(
            "showDate",
            "Select a show date."
        );


        valid =
            false;

    } else if (
        isCreateShowPastDate(
            data.date
        )
    ) {

        setCreateShowFieldError(
            "showDate",
            "Show date cannot be in the past."
        );


        valid =
            false;

    }


    if (!data.time) {

        setCreateShowFieldError(
            "showTime",
            "Select the show start time."
        );


        valid =
            false;

    }


    if (
        data.date &&
        data.time &&
        isCreateShowPastDateTime(
            data.date,
            data.time
        )
    ) {

        setCreateShowFieldError(
            "showTime",
            "Show start time must be in the future."
        );


        valid =
            false;

    }


    if (
        data.entryTime &&
        data.time &&
        data.entryTime >=
            data.time
    ) {

        showCreateShowToast(
            "Entry opening time should be before the show start time.",
            "error",
            "Invalid Entry Time"
        );


        valid =
            false;

    }


    const bookingClose =
        Number(
            data.bookingCloseMinutes
        );


    if (
        data.bookingCloseMinutes &&
        (
            !Number.isFinite(
                bookingClose
            ) ||
            bookingClose <
                0 ||
            bookingClose >
                1440
        )
    ) {

        showCreateShowToast(
            "Booking close time must be between 0 and 1440 minutes.",
            "error",
            "Invalid Booking Rule"
        );


        valid =
            false;

    }


    if (
        !validateCreateShowPricing()
    ) {

        valid =
            false;

    }


    return valid;

}


/* =========================================================
   34. PRICING VALIDATION
   ========================================================= */

function validateCreateShowPricing() {

    const pricing =
        organiserCreateShowState
            .pricing;


    if (!pricing.length) {

        setCreateShowPricingError(
            "Select a venue before configuring ticket prices."
        );


        return false;

    }


    const invalid =
        pricing.find(
            (item) => {

                const price =
                    Number(
                        item.price
                    );


                return (
                    !Number.isFinite(
                        price
                    ) ||
                    price <=
                        0 ||
                    price >
                        1000000
                );

            }
        );


    if (invalid) {

        setCreateShowPricingError(
            `Enter a valid ticket price for ${
                invalid.name
            }.`
        );


        document
            .querySelector(
                `[data-price-input="${
                    CSS.escape(
                        invalid.categoryId
                    )
                }"]`
            )
            ?.focus();


        return false;

    }


    clearCreateShowPricingError();


    return true;

}


/* =========================================================
   35. SUBMIT - PHASE 8 BACKEND
   ========================================================= */

async function handleCreateShowSubmit(
    submitEvent
) {

    submitEvent.preventDefault();


    if (
        organiserCreateShowState
            .creating
    ) {

        return;

    }


    const data =
        getCreateShowFormData();


    if (
        !validateCreateShowForm(
            data
        )
    ) {

        return;

    }


    setCreateShowCreating(
        true
    );


    try {

        if (
            !window.SKYRA_API ||
            typeof window.SKYRA_API
                .createShow !==
                "function"
        ) {

            throw new Error(
                "Organiser Show API is unavailable."
            );

        }


        const payload =
            createShowPayload(
                data
            );


        const response =
            await window.SKYRA_API
                .createShow(
                    payload
                );


        const createdShow =
            response?.data?.show ||
            response?.show;


        if (
            !createdShow ||
            !(
                createdShow.id ||
                createdShow._id
            )
        ) {

            throw new Error(
                "Show API returned an invalid Show."
            );

        }


        organiserCreateShowState.createdShow =
            createdShow;

        organiserCreateShowState.dirty =
            false;


        setCreateShowText(
            "createdShowReference",
            createdShow.reference ||
            createdShow.id ||
            createdShow._id ||
            "SKY-SHOW"
        );


        await renderCreateShowSidebarCounts();


        openCreateShowSuccessModal();


        showCreateShowToast(
            "Show created successfully.",
            "success",
            "Show Scheduled"
        );

    } catch (error) {

        console.error(
            "Unable to create show:",
            error
        );


        showCreateShowToast(
            error?.message ||
            "Unable to create this show.",
            "error",
            "Show Creation Failed"
        );

    } finally {

        setCreateShowCreating(
            false
        );

    }

}


/* =========================================================
   36. PAYLOAD - SERVER-AUTHORITATIVE PHASE 8
   ========================================================= */

function createShowPayload(
    data
) {

    const event =
        organiserCreateShowState
            .selectedEvent;


    const venue =
        organiserCreateShowState
            .selectedVenue;


    if (
        !event?.id ||
        !venue?.id
    ) {

        throw new Error(
            "Select a valid Event and Venue."
        );

    }


    return {

        eventId:
            event.id,

        venueId:
            venue.id,

        date:
            data.date,

        time:
            data.time,

        entryTime:
            data.entryTime ||
            null,

        bookingCloseMinutes:
            data.bookingCloseMinutes ===
                "" ||
            data.bookingCloseMinutes ===
                null ||
            data.bookingCloseMinutes ===
                undefined
                ? 30
                : Number(
                    data.bookingCloseMinutes
                ),

        instructions:
            data.instructions ||
            "",

        /*
           Only categoryId + price are sent.

           categoryName, category capacity, total Venue
           capacity, Event title, Venue name, organiserId,
           reference, status, soldSeats and revenue are
           taken/generated by the backend.
        */
        pricing:
            organiserCreateShowState
                .pricing
                .map(
                    (category) => ({

                        categoryId:
                            category.categoryId,

                        price:
                            Number(
                                category.price
                            )

                    })
                )

    };

}


/* =========================================================
   39. SUCCESS MODAL
   ========================================================= */

function openCreateShowSuccessModal() {

    const modal =
        document.getElementById(
            "showCreatedModal"
        );


    if (modal) {

        modal.hidden =
            false;

    }


    refreshCreateShowIcons();

}


/* =========================================================
   40. RESET FORM
   ========================================================= */

function resetCreateShowForm() {

    const modal =
        document.getElementById(
            "showCreatedModal"
        );


    if (modal) {

        modal.hidden =
            true;

    }


    const form =
        document.getElementById(
            "createShowForm"
        );


    form?.reset();


    organiserCreateShowState.selectedEvent =
        null;


    organiserCreateShowState.selectedVenue =
        null;


    organiserCreateShowState.pricing =
        [];


    organiserCreateShowState.createdShow =
        null;


    organiserCreateShowState.dirty =
        false;


    renderSelectedCreateShowEvent();

    renderSelectedCreateShowVenue();

    renderCreateShowPricing();

    updateCreateShowPreview();

    updateCreateShowFlow();

    updateShowInstructionCounter();

    setCreateShowMinimumDate();


    window.scrollTo({

        top:
            0,

        behavior:
            "smooth"

    });

}


/* =========================================================
   41. USER
   ========================================================= */

function initializeCreateShowUser() {

    const sharedUser = window.SKYRA_COMMON?.getUser?.();
    const organiser =
        sharedUser && String(sharedUser.role || "").toUpperCase() === "ORGANISER"
            ? sharedUser
            : { name: "Organiser", email: "", role: "ORGANISER" };

    const name = String(organiser.name || organiser.fullName || "Organiser");
    const initials = createShowInitials(name);

    setCreateShowText("sidebarUserName", name);
    setCreateShowText("sidebarUserInitials", initials);
    setCreateShowText("topbarUserName", name);
    setCreateShowText("topbarUserInitials", initials);
    setCreateShowText("dropdownUserName", name);
    setCreateShowText("dropdownUserInitials", initials);
    setCreateShowText("dropdownUserEmail", organiser.email || "");

}


/* =========================================================
   42. ACTIVE NAVIGATION
   ========================================================= */

function initializeCreateShowNavigation() {

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
                    "./create-show.html";


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
   43. TOPBAR SEARCH
   ========================================================= */

function initializeCreateShowSearch() {

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
   44. SIDEBAR COUNTS - PHASE 8 BACKEND
   ========================================================= */

async function renderCreateShowSidebarCounts() {

    /*
       The create form itself only loads PUBLISHED Events.
       Sidebar Event count should represent all organiser
       Events, so query that independently.
    */

    let eventCount =
        organiserCreateShowState
            .events
            .length;


    let showCount =
        0;


    try {

        if (
            window.SKYRA_API &&
            typeof window.SKYRA_API
                .getOrganiserEvents ===
                "function"
        ) {

            const eventResponse =
                await window.SKYRA_API
                    .getOrganiserEvents({
                        limit:
                            100
                    });


            const events =
                eventResponse?.data?.events ||
                eventResponse?.events;


            if (
                Array.isArray(
                    events
                )
            ) {

                eventCount =
                    events.length;

            }

        }


        if (
            window.SKYRA_API &&
            typeof window.SKYRA_API
                .getOrganiserShows ===
                "function"
        ) {

            const showResponse =
                await window.SKYRA_API
                    .getOrganiserShows({
                        limit:
                            100
                    });


            const shows =
                showResponse?.data?.shows ||
                showResponse?.shows;


            if (
                Array.isArray(
                    shows
                )
            ) {

                showCount =
                    shows.length;

            }

        }

    } catch (error) {

        console.warn(
            "Unable to refresh organiser sidebar counts.",
            error
        );

    }


    setCreateShowText(
        "sidebarEventCount",
        eventCount
    );


    setCreateShowText(
        "sidebarShowCount",
        showCount
    );

}


/* =========================================================
   45. MINIMUM DATE
   ========================================================= */

function setCreateShowMinimumDate() {

    const input =
        document.getElementById(
            "showDate"
        );


    if (!input) {

        return;

    }


    const now =
        new Date();


    const year =
        now.getFullYear();


    const month =
        String(
            now.getMonth() +
            1
        ).padStart(
            2,
            "0"
        );


    const day =
        String(
            now.getDate()
        ).padStart(
            2,
            "0"
        );


    input.min =
        `${year}-${month}-${day}`;

}


/* =========================================================
   46. PAST DATE
   ========================================================= */

function isCreateShowPastDate(
    value
) {

    const selected =
        new Date(
            `${value}T00:00:00`
        );


    const today =
        new Date();


    today.setHours(
        0,
        0,
        0,
        0
    );


    return selected <
        today;

}


/* =========================================================
   47. PAST DATETIME
   ========================================================= */

function isCreateShowPastDateTime(
    date,
    time
) {

    const timestamp =
        new Date(
            `${date}T${time}:00`
        )
            .getTime();


    return (
        Number.isFinite(
            timestamp
        ) &&
        timestamp <=
        Date.now()
    );

}


/* =========================================================
   48. FIELD ERROR
   ========================================================= */

function setCreateShowFieldError(
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
            ".organiser-input-wrapper, .organiser-select-wrapper"
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
   49. CLEAR FIELD ERROR
   ========================================================= */

function clearCreateShowFieldError(
    fieldId
) {

    const field =
        document.getElementById(
            fieldId
        );


    field
        ?.closest(
            ".organiser-input-wrapper, .organiser-select-wrapper"
        )
        ?.classList.remove(
            "error"
        );


    const error =
        document.getElementById(
            `${fieldId}Error`
        );


    if (error) {

        error.hidden =
            true;


        error.textContent =
            "";

    }

}


/* =========================================================
   50. CLEAR ALL ERRORS
   ========================================================= */

function clearAllCreateShowErrors() {

    [
        "showEvent",
        "showVenue",
        "showDate",
        "showTime"
    ]
        .forEach(
            clearCreateShowFieldError
        );


    clearCreateShowPricingError();

}


/* =========================================================
   51. PRICING ERROR
   ========================================================= */

function setCreateShowPricingError(
    message
) {

    const error =
        document.getElementById(
            "showPricingError"
        );


    if (error) {

        error.textContent =
            message;


        error.hidden =
            false;

    }

}


/* =========================================================
   52. CLEAR PRICING ERROR
   ========================================================= */

function clearCreateShowPricingError() {

    const error =
        document.getElementById(
            "showPricingError"
        );


    if (error) {

        error.hidden =
            true;


        error.textContent =
            "";

    }

}


/* =========================================================
   53. CREATING STATE
   ========================================================= */

function setCreateShowCreating(
    creating
) {

    organiserCreateShowState.creating =
        Boolean(
            creating
        );


    const button =
        document.getElementById(
            "createShowButton"
        );


    const text =
        document.getElementById(
            "createShowButtonText"
        );


    if (button) {

        button.disabled =
            creating;

    }


    if (text) {

        text.textContent =
            creating
                ? "Creating..."
                : "Create Show";

    }

}


/* =========================================================
   54. NORMALIZE TYPE
   ========================================================= */

function normalizeCreateShowEventType(
    value
) {

    const type =
        String(
            value ||
            "EVENT"
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


    return "EVENT";

}


/* =========================================================
   55. NORMALIZE EVENT STATUS
   ========================================================= */

function normalizeCreateShowEventStatus(
    value
) {

    const status =
        String(
            value ||
            "PUBLISHED"
        )
            .toUpperCase();


    if (
        [
            "DRAFT",
            "UNPUBLISHED"
        ].includes(
            status
        )
    ) {

        return "DRAFT";

    }


    return "PUBLISHED";

}


/* =========================================================
   56. FORMAT TYPE
   ========================================================= */

function formatCreateShowType(
    type
) {

    switch (type) {

        case "MOVIE":

            return "Movie";


        case "CONCERT":

            return "Concert";


        case "LIVE_SHOW":

            return "Live Show";


        default:

            return "Event";

    }

}


/* =========================================================
   57. DATE FORMAT
   ========================================================= */

function formatCreateShowDate(
    value
) {

    const date =
        new Date(
            `${value}T00:00:00`
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return value;

    }


    return new Intl.DateTimeFormat(
        "en-IN",
        {

            weekday:
                "short",

            day:
                "2-digit",

            month:
                "short",

            year:
                "numeric"

        }
    ).format(
        date
    );

}


/* =========================================================
   58. TIME FORMAT
   ========================================================= */

function formatCreateShowTime(
    value
) {

    if (
        !/^\d{2}:\d{2}$/.test(
            String(
                value
            )
        )
    ) {

        return value;

    }


    const [
        hour,
        minute
    ] =
        value
            .split(":")
            .map(Number);


    const period =
        hour >=
        12
            ? "PM"
            : "AM";


    const displayHour =
        hour %
        12 ||
        12;


    return `${
        displayHour
    }:${
        String(
            minute
        ).padStart(
            2,
            "0"
        )
    } ${period}`;

}


/* =========================================================
   59. CURRENCY
   ========================================================= */

function formatCreateShowCurrency(
    value
) {

    const amount =
        Number(
            value
        );


    if (
        !Number.isFinite(
            amount
        )
    ) {

        return "₹0";

    }


    return new Intl.NumberFormat(
        "en-IN",
        {

            style:
                "currency",

            currency:
                "INR",

            maximumFractionDigits:
                0

        }
    ).format(
        amount
    );

}


/* =========================================================
   60. NUMBER
   ========================================================= */

function formatCreateShowNumber(
    value
) {

    const number =
        Number(
            value
        );


    if (
        !Number.isFinite(
            number
        )
    ) {

        return "0";

    }


    return new Intl.NumberFormat(
        "en-IN"
    ).format(
        number
    );

}


/* =========================================================
   61. GET VALUE
   ========================================================= */

function getCreateShowValue(
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
   62. TEXT SETTER
   ========================================================= */

function setCreateShowText(
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
   63. INITIALS
   ========================================================= */

function createShowInitials(
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
   64. ESCAPE HTML
   ========================================================= */

function escapeCreateShowHTML(
    value
) {

    return String(
        value ??
        ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


/* =========================================================
   65. ESCAPE ATTRIBUTE
   ========================================================= */

function escapeCreateShowAttribute(
    value
) {

    return escapeCreateShowHTML(
        value
    );

}


/* =========================================================
   66. TOAST
   ========================================================= */

function showCreateShowToast(
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
   67. ICONS
   ========================================================= */

function refreshCreateShowIcons() {

    if (
        typeof lucide !==
        "undefined"
    ) {

        lucide.createIcons();

    }

}


/* =========================================================
   68. BEFORE UNLOAD
   ========================================================= */

window.addEventListener(
    "beforeunload",
    (event) => {

        if (
            !organiserCreateShowState
                .dirty
        ) {

            return;

        }


        event.preventDefault();

        event.returnValue =
            "";

    }
);


/* =========================================================
   69. PUBLIC API
   ========================================================= */

window.SKYRA_CREATE_SHOW_PAGE = {

    getEvents:
        () =>
            organiserCreateShowState
                .events
                .map(
                    (event) => ({
                        ...event
                    })
                ),

    getVenues:
        () =>
            organiserCreateShowState
                .venues
                .map(
                    (venue) => ({
                        ...venue,

                        categories:
                            venue.categories.map(
                                (category) => ({
                                    ...category
                                })
                            )

                    })
                ),

    getPricing:
        () =>
            organiserCreateShowState
                .pricing
                .map(
                    (pricing) => ({
                        ...pricing
                    })
                ),

    getCreatedShow:
        () =>
            organiserCreateShowState
                .createdShow
                    ? {
                        ...organiserCreateShowState
                            .createdShow
                    }
                    : null

};


/* =========================================================
   END SKYRA CREATE SHOW
   ========================================================= */