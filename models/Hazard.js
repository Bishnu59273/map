const mongoose = require("mongoose");

const hazardSchema = new mongoose.Schema({
  type: String, // e.g., "roadblock" or "accident"
  latitude: Number,
  longitude: Number,
  timestamp: { type: Date, default: Date.now },
});

const Hazard = mongoose.model("Hazard", hazardSchema);

module.exports = Hazard;
