import React from "react";
import { createRoot } from "react-dom/client";
import App from "./dpdeck.jsx";

// No StrictMode: DP Deck was built for the claude.ai artifact runtime (single mount).
// Its load effect reads storage imperatively and gates the autosave on a loaded flag,
// so the dev double-invoke StrictMode does would just add noise. Keep it faithful.
createRoot(document.getElementById("root")).render(<App />);
