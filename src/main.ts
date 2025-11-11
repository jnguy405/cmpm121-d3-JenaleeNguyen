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
const CELL_SIZE = 1e-4; // Grid cell size in degrees
const INTERACTION_RADIUS = 3; // Radius (in grid cells) around (0,0)
const TOKEN_SPAWN_PROBABILITY = 0.15; // Token spawning probability (15% chance)

// ===== GAME STATE =====

// Player's single-slot inventory (can hold one token or be empty)
let playerInventory: Token | null = null;

// Track which cells have been collected (so tokens don't respawn)
const collectedTokens = new Set<string>();

// ===== UI ELEMENTS =====

// Create inventory display panel
const inventoryPanel = document.createElement("div");
inventoryPanel.id = "inventory-panel";
document.body.appendChild(inventoryPanel);
updateInventoryUI(); // Initial UI setup

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

// Helper to create a unique key for grid coordinates
function coordToKey(coord: GridCoord): string {
  return `${coord.i},${coord.j}`;
}

/*
 * Determines if a cell contains a token and returns it if present.
 * Uses deterministic hashing to ensure consistent spawning across sessions.
 */
function getCellToken(coord: GridCoord): Token | null {
  // Skip if this token was already collected
  if (collectedTokens.has(coordToKey(coord))) {
    return null;
  }

  const spawnRoll = luck([coord.i, coord.j, "token"].toString());

  if (spawnRoll < TOKEN_SPAWN_PROBABILITY) {
    // Generate token value between 1-4 (powers of 2 for combining)
    const value = Math.floor(luck([coord.i, coord.j, "value"].toString()) * 4) +
      1;
    return { value };
  }

  return null;
}

// ===== GAME MECHANICS =====

// Handles token interaction when a token is clicked
function tokenInteraction(
  coord: GridCoord,
  token: Token,
  tokenMarker: L.Marker,
): void {
  const isInteractable = Math.abs(coord.i) <= INTERACTION_RADIUS &&
    Math.abs(coord.j) <= INTERACTION_RADIUS;

  if (!isInteractable) {
    console.log(`Token at (${coord.i},${coord.j}) is not in interaction range`);
    return;
  }

  console.log(
    `Interacting with token at (${coord.i},${coord.j}) - Value: ${token.value}`,
  );

  if (!playerInventory) {
    // Collect token into inventory
    playerInventory = token;
    collectedTokens.add(coordToKey(coord)); // Mark as collected
    map.removeLayer(tokenMarker); // Remove token from map
    console.log(`Collected token: ${token.value}`);
    updateInventoryUI();
  } else {
    // Already holding a token - could combine or swap (Phase 5)
    console.log(
      `Already holding token: ${playerInventory.value}. Cannot collect ${token.value} yet.`,
    );
  }
}

// ===== GRID SYSTEM =====

