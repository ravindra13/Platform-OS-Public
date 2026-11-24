// js/admin/flow_renderers.js
import { fetchBlueprint } from '../../services/api.js';
import { nodeState, flowContext, getAvailableVariables, schemaCache } from './flow_state.js';
import { allOperators, allowedOperatorsByType, mathOperators, functionConfigSchemas } from './flow_schemas.js';

export function getExpectedTypeForKey(fieldName, targetObj) {
  if (!fieldName) return 'DEFAULT';
  let schemaToUse = (targetObj && schemaCache[targetObj]) ? schemaCache[targetObj] : flowContext.currentObjectSchema;
  if (schemaToUse && schemaToUse.fields) {
    const fList = Array.isArray(schemaToUse.fields) ? schemaToUse.fields : Object.values(schemaToUse.fields);
    const fieldDef = fList.find(f => (f.name || f.field_name) === fieldName);
    if (fieldDef) return fieldDef.data_type?.value || fieldDef.data_type || fieldDef.type;
  }
  return 'DEFAULT';
}

export function renderOperatorsForType(type, selectedOp) {
  const allowed = allowedOperatorsByType[type] || allowedOperatorsByType['DEFAULT'];
  const filteredOps = allOperators.filter(op => allowed.includes(op.value));
  return filteredOps.map(op => `<option value="${op.value}" ${selectedOp === op.value ? 'selected' : ''}>${op.label}</option>`).join("");
}

export function renderVariableOptions(stepId, selectedValue = "") {
  const variables = getAvailableVariables(stepId);
  let optionsHtml = `<option value="" disabled ${!selectedValue ? 'selected' : ''}>Select Variable...</option>`;
  const grouped = variables.reduce((acc, v) => { acc[v.source] = acc[v.source] || []; acc[v.source].push(v); return acc; }, {});
  for (const [source, vars] of Object.entries(grouped)) {
    optionsHtml += `<optgroup label="-- ${source} --">`;
    vars.forEach(v => { optionsHtml += `<option value="${v.value}" ${selectedValue === v.value ? 'selected' : ''}>${v.label}</option>`;
    });
    optionsHtml += `</optgroup>`;
  }

  return optionsHtml;
}

export function renderObjectOptions(selectedValue = "") {
  const objectSelect = document.getElementById('targetObject');
  if (!objectSelect) return "";
  let optionsHtml = `<option value="" disabled ${!selectedValue ? 'selected' : ''}>Select Object...</option>`;
  Array.from(objectSelect.options).forEach(opt => {
    if (opt.value) optionsHtml += `<option value="${opt.value}" ${selectedValue === opt.value ? 'selected' : ''}>${opt.text}</option>`;
  });
  return optionsHtml;
}

export function renderTargetFieldOptions(targetObjName, selectedValue = "") {
  let optionsHtml = `<option value="" disabled ${!selectedValue ? 'selected' : ''}>Select Field...</option>`;
  const schema = schemaCache[targetObjName];
  if (schema && schema.fields) {
    const fList = Array.isArray(schema.fields) ? schema.fields : Object.values(schema.fields);
    fList.forEach(f => {
      const fname = f.name || f.field_name;
      optionsHtml += `<option value="${fname}" ${selectedValue === fname ? 'selected' : ''}>${fname}</option>`;
    });
  }
  return optionsHtml;
}

export function renderPillInput(key, value, placeholder, stepId, extraClasses = "flex-1") {
  return `<div class="relative flex items-center ${extraClasses}">
    <input type="text" data-config-key="${key}" value="${value.replace(/"/g, '&quot;')}" placeholder="${placeholder}" class="dynamic-input w-full pl-3 pr-10 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500 font-mono shadow-sm">
    <button type="button" data-step-id="${stepId}" class="insert-pill-btn absolute right-2 text-indigo-400 hover:text-indigo-600 font-bold bg-indigo-50 rounded px-1.5 py-0.5 text-xs border border-indigo-100" title="Insert Variable">{}</button>
  </div>`;
}

