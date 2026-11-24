// js/app.js
import { initDevContext } from './dev_context.js';
import { loadSidebar } from './sidebar.js';
import { initRouter } from './router.js';
import { CommandPalette } from './components/CommandPalette.js';
import { Dashboard } from './dashboard.js';
import { URLState } from './helper.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Boot Developer Tools / Context
    initDevContext();

    // 2. Boot Core UI Components
    CommandPalette.init();
    loadSidebar();

    // 3. Handle Initial Navigation Route
    const initialState = URLState.get();
    if (initialState.object) {
        initRouter(initialState.object, initialState.view);
    } else if (typeof Dashboard !== 'undefined') {
        Dashboard.load();
    }
});

// --- THE ARCHITECTURE UPGRADE: AI CO-PILOT REACTIVITY ---
window.addEventListener('PlatformDataChanged', (e) => {
    console.log("[Event Bus] AI modified platform data. Redrawing active view...");
    
    // 1. Check where the user currently is
    const currentState = URLState.get();
    
    // 2. If they are looking at an object, silently re-fetch and re-render it
    if (currentState.object) {
        // We pass 'true' for isHistoryPop so the router doesn't duplicate the URL history
        initRouter(currentState.object, currentState.view, true);
    } else if (typeof Dashboard !== 'undefined') {
        // If they are on the home dashboard, refresh that instead
        Dashboard.load();
    }
    
    // 3. Re-fetch the sidebar just in case the AI added a new object!
    loadSidebar();
});