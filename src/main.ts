// @deno-types="npm:@types/leaflet"
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./_leafletWorkaround.ts";
import "./style.css";

console.log("Script loaded - starting map initialization");

// Coordinates of Classroom Unit 2 at UCSC
const CLASSROOM_LATLNG = L.latLng(36.997936938057016, -122.05703507501151);
const map = L.map("map").setView(CLASSROOM_LATLNG, 19); // zoom level

console.log("Map created, adding tile layer");

// Populate the map with the background tile layer
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution:
    '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

console.log("Tile layer added");

// Define cell size constant
const CELL_SIZE = 1e-4;

// Draw a single test cell as a Leaflet rectangle
function drawTestCell() {
  console.log("Drawing test cell at classroom location");

  // Draw cell at (0,0) relative to classroom
  const testCellBounds = L.latLngBounds([
    [CLASSROOM_LATLNG.lat, CLASSROOM_LATLNG.lng],
    [CLASSROOM_LATLNG.lat + CELL_SIZE, CLASSROOM_LATLNG.lng + CELL_SIZE],
  ]);

  const testCell = L.rectangle(testCellBounds, {
    color: "red",
    weight: 3,
    fillColor: "blue",
    fillOpacity: 0.5,
  }).addTo(map);

  testCell.bindPopup("Test Cell (0,0) - Classroom Location");

  // Marker at the exact classroom spot for reference
  const classroomMarker = L.marker(CLASSROOM_LATLNG).addTo(map);
  classroomMarker.bindPopup("Exact Classroom Location");

  console.log("Test cell and marker drawn");
}

drawTestCell();

console.log("Map initialization complete");
