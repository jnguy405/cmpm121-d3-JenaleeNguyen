# D3: World of Bits

**World of Bits** is a geographic crafting game where players explore a grid-based world, collect numeric tokens, and combine them through strategic placement to achieve winning combinations. The game blends real-world coordinates with game mechanics, creating a persistent world that spans the globe.

## Game Design Vision

World of Bits is composed of layered systems that create emergent gameplay:

- **Geographic Foundation**: Leaflet map with real-world coordinate system
- **Grid-Based Interaction**: Discrete cell system overlaid on continuous geography
- **Token Economy**: Collectible and combinable numeric tokens with progression
- **Persistent World**: Flyweight pattern with memento-based state persistence
- **Global Scale**: Gameplay that literally spans the entire world

## Technologies

- **TypeScript, HTML, CSS** - Core web technologies
- **Git Codespace + VS Code** - Development environment
- **Copilot Autocomplete** - AI-assisted development
- **Leaflet + Geolocation** - Map rendering and coordinate system
- **Deno + Vite** - Build tooling and development server
- **Git Actions** - CI/CD pipeline

## Core Architecture

- **TokenGrid**: Flyweight + Memento pattern for world persistence
- **GridRenderer**: Dynamic cell rendering with Leaflet integration
- **Player**: Mobile agent with inventory and interaction range
- **UIManager**: Reactive UI updates and player feedback
- **GameConfig**: Centralized game balance and world parameters

## Assignments

## D3.a Phases - Core Mechanics (token and grid foundation)

### Phase 1: Map & Grid Foundation

- [x] Leaflet map centered on classroom location
- [x] Grid cells (0.0001 degrees) rendered on map
- [x] Cells visible without clicking (semi-transparent rectangles)
- [x] Cells cover entire visible map area

### Phase 2: Token System & Visibility

- [x] Fixed player position at classroom coordinates
- [x] Interaction limited to cells within 3 cells of player
- [x] Visual distinction for interactable vs non-interactable cells
- [x] Cells can be clicked for game mechanics

### Phase 3: Player & Interaction Range

- [x] Token type with value property
- [x] Deterministic spawning using Luck function
- [x] Token contents visible without clicking (colored circles in cells)
- [x] Consistent initial state across page loads

### Phase 4: Inventory System

- [x] Single-slot inventory (holds one token or null)
- [x] Pick up token (removes from cell, adds to inventory)
- [x] Clear inventory display on screen
- [x] Inventory state visible to player

### Phase 5: Crafting & Win Condition

- [x] Place token onto cell with equal value to combine (2x value)
- [x] Detect when player holds token of sufficient value (e.g., 8 or 16)
- [x] Win condition detection and message
- [x] Complete gameplay flow: collect -> combine -> win

## D3.b: Globe-spanning gameplay (player movement and farming)

### Already Implemented

- [x] Cells spawn/despawn to keep screen full during map movement
- [x] Player can scroll map without moving character, seeing cells everywhere
- [x] Grid coordinate system using `GridCoord` interface
- [x] `getCellBounds()` function for coordinate conversion
- [x] `moveend` and `zoomend` events trigger grid updates
- [x] Cells visible to edge of map during movement

### Phase 6: Player Movement System

- [x] Add movement buttons (N/S/E/W) to control panel
- [x] Implement movable player position (separate from map view)
- [x] Update interaction range based on current player position
- [x] Make player marker move with button controls

### Phase 7: Memoryless Cell Behavior

- [x] Remove token persistence when cells leave visibility
- [x] Implement token farming (cells reset when off-screen)
- [x] Remove `collectedTokens` tracking for D3.b
- [x] Test farming by moving in/out of cell ranges
      Note: Performed class extraction and addressed code smells externally and transferred the file in. First time using privates and publics.

### Phase 8: Enhanced Victory & Global Coordinates

- [x] Switch to Null Island coordinate system (0,0)
- [x] Increase win condition threshold (e.g., 32 or 64)
- [x] Update coordinate calculations for global system
- [x] Test extended crafting with player movement

## D3.c: Object persistence (Flyweight and Momento patterns)

### Phase 9: Flyweight Cells & Memento Persistence

- [x] Implement Flyweight cell system (no memory for unmodified off-screen cells)
- [x] Add modifiedCells Map to store only changed cell states using mementos
- [x] Load cells using Memento -> otherwise default RNG token
- [x] Save cell changes (pickup, drop, combine) into mementos for persistence

### Phase 10: Integrated Persistent World

- [x] Rebuild all visible cells each map movement using memento or fallback RNG
- [x] Ensure modified cells reappear correctly when scrolled off/on screen
- [x] Verify flyweight behavior -> only modified cells consume memory
- [x] Test long-distance travel to confirm world feels consistently persistent

## D3.d: Gameplay Across Real-world Space and Time

### Phase 11: Geolocation API and Movement System Enhancement

- [x] Implement alternative movement controls using real-world location
- [x] Create abstraction layer for different movement input methods
- [x] Add ability to switch between movement control schemes
- [x] Update player positioning system to work with new movement controls

### Phase 12: Game State Persistence

- [x] Add persistent storage for game progress across sessions
- [x] Implement save/load functionality for world state
- [x] Create new game initialization system
