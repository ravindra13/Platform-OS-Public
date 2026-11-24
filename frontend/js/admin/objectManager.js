// frontend/js/admin/objectManager.js
import { createSystemObject, fetchObjectsList } from '../services/api.js';
import { renderComponent } from '../ui_render.js';
import { renderObjectDetail } from './objectDetail.js';

export async function renderObjectManager(container) {
    // Build the Master Shell
    container.innerHTML = `
        <div class="max-w-6xl mx-auto flex flex-col h-full">
            <div class="flex justify-between items-center mb-8">
                <div>
                    <h2 class="text-2xl font-bold tracking-tight text-slate-800 mb-1">Object Manager</h2>
                    <p class="text-sm text-slate-500 font-medium">Manage metadata blueprints across the platform schema.</p>
                </div>
                <button id="btn-new-object" class="bg-indigo-600 text-white px-5 py-2.5 rounded-lg hover:bg-indigo-700 font-semibold text-sm transition-all shadow-md shadow-indigo-600/20 flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                    New Object
                </button>
            </div>

            <!-- Creation Form -->
            <div id="new-object-panel" class="hidden bg-white/60 backdrop-blur-md p-6 rounded-xl border border-slate-200/80 mb-8 shadow-sm">
                <form id="obj-form" class="flex gap-5 items-end">
                    <div class="flex-1">
                        <label class="block text-[13px] font-semibold text-slate-700 mb-1.5">Object Name (API Name)</label>
                        <input type="text" id="obj-name" required class="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-shadow outline-none text-sm" placeholder="e.g., Invoice">
                    </div>
                    <div class="flex-1">
                        <label class="block text-[13px] font-semibold text-slate-700 mb-1.5">Label (Display Name)</label>
                        <input type="text" id="obj-label" required class="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-shadow outline-none text-sm" placeholder="e.g., Customer Invoice">
                    </div>
                    <button type="submit" class="bg-slate-800 text-white px-6 py-2.5 rounded-lg hover:bg-slate-900 font-semibold text-sm transition-colors shadow-sm">Deploy Object</button>
                </form>
                <div id="obj-msg" class="mt-4 text-sm hidden font-medium"></div>
            </div>

            <!-- Master List DataGrid Container -->
            <div id="object-grid-container" class="flex-1 bg-white border border-slate-200/80 rounded-xl shadow-sm overflow-hidden">
                <!-- DataGrid dynamically mounts here -->
            </div>
        </div>
    `;

    document.getElementById('btn-new-object').addEventListener('click', () => {
        document.getElementById('new-object-panel').classList.toggle('hidden');
    });

    document.getElementById('obj-form').addEventListener('submit', handleCreateObject);

    const gridContainer = document.getElementById('object-grid-container');
    gridContainer.innerHTML = `<div class="p-8 text-center text-slate-400 font-medium">Loading Schema...</div>`;

    try {
        const objData = await fetchObjectsList();
        const objects = objData.objects || [];

        const gridReadyData = objects.map(obj => ({
            ObjectName: obj.object_name,
            CreatedDate: new Date().toLocaleDateString() 
        }));

        const gridSchema = {
            type: "DataGrid",
            dataSource: "Metadata",
            data: gridReadyData,
            columns: ["ObjectName", "CreatedDate"],
            linkColumn: "ObjectName",
            hideToolbar: true,
            hideFilters: true,
            onLinkClick: (objectName, fullRowData) => {
                renderObjectDetail(container, objectName, () => {
                    renderObjectManager(container); 
                });
            }
        };

        gridContainer.innerHTML = "";
        gridContainer.appendChild(renderComponent(gridSchema));

    } catch (err) {
        gridContainer.innerHTML = `<div class="p-8 text-center text-rose-500 font-medium">Failed to load objects.</div>`;
    }
}

async function handleCreateObject(e) {
    e.preventDefault();
    const payload = {
        object_name: document.getElementById('obj-name').value,
        label: document.getElementById('obj-label').value
    };
    const msgEl = document.getElementById('obj-msg');

    try {
        const data = await createSystemObject(payload);
        msgEl.textContent = data.message || "Object created successfully!";
        msgEl.className = "mt-5 text-sm block p-3.5 rounded-lg bg-emerald-50/50 border border-emerald-200 text-emerald-700 font-medium";
        document.getElementById('obj-form').reset();
    } catch (err) {
        msgEl.textContent = err.message || "Network error occurred.";
        msgEl.className = "mt-5 text-sm block p-3.5 rounded-lg bg-rose-50/50 border border-rose-200 text-rose-700 font-medium";
    }
}