/* =========================================================
   SKYRA - CUSTOMER CHECKOUT
   File: frontend/js/customer/checkout.js

   Used by:
   - customer/checkout.html

   Phase 14:
   - Keeps the real SeatHold + Razorpay flow from Phase 13
   - Verifies the captured Razorpay payment on the backend
   - Creates a real Booking from the VERIFIED Payment
   - Converts ShowSeats HELD -> BOOKED transactionally
   - Converts SeatHold ACTIVE -> CONSUMED
   - Redirects to booking-success.html with the real Booking ID
   ========================================================= */

"use strict";


/* =========================================================
   1. CONSTANTS
   ========================================================= */

const SKYRA_CHECKOUT = {

    HOLD_STORAGE_KEY:
        "skyra_active_seat_hold",

    BOOKING_STORAGE_KEY:
        "skyra_latest_booking",

    HOLD_MINUTES:
        10,

    DEFAULT_CONVENIENCE_FEE:
        99

};


/* =========================================================
   2. CHECKOUT STATE
   ========================================================= */

const skyraCheckoutState = {

    holdId:
        null,

    hold:
        null,

    show:
        null,

    event:
        null,

    venue:
        null,

    subtotal:
        0,

    convenienceFee:
        SKYRA_CHECKOUT
            .DEFAULT_CONVENIENCE_FEE,

    grandTotal:
        0,

    countdownInterval:
        null,

    paymentProcessing:
        false,

    lastPaymentOrder:
        null,

    verifiedPayment:
        null,

    booking:
        null

};


/* =========================================================
   3. DOM READY
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initializeCheckoutPage();

    }
);


/* =========================================================
   4. INITIALIZE
   ========================================================= */

async function initializeCheckoutPage() {

    initializeCheckoutUser();

    updateCheckoutAccountIndicators();

    initializeCheckoutSearch();

    initializeCheckoutForms();

    initializeCheckoutButtons();

    initializeCheckoutModals();


    const params =
        new URLSearchParams(
            window.location.search
        );


    const holdId =
        params.get("hold");


    const showId =
        params.get("show");


    await loadCheckout(
        holdId,
        showId
    );


    refreshCheckoutIcons();

}


/* =========================================================
   5. LOAD CHECKOUT - PHASE 11 BACKEND
   ========================================================= */

async function loadCheckout(
    holdId,
    requestedShowId
) {

    const resolvedHoldId =
        String(
            holdId ||
            getStoredCheckoutHoldId() ||
            ""
        ).trim();


    if (!resolvedHoldId) {

        showInvalidCheckout(
            "Seat hold unavailable",
            "No active SeatHold was supplied. Select your seats again.",
            requestedShowId
        );

        return;

    }


    let hold;


    try {

        hold =
            await getCheckoutHold(
                resolvedHoldId
            );

    } catch (error) {

        console.error(
            "Unable to load SeatHold:",
            error
        );


        showInvalidCheckout(
            "Seat hold unavailable",
            error?.message ||
            "Your seat hold could not be found. Please select your seats again.",
            requestedShowId
        );

        return;

    }


    if (
        !hold ||
        !isCheckoutHoldActive(
            hold
        )
    ) {

        clearCheckoutHoldStorage();


        showInvalidCheckout(
            "Your seat hold expired",
            "These seats are no longer reserved. Return to the seat map and select available seats again.",
            hold?.showId ||
            requestedShowId
        );

        return;

    }


    const showId =
        String(
            hold.showId ||
            requestedShowId ||
            ""
        );


    try {

        const showResponse =
            await window.SKYRA_API
                .getCustomerShow(
                    showId
                );


        const show =
            showResponse?.data?.show ||
            null;


        if (!show) {

            throw new Error(
                "The Show connected to this SeatHold could not be found."
            );

        }


        const eventResponse =
            await window.SKYRA_API
                .getCustomerEvent(
                    show.eventId
                );


        const event =
            eventResponse?.data?.event ||
            null;


        if (!event) {

            throw new Error(
                "The Event connected to this SeatHold could not be found."
            );

        }


        const normalizedShow = {

            ...show,

            id:
                String(
                    show._id ||
                    show.id
                ),

            _id:
                String(
                    show._id ||
                    show.id
                ),

            eventId:
                String(
                    show.eventId
                ),

            venueId:
                String(
                    show.venueId ||
                    show.venue?._id ||
                    show.venue?.id ||
                    ""
                )
        };


        const normalizedEvent = {

            ...event,

            id:
                String(
                    event._id ||
                    event.id
                ),

            _id:
                String(
                    event._id ||
                    event.id
                )
        };


        const venue =
            normalizedShow.venue ||
            hold.venue ||
            {
                id:
                    normalizedShow.venueId,

                _id:
                    normalizedShow.venueId,

                name:
                    normalizedShow.venueName ||
                    "Venue",

                shortName:
                    normalizedShow.venueName ||
                    "Venue",

                city:
                    normalizedShow.venueCity ||
                    ""
            };


        skyraCheckoutState.holdId =
            hold.id ||
            hold._id ||
            resolvedHoldId;


        skyraCheckoutState.hold =
            normalizeCheckoutHold(
                hold,
                normalizedShow
            );


        skyraCheckoutState.show =
            normalizedShow;


        skyraCheckoutState.event =
            normalizedEvent;


        skyraCheckoutState.venue =
            venue;


        saveCheckoutHoldPointer(
            skyraCheckoutState.hold
        );


        calculateCheckoutPricing();

        hideInvalidCheckout();

        renderCheckout();

        startCheckoutCountdown();

        keepCheckoutExploreActive();

    } catch (error) {

        console.error(
            "Unable to prepare checkout:",
            error
        );


        showInvalidCheckout(
            "Checkout unavailable",
            error?.message ||
            "The booking information connected to this hold could not be loaded.",
            showId
        );

    }

}


