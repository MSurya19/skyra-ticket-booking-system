/* =========================================================
   SKYRA - CUSTOMER WAITLIST
   File: frontend/js/customer/waitlist.js

   Phase 17 backend integration:
   - Reads real waitlist entries from GET /api/waitlist/my
   - Supports real FIFO positions
   - Supports backend-created OFFERED timed offers
   - Claims offers through POST /api/waitlist/offers/:offerId/claim
   - Leaves waitlists through DELETE /api/waitlist/:id
   - Backend is authoritative for offer expiration
   - No mock waitlist fallback
   ========================================================= */

"use strict";


/* =========================================================
   1. CONSTANTS
   ========================================================= */

const SKYRA_WAITLIST = {};


/* =========================================================
   2. STATE
   ========================================================= */

const skyraWaitlistState = {

    entries: [],

    filteredEntries: [],

    filter:
        "ALL",

    search:
        "",

    leavingEntryId:
        null,

    countdownInterval:
        null,

    expiryRefreshPending:
        false,

    lastExpiryRefreshAt:
        0

};


/* =========================================================
   3. DOM READY
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initializeWaitlistPage();

    }
);


/* =========================================================
   4. INITIALIZE
   ========================================================= */

async function initializeWaitlistPage() {

    initializeWaitlistUser();

    initializeWaitlistTabs();

    initializeWaitlistSearch();

    initializeWaitlistTopbarSearch();

    initializeWaitlistModals();

    keepWaitlistNavigationActive();


    await loadWaitlistEntries();


    updateWaitlistIndicators();

    refreshWaitlistIcons();

}


/* =========================================================
   5. LOAD ENTRIES
   ========================================================= */

async function loadWaitlistEntries() {

    try {

        const source =
            await fetchWaitlistSource();


        let entries =
            source
                .map(
                    normalizeWaitlistEntry
                )
                .filter(
                    (entry) =>
                        Boolean(
                            entry.id
                        )
                );


        entries =
            sortWaitlistEntries(
                entries
            );


        skyraWaitlistState.entries =
            entries;


        renderWaitlistSummary();

        applyWaitlistFilters();

        startWaitlistOfferCountdowns();

    } catch (error) {

        console.error(
            "Unable to load waitlist:",
            error
        );


        skyraWaitlistState.entries =
            [];


        renderWaitlistSummary();

        applyWaitlistFilters();

    }

}


/* =========================================================
   6. DATA SOURCE
   ========================================================= */

async function fetchWaitlistSource() {

    if (
        !window.SKYRA_API ||
        typeof window.SKYRA_API
            .getMyWaitlist !==
            "function"
    ) {
        throw new Error(
            "Waitlist API is unavailable."
        );
    }

    const response =
        await window.SKYRA_API
            .getMyWaitlist();

    const entries =
        response?.data?.waitlist ||
        response?.waitlist ||
        response?.data?.entries ||
        response?.entries ||
        [];

    return Array.isArray(entries)
        ? entries
        : [];
}




/* =========================================================
   9. NORMALIZE ENTRY
   ========================================================= */
function normalizeWaitlistEntry(raw) {
    const id = getWaitlistEntryId(raw);
    const offer = raw?.offer && typeof raw.offer === "object" ? raw.offer : null;
    const show = raw?.show && typeof raw.show === "object" ? raw.show : {
        id: raw?.showId || null,
        _id: raw?.showId || null,
        date: raw?.date || raw?.showDate || null,
        time: raw?.time || raw?.showTime || null,
        startsAt: raw?.startsAt || null
    };
    const event = raw?.event && typeof raw.event === "object" ? raw.event : {
        id: raw?.eventId || null,
        _id: raw?.eventId || null,
        title: raw?.eventTitle || "SKYRA Event",
        type: raw?.eventType || "EVENT"
    };
    const venue = raw?.venue && typeof raw.venue === "object" ? raw.venue : {
        id: raw?.venueId || null,
        name: raw?.venueName || "Venue",
        city: raw?.venueCity || ""
    };
    const status = normalizeWaitlistStatus(raw?.status || offer?.status);

    return {
        ...raw,
        id,
        showId: show?.id || show?._id || raw?.showId || null,
        eventId: event?.id || event?._id || raw?.eventId || null,
        event, show, venue, offer, status,
        historyState: getWaitlistHistoryState(status),
        category: String(raw?.category || raw?.categoryName || raw?.seatCategory || raw?.ticketCategory || raw?.seatCategoryName || "Standard"),
        position: normalizePosition(raw?.position),
        joinedAt: raw?.joinedAt || raw?.createdAt || null
    };
}

