"use strict";

const mongoose =
    require("mongoose");

const waitlistService =
    require("../services/waitlistService");


/* =========================================================
   SKYRA - WAITLIST OFFER EXPIRY JOB
   File: backend/src/jobs/processExpiredWaitlistOffers.js

   ACTIVE offer expiry:
   OFFERED seat -> AVAILABLE -> next FIFO customer OFFERED.

   Claimed offer + abandoned/expired SeatHold:
   AVAILABLE seat -> next FIFO customer OFFERED.
   ========================================================= */


let intervalHandle =
    null;


function getSweepIntervalMs() {

    const seconds =
        Number(
            process.env
                .WAITLIST_OFFER_SWEEP_SECONDS ||
            30
        );


    const safeSeconds =
        Number.isFinite(
            seconds
        )
            ? Math.min(
                300,
                Math.max(
                    10,
                    Math.floor(
                        seconds
                    )
                )
            )
            : 30;


    return safeSeconds *
        1000;

}


async function runExpiredWaitlistOfferSweep() {

    /*
       app.js may be imported before server.js finishes connecting.
       Skip quietly until Mongoose is actually connected.
    */
    if (
        mongoose.connection
            .readyState !==
        1
    ) {

        return {
            expired:
                0,
            reoffered:
                0,
            abandonedRequeued:
                0
        };

    }


    try {

        const result =
            await waitlistService
                .processExpiredOffers();


        if (
            result.expired >
                0 ||
            result.reoffered >
                0 ||
            result.abandonedRequeued >
                0
        ) {

            console.log(
                `[Waitlist] expired=${result.expired}, reoffered=${result.reoffered}, abandoned=${result.abandonedRequeued}`
            );

        }


        return result;

    } catch (error) {

        console.error(
            "[Waitlist] Offer expiry sweep failed:",
            error
        );


        return {
            expired:
                0,
            reoffered:
                0,
            abandonedRequeued:
                0,
            error:
                error?.message ||
                String(
                    error
                )
        };

    }

}


function startExpiredWaitlistOfferJob() {

    if (intervalHandle) {
        return intervalHandle;
    }


    const initial =
        setTimeout(
            runExpiredWaitlistOfferSweep,
            2000
        );


    initial.unref?.();


    intervalHandle =
        setInterval(
            runExpiredWaitlistOfferSweep,
            getSweepIntervalMs()
        );


    intervalHandle.unref?.();


    return intervalHandle;

}


function stopExpiredWaitlistOfferJob() {

    if (!intervalHandle) {
        return;
    }


    clearInterval(
        intervalHandle
    );


    intervalHandle =
        null;

}


module.exports = {

    runExpiredWaitlistOfferSweep,

    startExpiredWaitlistOfferJob,

    stopExpiredWaitlistOfferJob

};
