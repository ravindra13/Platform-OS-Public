// js/admin/flow_ui.js
import { nodeState, flowContext, functionTemplates } from './flow_state.js';
import { functionConfigSchemas } from './flow_schemas.js';
import { renderDynamicConfig } from './flow_renderers.js';

// Re-export pickers so flow_app.js can still import them from this file
export { showInlinePicker, renderPickerContents, renderVariableOptions } from './flow_renderers.js';

export function addFlowStep(containerId) {
    flowContext.uniqueIdCounter++;
    const currentId = flowContext.uniqueIdCounter;
    // nodeState[currentId] = { step_id: `STEP_${currentId}`, function_name: 'LOGICAL_BRANCH', run_if: '', config: JSON.stringify(functionTemplates['LOGICAL_BRANCH'], null, 2) };
    nodeState[currentId] = { step_id: `STEP_${currentId}`, function_name: 'LOGICAL_BRANCH', config: JSON.stringify(functionTemplates['LOGICAL_BRANCH'], null, 2) };

    const container = document.getElementById(containerId);
    const stepHtml = `<div id="node-wrapper-${currentId}" class="relative transition-all mb-4 group" data-step-id="${currentId}">
        <div class="absolute -left-[33px] top-6 w-8 h-px bg-indigo-200"></div>
        <div class="absolute -left-[37px] top-5 w-3 h-3 rounded-full border-2 border-indigo-500 bg-white z-10"></div>
        <div id="node-card-${currentId}" data-node-id="${currentId}" class="node-card cursor-pointer bg-white rounded-xl shadow-sm border border-slate-200 p-4 hover:border-indigo-400 hover:shadow-md transition-all flex justify-between items-center w-full max-w-xl">
            <div class="flex items-center gap-4">
                <div id="node-icon-${currentId}" class="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-lg">🌿</div>
                <div>
                    <h4 id="node-title-${currentId}" class="text-sm font-bold text-slate-800 font-mono">STEP_${currentId}</h4>
                    <p id="node-subtitle-${currentId}" class="text-xs text-slate-500 uppercase tracking-widest mt-0.5">LOGICAL_BRANCH</p>
                </div>
            </div>
            <button data-node-id="${currentId}" class="delete-node-btn text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 p-2">✕</button>
        </div>
        <div id="branch-ui-${currentId}" class="mt-4 ml-6 space-y-4">
                    <div class="relative border-l-2 border-emerald-200 pl-8 pb-2"><span class="absolute -left-[1.2rem] -top-3 bg-emerald-100 text-emerald-800 text-[9px] font-bold px-2 py-0.5 rounded-full z-10">TRUE PATH</span><button type="button" data-container="true-container-${currentId}" class="add-branch-btn mb-3 text-xs font-bold text-emerald-600 hover:text-emerald-700">+ Add Step</button><div id="true-container-${currentId}" class="space-y-2"></div></div>
            <div class="relative border-l-2 border-rose-200 pl-8 pb-2 mt-4"><span class="absolute -left-[1.3rem] -top-3 bg-rose-100 text-rose-800 text-[9px] font-bold px-2 py-0.5 rounded-full z-10">FALSE PATH</span><button type="button" data-container="false-container-${currentId}" class="add-branch-btn mb-3 text-xs font-bold text-rose-600 hover:text-rose-700">+ Add Step</button><div id="false-container-${currentId}" class="space-y-2"></div></div>
        </div>
        <div id="loop-ui-${currentId}" class="hidden mt-4 ml-6 relative border-l-2 border-blue-200 pl-8 pb-2"><span class="absolute -left-[1.3rem] -top-3 bg-blue-100 text-blue-800 text-[9px] font-bold px-2 py-0.5 rounded-full z-10">FOR EACH</span><button type="button" data-container="loop-container-${currentId}" class="add-branch-btn mb-3 text-xs font-bold text-blue-600 hover:text-blue-700">+ Add Step</button><div id="loop-container-${currentId}" class="space-y-2"></div></div>
    </div>`;
    container.insertAdjacentHTML('beforeend', stepHtml);
    openSidebar(currentId);
}

