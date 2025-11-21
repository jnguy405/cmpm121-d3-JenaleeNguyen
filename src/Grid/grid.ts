import L from "leaflet";
import type { Token } from "../Token/token.ts";
import type { TokenGame } from "../Token/tokenGame.ts";

// Represents discrete grid coordinates (i,j) for the game world
export class GridCoord {
  constructor(readonly i: number, readonly j: number) {}

  toString(): string {
    return `${this.i},${this.j}`;
  }

  equals(other: GridCoord): boolean {
    return this.i === other.i && this.j === other.j;
  }

  // Euclidean distance between cell centers
  distanceTo(other: GridCoord): number {
    return Math.sqrt(
      Math.pow(this.i - other.i, 2) + Math.pow(this.j - other.j, 2),
    );
  }

  // Add a small buffer to include tokens that are visually within the circle
  isWithin(other: GridCoord, radius: number): boolean {
    return this.distanceTo(other) <= radius + 0.3; // IMPORTANT: Small buffer for visual alignment
  }
}

// Handles rendering grid cells and tokens on the Leaflet map
export class GridRenderer {
  private gridLayers: L.Layer[] = []; // Grid cell rectangles
  private tokenMarkers: L.Marker[] = []; // Token markers
  private rangeCircle: L.Circle | null = null; // Interaction range circle

  constructor(private game: TokenGame) {}

  // Convert grid coordinates to map lat/lng
  private coordToLatLng(coord: GridCoord): L.LatLng {
    const { config } = this.game;
    return L.latLng(
      config.globalLatLng.lat + coord.i * config.cellSize + config.cellSize / 2,
      config.globalLatLng.lng + coord.j * config.cellSize + config.cellSize / 2,
    );
  }

  // Get the map bounds for a grid cell
  private getCellBounds(coord: GridCoord): L.LatLngBounds {
    const { config } = this.game;
    return L.latLngBounds([
      [
        config.globalLatLng.lat + coord.i * config.cellSize,
        config.globalLatLng.lng + coord.j * config.cellSize,
      ],
      [
        config.globalLatLng.lat + (coord.i + 1) * config.cellSize,
        config.globalLatLng.lng + (coord.j + 1) * config.cellSize,
      ],
    ]);
  }

  // Get all grid coordinates currently visible in the map viewport
  private getGridCoords(): GridCoord[] {
    const { map, config } = this.game;
    const bounds = map.getBounds();

    // Calculate visible grid range based on map bounds
    const iMin = Math.floor(
      (bounds.getSouthWest().lat - config.globalLatLng.lat) / config.cellSize,
    );
    const iMax = Math.floor(
      (bounds.getNorthEast().lat - config.globalLatLng.lat) / config.cellSize,
    );
    const jMin = Math.floor(
      (bounds.getSouthWest().lng - config.globalLatLng.lng) / config.cellSize,
    );
    const jMax = Math.floor(
      (bounds.getNorthEast().lng - config.globalLatLng.lng) / config.cellSize,
    );

    const coords: GridCoord[] = [];
    for (let i = iMin; i <= iMax; i++) {
      for (let j = jMin; j <= jMax; j++) {
        coords.push(new GridCoord(i, j));
      }
    }
    return coords;
  }

  // Draw the interaction range circle around the player
  private drawInteractionRange(): void {
    const { player, config, map } = this.game;

    // Remove existing range circle
    if (this.rangeCircle) {
      map.removeLayer(this.rangeCircle);
    }

    // Get player's current position in lat/lng using grid position
    const playerCenter = this.coordToLatLng(player.position);

    // Calculate circle radius in meters (approximate conversion from grid cells)
    const circleRadius = config.interactionRadius * config.cellSize * 111320; // Rough meters per degree

    this.rangeCircle = L.circle(playerCenter, {
      radius: circleRadius,
      color: "#8a2be2",
      weight: 4,
      fillColor: "#9370db",
      fillOpacity: 0.3,
      className: "player-range-circle",
    }).addTo(map);

    // Add popup to explain the range
    this.rangeCircle.bindPopup(`
    <strong>Interaction Range</strong><br>
    You can interact with tokens within this circle<br>
    Radius: ${config.interactionRadius} grid cells
  `);
  }

  // Draw a single grid cell and its contents
  private drawGridCell(coord: GridCoord): void {
    const { game } = this;
    const interactable = game.player.isInRange(
      coord,
      game.config.interactionRadius,
    );
    const bounds = this.getCellBounds(coord);
    const token = game.grid.getOrSpawn(coord);

    // Create grid cell rectangle
    const cell = L.rectangle(bounds, {
      color: interactable
        ? "rgba(147, 112, 219, 0.5)"
        : "rgba(128, 128, 128, 0.3)",
      weight: interactable ? 1 : 0.5,
      fillColor: interactable
        ? "rgba(147, 112, 219, 0.1)"
        : "rgba(128, 128, 128, 0.05)",
      fillOpacity: 0.1,
      interactive: true, // Always interactive for popups
    }).addTo(game.map);

    // Set popup content based on whether cell has token
    if (token) {
      cell.bindPopup(this.tokenPopup(coord, token, interactable));
    } else {
      cell.bindPopup(this.emptyCellPopup(coord, interactable));
    }

    // Draw token if present
    if (token) {
      this.drawToken(coord, token, interactable);
    }

    this.gridLayers.push(cell);
  }

