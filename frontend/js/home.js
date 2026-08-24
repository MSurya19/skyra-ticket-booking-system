/* =========================================================
   SKYRA - HOME PAGE JAVASCRIPT
   File: frontend/js/home.js

   Handles:
   - Lucide icons
   - Mobile navigation
   - Search
   - Favourite buttons
   - Hero slider controls
   - Smooth navigation
   - Back to top
   - Footer year
   - Small homepage interactions
   ========================================================= */

"use strict";


/* =========================================================
   1. DOM READY
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    initializeLucideIcons();

    initializeCurrentYear();

    initializeMobileNavigation();

    initializeSearch();

    loadHomePopularEvents();

    initializeFavouriteButtons();

    initializeHeroSlider();

    initializeSmoothScrolling();

    initializeBackToTop();

    initializeNavbarBehaviour();

});


/* =========================================================
   2. LUCIDE ICONS
   ========================================================= */

function initializeLucideIcons() {

    if (typeof lucide !== "undefined") {

        lucide.createIcons();

    }

}


/* =========================================================
   3. CURRENT YEAR
   ========================================================= */

function initializeCurrentYear() {

    const currentYearElement =
        document.getElementById("currentYear");

    if (!currentYearElement) {
        return;
    }

    currentYearElement.textContent =
        new Date().getFullYear();

}


/* =========================================================
   4. MOBILE NAVIGATION
   ========================================================= */

function initializeMobileNavigation() {

    const mobileMenuBtn =
        document.getElementById("mobileMenuBtn");

    const mobileNav =
        document.getElementById("mobileNav");

    if (!mobileMenuBtn || !mobileNav) {
        return;
    }


    /* -----------------------------------------------------
       Toggle menu
       ----------------------------------------------------- */

    mobileMenuBtn.addEventListener("click", () => {

        const isOpen =
            mobileNav.classList.toggle("open");

        mobileMenuBtn.setAttribute(
            "aria-expanded",
            String(isOpen)
        );


        /* Change icon */

        mobileMenuBtn.innerHTML =
            isOpen
                ? `<i data-lucide="x"></i>`
                : `<i data-lucide="menu"></i>`;

        initializeLucideIcons();

    });


    /* -----------------------------------------------------
       Close when navigation link clicked
       ----------------------------------------------------- */

    const mobileLinks =
        mobileNav.querySelectorAll(
            ".mobile-nav-link, .mobile-nav-actions a"
        );

    mobileLinks.forEach((link) => {

        link.addEventListener("click", () => {

            closeMobileMenu(
                mobileMenuBtn,
                mobileNav
            );

        });

    });


    /* -----------------------------------------------------
       Close on Escape
       ----------------------------------------------------- */

    document.addEventListener("keydown", (event) => {

        if (event.key !== "Escape") {
            return;
        }

        if (!mobileNav.classList.contains("open")) {
            return;
        }

        closeMobileMenu(
            mobileMenuBtn,
            mobileNav
        );

    });


    /* -----------------------------------------------------
       Close when clicking outside
       ----------------------------------------------------- */

    document.addEventListener("click", (event) => {

        if (!mobileNav.classList.contains("open")) {
            return;
        }

        const clickedInsideMenu =
            mobileNav.contains(event.target);

        const clickedMenuButton =
            mobileMenuBtn.contains(event.target);

        if (
            !clickedInsideMenu &&
            !clickedMenuButton
        ) {

            closeMobileMenu(
                mobileMenuBtn,
                mobileNav
            );

        }

    });


    /* -----------------------------------------------------
       Close menu when desktop width restored
       ----------------------------------------------------- */

    window.addEventListener("resize", () => {

        if (window.innerWidth > 900) {

            closeMobileMenu(
                mobileMenuBtn,
                mobileNav
            );

        }

    });

}


/* =========================================================
   5. CLOSE MOBILE MENU
   ========================================================= */

function closeMobileMenu(
    mobileMenuBtn,
    mobileNav
) {

    mobileNav.classList.remove("open");

    mobileMenuBtn.setAttribute(
        "aria-expanded",
        "false"
    );

    mobileMenuBtn.innerHTML =
        `<i data-lucide="menu"></i>`;

    initializeLucideIcons();

}


/* =========================================================
   6. SEARCH
   ========================================================= */

