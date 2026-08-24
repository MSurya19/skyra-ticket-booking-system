/* =========================================================
   SKYRA - CUSTOMER PROFILE
   File:
   frontend/js/customer/profile.js

   Used by:
   - customer/profile.html

   Current frontend phase:
   - Uses the authenticated customer
   - Allows name, phone and city updates
   - Email remains read-only
   - Role remains read-only
   - Stores temporary frontend profile changes
   - Shows customer booking/waitlist/notification stats

   Final backend phase:
   - GET /api/users/me
   - PATCH /api/users/me
   - JWT identifies authenticated customer
   - MongoDB becomes source of truth
   ========================================================= */

"use strict";


/* =========================================================
   1. CONSTANTS
   ========================================================= */

const SKYRA_PROFILE = {};


/* =========================================================
   2. STATE
   ========================================================= */

const skyraProfileState = {

    profile:
        null,

    originalProfile:
        null,

    dirty:
        false,

    saving:
        false

};


/* =========================================================
   3. DOM READY
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initializeProfilePage();

    }
);


/* =========================================================
   4. INITIALIZE
   ========================================================= */

async function initializeProfilePage() {

    initializeProfileForm();

    initializeProfileButtons();

    initializeProfileTopbarSearch();

    initializeProfileUnsavedModal();

    keepProfileNavigationActive();


    const profile =
        await loadProfile();


    if (!profile) {

        showProfileToast(
            "Unable to load your profile.",
            "error",
            "Profile Unavailable"
        );


        return;

    }


    skyraProfileState.profile =
        normalizeProfile(
            profile
        );


    skyraProfileState.originalProfile =
        cloneProfile(
            skyraProfileState.profile
        );


    renderProfile();

    await renderProfileStatistics();

    await updateProfileIndicators();

    refreshProfileIcons();

}


/* =========================================================
   5. LOAD PROFILE
   Authenticated /auth/me data is authoritative.
   ========================================================= */
async function loadProfile() {
    const currentUser = window.SKYRA_COMMON?.getUser?.();
    if (!currentUser) throw new Error("Authenticated customer profile is unavailable.");
    return currentUser;
}

/* =========================================================
   6. NORMALIZE PROFILE
   ========================================================= */

function normalizeProfile(
    raw
) {

    const role =
        String(
            raw.role ||
            "CUSTOMER"
        ).toUpperCase();


    return {

        id:
            String(
                raw.id ||
                raw._id ||
                raw.userId ||
                ""
            ),

        name:
            String(
                raw.name ||
                raw.fullName ||
                "Customer"
            ).trim(),

        email:
            String(
                raw.email ||
                ""
            ).trim(),

        phone:
            String(
                raw.phone ||
                raw.phoneNumber ||
                ""
            ).trim(),

        city:
            String(
                raw.city ||
                raw.location ||
                ""
            ).trim(),

        role:
            role ===
            "CUSTOMER"
                ? "CUSTOMER"
                : role,

        createdAt:
            raw.createdAt ||
            raw.memberSince ||
            raw.joinedAt ||
            null,

        status:
            String(
                raw.status ||
                "ACTIVE"
            ).toUpperCase()

    };

}


/* =========================================================
   7. RENDER PROFILE
   ========================================================= */

function renderProfile() {

    const profile =
        skyraProfileState.profile;


    if (!profile) {

        return;

    }


    const initials =
        createProfileInitials(
            profile.name
        );


    /*
       Sidebar / topbar
    */

    setProfileText(
        "sidebarUserName",
        profile.name
    );


    setProfileText(
        "sidebarUserInitials",
        initials
    );


    setProfileText(
        "topbarUserName",
        profile.name
    );


    setProfileText(
        "topbarUserInitials",
        initials
    );


    setProfileText(
        "dropdownUserName",
        profile.name
    );


    setProfileText(
        "dropdownUserInitials",
        initials
    );


    setProfileText(
        "dropdownUserEmail",
        profile.email
    );


    /*
       Hero
    */

    setProfileText(
        "profileHeroInitials",
        initials
    );


    setProfileText(
        "profileHeroName",
        profile.name
    );


    setProfileText(
        "profileHeroEmail",
        profile.email
    );


    setProfileText(
        "profileHeroCity",
        profile.city ||
        "Location not added"
    );


    setProfileText(
        "profileHeroMemberSince",
        formatProfileMonthYear(
            profile.createdAt
        )
    );


    /*
       Form
    */

    setProfileInputValue(
        "profileFullName",
        profile.name
    );


    setProfileInputValue(
        "profileEmail",
        profile.email
    );


    setProfileInputValue(
        "profilePhone",
        profile.phone
    );


    setProfileInputValue(
        "profileCity",
        profile.city
    );


    /*
       Account panel
    */

    setProfileText(
        "profileAccountEmail",
        profile.email
    );


    setProfileText(
        "profileAccountMemberSince",
        formatProfileFullMonthYear(
            profile.createdAt
        )
    );


    document.title =
        `${profile.name} | SKYRA Profile`;

}