// Calculates the geographic bounds for a grid cell coordinate
function getCellBounds(coord: GridCoord): L.LatLngBounds {
  return L.latLngBounds([
    [
      CLASSROOM_LATLNG.lat + coord.i * CELL_SIZE,
      CLASSROOM_LATLNG.lng + coord.j * CELL_SIZE,
    ],
    [
      CLASSROOM_LATLNG.lat + (coord.i + 1) * CELL_SIZE,
      CLASSROOM_LATLNG.lng + (coord.j + 1) * CELL_SIZE,
    ],
  ]);
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

// Creates a visual grid cell background (non-interactive)
function drawGridCell(coord: GridCoord): void {
  const isInteractable = Math.abs(coord.i) <= INTERACTION_RADIUS &&
    Math.abs(coord.j) <= INTERACTION_RADIUS;

  const cellBounds = getCellBounds(coord);

  const cell = L.rectangle(cellBounds, {
    color: isInteractable ? "green" : "gray",
    weight: isInteractable ? 2 : 1,
    fillColor: isInteractable ? "lightgreen" : "lightgray",
    fillOpacity: 0.3,
    interactive: false,
  }).addTo(map);

  const token = getCellToken(coord);
  const cellStatus = token
    ? `Contains token: ${token.value}`
    : collectedTokens.has(coordToKey(coord))
    ? "Token collected"
    : "Empty cell";

  cell.bindPopup(`
    Cell (${coord.i},${coord.j})<br>
    ${isInteractable ? "🟢 Interactable Area" : "⚫ Not Interactable"}<br>
    ${cellStatus}
  `);

  // If cell has a token, draw it separately
  if (token) {
    drawToken(coord, token, cellBounds, isInteractable);
  }
}

// Creates an interactive token marker at the specified location
function drawToken(
  coord: GridCoord,
  token: Token,
  cellBounds: L.LatLngBounds,
  isInteractable: boolean,
): void {
  const center = cellBounds.getCenter();
  const tokenClass = isInteractable
    ? "token-interactable"
    : "token-non-interactable";

  const tokenMarker = L.marker(center, {
    icon: L.divIcon({
      html: `<div class="token ${tokenClass}">${token.value}</div>`,
      className: "token-marker",
      iconSize: [30, 30],
    }),
  }).addTo(map);

  const popupContent = createTokenPopup(coord, token, isInteractable);
  tokenMarker.bindPopup(popupContent);

  tokenMarker.on("click", () => {
    console.log(
      `Token at (${coord.i},${coord.j}) clicked - Value: ${token.value}`,
    );
    tokenInteraction(coord, token, tokenMarker);
  });
}

// Creates popup content for a token based on current game state
function createTokenPopup(
  coord: GridCoord,
  token: Token,
  isInteractable: boolean,
): string {
  let actionText = "Move closer to interact";

  if (isInteractable) {
    if (playerInventory) {
      actionText = playerInventory.value === token.value
        ? "Click to combine tokens!"
        : "Click to collect token!";
    } else {
      actionText = "Click to collect token!";
    }
  }

  return `
    <strong>Token at (${coord.i},${coord.j})</strong><br>
    Value: ${token.value}<br>
    Status: ${isInteractable ? "🟢 Interactable" : "⚫ Not Interactable"}<br>
    <em>${actionText}</em>
  `;
}

// ===== GRID MANAGEMENT =====

// Removes all previously drawn grid cells and tokens from the map.
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

// Updates the inventory UI to reflect current player inventory state
function updateInventoryUI(): void {
  const inventoryPanel = document.getElementById("inventory-panel");
  if (!inventoryPanel) return;

  inventoryPanel.innerHTML = `
    <h3>Player Inventory</h3>
    <div id="inventory-slot" class="${playerInventory ? "occupied" : "empty"}">
      ${
    playerInventory
      ? `<div class="inventory-token">${playerInventory.value}</div>`
      : "Empty"
  }
    </div>
    <div id="interaction-status">
      ${
    playerInventory
      ? `Holding token: ${playerInventory.value}. Click on tokens to combine.`
      : "Inventory empty. Click on tokens to collect."
  }
    </div>
  `;
}

// ===== MAP INITIALIZATION =====

// Initialize the Leaflet map, set view to classroom, zoom level for building-scale view
const map = L.map("map").setView(CLASSROOM_LATLNG, 19);

// Add OpenStreetMap tile layer as background
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution:
    '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

// Add player marker at classroom location
const playerMarker = L.marker(CLASSROOM_LATLNG, {
  icon: L.divIcon({
    html: `<div class="player-marker">YOU</div>`,
    className: "player-marker-container",
    iconSize: [40, 40],
  }),
}).addTo(map);
playerMarker.bindPopup(
  "Player Location - Center (0,0)<br>Interaction Radius: 3 cells",
);

// Initial render
renderGrid();

// Re-render grid when map moves or zooms
map.on("moveend", renderGrid);
map.on("zoomend", renderGrid);