/* =========================================================
   10. ID
   ========================================================= */

function getWaitlistEntryId(
    entry
) {

    return String(
        entry?.id ||
        entry?._id ||
        entry?.waitlistId ||
        ""
    );

}


/* =========================================================
   11. POSITION
   ========================================================= */

function normalizePosition(
    value
) {

    const position =
        Number(
            value
        );


    return Number.isFinite(
        position
    ) &&
    position > 0
        ? position
        : null;

}


/* =========================================================
   12. STATUS
   ========================================================= */

function normalizeWaitlistStatus(
    value
) {

    const status =
        String(
            value ||
            "WAITLISTED"
        )
            .trim()
            .toUpperCase();


    if (
        [
            "WAITING",
            "WAITLISTED",
            "ACTIVE"
        ].includes(
            status
        )
    ) {

        return "WAITING";

    }


    if (
        [
            "OFFERED",
            "OFFER_ACTIVE"
        ].includes(
            status
        )
    ) {

        return "OFFERED";

    }


    if (
        [
            "CLAIMED",
            "BOOKED",
            "COMPLETED"
        ].includes(
            status
        )
    ) {

        return "CLAIMED";

    }


    if (
        [
            "EXPIRED",
            "OFFER_EXPIRED"
        ].includes(
            status
        )
    ) {

        return "EXPIRED";

    }


    if (
        [
            "LEFT",
            "CANCELLED",
            "REMOVED"
        ].includes(
            status
        )
    ) {

        return "LEFT";

    }


    return "WAITING";

}


/* =========================================================
   13. HISTORY STATE
   ========================================================= */

function getWaitlistHistoryState(
    status
) {

    return [
        "CLAIMED",
        "EXPIRED",
        "LEFT"
    ].includes(
        status
    );

}




/* =========================================================
   17. SORT
   ========================================================= */

function sortWaitlistEntries(
    entries
) {

    const rank = {

        OFFERED:
            0,

        WAITING:
            1,

        CLAIMED:
            2,

        EXPIRED:
            3,

        LEFT:
            4

    };


    return [
        ...entries
    ].sort(
        (
            first,
            second
        ) => {

            const statusDifference =
                (
                    rank[
                        first.status
                    ] ??
                    9
                ) -
                (
                    rank[
                        second.status
                    ] ??
                    9
                );


            if (
                statusDifference !==
                0
            ) {

                return statusDifference;

            }


            if (
                first.status ===
                "WAITING"
            ) {

                return (
                    (
                        first.position ??
                        Number.MAX_SAFE_INTEGER
                    ) -
                    (
                        second.position ??
                        Number.MAX_SAFE_INTEGER
                    )
                );

            }


            return 0;

        }
    );

}


/* =========================================================
   18. SUMMARY
   ========================================================= */

function renderWaitlistSummary() {

    const entries =
        skyraWaitlistState
            .entries;


    const waiting =
        entries.filter(
            (entry) =>
                entry.status ===
                "WAITING"
        );


    const offers =
        entries.filter(
            (entry) =>
                entry.status ===
                    "OFFERED" &&
                isOfferStillActive(
                    entry
                )
        );


    const positions =
        waiting
            .map(
                (entry) =>
                    entry.position
            )
            .filter(
                (position) =>
                    Number.isFinite(
                        position
                    )
            );


    setWaitlistText(
        "activeWaitlistCount",
        waiting.length
    );


    setWaitlistText(
        "activeOfferCount",
        offers.length
    );


    setWaitlistText(

        "bestWaitlistPosition",

        positions.length
            ? `#${Math.min(
                ...positions
            )}`
            : "—"

    );


    setWaitlistText(
        "sidebarWaitlistCount",
        waiting.length +
        offers.length
    );

}


/* =========================================================
   19. TABS
   ========================================================= */

