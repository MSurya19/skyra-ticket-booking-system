/* =========================================================
   SKYRA - CUSTOMER SEAT SELECTION
   File:
   frontend/js/customer/seat-selection.js

   Used by:
   - customer/seat-selection.html

   Depends on:
   - ../common.js

   Phase 11:
   - GET real customer Show / Event / ShowSeat data
   - POST real SeatHold request
   - Backend is the source of truth
   - Server-controlled expiry
   - HTTP 409 seat conflicts trigger a fresh seat-map read
   - Phase 19 Socket.IO provides immediate seat-state updates
   - Polling is retained only as a disconnected fallback
   ========================================================= */

"use strict";


/* =========================================================
   1. CONSTANTS
   ========================================================= */

const SKYRA_SEAT_SELECTION = {

    MAX_SEATS: 6,

    HOLD_MINUTES: 10,

    STORAGE_KEYS: {

        ACTIVE_HOLD:
            "skyra_active_seat_hold"

    }

};


/* =========================================================
   2. PAGE STATE
   ========================================================= */

const skyraSeatState = {

    showId:
        null,

    show:
        null,

    event:
        null,

    venue:
        null,

    seats:
        [],

    selectedSeatIds:
        [],

    selectedCategory:
        "ALL",

    hold:
        null,

    holdInterval:
        null,

    refreshInterval:
        null,

    realtimeSocket:
        null,

    realtimeConnected:
        false,

    realtimeJoinedShowId:
        null,

    realtimeHandlersBound:
        false,

    holdingSeats:
        false

};


/* =========================================================
   3. DOM READY
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initializeSeatSelectionPage();

    }
);


/* =========================================================
   4. INITIALIZE PAGE
   ========================================================= */

async function initializeSeatSelectionPage() {

    if (
        !window.SKYRA_API ||
        typeof window.SKYRA_API
            .getCustomerShow !==
            "function" ||
        typeof window.SKYRA_API
            .getCustomerShowSeats !==
            "function" ||
        typeof window.SKYRA_API
            .getCustomerEvent !==
            "function" ||
        typeof window.SKYRA_API
            .createSeatHold !==
            "function"
    ) {

        showSeatSelectionNotFound(
            "Seat APIs are unavailable. Update common.js and refresh."
        );

        return;

    }


    initializeSeatSelectionUser();

    updateSeatSelectionIndicators();

    initializeSeatSelectionSearch();

    initializeSeatModals();

    initializeSeatCategoryFilter();

    initializeHoldButton();

    initializeRealtimeSeatListeners();


    const params =
        new URLSearchParams(
            window.location.search
        );


    const showId =
        String(
            params.get("show") ||
            ""
        ).trim();


    if (!showId) {

        showSeatSelectionNotFound(
            "No Show was selected. Return to the Show page and choose a time."
        );

        return;

    }


    await loadSeatSelectionShow(
        showId
    );


    refreshSeatSelectionIcons();

}


/* =========================================================
   5. LOAD SHOW
   ========================================================= */

async function loadSeatSelectionShow(
    showId
) {

    try {

        const [
            showResponse,
            seatsResponse
        ] =
            await Promise.all([

                window.SKYRA_API
                    .getCustomerShow(
                        showId
                    ),

                window.SKYRA_API
                    .getCustomerShowSeats(
                        showId
                    )

            ]);


        const rawShow =
            showResponse?.data?.show ||
            seatsResponse?.data?.show ||
            null;


        if (!rawShow) {

            throw new Error(
                "The selected Show could not be found."
            );

        }


        const show =
            normalizeSeatSelectionShow(
                rawShow
            );


        const eventResponse =
            await window.SKYRA_API
                .getCustomerEvent(
                    show.eventId
                );


        const rawEvent =
            eventResponse?.data?.event ||
            null;


        if (!rawEvent) {

            throw new Error(
                "The Event connected to this Show could not be found."
            );

        }


        const event = {

            ...rawEvent,

            id:
                String(
                    rawEvent._id ||
                    rawEvent.id ||
                    show.eventId
                ),

            _id:
                String(
                    rawEvent._id ||
                    rawEvent.id ||
                    show.eventId
                )

        };


        const venue =
            show.venue ||
            {
                id:
                    show.venueId,

                _id:
                    show.venueId,

                name:
                    show.venueName ||
                    "Venue",

                shortName:
                    show.venueName ||
                    "Venue",

                city:
                    show.venueCity ||
                    ""
            };


        const rawSeats =
            Array.isArray(
                seatsResponse?.data?.seats
            )
                ? seatsResponse.data.seats
                : [];


        skyraSeatState.showId =
            show.id;


        skyraSeatState.show =
            show;


        skyraSeatState.event =
            event;


        skyraSeatState.venue =
            venue;


        skyraSeatState.seats =
            rawSeats.map(
                (seat) =>
                    normalizeSeatRecord(
                        seat,
                        show
                    )
            );


        skyraSeatState.selectedSeatIds =
            [];


        hideSeatSelectionNotFound();

        renderSeatShowSummary();

        renderSeatCategoryFilter();

        renderSeatCategoryPrices();

        updateSeatSelectionNavigation();

        updateSeatSelectionDocumentTitle();

        renderSeatMap();

        renderSelectedSeatSummary();


        const redirected =
            await restoreExistingSeatHold();


        if (!redirected) {

            const realtimeReady =
                await connectRealtimeSeatUpdates();


            if (!realtimeReady) {

                startSeatAvailabilityPolling();

            }

        }


        keepSeatExploreNavigationActive();

    } catch (error) {

        console.error(
            "Unable to load seat selection:",
            error
        );


        showSeatSelectionNotFound(
            error?.message ||
            "The selected Show or its seats could not be loaded."
        );

    }

}


/* =========================================================
   5.1 NORMALIZE CUSTOMER SHOW
   ========================================================= */

function normalizeSeatSelectionShow(
    rawShow
) {

    const id =
        String(
            rawShow?._id ||
            rawShow?.id ||
            ""
        );


    return {

        ...rawShow,

        id,

        _id:
            id,

        eventId:
            String(
                rawShow?.eventId ||
                ""
            ),

        venueId:
            String(
                rawShow?.venueId ||
                rawShow?.venue?._id ||
                rawShow?.venue?.id ||
                ""
            ),

        seatCategories:
            Array.isArray(
                rawShow?.seatCategories
            )
                ? rawShow.seatCategories
                : [],

        venue:
            rawShow?.venue ||
            {
                id:
                    String(
                        rawShow?.venueId ||
                        ""
                    ),

                _id:
                    String(
                        rawShow?.venueId ||
                        ""
                    ),

                name:
                    rawShow?.venueName ||
                    "Venue",

                shortName:
                    rawShow?.venueName ||
                    "Venue",

                city:
                    rawShow?.venueCity ||
                    ""
            }

    };

}


/* =========================================================
   6. LOAD SEATS - PHASE 11 BACKEND
   ========================================================= */

async function loadSeatsForShow(
    show
) {

    const response =
        await window.SKYRA_API
            .getCustomerShowSeats(
                show.id
            );


    const seats =
        response?.data?.seats;


    if (
        !Array.isArray(
            seats
        )
    ) {

        throw new Error(
            "The ShowSeat API returned an invalid response."
        );

    }


    return seats.map(
        (seat) =>
            normalizeSeatRecord(
                seat,
                show
            )
    );

}





/* =========================================================
   9. NORMALIZE SEAT RECORD

   Supports several likely backend/mock field shapes.
   ========================================================= */

function normalizeSeatRecord(
    rawSeat,
    show
) {

    const seatObject =
        rawSeat?.seat ||
        {};


    const rawLabel =
        rawSeat?.label ||
        rawSeat?.seatLabel ||
        seatObject?.label ||
        "";


    const parsedLabel =
        parseSeatLabel(
            rawLabel
        );


    const row =
        String(
            rawSeat?.row ||
            rawSeat?.rowLabel ||
            seatObject?.row ||
            parsedLabel.row ||
            "A"
        ).toUpperCase();


    const number =
        Number(
            rawSeat?.number ||
            rawSeat?.seatNumber ||
            seatObject?.number ||
            parsedLabel.number ||
            1
        );


    const label =
        rawLabel ||
        `${row}${number}`;


    const category =
        rawSeat?.category ||
        rawSeat?.categoryName ||
        rawSeat?.seatCategory ||
        seatObject?.category ||
        getDefaultSeatCategory(
            show
        );


    const price =
        Number(
            rawSeat?.price ??
            findSeatCategoryPrice(
                show,
                category
            ) ??
            0
        );


    return {

        id:
            String(
                rawSeat?.id ||
                rawSeat?._id ||
                rawSeat?.showSeatId ||
                `${show.id}_${label}`
            ),

        physicalSeatId:
            String(
                rawSeat?.physicalSeatId ||
                rawSeat?.seatId ||
                seatObject?.id ||
                seatObject?._id ||
                label
            ),

        showId:
            show.id,

        row,

        number,

        label,

        category:
            String(
                category ||
                "Standard"
            ),

        price,

        status:
            normalizeSeatStatus(
                rawSeat?.status
            ),

        holdExpiresAt:
            rawSeat?.holdExpiresAt ||
            null,

        offerExpiresAt:
            rawSeat?.offerExpiresAt ||
            null

    };

}


