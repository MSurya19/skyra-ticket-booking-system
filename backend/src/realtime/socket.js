"use strict";

const mongoose = require("mongoose");
const { Server } = require("socket.io");

const env = require("../config/env");
const ShowSeat = require("../models/ShowSeat");

let io = null;
let showSeatChangeStream = null;

function getAllowedOrigins() {
    return String(env.FRONTEND_URL || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
}

function getShowRoom(showId) {
    return `show:${String(showId)}`;
}

function isValidShowId(showId) {
    return mongoose.Types.ObjectId.isValid(String(showId || ""));
}

function serializeSeat(seat) {
    if (!seat) {
        return null;
    }

    return {
        id: String(seat._id),
        _id: String(seat._id),
        showId: String(seat.showId),
        row: seat.row,
        number: seat.number,
        label: seat.label,
        categoryId: seat.categoryId
            ? String(seat.categoryId)
            : null,
        categoryName: seat.categoryName || "",
        price: Number(seat.price || 0),
        status: seat.status,
        holdExpiresAt: seat.holdExpiresAt || null,
        offerExpiresAt: seat.offerExpiresAt || null
    };
}

async function getShowSeatSnapshot(showId) {
    const seats = await ShowSeat.find({ showId })
        .select(
            "_id showId row number label categoryId categoryName price status holdExpiresAt offerExpiresAt"
        )
        .sort({ row: 1, number: 1 })
        .lean();

    return seats.map(serializeSeat);
}

function initializeRealtime(server) {
    if (io) {
        return io;
    }

    const allowedOrigins = getAllowedOrigins();

    io = new Server(server, {
        cors: {
            origin: (origin, callback) => {
                if (!origin || allowedOrigins.includes(origin)) {
                    return callback(null, true);
                }

                return callback(
                    new Error(
                        `Socket.IO CORS blocked origin: ${origin}`
                    )
                );
            },
            methods: ["GET", "POST"],
            credentials: true
        }
    });

    io.on("connection", (socket) => {
        socket.emit("socket:ready", {
            connected: true,
            socketId: socket.id,
            connectedAt: new Date().toISOString()
        });

        socket.on("show:join", async (payload = {}, acknowledge) => {
            try {
                const showId = String(payload.showId || "").trim();

                if (!isValidShowId(showId)) {
                    const response = {
                        success: false,
                        message: "A valid showId is required."
                    };

                    if (typeof acknowledge === "function") {
                        acknowledge(response);
                    }

                    return;
                }

                const previousRoom = socket.data.showRoom;

                if (previousRoom) {
                    await socket.leave(previousRoom);
                }

                const room = getShowRoom(showId);
                await socket.join(room);

                socket.data.showRoom = room;
                socket.data.showId = showId;

                const seats = await getShowSeatSnapshot(showId);

                socket.emit("show:snapshot", {
                    showId,
                    seats,
                    count: seats.length,
                    generatedAt: new Date().toISOString()
                });

                if (typeof acknowledge === "function") {
                    acknowledge({
                        success: true,
                        showId,
                        room,
                        seatCount: seats.length
                    });
                }
            } catch (error) {
                console.error(
                    "[SKYRA REALTIME] show:join failed:",
                    error?.message || error
                );

                if (typeof acknowledge === "function") {
                    acknowledge({
                        success: false,
                        message: "Unable to join the show room."
                    });
                }
            }
        });

        socket.on("show:leave", async (payload = {}, acknowledge) => {
            const showId = String(
                payload.showId || socket.data.showId || ""
            ).trim();

            if (showId && isValidShowId(showId)) {
                await socket.leave(getShowRoom(showId));
            }

            socket.data.showRoom = null;
            socket.data.showId = null;

            if (typeof acknowledge === "function") {
                acknowledge({
                    success: true,
                    showId: showId || null
                });
            }
        });
    });

    console.log("[SKYRA REALTIME] Socket.IO initialized.");

    return io;
}

function emitSeatDocument(seat, metadata = {}) {
    if (!io || !seat || !seat.showId) {
        return false;
    }

    const publicSeat = serializeSeat(seat);

    io.to(getShowRoom(seat.showId)).emit("seat:updated", {
        showId: String(seat.showId),
        seat: publicSeat,
        operationType: metadata.operationType || "update",
        changedFields: metadata.changedFields || [],
        occurredAt: new Date().toISOString()
    });

    return true;
}

async function startShowSeatChangeStream() {
    if (showSeatChangeStream) {
        return showSeatChangeStream;
    }

    if (mongoose.connection.readyState !== 1) {
        throw new Error(
            "MongoDB must be connected before starting the ShowSeat change stream."
        );
    }

    showSeatChangeStream = ShowSeat.watch([], {
        fullDocument: "updateLookup"
    });

    showSeatChangeStream.on("change", (change) => {
        const seat = change.fullDocument;

        if (!seat) {
            return;
        }

        const changedFields = Object.keys(
            change.updateDescription?.updatedFields || {}
        );

        emitSeatDocument(seat, {
            operationType: change.operationType,
            changedFields
        });
    });

    showSeatChangeStream.on("error", (error) => {
        console.error(
            "[SKYRA REALTIME] ShowSeat change stream error:",
            error?.message || error
        );
    });

    showSeatChangeStream.on("close", () => {
        showSeatChangeStream = null;
    });

    console.log(
        "[SKYRA REALTIME] ShowSeat MongoDB change stream started."
    );

    return showSeatChangeStream;
}

async function stopRealtime() {
    if (showSeatChangeStream) {
        try {
            await showSeatChangeStream.close();
        } catch (error) {
            console.error(
                "[SKYRA REALTIME] Change stream close failed:",
                error?.message || error
            );
        }

        showSeatChangeStream = null;
    }

    if (io) {
        io.disconnectSockets(true);
        io.removeAllListeners();
        io = null;
    }
}

function getIO() {
    return io;
}

module.exports = {
    initializeRealtime,
    startShowSeatChangeStream,
    stopRealtime,
    getIO,
    getShowRoom,
    getShowSeatSnapshot,
    serializeSeat
};
