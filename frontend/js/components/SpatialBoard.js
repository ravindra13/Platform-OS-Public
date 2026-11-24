// js/components/SpatialBoard.js
import { fetchQuery, executeAction } from '../services/api.js';
import { renderLoading, renderError } from '../utils/ui.js';
import { FilterBuilder } from './FilterBuilder.js';

export const SpatialBoard = (schema) => {
    const mainContainer = document.createElement('div');
    mainContainer.className = "flex flex-col gap-4 h-full w-full min-h-[600px]";

    let currentData = [];
    let activeFilters = schema.filters || [];

    // 1. Filter Support
    const filterComponent = FilterBuilder(schema, (newFilters) => {
        activeFilters = newFilters;
        fetchTableData();
    });
    mainContainer.appendChild(filterComponent);

    // 2. The Spatial Canvas (Responsive Dot Grid)
    const canvas = document.createElement('div');
    canvas.className = "relative flex-1 w-full bg-slate-50 border border-slate-200 rounded-xl overflow-hidden bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:24px_24px] shadow-inner";

    // Optional: Add a background image if defined in metadata
    if (schema.background_image_url) {
        canvas.style.backgroundImage = `url('${schema.background_image_url}')`;
        canvas.style.backgroundSize = 'contain';
        canvas.style.backgroundRepeat = 'no-repeat';
        canvas.style.backgroundPosition = 'center';
    }
    mainContainer.appendChild(canvas);

    // 3. Handle Drop Events on the Canvas
    canvas.addEventListener('dragover', e => {
        e.preventDefault(); // Required to allow dropping
    });

    canvas.addEventListener('drop', async e => {
        e.preventDefault();
        const recordId = e.dataTransfer.getData('text/plain');
        const cardEl = document.getElementById(`spatial-card-${recordId}`);
        if (!cardEl) return;

        // Calculate new position as a percentage of the canvas size
        const rect = canvas.getBoundingClientRect();
        // Adjust for where the user clicked on the card (centering it roughly)
        const xPercent = Math.max(0, Math.min(100, ((e.clientX - rect.left - 50) / rect.width) * 100));
        const yPercent = Math.max(0, Math.min(100, ((e.clientY - rect.top - 25) / rect.height) * 100));

        // Optimistically update UI
        cardEl.style.left = `${xPercent}%`;
        cardEl.style.top = `${yPercent}%`;

        try {
            const updatePayload = {
                "Id": recordId,
                [schema.x_axis_field]: xPercent,
                [schema.y_axis_field]: yPercent
            };
            await executeAction(schema.dataSource, [updatePayload]);
        } catch (error) {
            alert(`Failed to save new location: ${error.message}`);
            fetchTableData(); // Revert on failure
        }
    });

    // 4. Data Fetching
    const fetchTableData = async () => {
        renderLoading(canvas, "Loading Spatial Data...");
        try {
            // Ensure we pull the coordinate fields and the status color field
            const queryFields = [...new Set([
                ...schema.cardFields,
                'Id',
                schema.x_axis_field,
                schema.y_axis_field,
                schema.status_color_field
            ].filter(Boolean))];

            currentData = await fetchQuery(schema.dataSource, queryFields, activeFilters);
            renderNodes();
        } catch (error) {
            renderError(canvas, "Failed to load spatial layout.");
        }
    };

    // 5. Render Nodes
    const renderNodes = () => {
        canvas.innerHTML = ""; // Clear canvas

        currentData.forEach(row => {
            const node = document.createElement('div');
            node.id = `spatial-card-${row.Id}`;
            node.draggable = true;
        // Default to center if coordinates are missing
        const x = row[schema.x_axis_field] || 50;
        const y = row[schema.y_axis_field] || 50;

        node.style.position = 'absolute';
        node.style.left = `${x}%`;
        node.style.top = `${y}%`;

        // Simple status coloring logic (can be expanded based on metadata)
        const status = row[schema.status_color_field] || "";
        let colorClass = 'bg-white border-slate-300 text-slate-700';
        if (status === 'Occupied') colorClass = 'bg-rose-50 border-rose-300 text-rose-800';
        if (status === 'Available') colorClass = 'bg-emerald-50 border-emerald-300 text-emerald-800';

        node.className = `w-32 p-2 rounded-lg border-2 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow text-xs ${colorClass}`;

        node.addEventListener('dragstart', e => {
            e.dataTransfer.setData('text/plain', row.Id);
        });

        // --- NEW: QUICK VIEW POPOVER ROUTING ---
        // Mark the node so the global listener knows this click is allowed to open a popover
        node.dataset.quickViewTrigger = "true";

        node.addEventListener('click', (e) => {
            // Stop drag-and-drop from interfering with the click
            e.preventDefault();
            e.stopPropagation();
        // Open the floating popover right at the mouse cursor
        if (typeof openQuickView === 'function') {
            openQuickView(schema.dataSource, row.Id, e);
        }
    });

    // Build Node HTML
    let html = `<div class="font-bold truncate pb-1 border-b border-inherit mb-1">${row.Id}</div>`;
    schema.cardFields.forEach(col => {
        if (col === 'Id') return;
        html += `<div class="truncate opacity-90">${col}: ${row[col] || '-'}</div>`;
    });
    node.innerHTML = html;

    canvas.appendChild(node);
});
};

fetchTableData();
return mainContainer;
};
