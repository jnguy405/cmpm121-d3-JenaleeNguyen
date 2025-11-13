// ===== IMPORTS & SETUP =====
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./_leafletWorkaround.ts";
import luck from "./_luck.ts";
import "./style.css";

// ===== CONSTANTS & CONFIGURATION =====
const CONFIG = {
  CLASSROOM_LATLNG: L.latLng(36.997936938057016, -122.05703507501151),
  CELL_SIZE: 1e-4,
  INTERACTION_RADIUS: 3,
  TOKEN_SPAWN_PROBABILITY: 0.15,
  WINNING_VALUE: 8,
} as const;

// ===== GAME STATE =====
const gameState = {
  playerInventory: null as Token | null,
  placedTokens: new Map<string, Token>(),
  gameWon: false,
  playerPosition: { i: 0, j: 0 },
};

// ===== TYPE DEFINITIONS =====
interface Token {
  readonly value: number;
}
interface GridCoord {
  readonly i: number;
  readonly j: number;
}

// ===== UTILITY FUNCTIONS =====
const coordToKey = (coord: GridCoord): string => `${coord.i},${coord.j}`;

const getCellBounds = (coord: GridCoord): L.LatLngBounds =>
  L.latLngBounds([
    [
      CONFIG.CLASSROOM_LATLNG.lat + coord.i * CONFIG.CELL_SIZE,
      CONFIG.CLASSROOM_LATLNG.lng + coord.j * CONFIG.CELL_SIZE,
    ],
    [
      CONFIG.CLASSROOM_LATLNG.lat + (coord.i + 1) * CONFIG.CELL_SIZE,
      CONFIG.CLASSROOM_LATLNG.lng + (coord.j + 1) * CONFIG.CELL_SIZE,
    ],
  ]);

const isInteractable = (coord: GridCoord): boolean =>
  Math.abs(coord.i - gameState.playerPosition.i) <= CONFIG.INTERACTION_RADIUS &&
  Math.abs(coord.j - gameState.playerPosition.j) <= CONFIG.INTERACTION_RADIUS;

const coordToLatLng = (coord: GridCoord): L.LatLng =>
  L.latLng(
    CONFIG.CLASSROOM_LATLNG.lat + coord.i * CONFIG.CELL_SIZE +
      CONFIG.CELL_SIZE / 2,
    CONFIG.CLASSROOM_LATLNG.lng + coord.j * CONFIG.CELL_SIZE +
      CONFIG.CELL_SIZE / 2,
  );

// ===== UI MANAGEMENT =====
const invPanel = document.createElement("div");
invPanel.id = "inventory-panel";
document.body.appendChild(invPanel);

// Movement control panel
const controlPanel = document.createElement("div");
controlPanel.id = "control-panel";
controlPanel.innerHTML = `
  <h3>Movement Controls</h3>
  <div class="movement-buttons">
    <button id="move-north">↑ North</button>
    <div>
      <button id="move-west">← West</button>
      <button id="move-east">East →</button>
    </div>
    <button id="move-south">↓ South</button>
  </div>
  <div id="player-position">Position: (0, 0)</div>
`;
document.body.appendChild(controlPanel);

function showNotification(message: string, duration = 3000): void {
  const existing = document.getElementById("game-notification");
  existing?.remove();

  const notification = document.createElement("div");
  notification.id = "game-notification";
  notification.innerHTML = `
    <div style="
      position: fixed;
      top: 20%;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.8);
      color: white;
      padding: 15px 25px;
      border-radius: 8px;
      text-align: center;
      z-index: 10000;
      font-family: Arial, sans-serif;
      font-size: 16px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    ">
      ${message}
    </div>
  `;
  document.body.appendChild(notification);

  setTimeout(() => notification.remove(), duration);
}

function updateInvUI(): void {
  const panel = document.getElementById("inventory-panel");
  if (!panel) return;

  const { playerInventory } = gameState;
  const status = playerInventory
    ? `Holding token: ${playerInventory.value}. ${
      playerInventory.value >= CONFIG.WINNING_VALUE
        ? "🎉 YOU WIN!"
        : "Click on tokens to combine or empty cells to place."
    }`
    : "Inventory empty. Click on tokens to collect.";

  panel.innerHTML = `
    <h3>Player Inventory</h3>
    <div id="inventory-slot" class="${playerInventory ? "occupied" : "empty"}">
      ${
    playerInventory
      ? `<div class="inventory-token">${playerInventory.value}</div>`
      : "Empty"
  }
    </div>
    <div id="interaction-status">${status}</div>
  `;
}

