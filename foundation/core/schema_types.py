# foundation/core/schema_types.py
from enum import Enum
from typing import Dict, Any, Optional, List, TypedDict
from dataclasses import dataclass, field

class FieldType(Enum):
    STRING = 'STRING'
    NUMBER = 'NUMBER'
    BOOLEAN = 'BOOLEAN'
    REFERENCE = 'REFERENCE'          # Lookup to another object
    # VIRTUAL_ROLLUP = 'VIRTUAL_ROLLUP' # Math calculated at runtime
    PICKLIST = 'PICKLIST' # <-- Restored
    FORMULA = 'FORMULA' # <-- Restored
    ROLLUP_SUMMARY = 'ROLLUP_SUMMARY' # <-- Add this

    # --- Semantic Primitives ---
    DATE = 'DATE'                 # Stored as ISO 8601 string (YYYY-MM-DD)
    DATETIME = 'DATETIME'         # Stored as ISO 8601 string
    TIME = 'TIME'                 # Stored as string (HH:MM:SS)
    CURRENCY = 'CURRENCY'         # Stored as Number
    PERCENT = 'PERCENT'           # Stored as Number
    EMAIL = 'EMAIL'               # Stored as String
    PHONE = 'PHONE'               # Stored as String
    URL = 'URL'                   # Stored as String
    GEOLOCATION = 'GEOLOCATION'   # Stored as String format "latitude,longitude"

# --- The New TypedDict Contracts ---
# Developers get IDE autocompletion, but at runtime these are just dicts!

class PicklistConfig(TypedDict):
    allowed_values: List[str]
class FormulaConfig(TypedDict):
    expression: str
    return_type: str

class RelationshipType(Enum):
    LOOKUP = 'LOOKUP'                 # Loose connection (e.g., Invoice -> Contact)
    MASTER_DETAIL = 'MASTER_DETAIL'   # Tight connection (e.g., InvoiceLine -> Invoice)

class DeletionBehavior(Enum):
    CASCADE = 'CASCADE'     # If Parent is deleted, delete the Child
    SET_NULL = 'SET_NULL'   # If Parent is deleted, empty the Child's lookup field
    RESTRICT = 'RESTRICT'   # Prevent Parent from being deleted if Children exist

@dataclass
class ReferenceConfig:
    target_object: str
    relationship_type: RelationshipType
    deletion_behavior: DeletionBehavior
    filter_expression: Optional[str] = None

@dataclass
class FieldDefinition:
    field_name: str
    data_type: FieldType
    required: bool
    config: Optional[Any] = None
    is_system: bool = False
    is_external_id: bool = False

@dataclass
class ValidationRuleDefinition:
    rule_id: str
    error_condition_expr: str # e.g., "Status == 'Paid' and Amount == 0"
    error_message: str # e.g., "Cannot mark invoice as Paid with zero amount."

@dataclass
class FlowStepDefinition:
    step_id: str
    function_name: str
    config: Dict[str, Any]
    # --- Change this line from Optional[str] to Optional[Any] ---
    # run_if: Optional[Any] = None

    # --- Explicit Recursive Graph Pointers ---
    true_steps: List['FlowStepDefinition'] = field(default_factory=list)
    false_steps: List['FlowStepDefinition'] = field(default_factory=list)
    loop_steps: List['FlowStepDefinition'] = field(default_factory=list)

# 1. Add this new dataclass to define the variable structure
@dataclass
class FlowVariableDefinition:
    name: str
    data_type: str
    object_name: Optional[str] = None
    is_input: bool = False
    is_output: bool = False
    expression: Optional[str] = None

@dataclass
class FlowDefinition:
    flow_id: str
    target_object: str
    trigger_event: str # e.g., 'ON_CREATE', 'ON_UPDATE', 'ON_CREATE_OR_UPDATE'
    execution_phase: str = "BEFORE_SAVE"
    steps: List[FlowStepDefinition] = field(default_factory=list)
    variables: List[FlowVariableDefinition] = field(default_factory=list)
    active: bool = True

@dataclass
class ObjectDefinition:
    object_name: str           # e.g., 'Invoice'
    label: str                 # e.g., 'Customer Invoice'
    fields: Dict[str, FieldDefinition] = field(default_factory=dict)
    validation_rules: List[ValidationRuleDefinition] = field(default_factory=list) # <-- ADDED
    flows: List[FlowDefinition] = field(default_factory=list) # <-- NEW BINDING
    # --- ADD THIS LINE ---
    view_mappings: Dict[str, Any] = field(default_factory=dict)
    # capabilities: List[str] = [] # <-- Make sure this exists!
    capabilities: List[str] = field(default_factory=list)

    # --- ARCHITECTURAL FIX: Explicitly declare the new metadata properties ---
    show_in_nav: bool = True
    saved_views: List[Dict[str, Any]] = field(default_factory=list)

    enable_rls: bool = True

class RollupOperation(Enum):
    COUNT = 'COUNT'
    SUM = 'SUM'
    MIN = 'MIN'
    MAX = 'MAX'

@dataclass
class RollupConfig:
    child_object: str            # e.g., 'Invoice'
    relationship_field: str      # e.g., 'CustomerId' (The lookup on the child pointing to the parent)
    operation: RollupOperation   # e.g., RollupOperation.SUM
    target_field: Optional[str]  # e.g., 'Amount' (Field on the child to aggregate. None if operation is COUNT)
    filter_expression: Optional[str] = None # e.g., "Status == 'Paid'"
    return_type: str = 'NUMBER'
