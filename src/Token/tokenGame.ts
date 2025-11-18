import L from "leaflet";
import { GameConfig, Player, UIManager } from "../Game/core.ts";
import { GameStateManager } from "../Game/gameState.ts";
import { GridCoord, GridRenderer } from "../Grid/grid.ts";
import { BtnMoveCtrl, GeoMoveCtrl } from "../Movement/moveCtrl.ts";
import { MoveManager } from "../Movement/moveManager.ts";
import { Token, TokenGrid } from "./token.ts";

// TokenGame: Coordinates all subsystems (player, grid, renderer, UI, map).
export class TokenGame {
  public readonly config: GameConfig;
  public player!: Player;
  public grid!: TokenGrid; // Contains both Flyweight and Memento patterns
  public readonly map: L.Map;
  public gameWon: boolean = false;

  public readonly ui: UIManager;
  public readonly renderer: GridRenderer;
  public readonly moveMgr: MoveManager;
  private playerMarker: L.Marker;
  private gameStateManager: GameStateManager;

  // TRACKING CONTEXT: Track which coordinate system we're using and our actual position
  public coordSys: "geolocation" | "grid" = "geolocation";
  private lastKnownGeo: { lat: number; lng: number } | null = null;

  // FIX: Track when we last had valid geolocation data to determine if we're still in geolocation context
  private geoLastUpdated: number = 0;
  private readonly GEOLOCATION_TIMEOUT = 30000; // 30 seconds - consider geolocation data stale after this

  constructor(mapElementId: string, config: GameConfig = GameConfig.DEFAULT) {
    this.config = config;
    this.gameStateManager = new GameStateManager(config);
    this.player = new Player(new GridCoord(0, 0));

    // FLYWEIGHT + MEMENTO: TokenGrid instance manages both patterns
    this.grid = new TokenGrid(config);
    this.map = this.initializeMap(mapElementId);

    this.moveMgr = new MoveManager(this);
    this.initMoveCtrls();

    this.renderer = new GridRenderer(this);
    this.ui = new UIManager(this);

    this.playerMarker = this.createPlayerMarker();
    this.setupEventListeners();

    // Now try to load saved game - this will override the defaults if successful
    const loaded = this.loadGame();

    // If no saved game OR saved game didn't set movement mode, default to geolocation
    if (!loaded || !this.moveMgr.getCurrCtrl()) {
      console.log("Setting default movement mode to geolocation");
      this.moveMgr.switchCtrl("geolocation");
    }

    // Update UI and start movement manager
    this.ui.updateAll();
    this.renderer.renderGrid();
    this.moveMgr.start();

    if (loaded) {
      this.ui.showNotif("Game loaded successfully!");
    } else {
      console.log("Starting new game with geolocation...");
    }
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

    this.moveMgr.regCtrl("buttons", btnCtrl);
    this.moveMgr.regCtrl("geolocation", geoCtrl);

    this.moveMgr.setPosHandler((position) => {
      this.handlePosUpdate(position);
    });

    console.log("Movement controls initialized: buttons, geolocation");
  }