function initializeWaitlistTabs() {

    document
        .querySelectorAll(
            "[data-waitlist-filter]"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    () => {

                        skyraWaitlistState.filter =
                            button.dataset
                                .waitlistFilter ||
                            "ALL";


                        document
                            .querySelectorAll(
                                "[data-waitlist-filter]"
                            )
                            .forEach(
                                (item) => {

                                    const active =
                                        item ===
                                        button;


                                    item.classList
                                        .toggle(
                                            "active",
                                            active
                                        );


                                    item.setAttribute(
                                        "aria-selected",
                                        String(
                                            active
                                        )
                                    );

                                }
                            );


                        applyWaitlistFilters();

                    }
                );

            }
        );

}


/* =========================================================
   20. WAITLIST SEARCH
   ========================================================= */

function initializeWaitlistSearch() {

    document
        .getElementById(
            "waitlistSearchInput"
        )
        ?.addEventListener(
            "input",
            (event) => {

                skyraWaitlistState.search =
                    event.target.value
                        .trim()
                        .toLowerCase();


                applyWaitlistFilters();

            }
        );

}


/* =========================================================
   21. FILTER
   ========================================================= */

function applyWaitlistFilters() {

    const {
        filter,
        search
    } =
        skyraWaitlistState;


    const entries =
        skyraWaitlistState
            .entries
            .filter(
                (entry) => {

                    if (
                        filter ===
                            "WAITING" &&
                        entry.status !==
                            "WAITING"
                    ) {

                        return false;

                    }


                    if (
                        filter ===
                            "OFFERED" &&
                        entry.status !==
                            "OFFERED"
                    ) {

                        return false;

                    }


                    if (
                        filter ===
                            "HISTORY" &&
                        !entry.historyState
                    ) {

                        return false;

                    }


                    if (
                        filter !==
                            "ALL" &&
                        ![
                            "WAITING",
                            "OFFERED",
                            "HISTORY"
                        ].includes(
                            filter
                        )
                    ) {

                        return false;

                    }


                    if (!search) {

                        return true;

                    }


                    const searchable =
                        [
                            entry.event?.title,
                            entry.category,
                            entry.venue?.name,
                            entry.venue?.city,
                            entry.show?.date
                        ]
                            .filter(Boolean)
                            .join(" ")
                            .toLowerCase();


                    return searchable.includes(
                        search
                    );

                }
            );


    skyraWaitlistState.filteredEntries =
        entries;


    renderWaitlistEntries();

}


/* =========================================================
   22. RENDER LIST
   ========================================================= */

function renderWaitlistEntries() {

    const container =
        document.getElementById(
            "waitlistList"
        );


    const empty =
        document.getElementById(
            "waitlistEmptyState"
        );


    if (
        !container ||
        !empty
    ) {

        return;

    }


    const entries =
        skyraWaitlistState
            .filteredEntries;


    if (!entries.length) {

        container.hidden =
            true;


        empty.hidden =
            false;


        refreshWaitlistIcons();

        return;

    }


    empty.hidden =
        true;


    container.hidden =
        false;


    container.innerHTML =
        entries
            .map(
                createWaitlistEntryHTML
            )
            .join("");


    initializeRenderedWaitlistActions();

    updateAllOfferCountdowns();

    refreshWaitlistIcons();

}


/* =========================================================
   23. ENTRY HTML
   ========================================================= */

