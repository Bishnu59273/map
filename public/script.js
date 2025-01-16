const map = L.map("map").setView([51.505, -0.09], 13); // Default view

L.tileLayer("https://a.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

let routePolyline;
let destinationMarker;
let incidentMarkers = [];
let userMarker; // Store the user's location marker here

// Function to set the map to the user's current location
function centerMapToCurrentLocation() {
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;

      // Center the map to the user's location
      map.setView([latitude, longitude], 13); // Set the map view to user's location

      // Store the user's location marker in the userMarker variable
      if (userMarker) {
        userMarker.setLatLng([latitude, longitude]); // Update marker if it exists
      } else {
        userMarker = L.marker([latitude, longitude])
          .addTo(map)
          .bindPopup("You are here")
          .openPopup();
      }
    },
    () => {
      alert("Unable to retrieve your location.");
    }
  );
}

// Add event listener to "Current Location" button
document
  .getElementById("current-location-button")
  .addEventListener("click", (e) => {
    e.preventDefault();
    centerMapToCurrentLocation(); // Center the map to the user's current location
  });

navigator.geolocation.getCurrentPosition(
  async (position) => {
    const { latitude, longitude } = position.coords;

    // Center the map to the user's location
    map.setView([latitude, longitude], 13); // Set the map view to user's location

    // Store the user's location marker in the userMarker variable
    userMarker = L.marker([latitude, longitude])
      .addTo(map)
      .bindPopup("You are here")
      .openPopup();

    const destinationInput = document.getElementById("destination");
    const suggestionsList = document.getElementById("suggestions-list");

    // Handle input event for destination search
    destinationInput.addEventListener("input", async (e) => {
      const query = e.target.value.trim();
      if (query.length < 3) {
        suggestionsList.innerHTML = ""; // Clear suggestions for short input
        suggestionsList.style.display = "none"; // Hide suggestions list
        return;
      }

      const geocodeResponse = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          query
        )}`
      );
      const geocodeData = await geocodeResponse.json();

      suggestionsList.innerHTML = ""; // Clear previous suggestions

      if (geocodeData.length > 0) {
        suggestionsList.style.display = "block"; // Show the suggestions list
        geocodeData.forEach((suggestion) => {
          const li = document.createElement("li");
          li.textContent = suggestion.display_name;
          li.addEventListener("click", () => {
            // Set the destination input value to the selected suggestion
            destinationInput.value = suggestion.display_name;
            suggestionsList.innerHTML = ""; // Clear suggestions after selection
            suggestionsList.style.display = "none"; // Hide suggestions list after selection
          });
          suggestionsList.appendChild(li);
        });
      } else {
        suggestionsList.innerHTML = "<li>No suggestions found</li>";
        suggestionsList.style.display = "block"; // Show the suggestions list
      }
    });

    // Handle form submission for showing route
    document
      .getElementById("destination-form")
      .addEventListener("submit", async (e) => {
        e.preventDefault();
        const destinationName = destinationInput.value.trim();

        const geocodeResponse = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            destinationName
          )}`
        );
        const geocodeData = await geocodeResponse.json();

        if (geocodeData.length === 0) {
          document.getElementById("info").innerText = "Destination not found.";
          return;
        }

        const [destLon, destLat] = [geocodeData[0].lon, geocodeData[0].lat];

        const response = await fetch(
          `/api/traffic?sourceLat=${latitude}&sourceLng=${longitude}&destLat=${destLat}&destLng=${destLon}`
        );
        const data = await response.json();

        if (data.error) {
          document.getElementById("info").innerText =
            "Error fetching traffic data";
          return;
        }

        // Ensure the route data exists and is valid
        if (data.features && data.features[0] && data.features[0].geometry) {
          const routeCoordinates = data.features[0].geometry.coordinates.map(
            ([lon, lat]) => [lat, lon]
          );

          console.log("Route Coordinates:", routeCoordinates); // Debugging step

          // Clear any existing markers and polylines (except userMarker)
          map.eachLayer((layer) => {
            if (
              layer instanceof L.Marker ||
              layer instanceof L.Polyline ||
              layer instanceof L.CircleMarker
            ) {
              if (layer !== userMarker) {
                // Do not remove the user's location marker
                map.removeLayer(layer);
              }
            }
          });

          // Draw the route polyline with different colors
          routePolyline = L.polyline(routeCoordinates, {
            color: "green",
          }).addTo(map);

          // Simulated traffic incident data (e.g., roadblocks, accidents)
          const trafficIncidents = [
            {
              lat: routeCoordinates[2][0],
              lng: routeCoordinates[2][1],
              type: "roadblock",
              message: "Roadblock ahead! Use alternate route.",
            },
            {
              lat: routeCoordinates[4][0],
              lng: routeCoordinates[4][1],
              type: "accident",
              message: "Accident reported here. Expect delays.",
            },
            {
              lat: routeCoordinates[6][0],
              lng: routeCoordinates[6][1],
              type: "construction",
              message: "Construction zone ahead. Slow down.",
            },
          ];

          console.log("Traffic Incidents:", trafficIncidents); // Debugging step

          // Place incident markers at the traffic incident locations
          incidentMarkers = trafficIncidents.map((incident) => {
            const markerColor =
              incident.type === "roadblock" ? "red" : "orange";
            return L.circleMarker([incident.lat, incident.lng], {
              color: markerColor,
              radius: 8,
            })
              .addTo(map)
              .bindPopup(incident.message); // Show incident message on marker click
          });

          // Add a marker for the destination with a popup
          destinationMarker = L.marker([destLat, destLon])
            .addTo(map)
            .bindPopup(`Destination: ${destinationName}`)
            .openPopup();
        } else {
          document.getElementById("info").innerText = "Invalid route data.";
        }
      });

    // Add event listener to "Clear Route" button
    document.getElementById("clear-button").addEventListener("click", () => {
      // Remove all layers (route, markers, etc.), except the user marker
      map.eachLayer((layer) => {
        if (
          layer instanceof L.Marker ||
          layer instanceof L.Polyline ||
          layer instanceof L.CircleMarker
        ) {
          if (layer !== userMarker) {
            // Do not remove the user's location marker
            map.removeLayer(layer);
          }
        }
      });

      // Clear the destination input and info
      document.getElementById("destination").value = "";
      document.getElementById("info").innerText = "";
    });
  },
  () => {
    alert("Geolocation not supported or permission denied.");
  }
);
