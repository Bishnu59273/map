const express = require("express");
const axios = require("axios");
const path = require("path");
// const app = express();
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const MAPS_API_URL =
  "https://api.openrouteservice.org/v2/directions/driving-car";
const API_KEY = "5b3ce3597851110001cf6248a5f299b4c21d4febb149cf83d068a58d";

const mongoose = require("mongoose");

const MONGO_URI =
  "mongodb+srv://bishnugcloud:MApjxukGAv8iDaQY@bishnu-p1.ltsa4.mongodb.net/work?retryWrites=true&w=majority";

mongoose
  .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected!"))
  .catch((err) => console.error("MongoDB connection error:", err));
//
const Hazard = require("./models/Hazard"); // Import the model

app.use(express.json()); // Parse JSON body

app.post("/api/hazards", async (req, res) => {
  try {
    const { type, latitude, longitude } = req.body;

    if (!type || !latitude || !longitude) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const newHazard = new Hazard({ type, latitude, longitude });
    await newHazard.save();

    res.status(201).json({ message: "Hazard reported successfully!" });
  } catch (error) {
    console.error("Error saving hazard:", error);
    res.status(500).json({ error: "Failed to save hazard" });
  }
});

app.get("/api/hazards", async (req, res) => {
  try {
    const hazards = await Hazard.find();
    res.json(hazards);
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// CORS headers for enabling cross-origin requests
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*"); // Allow all domains (for development)
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

// Serve static files (like index.html, script.js, style.css) from the 'public' folder
app.use(express.static(path.join(__dirname, "public")));

// Handle root route (http://localhost:5000/)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/api/traffic", async (req, res) => {
  const { sourceLat, sourceLng, destLat, destLng } = req.query;

  // Check if the coordinates are valid numbers
  if (
    isNaN(sourceLat) ||
    isNaN(sourceLng) ||
    isNaN(destLat) ||
    isNaN(destLng)
  ) {
    return res.status(400).json({ error: "Invalid coordinates provided" });
  }

  if (!sourceLat || !sourceLng || !destLat || !destLng) {
    return res.status(400).json({ error: "Missing required query parameters" });
  }

  try {
    // Fetch the route data from OpenRouteService API
    const response = await axios.get(MAPS_API_URL, {
      headers: { Authorization: `Bearer ${API_KEY}` },
      params: {
        start: `${sourceLng},${sourceLat}`,
        end: `${destLng},${destLat}`,
      },
    });

    const routeData = response.data;

    // Example of dynamically simulating traffic incidents (for now, using hardcoded segments)
    const blockedSegments = [];
    const coordinates = routeData.features[0].geometry.coordinates;

    // You can add traffic incidents dynamically based on coordinates or conditions
    // For example, let's add a roadblock between the 3rd and 5th coordinate point
    if (coordinates.length > 5) {
      blockedSegments.push({
        start: coordinates[2], // Adjust based on your route data
        end: coordinates[4],
        type: "roadblock",
        message: "Roadblock ahead. Use alternate route.",
      });

      blockedSegments.push({
        start: coordinates[6], // Another example
        end: coordinates[8],
        type: "accident",
        message: "Accident reported here. Expect delays.",
      });
    }

    // Send the modified route data along with simulated incidents
    res.json({
      ...routeData,
      blockedSegments, // Include the blocked segments
    });
  } catch (error) {
    console.error("Error fetching traffic data:", error.message);
    res.status(500).json({ error: "Failed to fetch traffic data" });
  }
});

// Set the server to listen on a port
const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => {
//   console.log(`Server running on http://localhost:${PORT}`);
// });
http.listen(PORT, () => {
  console.log(`🚀 Server + Socket.IO running on http://localhost:${PORT}`);
});

// Socket.io connection
io.on("connection", (socket) => {
  console.log("🟢 A user connected:", socket.id);

  socket.on("send-alert", (data) => {
    console.log("🚨 Real-time alert:", data);
    // socket.broadcast.emit("receive-alert", data);
    io.emit("receive-alert", data); // Emit to all connected clients
  });

  socket.on("disconnect", () => {
    console.log("🔴 A user disconnected:", socket.id);
  });
});
