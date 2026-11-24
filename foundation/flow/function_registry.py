# foundation/flow/function_registry.py
from typing import Dict, Any, Callable
from foundation.expressions.expression_evaluator import ExpressionEvaluator

def resolve_operand(mapping: Dict[str, Any], context: Dict[str, Any], resolver: Callable) -> Any:
    """Universal standard for resolving Flow blueprint operands."""
    operand_type = mapping.get("rightOperandType", "STRING")
    raw_val = mapping.get("value")

    if operand_type == "REFERENCE":
        return resolver(raw_val, context)
    elif operand_type == "FORMULA":
        return ExpressionEvaluator.evaluate(raw_val, context)
    else:
        return raw_val

class FunctionRegistry:
    """Central registry of reusable low-code flow primitives."""
    _registry: Dict[str, Callable] = {}
    _ui_schemas: Dict[str, dict] = {}  # <-- NEW: Holds frontend canvas metadata

    @classmethod
    def register(cls, name: str, ui_schema: dict = None):
        """
        Decorator to register a flow action and its optional frontend UI schema.
        """
        def decorator(fn: Callable):
            cls._registry[name] = fn
            if ui_schema:
                cls._ui_schemas[name] = ui_schema  # <-- NEW: Store the UI schema
            return fn
        return decorator

    @classmethod
    async def execute(cls, name: str, config: Dict[str, Any], context: Dict[str, Any], db_adapter: Any = None, resolver: Callable = None) -> Dict[str, Any]:
        if name not in cls._registry:
            raise ValueError(f"Function primitive '{name}' is not registered.")
        fn = cls._registry[name]

        # Check if primitive is async
        import inspect
        if inspect.iscoroutinefunction(fn):
            return await fn(config, context, db_adapter, resolver)
        return fn(config, context, resolver)

    @classmethod
    def get_available_actions(cls) -> list:
        """
        NEW: Called by the API layer to tell the Flow Canvas what tools exist.
        Returns a list of registered actions and their configuration fields.
        """
        return [
            {
                "action_name": name,
                "ui_schema": cls._ui_schemas.get(name, {})
            }
            for name in cls._registry.keys()
        ]

# --- PRIMITIVE IMPLEMENTATIONS ---

@FunctionRegistry.register("ASSIGN_VARIABLES")
def assign_variables(config: Dict[str, Any], context: Dict[str, Any], resolver: Callable) -> Dict[str, Any]:
    for mapping in config.get("assignments", []):
        path = mapping["field"]
        raw_val = mapping["value"]
        operator = mapping.get("operator", "=")
        operand_type = mapping.get("rightOperandType", "STRING")

        # # --- EXPLICIT TYPE ROUTING ---
        # if operand_type == "REFERENCE":
        #     val = resolver(raw_val, context)
        # elif operand_type == "FORMULA":

        #     import datetime
        #     # Inject datetime into the context so the evaluator can use it
        #     if "datetime" not in context:
        #         context["datetime"] = datetime
        #     # Safely route ONLY formulas to the AST string parser
        #     val = ExpressionEvaluator.evaluate(raw_val, context)
        # else:
        #     val = raw_val

        val = resolve_operand(mapping, context, resolver)



        keys = path.split('.')
        current_dict = context

        for k in keys[:-1]:
            if k not in current_dict or not isinstance(current_dict[k], dict):
                current_dict[k] = {}
            current_dict = current_dict[k]

        last_key = keys[-1]

        if operator == "ADD":
            existing_val = current_dict.get(last_key)
            if isinstance(existing_val, list):
                # Append to Collection (Bulkification prep)
                existing_val.append(val)
            elif isinstance(existing_val, (int, float)) and isinstance(val, (int, float, str)):
                # Math addition
                try:
                    current_dict[last_key] = float(existing_val) + float(val)
                except ValueError:
                    pass
            else:
                # Fallback initialize list if empty
                current_dict[last_key] = [val] if isinstance(val, dict) else val
        elif operator == "SUBTRACT":
            existing_val = current_dict.get(last_key)
            if isinstance(existing_val, (int, float)):
                try:
                    current_dict[last_key] = float(existing_val) - float(val)
                except ValueError:
                    pass
                except ValueError:
                    pass
        else:
            # Standard Equals
            current_dict[last_key] = val

    print(f"2. [Function Registry] ASSIGN_VARIABLES mutated Record.Status to: {context.get('Record', {}).get('Status')}")
    return context