  // Draw a token marker at the specified grid coordinate
  private drawToken(
    coord: GridCoord,
    token: Token,
    interactable: boolean,
  ): void {
    const { game } = this;
    const center = this.coordToLatLng(coord);

    const marker = L.marker(center, {
      icon: L.divIcon({
        html: `<div class="token ${
          interactable ? "token-interactable" : "token-non-interactable"
        }">${token.value}</div>`,
        className: "token-marker",
        iconSize: [30, 30],
      }),
    }).addTo(game.map);

    // Only open popup on click, don't handle the action directly
    marker.bindPopup(this.tokenPopup(coord, token, interactable));

    this.tokenMarkers.push(marker);
  }

  // Generate popup content for token markers with action buttons
  private tokenPopup(
    coord: GridCoord,
    token: Token,
    interactable: boolean,
  ): string {
    const { game } = this;

    if (!interactable || game.gameWon) {
      const statusText = game.gameWon
        ? "Game completed! 🎉"
        : "Move closer to interact";
      return `
      <strong>Token at (${coord.i},${coord.j})</strong><br>
      Value: ${token.value}<br>
      Status: ${interactable ? "💜 Within Range" : "🩶 Outside Range"}<br>
      <em>${statusText}</em>
    `;
    }

    let actionButtons = "";

    if (!game.player.inventory) {
      actionButtons = `
      <button class="popup-action-btn pick-up-btn" data-action="pickup" data-i="${coord.i}" data-j="${coord.j}">
        📥 Pick Up Token
      </button>
    `;
    } else if (game.player.inventory.canCombineWith(token)) {
      actionButtons = `
      <button class="popup-action-btn combine-btn" data-action="combine" data-i="${coord.i}" data-j="${coord.j}">
        🔄 Combine Tokens
      </button>
    `;
    } else {
      actionButtons = `
      <button class="popup-action-btn pick-up-btn" data-action="pickup" data-i="${coord.i}" data-j="${coord.j}">
        📥 Pick Up Token (Replace Current)
      </button>
    `;
    }

    return `
    <div class="token-popup">
      <strong>Token at (${coord.i},${coord.j})</strong><br>
      Value: ${token.value}<br>
      Status: 💜 Within Range<br>
      <div class="popup-actions">
        ${actionButtons}
      </div>
    </div>
  `;
  }

  // Generate popup content for empty cells with action buttons
  private emptyCellPopup(coord: GridCoord, interactable: boolean): string {
    const { game } = this;

    if (!interactable || game.gameWon) {
      const statusText = game.gameWon
        ? "Game completed! 🎉"
        : "Move closer to interact";
      return `
      <strong>Empty Cell (${coord.i},${coord.j})</strong><br>
      Status: ${interactable ? "💜 Within Range" : "🩶 Outside Range"}<br>
      <em>${statusText}</em>
    `;
    }

    if (game.player.inventory) {
      return `
      <div class="token-popup">
        <strong>Empty Cell (${coord.i},${coord.j})</strong><br>
        Status: 💜 Within Range<br>
        <div class="popup-actions">
          <button class="popup-action-btn place-btn" data-action="place" data-i="${coord.i}" data-j="${coord.j}">
            📍 Place Token Here
          </button>
        </div>
      </div>
    `;
    }

    return `
    <strong>Empty Cell (${coord.i},${coord.j})</strong><br>
    Status: 💜 Within Range<br>
    <em>No token to place</em>
  `;
  }
  // Remove all grid cells and tokens from the map
  clearGrid(): void {
    this.gridLayers.forEach((layer) => this.game.map.removeLayer(layer));
    this.tokenMarkers.forEach((marker) => this.game.map.removeLayer(marker));
    if (this.rangeCircle) {
      this.game.map.removeLayer(this.rangeCircle);
      this.rangeCircle = null;
    }
    this.gridLayers = [];
    this.tokenMarkers = [];
  }

  // Main rendering method - clears and redraws visible grid and range circle
  renderGrid(): void {
    this.clearGrid();
    this.drawInteractionRange(); // Draw the circular range first
    const visibleCoords = this.getGridCoords();
    visibleCoords.forEach((coord) => this.drawGridCell(coord));
  }

  // Update just the range circle (for when player moves)
  updateInteractionRange(): void {
    if (this.rangeCircle) {
      this.game.map.removeLayer(this.rangeCircle);
      this.rangeCircle = null;
    }
    this.drawInteractionRange();
  }

  // In GridRenderer class
  public handleResize(): void {
    if (this.game.map) {
      this.game.map.invalidateSize();
      this.renderGrid();
    }
  }
}
