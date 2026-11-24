// module_builder.js

// 1. STATE: Hold the draft in memory
let currentManifestState = null;

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('build-module-btn').addEventListener('click', handleBuildRequest);
    document.getElementById('deploy-btn').addEventListener('click', deployApprovedModule);
});

async function handleBuildRequest() {
    const promptInput = document.getElementById('module-prompt-input');
    const buildBtn = document.getElementById('build-module-btn');
    const previewContainer = document.getElementById('module-preview-container');
    const promptText = promptInput.value.trim();

    if (!promptText) return;

    buildBtn.disabled = true;
    buildBtn.innerText = "Building...";
    previewContainer.innerHTML = `<div class="flex items-center justify-center h-full text-slate-500 animate-pulse">Architecting module...</div>`;

    try {
        const tenantId = document.getElementById('currentTenant')?.innerText || 'TENANT-ACME';
        const userId = document.getElementById('currentUser')?.innerText || 'USER-ALICE';

        const requestBody = { prompt: promptText };
        if (currentManifestState) requestBody.current_manifest = currentManifestState;

        const response = await fetch('/api/ai/build-module', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-tenant-id': tenantId,
                'x-user-id': userId
            },
            body: JSON.stringify(requestBody)
        });

        const result = await response.json();

        if (response.ok && result.status === "Preview" && result.manifest) {
            currentManifestState = result.manifest;
            renderManifestToUI(currentManifestState);
            document.getElementById('deploy-btn').disabled = false;
            promptInput.value = '';
        } else {
            throw new Error(result.detail || result.message || "Failed to generate module blueprint.");
        }
    } catch (error) {
        previewContainer.innerHTML = `<div class="text-red-500 font-semibold p-4">Error: ${error.message}</div>`;
    } finally {
        buildBtn.disabled = false;
        buildBtn.innerHTML = "Generate / Update Draft";
    }
}