@FunctionRegistry.register("FETCH_RECORDS")
async def fetch_records(config: Dict[str, Any], context: Dict[str, Any], db_adapter: Any, resolver: Callable) -> Dict[str, Any]:
    target_object = config["target_object"]
    evaluated_filters = []

    # # NEW: Read the structured array
    for f in config.get("filters", []):
        raw_val = f["value"]
        if f.get("rightOperandType") == "REFERENCE":
            val = resolver(raw_val, context)
        else:
            val = raw_val

        evaluated_filters.append({
            "field": f["field"],
            "operator": f.get("operator", "=="),
            "value": val
        })

    tenant_id = context.get("__tenant_id__")
    # NEW: Extract tx_id safely from the request context
    req_context = context.get("__request_context__")
    tx_id = getattr(req_context, "tx_id", None) if req_context else None

    # --- NEW: Extract Master Logic ---
    logic_type = config.get("filters_logic", "AND")
    # --- NEW: Handle Limit & Variable Output ---
    fetch_single = config.get("limit_type") == "FIRST_RECORD"
    db_limit = 1 if fetch_single else None

    records = await db_adapter.query_records(
        target_object, evaluated_filters, tenant_id, tx_id=tx_id, limit=db_limit, logic=logic_type
    )

    output_key = config.get("output_variable", "fetched_records")

    if fetch_single:
        # Save as a single Record dictionary
        context[output_key] = records[0] if records else {}
        context["__fetched_count__"] = 1 if records else 0
    else:
        # Save as a Record Collection list
        context[output_key] = records
        context["__fetched_count__"] = len(records)

    return context
@FunctionRegistry.register("CREATE_RECORD")
async def create_record(config: Dict[str, Any], context: Dict[str, Any], db_adapter: Any, resolver: Callable) -> Dict[str, Any]:
    target_object = config["target_object"]
    payloads_to_insert = []

    if "record_variable" in config and config["record_variable"]:
        raw_var = config["record_variable"]
        resolved_data = resolver(raw_var, context)

        # --- NEW: Handle Multiple Records (Record Collection) ---
        if isinstance(resolved_data, list):
            for item in resolved_data:
                if isinstance(item, dict):
                    clean_item = dict(item)
                    clean_item.pop("Id", None)  # Strip IDs for insert
                    payloads_to_insert.append(clean_item)

        # --- Handle Single Record ---
        elif isinstance(resolved_data, dict):
            clean_item = dict(resolved_data)
            clean_item.pop("Id", None)
            payloads_to_insert.append(clean_item)

        else:
            raise ValueError(f"Variable '{raw_var}' is not a valid Record or Collection.")

    else:
        # Fallback to manual field mappings
        payload = {}
        # for mapping in config.get("field_mappings", []):
        #     field_name = mapping["field"]
        #     raw_val = mapping["value"]
        #     if mapping.get("rightOperandType") == "REFERENCE":
        #         payload[field_name] = resolver(raw_val, context)
        #     else:
        #         payload[field_name] = raw_val

        for mapping in config.get("field_mappings", []):
            field_name = mapping["field"]
            payload[field_name] = resolve_operand(mapping, context, resolver)

        payloads_to_insert.append(payload)

    # Abort if there is nothing to insert
    if not payloads_to_insert:
        return context

    internal_save = context.get("__internal_save_fn__")
    req_context = context.get("__request_context__")

    if not internal_save or not req_context:
        raise RuntimeError("Flow Engine lacks access to the Action Pipeline.")

    system_context = req_context.switch_mode('SYSTEM')

    # Pass the entire list of payloads to the pipeline at once
    save_results = await internal_save(
        object_name=target_object,
        payloads=payloads_to_insert,
        context=system_context,
        allow_partial_success=False
    )

    if not save_results or not all(r.success for r in save_results):
        errors = [err for r in save_results for err in getattr(r, 'errors', [])]
        raise RuntimeError(f"Flow failed to create '{target_object}': {errors}")
    output_key = config.get("output_variable", "created_record")
    # For bulk, you might want to return a list of IDs. For now, returning the first ID matches standard behaviour.
    context[output_key] = save_results[0].record_id if save_results else None

    return context