function initializeSearch() {

    const navbarSearchForm =
        document.getElementById(
            "navbarSearchForm"
        );

    const navbarSearchInput =
        document.getElementById(
            "navbarSearchInput"
        );

    const mobileSearchInput =
        document.getElementById(
            "mobileSearchInput"
        );


    /* -----------------------------------------------------
       Desktop search
       ----------------------------------------------------- */

    if (
        navbarSearchForm &&
        navbarSearchInput
    ) {

        navbarSearchForm.addEventListener(
            "submit",
            (event) => {

                event.preventDefault();

                performSearch(
                    navbarSearchInput.value
                );

            }
        );

    }


    /* -----------------------------------------------------
       Mobile search
       ----------------------------------------------------- */

    if (mobileSearchInput) {

        mobileSearchInput.addEventListener(
            "keydown",
            (event) => {

                if (event.key !== "Enter") {
                    return;
                }

                event.preventDefault();

                performSearch(
                    mobileSearchInput.value
                );

            }
        );

    }

}


/* =========================================================
   7. PERFORM SEARCH
   ========================================================= */

function performSearch(searchValue) {

    const query =
        searchValue.trim();

    if (!query) {

        showHomeToast(
            "Enter something to search.",
            "warning"
        );

        return;

    }


    /*
       Later the customer/events page can read:

       const params =
           new URLSearchParams(window.location.search);

       const search =
           params.get("search");
    */

    window.location.href =
        `./customer/events.html?search=${
            encodeURIComponent(query)
        }`;

}


/* =========================================================
   8. FAVOURITE BUTTONS
   ========================================================= */

function initializeFavouriteButtons() {

    const favouriteButtons =
        document.querySelectorAll(
            ".favorite-btn"
        );

    if (!favouriteButtons.length) {
        return;
    }


    const savedFavourites =
        getSavedFavourites();


    favouriteButtons.forEach(
        (button, index) => {

            const eventCard =
                button.closest(
                    ".home-event-card"
                );

            if (!eventCard) {
                return;
            }


            const titleElement =
                eventCard.querySelector(
                    ".home-event-content h3"
                );


            const eventName =
                titleElement
                    ? titleElement.textContent.trim()
                    : `event-${index}`;


            const favouriteKey =
                String(
                    eventCard.dataset.eventId ||
                    ""
                ).trim() ||
                createFavouriteKey(
                    eventName
                );


            /* Restore saved state */

            if (
                savedFavourites.includes(
                    favouriteKey
                )
            ) {

                setFavouriteState(
                    button,
                    true
                );

            }


            /* Favourite click */

            button.addEventListener(
                "click",
                (event) => {

                    event.preventDefault();

                    event.stopPropagation();


                    const isFavourite =
                        button.classList.contains(
                            "active"
                        );


                    const newState =
                        !isFavourite;


                    setFavouriteState(
                        button,
                        newState
                    );


                    updateSavedFavourite(
                        favouriteKey,
                        newState
                    );


                    showHomeToast(

                        newState
                            ? `${eventName} added to favourites.`
                            : `${eventName} removed from favourites.`,

                        newState
                            ? "success"
                            : "info"

                    );

                }
            );

        }
    );

}


/* =========================================================
   9. CREATE FAVOURITE KEY
   ========================================================= */

function createFavouriteKey(eventName) {

    return eventName
        .toLowerCase()
        .trim()
        .replace(
            /[^a-z0-9]+/g,
            "-"
        )
        .replace(
            /^-|-$/g,
            ""
        );

}


/* =========================================================
   10. GET SAVED FAVOURITES
   ========================================================= */

function getSavedFavourites() {

    try {

        const stored =
            localStorage.getItem(
                "skyra_favourites"
            );

        return stored
            ? JSON.parse(stored)
            : [];

    } catch (error) {

        console.warn(
            "Unable to read favourites:",
            error
        );

        return [];

    }

}


/* =========================================================
   11. UPDATE SAVED FAVOURITE
   ========================================================= */

function updateSavedFavourite(
    favouriteKey,
    shouldSave
) {

    let favourites =
        getSavedFavourites();


    if (shouldSave) {

        if (
            !favourites.includes(
                favouriteKey
            )
        ) {

            favourites.push(
                favouriteKey
            );

        }

    } else {

        favourites =
            favourites.filter(
                (item) =>
                    item !== favouriteKey
            );

    }


    try {

        localStorage.setItem(
            "skyra_favourites",
            JSON.stringify(
                favourites
            )
        );

    } catch (error) {

        console.warn(
            "Unable to save favourites:",
            error
        );

    }

}


/* =========================================================
   12. SET FAVOURITE STATE
   ========================================================= */

