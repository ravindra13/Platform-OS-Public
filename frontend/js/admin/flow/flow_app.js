// js/admin/flow_app.js
import { fetchObjectsList, fetchBlueprint, deployFlowAPI } from '../../services/api.js';
import { nodeState, flowContext, extractTree, schemaCache } from './flow_state.js';
import { addFlowStep, openSidebar, closeSidebar, updateNodeState, handleSidebarFunctionChange, showInlinePicker, renderPickerContents } from './flow_ui.js';

console.log("FLOW APP IS RUNNING!");

import { hydrateFlow } from './flow_ui.js'; // Make sure to import this!

// --- 1. INITIALIZATION & URL ROUTING ---
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 1. Populate the objects dropdown
    const data = await fetchObjectsList();
    const objects = data.objects || [];
    const selectEl = document.getElementById('targetObject');
    selectEl.innerHTML = objects.map(obj => `<option value="${obj.object_name}">${obj.object_name}</option>`).join("");

    // 2. Read URL Parameters
    const urlParams = new URLSearchParams(window.location.search);
    const targetObjUrl = urlParams.get('object');
    const flowIdUrl = urlParams.get('flow_id');

    if (targetObjUrl) {
      selectEl.value = targetObjUrl;
      flowContext.currentObjectSchema = await fetchBlueprint(targetObjUrl);

      // --- NEW: Local Draft Check ---
      const localDraft = localStorage.getItem(`flow_draft_${targetObjUrl}`);

      if (localDraft && confirm("You have unsaved changes. Do you want to restore your draft?")) {
        // Restore the unsaved draft
        hydrateFlow(JSON.parse(localDraft));
      } else if (flowIdUrl) {
        // EDIT MODE: Find the flow and hydrate it
        const schema = flowContext.currentObjectSchema;
        const existingFlows = schema.flows || [];
        const flowToLoad = existingFlows.find(f => f.flow_id === flowIdUrl);

        if (flowToLoad) {
          // --- PURE ARCHITECTURE: Pre-warm Schema Cache ---
          const objectsToFetch = new Set();

          const extractObjects = (steps) => {
            steps.forEach(s => {
              let configObj = s.config || {};
              if (typeof configObj === 'string') {
                try { configObj = JSON.parse(configObj); } catch(e){}
              }
              if (configObj.target_object) objectsToFetch.add(configObj.target_object);

              if (s.true_steps) extractObjects(s.true_steps);
              if (s.false_steps) extractObjects(s.false_steps);
              if (s.loop_steps) extractObjects(s.loop_steps);
            });
          };
          extractObjects(flowToLoad.steps || []);

          // Await all required schemas before hydrating the UI
          for (const objName of objectsToFetch) {

            if (!schemaCache[objName]) {
              schemaCache[objName] = await fetchBlueprint(objName);
            }
          }

          // Now hydrate safely
          hydrateFlow(flowToLoad);
        } else {
          alert(`Flow ${flowIdUrl} not found.`);
        }

      } else {
        // NEW MODE: Blank canvas, but with the object pre-selected
        addFlowStep('stepsContainer');
      }
    } else {
      // No URL params, just trigger standard default load
      if (objects.length > 0) selectEl.dispatchEvent(new Event('change'));
      addFlowStep('stepsContainer');
    }
  } catch (err) {
    document.getElementById('targetObject').innerHTML = '<option value="">Error loading</option>';
  }
});

// --- 2. UNOBTRUSIVE EVENT DELEGATION HUB ---

// API Trigger: Target Object Change
document.getElementById('targetObject').addEventListener('change', async (e) => {
  if (!e.target.value) return;
  flowContext.currentObjectSchema = await fetchBlueprint(e.target.value);
});

// Fetch Target Object Schema dynamically when changed in the sidebar
document.addEventListener('change', async (e) => {

  // If they change the left-side field in a query row, instantly update the UI so the operators refresh!
  if (e.target.classList.contains('kv-key')) {
    updateNodeState();
    openSidebar(flowContext.activeNodeId);
  }

  if (e.target.dataset.configKey === 'target_object' && e.target.closest('#configSidebar')) {
    const objName = e.target.value;
    if (objName && !schemaCache[objName]) {
      schemaCache[objName] = await fetchBlueprint(objName);
    }
    updateNodeState();
    openSidebar(flowContext.activeNodeId);
  }
});

