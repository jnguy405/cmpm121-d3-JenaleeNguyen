// ===== IMPORTS & SETUP =====
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./_leafletWorkaround.ts";
import luck from "./_luck.ts";
import "./style.css";

// ===== DOMAIN CLASSES =====
class GridCoord {
  constructor(
    public readonly i: number,
    public readonly j: number,
  ) {}

  toKey(): string {
    return `${this.i},${this.j}`;
  }

  equals(other: GridCoord): boolean {
    return this.i === other.i && this.j === other.j;
  }

  distanceTo(other: GridCoord): number {
    return Math.max(Math.abs(this.i - other.i), Math.abs(this.j - other.j));
  }
}

class Token {
  constructor(public readonly value: number) {}

  canCombineWith(other: Token): boolean {
    return this.value === other.value;
  }

  combine(): Token {
    return new Token(this.value * 2);
  }

  isWinning(winningValue: number): boolean {
    return this.value >= winningValue;
  }
}

// ===== CORE GAME CLASSES =====
class GameConfig {
  static readonly DEFAULT = new GameConfig(
    L.latLng(36.997936938057016, -122.05703507501151),
    1e-4,
    3,
    0.15,
    8,
  );

  constructor(
    public readonly classroomLatLng: L.LatLng,
    public readonly cellSize: number,
    public readonly interactionRadius: number,
    public readonly tokenSpawnProbability: number,
    public readonly winningVal: number,
  ) {}
}

class Player {
  public position: GridCoord;
  public inventory: Token | null = null;

  constructor(initialPos: GridCoord) {
    this.position = initialPos;
  }

  move(deltaI: number, deltaJ: number): void {
    this.position = new GridCoord(
      this.position.i + deltaI,
      this.position.j + deltaJ,
    );
  }

  isInRange(coord: GridCoord, interactionRadius: number): boolean {
    return this.position.distanceTo(coord) <= interactionRadius;
  }

  pickUpToken(token: Token): void {
    this.inventory = token;
  }

  placeToken(): Token | null {
    const token = this.inventory;
    this.inventory = null;
    return token;
  }

  hasWinningToken(winningValue: number): boolean {
    return this.inventory?.isWinning(winningValue) ?? false;
  }
}

class TokenGrid {
  private tokens = new Map<string, Token>();

  constructor(private config: GameConfig) {}

  getToken(coord: GridCoord): Token | null {
    const key = coord.toKey();

    if (this.tokens.has(key)) {
      return this.tokens.get(key)!;
    }

    // Spawn new token with probability
    const spawnRoll = luck([coord.i, coord.j, "token"].toString());
    if (spawnRoll < this.config.tokenSpawnProbability) {
      const value =
        Math.floor(luck([coord.i, coord.j, "value"].toString()) * 4) + 1;
      const token = new Token(value);
      this.tokens.set(key, token);
      return token;
    }

    return null;
  }

  placeToken(coord: GridCoord, token: Token): void {
    this.tokens.set(coord.toKey(), token);
  }

  removeToken(coord: GridCoord): Token | null {
    const key = coord.toKey();
    const token = this.tokens.get(key) || null;
    this.tokens.delete(key);
    return token;
  }

  hasWinningToken(winningValue: number): boolean {
    return Array.from(this.tokens.values()).some((token) =>
      token.isWinning(winningValue)
    );
  }

  getAllTokens(): Map<string, Token> {
    return new Map(this.tokens);
  }
}

// ===== UI MANAGEMENT CLASS =====
class UIManager {
  private invPanel: HTMLDivElement;
  private controlPanel: HTMLDivElement;

  constructor(private game: TokenGame) {
    this.invPanel = this.createInvPanel();
    this.controlPanel = this.createCrtlPanel();
    document.body.appendChild(this.invPanel);
    document.body.appendChild(this.controlPanel);
  }

  private createInvPanel(): HTMLDivElement {
    const panel = document.createElement("div");
    panel.id = "inventory-panel";
    return panel;
  }

  private createCrtlPanel(): HTMLDivElement {
    const panel = document.createElement("div");
    panel.id = "control-panel";
    panel.innerHTML = `
      <h3>Movement Controls</h3>
      <div class="movement-buttons">
        <button id="move-north">↑ North</button>
        <div>
          <button id="move-west">← West</button>
          <button id="move-east">East →</button>
        </div>
        <button id="move-south">↓ South</button>
      </div>
      <div id="player-pos">Position: (0, 0)</div>
    `;
    return panel;
  }

