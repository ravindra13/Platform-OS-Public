// js/admin/tabs/fieldBuilder.js
import { fetchObjectsList, fetchBlueprint, createObjectField, updateObjectField } from '../../services/api.js';
import { renderComponent } from '../../ui_render.js';

export async function renderFieldBuilder(container, objectName) {
    container.innerHTML = `<div class="animate-pulse text-slate-400 p-4 font-medium">Loading fields for ${objectName}...</div>`;

    try {
        const objData = await fetchObjectsList();
        const options = (objData.objects || []).map(o => `<option value="${o.object_name}">${o.object_name}</option>`).join("");

        const schema = await fetchBlueprint(objectName);
        const existingFields = schema.fields || [];

        // Render the Detail UI
        container.innerHTML = `
            <div class="flex flex-col gap-8">
                <!-- Top Action Bar -->
                <div class="flex justify-between items-center">
                    <div>
                        <h3 class="text-xl font-bold tracking-tight text-slate-800">Fields & Relationships</h3>
                        <p class="text-sm text-slate-500 font-medium mt-0.5">Manage data columns and object lookups.</p>
                    </div>
                    <button id="btn-new-field" class="bg-indigo-600 text-white px-5 py-2.5 rounded-lg hover:bg-indigo-700 font-semibold text-sm transition-all shadow-md shadow-indigo-600/20 flex items-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                        New Field
                    </button>
                </div>

                <!-- New Field Form -->
                <div id="new-field-panel" class="hidden bg-white/60 backdrop-blur-md p-6 rounded-xl border border-slate-200/80 shadow-sm">
                    <form id="field-form">
                        <div class="grid grid-cols-2 gap-5 mb-5">
                            <div>
                                <label class="block text-[13px] font-semibold text-slate-700 mb-1.5">Field Name (API Name)</label>
                                <input type="text" id="field-name" required class="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-shadow outline-none text-sm" placeholder="e.g., TotalAmount">
                            </div>
                            <div>
                                <label class="block text-[13px] font-semibold text-slate-700 mb-1.5">Data Type</label>
                                <select id="field-type" required class="w-full p-2.5 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-shadow outline-none text-sm font-medium">
                                    <option value="STRING">String</option>
                                    <option value="NUMBER">Number</option>
                                    <option value="CURRENCY">Currency</option>
                                    <option value="BOOLEAN">Boolean</option>
                                    <option value="DATETIME">DateTime</option>
                                    <option value="PICKLIST">Picklist</option>
                                    <option value="REFERENCE">Reference (Lookup)</option>
                                    <option value="FORMULA">Formula</option>
                                    <option value="ROLLUP_SUMMARY">Rollup Summary</option>
                                </select>
                            </div>
                        </div>

                        <div class="flex items-center mb-6 bg-slate-50 p-3 rounded-lg border border-slate-200/80">
                            <input type="checkbox" id="field-req" class="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500">
                            <label class="ml-3 text-[13px] font-semibold text-slate-700">Make this a Required Field</label>
                        </div>

                        <!-- Dynamic Config Sections -->
                        <div id="config-reference" class="hidden mb-6 p-5 bg-blue-50/50 rounded-xl border border-blue-100">
                            <label class="block text-[13px] font-semibold text-slate-700 mb-1.5">Target Reference Object</label>
                            <select id="ref-target" class="w-full p-2.5 border border-slate-300 rounded-lg bg-white mb-4 text-sm">${options}</select>
                            
                            <label class="block text-[13px] font-semibold text-slate-700 mb-1.5">Relationship Type</label>
                            <select id="ref-type" class="w-full p-2.5 border border-slate-300 rounded-lg bg-white mb-4 text-sm">
                                <option value="LOOKUP">Lookup</option>
                                <option value="MASTER_DETAIL">Master-Detail</option>
                            </select>
                            
                            <label class="block text-[13px] font-semibold text-slate-700 mb-1.5">Lookup Filter (Optional)</label>
                            <input type="text" id="ref-filter" class="w-full p-2.5 border border-slate-300 rounded-lg text-sm" placeholder="e.g., Doctor.IsActive = True">
                        </div>

                        <div id="config-picklist" class="hidden mb-6 p-5 bg-purple-50/50 rounded-xl border border-purple-100">
                            <label class="block text-[13px] font-semibold text-slate-700 mb-1.5">Allowed Values (Comma separated)</label>
                            <input type="text" id="pick-values" class="w-full p-2.5 border border-slate-300 rounded-lg text-sm" placeholder="e.g., Red, Green, Blue">
                        </div>

                        <div id="config-formula" class="hidden mb-6 p-5 bg-emerald-50/50 rounded-xl border border-emerald-100">
                            <label class="block text-[13px] font-semibold text-slate-700 mb-1.5">Formula Expression</label>
                            <input type="text" id="formula-expr" class="w-full p-2.5 border border-slate-300 rounded-lg text-sm font-mono" placeholder="e.g., BaseFee + TotalTreatmentCost">
                        </div>

                        <div id="config-rollup" class="hidden mb-6 p-5 bg-amber-50/50 rounded-xl border border-amber-100">
                            <div class="grid grid-cols-2 gap-5 mb-4">
                                <div>
                                    <label class="block text-[13px] font-semibold text-slate-700 mb-1.5">Child Object</label>
                                    <select id="rollup-child" class="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-sm">${options}</select>
                                </div>
                                <div>
                                    <label class="block text-[13px] font-semibold text-slate-700 mb-1.5">Relationship Field</label>
                                    <input type="text" id="rollup-rel-field" class="w-full p-2.5 border border-slate-300 rounded-lg text-sm" placeholder="e.g., EncounterId">
                                </div>
                            </div>
                            <div class="grid grid-cols-2 gap-5">
                                <div>
                                    <label class="block text-[13px] font-semibold text-slate-700 mb-1.5">Rollup Operation</label>
                                    <select id="rollup-up" class="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-sm">
                                        <option value="SUM">SUM</option>
                                        <option value="COUNT">COUNT</option>
                                        <option value="MIN">MIN</option>
                                        <option value="MAX">MAX</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-[13px] font-semibold text-slate-700 mb-1.5">Target Field</label>
                                    <input type="text" id="rollup-target" class="w-full p-2.5 border border-slate-300 rounded-lg text-sm" placeholder="e.g., Cost">
                                </div>
                            </div>
                        </div>

                        <button type="submit" class="bg-slate-800 text-white px-6 py-2.5 rounded-lg hover:bg-slate-900 font-semibold text-sm transition-colors shadow-sm mt-2">Save Field to ${objectName}</button>
                    </form>
                    <div id="field-msg" class="mt-5 text-sm hidden font-medium"></div>
                </div>

                <!-- NEW: DataGrid Container -->
                <div id="fields-grid-container" class="bg-white border border-slate-200/80 rounded-xl shadow-sm overflow-hidden"></div>
            </div>
        `;

        const gridContainer = document.getElementById('fields-grid-container');
        const gridReadyFields = existingFields.map(f => ({
            "Field Name": f.field_name,
            "Data Type": f.data_type,
            "Required": f.required ? "Yes" : "No"
        }));

        const gridSchema = {
            type: "DataGrid",
            dataSource: "Fields",
            data: gridReadyFields,
            columns: ["Field Name", "Data Type", "Required"],
            hideFilters: true,
            linkColumn: "Field Name",
            onLinkClick: (fieldName, fullRowData) => {
                const panel = document.getElementById('new-field-panel');
                panel.classList.remove('hidden');

                const nameInput = document.getElementById('field-name');
                nameInput.value = fieldName;
                nameInput.readOnly = true; 
                nameInput.classList.add('bg-slate-100', 'cursor-not-allowed', 'text-slate-500');

                const typeInput = document.getElementById('field-type');
                typeInput.value = fullRowData['Data Type'];
                typeInput.disabled = true; 
                typeInput.classList.add('bg-slate-100', 'cursor-not-allowed', 'text-slate-500');
                document.getElementById('field-req').checked = fullRowData['Required'] === 'Yes';

                const btn = document.querySelector('#field-form button[type="submit"]');
                btn.textContent = 'Update Field';
                btn.dataset.mode = 'update';
                btn.classList.replace('bg-slate-800', 'bg-amber-500');
                btn.classList.replace('hover:bg-slate-900', 'hover:bg-amber-600');

                panel.scrollIntoView({ behavior: 'smooth' });
            }
        };

        gridContainer.appendChild(renderComponent(gridSchema));

        document.getElementById('btn-new-field').addEventListener('click', () => {
            document.getElementById('new-field-panel').classList.toggle('hidden');
        });

        document.getElementById('field-type').addEventListener('change', toggleFieldConfig);
        document.getElementById('field-form').addEventListener('submit', (e) => handleCreateField(e, objectName));

    } catch (err) {
        container.innerHTML = `<div class="text-rose-500 p-4 font-medium">Failed to load fields: ${err.message}</div>`;
    }
}

