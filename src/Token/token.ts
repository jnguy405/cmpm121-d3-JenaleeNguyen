import luck from "../_luck.ts";
import { GameConfig } from "../Game/core.ts";
import { GridCoord } from "../Grid/grid.ts";

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
  // FLYWEIGHT PATTERN: This Map stores shared Token instances by value
  // Multiple grid cells can reference the same Token object if they have the same value
  private tokens = new Map<string, Token>();

  // MEMENTO PATTERN: This Map stores the state (token values) for each cell coordinate
  // It remembers which tokens are placed where, acting as a memento of the grid state
  private modifiedCells = new Map<string, { tokenValue: number | null }>();

  constructor(private config: GameConfig) {}

  private getKey(coord: GridCoord): string {
    return coord.toString();
  }

  // MEMENTO PATTERN: Restores previous state for a coordinate
  // Returns the token that was previously at this position, or undefined if no memento exists
  private loadMemento(coord: GridCoord): Token | null | undefined {
    const key = this.getKey(coord);
    const m = this.modifiedCells.get(key);
    if (!m) return undefined; // No memento exists for this coordinate
    if (m.tokenValue === null) return null; // Memento records empty cell
    return this.getOrCreateToken(m.tokenValue); // Memento records token value
  }

  // MEMENTO PATTERN: Saves current state for a coordinate
  // Creates a memento storing whether this cell has a token and its value
  private saveMemento(coord: GridCoord, token: Token | null): void {
    const key = this.getKey(coord);
    this.modifiedCells.set(key, {
      tokenValue: token ? token.value : null, // Store token value or null for empty
    });
  }

  // FLYWEIGHT PATTERN: Returns existing Token instance or creates new one
  // This ensures that all tokens with the same value share the same object instance
  getOrCreateToken(value: number): Token {
    const key = `val-${value}`; // Key based on token value, not position
    if (!this.tokens.has(key)) {
      // Create new Token instance only if it doesn't exist
      this.tokens.set(key, new Token(value));
    }
    // Return the shared Token instance
    return this.tokens.get(key)!;
  }

  getOrSpawn(coord: GridCoord): Token | null {
    const key = this.getKey(coord);

    // MEMENTO PATTERN: First check if we have a saved state for this coordinate
    const mementoValue = this.loadMemento(coord);
    if (mementoValue !== undefined) {
      return mementoValue; // Return the remembered state
    }

    // Check if token already exists at this position
    if (this.tokens.has(key)) {
      return this.tokens.get(key)!;
    }

    // Spawn new token based on probability
    const spawnRoll = luck(`${coord},token`);
    if (spawnRoll < this.config.tokenSpawnProbability) {
      const value = Math.floor(luck(`${coord},value`) * 4) + 1;

      // FLYWEIGHT PATTERN: Use shared token instance instead of creating new one
      const token = this.getOrCreateToken(value);

      // MEMENTO PATTERN: Save this newly spawned token to remember it
      this.saveMemento(coord, token);
      return token;
    }

    // MEMENTO PATTERN: Remember that this cell is empty
    this.saveMemento(coord, null);
    return null;
  }

  placeToken(coord: GridCoord, token: Token): void {
    const key = this.getKey(coord);
    this.tokens.set(key, token);

    // MEMENTO PATTERN: Save the new token placement to remember it
    this.saveMemento(coord, token);
  }

  removeToken(coord: GridCoord): Token | null {
    const key = this.getKey(coord);
    const token = this.tokens.get(key) || null;
    this.tokens.delete(key);

    // MEMENTO PATTERN: Remember that this cell is now empty
    this.saveMemento(coord, null);
    return token;
  }

  hasWinningToken(winningValue: number): boolean {
    return [...this.tokens.values()].some((t) => t.isWinning(winningValue));
  }

  getAllTokens(): Map<string, Token> {
    return new Map(this.tokens);
  }

  // PERSISTENCE: Getter for modifiedCells to allow serialization
  getModifiedCells(): Map<string, { tokenValue: number | null }> {
    return new Map(this.modifiedCells);
  }

  // PERSISTENCE: Setter for modifiedCells to allow deserialization
  setModifiedCells(
    modifiedCells: Map<string, { tokenValue: number | null }>,
  ): void {
    this.modifiedCells = new Map(modifiedCells);

    // Rebuild tokens map from modifiedCells for active tokens
    this.tokens.clear();
    modifiedCells.forEach((value, coord) => {
      if (value.tokenValue !== null) {
        this.tokens.set(coord, this.getOrCreateToken(value.tokenValue));
      }
    });
  }
}