function setFavouriteState(
    button,
    isFavourite
) {

    button.classList.toggle(
        "active",
        isFavourite
    );


    button.setAttribute(
        "aria-pressed",
        String(isFavourite)
    );


    const icon =
        button.querySelector(
            "svg"
        );


    if (icon) {

        if (isFavourite) {

            icon.setAttribute(
                "fill",
                "currentColor"
            );

        } else {

            icon.setAttribute(
                "fill",
                "none"
            );

        }

    }

}


/* =========================================================
   13. HERO SLIDER
   ========================================================= */

function initializeHeroSlider() {

    const sliderDots =
        Array.from(
            document.querySelectorAll(
                ".slider-dot"
            )
        );

    const previousButton =
        document.querySelector(
            ".hero-slider-prev"
        );

    const nextButton =
        document.querySelector(
            ".hero-slider-next"
        );

    const heroContent =
        document.querySelector(
            ".hero-content"
        );

    const heroVisual =
        document.querySelector(
            ".hero-visual"
        );


    if (!sliderDots.length) {
        return;
    }


    let currentSlide = 0;

    let sliderInterval = null;


    /* -----------------------------------------------------
       Update slide
       ----------------------------------------------------- */

    function updateSlide(
        newIndex,
        animate = true
    ) {

        if (newIndex < 0) {

            newIndex =
                sliderDots.length - 1;

        }


        if (
            newIndex >=
            sliderDots.length
        ) {

            newIndex = 0;

        }


        currentSlide =
            newIndex;


        sliderDots.forEach(
            (dot, index) => {

                dot.classList.toggle(
                    "active",
                    index === currentSlide
                );

            }
        );


        /*
           At this stage our hero uses one visual layout.

           We still animate the hero when arrows/dots
           change so the slider controls feel alive.

           Later actual hero banners can replace this
           with data from MongoDB/API.
        */

        if (animate) {

            animateHeroContent(
                heroContent,
                heroVisual
            );

        }

    }


    /* -----------------------------------------------------
       Previous button
       ----------------------------------------------------- */

    if (previousButton) {

        previousButton.addEventListener(
            "click",
            () => {

                updateSlide(
                    currentSlide - 1
                );

                restartHeroAutoPlay();

            }
        );

    }


    /* -----------------------------------------------------
       Next button
       ----------------------------------------------------- */

    if (nextButton) {

        nextButton.addEventListener(
            "click",
            () => {

                updateSlide(
                    currentSlide + 1
                );

                restartHeroAutoPlay();

            }
        );

    }


    /* -----------------------------------------------------
       Dot navigation
       ----------------------------------------------------- */

    sliderDots.forEach(
        (dot, index) => {

            dot.addEventListener(
                "click",
                () => {

                    updateSlide(
                        index
                    );

                    restartHeroAutoPlay();

                }
            );

        }
    );


    /* -----------------------------------------------------
       Auto play
       ----------------------------------------------------- */

    function startHeroAutoPlay() {

        /*
           Avoid automatic animation when user requested
           reduced motion.
        */

        const reduceMotion =
            window.matchMedia(
                "(prefers-reduced-motion: reduce)"
            ).matches;


        if (reduceMotion) {
            return;
        }


        sliderInterval =
            window.setInterval(
                () => {

                    updateSlide(
                        currentSlide + 1,
                        false
                    );

                },
                6000
            );

    }


    function restartHeroAutoPlay() {

        if (sliderInterval) {

            clearInterval(
                sliderInterval
            );

        }

        startHeroAutoPlay();

    }


    updateSlide(
        0,
        false
    );

    startHeroAutoPlay();

}


/* =========================================================
   14. HERO CHANGE ANIMATION
   ========================================================= */

function animateHeroContent(
    heroContent,
    heroVisual
) {

    if (heroContent) {

        heroContent.animate(

            [
                {
                    opacity: 0.75,
                    transform:
                        "translateY(5px)"
                },

                {
                    opacity: 1,
                    transform:
                        "translateY(0)"
                }
            ],

            {
                duration: 320,
                easing:
                    "ease-out"
            }

        );

    }


    if (heroVisual) {

        heroVisual.animate(

            [
                {
                    opacity: 0.88,
                    transform:
                        "scale(0.995)"
                },

                {
                    opacity: 1,
                    transform:
                        "scale(1)"
                }
            ],

            {
                duration: 380,
                easing:
                    "ease-out"
            }

        );

    }

}


/* =========================================================
   15. SMOOTH SECTION NAVIGATION
   ========================================================= */

