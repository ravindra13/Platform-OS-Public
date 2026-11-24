// frontend/js/admin/security.js
import { fetchObjectsList, fetchBlueprint, fetchProfile, fetchQuery, saveObjectPermissions, saveFieldPermissions } from '../services/api.js';
import { Tabs } from '../components/Tabs.js';

// ===================================================
// // MASTER SECURITY DASHBOARD
// ===================================================
export function renderSecurityDashboard(container) {
    container.innerHTML = `
        <div class="max-w-6xl mx-auto flex flex-col h-full gap-6">
            <div class="flex justify-between items-start bg-gradient-to-r from-slate-900 to-slate-800 border border-slate-700/50 text-white p-6 rounded-xl shadow-lg shadow-slate-900/10">
                <div>
                    <h2 class="text-3xl font-bold tracking-tight mb-1">Security & Access Control</h2>
                    <p class="text-sm text-indigo-200/80 font-mono tracking-wide">Manage Profile-Based Zero Trust Policies</p>
                </div>
            </div>

            <div id="security-tabs-container" class="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-slate-200/80 min-h-[500px]">
            </div>
        </div>
    `;

    const tabsContainer = document.getElementById('security-tabs-container');

    const tabsSchema = {
        tabs: [
            { label: "Object Permissions (CRUD)", content: { type: "crud" } },
            { label: "Field-Level Security (FLS)", content: { type: "fls" } }
        ]
    };

    const tabRenderer = (contentDef) => {
        const panel = document.createElement('div');
        panel.className = "p-6";

        if (contentDef.type === "crud") renderCrudMatrix(panel);
        if (contentDef.type === "fls") renderFlsMatrix(panel);

        return panel;
    };

    tabsContainer.appendChild(Tabs(tabsSchema, tabRenderer));
}

// ===================================================
// // OBJECT SECURITY MATRIX (CRUD)
// ===================================================
async function renderCrudMatrix(container) {
    container.innerHTML = `<div class="p-8 text-center text-slate-400 font-medium">Loading Profile Matrix...</div>`;

    try {
        const profiles = await fetchQuery('Profile', ['Id', 'Name']);
        const profileOptions = profiles.map(p => `<option value="${p.Id}">${p.Name || p.Id} (${p.Id})</option>`).join("");

        container.innerHTML = `
            <div class="max-w-4xl">
                <h2 class="text-2xl font-bold tracking-tight text-slate-800 mb-1">Profile Permissions</h2>
                <p class="text-sm text-slate-500 mb-8 font-medium">Manage Object-Level Security (CRUD) matrix for specific profiles.</p>
                
                <div class="flex gap-4 mb-8 items-end bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm">
                    <div class="w-72">
                        <label class="block text-[13px] font-semibold text-slate-700 mb-1.5">Target Profile</label>
                        <select id="prof-id" class="w-full p-2.5 border border-slate-300 rounded-lg bg-slate-50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm font-medium text-slate-800">
                            ${profileOptions}
                        </select>
                    </div>
                    <button id="btn-load-matrix" class="bg-indigo-600 text-white px-5 py-2.5 rounded-lg hover:bg-indigo-700 font-semibold text-sm transition-all shadow-md shadow-indigo-600/20">Load Matrix</button>
                </div>
                <div id="matrix-container" class="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-sm hidden"></div>
            </div>
        `;

        document.getElementById('btn-load-matrix').addEventListener('click', fetchProfileMatrix);

    } catch (err) {
        container.innerHTML = `<div class="p-8 text-center text-rose-500 font-medium">Failed to load profiles: ${err.message}</div>`;
    }
}

