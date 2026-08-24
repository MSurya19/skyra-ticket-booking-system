"use strict";

/* =========================================================
   SKYRA - SERVER ENTRY POINT

   File:
   backend/src/server.js

   Purpose:
   - Load the Express application
   - Connect to MongoDB Atlas
   - Create the HTTP server
   - Start accepting requests
   - Handle startup failures
   - Support graceful shutdown
   - Prepare the server for Socket.IO later
   ========================================================= */


const http =
    require("http");

const mongoose =
    require("mongoose");


const app =
    require("./app");

const connectDB =
    require("./config/db");

const env =
    require("./config/env");

const {
    initializeRealtime,
    startShowSeatChangeStream,
    stopRealtime
} =
    require("./realtime/socket");



/* =========================================================
   1. CREATE HTTP SERVER

   We use http.createServer(app) instead of app.listen().

   Why?

   Later Socket.IO will attach to this same HTTP server:

   const io = new Server(server);

   So creating the HTTP server now avoids restructuring
   server.js during the real-time seat phase.
   ========================================================= */

const server =
    http.createServer(
        app
    );


/* =========================================================
   PHASE 19 - SOCKET.IO REAL-TIME SEAT CHANNEL

   Socket.IO attaches to the SAME HTTP server used by Express.
   MongoDB remains the source of truth; a ShowSeat change stream
   publishes committed seat-state changes to show-specific rooms.
   ========================================================= */

initializeRealtime(
    server
);



/* =========================================================
   2. START SERVER
   ========================================================= */

const startServer =
    async () => {

        try {

            /* ===============================================
               CONNECT TO MONGODB FIRST
               =============================================== */

            await connectDB();


            /* ===============================================
               START PHASE 19 SHOWSEAT CHANGE STREAM
               =============================================== */

            await startShowSeatChangeStream();


            /* ===============================================
               START HTTP SERVER
               =============================================== */

            server.listen(
                env.PORT,
                () => {

                    console.log(
                        "========================================"
                    );

                    console.log(
                        "SKYRA Ticket Booking Backend"
                    );

                    console.log(
                        `Environment : ${env.NODE_ENV}`
                    );

                    console.log(
                        `Server      : http://localhost:${env.PORT}`
                    );

                    console.log(
                        `Health      : http://localhost:${env.PORT}/api/health`
                    );

                    console.log(
                        "========================================"
                    );

                }
            );

        } catch (error) {

            /*
               If MongoDB cannot connect, the application should
               not start accepting booking requests.
            */

            console.error(
                "\n[SKYRA STARTUP ERROR]"
            );

            console.error(
                error.message
            );


            process.exit(
                1
            );

        }

    };



/* =========================================================
   3. GRACEFUL SHUTDOWN

   This closes:
   - HTTP server
   - MongoDB connection

   before terminating the process.
   ========================================================= */

const gracefulShutdown =
    async (
        signal
    ) => {

        console.log(
            `\n${signal} received. Shutting down SKYRA...`
        );


        await stopRealtime();


        server.close(
            async () => {

                try {

                    if (
                        mongoose.connection
                            .readyState !==
                        0
                    ) {

                        await mongoose.connection.close();

                        console.log(
                            "MongoDB connection closed."
                        );

                    }


                    console.log(
                        "SKYRA server stopped."
                    );


                    process.exit(
                        0
                    );

                } catch (error) {

                    console.error(
                        "Error during shutdown:",
                        error.message
                    );


                    process.exit(
                        1
                    );

                }

            }
        );

    };



/* =========================================================
   4. TERMINATION SIGNALS
   ========================================================= */

process.on(
    "SIGINT",
    () => {

        gracefulShutdown(
            "SIGINT"
        );

    }
);


process.on(
    "SIGTERM",
    () => {

        gracefulShutdown(
            "SIGTERM"
        );

    }
);



/* =========================================================
   5. UNHANDLED PROMISE REJECTIONS

   Example:
   A Promise fails somewhere without a catch handler.

   We log it and stop the application rather than leaving
   the backend in an unknown state.
   ========================================================= */

process.on(
    "unhandledRejection",
    (error) => {

        console.error(
            "\n[SKYRA UNHANDLED REJECTION]"
        );

        console.error(
            error
        );


        server.close(
            () => {

                process.exit(
                    1
                );

            }
        );

    }
);



/* =========================================================
   6. UNCAUGHT EXCEPTIONS
   ========================================================= */

process.on(
    "uncaughtException",
    (error) => {

        console.error(
            "\n[SKYRA UNCAUGHT EXCEPTION]"
        );

        console.error(
            error
        );


        process.exit(
            1
        );

    }
);



/* =========================================================
   7. START APPLICATION
   ========================================================= */

startServer();