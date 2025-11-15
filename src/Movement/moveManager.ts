import type { TokenGame } from "../Token/token.ts";
import type { MoveCtrl } from "./moveCtrl.ts";

// MoveManager: Facade that manages switching between different movement control systems.
export class MoveManager {
  private currentCtrl: MoveCtrl | null = null;
  private controls: Map<string, MoveCtrl> = new Map();
  private isActive = false;

  constructor(private game: TokenGame) {}

  regCtrl(name: string, control: MoveCtrl): void {
    this.controls.set(name, control);
  }

  switchCtrl(modeName: string): boolean {
    console.log(`switchCtrl called with: ${modeName}`);
    console.log(`Available controls:`, Array.from(this.controls.keys()));

    // Stop current control
    if (this.currentCtrl) {
      console.log(
        `Stopping current control: ${this.currentCtrl.getModeName()}`,
      );
      this.currentCtrl.stop();
    }

    // Start new control
    const newCtrl = this.controls.get(modeName);
    if (!newCtrl) {
      console.error(`Movement control '${modeName}' not found`);
      return false;
    }

    this.currentCtrl = newCtrl;
    console.log(`New control set: ${this.currentCtrl.getModeName()}`);

    if (this.isActive) {
      console.log(`Starting new control: ${modeName}`);
      newCtrl.start();
    }

    console.log(`Successfully switched to ${modeName}`);
    return true;
  }

  start(): void {
    this.isActive = true;
    if (this.currentCtrl) {
      this.currentCtrl.start();
    }
  }

  stop(): void {
    this.isActive = false;
    if (this.currentCtrl) {
      this.currentCtrl.stop();
    }
  }

  getCurrCtrl(): MoveCtrl | null {
    return this.currentCtrl;
  }

  getAvailableModes(): string[] {
    return Array.from(this.controls.keys());
  }

  setPosHandler(
    handler: (position: { lat: number; lng: number }) => void,
  ): void {
    this.controls.forEach((control) => {
      control.onPosUpdate(handler);
    });
  }
}