export function openSidebar(id) {
    flowContext.activeNodeId = id;
    const state = nodeState[id];
    document.getElementById('sideStepId').value = state.step_id;
    document.getElementById('sideFunction').value = state.function_name;

    let configObj = {};
    try { configObj = JSON.parse(state.config || '{}'); } catch (e) {}
    const configWrapper = document.getElementById('configWrapper') || document.getElementById('sideConfig').parentElement;
    configWrapper.id = 'configWrapper';
    configWrapper.innerHTML = renderDynamicConfig(state.function_name, configObj, state.step_id);

    document.querySelectorAll('[id^="node-card-"]').forEach(el => el.classList.remove('ring-2', 'ring-indigo-500', 'bg-indigo-50/30'));
    document.getElementById(`node-card-${id}`).classList.add('ring-2', 'ring-indigo-500', 'bg-indigo-50/30');
    document.getElementById('configSidebar').classList.remove('hidden');
}

export function closeSidebar() {
    flowContext.activeNodeId = null;
    document.getElementById('configSidebar').classList.add('hidden');
    document.querySelectorAll('[id^="node-card-"]').forEach(el => el.classList.remove('ring-2', 'ring-indigo-500', 'bg-indigo-50/30'));
}

// Add this helper function
export function autoSaveDraft() {
    const targetObj = document.getElementById('targetObject')?.value;
    if (!targetObj) return;

    const draftState = {
        flow_id: document.getElementById('flowId').value,
        target_object: targetObj,
        trigger_event: document.getElementById('triggerEvent').value,
        execution_phase: document.getElementById('executionPhase').value,
        variables: flowContext.variables || [],
        steps: extractTree(document.getElementById('stepsContainer'))
    };

    localStorage.setItem(`flow_draft_${targetObj}`, JSON.stringify(draftState));
}

export function updateNodeState() {
    const activeId = flowContext.activeNodeId;
    if (!activeId) return;
    nodeState[activeId].step_id = document.getElementById('sideStepId').value;

    const newConfigObj = {};
    document.querySelectorAll('#dynamic-config-container .dynamic-input').forEach(input => { newConfigObj[input.dataset.configKey] = input.value; });

    const mathContainer = document.querySelector('#dynamic-config-container .math-left');
    if (mathContainer) {
        const left = document.querySelector('.math-left').value;
        const rightInput = document.querySelector('input[data-config-key="math_right"]');
        if (left && rightInput?.value) {
            const mathExpression = `${left} ${document.querySelector('.math-op').value} ${rightInput.value}`;

            // NEW: Save as a structured array with the FORMULA type
            newConfigObj['assignments'] = [{
                field: 'CalculatedResult', // Or whatever variable you are assigning it to
                operator: '=',
                value: mathExpression,
                rightOperandType: 'FORMULA' // Explicit sandbox tag
            }];

            const hidden = document.querySelector('input[data-config-key="expression"]');
            if(hidden) hidden.value = mathExpression;
        }
    }

    // Auto-compile Condition Builders / Key-Value grids
    const kvSchemaFields = (functionConfigSchemas[nodeState[activeId].function_name] || []).filter(s => s.type === 'query_builder' || s.type === 'key_value');
    kvSchemaFields.forEach(field => {
        if (field.singleRow) {
            // --- PURE ARCHITECTURE: LOGICAL_BRANCH ---
            const row = document.querySelector('#dynamic-config-container .kv-row');
            if (row) {
                const k = row.querySelector('.kv-key').value;
                const op = row.querySelector('.kv-op')?.value || '==';
                const valInput = row.querySelector('input[data-config-key="kv_val"]');
                const v = valInput ? valInput.value : "";
                if (k) {
                    const isVariable = v.includes('.') && !v.includes(' ');
                    newConfigObj[field.key] = [{
                        field: k,
                        operator: op,
                        value: v,
                        rightOperandType: isVariable ? "REFERENCE" : "STRING"
                    }];
                }
            }
        } else if (field.type === 'query_builder') {
            // --- PURE ARCHITECTURE: FETCH_RECORDS ---
            newConfigObj[field.key] = [];
            document.querySelectorAll('#dynamic-config-container .kv-row').forEach(row => {
                const keyInput = row.querySelector('.kv-key');
                const k = keyInput.tagName === 'SELECT' ? keyInput.value : keyInput.value.trim();
                const op = row.querySelector('.kv-op')?.value || '==';
                const valInput = row.querySelector('input[data-config-key="kv_val"]');
                const v = valInput ? valInput.value.trim() : "";
                if (k) {
                    const isVariable = v.includes('.') && !v.includes(' ');
                    newConfigObj[field.key].push({
                        field: k,
                        operator: op,
                        value: v,
                        rightOperandType: isVariable ? "REFERENCE" : "STRING"
                    });
                }
            });

        } else {
            // ASSIGN_VARIABLES, CREATE_RECORD, MODIFY_RECORD
            newConfigObj[field.key] = [];
            document.querySelectorAll('#dynamic-config-container .kv-row').forEach(row => {
                const keyInput = row.querySelector('.kv-key');
                const k = keyInput.tagName === 'SELECT' ? keyInput.value : keyInput.value.trim();
                const op = row.querySelector('.kv-op')?.value || '='; // Capture the operator
                const valInput = row.querySelector('input[data-config-key="kv_val"]');

                if (k && valInput) {
                    const v = valInput.value.trim();
                    const hiddenType = row.querySelector('.kv-type')?.value;

                    // Use the explicitly saved type, or fallback to the dot-notation guess
                    const isVariable = v.includes('.') && !v.includes(' ');
                    const finalType = hiddenType ? hiddenType : (isVariable ? "REFERENCE" : "STRING");

                    newConfigObj[field.key].push({
                        field: k,
                        operator: op,
                        value: v,
                        rightOperandType: finalType

                    });
                }
            });
        }
    });

    nodeState[activeId].config = JSON.stringify(newConfigObj, null, 2);
    document.getElementById(`node-title-${activeId}`).innerText = nodeState[activeId].step_id || 'UNNAMED_STEP';

    autoSaveDraft();
}