/* =========================================================
   8. FORM INITIALIZATION
   ========================================================= */

function initializeProfileForm() {

    const form =
        document.getElementById(
            "profileForm"
        );


    form?.addEventListener(
        "submit",
        handleProfileSubmit
    );


    form
        ?.querySelectorAll(
            "input:not([readonly])"
        )
        .forEach(
            (input) => {

                input.addEventListener(
                    "input",
                    () => {

                        clearProfileFieldError(
                            input.id
                        );


                        updateProfileDirtyState();

                    }
                );

            }
        );

}


/* =========================================================
   9. PROFILE BUTTONS
   ========================================================= */

function initializeProfileButtons() {

    document
        .getElementById(
            "resetProfileButton"
        )
        ?.addEventListener(
            "click",
            handleResetProfile
        );

}


/* =========================================================
   10. SUBMIT
   ========================================================= */

async function handleProfileSubmit(
    event
) {

    event.preventDefault();


    if (
        skyraProfileState.saving
    ) {

        return;

    }


    const formData =
        getProfileFormData();


    if (
        !validateProfileForm(
            formData
        )
    ) {

        return;

    }


    const update = {

        name:
            formData.name,

        phone:
            formData.phone,

        city:
            formData.city

    };


    setProfileSavingState(
        true
    );


    try {

        let updatedProfile;


        /*
           FUTURE BACKEND
        */

        if (
            window.SKYRA_API &&
            typeof window.SKYRA_API
                .updateProfile ===
                "function"
        ) {

            const response =
                await window.SKYRA_API
                    .updateProfile(
                        update
                    );


            updatedProfile =
                response?.user ||
                response?.profile ||
                response?.data?.user ||
                response?.data?.profile ||
                response?.data ||
                response;

        } else {
            throw new Error("Profile update API is not available. No local-only profile changes were saved.");
        }


        skyraProfileState.profile =
            normalizeProfile({

                ...skyraProfileState.profile,

                ...updatedProfile,

                /*
                   Never take role/email changes
                   from untrusted client update.
                */
                email:
                    skyraProfileState.profile.email,

                role:
                    skyraProfileState.profile.role

            });


        skyraProfileState.originalProfile =
            cloneProfile(
                skyraProfileState.profile
            );


        skyraProfileState.dirty =
            false;


        syncProfileWithStoredUser(
            skyraProfileState.profile
        );


        window.dispatchEvent(
            new CustomEvent(
                "skyra:profile-updated",
                {
                    detail: {
                        ...skyraProfileState.profile
                    }
                }
            )
        );


        renderProfile();


        showProfileToast(
            "Your profile has been updated.",
            "success",
            "Profile Saved"
        );

    } catch (error) {

        console.error(
            "Profile update failed:",
            error
        );


        showProfileToast(
            error?.message ||
            "Your profile could not be updated.",
            "error",
            "Update Failed"
        );

    } finally {

        setProfileSavingState(
            false
        );

    }

}




/* =========================================================
   12. FORM DATA
   ========================================================= */

function getProfileFormData() {

    return {

        name:
            document
                .getElementById(
                    "profileFullName"
                )
                ?.value
                .trim() ||
            "",

        email:
            document
                .getElementById(
                    "profileEmail"
                )
                ?.value
                .trim() ||
            "",

        phone:
            document
                .getElementById(
                    "profilePhone"
                )
                ?.value
                .trim() ||
            "",

        city:
            document
                .getElementById(
                    "profileCity"
                )
                ?.value
                .trim() ||
            ""

    };

}


/* =========================================================
   13. VALIDATION
   ========================================================= */

function validateProfileForm(
    data
) {

    let valid =
        true;


    clearAllProfileErrors();


    /*
       Name
    */

    if (
        data.name.length <
        2
    ) {

        setProfileFieldError(
            "profileFullName",
            "Please enter at least 2 characters."
        );


        valid =
            false;

    }


    if (
        data.name.length >
        80
    ) {

        setProfileFieldError(
            "profileFullName",
            "Name cannot exceed 80 characters."
        );


        valid =
            false;

    }


    /*
       Phone is optional.
    */

    if (
        data.phone &&
        !isValidProfilePhone(
            data.phone
        )
    ) {

        setProfileFieldError(
            "profilePhone",
            "Enter a valid phone number."
        );


        valid =
            false;

    }


    return valid;

}


/* =========================================================
   14. PHONE VALIDATION
   ========================================================= */