/* =========================================================
   5.1 STORED HOLD POINTER
   ========================================================= */

function getStoredCheckoutHoldId() {

    try {

        const stored =
            sessionStorage.getItem(
                SKYRA_CHECKOUT
                    .HOLD_STORAGE_KEY
            );


        if (!stored) {

            return "";

        }


        const parsed =
            JSON.parse(
                stored
            );


        return String(
            parsed?.id ||
            parsed?._id ||
            ""
        );

    } catch {

        return "";

    }

}


/* =========================================================
   5.2 SAVE HOLD POINTER
   ========================================================= */

function saveCheckoutHoldPointer(
    hold
) {

    try {

        sessionStorage.setItem(
            SKYRA_CHECKOUT
                .HOLD_STORAGE_KEY,

            JSON.stringify(
                hold
            )
        );

    } catch {

        /* Backend remains the source of truth. */

    }

}


/* =========================================================
   6. GET HOLD - PHASE 11 BACKEND
   ========================================================= */

async function getCheckoutHold(
    requestedHoldId
) {

    if (
        !requestedHoldId ||
        !window.SKYRA_API ||
        typeof window.SKYRA_API
            .getSeatHold !==
            "function"
    ) {

        return null;

    }


    const response =
        await window.SKYRA_API
            .getSeatHold(
                requestedHoldId
            );


    return (
        response?.data?.hold ||
        response?.hold ||
        null
    );

}





/* =========================================================
   8. NORMALIZE HOLD
   ========================================================= */

function normalizeCheckoutHold(
    hold,
    show
) {

    const rawSeats =
        Array.isArray(
            hold.seats
        )
            ? hold.seats
            : [];


    const seats =
        rawSeats.map(
            (
                seat,
                index
            ) => {

                const category =
                    seat.category ||
                    seat.categoryName ||
                    show.seatCategories?.[0]
                        ?.name ||
                    "Standard";


                return {

                    id:
                        String(
                            seat.id ||
                            seat._id ||
                            seat.showSeatId ||
                            `seat_${index + 1}`
                        ),

                    label:
                        String(
                            seat.label ||
                            seat.seatLabel ||
                            `${seat.row || ""}${
                                seat.number ||
                                index + 1
                            }`
                        ),

                    row:
                        seat.row ||
                        null,

                    number:
                        seat.number ||
                        null,

                    category,

                    price:
                        Number(
                            seat.price ??
                            getCheckoutCategoryPrice(
                                show,
                                category
                            ) ??
                            0
                        )

                };

            }
        );


    return {

        ...hold,

        id:
            hold.id ||
            hold._id,

        showId:
            hold.showId ||
            show.id,

        seats,

        status:
            String(
                hold.status ||
                "ACTIVE"
            ).toUpperCase()

    };

}


/* =========================================================
   9. HOLD ACTIVE CHECK
   ========================================================= */

function isCheckoutHoldActive(
    hold
) {

    if (!hold) {

        return false;

    }


    const status =
        String(
            hold.status ||
            "ACTIVE"
        ).toUpperCase();


    if (
        [
            "EXPIRED",
            "RELEASED",
            "CANCELLED",
            "COMPLETED"
        ].includes(
            status
        )
    ) {

        return false;

    }


    const expiresAt =
        new Date(
            hold.expiresAt
        ).getTime();


    return (
        Number.isFinite(
            expiresAt
        ) &&
        expiresAt >
            Date.now()
    );

}





/* =========================================================
   13. CATEGORY PRICE
   ========================================================= */

function getCheckoutCategoryPrice(
    show,
    category
) {

    return show
        ?.seatCategories
        ?.find(
            (item) =>
                String(
                    item.name
                ).toLowerCase() ===
                String(
                    category
                ).toLowerCase()
        )
        ?.price ??
        null;

}


/* =========================================================
   14. PRICING
   ========================================================= */