/* =========================================================
   10. PARSE SEAT LABEL
   ========================================================= */

function parseSeatLabel(
    label
) {

    const match =
        String(label || "")
            .toUpperCase()
            .match(
                /^([A-Z]+)[-\s]?(\d+)$/
            );


    if (!match) {

        return {

            row:
                null,

            number:
                null

        };

    }


    return {

        row:
            match[1],

        number:
            Number(
                match[2]
            )

    };

}


/* =========================================================
   11. NORMALIZE STATUS
   ========================================================= */

function normalizeSeatStatus(
    status
) {

    const value =
        String(
            status ||
            "AVAILABLE"
        )
            .trim()
            .toUpperCase();


    if (
        [
            "AVAILABLE",
            "HELD",
            "BOOKED",
            "OFFERED"
        ].includes(
            value
        )
    ) {

        return value;

    }


    return "AVAILABLE";

}


/* =========================================================
   12. DEFAULT CATEGORY
   ========================================================= */

function getDefaultSeatCategory(
    show
) {

    return (
        show?.seatCategories?.[0]
            ?.name ||
        "Standard"
    );

}


/* =========================================================
   13. CATEGORY PRICE
   ========================================================= */

function findSeatCategoryPrice(
    show,
    categoryName
) {

    const category =
        show?.seatCategories
            ?.find(
                (item) =>
                    String(
                        item.name
                    ).toLowerCase() ===
                    String(
                        categoryName
                    ).toLowerCase()
            );


    return category?.price ??
        null;

}


/* =========================================================
   14. USER INFORMATION
   ========================================================= */

function initializeSeatSelectionUser() {

    const storedUser =
        window.SKYRA_COMMON
            ?.getUser?.();


    const user =
        storedUser;


    if (!user) {
        return;
    }


    const name =
        String(
            user.name ||
            user.fullName ||
            "Customer"
        ).trim();


    const email =
        String(
            user.email ||
            ""
        ).trim();


    const initials =
        window.SKYRA_COMMON
            ?.createInitials
            ? window.SKYRA_COMMON
                .createInitials(
                    name
                )
            : createSeatUserInitials(
                name
            );


    setSeatText(
        "sidebarUserName",
        name
    );


    setSeatText(
        "sidebarUserInitials",
        initials
    );


    setSeatText(
        "topbarUserName",
        name
    );


    setSeatText(
        "topbarUserInitials",
        initials
    );


    setSeatText(
        "dropdownUserName",
        name
    );


    setSeatText(
        "dropdownUserInitials",
        initials
    );


    if (email) {

        setSeatText(
            "dropdownUserEmail",
            email
        );

    }

}


/* =========================================================
   15. INITIALS FALLBACK
   ========================================================= */

function createSeatUserInitials(
    name
) {

    const parts =
        String(name || "")
            .trim()
            .split(/\s+/)
            .filter(Boolean);


    if (!parts.length) {

        return "SK";

    }


    if (parts.length === 1) {

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
            parts.length - 1
        ][0]
    ).toUpperCase();

}


/* =========================================================
   16. ACCOUNT INDICATORS
   ========================================================= */

function updateSeatSelectionIndicators() {

    /*
       Waitlist and Notification APIs are later phases.
       Phase 11 does not display mock counts.
    */

    setSeatText(
        "sidebarWaitlistCount",
        0
    );


    const notificationBadge =
        document.getElementById(
            "sidebarNotificationCount"
        );


    const notificationDot =
        document.getElementById(
            "topbarNotificationDot"
        );


    if (notificationBadge) {

        notificationBadge.textContent =
            "0";

        notificationBadge.hidden =
            true;

    }


    if (notificationDot) {

        notificationDot.hidden =
            true;

    }

}


/* =========================================================
   17. SHOW SUMMARY
   ========================================================= */

function renderSeatShowSummary() {

    const {
        event,
        show,
        venue
    } =
        skyraSeatState;


    if (
        !event ||
        !show
    ) {
        return;
    }


    setSeatText(
        "seatShowEventTitle",
        event.title
    );


    setSeatText(
        "seatShowDate",
        formatSeatDate(
            show.date
        )
    );


    setSeatText(
        "seatShowTime",
        formatSeatTime(
            show.time
        )
    );


    setSeatText(

        "seatShowVenue",

        venue
            ? `${
                venue.shortName ||
                venue.name
            }${
                venue.city
                    ? `, ${venue.city}`
                    : ""
            }`
            : "Venue TBA"

    );


    renderSeatShowType();

    renderSeatShowPoster();

}


/* =========================================================
   18. SHOW TYPE
   ========================================================= */

function renderSeatShowType() {

    const event =
        skyraSeatState.event;


    const element =
        document.getElementById(
            "seatShowType"
        );


    if (
        !event ||
        !element
    ) {
        return;
    }


    element.innerHTML = `

        <i
            data-lucide="${getSeatEventIcon(
                event.type
            )}"
        ></i>

        ${escapeSeatHTML(
            formatSeatEventType(
                event.type
            )
        )}

    `;


    refreshSeatSelectionIcons();

}


/* =========================================================
   19. SHOW POSTER
   ========================================================= */

function renderSeatShowPoster() {

    const event =
        skyraSeatState.event;


    const poster =
        document.getElementById(
            "seatShowPoster"
        );


    const content =
        document.getElementById(
            "seatShowPosterContent"
        );


    if (
        !event ||
        !poster ||
        !content
    ) {
        return;
    }


    poster.classList.remove(
        "events-poster-coldplay",
        "events-poster-diljit",
        "events-poster-interstellar",
        "events-poster-arijit",
        "events-poster-comedy",
        "events-poster-avengers"
    );


    poster.classList.add(
        getSeatPosterClass(
            event.id
        )
    );


    content.innerHTML =
        getSeatPosterContent(
            event
        );

}


/* =========================================================
   20. POSTER CLASS
   ========================================================= */

function getSeatPosterClass(
    eventId
) {

    const map = {

        coldplay:
            "events-poster-coldplay",

        diljit:
            "events-poster-diljit",

        interstellar:
            "events-poster-interstellar",

        arijit:
            "events-poster-arijit",

        "comedy-night":
            "events-poster-comedy",

        "avengers-secret-wars":
            "events-poster-avengers"

    };


    return (
        map[eventId] ||
        "events-poster-coldplay"
    );

}


/* =========================================================
   21. POSTER CONTENT
   ========================================================= */

function getSeatPosterContent(
    event
) {

    switch (event.id) {

        case "coldplay":

            return `

                <small>
                    MUSIC OF THE SPHERES
                </small>

                <strong>
                    COLDPLAY
                </strong>

                <span>
                    LIVE 2026
                </span>

            `;


        case "diljit":

            return `

                <small>
                    INDIA TOUR
                </small>

                <strong>
                    DILJIT
                </strong>

                <span>
                    DOSANJH
                </span>

            `;


        case "interstellar":

            return `

                <small>
                    IMAX EXPERIENCE
                </small>

                <strong>
                    INTERSTELLAR
                </strong>

                <span>
                    SCIENCE BEYOND TIME
                </span>

            `;


        case "arijit":

            return `

                <small>
                    LIVE IN CONCERT
                </small>

                <strong>
                    ARIJIT
                </strong>

                <span>
                    SINGH
                </span>

            `;


        case "comedy-night":

            return `

                <small>
                    LIVE COMEDY
                </small>

                <strong>
                    COMEDY
                </strong>

                <span>
                    NIGHT
                </span>

            `;


        case "avengers-secret-wars":

            return `

                <small>
                    MARVEL STUDIOS
                </small>

                <strong>
                    AVENGERS
                </strong>

                <span>
                    SECRET WARS
                </span>

            `;


        default:

            return `

                <small>
                    SKYRA EXPERIENCE
                </small>

                <strong>
                    ${escapeSeatHTML(
                        event.title
                    )}
                </strong>

            `;

    }

}


/* =========================================================
   22. CATEGORY FILTER INITIALIZATION
   ========================================================= */

