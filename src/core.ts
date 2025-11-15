import L from "leaflet";
import { GridCoord } from "./Grid/grid.ts";
import type { BtnMoveCtrl } from "./Movement/moveCtrl.ts";
import type { Token, TokenGame } from "./Token/token.ts";

// GameConfig: Centralized configuration for world scale, cell size, spawn
// probability, interaction radius, and win condition used by all systems.
export class GameConfig {
  static readonly DEFAULT = new GameConfig(L.latLng(0, 0), 1e-4, 3, 0.15, 64);

  constructor(
    public readonly globalLatLng: L.LatLng,
    public readonly cellSize: number,
    public readonly interactionRadius: number,
    public readonly tokenSpawnProbability: number,
    public readonly winningVal: number,
  ) {}
}

// Player: Tracks player position, inventory, movement, and interaction range.
export class Player {
  public position: GridCoord; // discrete grid position
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

// UIManager: Handles DOM UI panels, notifications, inventory display, movement
// controls, and win messages. Syncs UI with game state.
export class UIManager {
  private invPanel: HTMLDivElement;
  private controlPanel: HTMLDivElement;
  private moveModeSelect: HTMLSelectElement;

  constructor(private game: TokenGame) {
    this.invPanel = this.createInvPanel();
    this.controlPanel = this.createCrtlPanel();
    document.body.appendChild(this.invPanel);
    document.body.appendChild(this.controlPanel);

    const moveModeElement = document.getElementById("move-mode");
    if (!moveModeElement) throw new Error("move-mode element not found");
    this.moveModeSelect = moveModeElement as HTMLSelectElement;

    this.setupMoveEventListeners();
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
            <div id="move-status">Mode: Button Controls</div>
        `;
    return panel;
  }

  private setupMoveEventListeners(): void {
    this.moveModeSelect.addEventListener("change", (e) => {
      const mode = (e.target as HTMLSelectElement).value;
      this.switchMoveMode(mode);
    });

    // Movement buttons
    document.getElementById("move-north")?.addEventListener(
      "click",
      () => this.handleBtnMove(-1, 0),
    );
    document.getElementById("move-south")?.addEventListener(
      "click",
      () => this.handleBtnMove(1, 0),
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

      // Update dropdown to match actual control name
      const currCtrl = this.game.moveMgr.getCurrCtrl();
      if (currCtrl && this.moveModeSelect) {
        this.moveModeSelect.value = currCtrl.getModeName();
      }

      if (mode === "geolocation") {
        this.showNotif("Geolocation active - move in real world to play!");
      }
    } else {
      this.showNotif(`Failed to switch to ${mode} mode`);
      // Reset dropdown to current mode
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
          : "Click on a token of the same value to combine or an empty cell to place."
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
}
