"use strict";

/* =========================================================
   SKYRA - BACKEND CONSTANTS

   File:
   backend/src/utils/constants.js

   Purpose:
   Central place for fixed values used throughout the backend.

   Instead of repeatedly writing strings such as:

   "CUSTOMER"
   "ORGANISER"
   "AVAILABLE"
   "BOOKED"

   we use constants.

   This prevents spelling mistakes and keeps the backend
   consistent.
   ========================================================= */


/* =========================================================
   1. USER ROLES
   ========================================================= */

const USER_ROLES = Object.freeze({

    CUSTOMER: "CUSTOMER",

    ORGANISER: "ORGANISER",

    ADMIN: "ADMIN"

});


/* =========================================================
   2. USER ACCOUNT STATUS
   ========================================================= */

const USER_STATUS = Object.freeze({

    ACTIVE: "ACTIVE",

    SUSPENDED: "SUSPENDED"

});


/* =========================================================
   3. VENUE STATUS
   ========================================================= */

const VENUE_STATUS = Object.freeze({

    ACTIVE: "ACTIVE",

    INACTIVE: "INACTIVE"

});


/* =========================================================
   4. SEAT CATEGORY STATUS
   ========================================================= */

const SEAT_CATEGORY_STATUS = Object.freeze({

    ACTIVE: "ACTIVE",

    INACTIVE: "INACTIVE"

});


/* =========================================================
   5. PHYSICAL SEAT STATUS

   Important:

   Seat.js represents the real physical seat belonging
   to a venue.

   Example:

   Venue:
   PVR ICON Chennai

   Physical Seat:
   A5

   A physical seat does NOT have booking states such as:

   AVAILABLE
   HELD
   BOOKED

   Those belong to ShowSeat.
   ========================================================= */

const PHYSICAL_SEAT_STATUS = Object.freeze({

    ACTIVE: "ACTIVE",

    INACTIVE: "INACTIVE"

});


/* =========================================================
   6. EVENT TYPES
   ========================================================= */

const EVENT_TYPES = Object.freeze({

    MOVIE: "MOVIE",

    CONCERT: "CONCERT",

    COMEDY: "COMEDY",

    OTHER: "OTHER"

});


/* =========================================================
   7. EVENT STATUS
   ========================================================= */

const EVENT_STATUS = Object.freeze({

    DRAFT: "DRAFT",

    PUBLISHED: "PUBLISHED",

    CANCELLED: "CANCELLED"

});


/* =========================================================
   8. SHOW STATUS
   ========================================================= */

const SHOW_STATUS = Object.freeze({

    SCHEDULED: "SCHEDULED",

    CANCELLED: "CANCELLED",

    COMPLETED: "COMPLETED"

});


/* =========================================================
   9. SHOW SEAT STATUS

   ShowSeat represents the state of a physical seat
   for ONE specific show.

   Example:

   Physical Seat A5

   Coldplay Show:
   A5 → BOOKED

   Diljit Show:
   A5 → AVAILABLE

   Arijit Show:
   A5 → HELD
   ========================================================= */

const SHOW_SEAT_STATUS = Object.freeze({

    AVAILABLE: "AVAILABLE",

    HELD: "HELD",

    BOOKED: "BOOKED",

    /*
       OFFERED is an internal SKYRA state.

       It is used when a released seat is temporarily reserved
       for a customer from the waitlist.
    */

    OFFERED: "OFFERED"

});


/* =========================================================
   10. SEAT HOLD STATUS
   ========================================================= */

const SEAT_HOLD_STATUS = Object.freeze({

    ACTIVE: "ACTIVE",

    CONSUMED: "CONSUMED",

    EXPIRED: "EXPIRED",

    RELEASED: "RELEASED"

});


/* =========================================================
   11. PAYMENT STATUS
   ========================================================= */

const PAYMENT_STATUS = Object.freeze({

    CREATED: "CREATED",

    PENDING: "PENDING",

    SUCCESS: "SUCCESS",

    FAILED: "FAILED",

    REFUNDED: "REFUNDED"

});


/* =========================================================
   12. BOOKING STATUS
   ========================================================= */

const BOOKING_STATUS = Object.freeze({

    CONFIRMED: "CONFIRMED",

    CANCELLED: "CANCELLED"

});