function initializeSeatCategoryFilter() {

    const select =
        document.getElementById(
            "seatCategoryFilter"
        );


    select?.addEventListener(
        "change",
        () => {

            skyraSeatState.selectedCategory =
                select.value;


            renderSeatMap();

            updateSeatZoneHeading();

        }
    );

}


/* =========================================================
   23. RENDER CATEGORY FILTER
   ========================================================= */

function renderSeatCategoryFilter() {

    const show =
        skyraSeatState.show;


    const select =
        document.getElementById(
            "seatCategoryFilter"
        );


    if (
        !show ||
        !select
    ) {
        return;
    }


    const categories =
        show.seatCategories ||
        [];


    select.innerHTML = `

        <option value="ALL">
            All Categories
        </option>

        ${
            categories
                .map(
                    (category) => `

                        <option
                            value="${escapeSeatAttribute(
                                category.name
                            )}"
                        >
                            ${escapeSeatHTML(
                                category.name
                            )}
                        </option>

                    `
                )
                .join("")
        }

    `;


    select.value =
        skyraSeatState
            .selectedCategory;

}


/* =========================================================
   24. CATEGORY PRICES
   ========================================================= */

function renderSeatCategoryPrices() {

    const show =
        skyraSeatState.show;


    const container =
        document.getElementById(
            "seatCategoryPriceList"
        );


    if (
        !show ||
        !container
    ) {
        return;
    }


    const categories =
        show.seatCategories ||
        [];


    if (!categories.length) {

        container.innerHTML = `

            <div
                class="seat-category-price-row"
            >

                <span
                    class="seat-category-dot general"
                ></span>

                <div>

                    <strong>
                        Standard
                    </strong>

                    <small>
                        Ticket category
                    </small>

                </div>

                <strong>
                    TBA
                </strong>

            </div>

        `;


        return;

    }


    container.innerHTML =
        categories
            .map(
                (
                    category,
                    index
                ) => {

                    const visual =
                        getSeatCategoryVisual(
                            category.name,
                            index
                        );


                    return `

                        <div
                            class="seat-category-price-row"
                        >

                            <span
                                class="
                                    seat-category-dot
                                    ${visual}
                                "
                            ></span>

                            <div>

                                <strong>
                                    ${escapeSeatHTML(
                                        category.name
                                    )}
                                </strong>

                                <small>
                                    ${escapeSeatHTML(
                                        getSeatCategoryDescription(
                                            category.name
                                        )
                                    )}
                                </small>

                            </div>

                            <strong>
                                ${escapeSeatHTML(
                                    formatSeatCurrency(
                                        category.price
                                    )
                                )}
                            </strong>

                        </div>

                    `;

                }
            )
            .join("");

}


/* =========================================================
   25. CATEGORY VISUAL
   ========================================================= */

function getSeatCategoryVisual(
    name,
    index = 0
) {

    const value =
        String(
            name ||
            ""
        ).toLowerCase();


    if (
        value.includes(
            "recliner"
        ) ||
        value.includes(
            "vip"
        ) ||
        value.includes(
            "fan"
        )
    ) {

        return "recliner";

    }


    if (
        value.includes(
            "prime"
        ) ||
        value.includes(
            "premium"
        ) ||
        value.includes(
            "gold"
        )
    ) {

        return "prime";

    }


    if (
        index === 2
    ) {

        return "recliner";

    }


    return "classic";

}


/* =========================================================
   26. CATEGORY DESCRIPTION
   ========================================================= */

function getSeatCategoryDescription(
    name
) {

    const value =
        String(
            name ||
            ""
        ).toLowerCase();


    if (
        value.includes(
            "recliner"
        )
    ) {

        return "Premium reclining seat";

    }


    if (
        value.includes(
            "vip"
        ) ||
        value.includes(
            "fan"
        )
    ) {

        return "Premium event section";

    }


    if (
        value.includes(
            "prime"
        ) ||
        value.includes(
            "premium"
        ) ||
        value.includes(
            "gold"
        )
    ) {

        return "Enhanced viewing experience";

    }


    return "Standard seating";

}


/* =========================================================
   27. RENDER SEAT MAP
   ========================================================= */

function renderSeatMap() {

    const container =
        document.getElementById(
            "seatRows"
        );


    if (!container) {
        return;
    }


    const filteredSeats =
        getFilteredSeatMapSeats();


    if (!filteredSeats.length) {

        container.innerHTML = `

            <div class="seat-map-empty">

                <div
                    class="seat-map-empty-icon"
                >

                    <i
                        data-lucide="armchair"
                    ></i>

                </div>

                <h3>
                    No seats in this category
                </h3>

                <p>
                    Choose another seat category to
                    view available seats.
                </p>

            </div>

        `;


        updateSeatZoneHeading();

        refreshSeatSelectionIcons();

        return;

    }


    const rows =
        groupSeatsByRow(
            filteredSeats
        );


    container.innerHTML =
        Object.keys(rows)
            .sort(
                naturalSeatCompare
            )
            .map(
                (row) =>
                    createSeatRowHTML(
                        row,
                        rows[row]
                    )
            )
            .join("");


    initializeSeatButtons();

    updateSeatZoneHeading();

    updateSeatMapTimestamp();

    refreshSeatSelectionIcons();

}


/* =========================================================
   28. FILTER SEATS
   ========================================================= */

function getFilteredSeatMapSeats() {

    if (
        skyraSeatState.selectedCategory ===
        "ALL"
    ) {

        return [
            ...skyraSeatState.seats
        ];

    }


    return skyraSeatState.seats
        .filter(
            (seat) =>
                seat.category ===
                skyraSeatState
                    .selectedCategory
        );

}


/* =========================================================
   29. GROUP BY ROW
   ========================================================= */

function groupSeatsByRow(
    seats
) {

    return seats.reduce(
        (
            groups,
            seat
        ) => {

            if (!groups[seat.row]) {

                groups[seat.row] =
                    [];

            }


            groups[seat.row].push(
                seat
            );


            groups[seat.row].sort(
                (first, second) =>
                    first.number -
                    second.number
            );


            return groups;

        },
        {}
    );

}


/* =========================================================
   30. CREATE SEAT ROW
   ========================================================= */

function createSeatRowHTML(
    row,
    seats
) {

    const middleIndex =
        Math.ceil(
            seats.length / 2
        );


    const seatHTML =
        seats
            .map(
                (
                    seat,
                    index
                ) => {

                    const aisle =
                        index ===
                            middleIndex
                            ? `<span class="seat-aisle"></span>`
                            : "";


                    return `

                        ${aisle}

                        ${createVenueSeatHTML(
                            seat
                        )}

                    `;

                }
            )
            .join("");


    return `

        <div
            class="seat-row"
            data-row="${escapeSeatAttribute(
                row
            )}"
        >

            <span class="seat-row-label">
                ${escapeSeatHTML(
                    row
                )}
            </span>


            <div class="seat-row-seats">

                ${seatHTML}

            </div>


            <span
                class="seat-row-label right"
            >
                ${escapeSeatHTML(
                    row
                )}
            </span>

        </div>

    `;

}


/* =========================================================
   31. CREATE SEAT BUTTON
   ========================================================= */

function createVenueSeatHTML(
    seat
) {

    const selected =
        skyraSeatState
            .selectedSeatIds
            .includes(
                seat.id
            );


    const state =
        selected
            ? "selected"
            : seat.status
                .toLowerCase();


    const disabled =
        !selected &&
        seat.status !==
            "AVAILABLE";


    return `

        <button
            type="button"
            class="
                venue-seat
                ${state}
            "
            data-seat-id="${escapeSeatAttribute(
                seat.id
            )}"
            data-category="${escapeSeatAttribute(
                seat.category
            )}"
            aria-label="${escapeSeatAttribute(
                `Seat ${seat.label}, ${seat.category}, ${
                    selected
                        ? "selected"
                        : formatSeatStatus(
                            seat.status
                        )
                }, ${formatSeatCurrency(
                    seat.price
                )}`
            )}"
            aria-pressed="${
                selected
                    ? "true"
                    : "false"
            }"
            ${
                disabled
                    ? "disabled"
                    : ""
            }
            title="${escapeSeatAttribute(
                `${seat.label} • ${seat.category} • ${formatSeatCurrency(
                    seat.price
                )}`
            )}"
        >
            ${escapeSeatHTML(
                seat.number
            )}
        </button>

    `;

}


/* =========================================================
   32. INITIALIZE SEAT BUTTONS
   ========================================================= */

function initializeSeatButtons() {

    document
        .querySelectorAll(
            ".venue-seat"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    () => {

                        const seatId =
                            button.dataset
                                .seatId;


                        handleSeatClick(
                            seatId
                        );

                    }
                );

            }
        );

}


