# D3: World of Bits

A location-based puzzle game combining elements of 4096, Threes, and Pokemon Go. Collect and combine tokens on a real-world map to reach target values.

## D3.a Development Phases

1. **Map & Grid Foundation** - Leaflet map with grid cell system
2. **Token System & Visibility** - Deterministic token spawning and display
3. **Player & Interaction Range** - Player position and interaction boundaries
4. **Inventory System** - Single-slot token inventory and collection
5. **Crafting & Win Condition** - Token combining and victory detection

## D3.b Development Phases and Notes

**Notes**: Already implemented functions to track the grid's coordinates, the cell's bounds, and even trigger upon moveend and zoomend.

1. **Player Movement System** - Player movement utilizing (N/S/E/W) directions along with interaction detection updates
2. **Memoryless Cell Behavior** - Cells appear to be memoryless and transitioned to token farming
3. **Enhanced Victory & Global Coordinates** - Pivot to initial spawn at the origin with higher victory threshold

## D3.c Development Phases

1. **Flyweight Cells & Memento Persistence** - Flyweight pattern for effective memory-saving of cells not in visibility range
2. **Integrated Persistent World** - Memento pattern to preserve the state of off-screen cells after modification

## Project Files

1. `PLAN.md` Development plan and progress tracking
2. `README.md` Project overview (this file)
3. `main.ts` Main game logic and Leaflet implementation
4. `style.css` Styling for map and UI elements
5. `_leafletWorkaround.ts` Leaflet icon fixes
6. `_luck.ts` Deterministic random number generator