function calculateCheckoutPricing() {

    const hold =
        skyraCheckoutState.hold;


    if (!hold) {

        return;

    }


    const calculatedSubtotal =
        hold.seats.reduce(
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


    skyraCheckoutState.subtotal =
        Number(
            hold.subtotal ??
            calculatedSubtotal
        );


    skyraCheckoutState.convenienceFee =
        Number(
            hold.convenienceFee ??
            SKYRA_CHECKOUT
                .DEFAULT_CONVENIENCE_FEE
        );


    skyraCheckoutState.grandTotal =
        skyraCheckoutState.subtotal +
        skyraCheckoutState
            .convenienceFee;

}


/* =========================================================
   15. RENDER CHECKOUT
   ========================================================= */

function renderCheckout() {

    renderCheckoutEvent();

    renderCheckoutSeats();

    renderCheckoutPricing();

    renderCheckoutHoldReference();

    renderCheckoutContact();

    updateCheckoutNavigation();

    updateCheckoutDocumentTitle();

    refreshCheckoutIcons();

}


/* =========================================================
   16. EVENT
   ========================================================= */

function renderCheckoutEvent() {

    const {
        event,
        show,
        venue
    } =
        skyraCheckoutState;


    if (
        !event ||
        !show
    ) {

        return;

    }


    setCheckoutText(
        "checkoutEventTitle",
        event.title
    );


    setCheckoutText(
        "checkoutEventDate",
        formatCheckoutDate(
            show.date
        )
    );


    setCheckoutText(
        "checkoutEventTime",
        formatCheckoutTime(
            show.time
        )
    );


    setCheckoutText(

        "checkoutEventVenue",

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


    renderCheckoutEventType();

    renderCheckoutPoster();

}


/* =========================================================
   17. EVENT TYPE
   ========================================================= */

function renderCheckoutEventType() {

    const event =
        skyraCheckoutState.event;


    const element =
        document.getElementById(
            "checkoutEventType"
        );


    if (
        !event ||
        !element
    ) {

        return;

    }


    element.innerHTML = `

        <i
            data-lucide="${getCheckoutEventIcon(
                event.type
            )}"
        ></i>

        ${escapeCheckoutHTML(
            formatCheckoutEventType(
                event.type
            )
        )}

    `;

}


/* =========================================================
   18. POSTER
   ========================================================= */

function renderCheckoutPoster() {

    const event =
        skyraCheckoutState.event;


    const poster =
        document.getElementById(
            "checkoutEventPoster"
        );


    const content =
        document.getElementById(
            "checkoutEventPosterContent"
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
        getCheckoutPosterClass(
            event.id
        )
    );


    content.innerHTML =
        getCheckoutPosterContent(
            event
        );

}


/* =========================================================
   19. POSTER CLASS
   ========================================================= */

function getCheckoutPosterClass(
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
   20. POSTER CONTENT
   ========================================================= */

function getCheckoutPosterContent(
    event
) {

    switch (event.id) {

        case "coldplay":

            return `
                <small>MUSIC OF THE SPHERES</small>
                <strong>COLDPLAY</strong>
                <span>LIVE 2026</span>
            `;


        case "diljit":

            return `
                <small>INDIA TOUR</small>
                <strong>DILJIT</strong>
                <span>DOSANJH</span>
            `;


        case "interstellar":

            return `
                <small>IMAX EXPERIENCE</small>
                <strong>INTERSTELLAR</strong>
                <span>SCIENCE BEYOND TIME</span>
            `;


        case "arijit":

            return `
                <small>LIVE IN CONCERT</small>
                <strong>ARIJIT</strong>
                <span>SINGH</span>
            `;


        case "comedy-night":

            return `
                <small>LIVE COMEDY</small>
                <strong>COMEDY</strong>
                <span>NIGHT</span>
            `;


        case "avengers-secret-wars":

            return `
                <small>MARVEL STUDIOS</small>
                <strong>AVENGERS</strong>
                <span>SECRET WARS</span>
            `;


        default:

            return `
                <small>SKYRA EXPERIENCE</small>

                <strong>
                    ${escapeCheckoutHTML(
                        event.title
                    )}
                </strong>
            `;

    }

}


/* =========================================================
   21. RENDER SEATS
   ========================================================= */

function renderCheckoutSeats() {

    const hold =
        skyraCheckoutState.hold;


    const container =
        document.getElementById(
            "checkoutSeatList"
        );


    if (
        !hold ||
        !container
    ) {

        return;

    }


    const seats =
        hold.seats ||
        [];


    setCheckoutText(
        "checkoutSeatCount",
        seats.length
    );


    container.innerHTML =
        seats
            .map(
                (seat) => `

                    <article
                        class="checkout-seat-item"
                    >

                        <span
                            class="checkout-seat-symbol"
                        >
                            ${escapeCheckoutHTML(
                                seat.label
                            )}
                        </span>


                        <div>

                            <strong>
                                Seat ${escapeCheckoutHTML(
                                    seat.label
                                )}
                            </strong>

                            <span>
                                ${escapeCheckoutHTML(
                                    seat.category
                                )}
                            </span>

                        </div>


                        <strong>
                            ${escapeCheckoutHTML(
                                formatCheckoutCurrency(
                                    seat.price
                                )
                            )}
                        </strong>

                    </article>

                `
            )
            .join("");

}


/* =========================================================
   22. RENDER PRICING
   ========================================================= */

function renderCheckoutPricing() {

    const seatCount =
        skyraCheckoutState
            .hold
            ?.seats
            ?.length ||
        0;


    setCheckoutText(

        "checkoutOrderSeatLabel",

        `${seatCount} Ticket${
            seatCount === 1
                ? ""
                : "s"
        }`

    );


    setCheckoutText(
        "checkoutSubtotal",
        formatCheckoutCurrency(
            skyraCheckoutState
                .subtotal
        )
    );


    setCheckoutText(
        "checkoutConvenienceFee",
        formatCheckoutCurrency(
            skyraCheckoutState
                .convenienceFee
        )
    );


    setCheckoutText(
        "checkoutGrandTotal",
        formatCheckoutCurrency(
            skyraCheckoutState
                .grandTotal
        )
    );


    setCheckoutText(
        "payNowAmount",
        formatCheckoutCurrency(
            skyraCheckoutState
                .grandTotal
        )
    );

}


/* =========================================================
   23. HOLD REFERENCE
   ========================================================= */

function renderCheckoutHoldReference() {

    const hold =
        skyraCheckoutState.hold;


    if (!hold) {

        return;

    }


    setCheckoutText(

        "checkoutHoldReference",

        hold.id ||
        "Temporary Hold"

    );

}


/* =========================================================
   24. CONTACT
   ========================================================= */

function renderCheckoutContact() {

    const user =
        window.SKYRA_COMMON
            ?.getUser?.();


    if (!user) {

        return;

    }


    const email =
        document.getElementById(
            "checkoutEmail"
        );


    const phone =
        document.getElementById(
            "checkoutPhone"
        );


    if (
        email &&
        !email.value
    ) {

        email.value =
            user.email ||
            "";

    }


    if (
        phone &&
        !phone.value
    ) {

        phone.value =
            user.phone ||
            "";

    }

}


/* =========================================================
   25. CHECKOUT USER
   ========================================================= */

function initializeCheckoutUser() {

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
        ).trim();


    const initials =
        window.SKYRA_COMMON
            ?.createInitials?.(
                name
            ) ||
        createCheckoutInitials(
            name
        );


    setCheckoutText(
        "sidebarUserName",
        name
    );


    setCheckoutText(
        "sidebarUserInitials",
        initials
    );


    setCheckoutText(
        "topbarUserName",
        name
    );


    setCheckoutText(
        "topbarUserInitials",
        initials
    );


    setCheckoutText(
        "dropdownUserName",
        name
    );


    setCheckoutText(
        "dropdownUserInitials",
        initials
    );


    if (user.email) {

        setCheckoutText(
            "dropdownUserEmail",
            user.email
        );

    }

}


/* =========================================================
   26. INITIALS
   ========================================================= */

function createCheckoutInitials(
    name
) {

    const words =
        String(name || "")
            .trim()
            .split(/\s+/)
            .filter(Boolean);


    if (!words.length) {

        return "SK";

    }


    if (words.length === 1) {

        return words[0]
            .slice(
                0,
                2
            )
            .toUpperCase();

    }


    return (
        words[0][0] +
        words[
            words.length - 1
        ][0]
    ).toUpperCase();

}


/* =========================================================
   27. ACCOUNT INDICATORS
   ========================================================= */

function updateCheckoutAccountIndicators() {

    /*
       Waitlist and Notification APIs are later phases.
       Phase 11 checkout does not display mock counts.
    */

    setCheckoutText(
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
   28. COUNTDOWN
   ========================================================= */

function startCheckoutCountdown() {

    window.clearInterval(
        skyraCheckoutState
            .countdownInterval
    );


    updateCheckoutCountdown();


    skyraCheckoutState.countdownInterval =
        window.setInterval(
            updateCheckoutCountdown,
            1000
        );

}


/* =========================================================
   29. UPDATE COUNTDOWN
   ========================================================= */

function updateCheckoutCountdown() {

    const hold =
        skyraCheckoutState.hold;


    if (!hold) {

        return;

    }


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

        handleCheckoutHoldExpired();

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


    const countdown =
        document.getElementById(
            "checkoutHoldCountdown"
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


    const holdDuration =
        Number(
            hold.holdDurationMs ||
            (
                SKYRA_CHECKOUT
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
                (
                    remaining /
                    holdDuration
                ) *
                100
            )
        );


    const progress =
        document.getElementById(
            "checkoutHoldProgress"
        );


    if (progress) {

        progress.style.width =
            `${percentage}%`;

    }

}


/* =========================================================
   30. HOLD EXPIRED
   ========================================================= */

async function handleCheckoutHoldExpired() {

    window.clearInterval(
        skyraCheckoutState
            .countdownInterval
    );


    skyraCheckoutState.countdownInterval =
        null;


    const holdId =
        skyraCheckoutState.holdId;


    if (
        holdId &&
        window.SKYRA_API &&
        typeof window.SKYRA_API
            .releaseSeatHold ===
            "function"
    ) {

        try {

            await window.SKYRA_API
                .releaseSeatHold(
                    holdId
                );

        } catch (error) {

            console.warn(
                "Unable to reconcile expired SeatHold immediately:",
                error
            );

        }

    }


    clearCheckoutHoldStorage();


    const modal =
        document.getElementById(
            "holdExpiredModal"
        );


    if (modal) {

        modal.hidden =
            false;

    }


    setCheckoutText(
        "checkoutHoldCountdown",
        "00:00"
    );


    const progress =
        document.getElementById(
            "checkoutHoldProgress"
        );


    if (progress) {

        progress.style.width =
            "0%";

    }


    setCheckoutPaymentLoading(
        false
    );

}


/* =========================================================
   31. FORM INITIALIZATION
   ========================================================= */

function initializeCheckoutForms() {

    document
        .getElementById(
            "checkoutEmail"
        )
        ?.addEventListener(
            "input",
            () => {

                setCheckoutError(
                    "checkoutEmailError",
                    ""
                );

            }
        );


    document
        .getElementById(
            "checkoutPhone"
        )
        ?.addEventListener(
            "input",
            () => {

                setCheckoutError(
                    "checkoutPhoneError",
                    ""
                );

            }
        );


    document
        .getElementById(
            "acceptBookingTerms"
        )
        ?.addEventListener(
            "change",
            () => {

                setCheckoutError(
                    "checkoutTermsError",
                    ""
                );

            }
        );

}


/* =========================================================
   32. VALIDATE CHECKOUT
   ========================================================= */

function validateCheckout() {

    const email =
        document
            .getElementById(
                "checkoutEmail"
            )
            ?.value
            .trim() ||
        "";


    const phone =
        document
            .getElementById(
                "checkoutPhone"
            )
            ?.value
            .trim() ||
        "";


    const accepted =
        document
            .getElementById(
                "acceptBookingTerms"
            )
            ?.checked ||
        false;


    let valid =
        true;


    if (
        !email ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/
            .test(
                email
            )
    ) {

        setCheckoutError(
            "checkoutEmailError",
            "Enter a valid email address."
        );


        valid =
            false;

    }


    if (phone) {

        const digits =
            phone.replace(
                /\D/g,
                ""
            );


        if (
            digits.length < 7 ||
            digits.length > 15
        ) {

            setCheckoutError(
                "checkoutPhoneError",
                "Enter a valid phone number."
            );


            valid =
                false;

        }

    }


    if (!accepted) {

        setCheckoutError(
            "checkoutTermsError",
            "Confirm the booking details before payment."
        );


        valid =
            false;

    }


    return {

        valid,

        email,

        phone

    };

}


/* =========================================================
   33. BUTTON INITIALIZATION
   ========================================================= */

function initializeCheckoutButtons() {

    document
        .getElementById(
            "payNowButton"
        )
        ?.addEventListener(
            "click",
            beginCheckoutPayment
        );


    document
        .getElementById(
            "retryPaymentButton"
        )
        ?.addEventListener(
            "click",
            () => {

                closePaymentErrorModal();

                beginCheckoutPayment();

            }
        );


    document
        .getElementById(
            "returnToSeatsButton"
        )
        ?.addEventListener(
            "click",
            returnToSeatSelection
        );


    document
        .getElementById(
            "checkoutChangeSeatsLink"
        )
        ?.addEventListener(
            "click",
            handleChangeSeats
        );


    document
        .getElementById(
            "checkoutBackLink"
        )
        ?.addEventListener(
            "click",
            handleChangeSeats
        );

}


/* =========================================================
   34. BEGIN PAYMENT - PHASE 13

   The SeatHold is real. The backend now creates a Razorpay Test
   Order and verifies the successful payment callback.
   ========================================================= */

async function beginCheckoutPayment() {

    if (
        skyraCheckoutState
            .paymentProcessing
    ) {

        return;

    }


    if (
        !skyraCheckoutState.hold ||
        !isCheckoutHoldActive(
            skyraCheckoutState.hold
        )
    ) {

        await handleCheckoutHoldExpired();

        return;

    }


    const validation =
        validateCheckout();


    if (
        !validation.valid
    ) {

        showCheckoutToast(
            "Check the required booking information.",
            "warning",
            "Review Checkout"
        );


        return;

    }


    if (
        !window.SKYRA_API ||
        typeof window.SKYRA_API
            .createPaymentOrder !==
            "function"
    ) {

        showPaymentError(
            "Payment API is unavailable. Make sure the Phase 13 common.js is loaded."
        );

        return;

    }


    setCheckoutPaymentLoading(
        true
    );


    try {

        const order =
            await createRealPaymentOrder(
                validation
            );


        skyraCheckoutState
            .lastPaymentOrder =
            order;


        await openRazorpayPayment(
            order,
            validation
        );

        setCheckoutPaymentLoading(
            false
        );

    } catch (error) {

        console.error(
            "Checkout payment error:",
            error
        );


        showPaymentError(
            error?.message ||
            "Payment could not be completed. You may retry while your seat hold remains active."
        );


        setCheckoutPaymentLoading(
            false
        );

    }

}


/* =========================================================
   35. CREATE REAL PAYMENT ORDER
   ========================================================= */

async function createRealPaymentOrder(
    contact
) {

    const response =
        await window.SKYRA_API
            .createPaymentOrder({

                holdId:
                    skyraCheckoutState
                        .holdId,

                showId:
                    skyraCheckoutState
                        .show
                        .id,

                email:
                    contact.email,

                phone:
                    contact.phone

            });


    return (
        response?.data?.order ||
        response?.order ||
        response?.data ||
        response
    );

}


/* =========================================================
   36. OPEN RAZORPAY
   ========================================================= */

function openRazorpayPayment(
    order,
    contact
) {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            if (
                typeof Razorpay ===
                "undefined"
            ) {

                reject(
                    new Error(
                        "Razorpay checkout could not be loaded."
                    )
                );


                return;

            }


            const razorpayOrderId =
                order.orderId ||
                order.razorpayOrderId ||
                order.id;


            const keyId =
                order.keyId ||
                order.razorpayKeyId ||
                order.key;


            if (
                !razorpayOrderId ||
                !keyId
            ) {

                reject(
                    new Error(
                        "Payment order information is incomplete."
                    )
                );


                return;

            }


            const options = {

                key:
                    keyId,

                order_id:
                    razorpayOrderId,

                amount:
                    order.amount,

                currency:
                    order.currency ||
                    "INR",

                name:
                    "SKYRA",

                description:
                    skyraCheckoutState
                        .event
                        ?.title ||
                    "SKYRA Ticket Booking",

                prefill: {

                    email:
                        contact.email,

                    contact:
                        contact.phone

                },

                notes: {

                    holdId:
                        skyraCheckoutState
                            .holdId

                },

                theme: {

                    color:
                        "#6366F1"

                },


                handler:
                    async (
                        paymentResponse
                    ) => {

                        try {

                            await verifyAndFinalizeRealPayment(
                                paymentResponse,
                                order,
                                contact
                            );


                            resolve();

                        } catch (error) {

                            reject(
                                error
                            );

                        }

                    },


                modal: {

                    ondismiss:
                        () => {

                            reject(
                                new Error(
                                    "Payment was cancelled. Your seats remain held while the timer is active."
                                )
                            );

                        }

                }

            };


            const gateway =
                new Razorpay(
                    options
                );


            gateway.on(
                "payment.failed",
                (response) => {

                    reject(
                        new Error(
                            response?.error
                                ?.description ||
                            "Payment failed. Please retry."
                        )
                    );

                }
            );


            gateway.open();

        }
    );

}


/* =========================================================
   37. VERIFY REAL PAYMENT
   ========================================================= */

async function verifyAndFinalizeRealPayment(
    paymentResponse,
    order,
    contact
) {

    if (
        !window.SKYRA_API ||
        typeof window.SKYRA_API
            .verifyPayment !==
            "function" ||
        typeof window.SKYRA_API
            .createBooking !==
            "function"
    ) {
        throw new Error(
            "Payment or Booking API is unavailable."
        );
    }

    openPaymentProcessingModal();

    updateProcessingStep(1);

    const response =
        await window.SKYRA_API
            .verifyPayment({
                holdId:
                    skyraCheckoutState
                        .holdId,

                razorpayOrderId:
                    paymentResponse
                        .razorpay_order_id,

                razorpayPaymentId:
                    paymentResponse
                        .razorpay_payment_id,

                razorpaySignature:
                    paymentResponse
                        .razorpay_signature,

                email:
                    contact.email,

                phone:
                    contact.phone
            });

    updateProcessingStep(2);

    const payment =
        response?.data?.payment ||
        response?.payment ||
        response?.data ||
        response;

    if (
        !payment ||
        String(
            payment.status || ""
        ).toUpperCase() !==
            "VERIFIED"
    ) {
        throw new Error(
            "Razorpay returned successfully, but the backend could not verify the captured payment."
        );
    }

    skyraCheckoutState
        .verifiedPayment =
        payment;

    const paymentId =
        payment._id ||
        payment.id;

    if (!paymentId) {
        throw new Error(
            "Verified Payment ID is missing."
        );
    }

    const bookingResponse =
        await window.SKYRA_API
            .createBooking({
                paymentId:
                    paymentId
            });

    const booking =
        bookingResponse?.data?.booking ||
        bookingResponse?.booking ||
        bookingResponse?.data ||
        bookingResponse;

    if (
        !booking ||
        String(
            booking.status || ""
        ).toUpperCase() !==
            "CONFIRMED"
    ) {
        throw new Error(
            "Payment was verified, but the Booking could not be confirmed."
        );
    }

    skyraCheckoutState.booking =
        booking;

    saveLatestBooking(
        booking
    );

    updateProcessingStep(3);

    window.setTimeout(
        () => {
            closePaymentProcessingModal();
            completeSuccessfulCheckout(
                booking
            );
        },
        450
    );
}




/* =========================================================
   40. SUCCESSFUL CHECKOUT
   ========================================================= */

function completeSuccessfulCheckout(
    booking
) {

    const bookingId =
        booking?._id ||
        booking?.id;

    const button =
        document.getElementById(
            "payNowButton"
        );

    const text =
        document.getElementById(
            "payNowButtonText"
        );

    if (button) {
        button.disabled = true;
        button.classList.remove(
            "loading"
        );
    }

    if (text) {
        text.hidden = false;
        text.textContent =
            "Booking Confirmed";
    }

    showCheckoutToast(
        `Booking ${
            booking?.reference || ""
        } confirmed successfully.`,
        "success",
        "Booking Confirmed"
    );

    try {
        sessionStorage.removeItem(
            SKYRA_CHECKOUT
                .HOLD_STORAGE_KEY
        );
    } catch (error) {
        console.warn(
            "Unable to clear active hold storage.",
            error
        );
    }

    if (bookingId) {
        window.setTimeout(
            () => {
                window.location.href =
                    `./booking-success.html?booking=${
                        encodeURIComponent(
                            bookingId
                        )
                    }`;
            },
            700
        );
    }
}



/* =========================================================
   41. SAVE BOOKING
   Session pointer only. MongoDB is the booking source of truth.
   ========================================================= */
function saveLatestBooking(booking) {
    try {
        sessionStorage.setItem(SKYRA_CHECKOUT.BOOKING_STORAGE_KEY, JSON.stringify(booking));
    } catch (error) {
        console.warn("Unable to store the latest booking pointer.", error);
    }
}

/* =========================================================
   42. PAYMENT LOADING
   ========================================================= */

function setCheckoutPaymentLoading(
    loading
) {

    skyraCheckoutState
        .paymentProcessing =
        loading;


    const button =
        document.getElementById(
            "payNowButton"
        );


    const text =
        document.getElementById(
            "payNowButtonText"
        );


    const icon =
        document.getElementById(
            "payNowButtonIcon"
        );


    const loader =
        document.getElementById(
            "payNowButtonLoader"
        );


    button?.classList.toggle(
        "loading",
        loading
    );


    if (button) {

        button.disabled =
            loading;

    }


    if (text) {

        text.hidden =
            loading;

    }


    if (icon) {

        icon.hidden =
            loading;

    }


    if (loader) {

        loader.hidden =
            !loading;

    }

}


/* =========================================================
   43. PROCESSING MODAL
   ========================================================= */

function openPaymentProcessingModal() {

    const modal =
        document.getElementById(
            "paymentProcessingModal"
        );


    if (modal) {

        modal.hidden =
            false;

    }


    updateProcessingStep(
        0
    );


    refreshCheckoutIcons();

}


function closePaymentProcessingModal() {

    const modal =
        document.getElementById(
            "paymentProcessingModal"
        );


    if (modal) {

        modal.hidden =
            true;

    }


    refreshCheckoutIcons();

}


/* =========================================================
   44. PROCESSING STEPS
   ========================================================= */

function updateProcessingStep(
    step
) {

    const steps =
        document.querySelectorAll(
            ".checkout-processing-steps span"
        );


    steps.forEach(
        (
            element,
            index
        ) => {

            element.classList.remove(
                "active",
                "completed"
            );


            if (
                index <
                step
            ) {

                element.classList.add(
                    "completed"
                );

            } else if (
                index ===
                step
            ) {

                element.classList.add(
                    "active"
                );

            }

        }
    );

}


/* =========================================================
   45. PAYMENT ERROR
   ========================================================= */

function showPaymentError(
    message
) {

    const modal =
        document.getElementById(
            "paymentErrorModal"
        );


    const messageElement =
        document.getElementById(
            "paymentErrorMessage"
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


    const processing =
        document.getElementById(
            "paymentProcessingModal"
        );


    if (processing) {

        processing.hidden =
            true;

    }


    refreshCheckoutIcons();

}


/* =========================================================
   46. MODALS
   ========================================================= */

function initializeCheckoutModals() {

    document
        .getElementById(
            "closePaymentErrorModal"
        )
        ?.addEventListener(
            "click",
            closePaymentErrorModal
        );


    document
        .getElementById(
            "closePaymentErrorButton"
        )
        ?.addEventListener(
            "click",
            closePaymentErrorModal
        );


    document
        .getElementById(
            "paymentErrorModal"
        )
        ?.addEventListener(
            "click",
            (event) => {

                if (
                    event.target.id ===
                    "paymentErrorModal"
                ) {

                    closePaymentErrorModal();

                }

            }
        );

}


/* =========================================================
   47. CLOSE PAYMENT ERROR
   ========================================================= */

function closePaymentErrorModal() {

    const modal =
        document.getElementById(
            "paymentErrorModal"
        );


    if (modal) {

        modal.hidden =
            true;

    }

}


/* =========================================================
   48. CHANGE SEATS
   ========================================================= */

async function handleChangeSeats(
    event
) {

    event.preventDefault();


    const destination =
        getSeatSelectionURL();


    try {

        await releaseCheckoutHold();

    } catch (error) {

        console.warn(
            "Unable to release hold before changing seats.",
            error
        );

    }


    clearCheckoutHoldStorage();


    window.location.href =
        destination;

}


/* =========================================================
   49. RELEASE HOLD
   ========================================================= */

async function releaseCheckoutHold() {

    if (
        window.SKYRA_API &&
        typeof window.SKYRA_API
            .releaseSeatHold ===
            "function" &&
        skyraCheckoutState.holdId
    ) {

        await window.SKYRA_API
            .releaseSeatHold(
                skyraCheckoutState
                    .holdId
            );

    }

}


/* =========================================================
   50. RETURN TO SEATS
   ========================================================= */

function returnToSeatSelection() {

    clearCheckoutHoldStorage();


    window.location.href =
        getSeatSelectionURL();

}


/* =========================================================
   51. SEAT SELECTION URL
   ========================================================= */

function getSeatSelectionURL() {

    const showId =
        skyraCheckoutState
            .show
            ?.id ||
        skyraCheckoutState
            .hold
            ?.showId;


    return showId
        ? `./seat-selection.html?show=${
            encodeURIComponent(
                showId
            )
        }`
        : "./events.html";

}


/* =========================================================
   52. NAVIGATION LINKS
   ========================================================= */

function updateCheckoutNavigation() {

    const url =
        getSeatSelectionURL();


    const back =
        document.getElementById(
            "checkoutBackLink"
        );


    const change =
        document.getElementById(
            "checkoutChangeSeatsLink"
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
   53. CLEAR HOLD STORAGE
   ========================================================= */

function clearCheckoutHoldStorage() {

    try {

        sessionStorage.removeItem(
            SKYRA_CHECKOUT
                .HOLD_STORAGE_KEY
        );

    } catch {

        /* Nothing else required. */

    }

}


/* =========================================================
   54. INVALID CHECKOUT
   ========================================================= */

function showInvalidCheckout(
    title,
    message,
    showId = null
) {

    const state =
        document.getElementById(
            "checkoutInvalidState"
        );


    const content =
        document.getElementById(
            "checkoutContent"
        );


    const action =
        document.getElementById(
            "checkoutInvalidAction"
        );


    setCheckoutText(
        "checkoutInvalidTitle",
        title
    );


    setCheckoutText(
        "checkoutInvalidMessage",
        message
    );


    if (action) {

        if (showId) {

            action.href =
                `./seat-selection.html?show=${
                    encodeURIComponent(
                        showId
                    )
                }`;


            action.innerHTML = `

                <i data-lucide="arrow-left"></i>

                Select Seats Again

            `;

        } else {

            action.href =
                "./events.html";

        }

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
        "Checkout Unavailable | SKYRA";


    refreshCheckoutIcons();

}


/* =========================================================
   55. HIDE INVALID
   ========================================================= */

function hideInvalidCheckout() {

    const state =
        document.getElementById(
            "checkoutInvalidState"
        );


    const content =
        document.getElementById(
            "checkoutContent"
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
   56. SEARCH
   ========================================================= */

function initializeCheckoutSearch() {

    const search =
        document.getElementById(
            "dashboardSearch"
        );


    search?.addEventListener(
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
                search.value.trim();


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
   57. SIDEBAR ACTIVE
   ========================================================= */

function keepCheckoutExploreActive() {

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
   58. DOCUMENT TITLE
   ========================================================= */

function updateCheckoutDocumentTitle() {

    const event =
        skyraCheckoutState.event;


    if (!event) {

        return;

    }


    document.title =
        `Checkout - ${event.title} | SKYRA`;

}


/* =========================================================
   59. EVENT TYPE
   ========================================================= */

function formatCheckoutEventType(
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
   60. EVENT ICON
   ========================================================= */

function getCheckoutEventIcon(
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
   61. DATE
   ========================================================= */

function formatCheckoutDate(
    value
) {

    const date =
        parseCheckoutDate(
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
   62. PARSE DATE
   ========================================================= */

function parseCheckoutDate(
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
   63. TIME
   ========================================================= */

function formatCheckoutTime(
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
        hourValue,
        minutes
    ] =
        value
            .split(":")
            .map(Number);


    const period =
        hourValue >= 12
            ? "PM"
            : "AM";


    const hour =
        hourValue % 12 ||
        12;


    return `${
        hour
    }:${
        String(minutes)
            .padStart(
                2,
                "0"
            )
    } ${period}`;

}


/* =========================================================
   64. CURRENCY
   ========================================================= */

function formatCheckoutCurrency(
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


    return `₹${
        amount.toLocaleString(
            "en-IN"
        )
    }`;

}


/* =========================================================
   65. FORM ERROR
   ========================================================= */

function setCheckoutError(
    id,
    message
) {

    const element =
        document.getElementById(
            id
        );


    if (element) {

        element.textContent =
            message;

    }

}


/* =========================================================
   66. TEXT SETTER
   ========================================================= */

function setCheckoutText(
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
   67. ESCAPE HTML
   ========================================================= */

function escapeCheckoutHTML(
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
   68. TOAST
   ========================================================= */

function showCheckoutToast(
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
   69. WAIT
   ========================================================= */

function waitForCheckout(
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
   70. ICON REFRESH
   ========================================================= */

function refreshCheckoutIcons() {

    if (
        typeof lucide !==
        "undefined"
    ) {

        lucide.createIcons();

    }

}


/* =========================================================
   71. ESCAPE KEY
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


        if (
            !skyraCheckoutState
                .paymentProcessing
        ) {

            closePaymentErrorModal();

        }

    }
);


/* =========================================================
   72. CLEANUP
   ========================================================= */

window.addEventListener(
    "beforeunload",
    () => {

        window.clearInterval(
            skyraCheckoutState
                .countdownInterval
        );

    }
);


/* =========================================================
   73. PUBLIC CHECKOUT HELPERS
   ========================================================= */

window.SKYRA_CHECKOUT_PAGE = {

    getState:
        () => ({

            ...skyraCheckoutState,

            hold:
                skyraCheckoutState.hold
                    ? {
                        ...skyraCheckoutState
                            .hold,

                        seats:
                            skyraCheckoutState
                                .hold
                                .seats
                                ?.map(
                                    (seat) => ({
                                        ...seat
                                    })
                                )
                    }
                    : null

        }),

    retryPayment:
        beginCheckoutPayment,

    expireHold:
        handleCheckoutHoldExpired

};


/* =========================================================
   END OF SKYRA CUSTOMER CHECKOUT
   ========================================================= */