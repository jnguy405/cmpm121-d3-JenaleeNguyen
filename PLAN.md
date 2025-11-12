# D3: World of Bits

## D3.a Phases

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

## D3.b: Globe-spanning gameplay

### Already Implemented

- [x] Cells spawn/despawn to keep screen full during map movement
- [x] Player can scroll map without moving character, seeing cells everywhere
- [x] Grid coordinate system using `GridCoord` interface
- [x] `getCellBounds()` function for coordinate conversion
- [x] `moveend` and `zoomend` events trigger grid updates
- [x] Cells visible to edge of map during movement

### Phase 6: Player Movement System

- [ ] Add movement buttons (N/S/E/W) to control panel
- [ ] Implement movable player position (separate from map view)
- [ ] Update interaction range based on current player position
- [ ] Make player marker move with button controls

### Phase 7: Memoryless Cell Behavior

- [ ] Remove token persistence when cells leave visibility
- [ ] Implement token farming (cells reset when off-screen)
- [ ] Remove `collectedTokens` tracking for D3.b
- [ ] Test farming by moving in/out of cell ranges

### Phase 8: Enhanced Victory & Global Coordinates

- [ ] Switch to Null Island coordinate system (0,0)
- [ ] Increase win condition threshold (e.g., 32 or 64)
- [ ] Update coordinate calculations for global system
- [ ] Test extended crafting with player movement

## D3.c: Object persistence

- To be continued...