export async function renderPickerContents(stepId, expectedType, pathPrefix = "", targetObjToExpand = null) {
  let variables = [];
  if (targetObjToExpand) {
    if (!schemaCache[targetObjToExpand]) schemaCache[targetObjToExpand] = await fetchBlueprint(targetObjToExpand);
    const schema = schemaCache[targetObjToExpand];
    if (schema && schema.fields) {
      const fList = Array.isArray(schema.fields) ? schema.fields : Object.values(schema.fields);
      fList.forEach(f => {
        const fname = f.name || f.field_name;
        const ftype = f.data_type?.value || f.data_type || f.type;
        let refTarget = (ftype === 'REFERENCE' && f.config) ? f.config.target_object : null;
        variables.push({ label: `${pathPrefix}.${fname}`, value: `${pathPrefix}.${fname}`, source: `↳ ${targetObjToExpand} Fields`, type: ftype, ref_target: refTarget });
      });
    }
  } else {
    variables = getAvailableVariables(stepId);
  }

  if (expectedType && expectedType !== 'UNKNOWN') {
    variables = variables.filter(v => v.type === expectedType || v.type === 'ANY' || v.type === 'UNKNOWN' || v.type === 'REFERENCE');
  }

  let listHtml = targetObjToExpand ? `<button type="button" class="drill-up-btn w-full text-left px-3 py-2 text-[10px] font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 uppercase tracking-widest mb-1 border-b border-slate-200 shadow-sm">🔙 Back</button>` : "";
const grouped = variables.reduce((acc, v) => { acc[v.source] = acc[v.source] || []; acc[v.source].push(v); return acc; }, {});

for (const [source, vars] of Object.entries(grouped)) {
    listHtml += `<div class="px-2 py-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 mt-1">${source}</div>`;
    vars.forEach(v => {
        const matchClass = v.type === expectedType ? 'text-indigo-700 font-bold' : 'text-slate-600 font-medium';
        if (v.type === 'REFERENCE' && v.ref_target) {
            listHtml += `<button type="button" data-path="${v.value}" data-target="${v.ref_target}" data-step="${stepId}" class="drill-down-btn w-full flex justify-between items-center text-left px-3 py-1.5 text-xs hover:bg-indigo-50 transition-colors ${matchClass}"><span>${v.label}</span><span class="text-indigo-500 font-bold ml-2">▶</span></button>`;
        } else {
            listHtml += `<button type="button" data-val="${v.value}" class="pill-option w-full text-left px-3 py-1.5 text-xs hover:bg-indigo-50 transition-colors ${matchClass}">${v.label} <span class="text-[9px] text-slate-400 float-right mt-0.5">${v.type}</span></button>`;
        }
    });
}
return listHtml || '<div class="px-3 py-2 text-xs text-slate-500">No matching variables found</div>';
}

export async function showInlinePicker(btnElement, stepId) {
    const existing = document.getElementById('inline-picker');
    if (existing) existing.remove();

    let expectedType = null;
    const row = btnElement.closest('.kv-row');
    if (row) {
        const keySelect = row.querySelector('.kv-key');
        if (keySelect && keySelect.value) {
            const fieldName = keySelect.value;
            const state = nodeState[stepId];

    let configObj = {};
    try { configObj = JSON.parse(state.config || '{}'); } catch(e){}
    const targetObj = configObj.target_object;
    let schemaToUse = (targetObj && schemaCache[targetObj]) ? schemaCache[targetObj] : flowContext.currentObjectSchema;
    if (schemaToUse && schemaToUse.fields) {
        const fList = Array.isArray(schemaToUse.fields) ? schemaToUse.fields : Object.values(schemaToUse.fields);
        const fieldDef = fList.find(f => (f.name || f.field_name) === fieldName);
        if (fieldDef) expectedType = fieldDef.data_type?.value || fieldDef.data_type || fieldDef.type;
    }
}
}

const typeHeader = expectedType ? `<div class="bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-t-lg" data-expected-type="${expectedType}">Filtering by: ${expectedType}</div>` : "";
const pickerHtml = `<div id="inline-picker" class="absolute z-50 mt-8 right-0 bg-white border border-indigo-200 shadow-xl rounded-lg w-72 max-h-64 flex flex-col animate-[fadeIn_0.1s]">${typeHeader}<div id="picker-contents" class="overflow-y-auto py-1"><div class="px-3 py-2 text-xs text-slate-500">Loading...</div></div></div>`;
btnElement.parentElement.insertAdjacentHTML('beforeend', pickerHtml);

const contents = await renderPickerContents(stepId, expectedType);
document.getElementById('picker-contents').innerHTML = contents;
}