/* =========================================================
   33. HANDLE SEAT CLICK
   ========================================================= */

function handleSeatClick(
    seatId
) {

    if (
        skyraSeatState.holdingSeats
    ) {

        return;

    }


    const seat =
        getSeatById(
            seatId
        );


    if (!seat) {
        return;
    }


    const currentlySelected =
        skyraSeatState
            .selectedSeatIds
            .includes(
                seat.id
            );


    /*
       Selected seats can always be deselected.
    */

    if (currentlySelected) {

        removeSelectedSeat(
            seat.id
        );


        return;

    }


    /*
       Only AVAILABLE seats can be newly selected.
    */

    if (
        seat.status !==
        "AVAILABLE"
    ) {

        showSeatConflictModal(
            `Seat ${seat.label} is no longer available. Please choose another seat.`
        );


        return;

    }


    if (
        skyraSeatState
            .selectedSeatIds
            .length >=
        SKYRA_SEAT_SELECTION.MAX_SEATS
    ) {

        openSeatLimitModal();

        return;

    }


    skyraSeatState
        .selectedSeatIds
        .push(
            seat.id
        );


    updateSingleSeatButton(
        seat
    );


    renderSelectedSeatSummary();

}


/* =========================================================
   34. REMOVE SELECTED SEAT
   ========================================================= */

function removeSelectedSeat(
    seatId
) {

    skyraSeatState
        .selectedSeatIds =
        skyraSeatState
            .selectedSeatIds
            .filter(
                (id) =>
                    id !==
                    seatId
            );


    const seat =
        getSeatById(
            seatId
        );


    if (seat) {

        updateSingleSeatButton(
            seat
        );

    }


    renderSelectedSeatSummary();

}


/* =========================================================
   35. GET SEAT BY ID
   ========================================================= */

function getSeatById(
    seatId
) {

    return skyraSeatState
        .seats
        .find(
            (seat) =>
                seat.id ===
                seatId
        ) ||
        null;

}


/* =========================================================
   36. UPDATE SINGLE BUTTON
   ========================================================= */

function updateSingleSeatButton(
    seat
) {

    const buttons =
        document.querySelectorAll(
            ".venue-seat"
        );


    const button =
        [...buttons].find(
            (item) =>
                item.dataset
                    .seatId ===
                seat.id
        );


    if (!button) {
        return;
    }


    const selected =
        skyraSeatState
            .selectedSeatIds
            .includes(
                seat.id
            );


    button.classList.remove(
        "available",
        "selected",
        "held",
        "booked",
        "offered"
    );


    button.classList.add(
        selected
            ? "selected"
            : seat.status
                .toLowerCase()
    );


    button.disabled =
        !selected &&
        seat.status !==
            "AVAILABLE";


    button.setAttribute(
        "aria-pressed",
        String(selected)
    );


    button.setAttribute(
        "aria-label",
        `Seat ${seat.label}, ${seat.category}, ${
            selected
                ? "selected"
                : formatSeatStatus(
                    seat.status
                )
        }, ${formatSeatCurrency(
            seat.price
        )}`
    );

}


/* =========================================================
   37. SELECTED SEAT SUMMARY
   ========================================================= */

function renderSelectedSeatSummary() {

    const selectedSeats =
        getSelectedSeats();


    const count =
        selectedSeats.length;


    setSeatText(
        "selectedSeatCount",
        count
    );


    const empty =
        document.getElementById(
            "selectedSeatsEmpty"
        );


    const list =
        document.getElementById(
            "selectedSeatList"
        );


    if (empty) {

        empty.hidden =
            count > 0;

    }


    if (list) {

        list.hidden =
            count === 0;


        list.innerHTML =
            selectedSeats
                .map(
                    (seat) =>
                        createSelectedSeatItem(
                            seat
                        )
                )
                .join("");


        list
            .querySelectorAll(
                "[data-remove-seat]"
            )
            .forEach(
                (button) => {

                    button.addEventListener(
                        "click",
                        () => {

                            removeSelectedSeat(
                                button.dataset
                                    .removeSeat
                            );

                        }
                    );

                }
            );

    }


    const subtotal =
        selectedSeats.reduce(
            (
                total,
                seat
            ) =>
                total +
                Number(
                    seat.price ||
                    0
                ),
            0
        );


    setSeatText(
        "seatSubtotal",
        formatSeatCurrency(
            subtotal
        )
    );


    setSeatText(
        "seatTotal",
        formatSeatCurrency(
            subtotal
        )
    );


    updateHoldSeatsButton(
        count
    );


    refreshSeatSelectionIcons();

}


/* =========================================================
   38. SELECTED SEATS
   ========================================================= */

function getSelectedSeats() {

    return skyraSeatState
        .selectedSeatIds
        .map(
            (id) =>
                getSeatById(
                    id
                )
        )
        .filter(Boolean);

}


/* =========================================================
   39. SELECTED ITEM
   ========================================================= */

function createSelectedSeatItem(
    seat
) {

    return `

        <div class="selected-seat-item">

            <span
                class="selected-seat-symbol"
            >
                ${escapeSeatHTML(
                    seat.label
                )}
            </span>


            <div
                class="selected-seat-details"
            >

                <strong>
                    Seat ${escapeSeatHTML(
                        seat.label
                    )}
                </strong>

                <small>
                    ${escapeSeatHTML(
                        seat.category
                    )}
                </small>

            </div>


            <span
                class="selected-seat-price"
            >
                ${escapeSeatHTML(
                    formatSeatCurrency(
                        seat.price
                    )
                )}
            </span>


            <button
                type="button"
                class="selected-seat-remove"
                data-remove-seat="${escapeSeatAttribute(
                    seat.id
                )}"
                aria-label="Remove seat ${escapeSeatAttribute(
                    seat.label
                )}"
            >

                <i data-lucide="x"></i>

            </button>

        </div>

    `;

}


/* =========================================================
   40. UPDATE HOLD BUTTON
   ========================================================= */

function updateHoldSeatsButton(
    count
) {

    const button =
        document.getElementById(
            "holdSeatsButton"
        );


    const text =
        document.getElementById(
            "holdSeatsButtonText"
        );


    if (
        !button ||
        !text
    ) {
        return;
    }


    if (
        skyraSeatState.holdingSeats
    ) {

        button.disabled =
            true;


        text.textContent =
            "Holding Seats...";


        return;

    }


    button.disabled =
        count === 0;


    if (count === 0) {

        text.textContent =
            "Select Seats to Continue";

    } else {

        text.textContent =
            `Hold ${
                count
            } Seat${
                count === 1
                    ? ""
                    : "s"
            } & Continue`;

    }

}


/* =========================================================
   41. HOLD BUTTON
   ========================================================= */

function initializeHoldButton() {

    document
        .getElementById(
            "holdSeatsButton"
        )
        ?.addEventListener(
            "click",
            handleSeatHoldRequest
        );

}


/* =========================================================
   42. HOLD SEATS

   Final backend flow:
   POST /api/holds

   Backend must atomically verify:
   AVAILABLE -> HELD

   If another user wins first:
   HTTP 409 Conflict
   ========================================================= */

async function handleSeatHoldRequest() {

    if (
        skyraSeatState.holdingSeats
    ) {
        return;
    }


    const selectedSeats =
        getSelectedSeats();


    if (!selectedSeats.length) {

        return;

    }


    /*
       Client-side check only.

       The backend MUST perform the authoritative
       concurrency check later.
    */

    const unavailable =
        selectedSeats.find(
            (seat) =>
                seat.status !==
                "AVAILABLE"
        );


    if (unavailable) {

        handleSeatConflict(
            unavailable.id,
            `Seat ${unavailable.label} is no longer available.`
        );


        return;

    }


    setSeatHoldButtonLoading(
        true
    );


    try {

        const hold =
            await requestSeatHold(
                selectedSeats
            );


        if (!hold) {

            throw new Error(
                "Seat hold could not be created."
            );

        }


        skyraSeatState.hold =
            hold;


        selectedSeats.forEach(
            (seat) => {

                seat.status =
                    "HELD";

            }
        );


        saveActiveSeatHold(
            hold
        );


        showSeatHoldTimer(
            hold
        );


        showSeatToast(
            "Your selected seats are temporarily held.",
            "success",
            "Seats Held"
        );


        /*
           Give the user a brief visual confirmation,
           then continue to checkout.
        */

        window.setTimeout(
            () => {

                navigateToCheckout(
                    hold
                );

            },
            650
        );

    } catch (error) {

        console.error(
            "Seat hold error:",
            error
        );


        /*
           Future API helper may expose status/statusCode.
        */

        if (
            error?.status === 409 ||
            error?.statusCode === 409
        ) {

            await handleBackendSeatConflict(
                error
            );

        } else {

            showSeatToast(
                error?.message ||
                "Unable to hold the selected seats. Please try again.",
                "error",
                "Hold Failed"
            );

        }


        setSeatHoldButtonLoading(
            false
        );

    }

}


