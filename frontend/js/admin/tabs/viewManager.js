// js/admin/tabs/viewManager.js
import { fetchBlueprint, updateObjectView } from '../../services/api.js';
import { renderComponent } from '../../ui_render.js';

export async function renderViewManager(container, objectName) {
    container.innerHTML = `<div class="animate-pulse text-slate-400 p-4 font-medium">Loading views for ${objectName}...</div>`;

    try {
        const schema = await fetchBlueprint(objectName);

        container.innerHTML = `
            <div class="flex flex-col gap-8">
                <!-- Header -->
                <div class="flex justify-between items-center">
                    <div>
                        <h3 class="text-xl font-bold tracking-tight text-slate-800">Views & Layouts</h3>
                        <p class="text-sm text-slate-500 font-medium mt-0.5">Manage system default layouts and custom user views.</p>
                    </div>
                </div>

                <!-- 1. SYSTEM LAYOUTS SECTION -->
                <div>
                    <h4 class="text-md font-bold tracking-tight text-slate-700 mb-3 border-b border-slate-100 pb-2">System Layout Defaults</h4>
                    <div id="system-layouts-container" class="bg-white border border-slate-200/80 rounded-xl shadow-sm overflow-hidden"></div>
                </div>

                <!-- 2. CUSTOM SAVED VIEWS SECTION -->
                <div>
                    <div class="flex justify-between items-center mb-3 border-b border-slate-100 pb-2">
                        <h4 class="text-md font-bold tracking-tight text-slate-700">Custom Saved Views</h4>
                        <button id="btn-new-view" class="text-indigo-600 hover:text-indigo-800 font-bold text-[13px] transition-colors flex items-center gap-1.5">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                            New Custom View
                        </button>
                    </div>
                    <div id="custom-views-container" class="bg-white border border-slate-200/80 rounded-xl shadow-sm overflow-hidden"></div>
                </div>

                <!-- FULLY WIRED EDITOR PANEL -->
                <div id="view-editor-panel" class="hidden bg-white/60 backdrop-blur-md p-6 rounded-xl border border-slate-200/80 shadow-sm mt-2">
                    <form id="view-form">
                        <div class="grid grid-cols-2 gap-5 mb-5">
                            <div>
                                <label class="block text-[13px] font-semibold text-slate-700 mb-1.5">View ID / System Layout Name</label>
                                <input type="text" id="view-id" required class="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-shadow outline-none text-sm font-mono">
                            </div>
                            <div>
                                <label class="block text-[13px] font-semibold text-slate-700 mb-1.5">Tab Label (Display Name)</label>
                                <input type="text" id="view-label" required class="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-shadow outline-none text-sm">
                            </div>
                        </div>
                        <div class="mb-5">
                            <label class="block text-[13px] font-semibold text-slate-700 mb-1.5">View Type</label>
                            <select id="view-type" required class="w-full p-2.5 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-shadow outline-none text-sm font-medium">
                                <option value="list">List (DataGrid)</option>
                                <option value="kanban">Kanban</option>
                                <option value="lookup">Lookup Dialog</option>
                                <option value="detail">Record Detail</option>
                            </select>
                        </div>
                        <div class="mb-6">
                            <label class="block text-[13px] font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                                Configuration (JSON)
                                <span class="text-xs font-normal text-slate-400">Requires valid JSON syntax</span>
                            </label>
                            <textarea id="view-config" required rows="8" class="w-full p-4 border border-slate-300 rounded-lg font-mono text-[13px] leading-relaxed focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-shadow outline-none bg-slate-50/50" placeholder='{\n  "columns": ["Name", "Status"]\n}'></textarea>
                        </div>

                        <div class="flex items-center pt-2 border-t border-slate-200/60">
                            <button type="submit" data-mode="create" class="bg-indigo-600 text-white px-6 py-2.5 rounded-lg hover:bg-indigo-700 font-semibold text-sm transition-all shadow-md shadow-indigo-600/20">Save View</button>
                            <button type="button" id="btn-cancel-view" class="ml-4 text-slate-500 hover:text-slate-800 font-semibold text-sm transition-colors">Cancel</button>
                        </div>
                    </form>
                    <div id="view-alert" class="mt-5 text-sm hidden font-medium"></div>
                </div>
            </div>
        `;

        // --- GRID 1: SYSTEM LAYOUTS ---
        const viewMappings = schema.view_mappings || {};
        const systemViews = Object.keys(viewMappings).map(key => ({
            "Layout Type": key.toUpperCase(),
            "Description": `Default ${key} configuration`,
            "_raw": viewMappings[key]
        }));

        const systemGridSchema = {
            type: "DataGrid",
            dataSource: "SystemLayouts",
            data: systemViews,
            columns: ["Layout Type", "Description"],
            linkColumn: "Layout Type",
            hideFilters: true,
            onLinkClick: (layoutType, row) => {
                const panel = document.getElementById('view-editor-panel');
                panel.classList.remove('hidden');

                const idInput = document.getElementById('view-id');
                idInput.value = `SYSTEM_${layoutType.toLowerCase()}`;
                idInput.readOnly = true;
                idInput.classList.add('bg-slate-100', 'cursor-not-allowed', 'text-slate-500');

                document.getElementById('view-label').value = `System Default: ${layoutType}`;
                document.getElementById('view-type').value = layoutType.toLowerCase();
                document.getElementById('view-config').value = JSON.stringify(row['_raw'], null, 2);

                const btn = document.querySelector('#view-form button[type="submit"]');
                btn.textContent = 'Update System Layout';
                btn.classList.replace('bg-indigo-600', 'bg-amber-500');
                btn.classList.replace('hover:bg-indigo-700', 'hover:bg-amber-600');
                btn.classList.remove('shadow-indigo-600/20');

                panel.scrollIntoView({ behavior: 'smooth' });
            }
        };
        document.getElementById('system-layouts-container').appendChild(renderComponent(systemGridSchema));

        // --- GRID 2: CUSTOM SAVED VIEWS ---
        const savedViews = schema.saved_views || [];
        const customViews = savedViews.map(view => ({
            "View ID": view.view_id || 'Unnamed View',
            "Tab Label": view.tab_label || '-',
            "Type": view.view_type || '-',
            "Visible To": Array.isArray(view.visible_to_roles) ? view.visible_to_roles.join(', ') : 'All Roles',
            "_raw": view
        }));
        const customGridSchema = {
            type: "DataGrid",
            dataSource: "CustomViews",
            data: customViews,
            columns: ["View ID", "Tab Label", "Type", "Visible To"],
            linkColumn: "View ID",
            hideFilters: true,
            onLinkClick: (viewId, row) => {
                const panel = document.getElementById('view-editor-panel');
                panel.classList.remove('hidden');

                const idInput = document.getElementById('view-id');
                idInput.value = viewId;
                idInput.readOnly = true;
                idInput.classList.add('bg-slate-100', 'cursor-not-allowed', 'text-slate-500');

                document.getElementById('view-label').value = row['Tab Label'];
                document.getElementById('view-type').value = row['Type'];

                const { view_id, tab_label, view_type, visible_to_roles, ...configData } = row['_raw'];
                document.getElementById('view-config').value = JSON.stringify(configData, null, 2);

                const btn = document.querySelector('#view-form button[type="submit"]');
                btn.textContent = 'Update Custom View';
                btn.classList.replace('bg-indigo-600', 'bg-amber-500');
                btn.classList.replace('hover:bg-indigo-700', 'hover:bg-amber-600');
                btn.classList.remove('shadow-indigo-600/20');

                panel.scrollIntoView({ behavior: 'smooth' });
            }
        };
        document.getElementById('custom-views-container').appendChild(renderComponent(customGridSchema));

        // --- EVENT LISTENERS ---
        document.getElementById('btn-new-view').addEventListener('click', () => {
            const form = document.getElementById('view-form');
            form.reset();

            const idInput = document.getElementById('view-id');
            idInput.readOnly = false;
            idInput.classList.remove('bg-slate-100', 'cursor-not-allowed', 'text-slate-500');
            document.getElementById('view-config').value = '{\n  "columns": []\n}';

            const btn = form.querySelector('button[type="submit"]');
            btn.textContent = 'Save View';
            btn.classList.replace('bg-amber-500', 'bg-indigo-600');
            btn.classList.replace('hover:bg-amber-600', 'hover:bg-indigo-700');
            btn.classList.add('shadow-indigo-600/20');

            document.getElementById('view-editor-panel').classList.remove('hidden');
        });

        document.getElementById('btn-cancel-view').addEventListener('click', () => {
            document.getElementById('view-editor-panel').classList.add('hidden');
            document.getElementById('view-alert').classList.add('hidden');
        });

        document.getElementById('view-form').addEventListener('submit', async (e) => {
            e.preventDefault();

            const viewIdRaw = document.getElementById('view-id').value;
            const alertEl = document.getElementById('view-alert');

            try {
                let configJson;
                try {
                    configJson = JSON.parse(document.getElementById('view-config').value);
                } catch (jsonErr) {
                    throw new Error("Invalid JSON in Configuration. Please fix syntax errors before saving.");
                }

                const isSystemLayout = viewIdRaw.startsWith('SYSTEM_');
                const layoutName = isSystemLayout ? viewIdRaw.replace('SYSTEM_', "").toLowerCase() : null;

                const payload = {
                    is_system_layout: isSystemLayout,
                    layout_name: layoutName,
                    view_id: isSystemLayout ? null : viewIdRaw,
                    tab_label: document.getElementById('view-label').value,
                    view_type: document.getElementById('view-type').value,
                    config: configJson
                };

                await updateObjectView(objectName, payload);

                alertEl.textContent = "View saved successfully!";
                alertEl.className = "mt-5 text-sm block p-3.5 rounded-lg bg-emerald-50/50 border border-emerald-200 text-emerald-700 font-medium";
                alertEl.classList.remove('hidden');

                setTimeout(() => renderViewManager(container, objectName), 1000);

            } catch (err) {
                alertEl.textContent = err.message || "Network error occurred.";
                alertEl.className = "mt-5 text-sm block p-3.5 rounded-lg bg-rose-50/50 border border-rose-200 text-rose-700 font-medium";
                alertEl.classList.remove('hidden');
            }
        });

    } catch (err) {
        container.innerHTML = `<div class="text-rose-500 p-4 font-medium">Failed to load views: ${err.message}</div>`;
    }
}