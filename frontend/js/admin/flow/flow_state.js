// js/admin/flow_state.js
export const nodeState = {};
export const schemaCache = {};
export const flowContext = {
  uniqueIdCounter: 0,
  activeNodeId: null,
  currentObjectSchema: null,
  variables: []
};

export const functionTemplates = {
  "LOGICAL_BRANCH": { condition_logic: "AND", condition: [] },
  "FOR_EACH": { list_key: "", item_alias: "CurrentItem" },
  "ASSIGN_VARIABLES": { assignments: [] },
  "FETCH_RECORDS": { target_object: "", filters_logic: "AND", filters: [], output_variable: "FetchedRecords", limit_type: "ALL_RECORDS" },
  "CREATE_RECORD": { target_object: "", field_mappings: [], output_variable: "NewRecordId", record_variable: "" },
  "MODIFY_RECORD": { target_object: "", filters_logic: "AND", filters: [], updates: [], record_id_expr: "", record_variable: "" }
};

export function getAvailableVariables(currentStepId) {
  const variables = [];

  // 1. Trigger Record (Root Namespace)
  const schema = flowContext.currentObjectSchema;
  if (schema && schema.object_name) {
    variables.push({
      label: 'Record',
      value: 'Record',
      source: 'Trigger Record',
      type: 'REFERENCE', // Tricks the UI into treating it as a drill-down node!
      ref_target: schema.object_name
    });
  }

  // 2. Custom Declared Variables
  const declaredVars = flowContext.variables || [];
  declaredVars.forEach(v => {
    let displayType = 'UNKNOWN';
    if (v.data_type === 'RECORD') displayType = 'REFERENCE';
    else if (v.data_type === 'RECORD_COLLECTION') displayType = `List<${v.object_name}>`;
    else if (v.data_type === 'FORMULA') displayType = 'FORMULA'; // <-- ADD THIS

    variables.push({
      label: v.name,
      value: v.name,
      source: 'Custom Variables',
      type: displayType,
      ref_target: v.data_type === 'RECORD' ? v.object_name : null
    });
  });

  const variableTypes = {}; // Maps: VariableName -> ObjectType

  // // 2. Previous Node Outputs (Root Namespaces)
  Object.values(nodeState).forEach(node => {
    if (node.step_id === currentStepId) return;

    let config = {};
    try { config = JSON.parse(node.config || '{}'); } catch (e) {}
    const targetObj = config.target_object;

    if (config.output_variable) {
      variableTypes[config.output_variable] = targetObj;

      variables.push({
        label: config.output_variable,
        value: config.output_variable,
        source: `Step ${node.step_id} Output`,
        // Collections are Lists, so they do NOT get a ref_target drill-down arrow
        type: targetObj ? `List<${targetObj}>` : 'ANY',
        ref_target: null
      });
    }

    if (config.item_alias) {
      const loopObjType = variableTypes[config.list_key];
      variableTypes[config.item_alias] = loopObjType;

      variables.push({
        label: config.item_alias,
        value: config.item_alias,
        source: 'Loop Contexts',
        type: 'REFERENCE', // Loop items are single records, so they get the drill-down arrow!
        ref_target: loopObjType
      });

      // --- NEW: Expose the backend loop index to the UI ---
      variables.push({
        label: `${config.item_alias}_Index`,
        value: '__loop_index',
        source: 'Loop Contexts',
        type: 'NUMBER',
        ref_target: null
      });
    }
  });

  return variables;
}

export function extractTree(containerElement) {
  if (!containerElement) return [];
  const steps = [];
  const children = Array.from(containerElement.children).filter(el => el.id && el.id.startsWith('node-wrapper-'));

  children.forEach(wrapper => {
    const id = wrapper.dataset.stepId;
    const state = nodeState[id];

    let configJson = {};
    try { configJson = JSON.parse(state.config || '{}'); } catch (err) { throw new Error(`Invalid JSON in node: ${state.step_id}`); }

    const stepObj = {
      step_id: state.step_id,
      function_name: state.function_name,
      // run_if: state.run_if || null, config: configJson,
      config: configJson,
      true_steps: [],
      false_steps: [],
      loop_steps: []
    };

    if (state.function_name === 'LOGICAL_BRANCH') {
    stepObj.true_steps = extractTree(document.getElementById(`true-container-${id}`));
    stepObj.false_steps = extractTree(document.getElementById(`false-container-${id}`));
  } else if (state.function_name === 'FOR_EACH') {
    stepObj.loop_steps = extractTree(document.getElementById(`loop-container-${id}`));
  }
  steps.push(stepObj);
});
return steps;
}
