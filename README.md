# D3: World of Bits

A location-based puzzle game combining elements of 4096, Threes, and Pokemon Go. Collect and combine tokens on a real-world map to reach target values.

[Deployed Site](https://jnguy405.github.io/cmpm121-d3-JenaleeNguyen/)

## D3.a Development Phases 1-5

1. **Map & Grid Foundation** - Leaflet map with grid cell system
2. **Token System & Visibility** - Deterministic token spawning and display
3. **Player & Interaction Range** - Player position and interaction boundaries
4. **Inventory System** - Single-slot token inventory and collection
5. **Crafting & Win Condition** - Token combining and victory detection

## D3.b Development Phases 6-8 and Notes

**Notes**: Already implemented functions to track the grid's coordinates, the cell's bounds, and even trigger upon moveend and zoomend.

1. **Player Movement System** - Player movement utilizing (N/S/E/W) directions along with interaction detection updates
2. **Memoryless Cell Behavior** - Cells appear to be memoryless and transitioned to token farming
3. **Enhanced Victory & Global Coordinates** - Pivot to initial spawn at the origin with higher victory threshold

## D3.c Development Phases 9-10

1. **Flyweight Cells & Memento Persistence** - Flyweight pattern for effective memory-saving of cells not in visibility range
2. **Integrated Persistent World** - Memento pattern to preserve the state of off-screen cells after modification

## D3.d Development Phases 11-12

1. **Geolocation API and Movement System Enhancement** - Pivot to the broswer geolocation API and employ the Facade pattern on the player movement system
2. **Game State Persistence** - Implement game state and memory control

## Project Files

- `PLAN.md`: Development plan and progress tracking.
- `README.md`: Project overview (this file).
- `src/main.ts`: Entry point — loads global styles/workarounds and starts the game by creating a `TokenGame` instance.
- `src/Token/token.ts`: Token-domain module — exports `Token` and `TokenGrid`. Contains token behavior and world storage (memento/flyweight).
- `src/Token/tokenGame.ts`: Helps export `TokenGame` - the main game coordination (map, input handling, win detection).
- `src/Grid/grid.ts`: Grid-related module — exports `GridCoord` and `GridRenderer`. Handles discrete grid coordinates, viewport-to-grid math, and rendering cells/tokens onto the Leaflet map.
- `src/Movement/moveCtrl.ts`: Defines movement interfaces (button & geolocation controls).
- `src/Movement/moveManager.ts`: Handles switching between movement control systems.
- `src/Game/core.ts`: Core/shared classes — exports `GameConfig`, `Player`, and `UIManager`. Keeps shared configuration, player state & inventory logic, and DOM UI management.
- `src/Game/gameState.ts`: Game state persistence module — exports `GameStateManager`, serialization interfaces, and save/load functionality.
- `src/style.css`: Styling for map and UI elements.
- `src/_leafletWorkaround.ts`: Leaflet icon fixes/workarounds required by the build.
- `src/_luck.ts`: Deterministic random number generator used for reproducible token spawning.