/* =========================================================
   43. REQUEST SEAT HOLD - PHASE 11 BACKEND
   ========================================================= */

async function requestSeatHold(
    selectedSeats
) {

    const response =
        await window.SKYRA_API
            .createSeatHold({

                showId:
                    skyraSeatState.showId,

                seatIds:
                    selectedSeats.map(
                        (seat) =>
                            seat.id
                    )

            });


    const hold =
        response?.data?.hold ||
        response?.hold ||
        null;


    if (!hold) {

        throw new Error(
            "SeatHold API returned an invalid response."
        );

    }


    return hold;

}





/* =========================================================
   45. BUTTON LOADING
   ========================================================= */

function setSeatHoldButtonLoading(
    loading
) {

    skyraSeatState.holdingSeats =
        loading;


    const button =
        document.getElementById(
            "holdSeatsButton"
        );


    const text =
        document.getElementById(
            "holdSeatsButtonText"
        );


    const arrow =
        document.getElementById(
            "holdSeatsButtonArrow"
        );


    const loader =
        document.getElementById(
            "holdSeatsButtonLoader"
        );


    button?.classList.toggle(
        "loading",
        loading
    );


    if (button) {

        button.disabled =
            loading ||
            skyraSeatState
                .selectedSeatIds
                .length === 0;

    }


    if (text) {

        text.textContent =
            loading
                ? "Holding Seats..."
                : skyraSeatState
                    .selectedSeatIds
                    .length
                    ? `Hold ${
                        skyraSeatState
                            .selectedSeatIds
                            .length
                    } Seat${
                        skyraSeatState
                            .selectedSeatIds
                            .length === 1
                            ? ""
                            : "s"
                    } & Continue`
                    : "Select Seats to Continue";

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
   46. SAVE ACTIVE HOLD
   ========================================================= */

function saveActiveSeatHold(
    hold
) {

    try {

        sessionStorage.setItem(
            SKYRA_SEAT_SELECTION
                .STORAGE_KEYS
                .ACTIVE_HOLD,

            JSON.stringify(
                hold
            )
        );

    } catch (error) {

        console.warn(
            "Unable to save seat hold locally:",
            error
        );

    }

}


/* =========================================================
   47. RESTORE ACTIVE HOLD FROM SERVER
   ========================================================= */

async function restoreExistingSeatHold() {

    if (
        typeof window.SKYRA_API
            .getActiveSeatHold !==
            "function"
    ) {

        return false;

    }


    try {

        const response =
            await window.SKYRA_API
                .getActiveSeatHold(
                    skyraSeatState.showId
                );


        const hold =
            response?.data?.hold ||
            null;


        if (
            !hold ||
            String(
                hold.status ||
                ""
            ).toUpperCase() !==
                "ACTIVE"
        ) {

            clearSavedSeatHold();

            return false;

        }


        const expiresAt =
            new Date(
                hold.expiresAt
            ).getTime();


        if (
            !Number.isFinite(
                expiresAt
            ) ||
            expiresAt <=
                Date.now()
        ) {

            clearSavedSeatHold();

            return false;

        }


        skyraSeatState.hold =
            hold;


        saveActiveSeatHold(
            hold
        );


        /*
           An existing server hold represents an already-started
           checkout. Continue that checkout instead of attempting
           to create a second hold from this page.
        */
        navigateToCheckout(
            hold
        );


        return true;

    } catch (error) {

        /*
           401/403 should remain visible to the customer through
           common.js auth handling. Other lookup failures do not
           prevent the public seat map from rendering.
        */
        console.warn(
            "Unable to restore an active SeatHold:",
            error
        );


        return false;

    }

}


/* =========================================================
   48. CLEAR SAVED HOLD
   ========================================================= */

function clearSavedSeatHold() {

    try {

        sessionStorage.removeItem(
            SKYRA_SEAT_SELECTION
                .STORAGE_KEYS
                .ACTIVE_HOLD
        );

    } catch {

        /* Nothing else required. */

    }

}


/* =========================================================
   49. SHOW HOLD TIMER
   ========================================================= */

function showSeatHoldTimer(
    hold
) {

    const card =
        document.getElementById(
            "activeSeatHoldCard"
        );


    if (!card) {
        return;
    }


    card.hidden =
        false;


    card.classList.remove(
        "expired"
    );


    window.clearInterval(
        skyraSeatState
            .holdInterval
    );


    updateSeatHoldCountdown(
        hold
    );


    skyraSeatState.holdInterval =
        window.setInterval(
            () => {

                updateSeatHoldCountdown(
                    hold
                );

            },
            1000
        );

}


/* =========================================================
   50. COUNTDOWN
   ========================================================= */

function updateSeatHoldCountdown(
    hold
) {

    const expiresAt =
        new Date(
            hold.expiresAt
        ).getTime();


    const remaining =
        expiresAt -
        Date.now();


    if (
        !Number.isFinite(
            remaining
        ) ||
        remaining <= 0
    ) {

        handleSeatHoldExpiry();

        return;

    }


    const totalDuration =
        Number(
            hold.holdDurationMs ||
            (
                SKYRA_SEAT_SELECTION
                    .HOLD_MINUTES *
                60 *
                1000
            )
        );


    const percentage =
        Math.max(
            0,
            Math.min(
                100,
                remaining /
                    totalDuration *
                    100
            )
        );


    const minutes =
        Math.floor(
            remaining /
            60000
        );


    const seconds =
        Math.floor(
            (
                remaining %
                60000
            ) /
            1000
        );


    const countdown =
        document.getElementById(
            "seatHoldCountdown"
        );


    const progress =
        document.getElementById(
            "seatHoldProgress"
        );


    if (countdown) {

        countdown.textContent =
            `${
                String(minutes)
                    .padStart(
                        2,
                        "0"
                    )
            }:${
                String(seconds)
                    .padStart(
                        2,
                        "0"
                    )
            }`;


        countdown.classList.toggle(
            "warning",
            remaining <=
                5 *
                60 *
                1000
        );


        countdown.classList.toggle(
            "danger",
            remaining <=
                60 *
                1000
        );

    }


    if (progress) {

        progress.style.width =
            `${percentage}%`;

    }

}


/* =========================================================
   51. HOLD EXPIRY
   ========================================================= */

async function handleSeatHoldExpiry() {

    window.clearInterval(
        skyraSeatState
            .holdInterval
    );


    skyraSeatState.holdInterval =
        null;


    const card =
        document.getElementById(
            "activeSeatHoldCard"
        );


    if (card) {

        card.classList.add(
            "expired"
        );

    }


    setSeatText(
        "seatHoldCountdown",
        "00:00"
    );


    const progress =
        document.getElementById(
            "seatHoldProgress"
        );


    if (progress) {

        progress.style.width =
            "0%";

    }


    const expiredHoldId =
        skyraSeatState.hold
            ?.id ||
        skyraSeatState.hold
            ?._id ||
        null;


    clearSavedSeatHold();


    skyraSeatState.hold =
        null;


    skyraSeatState.holdingSeats =
        false;


    skyraSeatState.selectedSeatIds =
        [];


    /*
       The server scheduler is authoritative. This request simply
       asks the backend to reconcile immediately if the browser
       reaches zero before the next background sweep.
    */
    if (
        expiredHoldId &&
        typeof window.SKYRA_API
            .releaseSeatHold ===
            "function"
    ) {

        try {

            await window.SKYRA_API
                .releaseSeatHold(
                    expiredHoldId
                );

        } catch (error) {

            console.warn(
                "SeatHold expiry reconciliation failed:",
                error
            );

        }

    }


    await refreshSeatAvailability();


    showSeatToast(
        "Your temporary seat hold has expired. Please select your seats again.",
        "warning",
        "Hold Expired"
    );

}


/* =========================================================
   52. CHECKOUT NAVIGATION
   ========================================================= */

function navigateToCheckout(
    hold
) {

    if (!hold) {
        return;
    }


    window.location.href =
        `./checkout.html?hold=${
            encodeURIComponent(
                hold.id
            )
        }&show=${
            encodeURIComponent(
                skyraSeatState.showId
            )
        }`;

}


/* =========================================================
   53. BACK / CHANGE SHOW LINKS
   ========================================================= */

function updateSeatSelectionNavigation() {

    const event =
        skyraSeatState.event;


    if (!event) {
        return;
    }


    const url =
        `./shows.html?event=${
            encodeURIComponent(
                event.id
            )
        }&show=${
            encodeURIComponent(
                skyraSeatState.showId
            )
        }`;


    const back =
        document.getElementById(
            "seatSelectionBackLink"
        );


    const change =
        document.getElementById(
            "changeShowButton"
        );


    if (back) {

        back.href =
            url;

    }


    if (change) {

        change.href =
            url;

    }

}


/* =========================================================
   54. ZONE HEADING
   ========================================================= */

function updateSeatZoneHeading() {

    const nameElement =
        document.getElementById(
            "seatZoneName"
        );


    const priceElement =
        document.getElementById(
            "seatZonePrice"
        );


    if (
        !nameElement ||
        !priceElement
    ) {
        return;
    }


    const show =
        skyraSeatState.show;


    if (!show) {
        return;
    }


    if (
        skyraSeatState.selectedCategory ===
        "ALL"
    ) {

        nameElement.textContent =
            "ALL CATEGORIES";


        const prices =
            (
                show.seatCategories ||
                []
            )
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
                        )
                );


        priceElement.textContent =
            prices.length
                ? `From ${
                    formatSeatCurrency(
                        Math.min(
                            ...prices
                        )
                    )
                }`
                : "Pricing TBA";


        return;

    }


    const category =
        show.seatCategories
            ?.find(
                (item) =>
                    item.name ===
                    skyraSeatState
                        .selectedCategory
            );


    nameElement.textContent =
        skyraSeatState
            .selectedCategory
            .toUpperCase();


    priceElement.textContent =
        category
            ? formatSeatCurrency(
                category.price
            )
            : "";

}


