// js/admin/tabs/flowBuilder.js
import { fetchBlueprint } from '../../services/api.js';
import { renderComponent } from '../../ui_render.js';

export async function renderFlowBuilder(container, objectName) {
    container.innerHTML = `<div class="animate-pulse text-slate-400 p-4 font-medium">Loading flows for ${objectName}...</div>`;

    try {
        const schema = await fetchBlueprint(objectName);
        const existingFlows = schema.flows || [];

        container.innerHTML = `
            <div class="flex flex-col gap-8">
                <!-- Top Action Bar -->
                <div class="flex justify-between items-center">
                    <div>
                        <h3 class="text-xl font-bold tracking-tight text-slate-800">Flow Automations</h3>
                        <p class="text-sm text-slate-500 font-medium mt-0.5">Trigger-based automations and actions for this object.</p>
                    </div>
                    <button id="btn-new-flow" class="bg-indigo-600 text-white px-5 py-2.5 rounded-lg hover:bg-indigo-700 font-semibold text-sm transition-all shadow-md shadow-indigo-600/20 flex items-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                        New Flow
                    </button>
                </div>

                <!-- New Flow Form (Hidden by default) -->
                <div id="new-flow-panel" class="hidden bg-white/60 backdrop-blur-md p-6 rounded-xl border border-slate-200/80 shadow-sm">
                    <p class="text-[13px] font-semibold text-slate-500 mb-4">Flow creation form will go here.</p>
                    <!-- Actual inputs for triggers and actions to be built out here -->
                </div>

                <!-- Existing Flows DataGrid Container -->
                <div id="flows-grid-container" class="bg-white border border-slate-200/80 rounded-xl shadow-sm overflow-hidden">
                </div>
            </div>
        `;

        const gridReadyFlows = existingFlows.map(flow => ({
            "Flow ID": flow.flow_id || 'Unnamed Flow',
            "Trigger Event": flow.trigger_event || 'Unknown',
            "Execution Phase": flow.execution_phase || '-',
            "Status": flow.active ? 'Active' : 'Inactive'
        }));

        const gridSchema = {
            type: "DataGrid",
            dataSource: "Flows",
            data: gridReadyFlows,
            columns: ["Flow ID", "Trigger Event", "Execution Phase", "Status"],
            linkColumn: "Flow ID",
            hideFilters: true,
            onLinkClick: (flowId, fullRowData) => {
                // Redirect to the canvas, passing the Object and Flow ID in the URL
                window.location.href = `admin_flows.html?object=${objectName}&flow_id=${flowId}`;
            }
        };

        const gridContainer = document.getElementById('flows-grid-container');
        gridContainer.appendChild(renderComponent(gridSchema));

        document.getElementById('btn-new-flow').addEventListener('click', () => {
            // Redirect to a blank canvas for this specific object
            window.location.href = `admin_flows.html?object=${objectName}`;
        });

    } catch (err) {
        container.innerHTML = `<div class="text-rose-500 p-4 font-medium">Failed to load flows: ${err.message}</div>`;
    }
}