export function handleSidebarFunctionChange() {
    const activeId = flowContext.activeNodeId;
    if (!activeId) return;
    const newFunc = document.getElementById('sideFunction').value;
    nodeState[activeId].function_name = newFunc;
    document.getElementById('configWrapper').innerHTML = renderDynamicConfig(newFunc, {}, nodeState[activeId].step_id);
    updateNodeState();
    document.getElementById(`node-subtitle-${activeId}`).innerText = newFunc;

    const iconEl = document.getElementById(`node-icon-${activeId}`);
    if(newFunc.includes('RECORD')) iconEl.innerText = '💾';
    else if(newFunc === 'ASSIGN_VARIABLES') iconEl.innerText = '⚙️';
    else if(newFunc === 'LOGICAL_BRANCH') iconEl.innerText = '🌿';
    else if(newFunc === 'FOR_EACH') iconEl.innerText = '🔄';
    else iconEl.innerText = '⚙️';

    document.getElementById(`branch-ui-${activeId}`).classList.toggle('hidden', newFunc !== 'LOGICAL_BRANCH');
    document.getElementById(`loop-ui-${activeId}`).classList.toggle('hidden', newFunc !== 'FOR_EACH');
}

export function hydrateFlow(savedFlowJson) {
    document.getElementById('stepsContainer').innerHTML = "";
    for (let key in nodeState) delete nodeState[key];
    flowContext.uniqueIdCounter = 0;

    // <-- ADD THIS LINE -->
    flowContext.variables = savedFlowJson.variables || [];
    renderVariablesList(); // <-- Call it right here

    document.getElementById('flowId').value = savedFlowJson.flow_id || "";
    document.getElementById('triggerEvent').value = savedFlowJson.trigger_event || 'ON_CREATE_OR_UPDATE';

    // --- ADD THESE THREE LINES ---
    const execPhaseEl = document.getElementById('executionPhase');
    if (execPhaseEl) {
        execPhaseEl.value = savedFlowJson.execution_phase || 'BEFORE_SAVE';
        execPhaseEl.dispatchEvent(new Event('change')); // Triggers the UI guardrails!
    }

    if (savedFlowJson.steps && savedFlowJson.steps.length > 0) {
        savedFlowJson.steps.forEach(step => hydrateNode(step, 'stepsContainer'));
    }
}