function updatePlayerPos(): void {
  const posDisplay = document.getElementById("player-position");
  if (posDisplay) {
    posDisplay.textContent =
      `Position: (${gameState.playerPosition.i}, ${gameState.playerPosition.j})`;
  }
}

function movePlayer(deltaI: number, deltaJ: number): void {
  if (gameState.gameWon) {
    showNotification("Game completed! Movement disabled.");
    return;
  }

  gameState.playerPosition.i += deltaI;
  gameState.playerPosition.j += deltaJ;

  const newLatLng = coordToLatLng(gameState.playerPosition);
  playerMarker.setLatLng(newLatLng);

  updatePlayerPos();
  showNotification(
    `Moved to (${gameState.playerPosition.i}, ${gameState.playerPosition.j})`,
  );
  renderGrid();
}

function showWinMsg(): void {
  const winMsg = document.createElement("div");
  winMsg.id = "win-message";
  winMsg.innerHTML = `
    <div style="
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0,0,0,0.9);
      color: white;
      padding: 30px;
      border-radius: 15px;
      text-align: center;
      z-index: 10000;
      font-family: Arial, sans-serif;
    ">
      <h1 style="color: #4CAF50; margin: 0 0 20px 0;">🎉 YOU WIN! 🎉</h1>
      <p style="font-size: 18px; margin: 0 0 15px 0;">
        You successfully crafted a token of value ${CONFIG.WINNING_VALUE} or higher!
      </p>
      <p style="font-size: 14px; color: #ccc;">
        Refresh the page to play again.
      </p>
    </div>
  `;
  document.body.appendChild(winMsg);
}

// ===== TOKEN SYSTEM =====
function getCellToken(coord: GridCoord): Token | null {
  const key = coordToKey(coord);

  if (gameState.placedTokens.has(key)) return gameState.placedTokens.get(key)!;

  const spawnRoll = luck([coord.i, coord.j, "token"].toString());
  if (spawnRoll < CONFIG.TOKEN_SPAWN_PROBABILITY) {
    const value = Math.floor(luck([coord.i, coord.j, "value"].toString()) * 4) +
      1;
    return { value };
  }

  return null;
}

// ===== GAME MECHANICS =====
function tokenCollection(
  coord: GridCoord,
  token: Token,
  tokenMarker: L.Marker,
): void {
  gameState.playerInventory = token;
  const key = coordToKey(coord);

  gameState.placedTokens.delete(key);

  map.removeLayer(tokenMarker);
  showNotification(`Collected token: ${token.value}`);
  updateInvUI();
  checkWin();
}

function tokenCombo(
  coord: GridCoord,
  token: Token,
  tokenMarker: L.Marker,
): void {
  const newValue = token.value * 2;
  const newToken: Token = { value: newValue };
  const key = coordToKey(coord);

  gameState.placedTokens.set(key, newToken);
  map.removeLayer(tokenMarker);
  drawToken(coord, newToken, isInteractable(coord));
  gameState.playerInventory = null;

  showNotification(`Combined tokens! Created value ${newValue}`);
  updateInvUI();
  checkWin();
}

function tokenInteraction(
  coord: GridCoord,
  token: Token,
  tokenMarker: L.Marker,
): void {
  if (gameState.gameWon) {
    showNotification("Game completed! 🎉 Refresh to play again.");
    return;
  }

  if (!isInteractable(coord)) {
    showNotification("Move closer to interact with this token");
    return;
  }

  if (!gameState.playerInventory) {
    tokenCollection(coord, token, tokenMarker);
  } else if (gameState.playerInventory.value === token.value) {
    tokenCombo(coord, token, tokenMarker);
  } else {
    showNotification(
      `Cannot combine: holding ${gameState.playerInventory.value}, clicked ${token.value}`,
    );
  }
}

function isEmptyCell(coord: GridCoord): void {
  if (
    gameState.gameWon || !gameState.playerInventory || !isInteractable(coord)
  ) {
    if (!isInteractable(coord)) {
      showNotification("Move closer to place token here");
    }
    return;
  }

  gameState.placedTokens.set(coordToKey(coord), gameState.playerInventory);
  gameState.playerInventory = null;

  showNotification("Token placed on cell");
  updateInvUI();
  renderGrid();
}