  showNotif(message: string, duration = 3000): void {
    const existing = document.getElementById("game-notif");
    existing?.remove();

    const notif = document.createElement("div");
    notif.id = "game-notif";
    notif.innerHTML = `
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
    document.body.appendChild(notif);

    setTimeout(() => notif.remove(), duration);
  }

  updateInvUI(): void {
    const { player, config } = this.game;
    const status = player.inventory
      ? `Holding token: ${player.inventory.value}. ${
        player.inventory.value >= config.winningVal
          ? "🎉 YOU WIN!"
          : "Click on tokens to combine or empty cells to place."
      }`
      : "Inventory empty. Click on tokens to collect.";

    this.invPanel.innerHTML = `
      <h3>Player Inventory</h3>
      <div id="inventory-slot" class="${
      player.inventory ? "occupied" : "empty"
    }">
        ${
      player.inventory
        ? `<div class="inventory-token">${player.inventory.value}</div>`
        : "Empty"
    }
      </div>
      <div id="interaction-status">${status}</div>
    `;
  }

  updatePlayerPos(): void {
    const posDisplay = document.getElementById("player-pos");
    if (posDisplay) {
      const { player } = this.game;
      posDisplay.textContent =
        `Position: (${player.position.i}, ${player.position.j})`;
    }
  }

  showWinMsg(): void {
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
          You successfully crafted a token of value ${this.game.config.winningVal} or higher!
        </p>
        <p style="font-size: 14px; color: #ccc;">
          Refresh the page to play again.
        </p>
      </div>
    `;
    document.body.appendChild(winMsg);
  }

  updateAll(): void {
    this.updateInvUI();
    this.updatePlayerPos();
  }
}

// ===== GRID RENDERER CLASS =====
class GridRenderer {
  private gridLayers: L.Layer[] = [];
  private tokenMarkers: L.Marker[] = [];

  constructor(private game: TokenGame) {}

  private coordToLatLng(coord: GridCoord): L.LatLng {
    const { config } = this.game;
    return L.latLng(
      config.classroomLatLng.lat + coord.i * config.cellSize +
        config.cellSize / 2,
      config.classroomLatLng.lng + coord.j * config.cellSize +
        config.cellSize / 2,
    );
  }

  private getCellBounds(coord: GridCoord): L.LatLngBounds {
    const { config } = this.game;
    return L.latLngBounds([
      [
        config.classroomLatLng.lat + coord.i * config.cellSize,
        config.classroomLatLng.lng + coord.j * config.cellSize,
      ],
      [
        config.classroomLatLng.lat + (coord.i + 1) * config.cellSize,
        config.classroomLatLng.lng + (coord.j + 1) * config.cellSize,
      ],
    ]);
  }