export function renderDynamicConfig(funcName, existingConfigObj = {}, stepId) {
    const schema = functionConfigSchemas[funcName] || [];
    let html = `<div class="space-y-5" id="dynamic-config-container">`;

    schema.forEach(field => {
        const val = existingConfigObj[field.key] || "";
        html += `<div><label class="block text-[11px] font-bold text-slate-600 mb-1.5 ml-1 flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>${field.label}</label>`;
        if (field.type === "text") {
            html += `<input type="text" data-config-key="${field.key}" value="${typeof val === 'string' ? val.replace(/"/g, '&quot;') : val}" placeholder="${field.placeholder}" class="dynamic-input w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500 shadow-sm">`;
        } else if (field.type === "pill_input") {
            html += renderPillInput(field.key, val, field.placeholder || 'Value or {Variable}', stepId, 'w-full');
        } else if (field.type === "variable_picker") {
            html += `<select data-config-key="${field.key}" class="dynamic-input w-full px-3 py-2 bg-indigo-50/50 border border-indigo-200 rounded-lg text-sm font-semibold text-indigo-700 outline-none cursor-pointer shadow-sm">${renderVariableOptions(stepId, val)}</select>`;
        } else if (field.type === "object_picker") {
            html += `<select data-config-key="${field.key}" class="dynamic-input w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold outline-none cursor-pointer shadow-sm">${renderObjectOptions(val)}</select>`;
        } else if (field.type === "dropdown") {
            let optionsHtml = (field.options || []).map(opt =>
                `<option value="${opt.value}" ${val === opt.value ? 'selected' : ''}>${opt.label}</option>`
            ).join("");
            html += `<select data-config-key="${field.key}" class="dynamic-input w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500 shadow-sm cursor-pointer">${optionsHtml}</select>`;
        } else if (field.type === "math_builder") {
            html += `<div class="flex gap-2 items-center bg-slate-50 p-3 rounded-lg border border-slate-200"><select class="math-left flex-1 px-2 py-2 bg-white border border-slate-200 rounded-md text-xs font-semibold outline-none cursor-pointer shadow-sm">${renderVariableOptions(stepId, "")}</select><select class="math-op w-16 px-1 py-2 bg-slate-100 border border-slate-300 rounded-md text-xs font-bold text-center outline-none cursor-pointer shadow-sm">${mathOperators.map(op => `<option value="${op.value}">${op.value}</option>`).join("")}</select>${renderPillInput('math_right', '', 'Number or {Var}', stepId, 'flex-1')}</div><input type="hidden" data-config-key="${field.key}" class="dynamic-input" value="${val}"><p class="text-[10px] text-slate-400 mt-1 ml-1">Current AST String: <span class="font-mono text-indigo-500">${val || 'None'}</span></p>`;
        } else if (field.type === "query_builder" || field.type === "key_value") {
            const isQuery = field.type === "query_builder";
            const targetObj = existingConfigObj['target_object'];
        // Extract existing logic or default to AND
        const existingLogic = existingConfigObj[`${field.key}_logic`] || 'AND';

        // Add the master toggle for queries
        if (isQuery || field.singleRow) {
            html += `<div class="mb-2 flex items-center gap-2">
                <label class="text-[10px] font-bold text-slate-500 uppercase">Condition Logic:</label>
                <select data-config-key="${field.key}_logic" class="dynamic-input px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold text-indigo-600 outline-none">
                    <option value="AND" ${existingLogic === 'AND' ? 'selected' : ''}>All Conditions Are Met (AND)</option>
                    <option value="OR" ${existingLogic === 'OR' ? 'selected' : ''}>Any Condition Is Met (OR)</option>
                </select>
            </div>`;
        }

        html += `<div class="space-y-2 bg-slate-50/50 p-3 rounded-xl border border-slate-100">`;

        const hasTargetSchema = targetObj && schemaCache[targetObj];

        const renderKeyInput = (v) => {
            if (field.singleRow) return `<select class="kv-key flex-[2] px-2 py-2 bg-indigo-50 border border-indigo-200 rounded-md text-xs font-semibold text-indigo-700 outline-none cursor-pointer shadow-sm">${renderVariableOptions(stepId, v)}</select>`;

            // // NEW: Allow LOGICAL_BRANCH to use the pill picker on the left side too
            else if (funcName === "ASSIGN_VARIABLES" || funcName === "LOGICAL_BRANCH") {
                return `<div class="relative flex items-center flex-[2]">
                    <input type="text" value="${v.replace(/"/g, '&quot;')}" placeholder="Variable (e.g., Record.Amount)" class="kv-key w-full pl-3 pr-10 py-2 bg-white border border-slate-200 rounded-md text-sm outline-none font-mono shadow-sm">
                <button type="button" data-step-id="${stepId}" class="insert-pill-btn absolute right-2 text-indigo-400 hover:text-indigo-600 font-bold bg-indigo-50 rounded px-1.5 py-0.5 text-xs border border-indigo-100" title="Select Variable">{}</button>
                </div>`;
            }
            else if (hasTargetSchema) return `<select class="kv-key flex-[2] px-2 py-2 bg-white border border-slate-200 rounded-md text-xs font-semibold outline-none cursor-pointer shadow-sm">${renderTargetFieldOptions(targetObj, v)}</select>`;
            else return `<input type="text" placeholder="Select Target Object First..." value="${v}" class="kv-key flex-[2] px-3 py-2 bg-slate-50 text-slate-400 border border-slate-200 rounded-md text-sm outline-none shadow-sm" readonly>`;
        };

        // --- PURE ARCHITECTURE: Strict Schema Reading ---
        let rows = [];

        if (field.singleRow && val) {
            // LOGICAL_BRANCH - Safely unpack the pure JSON array
            if (Array.isArray(val) && val.length > 0) {
                rows.push({ left: val[0].field || '', op: val[0].operator || '==', right: val[0].value || '' });
            } else if (typeof val === 'string' && val.trim().length > 0) {
                // Fallback for legacy strings
                const parts = val.split(/(==|!=|>|<|>=|<=)/);
                if (parts.length === 3) rows.push({ left: parts[0], op: parts[1], right: parts[2] });
                else rows.push({ left: val, op: '==', right: '' });
            }
        } else if (field.type === 'query_builder' && Array.isArray(val)) {
            // FETCH_RECORDS: Strictly expects an Array of Objects
            val.forEach(item => {
                rows.push({ left: item.field || '', op: item.operator || '==', right: item.value || '' });
            });
        } else if (field.type === 'key_value') {
            // ASSIGN, CREATE, MODIFY
            if (Array.isArray(val)) {
                // Read the new PURE ARCHITECTURE structured array
                val.forEach(item => {
                    rows.push({ left: item.field || '', op: '==', right: item.value || '' });
                });
            }
        }
    

    const showOp = isQuery || funcName === "ASSIGN_VARIABLES";
    const getAssignOps = (sel) => `<option value="="${sel==='='?'selected':''}>Equals</option><option value="ADD" ${sel==='ADD'?'selected':''}>Add</option><option value="SUBTRACT" ${sel==='SUBTRACT'?'selected':''}>Subtract</option>`;

    html += `<div class="space-y-2 bg-slate-50/50 p-3 rounded-xl border border-slate-100">`;

    // Render populated rows
    rows.forEach(r => {
        const opHtml = isQuery ? renderOperatorsForType(getExpectedTypeForKey(r.left, targetObj), r.op) : getAssignOps(r.op);
        // html += `<div class="flex gap-2 kv-row items-center">${renderKeyInput(r.left)}${showOp ? `<select class="kv-op flex-1 px-1 py-2 bg-slate-100 border border-slate-200 rounded-md text-[11px] font-bold outline-none cursor-pointer text-center shadow-sm">${opHtml}</select>` : ""}${renderPillInput('kv_val', r.right, isQuery ? 'Value...' : 'Set to...', stepId, 'flex-[2]')}${!field.singleRow ? `<button type="button" onclick="this.parentElement.remove(); document.dispatchEvent(new Event('input', {bubbles:true}));" class="text-rose-400 hover:text-rose-600 bg-rose-50 p-1.5 rounded-md">✕</button>` : ""}</div>`;
        html += `<div class="flex gap-2 kv-row items-center">

        ${renderKeyInput(r.left)}
        ${showOp ? `<select class="kv-op flex-1 px-1 py-2 bg-slate-100 border border-slate-200 rounded-md text-[11px] font-bold outline-none cursor-pointer text-center shadow-sm">${opHtml}</select>` : ""}
        ${renderPillInput('kv_val', r.right, isQuery ? 'Value...' : 'Set to...', stepId, 'flex-[2]')}
        <!-- NEW: Hidden input to store the operand type -->
        <input type="hidden" class="kv-type" value="${r.rightOperandType || ''}">
        ${!field.singleRow ? `<button type="button" onclick="this.parentElement.remove(); document.dispatchEvent(new Event('input', {bubbles:true}));" class="text-rose-400 hover:text-rose-600 bg-rose-50 p-1.5 rounded-md">✕</button>` : ""}
        </div>`;
    });

    // Render the empty fallback row
    if (!field.singleRow || rows.length === 0) {
        const opHtmlEmpty = isQuery ? renderOperatorsForType(getExpectedTypeForKey("", targetObj), "") : getAssignOps("");
        html += `<div class="flex gap-2 kv-row items-center">${renderKeyInput("")}${showOp ? `<select class="kv-op flex-1 px-1 py-2 bg-slate-100 border border-slate-200 rounded-md text-[11px] font-bold outline-none cursor-pointer text-center shadow-sm">${opHtmlEmpty}</select>` : ""}${renderPillInput('kv_val', '', isQuery ? 'Value...' : 'Set to...', stepId, 'flex-[2]')}</div>`;
    }

    html += `</div>`;

}
html += `</div>`;
});
return html + `</div>`;
}

