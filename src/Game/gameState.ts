import { GridCoord } from "../Grid/grid.ts";
import { Token, TokenGrid } from "../Token/token.ts";
import { GameConfig } from "./core.ts";

// Data structures for serializing game state to JSON
export interface SerializedPlayer {
  position: { i: number; j: number };
  inventory: number | null; // Token value or null if empty
}

export interface SerializedGrid {
  modifiedCells: Array<{ coord: string; tokenValue: number | null }>;
}

// Complete game state saved to localStorage
export interface GameStateData {
  player: SerializedPlayer;
  grid: SerializedGrid;
  gameWon: boolean;
  timestamp: string;
  version: string;
  movementMode: string; // "geolocation" or "buttons"
  coordinateSystem: "geolocation" | "grid"; // Which coordinate space we're in
  lastKnownPosition?: { lat: number; lng: number } | undefined; // Actual GPS if in geolocation
}

// Helper class to convert Player to/from serializable format
export class SerializablePlayer {
  constructor(
    public position: GridCoord,
    public inventory: Token | null,
  ) {}

  toJSON(): SerializedPlayer {
    return {
      position: { i: this.position.i, j: this.position.j },
      inventory: this.inventory ? this.inventory.value : null, // Store just the value
    };
  }

  static fromJSON(
    data: SerializedPlayer,
    gameGrid: TokenGrid,
  ): SerializablePlayer {
    const position = new GridCoord(data.position.i, data.position.j);
    let inventory: Token | null = null;

    // Reconstruct token using flyweight pattern
    if (data.inventory !== null) {
      inventory = gameGrid.getOrCreateToken(data.inventory);
    }

    return new SerializablePlayer(position, inventory);
  }
}

// Helper class to convert Grid to/from serializable format
export class SerializableGrid {
  constructor(
    public modifiedCells: Map<string, { tokenValue: number | null }>,
  ) {}

  toJSON(): SerializedGrid {
    return {
      // Convert Map to array for JSON serialization
      modifiedCells: Array.from(this.modifiedCells.entries()).map((
        [coord, value],
      ) => ({
        coord,
        tokenValue: value.tokenValue,
      })),
    };
  }

  static fromJSON(data: SerializedGrid, _config: GameConfig): SerializableGrid {
    const modifiedCells = new Map<string, { tokenValue: number | null }>();

    if (data.modifiedCells) {
      data.modifiedCells.forEach((item) => {
        modifiedCells.set(item.coord, {
          tokenValue: item.tokenValue,
        });
      });
    }

    return new SerializableGrid(modifiedCells);
  }
}

// Result returned from loadGame() attempt
export interface LoadGameResult {
  success: boolean;
  playerPosition?: GridCoord | undefined;
  playerInventory?: Token | null | undefined;
  gridModifiedCells?: Map<string, { tokenValue: number | null }> | undefined;
  gameWon?: boolean | undefined;
  timestamp?: string | undefined;
  movementMode?: string | undefined;
  coordinateSystem?: "geolocation" | "grid" | undefined;
  lastKnownPosition?: { lat: number; lng: number } | undefined;
}

// Metadata about saved game for UI display
export interface SaveGameInfo {
  timestamp: string;
  version: string;
}

// Main class handling game persistence using browser localStorage
export class GameStateManager {
  private static readonly SAVE_KEY = "tokenGameSaveData";
  private static readonly VERSION = "1.0.0";

  constructor(private config: GameConfig) {}

