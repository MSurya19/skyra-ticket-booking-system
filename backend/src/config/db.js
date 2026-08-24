"use strict";

/* =========================================================
   SKYRA - DATABASE CONFIGURATION

   File:
   backend/src/config/db.js

   Purpose:
   - Connect the SKYRA backend to MongoDB Atlas
   - Use the centralized environment configuration
   - Return the connection to server.js
   - Allow server.js to handle fatal startup failures
   ========================================================= */


const mongoose =
    require("mongoose");


const env =
    require("./env");


/* =========================================================
   CONNECT TO MONGODB
   ========================================================= */

const connectDB =
    async () => {

        try {

            const connection =
                await mongoose.connect(
                    env.MONGO_URI
                );


            console.log(
                `MongoDB Connected: ${connection.connection.host}`
            );


            console.log(
                `Database: ${connection.connection.name}`
            );


            return connection;

        } catch (error) {

            console.error(
                `MongoDB connection failed: ${error.message}`
            );


            /*
               Do not call process.exit() here.

               db.js should only be responsible for connecting
               to MongoDB.

               server.js will decide whether the application
               should terminate when startup fails.
            */

            throw error;

        }

    };


/* =========================================================
   EXPORT
   ========================================================= */

module.exports =
    connectDB;