@FunctionRegistry.register("MODIFY_RECORD")
async def modify_record(config: Dict[str, Any], context: Dict[str, Any], db_adapter: Any, resolver: Callable) -> Dict[str, Any]:
    target_object = config["target_object"]
    payloads_to_update = []

    # --- 1. BULKIFICATION & WHOLE RECORD UPDATE ---
    if "record_variable" in config and config["record_variable"]:
        raw_var = config["record_variable"]
        resolved_data = resolver(raw_var, context)

        if isinstance(resolved_data, list):
            for item in resolved_data:
                if isinstance(item, dict) and "Id" in item:
                    payloads_to_update.append(dict(item))
        elif isinstance(resolved_data, dict) and "Id" in resolved_data:
            payloads_to_update.append(dict(resolved_data))

    # --- 2. NEW: QUERY-BASED BULK UPDATE ---
    elif config.get("filters"):
        evaluated_filters = []
        for f in config["filters"]:
            raw_val = f["value"]
            val = resolver(raw_val, context) if f.get("rightOperandType") == "REFERENCE" else raw_val
            evaluated_filters.append({"field": f["field"], "operator": f.get("operator", "=="), "value": val})
        tenant_id = context.get("__tenant_id__")
        req_context = context.get("__request_context__")
        tx_id = getattr(req_context, "tx_id", None) if req_context else None
        logic_type = config.get("filters_logic", "AND")

        # Fetch matching records
        matching_records = await db_adapter.query_records(
            target_object, evaluated_filters, tenant_id, tx_id=tx_id, logic=logic_type
        )

        # Apply updates to all fetched records
        if matching_records:
            updates = {}
            # for mapping in config.get("updates", []):
            #     field_name = mapping["field"]
            #     raw_val = mapping["value"]
            #     updates[field_name] = resolver(raw_val, context) if mapping.get("rightOperandType") == "REFERENCE" else raw_val

            # Inside the matching_records loop:
            for mapping in config.get("updates", []):
                field_name = mapping["field"]
                updates[field_name] = resolve_operand(mapping, context, resolver)

            for rec in matching_records:
                payloads_to_update.append({"Id": rec["id"], **updates})

    # --- 3. FALLBACK: MANUAL ID AND FIELD UPDATES ---
    else:
        id_expr = config.get("record_id_expr")
        record_id = resolver(id_expr, context) if "." in str(id_expr) else id_expr

        if record_id:
            updates = {}
            # for mapping in config.get("updates", []):
            #     field_name = mapping["field"]
            #     raw_val = mapping["value"]
            #     updates[field_name] = resolver(raw_val, context) if mapping.get("rightOperandType") == "REFERENCE" else raw_val

            # ... and inside the fallback loop:
            for mapping in config.get("updates", []):
                field_name = mapping["field"]
                updates[field_name] = resolve_operand(mapping, context, resolver)
            payloads_to_update.append({"Id": record_id, **updates})

    # Abort if nothing to update
    if not payloads_to_update:
        return context

    # --- PIPELINE DISPATCH ---
    internal_save = context.get("__internal_save_fn__")
    req_context = context.get("__request_context__")

    if not internal_save or not req_context:
        raise RuntimeError("Flow Engine lacks access to the Action Pipeline.")

    system_context = req_context.switch_mode('SYSTEM')

    save_results = await internal_save(
        object_name=target_object,
        payloads=payloads_to_update,
        context=system_context,
        allow_partial_success=False
    )

    if not save_results or not all(r.success for r in save_results):
        errors = [err for r in save_results for err in getattr(r, 'errors', [])]
        raise RuntimeError(f"Flow failed to modify '{target_object}': {errors}")

    output_key = config.get("output_variable", "updated_record")
    context[output_key] = save_results[0].record_id if save_results else None

    return context
