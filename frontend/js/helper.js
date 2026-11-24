// js/helper.js
import { loadUISchema, renderComponent } from './ui_render.js';
import { Dashboard } from './dashboard.js';
import { fetchUISchema, fetchObjectsList, fetchSearch } from './services/api.js';
import { renderLoading, renderError } from './utils/ui.js';
import { Record360 } from './components/Record360.js';
import { initRouter } from './router.js';

// --- NEW: URL STATE MANAGER ---
export const URLState = {
    get: () => {
        const params = new URLSearchParams(window.location.search);
        const state = {
            object: params.get('object') || null,
            view: params.get('view') || 'list',
            recordId: params.get('recordId') || null, // <-- ADD THIS
            filters: []
        };

        const filterStr = params.get('filters');
        if (filterStr) {
            try {
                state.filters = JSON.parse(decodeURIComponent(filterStr));
            } catch (e) {
                console.warn("Failed to parse URL filters");
            }
        }
        return state;
    },

    set: (newState, replace = false) => {
        const url = new URL(window.location);
        if (newState.object) url.searchParams.set('object', newState.object);
        if (newState.view) url.searchParams.set('view', newState.view);

        // <-- ADD THIS BLOCK -->
        if (newState.recordId) {
            url.searchParams.set('recordId', newState.recordId);
        } else {
            url.searchParams.delete('recordId');
        }

        if (newState.filters && newState.filters.length > 0) {
            url.searchParams.set('filters', encodeURIComponent(JSON.stringify(newState.filters)));
        } else {
            url.searchParams.delete('filters');
        }

        if (replace) {
            window.history.replaceState(newState, "", url);
        } else {
            window.history.pushState(newState, "", url);
        }
    },

    listen: (callback) => {
        window.addEventListener('popstate', () => {
            callback(URLState.get());
        });
    }
};


window.openRecordDetail = async function(objectName, recordId, view = 'detail', options = {}) {
    const root = document.getElementById('app-root');
    renderLoading(root, "Loading 360 View...");

    // 1. Update the URL state globally
    URLState.set({
        object: objectName,
        view: view,
        recordId: recordId
    });

    // 2. Hand control back to the central router!
    // The router will fetch the schema, run it through the layout_factory, 
    // and properly render the UI with all our fixed mapping logic.
    await initRouter(objectName, view, false, options);
};

window.toggleContextPanel = function() {
    const panel = document.getElementById('context-panel');
    panel.classList.toggle('hidden');
};

//////////////////////////

// --- NEW: QUICK VIEW POPOVER ---
let activeQuickView = null;

window.openQuickView = async function(objectName, recordId, event) {
    // 1. Clean up any existing popovers
    if (activeQuickView) {
        document.body.removeChild(activeQuickView);
        activeQuickView = null;
    }

    // 2. Create the Popover Container
    const popover = document.createElement('div');
    activeQuickView = popover;

    // Position it absolutely, slightly offset from the cursor
    popover.className = "absolute z-50 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col pointer-events-auto transform transition-all opacity-0 scale-95";

    // Ensure it doesn't render off-screen
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Default position: below and slightly right of cursor
    let left = event.clientX + 15;
    let top = event.clientY + 15;

    // Adjust if too close to right edge
    if (left + 320 > viewportWidth) left = event.clientX - 335;
    // Adjust if too close to bottom edge
    if (top + 400 > viewportHeight) top = event.clientY - 415;

    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
    // 3. Render Header
    const header = document.createElement('div');
    header.className = "flex justify-between items-center p-3 border-b border-slate-100 bg-slate-50";
    header.innerHTML = `
        <div>
            <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">${objectName}</span>
            <div class="text-sm font-semibold text-slate-800">${recordId}</div>
        </div>
        <button class="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded hover:bg-slate-200" onclick="closeQuickView()">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
    `;
    popover.appendChild(header);

    // 4. Render Body Container (for the preview Form)
    const body = document.createElement('div');
    body.className = "p-4 flex-1 overflow-y-auto max-h-[300px] custom-scrollbar";
    popover.appendChild(body);

    // 5. Render Footer Action
    const footer = document.createElement('div');
    footer.className = "p-3 border-t border-slate-100 bg-slate-50 text-center";
    footer.innerHTML = `
        <button class="w-full py-1.5 px-3 bg-white border border-slate-200 shadow-sm rounded-lg text-xs font-semibold text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 transition-all"
                onclick="closeQuickView(); window.openRecordDetail('${objectName}', '${recordId}', 'detail');">
            Go to Record
        </button>
    `;
    popover.appendChild(footer);
    document.body.appendChild(popover);

    // Animate in
    requestAnimationFrame(() => {
        popover.classList.remove('opacity-0', 'scale-95');
        popover.classList.add('opacity-100', 'scale-100');
    });

    // 6. Fetch and Render the Preview Schema
    renderLoading(body, "Loading preview...");
    try {
        const layoutSchema = await fetchUISchema(objectName, 'preview');
        const schemaString = JSON.stringify(layoutSchema).replace(/{RECORD_ID}/g, recordId);
        const hydratedSchema = JSON.parse(schemaString);

        body.innerHTML = "";
        body.appendChild(renderComponent(hydratedSchema));
    } catch (error) {
        console.error(error);
        renderError(body, "Failed to load preview.");
    }
};