function initializeSmoothScrolling() {

    const anchorLinks =
        document.querySelectorAll(
            'a[href^="#"]'
        );


    anchorLinks.forEach((link) => {

        link.addEventListener(
            "click",
            (event) => {

                const href =
                    link.getAttribute(
                        "href"
                    );


                /*
                   Ignore empty # links.
                */

                if (
                    !href ||
                    href === "#"
                ) {

                    event.preventDefault();

                    return;

                }


                const target =
                    document.querySelector(
                        href
                    );


                if (!target) {
                    return;
                }


                event.preventDefault();


                const header =
                    document.querySelector(
                        ".public-header"
                    );


                const headerHeight =
                    header
                        ? header.offsetHeight
                        : 0;


                const targetTop =
                    target.getBoundingClientRect().top
                    +
                    window.scrollY
                    -
                    headerHeight
                    -
                    14;


                window.scrollTo({

                    top:
                        targetTop,

                    behavior:
                        "smooth"

                });

            }
        );

    });

}


/* =========================================================
   16. BACK TO TOP
   ========================================================= */

function initializeBackToTop() {

    const backToTopButton =
        document.getElementById(
            "backToTop"
        );

    if (!backToTopButton) {
        return;
    }


    function updateBackToTopButton() {

        const shouldShow =
            window.scrollY > 500;


        backToTopButton.classList.toggle(
            "visible",
            shouldShow
        );

    }


    window.addEventListener(
        "scroll",
        updateBackToTopButton,
        {
            passive: true
        }
    );


    backToTopButton.addEventListener(
        "click",
        () => {

            window.scrollTo({

                top: 0,

                behavior:
                    "smooth"

            });

        }
    );


    updateBackToTopButton();

}


/* =========================================================
   17. NAVBAR SCROLL BEHAVIOUR
   ========================================================= */

function initializeNavbarBehaviour() {

    const header =
        document.querySelector(
            ".public-header"
        );

    if (!header) {
        return;
    }


    function updateNavbar() {

        if (window.scrollY > 20) {

            header.style.background =
                "rgba(5, 13, 26, 0.96)";

            header.style.boxShadow =
                "0 8px 30px rgba(0, 0, 0, 0.18)";

        } else {

            header.style.background =
                "rgba(5, 13, 26, 0.88)";

            header.style.boxShadow =
                "none";

        }

    }


    window.addEventListener(
        "scroll",
        updateNavbar,
        {
            passive: true
        }
    );


    updateNavbar();

}


/* =========================================================
   18. HOME TOAST
   ========================================================= */

function showHomeToast(
    message,
    type = "info"
) {

    let container =
        document.querySelector(
            ".toast-container"
        );


    /* -----------------------------------------------------
       Create container if missing
       ----------------------------------------------------- */

    if (!container) {

        container =
            document.createElement(
                "div"
            );

        container.className =
            "toast-container";

        document.body.appendChild(
            container
        );

    }


    /* -----------------------------------------------------
       Create toast
       ----------------------------------------------------- */

    const toast =
        document.createElement(
            "div"
        );


    toast.className =
        "toast";


    const iconName =
        getToastIcon(type);


    toast.innerHTML = `

        <div class="home-toast-icon home-toast-${type}">

            <i data-lucide="${iconName}"></i>

        </div>

        <div class="home-toast-content">

            <strong>
                ${getToastTitle(type)}
            </strong>

            <span>
                ${escapeHTML(message)}
            </span>

        </div>

        <button
            type="button"
            class="home-toast-close"
            aria-label="Close notification"
        >

            <i data-lucide="x"></i>

        </button>

    `;


    /* -----------------------------------------------------
       Apply styles needed specifically by homepage toast
       ----------------------------------------------------- */

    toast.style.alignItems =
        "center";


    container.appendChild(
        toast
    );


    initializeLucideIcons();


    /* -----------------------------------------------------
       Close button
       ----------------------------------------------------- */

    const closeButton =
        toast.querySelector(
            ".home-toast-close"
        );


    if (closeButton) {

        closeButton.addEventListener(
            "click",
            () => {

                removeToast(
                    toast
                );

            }
        );

    }


    /* -----------------------------------------------------
       Auto remove
       ----------------------------------------------------- */

    window.setTimeout(
        () => {

            removeToast(
                toast
            );

        },
        3200
    );

}


/* =========================================================
   19. TOAST ICON
   ========================================================= */

function getToastIcon(type) {

    const icons = {

        success:
            "check-circle-2",

        warning:
            "triangle-alert",

        danger:
            "circle-x",

        info:
            "info"

    };


    return (
        icons[type] ||
        icons.info
    );

}


