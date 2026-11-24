// js/router.js
import { fetchUISchema } from './services/api.js';
import { generateLayoutTree } from './layout_factory.js';
import { loadUISchema } from './ui_render.js';
import { URLState } from './helper.js';
import { renderLoading, renderError } from './utils/ui.js'; 

window.currentActiveObject = null;

export async function initRouter(objectName, requestedView = null, isHistoryPop = false, options = {}) {
    const currentState = URLState.get();
    const isNewObject = window.currentActiveObject !== objectName && window.currentActiveObject !== null;
    const view = requestedView || (isNewObject ? 'list' : currentState.view);

    window.currentActiveObject = objectName;

    if (!isHistoryPop) {
        URLState.set({
            object: objectName,
            view: view,
            filters: isNewObject ? [] : currentState.filters,
            // THE FIX: Prevent the router from deleting the recordId on click
            recordId: currentState.recordId 
        });
    }

    const root = document.getElementById('app-root');
    renderLoading(root, "Loading Layout...");

    const formattedTitle = objectName.replace(/([A-Z])/g, ' $1').trim();
    document.getElementById('api-ref-name').innerText = objectName;

    try {
        const rawMetadata = await fetchUISchema(objectName, view);
        
        // Pass the context simply so the factory knows what view to build
        const layoutTree = generateLayoutTree(rawMetadata, { 
            recordId: currentState.recordId,
            requested_view: view,
            prefill: options.prefill
        });
        
        loadUISchema(layoutTree);

        document.querySelectorAll('.sidebar-link').forEach(l => {
            if (l.innerText.toLowerCase() === formattedTitle.toLowerCase() || l.innerText === objectName) {
                l.classList.add('active');
            } else {
                l.classList.remove('active');
            }
        });

    } catch (error) {
        renderError(root, `Error loading UI: ${error.message}`);
    }
}