  private handlePosUpdate(position: { lat: number; lng: number }): void {
    if (this.gameWon) {
      this.ui.showNotif("Game completed! Movement disabled.");
      return;
    }

    // FIX: Always update geolocation position and timestamp when we receive geolocation data
    // This ensures we know we're in a geolocation context even if using button controls
    this.lastKnownGeo = position;
    this.geoLastUpdated = Date.now();
    this.coordSys = "geolocation"; // We're receiving real geolocation data

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
    const initialLatLng = this.renderer["coordToLatLng"](this.player.position);

    const marker = L.marker(initialLatLng, {
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

    // MEMENTO PATTERN: This call will save the token placement in modifiedCells
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

    // MEMENTO PATTERN: This call will save the token removal in modifiedCells
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

    // FLYWEIGHT PATTERN: placeToken uses getOrCreateToken internally
    // MEMENTO PATTERN: This call saves the new combined token placement
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
      // Auto-save when player wins
      this.saveGame();
    }
  }

  private getCurrCoordSys(): "geolocation" | "grid" {
    const currCtrl = this.moveMgr.getCurrCtrl();

    if (currCtrl?.getModeName() === "geolocation") {
      return "geolocation";
    }

    const now = Date.now();
    const hasRecentGeolocation = this.lastKnownGeo &&
      (now - this.geoLastUpdated) < this.GEOLOCATION_TIMEOUT;

    if (hasRecentGeolocation) {
      return "geolocation";
    }

    return "grid";
  }

  // PERSISTENCE: Load game state
  private loadGame(): boolean {
    const result = this.gameStateManager.loadGame();
    if (result.success) {
      console.log("Save data found, loading game state...");

      // Load player state
      this.player = new Player(result.playerPosition!);
      if (result.playerInventory) {
        this.player.pickUpToken(result.playerInventory);
      }

      // Load grid state
      this.grid = new TokenGrid(this.config);
      this.grid.setModifiedCells(result.gridModifiedCells!);

      this.gameWon = result.gameWon || false;

      // Restore coordinate system context
      this.coordSys = result.coordinateSystem || "geolocation";
      this.lastKnownGeo = result.lastKnownPosition || null;

      if (this.lastKnownGeo) {
        this.geoLastUpdated = Date.now();
      }

      // Load movement mode with context awareness
      const savedMovementMode = result.movementMode || "geolocation";
      console.log(
        `Loading: movement=${savedMovementMode}, coordinates=${this.coordSys}`,
      );

      if (this.moveMgr) {
        const switchSuccess = this.moveMgr.switchCtrl(savedMovementMode);
        if (!switchSuccess) {
          console.warn(
            `Failed to load movement mode ${savedMovementMode}, using geolocation`,
          );
          this.moveMgr.switchCtrl("geolocation");
        }

        // If we were in geolocation area with button controls, position the map appropriately
        if (
          this.coordSys === "geolocation" && this.lastKnownGeo
        ) {
          console.log("Restoring geolocation area context");
          const initialLatLng = this.lastKnownGeo;
          this.map.setView(initialLatLng, this.map.getZoom());

          // FIX: Now this.renderer is defined because we initialized it before loadGame
          const gridCoord = this.latLngToGridCoord(initialLatLng);
          const displayLatLng = this.renderer["coordToLatLng"](gridCoord);
          this.playerMarker.setLatLng(displayLatLng);
        } else {
          // Update player marker for grid-based games
          const displayLatLng = this.renderer["coordToLatLng"](
            this.player.position,
          );
          this.playerMarker.setLatLng(displayLatLng);
          this.map.setView(displayLatLng, this.map.getZoom());
        }
      }

      return true;
    }
    console.log("No save data found");
    return false;
  }

  // PERSISTENCE: Save game state
  public saveGame(): boolean {
    const currentCtrl = this.moveMgr.getCurrCtrl();
    const currMoveMode = currentCtrl
      ? currentCtrl.getModeName()
      : "geolocation";

    const coordSys = this.getCurrCoordSys();

    const success = this.gameStateManager.saveGame(
      this.player.position,
      this.player.inventory,
      this.grid.getModifiedCells(),
      this.gameWon,
      currMoveMode,
      coordSys, // Save which coordinate system we're in
      this.lastKnownGeo || undefined, // Save actual position if available
    );

    if (success) {
      this.ui.showNotif("Game saved successfully!");
    } else {
      this.ui.showNotif("Failed to save game", 5000);
    }

    return success;
  }

  // PERSISTENCE: Start new game
  public newGame(): void {
    if (confirm("Start a new game? This will erase your current progress.")) {
      this.gameStateManager.deleteSave();

      // Reset game state
      this.player = new Player(new GridCoord(0, 0));
      this.grid = new TokenGrid(this.config);
      this.gameWon = false;

      // Reset coordinate system tracking
      this.coordSys = "geolocation";
      this.lastKnownGeo = null;
      this.geoLastUpdated = 0;

      // Start with geolocation for new games
      if (this.moveMgr) {
        this.moveMgr.switchCtrl("geolocation");
      }

      // Reset UI and rendering
      this.ui.updateAll();
      this.renderer.renderGrid();

      // Reset player marker
      const initialLatLng = this.renderer["coordToLatLng"](
        this.player.position,
      );
      this.playerMarker.setLatLng(initialLatLng);
      this.map.setView(initialLatLng, this.map.getZoom());

      this.ui.showNotif("New game started with geolocation!");
    }
  }

  // PERSISTENCE: Check if saved game exists
  public hasSavedGame(): boolean {
    return this.gameStateManager.hasSavedGame();
  }

  // PERSISTENCE: Export game state for backup
  public exportGameState(): string | null {
    return this.gameStateManager.exportGameState();
  }

  // PERSISTENCE: Import game state from backup
  public importGameState(exportData: string): boolean {
    const success = this.gameStateManager.importGameState(exportData);
    if (success) {
      // Reload the game with imported data
      location.reload();
    }
    return success;
  }
}
