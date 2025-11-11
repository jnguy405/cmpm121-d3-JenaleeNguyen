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

- [ ] Place token onto cell with equal value to combine (2x value)
- [ ] Detect when player holds token of sufficient value (e.g., 8 or 16)
- [ ] Win condition detection and message
- [ ] Complete gameplay flow: collect -> combine -> win

## D3.b: Globe-spanning gameplay

- To be continued...

## D3.c: Object persistence

- To be continued...