async function fetchProfileMatrix() {
    const profileId = document.getElementById('prof-id').value;
    const container = document.getElementById('matrix-container');
    container.innerHTML = `<div class="p-8 text-center text-slate-400 font-medium">Loading ${profileId}...</div>`;
    container.style.display = 'block';

    try {
        const profile = await fetchProfile(profileId);
        const objRes = await fetchObjectsList();
        const objects = objRes.objects || [];

        let rows = "";
        objects.forEach(obj => {
            const name = obj.object_name;
            const perms = (profile.object_permissions && profile.object_permissions[name])
                ? profile.object_permissions[name]
                : { allow_read: false, allow_create: false, allow_update: false, allow_delete: false };

            rows += `
                <tr class="border-t border-slate-200/80 hover:bg-slate-50/50 transition-colors">
                    <td class="px-6 py-3.5 text-[13px] font-semibold text-slate-800">${obj.label || name} <span class="text-xs text-slate-400 font-normal ml-1">(${name})</span></td>
                    <td class="px-6 py-3.5 text-center"><input type="checkbox" id="C_${name}" ${perms.allow_create ? 'checked' : ''} class="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"></td>
                    <td class="px-6 py-3.5 text-center"><input type="checkbox" id="R_${name}" ${perms.allow_read ? 'checked' : ''} class="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"></td>
                    <td class="px-6 py-3.5 text-center"><input type="checkbox" id="U_${name}" ${perms.allow_update ? 'checked' : ''} class="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"></td>
                    <td class="px-6 py-3.5 text-center"><input type="checkbox" id="D_${name}" ${perms.allow_delete ? 'checked' : ''} class="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"></td>
                    <td class="px-6 py-3.5 text-right">
                        <button class="save-row-btn text-indigo-600 hover:text-indigo-800 text-[13px] font-bold tracking-wide" data-obj="${name}">Save Row</button>
                    </td>
                </tr>
            `;
        });

        container.innerHTML = `
            <table class="w-full text-left border-collapse">
                <thead class="bg-slate-50/50 border-b border-slate-200/80">
                    <tr>
                        <th class="px-6 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Object</th>
                        <th class="px-6 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">Create</th>
                        <th class="px-6 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">Read</th>
                        <th class="px-6 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">Update</th>
                        <th class="px-6 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">Delete</th>
                        <th class="px-6 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-right">Action</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;

        document.querySelectorAll('.save-row-btn').forEach(btn => {
            btn.addEventListener('click', (e) => saveObjectPerms(profileId, e.target.dataset.obj));
        });

    } catch (err) {
        container.innerHTML = `<div class="p-8 text-center text-rose-500 font-medium">Error: ${err.message}</div>`;
    }
}

async function saveObjectPerms(profileId, objectName) {
    const payload = {
        profile_id: profileId,
        object_name: objectName,
        allow_create: document.getElementById(`C_${objectName}`).checked,
        allow_read: document.getElementById(`R_${objectName}`).checked,
        allow_update: document.getElementById(`U_${objectName}`).checked,
        allow_delete: document.getElementById(`D_${objectName}`).checked
    };

    try {
        await saveObjectPermissions(payload);
        alert(`Permissions saved for ${objectName}`);
    } catch (err) {
        alert(`Error saving permissions: ${err.message}`);
    }
}

// ===================================================
// // FIELD LEVEL SECURITY (FLS) MATRIX
// ===================================================
export async function renderFlsMatrix(container) {
    container.innerHTML = `<div class="animate-pulse text-slate-400 p-8 font-medium">Loading configuration...</div>`;

    try {
        const objRes = await fetchObjectsList();
        const objects = objRes.objects || [];
        const objectOptions = objects.map(o => `<option value="${o.object_name}">${o.label || o.object_name} (${o.object_name})</option>`).join("");

        const profiles = await fetchQuery('Profile', ['Id', 'Name']);
        const profileOptions = profiles.map(p => `<option value="${p.Id}">${p.Name || p.Id} (${p.Id})</option>`).join("");

        container.innerHTML = `
            <div class="max-w-4xl">
                <h2 class="text-2xl font-bold tracking-tight text-slate-800 mb-1">Field-Level Security (FLS)</h2>
                <p class="text-sm text-slate-500 mb-8 font-medium">Control Read and Edit access to specific fields for a given profile.</p>
                <div class="flex gap-4 mb-8 items-end bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm">
                    <div class="w-64">
                        <label class="block text-[13px] font-semibold text-slate-700 mb-1.5">Target Profile</label>
                        <select id="fls-prof-id" class="w-full p-2.5 border border-slate-300 rounded-lg bg-slate-50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm font-medium">
                            ${profileOptions}
                        </select>
                    </div>
                    <div class="w-64">
                        <label class="block text-[13px] font-semibold text-slate-700 mb-1.5">Target Object</label>
                        <select id="fls-obj" class="w-full p-2.5 border border-slate-300 rounded-lg bg-slate-50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm font-medium">
                            <option value="">-- Select Object --</option>
                            ${objectOptions}
                        </select>
                    </div>
                    <button id="btn-load-fls" class="bg-indigo-600 text-white px-5 py-2.5 rounded-lg hover:bg-indigo-700 font-semibold text-sm transition-all shadow-md shadow-indigo-600/20">Load Fields</button>
                </div>
                <div id="fls-container" class="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-sm hidden"></div>
            </div>
        `;

        document.getElementById('btn-load-fls').addEventListener('click', fetchFlsMatrix);

    } catch (err) {
        container.innerHTML = `<div class="text-rose-500 p-8 font-medium">Failed to load configuration: ${err.message}</div>`;
    }
}

async function fetchFlsMatrix() {
    const profileId = document.getElementById('fls-prof-id').value;
    const objectName = document.getElementById('fls-obj').value;
    const container = document.getElementById('fls-container');

    if (!profileId || !objectName) return alert("Please select both a Profile and an Object.");

    container.innerHTML = `<div class="p-8 text-center text-slate-400 font-medium">Fetching schema...</div>`;
    container.style.display = 'block';

    try {
        const schema = await fetchBlueprint(objectName);
        const profile = await fetchProfile(profileId);
        let rows = "";
        const fields = schema.fields || [];
        const lockedFields = ['Id', 'OwnerId', 'CreatedDate', 'CreatedById', 'LastModifiedDate', 'LastModifiedById', 'SystemModstamp'];

        fields.forEach(fieldDef => {
            const fieldName = fieldDef.field_name;
            const fieldKey = `${objectName}.${fieldName}`;

            const perms = (profile.field_permissions && profile.field_permissions[fieldKey])
                ? profile.field_permissions[fieldKey]
                : { allow_read: true, allow_update: true }; 

            const isLocked = lockedFields.includes(fieldName);

            rows += `
                <tr class="border-t border-slate-200/80 hover:bg-slate-50/50 transition-colors">
                    <td class="px-6 py-3.5 text-[13px] font-semibold text-slate-800">
                        ${fieldName}
                        <span class="text-xs text-slate-400 font-normal ml-2">(${fieldDef.data_type || 'STRING'})</span>
                    </td>
                    <td class="px-6 py-3.5 text-center">
                        <input type="checkbox" id="FLS_R_${fieldName}" ${perms.allow_read || isLocked ? 'checked' : ''} ${isLocked ? 'disabled' : ''} class="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 disabled:opacity-50">
                    </td>
                    <td class="px-6 py-3.5 text-center">
                        <input type="checkbox" id="FLS_U_${fieldName}" ${perms.allow_update || isLocked ? 'checked' : ''} ${isLocked ? 'disabled' : ''} class="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 disabled:opacity-50">
                    </td>
                </tr>
            `;
        });
        container.innerHTML = `
            <table class="w-full text-left border-collapse">
                <thead class="bg-slate-50/50 border-b border-slate-200/80">
                    <tr>
                        <th class="px-6 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Field Name</th>
                        <th class="px-6 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">Read Access</th>
                        <th class="px-6 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">Update Access</th>
                    </tr>
                </thead>
                <tbody id="fls-tbody">${rows}</tbody>
            </table>
            <div class="p-5 bg-slate-50/50 border-t border-slate-200/80 flex justify-end">
                <button id="btn-save-fls" class="bg-emerald-600 text-white px-6 py-2.5 rounded-lg hover:bg-emerald-700 font-semibold text-sm transition-all shadow-md shadow-emerald-600/20">Save Field Permissions</button>
            </div>
        `;

        document.getElementById('btn-save-fls').addEventListener('click', () => saveFlsMatrix(profileId, objectName));

    } catch (err) {
        container.innerHTML = `<div class="p-8 text-center text-rose-500 font-medium">Error: ${err.message}</div>`;
    }
}

async function saveFlsMatrix(profileId, objectName) {
    const checkboxes = document.getElementById('fls-tbody').querySelectorAll('input[type="checkbox"]:not(:disabled)');
    let successCount = 0, failCount = 0;
    const processedFields = new Set();

    for (const box of checkboxes) {
        const fieldName = box.id.split('_').slice(2).join('_');
        if (processedFields.has(fieldName)) continue;
        processedFields.add(fieldName);

        const readEl = document.getElementById(`FLS_R_${fieldName}`);
        const updateEl = document.getElementById(`FLS_U_${fieldName}`);

        const payload = {
            profile_id: profileId,
            object_name: objectName,
            field_name: fieldName,
            allow_read: readEl ? readEl.checked : true,
            allow_update: updateEl ? updateEl.checked : true
        };

        try {
            await saveFieldPermissions(payload);
            successCount++;
        } catch (err) {
            failCount++;
        }
    }
    alert(`FLS Save Complete.\nSuccess: ${successCount}\nFailed: ${failCount}`);
}