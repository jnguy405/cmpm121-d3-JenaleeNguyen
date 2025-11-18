import { GridCoord } from "../Grid/grid.ts";
import type { TokenGame } from "../Token/tokenGame.ts";

// Interface for different movement control systems
export interface MoveCtrl {
  start(): void;
  stop(): void;
  getCurrPos(): { lat: number; lng: number } | null;
  onPosUpdate(callback: (position: { lat: number; lng: number }) => void): void;
  getModeName(): string;
}

// Button-based movement: uses on-screen directional buttons for grid navigation
export class BtnMoveCtrl implements MoveCtrl {
  private positionCallbacks:
    ((position: { lat: number; lng: number }) => void)[] = [];
  private isActive = false;

  constructor(private game: TokenGame) {
    this.setupKeyboardControls();
  }

  start(): void {
    this.isActive = true;
  }

  stop(): void {
    this.isActive = false;
  }

  getCurrPos(): { lat: number; lng: number } | null {
    const playerPos = this.game.player.position;
    return this.gridCoordToLatLng(playerPos);
  }

  onPosUpdate(
    callback: (position: { lat: number; lng: number }) => void,
  ): void {
    this.positionCallbacks.push(callback);
  }

  getModeName(): string {
    return "buttons";
  }

  // Handle button press movement (grid-based)
  public btnMove(deltaI: number, deltaJ: number): void {
    if (!this.isActive) return;

    const newPos = new GridCoord(
      this.game.player.position.i + deltaI,
      this.game.player.position.j + deltaJ,
    );

    const newLatLng = this.gridCoordToLatLng(newPos);
    this.positionCallbacks.forEach((callback) => callback(newLatLng));
  }

  // Convert grid coordinates to map coordinates
  private gridCoordToLatLng(coord: GridCoord): { lat: number; lng: number } {
    const { config } = this.game;
    return {
      lat: config.globalLatLng.lat + coord.i * config.cellSize +
        config.cellSize / 2, // Center of cell
      lng: config.globalLatLng.lng + coord.j * config.cellSize +
        config.cellSize / 2,
    };
  }

  private setupKeyboardControls(): void {
    document.addEventListener("keydown", (e) => {
      if (this.getModeName() !== "buttons") return;
      if (this.game.gameWon) return;

      switch (e.key.toLowerCase()) {
        case "w":
        case "arrowup":
          e.preventDefault();
          this.btnMove(1, 0); // North
          break;
        case "s":
        case "arrowdown":
          e.preventDefault();
          this.btnMove(-1, 0); // South
          break;
        case "a":
        case "arrowleft":
          e.preventDefault();
          this.btnMove(0, -1); // West
          break;
        case "d":
        case "arrowright":
          e.preventDefault();
          this.btnMove(0, 1); // East
          break;
      }
    });
  }
}

// Real-world movement: uses device GPS for location-based gameplay
export class GeoMoveCtrl implements MoveCtrl {
  private positionCallbacks:
    ((position: { lat: number; lng: number }) => void)[] = [];
  private isActive = false;
  private watchId: number | null = null;
  private lastPosition: { lat: number; lng: number } | null = null;

  constructor(private game: TokenGame) {}

  start(): void {
    if (this.isActive) return;

    this.isActive = true;
    if ("geolocation" in navigator) {
      // Start watching device position
      this.watchId = navigator.geolocation.watchPosition(
        (position) => {
          const newPos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          this.lastPosition = newPos;
          this.positionCallbacks.forEach((callback) => callback(newPos));
        },
        (error) => {
          console.error("Geolocation error:", error);
        },
        {
          enableHighAccuracy: true, // Use GPS if available
          maximumAge: 30000, // Accept cached positions up to 30s old
          timeout: 27000, // Wait up to 27s for position
        },
      );
    } else {
      console.error("Geolocation not supported");
    }
  }

  stop(): void {
    this.isActive = false;
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  getCurrPos(): { lat: number; lng: number } | null {
    return this.lastPosition;
  }

  onPosUpdate(
    callback: (position: { lat: number; lng: number }) => void,
  ): void {
    this.positionCallbacks.push(callback);
  }

  getModeName(): string {
    return "geolocation";
  }
}