/* =========================================================
   55. SEAT MAP UPDATED TIME
   ========================================================= */

function updateSeatMapTimestamp() {

    const element =
        document.getElementById(
            "seatMapLastUpdated"
        );


    if (!element) {
        return;
    }


    element.textContent =
        `Seat status updated ${
            new Intl.DateTimeFormat(
                "en-IN",
                {
                    hour:
                        "numeric",

                    minute:
                        "2-digit",

                    second:
                        "2-digit"
                }
            ).format(
                new Date()
            )
        }`;

}


/* =========================================================
   56. SEAT LIMIT MODAL
   ========================================================= */

function initializeSeatModals() {

    const seatLimitModal =
        document.getElementById(
            "seatLimitModal"
        );


    const conflictModal =
        document.getElementById(
            "seatConflictModal"
        );


    document
        .getElementById(
            "closeSeatLimitModal"
        )
        ?.addEventListener(
            "click",
            closeSeatLimitModal
        );


    document
        .getElementById(
            "seatLimitOkayButton"
        )
        ?.addEventListener(
            "click",
            closeSeatLimitModal
        );


    document
        .getElementById(
            "closeSeatConflictModal"
        )
        ?.addEventListener(
            "click",
            closeSeatConflictModal
        );


    document
        .getElementById(
            "seatConflictOkayButton"
        )
        ?.addEventListener(
            "click",
            closeSeatConflictModal
        );


    seatLimitModal?.addEventListener(
        "click",
        (event) => {

            if (
                event.target ===
                seatLimitModal
            ) {

                closeSeatLimitModal();

            }

        }
    );


    conflictModal?.addEventListener(
        "click",
        (event) => {

            if (
                event.target ===
                conflictModal
            ) {

                closeSeatConflictModal();

            }

        }
    );

}


/* =========================================================
   57. OPEN LIMIT MODAL
   ========================================================= */

function openSeatLimitModal() {

    const modal =
        document.getElementById(
            "seatLimitModal"
        );


    if (modal) {

        modal.hidden =
            false;

    }


    refreshSeatSelectionIcons();

}


/* =========================================================
   58. CLOSE LIMIT MODAL
   ========================================================= */

function closeSeatLimitModal() {

    const modal =
        document.getElementById(
            "seatLimitModal"
        );


    if (modal) {

        modal.hidden =
            true;

    }

}


/* =========================================================
   59. CONFLICT MODAL
   ========================================================= */

function showSeatConflictModal(
    message
) {

    const modal =
        document.getElementById(
            "seatConflictModal"
        );


    const messageElement =
        document.getElementById(
            "seatConflictMessage"
        );


    if (
        messageElement &&
        message
    ) {

        messageElement.textContent =
            message;

    }


    if (modal) {

        modal.hidden =
            false;

    }


    refreshSeatSelectionIcons();

}


/* =========================================================
   60. CLOSE CONFLICT MODAL
   ========================================================= */

function closeSeatConflictModal() {

    const modal =
        document.getElementById(
            "seatConflictModal"
        );


    if (modal) {

        modal.hidden =
            true;

    }

}


/* =========================================================
   61. BACKEND CONFLICT
   ========================================================= */

async function handleBackendSeatConflict(
    error
) {

    await refreshSeatAvailability();


    showSeatConflictModal(
        error?.message ||
        "One or more selected seats were just held or booked by another customer."
    );


    setSeatHoldButtonLoading(
        false
    );

}


/* =========================================================
   62. HANDLE CONFLICT
   ========================================================= */

function handleSeatConflict(
    seatId,
    message = null
) {

    const seat =
        getSeatById(
            seatId
        );


    if (seat) {

        /*
           HELD is the safest frontend conflict state
           until fresh server data says otherwise.
        */

        seat.status =
            "HELD";


        skyraSeatState
            .selectedSeatIds =
            skyraSeatState
                .selectedSeatIds
                .filter(
                    (id) =>
                        id !==
                        seatId
                );

    }


    renderSeatMap();

    renderSelectedSeatSummary();


    if (message) {

        showSeatConflictModal(
            message
        );

    }

}


/* =========================================================
   63. REALTIME LISTENERS - PHASE 19

   Primary channel:
   MongoDB ShowSeat change stream -> Socket.IO -> browser.

   Existing custom DOM events are kept as compatibility hooks
   for any older frontend code that dispatches seat updates.
   ========================================================= */

function initializeRealtimeSeatListeners() {

    if (
        skyraSeatState
            .realtimeHandlersBound
    ) {

        return;

    }


    skyraSeatState
        .realtimeHandlersBound =
        true;


    window.addEventListener(
        "skyra:seat-status",
        (event) => {

            const detail =
                event.detail ||
                {};


            if (
                detail.showId &&
                detail.showId !==
                    skyraSeatState.showId
            ) {

                return;

            }


            applyRealtimeSeatUpdate(
                detail
            );

        }
    );


    window.addEventListener(
        "skyra:seat-released",
        (event) => {

            const detail =
                event.detail ||
                {};


            if (
                detail.showId &&
                detail.showId !==
                    skyraSeatState.showId
            ) {

                return;

            }


            applyRealtimeSeatUpdate({

                ...detail,

                status:
                    "AVAILABLE"

            });

        }
    );

}


/* =========================================================
   63.1 CONNECT SOCKET.IO SHOW ROOM
   ========================================================= */

async function connectRealtimeSeatUpdates() {

    if (
        !skyraSeatState.showId ||
        !window.SKYRA_COMMON ||
        typeof window.SKYRA_COMMON
            .getRealtimeSocket !==
            "function"
    ) {

        updateRealtimeConnectionIndicator(
            "offline"
        );

        return false;

    }


    updateRealtimeConnectionIndicator(
        "connecting"
    );


    try {

        const socket =
            await window.SKYRA_COMMON
                .getRealtimeSocket();


        skyraSeatState.realtimeSocket =
            socket;


        bindRealtimeSocketHandlers(
            socket
        );


        if (socket.connected) {

            joinRealtimeShowRoom(
                socket
            );

        }


        return await waitForRealtimeConnection(
            socket,
            7000
        );

    } catch (error) {

        console.warn(
            "Socket.IO seat updates unavailable. Falling back to polling:",
            error
        );


        skyraSeatState.realtimeConnected =
            false;


        updateRealtimeConnectionIndicator(
            "offline"
        );


        return false;

    }

}