window.closeQuickView = function() {
    if (activeQuickView) {
        activeQuickView.classList.replace('opacity-100', 'opacity-0');
        activeQuickView.classList.replace('scale-100', 'scale-95');
        setTimeout(() => {
            if (activeQuickView && activeQuickView.parentNode) {
                activeQuickView.parentNode.removeChild(activeQuickView);
            }
            activeQuickView = null;
        }, 150);
    }
};

// Global listener to close popover when clicking outside of it
document.addEventListener('mousedown', (e) => {
    if (activeQuickView && !activeQuickView.contains(e.target)) {
        // Prevent closing if they clicked a standard card (which triggers a new popover)
        if (!e.target.closest('[data-quick-view-trigger]')) {
            window.closeQuickView();
        }
    }
});



window.showToast = (message, type = 'error') => {
    const container = document.getElementById('global-toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    
    // Base styles for layout and vertical slide animation
    const baseClasses = "border-l-4 p-4 rounded shadow-lg flex items-center gap-3 transform transition-all duration-300 opacity-0 translate-y-4 pointer-events-auto max-w-sm w-full mb-2";
    
    // Theme logic based on type (success vs error)
    const isSuccess = type === 'success';
    const themeClasses = isSuccess 
        ? "bg-emerald-50 border-emerald-500 text-emerald-800" 
        : "bg-white border-rose-500 text-slate-700";
        
    const iconSvg = isSuccess 
        ? `<svg class="w-5 h-5 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`
        : `<svg class="w-5 h-5 text-rose-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;

    toast.className = `${baseClasses} ${themeClasses}`;
    
    // Construct HTML safely (no variables)
    toast.innerHTML = `
        ${iconSvg}
        <span class="text-sm font-medium leading-tight toast-message"></span>
    `;
    
    // Inject the message securely as text
    toast.querySelector('.toast-message').textContent = message || "An unexpected error occurred.";
    
    container.appendChild(toast);

    // Force browser reflow to trigger the CSS animation
    void toast.offsetWidth;

    // Animate in
    toast.classList.remove('opacity-0', 'translate-y-4');

    // Auto-remove after 4 seconds
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-4');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
};

// Leave this alias here just in case any older parts of your code still call showError()
window.showError = (message) => window.showToast(message, 'error');

// --- TENANT SWITCHER LOGIC ---

// --- TENANT & USER SWITCHER LOGIC ---

document.addEventListener('DOMContentLoaded', () => {
    // Retrieve stored states or fallback to defaults
    const activeTenant = localStorage.getItem('dev_tenant') || 'TENANT-ACME';
    const activeUser = localStorage.getItem('dev_user') || 'USER-ALICE';
    
    const tenantDropdown = document.getElementById('dev-tenant-switcher');
    const tenantDisplay = document.getElementById('currentTenant');
    
    const userDropdown = document.getElementById('dev-context-switcher');
    const userDisplay = document.getElementById('currentUser');
    
    // Sync Tenant DOM
    if (tenantDropdown) tenantDropdown.value = activeTenant;
    if (tenantDisplay) tenantDisplay.textContent = activeTenant;
    
    // Sync User DOM
    if (userDisplay) userDisplay.textContent = activeUser;
    
    // Listen for manual user changes in the dropdown
    if (userDropdown) {
        userDropdown.addEventListener('change', (e) => {
            const newUser = e.target.value;
            if (newUser) {
                localStorage.setItem('dev_user', newUser);
                if (userDisplay) userDisplay.textContent = newUser;
                // Optional: window.location.reload(); if user-switching requires a data reset
            }
        });
    }
});

window.changeTenant = (newTenantId) => {
    localStorage.setItem('dev_tenant', newTenantId);
    
    // Automatically switch to the default admin of the new tenant to prevent user mismatches
    const defaultUser = newTenantId === 'TENANT-GLOBEX' ? 'USER-GLOBEX-ADMIN' : 'USER-ALICE';
    localStorage.setItem('dev_user', defaultUser);
    
    // Hard reload to clear out any cached state/metadata from the old tenant
    window.location.reload();
};