/* =========================================================
   20. TOAST TITLE
   ========================================================= */

function getToastTitle(type) {

    const titles = {

        success:
            "Saved",

        warning:
            "Attention",

        danger:
            "Something went wrong",

        info:
            "SKYRA"

    };


    return (
        titles[type] ||
        titles.info
    );

}


/* =========================================================
   21. REMOVE TOAST
   ========================================================= */

function removeToast(toast) {

    if (
        !toast ||
        !toast.isConnected
    ) {
        return;
    }


    toast.style.transition =
        "opacity 180ms ease, transform 180ms ease";

    toast.style.opacity =
        "0";

    toast.style.transform =
        "translateX(20px)";


    window.setTimeout(
        () => {

            toast.remove();

        },
        190
    );

}


/* =========================================================
   22. ESCAPE HTML
   Prevent strings inserted into innerHTML from becoming HTML.
   ========================================================= */

function escapeHTML(value) {

    return String(value)
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );

}


/* =========================================================
   23. EVENT CARD KEYBOARD ACCESSIBILITY
   ========================================================= */

document.addEventListener(
    "keydown",
    (event) => {

        const target =
            event.target;


        if (
            !target.matches(
                ".favorite-btn"
            )
        ) {
            return;
        }


        if (
            event.key === "Enter" ||
            event.key === " "
        ) {

            /*
               Buttons already activate with keyboard
               naturally. Prevent additional custom
               handling here.
            */

            return;

        }

    }
);


/* =========================================================
   24. PAGE VISIBILITY
   Pause expensive visual work when tab is hidden.
   ========================================================= */

document.addEventListener(
    "visibilitychange",
    () => {

        /*
           Reserved for future API/socket/slider
           optimisation.

           No backend action is required at this stage.
        */

        if (document.hidden) {

            document.body.classList.add(
                "page-hidden"
            );

        } else {

            document.body.classList.remove(
                "page-hidden"
            );

        }

    }
);




/* =========================================================
   PHASE 10 - REAL POPULAR EVENTS
   ========================================================= */

async function loadHomePopularEvents() {

    const grid =
        document.getElementById(
            "popularEventsGrid"
        );


    if (!grid) {

        return;

    }


    if (
        !window.SKYRA_API ||
        typeof window.SKYRA_API
            .getCustomerEvents !==
            "function"
    ) {

        console.error(
            "Phase 10 customer Event API is unavailable on the homepage."
        );


        grid.innerHTML =
            createHomeEventsUnavailableState();

        return;

    }


    try {

        const response =
            await window.SKYRA_API
                .getCustomerEvents({
                    sort:
                        "POPULAR",

                    page:
                        1,

                    limit:
                        4
                });


        const events =
            Array.isArray(
                response?.data?.events
            )
                ? response.data.events
                : [];


        if (!events.length) {

            grid.innerHTML =
                createHomeEventsEmptyState();

            return;

        }


        grid.innerHTML =
            events
                .map(
                    createHomeEventCard
                )
                .join("");


        /*
           The original static buttons were replaced by backend
           Event cards, so bind favourites to the newly created
           elements.
        */
        initializeFavouriteButtons();

        initializeLucideIcons();

    } catch (error) {

        console.error(
            "Unable to load homepage Events:",
            error
        );


        grid.innerHTML =
            createHomeEventsUnavailableState();


        showHomeToast(
            error?.message ||
            "Unable to load events right now.",
            "error"
        );

    }

}


