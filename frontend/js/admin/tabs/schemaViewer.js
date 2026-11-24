// js/admin/tabs/schemaViewer.js

import { fetchBlueprint, createValidationRuleAPI, updateValidationRuleAPI } from '../../services/api.js';
import { renderComponent } from '../../ui_render.js';

// ===================================================
// 1. VALIDATION BUILDER
// ===================================================
export async function renderValidationBuilder(container, objectName) {
    container.innerHTML = `<div class="animate-pulse text-slate-400 p-4 font-medium">Loading validation rules for ${objectName}...</div>`;

    try {
        const schema = await fetchBlueprint(objectName);
        const existingRules = schema.validation_rules || [];

        container.innerHTML = `
            <div class="flex flex-col gap-8">
                <!-- Top Action Bar -->
                <div class="flex justify-between items-center">
                    <div>
                        <h3 class="text-xl font-bold tracking-tight text-slate-800">Validation Rules</h3>
                        <p class="text-sm text-slate-500 font-medium mt-0.5">Conditions that must evaluate to False for a record to save.</p>
                    </div>
                    <button id="btn-new-rule" class="bg-indigo-600 text-white px-5 py-2.5 rounded-lg hover:bg-indigo-700 font-semibold text-sm transition-all shadow-md shadow-indigo-600/20 flex items-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                        New Rule
                    </button>
                </div>

                <!-- New Rule Form (Hidden by default) -->
                <div id="new-rule-panel" class="hidden bg-white/60 backdrop-blur-md p-6 rounded-xl border border-slate-200/80 shadow-sm">
                    <form id="val-form">
                        <div class="mb-5">
                            <label class="block text-[13px] font-semibold text-slate-700 mb-1.5">Rule ID (API Name)</label>
                            <input type="text" id="val-id" required class="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-shadow outline-none text-sm font-mono" placeholder="e.g., VR_AMOUNT_POSITIVE">
                        </div>
                        <div class="mb-5">
                            <label class="block text-[13px] font-semibold text-slate-700 mb-1.5">Error Condition Expression (Formula)</label>
                            <textarea id="val-expr" required rows="3" class="w-full p-4 border border-slate-300 rounded-lg font-mono text-[13px] leading-relaxed focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-shadow outline-none bg-slate-50/50" placeholder="e.g., Status == 'Discharged' and Amount <= 0"></textarea>
                        </div>
                        <div class="mb-6">
                            <label class="block text-[13px] font-semibold text-slate-700 mb-1.5">Error Message</label>
                            <input type="text" id="val-msg" required class="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-shadow outline-none text-sm" placeholder="e.g., You cannot discharge a patient with a zero balance.">
                        </div>

                        <button type="submit" class="bg-slate-800 text-white px-6 py-2.5 rounded-lg hover:bg-slate-900 font-semibold text-sm transition-colors shadow-sm">Deploy Rule to ${objectName}</button>
                    </form>
                    <div id="val-alert" class="mt-5 text-sm hidden font-medium"></div>
                </div>

                <!-- Existing Rules DataGrid Container -->
                <div id="rules-grid-container" class="bg-white border border-slate-200/80 rounded-xl shadow-sm overflow-hidden"></div>
            </div>
        `;

        const gridReadyRules = existingRules.map(rule => ({
            "Rule Name": rule.rule_id,
            "Condition": rule.error_condition_expr,
            "Error Message": rule.error_message
        }));

        const gridSchema = {
            type: "DataGrid",
            dataSource: "ValidationRules",
            data: gridReadyRules,
            columns: ["Rule Name", "Condition", "Error Message"],
            linkColumn: "Rule Name",
            hideFilters: true,
            onLinkClick: (ruleName, fullRowData) => {
                const panel = document.getElementById('new-rule-panel');
                panel.classList.remove('hidden');

                const idInput = document.getElementById('val-id');
                idInput.value = ruleName;
                idInput.readOnly = true; 
                idInput.classList.add('bg-slate-100', 'cursor-not-allowed', 'text-slate-500');

                document.getElementById('val-expr').value = fullRowData['Condition'];
                document.getElementById('val-msg').value = fullRowData['Error Message'];

                const btn = document.querySelector('#val-form button[type="submit"]');
                btn.textContent = 'Update Rule';
                btn.classList.replace('bg-slate-800', 'bg-amber-500');
                btn.classList.replace('hover:bg-slate-900', 'hover:bg-amber-600');
                
                panel.scrollIntoView({ behavior: 'smooth' });
            }
        };
        
        const gridContainer = document.getElementById('rules-grid-container');
        gridContainer.appendChild(renderComponent(gridSchema));

        document.getElementById('btn-new-rule').addEventListener('click', () => {
            document.getElementById('new-rule-panel').classList.toggle('hidden');
        });

        document.getElementById('val-form').addEventListener('submit', (e) => createValidationRule(e, objectName));

    } catch (err) {
        container.innerHTML = `<div class="text-rose-500 p-4 font-medium">Failed to load validation rules: ${err.message}</div>`;
    }
}

