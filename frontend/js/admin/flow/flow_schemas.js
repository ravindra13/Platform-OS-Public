// js/admin/flow_schemas.js

export const allOperators = [
  { value: '==', label: 'Equals' },
  { value: '!=', label: 'Does Not Equal' },
  { value: '>', label: 'Greater Than' },
  { value: '<', label: 'Less Than' },
  { value: '>=', label: 'Greater or Equal' },
  { value: '<=', label: 'Less or Equal' }
];

export const allowedOperatorsByType = {
  'NUMBER': ['==', '!=', '>', '<', '>=', '<='],
  'CURRENCY': ['==', '!=', '>', '<', '>=', '<='],
  'PERCENT': ['==', '!=', '>', '<', '>=', '<='],
  'DATE': ['==', '!=', '>', '<', '>=', '<='],
  'DATETIME': ['==', '!=', '>', '<', '>=', '<='],
  'STRING': ['==', '!='],
  'BOOLEAN': ['==', '!='],
  'REFERENCE': ['==', '!='],
  'PICKLIST': ['==', '!='],
  'DEFAULT': ['==', '!=', '>', '<', '>=', '<=']
};

export const mathOperators = [
  { value: '*', label: 'Multiply (*)' },
  { value: '/', label: 'Divide (/)' },
  { value: '+', label: 'Add (+)' },
  { value: '-', label: 'Subtract (-)' }
];

export const functionConfigSchemas = {
  "ASSIGN_VARIABLES": [
    { key: "assignments", label: "Set Variables / Update Triggering Record", type: "key_value" }
  ],

  "FETCH_RECORDS": [
    { key: "target_object", label: "Find Records In Object", type: "object_picker" },
    { key: "output_variable", label: "Save Results As (Variable Name)", type: "text", placeholder: "e.g., FetchedInvoices" },
    // { key: "limit_type", label: "How Many Records to Store", type: "key_value", singleRow: true }, // We can use a custom picker or standard dropdown
    // -- NEW: Dropdown for limit selection ---
    {
      key: "limit_type",
      label: "How Many Records to Store",
      type: "dropdown",
      options: [
        { label: "All records (Collection)", value: "ALL_RECORDS" },
        { label: "Only the first record", value: "FIRST_RECORD" }
      ]
    },
    { key: "filters", label: "Search Filters", type: "query_builder" }
  ],

  "CREATE_RECORD": [
    { key: "target_object", label: "Create Record(s) In Object", type: "object_picker" },
    { key: "output_variable", label: "Save New ID As (Variable Name)", type: "text", placeholder: "e.g., NewTaskId" },
    { key: "record_variable", label: "OR Pass Record / Record Collection Variable", type: "variable_picker" },
    { key: "field_mappings", label: "Set Field Values Manually", type: "key_value" }
  ],
  "MODIFY_RECORD": [
    { key: "target_object", label: "Update Record(s) In Object", type: "object_picker" },
    { key: "record_variable", label: "Pass Record / Record Collection Variable", type: "variable_picker" },
    { key: "record_id_expr", label: "OR ID of Record to Update", type: "pill_input" },
    {
      key: "filters_logic",
      label: "OR Filter Logic (If Querying)",
      type: "dropdown",
      options: [
        { label: "All Conditions Are Met (AND)", value: "AND" },
        { label: "Any Condition Is Met (OR)", value: "OR" }
      ]
    },
    { key: "filters", label: "Filter Conditions to Find Records", type: "query_builder" },
    { key: "updates", label: "Fields to Update (if using ID)", type: "key_value" }
  ],

  "LOGICAL_BRANCH": [
    // { key: "condition", label: "Run True Path If", type: "query_builder", singleRow: true }
    { key: "condition", label: "Run True Path If", type: "query_builder" }
  ],

  "FOR_EACH": [
    { key: "list_key", label: "List Variable to Loop Over", type: "variable_picker" },
    { key: "item_alias", label: "Name Current Item As", type: "text", placeholder: "e.g., CurrentInvoice" }
  ]
};