function bindRealtimeSocketHandlers(
    socket
) {

    if (
        socket.__skyraSeatHandlersBound
    ) {

        return;

    }


    socket.__skyraSeatHandlersBound =
        true;


    socket.on(
        "connect",
        () => {

            skyraSeatState.realtimeConnected =
                true;


            stopSeatAvailabilityPolling();


            updateRealtimeConnectionIndicator(
                "connected"
            );


            joinRealtimeShowRoom(
                socket
            );

        }
    );


    socket.on(
        "disconnect",
        () => {

            skyraSeatState.realtimeConnected =
                false;

            skyraSeatState.realtimeJoinedShowId =
                null;


            updateRealtimeConnectionIndicator(
                "offline"
            );


            if (
                skyraSeatState.show
            ) {

                startSeatAvailabilityPolling();

            }

        }
    );


    socket.on(
        "connect_error",
        (error) => {

            console.warn(
                "Socket.IO connection error:",
                error?.message ||
                error
            );


            skyraSeatState.realtimeConnected =
                false;


            updateRealtimeConnectionIndicator(
                "offline"
            );


            if (
                skyraSeatState.show
            ) {

                startSeatAvailabilityPolling();

            }

        }
    );


    socket.on(
        "show:snapshot",
        (payload = {}) => {

            if (
                String(
                    payload.showId ||
                    ""
                ) !==
                String(
                    skyraSeatState.showId ||
                    ""
                )
            ) {

                return;

            }


            applyRealtimeSeatSnapshot(
                payload
            );

        }
    );


    socket.on(
        "seat:updated",
        (payload = {}) => {

            const publicSeat =
                payload.seat ||
                null;


            if (
                !publicSeat ||
                String(
                    payload.showId ||
                    publicSeat.showId ||
                    ""
                ) !==
                String(
                    skyraSeatState.showId ||
                    ""
                )
            ) {

                return;

            }


            stopSeatAvailabilityPolling();


            applyRealtimeSeatUpdate({

                showId:
                    payload.showId ||
                    publicSeat.showId,

                seatId:
                    publicSeat._id ||
                    publicSeat.id,

                status:
                    publicSeat.status,

                seat:
                    publicSeat,

                changedFields:
                    payload.changedFields ||
                    []

            });

        }
    );

}


function joinRealtimeShowRoom(
    socket
) {

    if (
        !socket ||
        !skyraSeatState.showId
    ) {

        return;

    }


    const showId =
        String(
            skyraSeatState.showId
        );


    if (
        socket.connected &&
        skyraSeatState
            .realtimeJoinedShowId ===
            showId
    ) {

        return;

    }


    socket.emit(
        "show:join",
        {
            showId
        },
        (response = {}) => {

            if (response.success) {

                skyraSeatState
                    .realtimeJoinedShowId =
                    showId;

                skyraSeatState
                    .realtimeConnected =
                    true;


                stopSeatAvailabilityPolling();


                updateRealtimeConnectionIndicator(
                    "connected"
                );

                return;

            }


            console.warn(
                "Unable to join SKYRA show room:",
                response.message ||
                response
            );

        }
    );

}


function waitForRealtimeConnection(
    socket,
    timeoutMs
) {

    if (socket.connected) {

        return Promise.resolve(
            true
        );

    }


    return new Promise(
        (resolve) => {

            let settled =
                false;


            const finish =
                (value) => {

                    if (settled) {
                        return;
                    }


                    settled =
                        true;


                    window.clearTimeout(
                        timeoutId
                    );


                    socket.off(
                        "connect",
                        handleConnect
                    );

                    socket.off(
                        "connect_error",
                        handleError
                    );


                    resolve(
                        value
                    );

                };


            const handleConnect =
                () => finish(
                    true
                );

            const handleError =
                () => finish(
                    false
                );


            const timeoutId =
                window.setTimeout(
                    () => finish(
                        false
                    ),
                    timeoutMs
                );


            socket.once(
                "connect",
                handleConnect
            );

            socket.once(
                "connect_error",
                handleError
            );

        }
    );

}


function applyRealtimeSeatSnapshot(
    payload
) {

    if (
        !Array.isArray(
            payload.seats
        ) ||
        !skyraSeatState.show
    ) {

        return;

    }


    const freshSeats =
        payload.seats.map(
            (seat) =>
                normalizeSeatRecord(
                    seat,
                    skyraSeatState.show
                )
        );


    const freshSeatMap =
        new Map(
            freshSeats.map(
                (seat) => [
                    seat.id,
                    seat
                ]
            )
        );


    skyraSeatState.selectedSeatIds =
        skyraSeatState
            .selectedSeatIds
            .filter(
                (seatId) =>
                    freshSeatMap
                        .get(
                            seatId
                        )
                        ?.status ===
                    "AVAILABLE"
            );


    skyraSeatState.seats =
        freshSeats;


    skyraSeatState.realtimeConnected =
        true;


    stopSeatAvailabilityPolling();


    updateRealtimeConnectionIndicator(
        "connected"
    );


    renderSeatMap();

    renderSelectedSeatSummary();

    updateSeatMapTimestamp();

}


/* =========================================================
   64. APPLY REALTIME UPDATE
   ========================================================= */

function applyRealtimeSeatUpdate(
    update
) {

    const seat =
        skyraSeatState
            .seats
            .find(
                (item) =>
                    item.id ===
                        update.seatId ||
                    item.physicalSeatId ===
                        update.seatId
            );


    if (!seat) {
        return;
    }


    const newStatus =
        normalizeSeatStatus(
            update.status
        );


    const wasSelected =
        skyraSeatState
            .selectedSeatIds
            .includes(
                seat.id
            );


    seat.status =
        newStatus;


    if (update.seat) {

        seat.holdExpiresAt =
            update.seat
                .holdExpiresAt ||
            null;

        seat.offerExpiresAt =
            update.seat
                .offerExpiresAt ||
            null;

    }


    /*
       When this browser is currently POSTing its own selected
       seats, a HELD event can arrive before the HTTP response.
       Do not treat that specific in-flight transition as a
       conflict. A genuine losing request still returns HTTP 409
       and is reconciled through handleBackendSeatConflict().
    */

    const likelyOwnInFlightHold =
        wasSelected &&
        newStatus ===
            "HELD" &&
        skyraSeatState
            .holdingSeats;


    if (
        wasSelected &&
        newStatus !==
            "AVAILABLE" &&
        !likelyOwnInFlightHold
    ) {

        skyraSeatState
            .selectedSeatIds =
            skyraSeatState
                .selectedSeatIds
                .filter(
                    (id) =>
                        id !==
                        seat.id
                );


        showSeatConflictModal(
            `Seat ${seat.label} is no longer available. Please choose another seat.`
        );

    }


    renderSeatMap();

    renderSelectedSeatSummary();

    updateSeatMapTimestamp();

}


/* =========================================================
   64.1 SOCKET.IO FALLBACK POLLING

   Socket.IO is the primary channel in Phase 19. Poll every five
   seconds only while the real-time connection is unavailable.
   ========================================================= */

function startSeatAvailabilityPolling() {

    if (
        skyraSeatState
            .realtimeConnected ||
        skyraSeatState
            .refreshInterval
    ) {

        return;

    }


    skyraSeatState.refreshInterval =
        window.setInterval(
            () => {

                refreshSeatAvailability()
                    .catch(
                        (error) => {

                            console.warn(
                                "Seat availability refresh failed:",
                                error
                            );

                        }
                    );

            },
            5000
        );

}


function stopSeatAvailabilityPolling() {

    if (
        !skyraSeatState
            .refreshInterval
    ) {

        return;

    }


    window.clearInterval(
        skyraSeatState
            .refreshInterval
    );


    skyraSeatState.refreshInterval =
        null;

}


function updateRealtimeConnectionIndicator(
    state
) {

    const container =
        document.getElementById(
            "seatRealtimeStatus"
        );

    const text =
        document.getElementById(
            "seatRealtimeStatusText"
        );


    if (!container || !text) {
        return;
    }


    container.classList.remove(
        "is-connecting",
        "is-offline"
    );


    if (state === "connecting") {

        container.classList.add(
            "is-connecting"
        );

        text.textContent =
            "Connecting live seat availability";

        return;

    }


    if (state === "offline") {

        container.classList.add(
            "is-offline"
        );

        text.textContent =
            "Live connection reconnecting";

        return;

    }


    text.textContent =
        "Live seat availability";

}


async function refreshSeatAvailability() {

    if (
        !skyraSeatState.show
    ) {

        return;

    }


    const freshSeats =
        await loadSeatsForShow(
            skyraSeatState.show
        );


    const selected =
        new Set(
            skyraSeatState
                .selectedSeatIds
        );


    /*
       A locally selected seat is only a visual selection until
       POST /api/holds succeeds. If another customer holds/books
       it before then, remove it from our selection.
    */
    freshSeats.forEach(
        (seat) => {

            if (
                selected.has(
                    seat.id
                ) &&
                seat.status !==
                    "AVAILABLE"
            ) {

                selected.delete(
                    seat.id
                );

            }

        }
    );


    skyraSeatState.seats =
        freshSeats;


    skyraSeatState.selectedSeatIds =
        [
            ...selected
        ];


    renderSeatMap();

    renderSelectedSeatSummary();

    updateSeatMapTimestamp();

}