function createWaitlistEntryHTML(
    entry
) {

    const event =
        entry.event;


    const show =
        entry.show;


    const venue =
        entry.venue;


    const status =
        getWaitlistStatusVisual(
            entry
        );


    const title =
        event?.title ||
        entry.eventTitle ||
        "SKYRA Event";


    const location =
        venue
            ? `${
                venue.shortName ||
                venue.name ||
                "Venue"
            }${
                venue.city
                    ? `, ${
                        venue.city
                    }`
                    : ""
            }`
            : "Venue TBA";


    const isWaiting =
        entry.status ===
        "WAITING";


    const isOffered =
        entry.status ===
        "OFFERED";


    const canLeave =
        isWaiting;


    return `

        <article
            class="
                waitlist-entry-card
                ${
                    isOffered
                        ? "offer-active"
                        : entry.status
                            .toLowerCase()
                }
            "
            data-waitlist-entry="${escapeWaitlistAttribute(
                entry.id
            )}"
        >


            <div
                class="
                    waitlist-event-poster
                    ${getWaitlistPosterClass(
                        event?.id ||
                        event?._id
                    )}
                "
            >

                <div>

                    <small>
                        ${escapeWaitlistHTML(
                            getWaitlistPosterEyebrow(
                                event?.type
                            )
                        )}
                    </small>

                    <strong>
                        ${escapeWaitlistHTML(
                            getWaitlistPosterWord(
                                title
                            )
                        )}
                    </strong>

                </div>

            </div>


            <div class="waitlist-entry-main">


                <div class="waitlist-entry-heading">

                    <div>

                        <div class="waitlist-entry-badges">

                            <span
                                class="
                                    waitlist-status-badge
                                    ${status.className}
                                "
                            >

                                <i
                                    data-lucide="${status.icon}"
                                ></i>

                                ${escapeWaitlistHTML(
                                    status.label
                                )}

                            </span>


                            <span
                                class="waitlist-category-badge"
                            >
                                ${escapeWaitlistHTML(
                                    entry.category
                                )}
                            </span>

                        </div>


                        <h2>
                            ${escapeWaitlistHTML(
                                title
                            )}
                        </h2>


                        <p>
                            ${escapeWaitlistHTML(
                                location
                            )}
                        </p>

                    </div>


                    ${
                        isWaiting
                            ? `

                                <div
                                    class="waitlist-position-box"
                                >

                                    <span>
                                        Your Position
                                    </span>

                                    <strong>
                                        ${
                                            entry.position
                                                ? `#${
                                                    entry.position
                                                }`
                                                : "—"
                                        }
                                    </strong>

                                </div>

                            `
                            : ""
                    }

                </div>


                <div class="waitlist-entry-meta">


                    <div>

                        <i data-lucide="calendar-days"></i>

                        <span>

                            <small>
                                Show Date
                            </small>

                            <strong>
                                ${escapeWaitlistHTML(
                                    formatWaitlistDate(
                                        show?.date ||
                                        entry.date
                                    )
                                )}
                            </strong>

                        </span>

                    </div>


                    <div>

                        <i data-lucide="clock"></i>

                        <span>

                            <small>
                                Time
                            </small>

                            <strong>
                                ${escapeWaitlistHTML(
                                    formatWaitlistTime(
                                        show?.time ||
                                        entry.time
                                    )
                                )}
                            </strong>

                        </span>

                    </div>


                    <div>

                        <i data-lucide="layers-3"></i>

                        <span>

                            <small>
                                Category
                            </small>

                            <strong>
                                ${escapeWaitlistHTML(
                                    entry.category
                                )}
                            </strong>

                        </span>

                    </div>

                </div>


                ${
                    isWaiting
                        ? createWaitlistPositionProgress(
                            entry
                        )
                        : ""
                }


                ${
                    isOffered
                        ? createWaitlistOfferHTML(
                            entry
                        )
                        : ""
                }


                <div class="waitlist-entry-footer">

                    <div class="waitlist-joined-info">

                        <i data-lucide="calendar-plus"></i>

                        ${
                            entry.joinedAt
                                ? `Joined ${
                                    escapeWaitlistHTML(
                                        formatWaitlistDate(
                                            entry.joinedAt
                                        )
                                    )
                                }`
                                : "Waitlist entry"
                        }

                    </div>


                    <div class="waitlist-entry-actions">

                        ${
                            isOffered
                                ? `

                                    <button
                                        type="button"
                                        class="btn btn-primary"
                                        data-claim-offer="${escapeWaitlistAttribute(
                                            entry.id
                                        )}"
                                    >

                                        <i data-lucide="ticket-check"></i>

                                        Claim Offer

                                    </button>

                                `
                                : ""
                        }


                        ${
                            canLeave
                                ? `

                                    <button
                                        type="button"
                                        class="btn btn-outline"
                                        data-leave-waitlist="${escapeWaitlistAttribute(
                                            entry.id
                                        )}"
                                    >

                                        Leave Waitlist

                                    </button>

                                `
                                : ""
                        }


                        ${
                            entry.status ===
                            "CLAIMED"
                                ? `

                                    <a
                                        href="./my-bookings.html"
                                        class="btn btn-outline"
                                    >
                                        View Bookings
                                    </a>

                                `
                                : ""
                        }

                    </div>

                </div>

            </div>

        </article>

    `;

}


/* =========================================================
   24. POSITION PROGRESS
   ========================================================= */

