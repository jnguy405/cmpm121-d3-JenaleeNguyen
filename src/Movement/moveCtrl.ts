import { GridCoord } from "../Grid/grid.ts";
import type { TokenGame } from "../Token/token.ts";

// MoveCtrl: Interface for movement control systems allowing different input methods.
export interface MoveCtrl {
  start(): void;
  stop(): void;
  getCurrPos(): { lat: number; lng: number } | null;
  onPosUpdate(callback: (position: { lat: number; lng: number }) => void): void;
  getModeName(): string;
}

// BtnMoveCtrl: Button-based movement control using on-screen directional buttons.
export class BtnMoveCtrl implements MoveCtrl {
  private positionCallbacks:
    ((position: { lat: number; lng: number }) => void)[] = [];
  private isActive = false;

  constructor(private game: TokenGame) {}

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

  public btnMove(deltaI: number, deltaJ: number): void {
    if (!this.isActive) return;

    const newPos = new GridCoord(
      this.game.player.position.i + deltaI,
      this.game.player.position.j + deltaJ,
    );

    const newLatLng = this.gridCoordToLatLng(newPos);
    this.positionCallbacks.forEach((callback) => callback(newLatLng));
  }

  private gridCoordToLatLng(coord: GridCoord): { lat: number; lng: number } {
    const { config } = this.game;
    return {
      lat: config.globalLatLng.lat + coord.i * config.cellSize +
        config.cellSize / 2,
      lng: config.globalLatLng.lng + coord.j * config.cellSize +
        config.cellSize / 2,
    };
  }
}

// GeoMoveCtrl: Geolocation-based movement using browser location API for real-world movement.
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
          enableHighAccuracy: true,
          maximumAge: 30000,
          timeout: 27000,
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
