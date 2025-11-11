// ===== IMPORTS & SETUP =====

// Types and libraries for Leaflet map rendering and styling
// Note: _leafletWorkaround is required due to Leaflet's missing icon issue in modules
// @deno-types="npm:@types/leaflet"
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./_leafletWorkaround.ts";
import "./style.css";

// ===== CONSTANTS & CONFIGURATION =====

// Fixed classroom location (Unit 2 at UCSC) - center of our grid coordinate system
const CLASSROOM_LATLNG = L.latLng(36.997936938057016, -122.05703507501151);

// Grid cell size in degrees (~10m x 10m at this latitude)
const CELL_SIZE = 1e-4;

// Radius (in grid cells) around (0,0) where interaction is allowed
const INTERACTION_RADIUS = 3;

// ===== MAP INITIALIZATION =====

// Initialize the Leaflet map, set view to classroom, zoom level for building-scale view
const map = L.map("map").setView(CLASSROOM_LATLNG, 19);

// Add OpenStreetMap tile layer as background
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution:
    '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

// Add marker for classroom (center of the grid) for visual reference
const classroomMarker = L.marker(CLASSROOM_LATLNG).addTo(map);
classroomMarker.bindPopup("Exact Classroom Location - Center (0,0)");

// ===== GRID SYSTEM =====

// Represents a cell in the latitude-longitude grid
interface GridCoord {
  readonly i: number; // north-south index
  readonly j: number; // east-west index
}

/*
 * Gets all grid coordinates currently visible in the map viewport.
 * Maps real-world lat/lng bounds to integer grid indices centered at (0,0).
 */
function getGridCoords(): GridCoord[] {
  const bounds = map.getBounds();
  const iMin = Math.floor(
    (bounds.getSouthWest().lat - CLASSROOM_LATLNG.lat) / CELL_SIZE,
  );
  const iMax = Math.floor(
    (bounds.getNorthEast().lat - CLASSROOM_LATLNG.lat) / CELL_SIZE,
  );
  const jMin = Math.floor(
    (bounds.getSouthWest().lng - CLASSROOM_LATLNG.lng) / CELL_SIZE,
  );
  const jMax = Math.floor(
    (bounds.getNorthEast().lng - CLASSROOM_LATLNG.lng) / CELL_SIZE,
  );

  const coords: GridCoord[] = [];
  for (let i = iMin; i <= iMax; i++) {
    for (let j = jMin; j <= jMax; j++) {
      coords.push({ i, j });
    }
  }
  console.log(`Visible cells: i=${iMin} to ${iMax}, j=${jMin} to ${jMax}`);
  return coords;
}

// ===== CELL RENDERING =====

/*
 * Draws a single grid cell (rectangle) on the map at the given coordinate.
 * Color and interactivity depend on distance from center (interaction radius).
 */
function drawGridCell(coord: GridCoord): void {
  const isInteractable = Math.abs(coord.i) <= INTERACTION_RADIUS &&
    Math.abs(coord.j) <= INTERACTION_RADIUS;

  const cellBounds = L.latLngBounds([
    [
      CLASSROOM_LATLNG.lat + coord.i * CELL_SIZE,
      CLASSROOM_LATLNG.lng + coord.j * CELL_SIZE,
    ],
    [
      CLASSROOM_LATLNG.lat + (coord.i + 1) * CELL_SIZE,
      CLASSROOM_LATLNG.lng + (coord.j + 1) * CELL_SIZE,
    ],
  ]);

  const cell = L.rectangle(cellBounds, {
    color: isInteractable ? "green" : "gray",
    weight: isInteractable ? 2 : 1,
    fillColor: isInteractable ? "lightgreen" : "lightgray",
    fillOpacity: 0.3,
    interactive: true,
  }).addTo(map);

  cell.bindPopup(
    `Cell (${coord.i},${coord.j}) - ${
      isInteractable ? "Interactable" : "Not Interactable"
    }`,
  );

  cell.on("click", () => {
    console.log(
      `Cell (${coord.i},${coord.j}) clicked - Interactable: ${isInteractable}`,
    );
  });
}

// ===== GRID MANAGEMENT =====

// Removes all previously drawn grid cells (rectangles) from the map.
function clearCells(): void {
  map.eachLayer((layer) => {
    if (layer instanceof L.Rectangle) {
      map.removeLayer(layer);
    }
  });
}

/*
 * Re-renders the entire visible grid.
 * Called initially and whenever the map moves (pan/zoom).
 */
function renderGrid(): void {
  console.log("Drawing visible grid cells");
  clearCells();
  const visibleCoords = getGridCoords();
  visibleCoords.forEach(drawGridCell);
  console.log(`Drew ${visibleCoords.length} grid cells`);
}

// Initial render
renderGrid();

// Re-render grid when map view changes
map.on("moveend", renderGrid);
