import L from "leaflet";
import { GridCoord } from "../Grid/grid.ts";
import type { BtnMoveCtrl } from "../Movement/moveCtrl.ts";
import type { Token } from "../Token/token.ts";
import type { TokenGame } from "../Token/tokenGame.ts";

// Central config for world scale, cell size, spawn rates, etc.
export class GameConfig {
  static readonly DEFAULT = new GameConfig(L.latLng(0, 0), 1e-4, 3, 0.2, 64);

  constructor(
    public readonly globalLatLng: L.LatLng, // World origin point
    public readonly cellSize: number, // Size of each grid cell
    public readonly interactionRadius: number, // How close player needs to be to interact
    public readonly tokenSpawnProbability: number, // Chance for token to spawn
    public readonly winningVal: number, // Target token value to win
  ) {}
}

// Player state: position, inventory, movement
export class Player {
  public position: GridCoord; // Current grid coordinates
  public inventory: Token | null = null; // Currently held token

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
    return this.position.isWithin(coord, interactionRadius);
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

// Manages all UI elements: inventory, controls, notifications
export class UIManager {
  private invPanel: HTMLDivElement;
  private controlPanel: HTMLDivElement;
  private moveModeSelect: HTMLSelectElement;
  private saveLoadPanel: HTMLDivElement;

  constructor(private game: TokenGame) {
    // Create and append UI panels
    this.invPanel = this.createInvPanel();
    this.controlPanel = this.createCrtlPanel();
    this.saveLoadPanel = this.createSaveLoadPanel();
    document.body.appendChild(this.invPanel);
    document.body.appendChild(this.controlPanel);
    document.body.appendChild(this.saveLoadPanel);

    // Set up movement mode dropdown
    const moveModeElement = document.getElementById("move-mode");
    if (!moveModeElement) throw new Error("move-mode element not found");
    this.moveModeSelect = moveModeElement as HTMLSelectElement;

    this.setupMoveEventListeners();
    this.setupSaveLoadEventListeners();

    // Delay UI sync to ensure game is fully initialized
    setTimeout(() => {
      this.syncMovementUI();
      this.updateAll();
    }, 150);
  }

  private syncMovementUI(): void {
    this.updateMoveStatus();
    const currCtrl = this.game.moveMgr.getCurrCtrl();
    if (currCtrl && this.moveModeSelect) {
      const modeName = currCtrl.getModeName();
      this.moveModeSelect.value = modeName;
    }
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
            <div class="movement-mode-selector">
                <label for="move-mode">Movement Mode:</label>
                <select id="move-mode">
                    <option value="geolocation">Geolocation</option>
                    <option value="buttons">Button Controls</option>
                </select>
            </div>
            <div class="movement-buttons">
                <button id="move-north">↑ North</button>
                <div>
                    <button id="move-west">← West</button>
                    <button id="move-east">East →</button>
                </div>
                <button id="move-south">↓ South</button>
            </div>
            <div id="player-pos">Position: (0, 0)</div>
            <div id="move-status">Mode: Geolocation</div>
        `;
    return panel;
  }

  // Save/load game state controls
  private createSaveLoadPanel(): HTMLDivElement {
    const panel = document.createElement("div");
    panel.id = "save-load-panel";
    panel.innerHTML = `
      <h3>Game State</h3>
      <div class="save-load-controls">
        <button id="save-game">Save Game</button>
        <button id="load-game">Load Game</button>
        <button id="new-game">New Game</button>
      </div>
      <div id="save-load-status">Ready</div>
    `;
    return panel;
  }

  private setupMoveEventListeners(): void {
    // Movement mode dropdown change
    this.moveModeSelect.addEventListener("change", (e) => {
      const mode = (e.target as HTMLSelectElement).value;
      this.switchMoveMode(mode);
    });

    // Directional button handlers
    document.getElementById("move-north")?.addEventListener(
      "click",
      () => this.handleBtnMove(1, 0),
    );
    document.getElementById("move-south")?.addEventListener(
      "click",
      () => this.handleBtnMove(-1, 0),
    );
    document.getElementById("move-east")?.addEventListener(
      "click",
      () => this.handleBtnMove(0, 1),
    );
    document.getElementById("move-west")?.addEventListener(
      "click",
      () => this.handleBtnMove(0, -1),
    );
  }

  // Save/load button handlers
  private setupSaveLoadEventListeners(): void {
    document.getElementById("save-game")?.addEventListener("click", () => {
      this.game.saveGame();
    });

    document.getElementById("load-game")?.addEventListener("click", () => {
      if (confirm("Load saved game? Current progress will be lost.")) {
        location.reload(); // Reload page to reinitialize with saved state
      }
    });

    document.getElementById("new-game")?.addEventListener("click", () => {
      this.game.newGame();
    });
  }

  private handleBtnMove(deltaI: number, deltaJ: number): void {
    const currCtrl = this.game.moveMgr.getCurrCtrl();
    if (currCtrl?.getModeName() === "buttons") {
      const btnCtrl = currCtrl as BtnMoveCtrl;
      btnCtrl.btnMove(deltaI, deltaJ);
    } else {
      this.showNotif("Switch to button mode to use movement buttons");
    }
  }

  private switchMoveMode(mode: string): void {
    const success = this.game.moveMgr.switchCtrl(mode);
    if (success) {
      this.showNotif(`Switched to ${mode} movement`);
      this.updateMoveStatus();

      // Keep dropdown in sync with actual control state
      const currCtrl = this.game.moveMgr.getCurrCtrl();
      if (currCtrl && this.moveModeSelect) {
        this.moveModeSelect.value = currCtrl.getModeName();
      }

      if (mode === "geolocation") {
        this.showNotif("Geolocation active - move in real world to play!");
      }

      this.game.saveGame(); // Auto-save preference
    } else {
      this.showNotif(`Failed to switch to ${mode} mode`);
      // Reset dropdown on failure
      const currCtrl = this.game.moveMgr.getCurrCtrl();
      if (currCtrl && this.moveModeSelect) {
        this.moveModeSelect.value = currCtrl.getModeName();
      }
    }
  }

  private updateMoveStatus(): void {
    const statusElement = document.getElementById("move-status");
    if (statusElement) {
      const currCtrl = this.game.moveMgr.getCurrCtrl();
      const modeName = currCtrl ? currCtrl.getModeName() : "unknown";
      statusElement.textContent = `Mode: ${
        modeName.charAt(0).toUpperCase() + modeName.slice(1)
      }`;
    }
  }

  // Temporary notification popup
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
          : "You may combine or place."
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
    this.updateMoveStatus();
  }

  updateSaveLoadStatus(message: string, isError: boolean = false): void {
    const statusElement = document.getElementById("save-load-status");
    if (statusElement) {
      statusElement.textContent = message;
      statusElement.style.color = isError ? "#ff4444" : "#44ff44";
    }
  }
}
