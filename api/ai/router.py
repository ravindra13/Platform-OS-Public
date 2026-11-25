# api/ai/router.py
import json
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel

from api.dependencies import services, require_system_caller
# from api.ai.tools import USER_TOOLS, ADMIN_TOOLS
from api.ai.tools import USER_TOOLS, get_admin_tools
from api.ai.handlers import AIToolHandlers

router = APIRouter(prefix="/api/ai", tags=["AI Orchestrator"])

class AIPromptRequest(BaseModel):
    prompt: str
    history: Optional[List[Dict[str, str]]] = [] 
    current_manifest: Optional[Dict[str, Any]] = None
    current_context: Optional[Dict[str, Any]] = None

# api/ai/router.py

@router.post("/prompt")
async def process_ai_prompt(
    payload: AIPromptRequest,
    x_tenant_id: str = Header(...),
    x_user_id: str = Header(...),
    x_execution_mode: str = Header("USER")
):
    # 1. Prepare secure request context
    req_context, _ = await services.req_manager.prepare_request(
        x_tenant_id, x_user_id, [], initial_mode=x_execution_mode
    )

    # 2. Contextual Routing: Establish the Persona and Tools
    # if x_execution_mode == 'SYSTEM':
    #     # active_tools = ADMIN_TOOLS
    #     active_tools = get_admin_tools()
    #     system_instruction = (
    #         "You are an Enterprise Metadata Administrator. You can modify database schemas, "
    #         "add fields, and build objects. Always use `get_object_schema` to verify existing "
    #         "structures before modifying them. "
    #         "CRITICAL RULE: If you successfully execute a tool that modifies a layout, field, or object, "
    #         "you MUST include the exact text '[REFRESH]' at the very end of your final text response."
    #     )

    # 2. Contextual Routing: Establish the Persona and Tools
    if x_execution_mode == 'SYSTEM':
        active_tools = get_admin_tools()
        system_instruction = PromptManager.load_admin_prompt()

    else:
        active_tools = USER_TOOLS
        system_instruction = (
            "You are a helpful Data Assistant. You help users query and update records. "
            "You CANNOT modify the database schema. If a user asks to add a field or object, "
            "politely decline and state you only manage data."
            # --- ADD THE NEW RULE HERE ---
            # "CRITICAL RULE: If the user asks to 'see', 'view', 'open', or 'go to' a specific record, list, or page, "
            # "you MUST use the `ui_navigate` tool to change their screen. Do NOT just query the data and print it in the chat."
        )

    # --- ARCHITECTURE UPGRADE: CONTEXT INJECTION ---
    if payload.current_context:
        system_instruction += (
            f"\n\nCURRENT UI CONTEXT:\n"
            f"The user is currently viewing the following area of the application: {json.dumps(payload.current_context)}.\n"
            f"If the user says 'this object', 'this record', or 'this page', refer strictly to this context."
        )

    # 1. Start with the System Prompt to establish persona and rules
    messages = [{"role": "system", "content": system_instruction}]

    # 2. Inject the ongoing conversation history from the frontend
    if payload.history:
        messages.extend(payload.history)

    # 3. Add the user's newest prompt at the very end
    messages.append({"role": "user", "content": payload.prompt})
    
    max_iterations = 32
    for _ in range(max_iterations):
        response_message = await services.llm_engine.chat(
            messages=messages, 
            tools=active_tools
        )

        if not response_message.tool_calls:
            return {"status": "Success", "type": "text_response", "answer": response_message.content}

        messages.append(response_message)

        # 5. Tool Execution Pipeline
        for tool_call in response_message.tool_calls:
            func_name = tool_call.function.name
            raw_args = json.loads(tool_call.function.arguments)
            tool_result = None


            # --- THE ARCHITECTURE UPGRADE: CLIENT-SIDE TOOL INTERCEPTION ---
            # if func_name == "ui_navigate":
            #     # Do NOT execute this on the backend.
            #     # Immediately return the JSON to the frontend chat widget to execute.

            #     # Fallback text if the AI only generated the tool call without text
            #     ai_text = response_message.content if response_message.content else f"Navigating to {raw_args.get('target_object')}..."

            #     return {
            #         "status": "Success",
            #         "type": "ui_command",
            #         "command": func_name,
            #         "args": raw_args,
            #         "answer": ai_text
            #     }


            try:
                if func_name == "list_metadata_objects":
                    tool_result = await AIToolHandlers.list_metadata_objects(req_context, services.meta_repo, services.security_core)
                elif func_name == "get_object_schema":
                    tool_result = await AIToolHandlers.get_object_schema(raw_args["object_name"], req_context, services.schema_engine, services.security_core)
                elif func_name == "execute_data_query":
                    tool_result = await AIToolHandlers.execute_data_query(raw_args, req_context, services.query_pipeline)
                elif func_name == "save_data_records":
                    tool_result = await AIToolHandlers.save_data_records(raw_args, req_context, services.action_pipeline)
                elif func_name == "create_object":
                    tool_result = await AIToolHandlers.create_object(raw_args, services.schema_engine)
                elif func_name == "add_field":
                    tool_result = await AIToolHandlers.add_field(raw_args, services.schema_engine)
                elif func_name == "add_validation_rule":
                    tool_result = await AIToolHandlers.add_validation_rule(raw_args, services.schema_engine)
                elif func_name == "update_object_permissions":
                    tool_result = await AIToolHandlers.update_object_permissions(raw_args, services.sec_repo)
                elif func_name == "update_field_security":
                    tool_result = await AIToolHandlers.update_field_security(raw_args, services.security_core)
                elif func_name == "update_validation_rule":
                    tool_result = await AIToolHandlers.update_validation_rule(raw_args, services.schema_engine)
                elif func_name == "update_system_layout":
                    tool_result = await AIToolHandlers.update_system_layout(raw_args, services.schema_engine)
                elif func_name == "create_custom_view":
                    tool_result = await AIToolHandlers.create_custom_view(raw_args, services.schema_engine)
                elif func_name == "update_object_capabilities":
                    tool_result = await AIToolHandlers.update_object_capabilities(raw_args, services.schema_engine)
                elif func_name == "create_flow":
                    tool_result = await AIToolHandlers.create_flow(raw_args, services.schema_engine)
                elif func_name == "delete_records":
                    tool_result = await AIToolHandlers.delete_records(raw_args, req_context, services.action_pipeline)
                elif func_name == "revoke_record_share":
                    tool_result = await AIToolHandlers.revoke_record_share(raw_args, req_context, services.security_core)
                elif func_name == "delete_object":
                    tool_result = await AIToolHandlers.delete_object(raw_args, services.schema_engine)
                elif func_name == "delete_field":
                    tool_result = await AIToolHandlers.delete_field(raw_args, services.schema_engine)
                elif func_name == "delete_user":
                    tool_result = await AIToolHandlers.delete_user(raw_args, req_context, services.sec_repo, services.action_pipeline)
                elif func_name == "delete_profile":
                    tool_result = await AIToolHandlers.delete_profile(raw_args, req_context, services.sec_repo, services.action_pipeline)

                elif func_name == "deploy_module_blueprint":
                    # Requires both schema_engine and sec_repo
                    tool_result = await AIToolHandlers.deploy_module_blueprint(raw_args, services.schema_engine, services.sec_repo)
                else:
                    tool_result = {"error": f"Tool '{func_name}' is not authorized in this mode."}    
            except Exception as e:
                tool_result = {"error": "Execution failed", "details": str(e)}

            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "name": func_name,
                "content": json.dumps(tool_result)
            })

    raise HTTPException(status_code=500, detail="AI Orchestrator exceeded maximum iterations.")