// 5. RENDER LOGIC (Perfectly mapped to the robust schema)
function renderManifestToUI(manifest) {
    const previewContainer = document.getElementById('module-preview-container');
    const formattedJson = JSON.stringify(manifest, null, 2);

    let visualHTML = `<div class="space-y-6 pb-6">`;

    // Render Objects, Fields, and Nested Configurations
    if (manifest.objects && manifest.objects.length > 0) {
        visualHTML += `<h4 class="font-bold text-slate-800 text-lg border-b pb-2">Objects & Schema</h4>`;
        
        manifest.objects.forEach(obj => {
            visualHTML += `
                <div class="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                    <div class="flex items-center gap-3 mb-4 border-b border-slate-100 pb-3">
                        <div class="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg">
                            ${(obj.label || obj.object_name || 'O').charAt(0)}
                        </div>
                        <div class="flex-1">
                            <h5 class="font-bold text-slate-800 text-lg">${obj.label || obj.object_name}</h5>
                            <p class="text-[11px] text-slate-400 font-mono uppercase tracking-wider">API: ${obj.object_name}</p>
                        </div>
                        ${obj.capabilities ? `
                        <div class="flex gap-1 flex-wrap justify-end">
                            ${obj.capabilities.map(cap => `<span class="text-[10px] bg-slate-800 text-white px-2 py-1 rounded shadow-sm">${cap}</span>`).join('')}
                        </div>
                        ` : ''}
                    </div>
                    
                    <!-- Fields List -->
                    <div class="space-y-1 mb-4">
                        <h6 class="text-xs font-bold text-slate-500 uppercase mb-2">Fields</h6>
                        ${(obj.fields || []).map(f => {
                            let extraTag = '';
                            let picklistValues = '';
                            
                            if (f.data_type === 'REFERENCE' && f.target_object) {
                                extraTag = `<span class="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-bold">Links to ${f.target_object}</span>`;
                            } else if (f.data_type === 'PICKLIST' && f.config && f.config.allowed_values) {
                                picklistValues = `<div class="mt-1 flex gap-1 flex-wrap w-full">
                                    ${f.config.allowed_values.map(val => `<span class="text-[9px] font-medium bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">${val}</span>`).join('')}
                                </div>`;
                            } else if (f.data_type === 'FORMULA' || f.data_type === 'ROLLUP_SUMMARY') {
                                extraTag = `<span class="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold truncate max-w-[150px]" title="${f.expression || f.operation}">Auto-Calculated</span>`;
                            }
                            
                            return `
                            <div class="flex flex-col bg-slate-50 p-2.5 rounded-lg text-sm border border-slate-100 hover:border-indigo-200 transition-colors">
                                <div class="flex justify-between items-center w-full">
                                    <div>
                                        <span class="font-semibold text-slate-700">${f.field_name}</span> 
                                        ${f.required ? '<span class="text-red-500 ml-0.5" title="Required">*</span>' : ''}
                                    </div>
                                    <div class="flex items-center gap-2">
                                        ${extraTag}
                                        <span class="text-xs font-mono text-slate-500 bg-slate-200 px-2 py-0.5 rounded">${f.data_type}</span>
                                    </div>
                                </div>
                                ${picklistValues}
                            </div>`;
                        }).join('')}
                    </div>

                    <!-- View Configurations Grid -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-3 border-t border-slate-100">
                        ${obj.view_mappings ? `
                            <div>
                                <h6 class="text-xs font-bold text-slate-500 uppercase mb-2">View Mappings</h6>
                                <div class="flex flex-col gap-2">
                                    ${Object.keys(obj.view_mappings).map(viewKey => `
                                        <div class="text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-100 px-3 py-2 rounded-lg flex justify-between items-center">
                                            <div class="flex items-center gap-2">
                                                <svg class="w-3 h-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z"></path></svg>
                                                ${viewKey}
                                            </div>
                                            <span class="bg-white text-blue-600 px-2 py-0.5 rounded shadow-sm text-[10px]">${obj.view_mappings[viewKey].layoutType || 'Standard Layout'}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}

                        ${obj.saved_views && obj.saved_views.length > 0 ? `
                            <div>
                                <h6 class="text-xs font-bold text-slate-500 uppercase mb-2">Saved Filters/Views</h6>
                                <div class="flex flex-col gap-2">
                                    ${obj.saved_views.map(sv => `
                                        <div class="text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-100 px-3 py-2 rounded-lg flex justify-between items-center">
                                            <span>${sv.view_name}</span>
                                            <span class="text-[10px] bg-amber-200 px-1.5 rounded">${sv.view_type}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>

                    <!-- Automations and Rules -->
                    ${(obj.flows && obj.flows.length > 0) || (obj.validationRules && obj.validationRules.length > 0) || (obj.validation_rules && obj.validation_rules.length > 0) ? `
                        <div class="mt-4 pt-4 border-t border-slate-100 space-y-3">
                            <h6 class="text-xs font-bold text-slate-500 uppercase">Logic & Automations</h6>
                            
                            ${(obj.validationRules || obj.validation_rules || []).map(r => `
                                <div class="bg-rose-50 border border-rose-100 rounded-lg p-3 text-sm text-rose-800 flex gap-2 items-start">
                                    <svg class="w-4 h-4 mt-0.5 shrink-0 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                                    <div>
                                        <div class="font-bold text-xs">${r.rule_id || 'Validation Rule'}</div>
                                        <div class="text-[11px] opacity-80 mt-0.5">${r.error_message}</div>
                                    </div>
                                </div>
                            `).join('')}

                            ${(obj.flows || []).map(f => `
                                <div class="bg-emerald-50 border border-emerald-100 rounded-lg p-3 flex justify-between items-center">
                                    <div>
                                        <div class="font-bold text-sm text-emerald-800 flex items-center gap-1">
                                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                                            ${f.flow_id}
                                        </div>
                                        <div class="text-xs text-emerald-600 mt-1">Triggers: ${f.trigger_event}</div>
                                    </div>
                                    <div class="text-right">
                                        <div class="text-[10px] font-mono bg-emerald-100 text-emerald-700 px-2 py-1 rounded">${(f.steps || []).length} Steps</div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}

                </div>`;
        });
    } else {
        visualHTML += `<div class="text-slate-500 italic p-4">No objects found in this module.</div>`;
    }

    visualHTML += `</div>`;

    // Inject UI Structure
    previewContainer.innerHTML = `
        <div class="flex flex-col h-full">
            <div class="flex justify-between items-center mb-4 sticky top-0 bg-slate-900/5 backdrop-blur py-2 z-10">
                <h3 class="font-bold text-slate-800 text-lg">Module Blueprint</h3>
                <div class="flex bg-slate-200 p-1 rounded-lg">
                    <button onclick="window.toggleManifestView('visual')" id="tab-visual" class="px-3 py-1 text-sm font-bold rounded-md bg-white text-indigo-600 shadow-sm">Visual View</button>
                    <button onclick="window.toggleManifestView('json')" id="tab-json" class="px-3 py-1 text-sm font-medium text-slate-500 hover:text-slate-700">JSON API Payload</button>
                </div>
            </div>
            <div id="view-visual" class="flex-1 overflow-y-auto custom-scrollbar pr-2">${visualHTML}</div>
            <div id="view-json" class="hidden flex-1 overflow-y-auto custom-scrollbar bg-slate-900 rounded-xl p-4">
                <pre class="text-green-400 font-mono text-xs"><code class="language-json">${formattedJson}</code></pre>
            </div>
        </div>
    `;
}

// Global Tab Switcher
window.toggleManifestView = function(viewType) {
    const visualView = document.getElementById('view-visual');
    const jsonView = document.getElementById('view-json');
    const tabVisual = document.getElementById('tab-visual');
    const tabJson = document.getElementById('tab-json');

    if (viewType === 'visual') {
        visualView.classList.remove('hidden');
        jsonView.classList.add('hidden');
        tabVisual.className = "px-3 py-1 text-sm font-bold rounded-md bg-white text-indigo-600 shadow-sm";
        tabJson.className = "px-3 py-1 text-sm font-medium text-slate-500 hover:text-slate-700";
    } else {
        visualView.classList.add('hidden');
        jsonView.classList.remove('hidden');
        tabJson.className = "px-3 py-1 text-sm font-bold rounded-md bg-white text-indigo-600 shadow-sm";
        tabVisual.className = "px-3 py-1 text-sm font-medium text-slate-500 hover:text-slate-700";
    }
};

// 6. DEPLOYMENT TRIGGER
async function deployApprovedModule() {
    if (!currentManifestState) return;

    const deployBtn = document.getElementById('deploy-btn');
    const originalText = deployBtn.innerHTML;
    deployBtn.disabled = true;
    deployBtn.innerHTML = "Deploying...";

    try {
        const response = await fetch('/api/metadata/orchestrate/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(currentManifestState) 
        });

        const result = await response.json();
        
        if (response.ok && result.status === "Success") {
            alert(`Success! Deployed objects: ${(result.deployed_objects || []).join(", ")}`);
            
            // Keep state in memory so the user can continue tweaking the draft
            deployBtn.innerHTML = "✅ Deployed Successfully";
            
            // Reset button text after 3 seconds
            setTimeout(() => {
                deployBtn.innerHTML = originalText;
                deployBtn.disabled = false;
            }, 3000);
            
        } else {
            // Display specific deployment errors if the backend provides them
            let errorMsg = result.detail || "Deployment failed.";
            throw new Error(errorMsg);
        }
    } catch (error) {
        alert(`Deployment Error: ${error.message}`);
        deployBtn.innerHTML = originalText;
        deployBtn.disabled = false;
    }
}