function createWaitlistPositionProgress(
    entry
) {

    const position =
        entry.position ||
        10;


    const progress =
        Math.max(
            10,
            Math.min(
                95,
                100 -
                (
                    position -
                    1
                ) *
                11
            )
        );


    return `

        <div class="waitlist-position-progress">

            <div
                class="waitlist-position-progress-header"
            >

                <span>
                    Queue progress
                </span>

                <strong>
                    ${
                        entry.position
                            ? `Position #${
                                entry.position
                            }`
                            : "Waiting"
                    }
                </strong>

            </div>


            <div class="waitlist-position-track">

                <span
                    style="width:${progress}%"
                ></span>

            </div>

        </div>

    `;

}


/* =========================================================
   25. OFFER HTML
   ========================================================= */

function createWaitlistOfferHTML(
    entry
) {

    return `

        <div class="waitlist-offer-box">

            <div class="waitlist-offer-copy">

                <span>
                    Ticket Available
                </span>

                <strong>
                    A limited-time booking offer is ready.
                </strong>

                <p>
                    Complete the booking before this offer expires.
                </p>

            </div>


            <div class="waitlist-offer-timer">

                <span>
                    Offer expires in
                </span>

                <strong
                    data-offer-countdown="${escapeWaitlistAttribute(
                        entry.id
                    )}"
                >
                    --:--
                </strong>

            </div>

        </div>

    `;

}


/* =========================================================
   26. STATUS VISUAL
   ========================================================= */

function getWaitlistStatusVisual(
    entry
) {

    switch (
        entry.status
    ) {

        case "OFFERED":

            return {

                label:
                    "Offer Available",

                className:
                    "offered",

                icon:
                    "ticket-check"

            };


        case "CLAIMED":

            return {

                label:
                    "Claimed",

                className:
                    "claimed",

                icon:
                    "badge-check"

            };


        case "EXPIRED":

            return {

                label:
                    "Offer Expired",

                className:
                    "expired",

                icon:
                    "timer-off"

            };


        case "LEFT":

            return {

                label:
                    "Left Waitlist",

                className:
                    "left",

                icon:
                    "user-minus"

            };


        default:

            return {

                label:
                    "Waiting",

                className:
                    "waiting",

                icon:
                    "clock-3"

            };

    }

}


/* =========================================================
   27. RENDERED ACTIONS
   ========================================================= */

function initializeRenderedWaitlistActions() {

    document
        .querySelectorAll(
            "[data-leave-waitlist]"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    () => {

                        openLeaveWaitlistModal(
                            button.dataset
                                .leaveWaitlist
                        );

                    }
                );

            }
        );


    document
        .querySelectorAll(
            "[data-claim-offer]"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    () => {

                        claimWaitlistOffer(
                            button.dataset
                                .claimOffer
                        );

                    }
                );

            }
        );

}


/* =========================================================
   28. OFFER COUNTDOWN
   ========================================================= */

function startWaitlistOfferCountdowns() {

    window.clearInterval(
        skyraWaitlistState
            .countdownInterval
    );


    updateAllOfferCountdowns();


    skyraWaitlistState.countdownInterval =
        window.setInterval(
            updateAllOfferCountdowns,
            1000
        );

}


/* =========================================================
   29. UPDATE ALL COUNTDOWNS
   ========================================================= */

function updateAllOfferCountdowns() {

    let summaryChanged =
        false;


    skyraWaitlistState
        .entries
        .forEach(
            (entry) => {

                if (
                    entry.status !==
                    "OFFERED"
                ) {

                    return;

                }


                const element =
                    document.querySelector(
                        `[data-offer-countdown="${cssEscapeWaitlist(
                            entry.id
                        )}"]`
                    );


                if (
                    !entry.offerExpiresAt
                ) {

                    if (element) {

                        element.textContent =
                            "Active";

                    }


                    return;

                }


                const expires =
                    new Date(
                        entry.offerExpiresAt
                    ).getTime();


                const remaining =
                    expires -
                    Date.now();


                if (
                    !Number.isFinite(
                        remaining
                    ) ||
                    remaining <= 0
                ) {

                    if (
                        entry.status ===
                        "OFFERED"
                    ) {

                        handleLocalOfferExpiry(
                            entry
                        );


                        summaryChanged =
                            true;

                    }


                    return;

                }


                if (!element) {

                    return;

                }


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


                element.textContent =
                    `${
                        String(
                            minutes
                        ).padStart(
                            2,
                            "0"
                        )
                    }:${
                        String(
                            seconds
                        ).padStart(
                            2,
                            "0"
                        )
                    }`;


                element.classList.toggle(
                    "warning",
                    remaining <=
                        5 *
                        60 *
                        1000
                );


                element.classList.toggle(
                    "danger",
                    remaining <=
                        60 *
                        1000
                );

            }
        );


    if (summaryChanged) {

        renderWaitlistSummary();

        applyWaitlistFilters();

    }

}