function isValidProfilePhone(
    value
) {

    const normalized =
        String(
            value
        )
            .replace(
                /[\s()-]/g,
                ""
            );


    return /^\+?[0-9]{7,15}$/.test(
        normalized
    );

}


/* =========================================================
   15. FIELD ERROR
   ========================================================= */

function setProfileFieldError(
    fieldId,
    message
) {

    const input =
        document.getElementById(
            fieldId
        );


    const error =
        document.getElementById(
            `${fieldId}Error`
        );


    input?.classList.add(
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
   16. CLEAR FIELD ERROR
   ========================================================= */

function clearProfileFieldError(
    fieldId
) {

    const input =
        document.getElementById(
            fieldId
        );


    const error =
        document.getElementById(
            `${fieldId}Error`
        );


    input?.classList.remove(
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
   17. CLEAR ERRORS
   ========================================================= */

function clearAllProfileErrors() {

    [
        "profileFullName",
        "profilePhone"
    ]
        .forEach(
            clearProfileFieldError
        );

}


/* =========================================================
   18. DIRTY STATE
   ========================================================= */

function updateProfileDirtyState() {

    const current =
        getProfileFormData();


    const original =
        skyraProfileState
            .originalProfile;


    if (!original) {

        return;

    }


    skyraProfileState.dirty =
        current.name !==
            original.name ||
        current.phone !==
            original.phone ||
        current.city !==
            original.city;


    const resetButton =
        document.getElementById(
            "resetProfileButton"
        );


    if (resetButton) {

        resetButton.disabled =
            !skyraProfileState.dirty;

    }

}


/* =========================================================
   19. RESET PROFILE
   ========================================================= */

function handleResetProfile() {

    if (
        !skyraProfileState.dirty
    ) {

        return;

    }


    const modal =
        document.getElementById(
            "profileUnsavedModal"
        );


    if (modal) {

        modal.hidden =
            false;

    }


    refreshProfileIcons();

}


/* =========================================================
   20. UNSAVED MODAL
   ========================================================= */

function initializeProfileUnsavedModal() {

    document
        .getElementById(
            "closeProfileUnsavedModal"
        )
        ?.addEventListener(
            "click",
            closeProfileUnsavedModal
        );


    document
        .getElementById(
            "continueEditingProfileButton"
        )
        ?.addEventListener(
            "click",
            closeProfileUnsavedModal
        );


    document
        .getElementById(
            "discardProfileChangesButton"
        )
        ?.addEventListener(
            "click",
            discardProfileChanges
        );


    document
        .getElementById(
            "profileUnsavedModal"
        )
        ?.addEventListener(
            "click",
            (event) => {

                if (
                    event.target.id ===
                    "profileUnsavedModal"
                ) {

                    closeProfileUnsavedModal();

                }

            }
        );

}


/* =========================================================
   21. CLOSE UNSAVED MODAL
   ========================================================= */

function closeProfileUnsavedModal() {

    const modal =
        document.getElementById(
            "profileUnsavedModal"
        );


    if (modal) {

        modal.hidden =
            true;

    }

}


/* =========================================================
   22. DISCARD CHANGES
   ========================================================= */

function discardProfileChanges() {

    const original =
        skyraProfileState
            .originalProfile;


    if (!original) {

        return;

    }


    setProfileInputValue(
        "profileFullName",
        original.name
    );


    setProfileInputValue(
        "profilePhone",
        original.phone
    );


    setProfileInputValue(
        "profileCity",
        original.city
    );


    clearAllProfileErrors();


    skyraProfileState.dirty =
        false;


    const resetButton =
        document.getElementById(
            "resetProfileButton"
        );


    if (resetButton) {

        resetButton.disabled =
            true;

    }


    closeProfileUnsavedModal();


    showProfileToast(
        "Unsaved changes were discarded.",
        "info",
        "Changes Reset"
    );

}


/* =========================================================
   23. SAVING STATE
   ========================================================= */

function setProfileSavingState(
    saving
) {

    skyraProfileState.saving =
        Boolean(
            saving
        );


    const button =
        document.getElementById(
            "saveProfileButton"
        );


    const text =
        document.getElementById(
            "saveProfileButtonText"
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
   26. LIVE STATISTICS / INDICATORS
   ========================================================= */
async function getProfileLiveMetrics() {
    const [bookingsResult, waitlistResult, unreadResult] = await Promise.allSettled([
        window.SKYRA_API?.getCustomerBookings?.(),
        window.SKYRA_API?.getMyWaitlist?.(),
        window.SKYRA_API?.getNotificationUnreadCount?.()
    ]);

    const bookingsResponse = bookingsResult.status === "fulfilled" ? bookingsResult.value : null;
    const bookings = bookingsResponse?.data?.bookings || bookingsResponse?.bookings || [];
    const waitlistResponse = waitlistResult.status === "fulfilled" ? waitlistResult.value : null;
    const waitlist = waitlistResponse?.data?.waitlist || waitlistResponse?.waitlist || waitlistResponse?.data?.entries || waitlistResponse?.entries || [];
    const unreadResponse = unreadResult.status === "fulfilled" ? unreadResult.value : null;
    const unread = Number(unreadResponse?.data?.unreadCount ?? unreadResponse?.unreadCount ?? unreadResponse?.data?.count ?? unreadResponse?.count ?? 0) || 0;
    const activeWaitlist = Array.isArray(waitlist) ? waitlist.filter((entry) => ["WAITING", "WAITLISTED", "ACTIVE", "OFFERED"].includes(String(entry?.status || entry?.offer?.status || "").toUpperCase())).length : 0;
    return { bookings: Array.isArray(bookings) ? bookings.length : 0, activeWaitlist, unread };
}

async function renderProfileStatistics() {
    const metrics = await getProfileLiveMetrics();
    setProfileText("profileBookingsCount", metrics.bookings);
    setProfileText("profileWaitlistCount", metrics.activeWaitlist);
    setProfileText("profileUnreadCount", metrics.unread);
}

async function updateProfileIndicators() {
    await window.SKYRA_COMMON?.refreshCustomerIndicators?.();
}

/* =========================================================
   32. TOPBAR SEARCH
   ========================================================= */

function initializeProfileTopbarSearch() {

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
                    `./events.html?search=${
                        encodeURIComponent(
                            query
                        )
                    }`;

            }
        );

}


/* =========================================================
   33. ACTIVE NAVIGATION
   ========================================================= */

function keepProfileNavigationActive() {

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
                    "./profile.html";


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
   34. INITIALS
   ========================================================= */

function createProfileInitials(
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
   35. MEMBER SINCE
   ========================================================= */

function formatProfileMonthYear(
    value
) {

    const date =
        parseProfileDate(
            value
        );


    if (!date) {

        return "—";

    }


    return new Intl.DateTimeFormat(
        "en-IN",
        {

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
   36. FULL MEMBER DATE
   ========================================================= */

function formatProfileFullMonthYear(
    value
) {

    const date =
        parseProfileDate(
            value
        );


    if (!date) {

        return "—";

    }


    return new Intl.DateTimeFormat(
        "en-IN",
        {

            month:
                "long",

            year:
                "numeric"

        }
    ).format(
        date
    );

}


/* =========================================================
   37. DATE PARSER
   ========================================================= */

function parseProfileDate(
    value
) {

    if (!value) {

        return null;

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
   38. GENERIC ITEM ID
   ========================================================= */

function getProfileItemId(
    item
) {

    return String(
        item?.id ||
        item?._id ||
        item?.bookingId ||
        item?.notificationId ||
        item?.waitlistId ||
        ""
    );

}


/* =========================================================
   39. CLONE
   ========================================================= */

function cloneProfile(
    profile
) {

    return {

        ...profile

    };

}


/* =========================================================
   40. SET TEXT
   ========================================================= */

function setProfileText(
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
   41. INPUT VALUE
   ========================================================= */

function setProfileInputValue(
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
   42. TOAST
   ========================================================= */

function showProfileToast(
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
   43. ICONS
   ========================================================= */

function refreshProfileIcons() {

    if (
        typeof lucide !==
        "undefined"
    ) {

        lucide.createIcons();

    }

}


/* =========================================================
   44. ESCAPE KEY
   ========================================================= */

document.addEventListener(
    "keydown",
    (event) => {

        if (
            event.key ===
            "Escape"
        ) {

            closeProfileUnsavedModal();

        }

    }
);


/* =========================================================
   45. UNSAVED PAGE WARNING
   ========================================================= */

window.addEventListener(
    "beforeunload",
    (event) => {

        if (
            !skyraProfileState.dirty
        ) {

            return;

        }


        event.preventDefault();

        event.returnValue =
            "";

    }
);


/* =========================================================
   46. PUBLIC API
   ========================================================= */

window.SKYRA_PROFILE_PAGE = {

    getProfile:
        () =>
            skyraProfileState.profile
                ? {
                    ...skyraProfileState
                        .profile
                }
                : null,

    refresh:
        async () => {

            const profile =
                await loadProfile();


            if (!profile) {

                return;

            }


            skyraProfileState.profile =
                normalizeProfile(
                    profile
                );


            skyraProfileState.originalProfile =
                cloneProfile(
                    skyraProfileState.profile
                );


            skyraProfileState.dirty =
                false;


            renderProfile();

            renderProfileStatistics();

            updateProfileIndicators();

        }

};


/* =========================================================
   END SKYRA CUSTOMER PROFILE
   ========================================================= */