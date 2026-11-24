# api/query_router.py
from typing import List, Any
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from foundation.core.query_types import AbstractQuery, QueryFilter
from api.dependencies import services

router = APIRouter(prefix="/api/query", tags=["Query Pipeline"])

class APIQueryFilter(BaseModel):
    field: str
    operator: str
    value: Any

class APIQuery(BaseModel):
    object_name: str
    fields: List[str]
    filters: List[APIQueryFilter] = []

@router.post("")
async def execute_query(
    query_req: APIQuery,
    x_tenant_id: str = Header(...),
    x_user_id: str = Header(...),
    x_execution_mode: str = Header("USER")
):
    try:
        req_context, _ = await services.req_manager.prepare_request(
            x_tenant_id, x_user_id, [], initial_mode=x_execution_mode
        )

        filters = [QueryFilter(field=f.field, operator=f.operator, value=f.value) for f in query_req.filters]
        api_query = AbstractQuery(object_name=query_req.object_name, fields=query_req.fields, filters=filters)
        
        query_result = await services.query_pipeline.execute_query(api_query, req_context)
        
        return {
            "status": "Success",
            "target_node": query_result.target_node,
            "compiled_sql": query_result.compiled_sql,
            "data": query_result.records
        }
    except Exception as err:
        raise HTTPException(status_code=400, detail=str(err))

from foundation.expressions.expression_evaluator import ExpressionEvaluator

@router.get("/lookup/{source_object}/{field_name}")
async def get_reference_lookup(
    source_object: str,
    field_name: str,
    q: str = None, # <-- NEW: Accepts search terms
    x_tenant_id: str = Header(...),
    x_user_id: str = Header(...),
    x_execution_mode: str = Header("USER")
):
    """Architecturally pure endpoint for fetching filtered reference options."""
    req_context, _ = await services.req_manager.prepare_request(
        x_tenant_id, x_user_id, [], initial_mode=x_execution_mode
    )


    # # 1. Look up the rule directly from the metadata schema
    blueprint = await services.schema_engine.get_object_blueprint(source_object)
    if not blueprint or field_name not in blueprint.fields:
        raise HTTPException(status_code=404, detail="Field not found")
        
    field_def = blueprint.fields[field_name]
    config = field_def.config
    target_obj = config.get('target_object') if isinstance(config, dict) else getattr(config, 'target_object')
    filter_expr = config.get('filter_expression') if isinstance(config, dict) else getattr(config, 'filter_expression', None)

    # --- ARCHITECTURALLY SUPERIOR: Pure Metadata Routing ---
    target_blueprint = await services.schema_engine.get_object_blueprint(target_obj)
    if not target_blueprint:
        raise HTTPException(status_code=404, detail=f"Target object '{target_obj}' not found")
        
    required_fields = {"Id"}
    search_field_used = None

    # # 1. Read the explicit contract from the JSON schema
    target_view_mappings = getattr(target_blueprint, 'view_mappings', {})
    lookup_mapping = target_view_mappings.get('lookup', {})
    
    explicit_search_fields = lookup_mapping.get('search_fields', [])
    explicit_columns = lookup_mapping.get('columns', [])

    # # 2. Add all explicitly defined columns to the response payload
    for col in explicit_columns:
        if col in target_blueprint.fields:
            required_fields.add(col)

    # # 3. Determine the absolute best field to search against
    if explicit_search_fields and explicit_search_fields[0] in target_blueprint.fields:
        search_field_used = explicit_search_fields[0]
    elif explicit_columns:
        # Fallback to the first string-based column in the lookup array (e.g., Patient's MedicalRecordNumber)
        for col in explicit_columns:
            if col in target_blueprint.fields and target_blueprint.fields[col].data_type.value == 'STRING':
                search_field_used = col
                break

    # # 4. Legacy Fallback (Keeps your other objects working if they lack a lookup block)
    if not search_field_used:
        for display_field in ["Name", "Title", "DisplayId", "Subject"]:
            if display_field in target_blueprint.fields:
                required_fields.add(display_field)
                search_field_used = display_field
                break

    if not search_field_used and target_blueprint.fields:
        search_field_used = list(target_blueprint.fields.keys())[0]
        required_fields.add(search_field_used)

    # # 5. Build the query using the dynamically resolved field
    query_filters = []
    if q and search_field_used:
        query_filters.append(QueryFilter(field=search_field_used, operator="ILIKE", value=f"%{q}%"))

    system_context = req_context.switch_mode('SYSTEM')
    api_query = AbstractQuery(
        object_name=target_obj,
        fields=list(required_fields),
        # filters=[]
        filters=query_filters # <-- NEW: Inject the search filter
    )

    query_result = await services.query_pipeline.execute_query(api_query, system_context)

    # # 3. Apply the backend Expression Evaluator
    valid_records = []
    for record in query_result.records:
        if filter_expr:
            rec_data = record.get('data', record) if isinstance(record, dict) else record
            if not isinstance(rec_data, dict):
                rec_data = record.__dict__ if hasattr(record, '__dict__') else {}
                
            eval_context = {target_obj: rec_data}
            
            try:
                if ExpressionEvaluator.evaluate(filter_expr, eval_context):
                    valid_records.append(record)
            except Exception as e:
                print(f"[Lookup Eval Error] {e}")
        else:
            valid_records.append(record)

    return {"data": valid_records}
