
import { fetchObjectsList } from './services/api.js';
// js/sidebar.js
import { URLState } from './helper.js';
import { initRouter } from './router.js';
// --- SIDEBAR LOGIC ---
export async function loadSidebar() {
    try {
        const data = await fetchObjectsList();
        const workspaceNav = document.getElementById('workspace-nav');
        const directoryNav = document.getElementById('directory-nav');

        workspaceNav.innerHTML = "";
        directoryNav.innerHTML = "";

        if (data.objects && data.objects.length > 0) {
            let hasWorkspaceItems = false;

            data.objects.forEach(obj => {
                // 1. RENDER STANDARD DIRECTORY LINK
                const mainLink = document.createElement('a');
                mainLink.href = "#";
                mainLink.className = "sidebar-link block px-4 py-2 text-sm text-slate-700 font-bold cursor-pointer rounded-r-full mr-4 hover:bg-slate-100 transition-colors";
                mainLink.innerText = obj.label || obj.object_name;

                // Active state for standard directory clicks
                if (window.currentActiveObject === obj.object_name && URLState.get().filters.length === 0) {
                    mainLink.classList.add('active');
                }

                // mainLink.onclick = (e) => {
                //     e.preventDefault();
                //     document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
                //     mainLink.classList.add('active');
                //     URLState.set({ object: obj.object_name, view: 'list', filters: [] });
                //     // window.initApp(obj.object_name, 'list');
                //     // mainLink.onclick = () => initRouter(objectName, viewName);
                //     mainLink.onclick = () => initRouter(obj.object_name, 'list');
                // };

                mainLink.onclick = (e) => {
                    e.preventDefault();
                    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
                    mainLink.classList.add('active');
                    URLState.set({ object: obj.object_name, view: 'list', filters: [] });
                    
                    // CALL the function immediately
                    initRouter(obj.object_name, 'list');
                };

                directoryNav.appendChild(mainLink);

                // 2. EXTRACT & RENDER WORKSPACE VIEWS
                if (obj.saved_views && obj.saved_views.length > 0) {
                    obj.saved_views.forEach(view => {
                        hasWorkspaceItems = true;
                        const viewLink = document.createElement('a');
                        viewLink.href = "#";

                        // Check if this specific filtered view is active in the URL
                        const isActiveView = window.currentActiveObject === obj.object_name &&
                            URLState.get().view === view.view_type &&
                            JSON.stringify(URLState.get().filters) === JSON.stringify(view.filters);

                        viewLink.className = `sidebar-link block px-4 py-2.5 text-sm font-semibold cursor-pointer rounded-r-full mr-4 transition-colors ${isActiveView ? 'active' : 'text-slate-600 hover:bg-slate-100 hover:text-indigo-600'}`;

                        // Render with a subtle subtitle indicating the parent object (e.g. Critical Patients • Patient)
                        viewLink.innerHTML = `
                            ${view.tab_label || view.view_type}
                            <span class="block text-[10px] font-medium text-slate-400 mt-0.5">${obj.label || obj.object_name}</span>
                        `;

                        viewLink.onclick = (e) => {
                            e.preventDefault();
                            document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
                            viewLink.classList.add('active');
                            URLState.set({ object: obj.object_name, view: view.view_type, filters: view.filters });
                            // window.initApp(obj.object_name, view.view_type);
                            // Replace window.initApp with the new decoupled router
                            initRouter(obj.object_name, view.view_type);
                        };
                        workspaceNav.appendChild(viewLink);
                    });
                }
            });

            if (!hasWorkspaceItems) {
                workspaceNav.innerHTML = '<div class="px-4 py-2 text-xs text-slate-400 italic">No pinned tasks.</div>';
            }

        } else {
            directoryNav.innerHTML = '<div class="px-4 py-2 text-sm text-slate-400">No objects accessible.</div>';
            workspaceNav.innerHTML = '<div class="px-4 py-2 text-xs text-slate-400 italic">No pinned tasks.</div>';
            if (typeof Dashboard !== 'undefined') Dashboard.load();
        }
    } catch (error) {
        console.error("Sidebar Error:", error);
    }
}