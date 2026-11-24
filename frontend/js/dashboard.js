// js/dashboard.js
import { loadUISchema } from './ui_render.js';
import { fetchObjectsList } from './services/api.js';

export const Dashboard = {
    load: async function() {
        const pageHeader = document.getElementById('page-header');
        if (pageHeader) pageHeader.classList.add('hidden');

        const container = document.getElementById('main-content');
        if (container) container.innerHTML = `<div class="p-8 text-slate-500 animate-pulse">Loading Workspace...</div>`;

        try {
            // 1. Fetch real metadata objects from objects_api.py
            const response = await fetchObjectsList();
            const availableObjects = response.objects || [];

            // 2. Map backend objects to UI Card schemas
            const colors = ['indigo', 'rose', 'emerald', 'amber', 'violet', 'sky'];
            const objectCards = availableObjects.map((obj, index) => ({
                type: "ObjectCard",
                label: obj.label,
                object_name: obj.object_name,
                viewsCount: obj.saved_views ? obj.saved_views.length : 0,
                color: colors[index % colors.length]
            }));

            // 3. Build the dynamic dashboard schema
            const dashboardSchema = {
                type: "Container",
                layout: "vertical",
                children: [
                    {
                        type: "Header",
                        title: "Workspace Hub",
                        subtitle: "Select a data object to view or manage its records."
                    },
                    {
                        // Dynamic grid adjusting to how many objects the user has access to
                        type: "Grid",
                        columns: 3,
                        children: objectCards.length > 0 ? objectCards : [
                            {
                                type: "Header", 
                                title: "No Objects Found", 
                                subtitle: "You don't have access to any objects yet." 
                            }
                        ]
                    }
                ]
            };

            // 4. Render the UI
            loadUISchema(dashboardSchema);

        } catch (error) {
            console.error("Dashboard failed to load:", error);
            if (container) container.innerHTML = `<div class="p-8 text-red-500 font-bold">Failed to load workspace: ${error.message}</div>`;
        }
    }
};