import L from "leaflet";
import type { Token, TokenGame } from "../Token/token.ts";

// GridCoord: Represents a discrete grid-cell coordinate (i,j).
export class GridCoord {
  constructor(readonly i: number, readonly j: number) {}

  toString(): string {
    return `${this.i},${this.j}`;
  }

  equals(other: GridCoord): boolean {
    return this.i === other.i && this.j === other.j;
  }

  distanceTo(other: GridCoord): number {
    return Math.max(Math.abs(this.i - other.i), Math.abs(this.j - other.j));
  }

  isWithin(other: GridCoord, radius: number): boolean {
    return this.distanceTo(other) <= radius;
  }
}

// GridRenderer: Rebuilds visible grid cells and token markers each frame.
export class GridRenderer {
  private gridLayers: L.Layer[] = [];
  private tokenMarkers: L.Marker[] = [];

  constructor(private game: TokenGame) {}

  private coordToLatLng(coord: GridCoord): L.LatLng {
    const { config } = this.game;
    return L.latLng(
      config.globalLatLng.lat + coord.i * config.cellSize + config.cellSize / 2,
      config.globalLatLng.lng + coord.j * config.cellSize + config.cellSize / 2,
    );
  }

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

  private getGridCoords(): GridCoord[] {
    const { map, config } = this.game;
    const bounds = map.getBounds();

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

  private drawGridCell(coord: GridCoord): void {
    const { game } = this;
    const interactable = game.player.isInRange(
      coord,
      game.config.interactionRadius,
    );
    const bounds = this.getCellBounds(coord);
    const token = game.grid.getOrSpawn(coord);

    const isPlaceable = !token && interactable;

    const cell = L.rectangle(bounds, {
      color: interactable ? "green" : "gray",
      weight: interactable ? 2 : 1,
      fillColor: interactable ? "lightgreen" : "lightgray",
      fillOpacity: 0.3,
      interactive: isPlaceable,
    }).addTo(game.map);

    const cellStatus = token ? `Contains token: ${token.value}` : "Empty cell";

    cell.bindPopup(`
    Cell (${coord.i},${coord.j})<br>
    ${interactable ? "🟢 Interactable Area" : "⚫ Not Interactable"}<br>
    ${cellStatus}
  `);

    if (isPlaceable) {
      cell.on("click", () => {
        game.handleEmptyCellClick(coord);
      });
    }

    if (token) {
      this.drawToken(coord, token, interactable);
    }

    this.gridLayers.push(cell);
  }

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

    marker.bindPopup(this.tokenPopup(coord, token, interactable));
    marker.on("click", () => game.handleTokenClick(coord, token, marker));

    this.tokenMarkers.push(marker);
  }

  private tokenPopup(
    coord: GridCoord,
    token: Token,
    interactable: boolean,
  ): string {
    const { game } = this;
    let actionText = "Move closer to interact";

    if (interactable && !game.gameWon) {
      if (game.player.inventory) {
        actionText = game.player.inventory.canCombineWith(token)
          ? "Click to combine tokens!"
          : "Click to collect token!";
      } else {
        actionText = "Click to collect token!";
      }
    } else if (game.gameWon) {
      actionText = "Game completed! 🎉";
    }

    return `
      <strong>Token at (${coord.i},${coord.j})</strong><br>
      Value: ${token.value}<br>
      Status: ${interactable ? "🟢 Interactable" : "⚫ Not Interactable"}<br>
      <em>${actionText}</em>
    `;
  }

  clearGrid(): void {
    this.gridLayers.forEach((layer) => this.game.map.removeLayer(layer));
    this.tokenMarkers.forEach((marker) => this.game.map.removeLayer(marker));
    this.gridLayers = [];
    this.tokenMarkers = [];
  }

  renderGrid(): void {
    this.clearGrid();
    const visibleCoords = this.getGridCoords();
    visibleCoords.forEach((coord) => this.drawGridCell(coord));
  }
}