# Add this below the existing /prompt endpoint in api/ai/router.py
from api.ai.tools import BUILDER_TOOLS
from api.ai.prompt_manager import PromptManager
import inspect
from pydantic.dataclasses import dataclass as pydantic_dataclass
from pydantic import TypeAdapter, ValidationError
from foundation.core.schema_types import ObjectDefinition

# Create a TypeAdapter for your core dataclass
ObjectListValidator = TypeAdapter(list[ObjectDefinition])

@router.post("/build-module")
async def generate_module_preview(
    payload: AIPromptRequest,
    x_tenant_id: str = Header(...),
    x_user_id: str = Header(...),
    _: None = Depends(require_system_caller)
):
    # 1. Establish context (requires Admin rights implicitly for this tool)
    req_context, _ = await services.req_manager.prepare_request(
        x_tenant_id, x_user_id, [], initial_mode="SYSTEM"
    )

    # Architecturally clean prompt injection
    system_instruction = PromptManager.load_builder_prompt()

    # --- ARCHITECTURE UPGRADE: LIGHTWEIGHT SCHEMA MAP ---
    # # Fetch all existing objects to prevent duplication and hallucination
    # all_schemas = await services.meta_repo.get_all_schemas()
    
    # schema_map = {}
    # for schema in all_schemas:
    #     # Fetch the blueprint to get the fields for each object
    #     blueprint = await services.schema_engine.get_object_blueprint(schema.object_name)
    #     if blueprint and hasattr(blueprint, 'fields'):
    #         schema_map[schema.object_name] = list(blueprint.fields.keys())
    #     else:
    #         schema_map[schema.object_name] = []

    # --- ARCHITECTURE UPGRADE: LIGHTWEIGHT SCHEMA MAP WITH TYPES ---
    all_schemas = await services.meta_repo.get_all_schemas()
    
    schema_map = {}
    for schema in all_schemas:
        blueprint = await services.schema_engine.get_object_blueprint(schema.object_name)
        if blueprint and hasattr(blueprint, 'fields'):
            # Build a dictionary of { "FieldName": "DATA_TYPE" }
            schema_map[schema.object_name] = {
                f_name: f_def.data_type.value if hasattr(f_def.data_type, 'value') else str(f_def.data_type)
                for f_name, f_def in blueprint.fields.items()
            }
        else:
            schema_map[schema.object_name] = {}

    # Inject the map directly into the System Prompt
    system_instruction += (
        f"\n\nCRITICAL CONTEXT - EXISTING DATABASE SCHEMA:\n"
        f"Here is the current database schema mapped as ObjectName: [FieldNames].\n"
        f"{json.dumps(schema_map)}\n"
        f"DO NOT recreate these objects. If the user asks to link to or modify an existing concept, "
        f"reference these exact names and fields."
    )
    # --- END SCHEMA MAP ---

    # 2. STATE INJECTION: If refining an existing draft, feed it to the AI
    if payload.current_manifest:
        system_instruction += (
            "\n\nIMPORTANT: The user is asking to modify an existing draft. "
            "Do not start from scratch. Apply the requested changes to the following manifest "
            "and return the updated complete version via the generate_module_blueprint tool:\n"
            f"{json.dumps(payload.current_manifest)}"
        )

    messages = [
        {"role": "system", "content": system_instruction},
        {"role": "user", "content": payload.prompt}
    ]

    max_iterations = 32
    for _ in range(max_iterations):
        response_message = await services.llm_engine.chat(
            messages=messages, 
            tools=BUILDER_TOOLS
        )

        if not response_message.tool_calls:
            return {"status": "Error", "message": "AI failed to generate a module blueprint.", "response": response_message.content}

        for tool_call in response_message.tool_calls:
            func_name = tool_call.function.name
            raw_args = json.loads(tool_call.function.arguments)

            # INTERCEPT THE TERMINATING TOOL CALL
            if func_name == "generate_module_blueprint":
                # Do NOT execute this against the database. 
                # Immediately return the JSON to the frontend for Staging/Preview.
                return {
                    "status": "Preview",
                    "type": "module_preview",
                    "manifest": raw_args 
                }

            # Handle research tools natively (Kept as fallbacks, though rarely needed now)
            try:
                if func_name == "list_metadata_objects":
                    tool_result = await AIToolHandlers.list_metadata_objects(req_context, services.meta_repo, services.security_core)
                elif func_name == "get_object_schema":
                    tool_result = await AIToolHandlers.get_object_schema(raw_args["object_name"], req_context, services.schema_engine, services.security_core)
                else:
                    tool_result = {"error": f"Tool '{func_name}' is not authorized."}
            except Exception as e:
                tool_result = {"error": "Execution failed", "details": str(e)}

            messages.append(response_message)
            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "name": func_name,
                "content": json.dumps(tool_result)
            })

    raise HTTPException(status_code=500, detail="AI Orchestrator exceeded maximum iterations.")