async function createValidationRule(e, objectName) {
    e.preventDefault();

    const idInput = document.getElementById('val-id');
    const ruleId = idInput.value;
    const isUpdateMode = idInput.readOnly;

    let payload;
    if (isUpdateMode) {
        payload = {
            error_condition_expr: document.getElementById('val-expr').value,
            error_message: document.getElementById('val-msg').value
        };
    } else {
        payload = {
            rule_id: ruleId,
            error_condition_expr: document.getElementById('val-expr').value,
            error_message: document.getElementById('val-msg').value
        };
    }

    const msgEl = document.getElementById('val-alert');
    msgEl.classList.remove('hidden');
    msgEl.textContent = "Saving...";
    msgEl.className = "mt-5 text-sm block p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 font-medium";

    try {
        if (isUpdateMode) {
            await updateValidationRuleAPI(objectName, ruleId, payload);
            msgEl.textContent = "Validation rule updated successfully.";
        } else {
            await createValidationRuleAPI(objectName, payload);
            msgEl.textContent = "Validation rule created successfully.";
        }

        msgEl.className = "mt-5 text-sm block p-3.5 rounded-lg bg-emerald-50/50 border border-emerald-200 text-emerald-700 font-medium";
        document.getElementById('val-form').reset();

        idInput.readOnly = false;
        idInput.classList.remove('bg-slate-100', 'cursor-not-allowed', 'text-slate-500');
        
        const btn = document.querySelector('#val-form button[type="submit"]');
        btn.textContent = `Deploy Rule to ${objectName}`;
        btn.classList.replace('bg-amber-500', 'bg-slate-800');
        btn.classList.replace('hover:bg-amber-600', 'hover:bg-slate-900');

        setTimeout(() => {
            renderValidationBuilder(e.target.closest('.flex-col').parentElement, objectName);
        }, 1000);

    } catch (err) {
        msgEl.textContent = err.message || "Network error occurred.";
        msgEl.className = "mt-5 text-sm block p-3.5 rounded-lg bg-rose-50/50 border border-rose-200 text-rose-700 font-medium";
    }
}


// ===================================================
// 2. SCHEMA VIEWER (DATA DICTIONARY)
// ===================================================
export async function renderSchemaViewer(container) {
    container.innerHTML = `<div class="animate-pulse text-slate-400 p-8 font-medium">Loading objects...</div>`;

    try {
        const data = await fetchObjectsList();
        const objects = data.objects || [];

        let options = objects.map(o => `<option value="${o.object_name}">${o.object_name}</option>`).join("");

        container.innerHTML = `
            <div class="max-w-5xl flex flex-col gap-8">
                <div>
                    <h2 class="text-xl font-bold tracking-tight text-slate-800">Schema Viewer</h2>
                    <p class="text-sm text-slate-500 font-medium mt-0.5">Inspect the complete Data Dictionary, field configurations, and attached automations for an Object.</p>
                </div>

                <div class="flex gap-4 items-end bg-white/60 backdrop-blur-md p-6 rounded-xl border border-slate-200/80 shadow-sm">
                    <div class="w-72">
                        <label class="block text-[13px] font-semibold text-slate-700 mb-1.5">Select Object Blueprint</label>
                        <select id="schema-obj" class="w-full p-2.5 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-shadow outline-none text-sm font-medium">
                            <option value="">-- Select Object --</option>
                            ${options}
                        </select>
                    </div>
                </div>

                <div id="schema-container" class="hidden flex-col gap-8">
                    <!-- Tables Placeholder -->
                    <div id="schema-tables-placeholder" class="bg-white border border-slate-200/80 rounded-xl shadow-sm p-1">
                        <table class="w-full text-left border-collapse"><tbody id="schema-fields-body"></tbody></table>
                        <table class="w-full text-left border-collapse"><tbody id="schema-rules-body"></tbody></table>
                        <table class="w-full text-left border-collapse"><tbody id="schema-flows-body"></tbody></table>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('schema-obj').addEventListener('change', fetchSchemaDetails);

    } catch (err) {
        container.innerHTML = `<div class="text-rose-500 p-4 font-medium">Failed to load objects.</div>`;
    }
}

async function fetchSchemaDetails() {
    const objectName = document.getElementById('schema-obj').value;
    const container = document.getElementById('schema-container');

    if (!objectName) {
        container.classList.add('hidden');
        return;
    }

    try {
        const schema = await fetchBlueprint(objectName);

        // Standard logic for rendering schema.fields, schema.validation_rules, and schema.flows remains here
        // [Existing Table Rendering Logic]

        container.classList.remove('hidden');
        container.classList.add('flex');
    } catch (err) {
        alert("Failed to fetch schema details: " + err.message);
    }
}