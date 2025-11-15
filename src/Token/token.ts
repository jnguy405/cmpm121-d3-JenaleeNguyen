import L from "leaflet";
import luck from "../_luck.ts";
import { GameConfig, Player, UIManager } from "../core.ts";
import { GridCoord, GridRenderer } from "../Grid/grid.ts";
import { BtnMoveCtrl, GeoMoveCtrl } from "../Movement/moveCtrl.ts";
import { MoveManager } from "../Movement/moveManager.ts";

// Token: Simple value object representing a token in a cell.
export class Token {
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

// TokenGrid: Flyweight + Memento–based world storage.
export class TokenGrid {
  private tokens = new Map<string, Token>();
  private modifiedCells = new Map<string, { tokenValue: number | null }>();

  constructor(private config: GameConfig) {}

  private getKey(coord: GridCoord): string {
    return coord.toString();
  }

  private loadMemento(coord: GridCoord): Token | null | undefined {
    const key = this.getKey(coord);
    const m = this.modifiedCells.get(key);
    if (!m) return undefined;
    if (m.tokenValue === null) return null;
    return this.getOrCreateToken(m.tokenValue);
  }

  private saveMemento(coord: GridCoord, token: Token | null): void {
    const key = this.getKey(coord);
    this.modifiedCells.set(key, {
      tokenValue: token ? token.value : null,
    });
  }

  getOrCreateToken(value: number): Token {
    const key = `val-${value}`;
    if (!this.tokens.has(key)) {
      this.tokens.set(key, new Token(value));
    }
    return this.tokens.get(key)!;
  }

  getOrSpawn(coord: GridCoord): Token | null {
    const key = this.getKey(coord);

    const mementoValue = this.loadMemento(coord);
    if (mementoValue !== undefined) {
      return mementoValue;
    }

    if (this.tokens.has(key)) {
      return this.tokens.get(key)!;
    }

    const spawnRoll = luck(`${coord},token`);
    if (spawnRoll < this.config.tokenSpawnProbability) {
      const value = Math.floor(luck(`${coord},value`) * 4) + 1;
      const token = this.getOrCreateToken(value);

      this.saveMemento(coord, token);
      return token;
    }

    this.saveMemento(coord, null);
    return null;
  }

  placeToken(coord: GridCoord, token: Token): void {
    const key = this.getKey(coord);
    this.tokens.set(key, token);
    this.saveMemento(coord, token);
  }

  removeToken(coord: GridCoord): Token | null {
    const key = this.getKey(coord);
    const token = this.tokens.get(key) || null;
    this.tokens.delete(key);
    this.saveMemento(coord, null);
    return token;
  }

  hasWinningToken(winningValue: number): boolean {
    return [...this.tokens.values()].some((t) => t.isWinning(winningValue));
  }

  getAllTokens(): Map<string, Token> {
    return new Map(this.tokens);
  }
}

// TokenGame: Coordinates all subsystems (player, grid, renderer, UI, map).
export class TokenGame {
  public readonly config: GameConfig;
  public readonly player: Player;
  public readonly grid: TokenGrid;
  public readonly map: L.Map;
  public gameWon: boolean = false;

  public readonly ui: UIManager;
  public readonly renderer: GridRenderer;
  public readonly moveMgr: MoveManager;
  private playerMarker: L.Marker;

  constructor(mapElementId: string, config: GameConfig = GameConfig.DEFAULT) {
    this.config = config;
    this.player = new Player(new GridCoord(0, 0));
    this.grid = new TokenGrid(config);
    this.map = this.initializeMap(mapElementId);

    this.moveMgr = new MoveManager(this);
    this.initMoveCtrls();

    this.ui = new UIManager(this);
    this.renderer = new GridRenderer(this);

    this.playerMarker = this.createPlayerMarker();
    this.setupEventListeners();
    this.ui.updateAll();
    this.renderer.renderGrid();

    this.moveMgr.start();
  }

  private initializeMap(mapElementId: string): L.Map {
    const map = L.map(mapElementId).setView(this.config.globalLatLng, 19);

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    return map;
  }

  private initMoveCtrls(): void {
    const btnCtrl = new BtnMoveCtrl(this);
    const geoCtrl = new GeoMoveCtrl(this);

    console.log("Registering button control...");
    this.moveMgr.regCtrl("buttons", btnCtrl);
    console.log("Registering geolocation control...");
    this.moveMgr.regCtrl("geolocation", geoCtrl);

    console.log(
      "Available modes after registration:",
      this.moveMgr.getAvailableModes(),
    );

    this.moveMgr.setPosHandler((position) => {
      this.handlePosUpdate(position);
    });

    this.moveMgr.switchCtrl("buttons");
  }

  private handlePosUpdate(position: { lat: number; lng: number }): void {
    if (this.gameWon) {
      this.ui.showNotif("Game completed! Movement disabled.");
      return;
    }

    const newGridCoord = this.latLngToGridCoord(position);
    this.player.position = newGridCoord;

    const newLatLng = this.renderer["coordToLatLng"](this.player.position);
    this.playerMarker.setLatLng(newLatLng);
    this.map.panTo(newLatLng);

    this.ui.updatePlayerPos();
    this.ui.showNotif(
      `Moved to (${this.player.position.i}, ${this.player.position.j})`,
    );
    this.renderer.renderGrid();
  }

  private latLngToGridCoord(position: { lat: number; lng: number }): GridCoord {
    const { config } = this;
    const i = Math.floor(
      (position.lat - config.globalLatLng.lat) / config.cellSize,
    );
    const j = Math.floor(
      (position.lng - config.globalLatLng.lng) / config.cellSize,
    );
    return new GridCoord(i, j);
  }

  private createPlayerMarker(): L.Marker {
    const marker = L.marker(this.config.globalLatLng, {
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
    this.map.on("moveend", () => this.renderer.renderGrid()).on(
      "zoomend",
      () => this.renderer.renderGrid(),
    );
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
