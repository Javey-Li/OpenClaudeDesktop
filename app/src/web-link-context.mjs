// The session's web link opener (main.jsx provides it around its tiles): replies' links call it with the click, so a
// link to a page on this computer can open in that session's Preview pane (preview-links-model.mjs webLinkRoute).
// Without a provider (Settings, dialogs) a link opens in the default browser as before.
import React from "react";

export const WebLinkContext = React.createContext(null);