/* =========================================================
   65. TOPBAR SEARCH
   ========================================================= */

function initializeSeatSelectionSearch() {

    const input =
        document.getElementById(
            "dashboardSearch"
        );


    if (!input) {
        return;
    }


    input.addEventListener(
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
                input.value.trim();


            if (!query) {

                showSeatToast(
                    "Enter an event, movie or concert to search.",
                    "info"
                );


                return;

            }


            window.location.href =
                `./events.html?search=${
                    encodeURIComponent(
                        query
                    )
                }`;

        }
    );

}


/* =========================================================
   66. EXPLORE NAV ACTIVE
   ========================================================= */

function keepSeatExploreNavigationActive() {

    const links =
        document.querySelectorAll(
            ".sidebar-nav .sidebar-link"
        );


    links.forEach(
        (link) => {

            link.classList.remove(
                "active"
            );


            link.removeAttribute(
                "aria-current"
            );

        }
    );


    const explore =
        [...links].find(
            (link) =>
                link.getAttribute(
                    "href"
                ) ===
                "./events.html"
        );


    if (explore) {

        explore.classList.add(
            "active"
        );


        explore.setAttribute(
            "aria-current",
            "page"
        );

    }

}


/* =========================================================
   67. NOT FOUND
   ========================================================= */

function showSeatSelectionNotFound(
    message
) {

    const state =
        document.getElementById(
            "seatSelectionNotFoundState"
        );


    const content =
        document.getElementById(
            "seatSelectionContent"
        );


    const messageElement =
        document.getElementById(
            "seatSelectionNotFoundMessage"
        );


    if (
        messageElement &&
        message
    ) {

        messageElement.textContent =
            message;

    }


    if (state) {

        state.hidden =
            false;

    }


    if (content) {

        content.hidden =
            true;

    }


    document.title =
        "Show Unavailable | SKYRA";


    refreshSeatSelectionIcons();

}


/* =========================================================
   68. HIDE NOT FOUND
   ========================================================= */

function hideSeatSelectionNotFound() {

    const state =
        document.getElementById(
            "seatSelectionNotFoundState"
        );


    const content =
        document.getElementById(
            "seatSelectionContent"
        );


    if (state) {

        state.hidden =
            true;

    }


    if (content) {

        content.hidden =
            false;

    }

}


/* =========================================================
   69. DOCUMENT TITLE
   ========================================================= */

function updateSeatSelectionDocumentTitle() {

    const event =
        skyraSeatState.event;


    if (!event) {
        return;
    }


    document.title =
        `Select Seats - ${event.title} | SKYRA`;

}


/* =========================================================
   70. DATE FORMAT
   ========================================================= */

function formatSeatDate(
    value
) {

    const date =
        parseSeatDate(
            value
        );


    if (!date) {

        return "TBA";

    }


    return new Intl.DateTimeFormat(
        "en-IN",
        {

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
   71. DATE PARSER
   ========================================================= */

function parseSeatDate(
    value
) {

    if (!value) {
        return null;
    }


    if (
        /^\d{4}-\d{2}-\d{2}$/.test(
            value
        )
    ) {

        const [
            year,
            month,
            day
        ] =
            value
                .split("-")
                .map(Number);


        return new Date(
            year,
            month - 1,
            day
        );

    }


    const date =
        new Date(
            value
        );


    return Number.isNaN(
        date.getTime()
    )
        ? null
        : date;

}


/* =========================================================
   72. TIME FORMAT
   ========================================================= */

function formatSeatTime(
    value
) {

    if (!value) {

        return "TBA";

    }


    if (
        !/^\d{2}:\d{2}$/.test(
            value
        )
    ) {

        return String(value);

    }


    const [
        hoursValue,
        minutes
    ] =
        value
            .split(":")
            .map(Number);


    const period =
        hoursValue >= 12
            ? "PM"
            : "AM";


    const hours =
        hoursValue % 12 ||
        12;


    return `${
        hours
    }:${
        String(minutes)
            .padStart(
                2,
                "0"
            )
    } ${period}`;

}


/* =========================================================
   73. CURRENCY
   ========================================================= */

function formatSeatCurrency(
    value
) {

    if (
        window.SKYRA_COMMON
            ?.formatCurrency
    ) {

        return window.SKYRA_COMMON
            .formatCurrency(
                value
            );

    }


    const amount =
        Number(value);


    if (
        !Number.isFinite(
            amount
        )
    ) {

        return "₹0";

    }


    return `₹${
        amount.toLocaleString(
            "en-IN"
        )
    }`;

}


/* =========================================================
   74. EVENT TYPE
   ========================================================= */

function formatSeatEventType(
    type
) {

    switch (
        String(
            type ||
            ""
        ).toUpperCase()
    ) {

        case "MOVIE":

            return "Movie";


        case "CONCERT":

            return "Concert";


        case "LIVE_SHOW":

            return "Live Show";


        case "EVENT":

            return "Event";


        default:

            return "Event";

    }

}


/* =========================================================
   75. EVENT ICON
   ========================================================= */

function getSeatEventIcon(
    type
) {

    switch (
        String(
            type ||
            ""
        ).toUpperCase()
    ) {

        case "MOVIE":

            return "film";


        case "CONCERT":

            return "music-2";


        case "LIVE_SHOW":

            return "mic-2";


        default:

            return "calendar-days";

    }

}


/* =========================================================
   76. STATUS LABEL
   ========================================================= */

function formatSeatStatus(
    status
) {

    switch (
        normalizeSeatStatus(
            status
        )
    ) {

        case "AVAILABLE":

            return "available";


        case "HELD":

            return "held";


        case "BOOKED":

            return "booked";


        case "OFFERED":

            return "reserved for waitlist offer";


        default:

            return "unavailable";

    }

}


/* =========================================================
   77. NATURAL ROW SORT
   ========================================================= */

function naturalSeatCompare(
    first,
    second
) {

    return String(first)
        .localeCompare(
            String(second),
            undefined,
            {
                numeric:
                    true,

                sensitivity:
                    "base"
            }
        );

}


/* =========================================================
   78. TEXT SETTER
   ========================================================= */

function setSeatText(
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
   79. HTML ESCAPE
   ========================================================= */

function escapeSeatHTML(
    value
) {

    return String(
        value ?? ""
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
   80. ATTRIBUTE ESCAPE
   ========================================================= */

function escapeSeatAttribute(
    value
) {

    return escapeSeatHTML(
        value
    );

}


/* =========================================================
   81. TOAST
   ========================================================= */

function showSeatToast(
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
   82. ICON REFRESH
   ========================================================= */

function refreshSeatSelectionIcons() {

    if (
        typeof lucide !==
        "undefined"
    ) {

        lucide.createIcons();

    }

}


/* =========================================================
   83. ESCAPE KEY
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


        closeSeatLimitModal();

        closeSeatConflictModal();

    }
);


/* =========================================================
   84. CLEANUP
   ========================================================= */

window.addEventListener(
    "beforeunload",
    () => {

        window.clearInterval(
            skyraSeatState
                .holdInterval
        );


        stopSeatAvailabilityPolling();


        const socket =
            skyraSeatState
                .realtimeSocket;


        if (
            socket &&
            skyraSeatState.showId
        ) {

            socket.emit(
                "show:leave",
                {
                    showId:
                        skyraSeatState.showId
                }
            );

        }

    }
);


/* =========================================================
   85. PUBLIC HELPERS

   Useful later when Socket.IO/API integration is added.
   ========================================================= */

window.SKYRA_SEAT_SELECTION = {

    getState:
        () => ({
            ...skyraSeatState,

            selectedSeatIds: [
                ...skyraSeatState
                    .selectedSeatIds
            ],

            seats:
                skyraSeatState
                    .seats
                    .map(
                        (seat) => ({
                            ...seat
                        })
                    )
        }),

    getSelectedSeats:
        () =>
            getSelectedSeats()
                .map(
                    (seat) => ({
                        ...seat
                    })
                ),

    refresh:
        async () => {

            if (
                skyraSeatState.showId
            ) {

                await loadSeatSelectionShow(
                    skyraSeatState
                        .showId
                );

            }

        },

    updateSeatStatus:
        (
            seatId,
            status
        ) => {

            applyRealtimeSeatUpdate({

                showId:
                    skyraSeatState.showId,

                seatId,

                status

            });

        },

    handleConflict:
        (
            seatId,
            message
        ) => {

            handleSeatConflict(
                seatId,
                message
            );

        }

};


/* =========================================================
   END OF SKYRA CUSTOMER SEAT SELECTION
   ========================================================= */