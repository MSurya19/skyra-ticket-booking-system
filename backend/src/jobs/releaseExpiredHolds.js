"use strict";

const mongoose =
    require("mongoose");

const seatHoldService =
    require("../services/seatHoldService");


/* =========================================================
   SKYRA - EXPIRED HOLD RELEASE JOB
   File: backend/src/jobs/releaseExpiredHolds.js

   TTL deletion alone is intentionally NOT used because the
   ShowSeat documents must be changed from HELD -> AVAILABLE.
   ========================================================= */


let intervalHandle =
    null;


function getSweepIntervalMs() {

    const seconds =
        Number(
            process.env
                .SEAT_HOLD_SWEEP_SECONDS ||
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


async function runExpiredHoldSweep() {

    /*
       app.js can be imported before server.js finishes connecting.
       Skip quietly until Mongoose is connected.
    */
    if (
        mongoose.connection
            .readyState !==
        1
    ) {

        return 0;

    }


    try {

        const released =
            await seatHoldService
                .releaseExpiredHolds();


        if (
            released >
            0
        ) {

            console.log(
                `[SeatHold] Released ${released} expired hold(s).`
            );

        }

    } catch (error) {

        console.error(
            "[SeatHold] Expiry sweep failed:",
            error
        );

    }

}


function startExpiredHoldReleaseJob() {

    if (intervalHandle) {

        return intervalHandle;

    }


    const initial =
        setTimeout(
            runExpiredHoldSweep,
            1500
        );


    initial.unref?.();


    intervalHandle =
        setInterval(
            runExpiredHoldSweep,
            getSweepIntervalMs()
        );


    /*
       Do not make this interval the only thing keeping a Node
       process alive (important for test runners and graceful exit).
    */
    intervalHandle.unref?.();


    return intervalHandle;

}


function stopExpiredHoldReleaseJob() {

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

    runExpiredHoldSweep,

    startExpiredHoldReleaseJob,

    stopExpiredHoldReleaseJob

};