function hydrateNode(stepData, containerId) {
    flowContext.uniqueIdCounter++;
    const currentId = flowContext.uniqueIdCounter;
    const funcName = stepData.function_name;
    // nodeState[currentId] = { step_id: stepData.step_id, function_name: funcName, run_if: stepData.run_if || "", config: typeof stepData.config === 'string' ? stepData.config : JSON.stringify(stepData.config || {}, null, 2) };
    nodeState[currentId] = { step_id: stepData.step_id, function_name: funcName, config: typeof stepData.config === 'string' ? stepData.config : JSON.stringify(stepData.config || {}, null, 2) };

    let icon = '⚙️';
    if(funcName.includes('RECORD')) icon = '💾';
    else if(funcName === 'LOGICAL_BRANCH') icon = '🌿';
    else if(funcName === 'FOR_EACH') icon = '🔄';
    else if(funcName === 'ASSIGN_VARIABLES') icon = '⚙️';

    const stepHtml = `<div id="node-wrapper-${currentId}" class="relative transition-all mb-4 group" data-step-id="${currentId}">
        <div class="absolute -left-[33px] top-6 w-8 h-px bg-indigo-200"></div>
        <div class="absolute -left-[37px] top-5 w-3 h-3 rounded-full border-2 border-indigo-500 bg-white z-10"></div>
        <div id="node-card-${currentId}" data-node-id="${currentId}" class="node-card cursor-pointer bg-white rounded-xl shadow-sm border border-slate-200 p-4 hover:border-indigo-400 hover:shadow-md transition-all flex justify-between items-center w-full max-w-xl">
            <div class="flex items-center gap-4">
                <div id="node-icon-${currentId}" class="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-lg">${icon}</div>
                <div>
                    <h4 id="node-title-${currentId}" class="text-sm font-bold text-slate-800 font-mono">${stepData.step_id}</h4>
                    <p id="node-subtitle-${currentId}" class="text-xs text-slate-500 uppercase tracking-widest mt-0.5">${funcName}</p>
                </div>
            </div>
            <button data-node-id="${currentId}" class="delete-node-btn text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 p-2">✕</button>
        </div>
        <div id="branch-ui-${currentId}" class="${funcName === 'LOGICAL_BRANCH' ? '' : 'hidden'} mt-4 ml-6 space-y-4">
            <div class="relative border-l-2 border-emerald-200 pl-8 pb-2"><span class="absolute -left-[1.2rem] -top-3 bg-emerald-100 text-emerald-800 text-[9px] font-bold px-2 py-0.5 rounded-full z-10">TRUE PATH</span><button type="button" data-container="true-container-${currentId}" class="add-branch-btn mb-3 text-xs font-bold text-emerald-600 hover:text-emerald-700">+ Add Step</button><div id="true-container-${currentId}" class="space-y-2"></div></div>
            <div class="relative border-l-2 border-rose-200 pl-8 pb-2 mt-4"><span class="absolute -left-[1.3rem] -top-3 bg-rose-100 text-rose-800 text-[9px] font-bold px-2 py-0.5 rounded-full z-10">FALSE PATH</span><button type="button" data-container="false-container-${currentId}" class="add-branch-btn mb-3 text-xs font-bold text-rose-600 hover:text-rose-700">+ Add Step</button><div id="false-container-${currentId}" class="space-y-2"></div></div>
        </div>
        <div id="loop-ui-${currentId}" class="${funcName === 'FOR_EACH' ? '' : 'hidden'} mt-4 ml-6 relative border-l-2 border-blue-200 pl-8 pb-2"><span class="absolute -left-[1.3rem] -top-3 bg-blue-100 text-blue-800 text-[9px] font-bold px-2 py-0.5 rounded-full z-10">FOR EACH</span><button type="button" data-container="loop-container-${currentId}" class="add-branch-btn mb-3 text-xs font-bold text-blue-600 hover:text-blue-700">+ Add Step</button><div id="loop-container-${currentId}" class="space-y-2"></div></div>
    </div>`;
    document.getElementById(containerId).insertAdjacentHTML('beforeend', stepHtml);

    if (funcName === 'LOGICAL_BRANCH') {
        if (stepData.true_steps) stepData.true_steps.forEach(s => hydrateNode(s, `true-container-${currentId}`));
        if (stepData.false_steps) stepData.false_steps.forEach(s => hydrateNode(s, `false-container-${currentId}`));
    } else if (funcName === 'FOR_EACH' && stepData.loop_steps) {
        stepData.loop_steps.forEach(s => hydrateNode(s, `loop-container-${currentId}`));
    }
}

export function renderVariablesList() {
    const listEl = document.getElementById('variablesList');
    if (!listEl) return;

    listEl.innerHTML = "";
    const vars = flowContext.variables || [];

    if (vars.length === 0) {
        listEl.innerHTML = '<li class="text-[11px] text-slate-400 italic">No variables created yet.</li>';
        return;
    }

    vars.forEach(v => {
        const icon = v.data_type === 'RECORD' ? '💾' : '⚙️';
        listEl.innerHTML += `<li class="flex justify-between items-center bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5">
            <span class="text-xs font-bold text-slate-700">${icon} ${v.name}</span>
            <span class="text-[9px] font-bold text-indigo-500 uppercase bg-indigo-50 px-1.5 py-0.5 rounded">${v.object_name}</span>
        </li>`;
    });
}