  // Save current game state to localStorage
  saveGame(
    playerPosition: GridCoord,
    playerInventory: Token | null,
    gridModifiedCells: Map<string, { tokenValue: number | null }>,
    gameWon: boolean,
    movementMode: string,
    coordinateSystem: "geolocation" | "grid",
    lastKnownPosition?: { lat: number; lng: number } | undefined,
  ): boolean {
    try {
      const player = new SerializablePlayer(playerPosition, playerInventory);
      const grid = new SerializableGrid(gridModifiedCells);

      const saveData: GameStateData = {
        player: player.toJSON(),
        grid: grid.toJSON(),
        gameWon,
        timestamp: new Date().toISOString(),
        version: GameStateManager.VERSION,
        movementMode,
        coordinateSystem,
        lastKnownPosition,
      };

      localStorage.setItem(GameStateManager.SAVE_KEY, JSON.stringify(saveData));
      return true;
    } catch (error) {
      console.error("Failed to save game:", error);
      return false;
    }
  }

  // Load game state from localStorage
  loadGame(): LoadGameResult {
    try {
      const saveData = localStorage.getItem(GameStateManager.SAVE_KEY);
      if (!saveData) {
        return { success: false }; // No saved game found
      }

      const data: GameStateData = JSON.parse(saveData);

      // Check for version compatibility (future-proofing)
      if (data.version !== GameStateManager.VERSION) {
        console.warn(
          `Save version mismatch: ${data.version} vs ${GameStateManager.VERSION}`,
        );
      }

      // Create temporary grid to reconstruct tokens using flyweight pattern
      const tempGrid = new TokenGrid(this.config);
      const gridState = SerializableGrid.fromJSON(data.grid, this.config);

      // Rebuild token instances from saved values
      gridState.modifiedCells.forEach((value, _coord) => {
        if (value.tokenValue !== null) {
          tempGrid.getOrCreateToken(value.tokenValue);
        }
      });

      const playerState = SerializablePlayer.fromJSON(data.player, tempGrid);

      // Provide defaults for backward compatibility
      const movementMode = data.movementMode || "geolocation";
      const coordinateSystem = data.coordinateSystem || "geolocation";

      return {
        success: true,
        playerPosition: playerState.position,
        playerInventory: playerState.inventory,
        gridModifiedCells: gridState.modifiedCells,
        gameWon: data.gameWon,
        timestamp: data.timestamp,
        movementMode: movementMode,
        coordinateSystem: coordinateSystem,
        lastKnownPosition: data.lastKnownPosition,
      };
    } catch (error) {
      console.error("Failed to load game:", error);
      return { success: false };
    }
  }

  // Check if there's a saved game available
  hasSavedGame(): boolean {
    return localStorage.getItem(GameStateManager.SAVE_KEY) !== null;
  }

  // Get metadata about saved game (for UI display)
  getSaveInfo(): SaveGameInfo | null {
    try {
      const saveData = localStorage.getItem(GameStateManager.SAVE_KEY);
      if (!saveData) return null;

      const data: GameStateData = JSON.parse(saveData);
      return {
        timestamp: data.timestamp,
        version: data.version,
      };
    } catch {
      return null;
    }
  }

  // Delete the current saved game
  deleteSave(): boolean {
    try {
      localStorage.removeItem(GameStateManager.SAVE_KEY);
      return true;
    } catch (error) {
      console.error("Failed to delete save:", error);
      return false;
    }
  }

  // Export game state as string for backup/sharing
  exportGameState(): string | null {
    try {
      return localStorage.getItem(GameStateManager.SAVE_KEY);
    } catch {
      return null;
    }
  }

  // Import game state from backup string
  importGameState(exportData: string): boolean {
    try {
      const data: GameStateData = JSON.parse(exportData);

      // Basic validation of imported data
      if (!data.player || !data.grid || !data.version) {
        throw new Error("Invalid game state data");
      }

      localStorage.setItem(GameStateManager.SAVE_KEY, exportData);
      return true;
    } catch (error) {
      console.error("Failed to import game state:", error);
      return false;
    }
  }

  // Clear all saved game data (factory reset)
  clearAllData(): boolean {
    try {
      localStorage.removeItem(GameStateManager.SAVE_KEY);
      return true;
    } catch (error) {
      console.error("Failed to clear game data:", error);
      return false;
    }
  }
}
