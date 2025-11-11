// ===== IMPORTS & SETUP =====

// Types and libraries for Leaflet map rendering and styling
// Note: _leafletWorkaround is required due to Leaflet's missing icon issue in modules
// @deno-types="npm:@types/leaflet"
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./_leafletWorkaround.ts";
import luck from "./_luck.ts";
import "./style.css";

// ===== CONSTANTS & CONFIGURATION =====

// Fixed classroom location (Unit 2 at UCSC) - center of our grid coordinate system
const CLASSROOM_LATLNG = L.latLng(36.997936938057016, -122.05703507501151);

// Grid cell size in degrees (~10m x 10m at this latitude)
const CELL_SIZE = 1e-4;

// Radius (in grid cells) around (0,0) where interaction is allowed
const INTERACTION_RADIUS = 3;

// Token spawning probability (15% chance a cell contains a token)
const TOKEN_SPAWN_PROBABILITY = 0.15;

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

// ===== TOKEN SYSTEM =====

// Represents a collectible token with a numeric value
interface Token {
  readonly value: number;
}

// Represents a cell in the latitude-longitude grid
interface GridCoord {
  readonly i: number; // north-south index
  readonly j: number; // east-west index
}

/*
 * Determines if a cell contains a token and returns it if present.
 * Uses deterministic hashing to ensure consistent spawning across sessions.
 */
function getCellToken(coord: GridCoord): Token | null {
  const spawnRoll = luck([coord.i, coord.j, "token"].toString());

  if (spawnRoll < TOKEN_SPAWN_PROBABILITY) {
    // Generate token value between 1-4 (powers of 2 for combining)
    const value = Math.floor(luck([coord.i, coord.j, "value"].toString()) * 4) +
      1;
    return { value };
  }

  return null;
}

// ===== GRID SYSTEM =====

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
 * Displays colored token if cell contains one.
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

  // Check if cell contains a token
  const token = getCellToken(coord);

  // Create popup content with token info
  let popupContent = `Cell (${coord.i},${coord.j}) - ${
    isInteractable ? "Interactable" : "Not Interactable"
  }`;

  if (token) {
    popupContent += `<br><strong>Token: ${token.value}</strong>`;

    // Add colored token value overlay on the cell
    const center = cellBounds.getCenter();
    const tokenColor = isInteractable ? "#4CAF50" : "#9E9E9E"; // Green vs Gray
    const borderColor = isInteractable ? "#388E3C" : "#757575";

    L.marker(center, {
      icon: L.divIcon({
        html: `<div style="
          background: ${tokenColor};
          border: 3px solid ${borderColor};
          border-radius: 50%;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 14px;
          color: white;
          text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
          box-shadow: 2px 2px 5px rgba(0,0,0,0.3);
        ">${token.value}</div>`,
        className: "token-marker",
        iconSize: [30, 30],
      }),
    }).addTo(map);
  }

  cell.bindPopup(popupContent);

  cell.on("click", () => {
    console.log(
      `Cell (${coord.i},${coord.j}) clicked - Interactable: ${isInteractable}`,
    );
    if (token) {
      console.log(`Contains token: ${token.value}`);
    }
  });
}

// ===== GRID MANAGEMENT =====

// Removes all previously drawn grid cells (rectangles) from the map.
function clearCells(): void {
  map.eachLayer((layer) => {
    if (
      layer instanceof L.Rectangle ||
      (layer instanceof L.Marker &&
        layer.getIcon()?.options?.className === "token-marker")
    ) {
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