/* =========================================================
   30. ACTIVE OFFER CHECK
   ========================================================= */

function isOfferStillActive(
    entry
) {

    if (
        entry.status !==
        "OFFERED"
    ) {

        return false;

    }


    if (
        !entry.offerExpiresAt
    ) {

        return true;

    }


    const expiry =
        new Date(
            entry.offerExpiresAt
        ).getTime();


    return (
        Number.isFinite(
            expiry
        ) &&
        expiry >
            Date.now()
    );

}


/* =========================================================
   31. LOCAL OFFER EXPIRY

   Frontend simulation only.
   Backend controls real offer expiry.
   ========================================================= */

async function handleLocalOfferExpiry(
    entry
) {

    const now =
        Date.now();

    if (
        skyraWaitlistState
            .expiryRefreshPending ||
        now -
            skyraWaitlistState
                .lastExpiryRefreshAt <
            5000
    ) {
        return;
    }

    skyraWaitlistState
        .expiryRefreshPending =
        true;

    skyraWaitlistState
        .lastExpiryRefreshAt =
        now;

    try {

        const entryId =
            entry.id;

        await loadWaitlistEntries();

        const refreshedEntry =
            getWaitlistEntryById(
                entryId
            );

        if (
            !refreshedEntry ||
            refreshedEntry.status !==
                "OFFERED" ||
            !isOfferStillActive(
                refreshedEntry
            )
        ) {
            const modal =
                document.getElementById(
                    "waitlistOfferExpiredModal"
                );

            if (modal) {
                modal.hidden =
                    false;
            }

            refreshWaitlistIcons();
        }

    } catch (error) {

        console.error(
            "Unable to refresh expired waitlist offer:",
            error
        );

    } finally {

        skyraWaitlistState
            .expiryRefreshPending =
            false;
    }
}


/* =========================================================
   32. CLAIM OFFER
   ========================================================= */

async function claimWaitlistOffer(
    entryId
) {

    const entry =
        getWaitlistEntryById(
            entryId
        );

    if (!entry) {
        return;
    }

    if (
        !isOfferStillActive(
            entry
        )
    ) {
        await handleLocalOfferExpiry(
            entry
        );
        return;
    }

    if (
        !window.SKYRA_API ||
        typeof window.SKYRA_API
            .claimWaitlistOffer !==
            "function"
    ) {
        showWaitlistToast(
            "Waitlist offer API is unavailable.",
            "error",
            "Offer Unavailable"
        );
        return;
    }

    try {

        const response =
            await window.SKYRA_API
                .claimWaitlistOffer(
                    entry.offerId ||
                    entry.id
                );

        const hold =
            response?.data?.hold ||
            response?.hold;

        if (!hold) {
            throw new Error(
                "The server did not return a seat hold."
            );
        }

        try {
            sessionStorage.setItem(
                "skyra_active_seat_hold",
                JSON.stringify(
                    hold
                )
            );
        } catch {
            /* Optional storage. */
        }

        const holdId =
            hold.id ||
            hold._id;

        window.location.href =
            `./checkout.html?hold=${
                encodeURIComponent(
                    holdId
                )
            }&show=${
                encodeURIComponent(
                    entry.showId
                )
            }`;

    } catch (error) {

        showWaitlistToast(
            error?.message ||
            "This offer could not be claimed.",
            "error",
            "Offer Unavailable"
        );

        await loadWaitlistEntries();
    }
}


/* =========================================================
   33. LEAVE WAITLIST MODAL
   ========================================================= */