  private getGridCoords(): GridCoord[] {
    const { map, config } = this.game;
    const bounds = map.getBounds();

    const iMin = Math.floor(
      (bounds.getSouthWest().lat - config.classroomLatLng.lat) /
        config.cellSize,
    );
    const iMax = Math.floor(
      (bounds.getNorthEast().lat - config.classroomLatLng.lat) /
        config.cellSize,
    );
    const jMin = Math.floor(
      (bounds.getSouthWest().lng - config.classroomLatLng.lng) /
        config.cellSize,
    );
    const jMax = Math.floor(
      (bounds.getNorthEast().lng - config.classroomLatLng.lng) /
        config.cellSize,
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
    const token = game.grid.getToken(coord);

    const cell = L.rectangle(bounds, {
      color: interactable ? "green" : "gray",
      weight: interactable ? 2 : 1,
      fillColor: interactable ? "lightgreen" : "lightgray",
      fillOpacity: 0.3,
      interactive: false,
    }).addTo(game.map);

    const cellStatus = token ? `Contains token: ${token.value}` : "Empty cell";

    cell.bindPopup(`
      Cell (${coord.i},${coord.j})<br>
      ${interactable ? "🟢 Interactable Area" : "⚫ Not Interactable"}<br>
      ${cellStatus}
    `);

    if (!token && interactable) {
      cell.setStyle({ interactive: true });
      cell.on("click", () => game.handleEmptyCellClick(coord));
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
    console.log(`Drew ${visibleCoords.length} grid cells`);
  }
}

// ===== MAIN GAME CLASS =====
class TokenGame {
  public readonly config: GameConfig;
  public readonly player: Player;
  public readonly grid: TokenGrid;
  public readonly map: L.Map;
  public gameWon: boolean = false;

  public readonly ui: UIManager;
  public readonly renderer: GridRenderer;
  private playerMarker: L.Marker;

  constructor(mapElementId: string, config: GameConfig = GameConfig.DEFAULT) {
    this.config = config;
    this.player = new Player(new GridCoord(0, 0));
    this.grid = new TokenGrid(config);
    this.map = this.initializeMap(mapElementId);
    this.ui = new UIManager(this);
    this.renderer = new GridRenderer(this);

    this.playerMarker = this.createPlayerMarker();
    this.setupEventListeners();
    this.ui.updateAll();
    this.renderer.renderGrid();
  }

  private initializeMap(mapElementId: string): L.Map {
    const map = L.map(mapElementId).setView(this.config.classroomLatLng, 19);

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    return map;
  }

  private createPlayerMarker(): L.Marker {
    const marker = L.marker(this.config.classroomLatLng, {
      icon: L.divIcon({
        html: `<div class="player-marker">YOU</div>`,
        className: "player-marker-container",
        iconSize: [40, 40],
      }),
    }).addTo(this.map);

    marker.bindPopup(
      `Player Location - Center (${this.player.position.i},${this.player.position.j})<br>Interaction Radius: ${this.config.interactionRadius} cells`,
    );

    return marker;
  }

  private setupEventListeners(): void {
    // Movement controls
    document.getElementById("move-north")?.addEventListener(
      "click",
      () => this.movePlayer(-1, 0),
    );
    document.getElementById("move-south")?.addEventListener(
      "click",
      () => this.movePlayer(1, 0),
    );
    document.getElementById("move-east")?.addEventListener(
      "click",
      () => this.movePlayer(0, 1),
    );
    document.getElementById("move-west")?.addEventListener(
      "click",
      () => this.movePlayer(0, -1),
    );

    // Map events
    this.map.on("moveend", () => this.renderer.renderGrid())
      .on("zoomend", () => this.renderer.renderGrid());
  }

  movePlayer(deltaI: number, deltaJ: number): void {
    if (this.gameWon) {
      this.ui.showNotif("Game completed! Movement disabled.");
      return;
    }

    this.player.move(deltaI, deltaJ);

    const newLatLng = this.renderer["coordToLatLng"](this.player.position);
    this.playerMarker.setLatLng(newLatLng);

    this.ui.updatePlayerPos();
    this.ui.showNotif(
      `Moved to (${this.player.position.i}, ${this.player.position.j})`,
    );
    this.renderer.renderGrid();
  }

  handleTokenClick(
    coord: GridCoord,
    token: Token,
    tokenMarker: L.Marker,
  ): void {
    if (this.gameWon) {
      this.ui.showNotif("Game completed! 🎉 Refresh to play again.");
      return;
    }

    if (!this.player.isInRange(coord, this.config.interactionRadius)) {
      this.ui.showNotif("Move closer to interact with this token");
      return;
    }

    if (!this.player.inventory) {
      this.collectToken(coord, token, tokenMarker);
    } else if (this.player.inventory.canCombineWith(token)) {
      this.combineTokens(coord, token, tokenMarker);
    } else {
      this.ui.showNotif(
        `Cannot combine: holding ${this.player.inventory.value}, clicked ${token.value}`,
      );
    }
  }

  handleEmptyCellClick(coord: GridCoord): void {
    if (
      this.gameWon || !this.player.inventory ||
      !this.player.isInRange(coord, this.config.interactionRadius)
    ) {
      if (!this.player.isInRange(coord, this.config.interactionRadius)) {
        this.ui.showNotif("Move closer to place token here");
      }
      return;
    }

    this.grid.placeToken(coord, this.player.placeToken()!);
    this.ui.showNotif("Token placed on cell");
    this.ui.updateInvUI();
    this.renderer.renderGrid();
    this.checkWin();
  }

  private collectToken(
    coord: GridCoord,
    token: Token,
    tokenMarker: L.Marker,
  ): void {
    this.player.pickUpToken(token);
    this.grid.removeToken(coord);
    this.map.removeLayer(tokenMarker);
    this.ui.showNotif(`Collected token: ${token.value}`);
    this.ui.updateInvUI();
    this.checkWin();
  }

  private combineTokens(
    coord: GridCoord,
    token: Token,
    tokenMarker: L.Marker,
  ): void {
    const newToken = token.combine();
    this.grid.placeToken(coord, newToken);
    this.map.removeLayer(tokenMarker);
    this.renderer.renderGrid();
    this.player.placeToken();

    this.ui.showNotif(`Combined tokens! Created value ${newToken.value}`);
    this.ui.updateInvUI();
    this.checkWin();
  }

  private checkWin(): void {
    if (this.gameWon) return;

    const hasWinningToken =
      this.player.hasWinningToken(this.config.winningVal) ||
      this.grid.hasWinningToken(this.config.winningVal);

    if (hasWinningToken) {
      this.gameWon = true;
      this.ui.showWinMsg();
    }
  }
}

// ===== INITIALIZATION =====
document.addEventListener("DOMContentLoaded", () => {
  new TokenGame("map");
});
