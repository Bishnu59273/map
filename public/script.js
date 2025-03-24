const map = L.map("map").setView([51.505, -0.09], 13); // Default view

L.tileLayer("https://a.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

let routePolyline;
let destinationMarker;
let userMarker;
let incidentMarkers = [];
let manualLocation = null; // Store manually selected location

// Allow user to select a manual location by clicking on the map
function enableManualLocationSelection() {
  map.on("click", (e) => {
    const { lat, lng } = e.latlng;
    manualLocation = { latitude: lat, longitude: lng };

    // Set marker at selected location
    if (userMarker) {
      userMarker.setLatLng([lat, lng]).bindPopup("Manual Location").openPopup();
    } else {
      userMarker = L.marker([lat, lng])
        .addTo(map)
        .bindPopup("Manual Location")
        .openPopup();
    }

    console.log(`Manual location set: ${lat}, ${lng}`);
  });
}

// Center the map to the user's location
function centerMapToCurrentLocation() {
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      map.setView([latitude, longitude], 13);

      if (userMarker) {
        userMarker.setLatLng([latitude, longitude]);
      } else {
        userMarker = L.marker([latitude, longitude])
          .addTo(map)
          .bindPopup("You are here")
          .openPopup();
      }
    },
    () => alert("Unable to retrieve your location.")
  );
}

// Fetch and display hazards along the route
async function fetchAndDisplayRouteHazards(routeCoordinates) {
  try {
    const response = await fetch("/api/hazards");
    if (!response.ok) throw new Error("Failed to fetch hazards");

    const hazards = await response.json();
    const filteredHazards = hazards.filter((hazard) =>
      isHazardNearRoute(hazard, routeCoordinates)
    );

    // Clear previous hazard markers
    incidentMarkers.forEach((marker) => map.removeLayer(marker));
    incidentMarkers = [];

    filteredHazards.forEach((hazard) => {
      if (hazard.latitude !== undefined && hazard.longitude !== undefined) {
        const color =
          hazard.type.toLowerCase() === "accident"
            ? "red"
            : hazard.type.toLowerCase() === "roadblock"
            ? "orange"
            : "blue";

        const marker = L.circleMarker([hazard.latitude, hazard.longitude], {
          color: color,
        })
          .addTo(map)
          .bindPopup(
            `${hazard.type} at ${
              hazard.location ? hazard.location : "Unknown location"
            }`
          );

        incidentMarkers.push(marker);
      } else {
        console.error("Missing Lat/Lng for hazard:", hazard);
      }
    });
  } catch (error) {
    console.error("Error fetching hazards:", error);
  }
}

// Check if a hazard is near the route
function isHazardNearRoute(hazard, routeCoordinates) {
  const threshold = 0.005; // Adjust this value for sensitivity (~500m)
  return routeCoordinates.some(([lat, lon]) => {
    const distance = Math.sqrt(
      Math.pow(lat - hazard.latitude, 2) + Math.pow(lon - hazard.longitude, 2)
    );
    return distance < threshold;
  });
}

// Update handleDestinationSearch to call the new function
async function handleDestinationSearch(event) {
  event.preventDefault();
  const destinationInput = document.getElementById("destination").value.trim();
  if (!destinationInput) return;

  try {
    const geoResponse = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        destinationInput
      )}`
    );
    const geoData = await geoResponse.json();
    if (geoData.length === 0) {
      document.getElementById("info").innerText = "Destination not found.";
      return;
    }

    const { lat: destLat, lon: destLon } = geoData[0];
    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude } = position.coords;
      const routeResponse = await fetch(
        `/api/traffic?sourceLat=${latitude}&sourceLng=${longitude}&destLat=${destLat}&destLng=${destLon}`
      );
      const routeData = await routeResponse.json();

      if (!routeData.features || !routeData.features[0]?.geometry) {
        document.getElementById("info").innerText = "Invalid route data.";
        return;
      }

      // Clear existing markers and route, except userMarker
      map.eachLayer((layer) => {
        if (layer instanceof L.Marker || layer instanceof L.Polyline) {
          if (layer !== userMarker) map.removeLayer(layer);
        }
      });

      // Draw route
      const routeCoordinates = routeData.features[0].geometry.coordinates.map(
        ([lon, lat]) => [lat, lon]
      );
      routePolyline = L.polyline(routeCoordinates, { color: "green" }).addTo(
        map
      );

      // Add destination marker
      destinationMarker = L.marker([destLat, destLon])
        .addTo(map)
        .bindPopup(`Destination: ${destinationInput}`)
        .openPopup();

      // Fetch and display hazards along the route
      fetchAndDisplayRouteHazards(routeCoordinates);
    });
  } catch (error) {
    console.error("Error fetching route:", error);
  }
}
// Report hazard
// async function reportHazard(type) {
//   if (!navigator.geolocation) {
//     alert("Geolocation is not supported by your browser.");
//     return;
//   }

//   navigator.geolocation.getCurrentPosition(
//     async (position) => {
//       const { latitude, longitude } = position.coords;
//       try {
//         const response = await fetch("/api/hazards", {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify({ type, latitude, longitude }),
//         });
//         const data = await response.json();
//         alert(data.message || "Hazard reported successfully!");
//         fetchAndDisplayHazards(); // Refresh hazards after reporting
//       } catch (error) {
//         console.error("Error reporting hazard:", error);
//       }
//     },
//     () => alert("Could not retrieve location.")
//   );
// }

async function reportHazard(type) {
  let latitude, longitude;

  if (manualLocation) {
    // Use manually selected location
    latitude = manualLocation.latitude;
    longitude = manualLocation.longitude;
  } else if (navigator.geolocation) {
    // Use current location if manual location is not set
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
        await sendHazardReport(type, latitude, longitude);
      },
      () => alert("Could not retrieve location.")
    );
    return;
  } else {
    alert("Geolocation is not supported by your browser.");
    return;
  }

  await sendHazardReport(type, latitude, longitude);
}

// Separate function to send hazard data
async function sendHazardReport(type, latitude, longitude) {
  try {
    const response = await fetch("/api/hazards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, latitude, longitude }),
    });
    const data = await response.json();
    alert(data.message || "Hazard reported successfully!");
    fetchAndDisplayHazards(); // Refresh hazards after reporting
  } catch (error) {
    console.error("Error reporting hazard:", error);
  }
}

// Clear route
document.getElementById("clear-button").addEventListener("click", () => {
  map.eachLayer((layer) => {
    if (
      layer instanceof L.Marker ||
      layer instanceof L.Polyline ||
      layer instanceof L.CircleMarker
    ) {
      if (layer !== userMarker) map.removeLayer(layer);
    }
  });
  document.getElementById("destination").value = "";
  document.getElementById("info").innerText = "";
});

// Event listeners
document
  .getElementById("destination-form")
  .addEventListener("submit", handleDestinationSearch);
document
  .getElementById("current-location-button")
  .addEventListener("click", centerMapToCurrentLocation);

// Auto-center map on load
centerMapToCurrentLocation();
enableManualLocationSelection();
fetchAndDisplayHazards();