/* =========================================================
   13. WAITLIST STATUS
   ========================================================= */

const WAITLIST_STATUS = Object.freeze({

    WAITING: "WAITING",

    OFFERED: "OFFERED",

    COMPLETED: "COMPLETED",

    CANCELLED: "CANCELLED"

});


/* =========================================================
   14. WAITLIST OFFER STATUS
   ========================================================= */

const WAITLIST_OFFER_STATUS = Object.freeze({

    ACTIVE: "ACTIVE",

    ACCEPTED: "ACCEPTED",

    EXPIRED: "EXPIRED",

    CANCELLED: "CANCELLED"

});


/* =========================================================
   15. NOTIFICATION TYPES
   ========================================================= */

const NOTIFICATION_TYPES = Object.freeze({

    BOOKING_CONFIRMED:
        "BOOKING_CONFIRMED",

    BOOKING_CANCELLED:
        "BOOKING_CANCELLED",

    WAITLIST_JOINED:
        "WAITLIST_JOINED",

    WAITLIST_OFFER:
        "WAITLIST_OFFER",

    WAITLIST_OFFER_EXPIRED:
        "WAITLIST_OFFER_EXPIRED",

    EVENT_UPDATE:
        "EVENT_UPDATE",

    SYSTEM:
        "SYSTEM"

});


/* =========================================================
   16. NOTIFICATION STATUS
   ========================================================= */

const NOTIFICATION_STATUS = Object.freeze({

    UNREAD: "UNREAD",

    READ: "READ"

});


/* =========================================================
   17. PAYMENT PROVIDERS
   ========================================================= */

const PAYMENT_PROVIDERS = Object.freeze({

    RAZORPAY: "RAZORPAY"

});


/* =========================================================
   18. CURRENCY
   ========================================================= */

const CURRENCIES = Object.freeze({

    INR: "INR"

});


/* =========================================================
   19. HTTP STATUS CODES

   We will use these with ApiError later.
   ========================================================= */

const HTTP_STATUS = Object.freeze({

    OK: 200,

    CREATED: 201,

    BAD_REQUEST: 400,

    UNAUTHORIZED: 401,

    FORBIDDEN: 403,

    NOT_FOUND: 404,

    CONFLICT: 409,

    UNPROCESSABLE_ENTITY: 422,

    INTERNAL_SERVER_ERROR: 500

});


/* =========================================================
   20. DEFAULT APPLICATION VALUES

   Actual values can later come from .env.

   These are fallback/default values only.
   ========================================================= */

const DEFAULTS = Object.freeze({

    SEAT_HOLD_MINUTES: 10,

    WAITLIST_OFFER_MINUTES: 10,

    CURRENCY: CURRENCIES.INR

});


/* =========================================================
   21. SOCKET EVENTS

   These will be used later when Socket.IO is implemented.
   ========================================================= */

const SOCKET_EVENTS = Object.freeze({

    SEAT_HELD:
        "seat:held",

    SEAT_RELEASED:
        "seat:released",

    SEAT_BOOKED:
        "seat:booked",

    SEAT_OFFERED:
        "seat:offered"

});


/* =========================================================
   22. SOCKET ROOM PREFIXES
   ========================================================= */

const SOCKET_ROOMS = Object.freeze({

    SHOW:
        "show"

});


/* =========================================================
   23. EXPORT ALL CONSTANTS
   ========================================================= */

module.exports = {

    USER_ROLES,

    USER_STATUS,

    VENUE_STATUS,

    SEAT_CATEGORY_STATUS,

    PHYSICAL_SEAT_STATUS,

    EVENT_TYPES,

    EVENT_STATUS,

    SHOW_STATUS,

    SHOW_SEAT_STATUS,

    SEAT_HOLD_STATUS,

    PAYMENT_STATUS,

    BOOKING_STATUS,

    WAITLIST_STATUS,

    WAITLIST_OFFER_STATUS,

    NOTIFICATION_TYPES,

    NOTIFICATION_STATUS,

    PAYMENT_PROVIDERS,

    CURRENCIES,

    HTTP_STATUS,

    DEFAULTS,

    SOCKET_EVENTS,

    SOCKET_ROOMS

};