function createHomeEventCard(
    rawEvent
) {

    const event = {

        ...rawEvent,

        id:
            String(
                rawEvent?._id ||
                rawEvent?.id ||
                ""
            )

    };


    const show =
        event.nextShow ||
        null;


    const type =
        formatHomeEventType(
            event.type
        );


    const posterClass =
        getHomePosterClass(
            event.type
        );


    const location =
        show
            ? `${
                show.venueName ||
                "Venue"
            }${
                show.venueCity
                    ? `, ${show.venueCity}`
                    : ""
            }`
            : "Venue coming soon";


    const date =
        show
            ? formatHomeEventDate(
                show.date
            )
            : "Coming soon";


    const time =
        show
            ? formatHomeEventTime(
                show.time
            )
            : "TBA";


    const price =
        event.startingPrice ===
            null ||
        event.startingPrice ===
            undefined
            ? "TBA"
            : formatHomeCurrency(
                event.startingPrice
            );


    const words =
        String(
            event.title ||
            "SKYRA Event"
        )
            .trim()
            .split(/\s+/);


    const mainWord =
        (
            words[0] ||
            "SKYRA"
        ).toUpperCase();


    const subtitle =
        (
            words
                .slice(1)
                .join(" ")
            ||
            "EXPERIENCE"
        ).toUpperCase();


    return `

        <article
            class="home-event-card"
            data-event-id="${escapeHTML(
                event.id
            )}"
        >

            <div
                class="home-event-image ${posterClass}"
            >

                <button
                    class="favorite-btn"
                    type="button"
                    aria-label="Add ${escapeHTML(
                        event.title
                    )} to favourites"
                >
                    <i data-lucide="heart"></i>
                </button>


                <span
                    class="event-type-badge"
                >
                    ${escapeHTML(
                        type
                    )}
                </span>


                <div class="poster-content">

                    <span
                        class="poster-small-text"
                    >
                        ${escapeHTML(
                            (
                                event.genre ||
                                event.category ||
                                type
                            ).toUpperCase()
                        )}
                    </span>

                    <strong>
                        ${escapeHTML(
                            mainWord
                        )}
                    </strong>

                    <span class="poster-tour">
                        ${escapeHTML(
                            subtitle
                        )}
                    </span>

                </div>

            </div>


            <div class="home-event-content">

                <h3>
                    ${escapeHTML(
                        event.title
                    )}
                </h3>


                <div class="home-event-meta">

                    <span>
                        <i data-lucide="calendar"></i>
                        ${escapeHTML(
                            date
                        )}
                    </span>

                    <span>
                        <i data-lucide="clock-3"></i>
                        ${escapeHTML(
                            time
                        )}
                    </span>

                    <span>
                        <i data-lucide="map-pin"></i>
                        ${escapeHTML(
                            location
                        )}
                    </span>

                </div>


                <div class="home-event-footer">

                    <div>

                        <small>
                            Starts from
                        </small>

                        <strong>
                            ${escapeHTML(
                                price
                            )}
                        </strong>

                    </div>


                    <a
                        href="./customer/event-details.html?id=${
                            encodeURIComponent(
                                event.id
                            )
                        }"
                        class="event-book-btn"
                        aria-label="View ${escapeHTML(
                            event.title
                        )}"
                    >
                        <i
                            data-lucide="arrow-up-right"
                        ></i>
                    </a>

                </div>

            </div>

        </article>

    `;

}


function getHomePosterClass(
    type
) {

    switch (
        String(
            type ||
            ""
        ).toUpperCase()
    ) {

        case "MOVIE":
            return "movie-gradient";

        case "LIVE_SHOW":
            return "concert-gradient-3";

        case "CONCERT":
        default:
            return "concert-gradient-1";

    }

}


function formatHomeEventType(
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

        case "LIVE_SHOW":
            return "Live Show";

        case "CONCERT":
            return "Concert";

        default:
            return "Event";

    }

}


function formatHomeEventDate(
    value
) {

    if (!value) {

        return "Coming soon";

    }


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


function formatHomeEventTime(
    value
) {

    if (
        !/^\d{2}:\d{2}$/.test(
            String(
                value ||
                ""
            )
        )
    ) {

        return value ||
            "TBA";

    }


    const [
        hours,
        minutes
    ] =
        value.split(":")
            .map(Number);


    const date =
        new Date();


    date.setHours(
        hours,
        minutes,
        0,
        0
    );


    return new Intl.DateTimeFormat(
        "en-IN",
        {
            hour:
                "numeric",

            minute:
                "2-digit"
        }
    ).format(
        date
    );

}


function formatHomeCurrency(
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

        return "TBA";

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


function createHomeEventsEmptyState() {

    return `

        <div
            class="home-events-api-state"
            style="
                grid-column: 1 / -1;
                padding: 32px;
                text-align: center;
            "
        >
            <strong>
                No upcoming events yet
            </strong>

            <p>
                Published events with future shows
                will appear here automatically.
            </p>
        </div>

    `;

}


function createHomeEventsUnavailableState() {

    return `

        <div
            class="home-events-api-state"
            style="
                grid-column: 1 / -1;
                padding: 32px;
                text-align: center;
            "
        >
            <strong>
                Events are temporarily unavailable
            </strong>

            <p>
                Start the SKYRA backend and refresh
                this page.
            </p>
        </div>

    `;

}


/* =========================================================
   END OF SKYRA HOME PAGE JAVASCRIPT
   ========================================================= */