function initializeWaitlistModals() {

    document
        .getElementById(
            "closeLeaveWaitlistModal"
        )
        ?.addEventListener(
            "click",
            closeLeaveWaitlistModal
        );


    document
        .getElementById(
            "keepWaitlistButton"
        )
        ?.addEventListener(
            "click",
            closeLeaveWaitlistModal
        );


    document
        .getElementById(
            "confirmLeaveWaitlistButton"
        )
        ?.addEventListener(
            "click",
            confirmLeaveWaitlist
        );


    document
        .getElementById(
            "leaveWaitlistModal"
        )
        ?.addEventListener(
            "click",
            (event) => {

                if (
                    event.target.id ===
                    "leaveWaitlistModal"
                ) {

                    closeLeaveWaitlistModal();

                }

            }
        );


    document
        .getElementById(
            "closeWaitlistOfferExpiredButton"
        )
        ?.addEventListener(
            "click",
            () => {

                const modal =
                    document.getElementById(
                        "waitlistOfferExpiredModal"
                    );


                if (modal) {

                    modal.hidden =
                        true;

                }

            }
        );

}


/* =========================================================
   34. OPEN LEAVE MODAL
   ========================================================= */

function openLeaveWaitlistModal(
    entryId
) {

    skyraWaitlistState.leavingEntryId =
        entryId;


    const modal =
        document.getElementById(
            "leaveWaitlistModal"
        );


    if (modal) {

        modal.hidden =
            false;

    }


    refreshWaitlistIcons();

}


/* =========================================================
   35. CLOSE LEAVE MODAL
   ========================================================= */

function closeLeaveWaitlistModal() {

    skyraWaitlistState.leavingEntryId =
        null;


    const modal =
        document.getElementById(
            "leaveWaitlistModal"
        );


    if (modal) {

        modal.hidden =
            true;

    }

}


/* =========================================================
   36. CONFIRM LEAVE
   ========================================================= */

async function confirmLeaveWaitlist() {

    const entryId =
        skyraWaitlistState
            .leavingEntryId;

    if (!entryId) {
        return;
    }

    const button =
        document.getElementById(
            "confirmLeaveWaitlistButton"
        );

    if (button) {
        button.disabled =
            true;
    }

    try {

        if (
            !window.SKYRA_API ||
            typeof window.SKYRA_API
                .leaveWaitlist !==
                "function"
        ) {
            throw new Error(
                "Waitlist API is unavailable."
            );
        }

        await window.SKYRA_API
            .leaveWaitlist(
                entryId
            );

        closeLeaveWaitlistModal();

        await loadWaitlistEntries();

        updateWaitlistIndicators();

        showWaitlistToast(
            "You have left the waitlist.",
            "success",
            "Waitlist Updated"
        );

    } catch (error) {

        showWaitlistToast(
            error?.message ||
            "Unable to leave this waitlist.",
            "error",
            "Update Failed"
        );

    } finally {

        if (button) {
            button.disabled =
                false;
        }
    }
}




/* =========================================================
   38. GET ENTRY
   ========================================================= */

function getWaitlistEntryById(
    id
) {

    return skyraWaitlistState
        .entries
        .find(
            (entry) =>
                entry.id ===
                id
        ) ||
        null;

}


/* =========================================================
   39. USER
   ========================================================= */

function initializeWaitlistUser() {

    const user =
        window.SKYRA_COMMON
            ?.getUser?.();


    if (!user) {

        return;

    }


    const name =
        String(
            user.name ||
            user.fullName ||
            "Customer"
        );


    const initials =
        window.SKYRA_COMMON
            ?.createInitials?.(
                name
            ) ||
        createWaitlistInitials(
            name
        );


    setWaitlistText(
        "sidebarUserName",
        name
    );


    setWaitlistText(
        "sidebarUserInitials",
        initials
    );


    setWaitlistText(
        "topbarUserName",
        name
    );


    setWaitlistText(
        "topbarUserInitials",
        initials
    );


    setWaitlistText(
        "dropdownUserName",
        name
    );


    setWaitlistText(
        "dropdownUserInitials",
        initials
    );


    if (user.email) {

        setWaitlistText(
            "dropdownUserEmail",
            user.email
        );

    }

}


/* =========================================================
   40. INITIALS
   ========================================================= */

function createWaitlistInitials(
    name
) {

    const parts =
        String(name)
            .trim()
            .split(/\s+/)
            .filter(Boolean);


    if (!parts.length) {

        return "SK";

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
            parts.length - 1
        ][0]
    ).toUpperCase();

}


/* =========================================================
   41. INDICATORS
   ========================================================= */
function updateWaitlistIndicators() {
    window.SKYRA_COMMON?.refreshCustomerIndicators?.();
}