// Static Sidebar Inputs
document.getElementById('sideStepId').addEventListener('input', updateNodeState);
document.getElementById('sideFunction').addEventListener('change', handleSidebarFunctionChange);
// document.getElementById('sideCondition').addEventListener('input', updateNodeState);

// Listen for ANY input change inside the sidebar configuration wrapper
document.addEventListener('input', (e) => {
  if (e.target.closest('#configSidebar')) {
    updateNodeState();
  }
});


document.getElementById('btn-add-root').addEventListener('click', () => addFlowStep('stepsContainer'));
document.getElementById('btn-close-sidebar').addEventListener('click', closeSidebar);

// --- 3. SINGLE GLOBAL CLICK LISTENER (PILL PICKER & DRILL-DOWN) ---
document.addEventListener('click', (e) => {

  // 1. Clicked the "{}" button to open the picker
  const pillBtn = e.target.closest('.insert-pill-btn');
  if (pillBtn) {
    e.preventDefault();
    showInlinePicker(pillBtn, pillBtn.dataset.stepId);
    return;
  }

  // 2. Clicked an actual Variable to insert it
  const pillOption = e.target.closest('.pill-option');
  if (pillOption) {
    e.preventDefault();
    const val = pillOption.dataset.val;
    const wrapper = pillOption.closest('.relative');
    if (wrapper) {
      const input = wrapper.querySelector('input[type="text"]');
      if (input) {
        input.value += (input.value.length > 0 ? ' ' : '') + val;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    document.getElementById('inline-picker')?.remove();
    return;
  }


  // 3. Clicked the Drill-Down Arrow (▶)
  const drillDownBtn = e.target.closest('.drill-down-btn');
  if (drillDownBtn) {
    e.preventDefault();
    const stepId = drillDownBtn.dataset.step;
    const path = drillDownBtn.dataset.path;
    const targetObj = drillDownBtn.dataset.target;

    const header = document.querySelector('#inline-picker [data-expected-type]');
    const expectedType = header ? header.dataset.expectedType : null;

    const contentsDiv = document.getElementById('picker-contents');
    if (contentsDiv) {
      contentsDiv.innerHTML = '<div class="px-3 py-2 text-xs text-slate-500 font-bold animate-pulse">Loading relation...</div>';
      renderPickerContents(stepId, expectedType, path, targetObj).then(html => {
        contentsDiv.innerHTML = html;
      }).catch(err => {
        console.error("[Drill-Down Error] Failed to render:", err);
        contentsDiv.innerHTML = `<div class="px-3 py-2 text-xs text-rose-500">Parse error</div>`;
      });
    }
    return;
  }

  // 4. Clicked the Back Button (🔙)
  const drillUpBtn = e.target.closest('.drill-up-btn');
  if (drillUpBtn) {
    e.preventDefault();
    const header = document.querySelector('#inline-picker [data-expected-type]');
    const expectedType = header ? header.dataset.expectedType : null;

    const contentsDiv = document.getElementById('picker-contents');
    const activeStepId = document.getElementById('sideStepId').value.replace('STEP_', '');

    if (contentsDiv) {
      contentsDiv.innerHTML = '<div class="px-3 py-2 text-xs text-slate-500 font-bold animate-pulse">Loading...</div>';
      renderPickerContents(activeStepId, expectedType).then(html => {
        contentsDiv.innerHTML = html;
      });
    }
    return;
  }

  // 5. Clicked outside - close the picker
  if (!e.target.closest('#inline-picker')) {
    document.getElementById('inline-picker')?.remove();
  }
});

// --- 4. CANVAS INTERACTION HUB ---
document.getElementById('canvasArea').addEventListener('click', (e) => {
  // Delete Node Button
  const deleteBtn = e.target.closest('.delete-node-btn');
  if (deleteBtn) {
    e.stopPropagation();
    const id = deleteBtn.dataset.nodeId;
    document.getElementById(`node-wrapper-${id}`).remove();
    delete nodeState[id];
    if (flowContext.activeNodeId == id) closeSidebar();
    return;
  }
// });
  // Node Card Click
  const nodeCard = e.target.closest('.node-card');
  if (nodeCard) {
    openSidebar(nodeCard.dataset.nodeId);
    return;
  }

  // Add Branch Step Button
  const addBranchBtn = e.target.closest('.add-branch-btn');
  if (addBranchBtn) {
    addFlowStep(addBranchBtn.dataset.container);
    return;
  }
});

// --- 5. DEPLOYMENT SUBMISSION ---
document.getElementById('flowBuilderForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalBtnHtml = submitBtn.innerHTML;
  submitBtn.innerHTML = 'Deploying...';
  submitBtn.disabled = true;

  try {
    const recursiveSteps = extractTree(document.getElementById('stepsContainer'));
    if (recursiveSteps.length === 0) throw new Error("At least one execution step is required.");

    await deployFlowAPI({
      flow_id: document.getElementById('flowId').value,
      target_object: document.getElementById('targetObject').value,
      trigger_event: document.getElementById('triggerEvent').value,

      execution_phase: document.getElementById('executionPhase').value, // Add this!
      variables: flowContext.variables,
      steps: recursiveSteps
    });

    // Clear draft on success
    localStorage.removeItem(`flow_draft_${document.getElementById('targetObject').value}`);

    submitBtn.className = "bg-emerald-500 text-white font-semibold px-6 py-2 rounded-lg text-sm h-[38px]";
    submitBtn.innerHTML = '✓ Deployment Successful';

    setTimeout(() => {
      e.target.reset();
      document.getElementById('stepsContainer').innerHTML = "";
      for (let key in nodeState) delete nodeState[key];
      flowContext.uniqueIdCounter = 0;
      addFlowStep('stepsContainer');

      submitBtn.className = "bg-indigo-600 text-white font-semibold px-6 py-2 rounded-lg text-sm h-[38px]";
      submitBtn.innerHTML = originalBtnHtml;
      submitBtn.disabled = false;
    }, 2000);
  } catch (err) {
    alert(`Deployment Failed: ${err.message}`);
    submitBtn.innerHTML = originalBtnHtml;
    submitBtn.disabled = false;
  }
});

document.getElementById('executionPhase').addEventListener('change', (e) => {
  const isBeforeSave = e.target.value === 'BEFORE_SAVE';
  const funcSelect = document.getElementById('sideFunction');

  // Iterate over options and disable/hide database mutations in Before Save
  Array.from(funcSelect.options).forEach(opt => {
    if (['CREATE_RECORD', 'MODIFY_RECORD', 'FETCH_RECORDS', 'FOR_EACH'].includes(opt.value)) {
      opt.disabled = isBeforeSave;
      if (isBeforeSave) opt.style.display = 'none';
      else opt.style.display = 'block';
    }
  });

  // If a disabled option is currently selected, reset it
  if (funcSelect.options[funcSelect.selectedIndex].disabled) {
    funcSelect.value = 'LOGICAL_BRANCH';
    funcSelect.dispatchEvent(new Event('change'));
  }
});

// Open Modal & Populate Objects
document.getElementById('btn-open-variables').addEventListener('click', () => {
  const mainObjectPicker = document.getElementById('targetObject');
  if (mainObjectPicker) {
    document.getElementById('varObject').innerHTML = mainObjectPicker.innerHTML;
  }
  document.getElementById('variablesModal').classList.remove('hidden');
});

// Toggle input fields based on selected Data Type
document.getElementById('varType').addEventListener('change', (e) => {
  const isFormula = e.target.value === 'FORMULA';
  document.getElementById('varObjectWrapper').classList.toggle('hidden', isFormula);
  document.getElementById('varFormulaWrapper').classList.toggle('hidden', !isFormula);
});

// Save Variable to Context
document.getElementById('btn-save-variable').addEventListener('click', () => {
  const name = document.getElementById('varName').value.trim();
  const type = document.getElementById('varType').value;
  const obj = document.getElementById('varObject').value;
  const expr = document.getElementById('varExpression').value.trim();

  if (!name) return alert("Please provide a resource name.");
  if (type !== 'FORMULA' && !obj) return alert("Please select an object.");
  if (type === 'FORMULA' && !expr) return alert("Please write a formula expression.");

  // Prevent duplicate variables
  if (flowContext.variables.some(v => v.name === name)) {
    return alert(`A variable named ${name} already exists.`);
  }

  // Push into the pure architecture state
  flowContext.variables.push({
    name: name,
    data_type: type,
    object_name: type === 'FORMULA' ? null : obj,
    expression: type === 'FORMULA' ? expr : null,
    is_input: false,
    is_output: false
  });

  // Reset and hide modal
  document.getElementById('variablesModal').classList.add('hidden');
  document.getElementById('varName').value = "";

  document.getElementById('varExpression').value = "";

  // Refresh UI pickers
  if (typeof renderVariablesList === 'function') renderVariablesList();
  if (flowContext.activeNodeId) openSidebar(flowContext.activeNodeId);
});

