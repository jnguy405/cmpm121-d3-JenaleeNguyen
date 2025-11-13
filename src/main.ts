// Entry point: import global styles and start the game.
import "leaflet/dist/leaflet.css";
import "./_leafletWorkaround.ts";
import "./style.css";
import { TokenGame } from "./Token/token.ts";

document.addEventListener("DOMContentLoaded", () => {
  new TokenGame("map");
});