/* =========================================================
   42. TOPBAR SEARCH
   ========================================================= */

function initializeWaitlistTopbarSearch() {

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


                const value =
                    event.target.value
                        .trim();


                if (!value) {

                    return;

                }


                window.location.href =
                    `./events.html?search=${
                        encodeURIComponent(
                            value
                        )
                    }`;

            }
        );

}


/* =========================================================
   43. ACTIVE NAVIGATION
   ========================================================= */

function keepWaitlistNavigationActive() {

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
                    "./waitlist.html";


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
   44. POSTER CLASS
   ========================================================= */

function getWaitlistPosterClass(
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
        "events-poster-arijit"
    );

}


/* =========================================================
   45. POSTER WORD
   ========================================================= */

function getWaitlistPosterWord(
    title
) {

    return String(
        title ||
        "SKYRA"
    )
        .split(/\s+/)
        .slice(
            0,
            2
        )
        .join(" ")
        .toUpperCase();

}


/* =========================================================
   46. POSTER EYEBROW
   ========================================================= */

function getWaitlistPosterEyebrow(
    type
) {

    switch (
        String(
            type ||
            ""
        ).toUpperCase()
    ) {

        case "MOVIE":

            return "CINEMA EXPERIENCE";


        case "CONCERT":

            return "LIVE IN CONCERT";


        case "LIVE_SHOW":

            return "LIVE SHOW";


        default:

            return "SKYRA EVENT";

    }

}


/* =========================================================
   47. DATE
   ========================================================= */

function formatWaitlistDate(
    value
) {

    const date =
        parseWaitlistDate(
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
   48. DATE PARSER
   ========================================================= */

function parseWaitlistDate(
    value
) {

    if (!value) {

        return null;

    }


    if (
        typeof value ===
            "string" &&
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
   49. TIME
   ========================================================= */

function formatWaitlistTime(
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

        return String(
            value
        );

    }


    const [
        hoursValue,
        minutes
    ] =
        value
            .split(":")
            .map(Number);


    const period =
        hoursValue >=
            12
            ? "PM"
            : "AM";


    const hours =
        hoursValue %
        12 ||
        12;


    return `${
        hours
    }:${
        String(
            minutes
        ).padStart(
            2,
            "0"
        )
    } ${period}`;

}


/* =========================================================
   50. TEXT
   ========================================================= */

function setWaitlistText(
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
   51. ESCAPE HTML
   ========================================================= */

function escapeWaitlistHTML(
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
   52. ATTRIBUTE ESCAPE
   ========================================================= */

function escapeWaitlistAttribute(
    value
) {

    return escapeWaitlistHTML(
        value
    );

}


/* =========================================================
   53. CSS ESCAPE
   ========================================================= */

function cssEscapeWaitlist(
    value
) {

    if (
        window.CSS &&
        typeof window.CSS.escape ===
            "function"
    ) {

        return window.CSS.escape(
            String(
                value
            )
        );

    }


    return String(
        value
    ).replace(
        /["\\]/g,
        "\\$&"
    );

}


/* =========================================================
   54. TOAST
   ========================================================= */

function showWaitlistToast(
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
   55. DELAY
   ========================================================= */

function waitlistDelay(
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
   56. ICONS
   ========================================================= */

function refreshWaitlistIcons() {

    if (
        typeof lucide !==
        "undefined"
    ) {

        lucide.createIcons();

    }

}


/* =========================================================
   57. ESCAPE KEY
   ========================================================= */

document.addEventListener(
    "keydown",
    (event) => {

        if (
            event.key ===
            "Escape"
        ) {

            closeLeaveWaitlistModal();

        }

    }
);


/* =========================================================
   58. CLEANUP
   ========================================================= */

window.addEventListener(
    "beforeunload",
    () => {

        window.clearInterval(
            skyraWaitlistState
                .countdownInterval
        );

    }
);


/* =========================================================
   59. PUBLIC API
   ========================================================= */

window.SKYRA_WAITLIST_PAGE = {

    getEntries:
        () =>
            skyraWaitlistState
                .entries
                .map(
                    (entry) => ({
                        ...entry
                    })
                ),

    refresh:
        loadWaitlistEntries,

    claimOffer:
        claimWaitlistOffer,

    leave:
        openLeaveWaitlistModal

};


/* =========================================================
   END OF SKYRA WAITLIST
   ========================================================= */