function checkWin(): void {
  if (gameState.gameWon) return;

  const hasWinningToken = (gameState.playerInventory &&
    gameState.playerInventory.value >= CONFIG.WINNING_VALUE) ||
    Array.from(gameState.placedTokens.values()).some((token) =>
      token.value >= CONFIG.WINNING_VALUE
    );

  if (hasWinningToken) {
    gameState.gameWon = true;
    showWinMsg();
  }
}

// ===== GRID SYSTEM =====
function getGridCoords(): GridCoord[] {
  const bounds = map.getBounds();
  const { CLASSROOM_LATLNG, CELL_SIZE } = CONFIG;

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
  return coords;
}

// ===== RENDERING =====
function drawGridCell(coord: GridCoord): void {
  const interactable = isInteractable(coord);
  const bounds = getCellBounds(coord);
  const token = getCellToken(coord);

  const cell = L.rectangle(bounds, {
    color: interactable ? "green" : "gray",
    weight: interactable ? 2 : 1,
    fillColor: interactable ? "lightgreen" : "lightgray",
    fillOpacity: 0.3,
    interactive: false,
  }).addTo(map);

  const cellStatus = token ? `Contains token: ${token.value}` : "Empty cell";

  cell.bindPopup(`
    Cell (${coord.i},${coord.j})<br>
    ${interactable ? "🟢 Interactable Area" : "⚫ Not Interactable"}<br>
    ${cellStatus}
  `);

  if (!token && interactable) {
    cell.setStyle({ interactive: true });
    cell.on("click", () => isEmptyCell(coord));
  }

  if (token) drawToken(coord, token, interactable);
}

function drawToken(
  coord: GridCoord,
  token: Token,
  interactable: boolean,
): void {
  const center = coordToLatLng(coord);

  const marker = L.marker(center, {
    icon: L.divIcon({
      html: `<div class="token ${
        interactable ? "token-interactable" : "token-non-interactable"
      }">${token.value}</div>`,
      className: "token-marker",
      iconSize: [30, 30],
    }),
  }).addTo(map);

  marker.bindPopup(tokenPopup(coord, token, interactable));
  marker.on("click", () => tokenInteraction(coord, token, marker));
}

function tokenPopup(
  coord: GridCoord,
  token: Token,
  interactable: boolean,
): string {
  let actionText = "Move closer to interact";

  if (interactable && !gameState.gameWon) {
    if (gameState.playerInventory) {
      actionText = gameState.playerInventory.value === token.value
        ? "Click to combine tokens!"
        : "Click to collect token!";
    } else {
      actionText = "Click to collect token!";
    }
  } else if (gameState.gameWon) {
    actionText = "Game completed! 🎉";
  }

  return `
    <strong>Token at (${coord.i},${coord.j})</strong><br>
    Value: ${token.value}<br>
    Status: ${interactable ? "🟢 Interactable" : "⚫ Not Interactable"}<br>
    <em>${actionText}</em>
  `;
}

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

function renderGrid(): void {
  clearCells();
  const visibleCoords = getGridCoords();
  visibleCoords.forEach(drawGridCell);
  console.log(`Drew ${visibleCoords.length} grid cells`);
}

// ===== INITIALIZATION =====
const map = L.map("map").setView(CONFIG.CLASSROOM_LATLNG, 19);

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution:
    '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

const playerMarker = L.marker(CONFIG.CLASSROOM_LATLNG, {
  icon: L.divIcon({
    html: `<div class="player-marker">YOU</div>`,
    className: "player-marker-container",
    iconSize: [40, 40],
  }),
}).addTo(map);
playerMarker.bindPopup(
  `Player Location - Center (${gameState.playerPosition.i},${gameState.playerPosition.j})<br>Interaction Radius: ${CONFIG.INTERACTION_RADIUS} cells`,
);

// Movement button event listeners
document.getElementById("move-north")?.addEventListener(
  "click",
  () => movePlayer(-1, 0),
);
document.getElementById("move-south")?.addEventListener(
  "click",
  () => movePlayer(1, 0),
);
document.getElementById("move-east")?.addEventListener(
  "click",
  () => movePlayer(0, 1),
);
document.getElementById("move-west")?.addEventListener(
  "click",
  () => movePlayer(0, -1),
);

// Initial setup
updateInvUI();
updatePlayerPos();
renderGrid();
map.on("moveend", renderGrid).on("zoomend", renderGrid);