function toggleFieldConfig() {
    const type = document.getElementById('field-type').value;
    document.getElementById('config-reference').style.display = type === 'REFERENCE' ? 'block' : 'none';
    document.getElementById('config-picklist').style.display = type === 'PICKLIST' ? 'block' : 'none';
    document.getElementById('config-formula').style.display = type === 'FORMULA' ? 'block' : 'none';
    document.getElementById('config-rollup').style.display = type === 'ROLLUP_SUMMARY' ? 'block' : 'none';
}

async function handleCreateField(e, objectName) {
    e.preventDefault();

    const btn = e.target.querySelector('button[type="submit"]');
    const isUpdate = btn.dataset.mode === 'update';
    const fieldName = document.getElementById('field-name').value;
    const msgEl = document.getElementById('field-msg');

    try {
        if (isUpdate) {
            const updatePayload = {
                required: document.getElementById('field-req').checked
            };
            await updateObjectField(objectName, fieldName, updatePayload);
            msgEl.textContent = "Field updated successfully!";
        } else {
            const type = document.getElementById('field-type').value;
            const payload = {
                field_name: fieldName,
                data_type: type,
                required: document.getElementById('field-req').checked
            };
            await createObjectField(objectName, payload);
            msgEl.textContent = "Field created successfully!";
        }

        msgEl.className = "mt-5 text-sm block p-3.5 rounded-lg bg-emerald-50/50 border border-emerald-200 text-emerald-700 font-medium";
        msgEl.classList.remove('hidden');

        e.target.reset();
        document.getElementById('field-name').readOnly = false;
        document.getElementById('field-type').disabled = false;
        document.getElementById('field-name').classList.remove('bg-slate-100', 'cursor-not-allowed', 'text-slate-500');
        document.getElementById('field-type').classList.remove('bg-slate-100', 'cursor-not-allowed', 'text-slate-500');
        btn.textContent = `Save Field to ${objectName}`;
        btn.dataset.mode = 'create';
        btn.classList.replace('bg-amber-500', 'bg-slate-800');
        btn.classList.replace('hover:bg-amber-600', 'hover:bg-slate-900');

        setTimeout(() => renderFieldBuilder(e.target.closest('.p-6'), objectName), 1000);

    } catch (err) {
        msgEl.textContent = err.message || "Network error occurred.";
        msgEl.className = "mt-5 text-sm block p-3.5 rounded-lg bg-rose-50/50 border border-rose-200 text-rose-700 font-medium";
        msgEl.classList.remove('hidden');
    }
}