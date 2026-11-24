import datetime
from typing import List, Dict, Any

from runtime.actionpipeline.runtime_types import SaveResult, DeleteResult
from runtime.context.context_models import RequestContext
from runtime.context.bulkification_splitter import BulkificationSplitter
from runtime.actionpipeline.database_transaction import DatabaseTransactionManager
from foundation.metadata.metadata_schema_engine import MetadataSchemaEngine
from foundation.security.security_policy_core import SecurityPolicyCore

# # Import Stage Processors
from runtime.actionpipeline.stages.fk_validator import ForeignKeyValidator
from runtime.actionpipeline.stages.cascade_engine import CascadeDeletionEngine
from runtime.actionpipeline.stages.fls_processor import FieldSecurityProcessor
from runtime.actionpipeline.stages.hook_broadcaster import HookBroadcaster
from runtime.actionpipeline.stages.formula_evaluator import FormulaEvaluatorEngine
# from runtime.actionpipeline.stages.workflow_engine import CrossObjectWorkflowEngine
from runtime.actionpipeline.stages.validation_stage import UserValidationRulesStage
from runtime.actionpipeline.stages.configurable_flow_engine import ConfigurableFlowEngine
from runtime.actionpipeline.stages.id_generator import EnterpriseIDGenerator
from runtime.actionpipeline.stages.flow_executor import ObjectFlowExecutor
from runtime.actionpipeline.stages.rollup_engine import RollupSummaryEngine

from runtime.shared.context_builder import ExpressionContextBuilder
from runtime.events.event_bus import EventBus

class ActionPipelineOrchestrator:
    """
    Lightweight Orchestrator delegating pipeline stages to modular handlers:
    Formula Evaluation, FK Validation, FLS Stripping, DB Writes, Cross-Object Workflows,
    Cascades, and Event Hooks.
    """

    def __init__(
        self,
        schema_engine: MetadataSchemaEngine,
        security_core: SecurityPolicyCore,
        db_manager: DatabaseTransactionManager,
        event_bus: EventBus,
        context_builder: ExpressionContextBuilder
    ):
        self.schema_engine = schema_engine
        self.security_core = security_core
        self.db = db_manager
        self.event_bus = event_bus
        self.context_builder = context_builder

        # Initialize Pipeline Stage Handlers
        self.formula_evaluator = FormulaEvaluatorEngine(schema_engine)
        self.validation_stage = UserValidationRulesStage(schema_engine, context_builder)
        self.fk_validator = ForeignKeyValidator(schema_engine, db_manager.db_adapter)
        self.cascade_engine = CascadeDeletionEngine(schema_engine, db_manager.db_adapter)
        self.fls_processor = FieldSecurityProcessor(security_core)
        self.flow_engine = ConfigurableFlowEngine(db_manager.db_adapter)
        self.hooks = HookBroadcaster()
        self.id_generator = EnterpriseIDGenerator(db_manager.db_adapter)
        self.object_flow_executor = ObjectFlowExecutor(self.flow_engine)
        self.rollup_engine = RollupSummaryEngine(schema_engine, db_manager.db_adapter)

    # --- SAVE MUTATION PIPELINE ---
    async def execute_save(
        self,
        object_name: str,
        payloads: List[Dict[str, Any]],
        context: RequestContext,
        allow_partial_success: bool = False
    ) -> List[SaveResult]:
        results: List[SaveResult] = []
        chunks = BulkificationSplitter.chunk_payloads(payloads, chunk_size=200)

        for chunk_index, chunk in enumerate(chunks):
            print(f"\n[Pipeline] Processing Save Chunk {chunk_index + 1}/{len(chunks)}")
            tx_id = await self.db.begin_transaction(context.user.tenant_id)

            try:
                chunk_results = await self._process_save_chunk(object_name, chunk, context, tx_id)
                failed_records = [r for r in chunk_results if not r.success]
                if failed_records and not allow_partial_success:
                    # Extract the exact validation errors so the router can return them
                    error_messages = " | ".join([err for r in failed_records for err in r.errors])
                    raise Exception(f"Transaction Rolled Back. Details: {error_messages}")

                await self.db.commit(tx_id)
                results.extend(chunk_results)

                # # BROADCAST TO EVENT BUS (POST-COMMIT) - NOW WITH EXCEPTION HANDLING
                successful_records = [r for r in chunk_results if r.success]
                if successful_records:
                    try:
                        self.event_bus.publish(
                            topic="ON_RECORD_SAVE",
                            object_name=object_name,
                            tenant_id=context.user.tenant_id,
                            user_id=context.user.user_id,
                            payload=successful_records
                        )
                    
                        self.hooks.broadcast("AFTER_COMMIT_ASYNC", object_name, successful_records)
                    except Exception as hook_err:
                        print(f"[Pipeline Warning] Post-commit hook failed, but data was saved: {hook_err}")

            except Exception as e:
                await self.db.rollback(tx_id, str(e))
                for p in chunk:
                    results.append(SaveResult(record_id=p.get('Id'), success=False, errors=[str(e)]))

        return results

    async def _process_save_chunk(
        self,
        object_name: str,
        chunk: List[Dict[str, Any]],
        context: RequestContext,
        tx_id: str
    ) -> List[SaveResult]:
        results = []

        # # Stage 1: Object-Level Security Check
        if context.mode == 'USER':
            # Determine required permissions based on payload contents
            requires_create = any('Id' not in p for p in chunk)
            requires_update = any('Id' in p for p in chunk)

            if requires_create:
                if not await self.security_core.has_object_access(context.user.user_id, object_name, 'CREATE'):
                    raise PermissionError(f"User '{context.user.user_id}' lacks CREATE permissions on '{object_name}'")

            if requires_update:
                if not await self.security_core.has_object_access(context.user.user_id, object_name, 'UPDATE'):
                    raise PermissionError(f"User '{context.user.user_id}' lacks UPDATE permissions on '{object_name}'")

        # # Fetch the blueprint ONCE per chunk
        blueprint = await self.schema_engine.get_object_blueprint(object_name)

        # --- NEW: GATHER ALL EXPRESSIONS UPFRONT ---
        all_expressions = []
        if blueprint.validation_rules:
            all_expressions.extend([rule.error_condition_expr for rule in blueprint.validation_rules])

        for field_def in blueprint.fields.values():
            if isinstance(field_def.config, dict) and "expression" in field_def.config:
                all_expressions.append(field_def.config["expression"])
        # -------------------------------------------

        # --- GATHER PLATFORM SYSTEM FIELDS ---
        system_fields = []
        for field_name, field_def in blueprint.fields.items():
            if field_def.data_type.value == 'REFERENCE' and field_def.config:
                rel_type = getattr(field_def.config, 'relationship_type', None)
                if rel_type and rel_type.value == 'MASTER_DETAIL':
                    nav_property_name = field_name[:-2] if field_name.endswith("Id") else field_name
                    system_fields.append(f"{nav_property_name}.OwnerId")

            # # 2. NEW: Gather Lookup Filter dependencies
            filter_expr = getattr(field_def.config, 'filter_expression', None)
            if filter_expr:
                all_expressions.append(filter_expr)


        # --- NEW: FIND EXTERNAL ID FIELDS ---
        external_id_fields = [
            fname for fname, fdef in blueprint.fields.items() 
            if getattr(fdef, 'is_external_id', False)
        ]

        for payload in chunk:


            # --- NEW: UPSERT RESOLUTION ---
            # If the payload doesn't have an internal 'Id', check if it has an External ID
            if 'Id' not in payload:
                for ext_field in external_id_fields:
                    if ext_field in payload:
                        ext_val = payload[ext_field]
                        # Look it up in the database
                        existing = await self.db.lookup_by_external_id(
                            object_name, ext_field, str(ext_val), context.user.tenant_id, tx_id
                        )
                        if existing:
                            # Attach the internal ID so the rest of the pipeline performs an UPDATE
                            payload['Id'] = existing['Id']
                            print(f"[Migration] UPSERT: Mapped {ext_field} '{ext_val}' to internal Id '{existing['Id']}'")
                            break # Found it, stop searching external fields

                        
            # # Stage 1.5: Enterprise Dual-ID Generation
            record_id = await self.id_generator.generate(object_name, payload)

            try:
                # # Fetch existing base record
                existing_record = await self.db.db_adapter.get_record_by_id(object_name, record_id, context.user.tenant_id, tx_id=tx_id)

                # --- ARCHITECTURE PURE: OWNERSHIP TRANSFER GUARDRAIL ---
                if existing_record and 'OwnerId' in payload:
                    old_owner = existing_record.get('OwnerId')
                    new_owner = payload['OwnerId']

                    if old_owner and old_owner != new_owner:
                        if context.mode == 'USER':
                            # # Delegate strictly to the Security Core
                            if not await self.security_core.has_record_access(context.user.user_id, object_name, record_id, 'TRANSFER'):
                                raise PermissionError(f"User '{context.user.user_id}' lacks TRANSFER rights for record '{record_id}'.")

                # --- ARCHITECTURE PURE: STRICT OWNERSHIP ASSIGNMENT ---
                if not existing_record and 'OwnerId' in blueprint.fields:
                    if context.mode == 'USER':
                        # # Force the creator to be the owner, ignoring malicious payload injections
                        payload['OwnerId'] = context.user.user_id
                    elif 'OwnerId' not in payload:
                        # # If System mode creates a record without an owner, default to the system caller
                        payload['OwnerId'] = context.user.user_id

                # --- NEW: ENFORCE RECORD-LEVEL SECURITY (RLS) ON UPDATE ---
                if existing_record and context.mode == 'USER' and getattr(blueprint, 'enable_rls', True):
                    if not await self.security_core.has_record_access(context.user.user_id, object_name, record_id, 'EDIT'):
                        raise PermissionError(f"User '{context.user.user_id}' lacks access to edit record '{record_id}'")

                # --- NEW: ENTERPRISE PAYLOAD HYDRATION ---
                # # If this is a partial update, fill in the missing fields using the existing database record
                # This ensures the MetadataSchemaEngine receives a complete record for validation
                if existing_record:
                    for key, value in existing_record.items():
                        if key not in payload:
                            payload[key] = value

                # --- NEW: ELEVATE TO SYSTEM CONTEXT SAFELY ---
                # Clone the context to prevent cross-record race conditions
                system_context = context.switch_mode('SYSTEM')

                hydrated_context = await self.context_builder.build_context(
                    object_name, all_expressions, payload, existing_record, system_context, system_fields=system_fields, tx_id=tx_id
                )



                # --- NEW: MASTER-DETAIL SECURITY INHERITANCE ---
                # Silently copy the Master's OwnerId to the Detail record before saving
                for field_name, field_def in blueprint.fields.items():
                    if field_def.data_type.value == 'REFERENCE' and field_def.config:
                        rel_type = getattr(field_def.config, 'relationship_type', None)
                        if rel_type and rel_type.value == 'MASTER_DETAIL':
                            # Convention over Configuration: "CustomerId" -> "Customer"
                            nav_property_name = field_name[:-2] if field_name.endswith("Id") else field_name

                            parent_record = hydrated_context.get(nav_property_name, {})
                            if parent_record and 'OwnerId' in parent_record:
                                payload['OwnerId'] = parent_record['OwnerId']


                # Create a closure bound to the exact same Postgres connection
                async def transactional_save(object_name, payloads, context, allow_partial_success=False):
                    return await self._process_save_chunk(object_name, payloads, context, tx_id)


                # Stage 5.5: Execute Flows BEFORE Physical Save
                await self.object_flow_executor.execute(
                    blueprint, object_name, payload, existing_record, context,
                    hydrated_context=hydrated_context,
                    execution_phase="BEFORE_SAVE", internal_save_fn=transactional_save
                )

                # --- AUTO-SERIALIZE DATES FOR SCHEMA VALIDATION ---
                for key, val in list(payload.items()):
                    if isinstance(val, datetime.datetime):
                        payload[key] = val.strftime('%Y-%m-%dT%H:%M:%SZ')
                    elif isinstance(val, datetime.date):
                        payload[key] = val.strftime('%Y-%m-%d')


                # Stage 2: Formula & Dynamic Expression Evaluation (Passed Hydrated Context)
                await self.formula_evaluator.evaluate_formulas(object_name, payload, hydrated_context)

                print(f"5. [Pipeline] Final state passed to validation: {payload}")
                print(f"-------------------\n")
                # Stage 3: Schema Payload Validation
                await self.schema_engine.validate_payload(object_name, payload)

                # Stage 3.5: User Validation Rules Check (Passed Hydrated Context)
                await self.validation_stage.validate(object_name, payload, hydrated_context, context)

                # Stage 4: Foreign Key Integrity Check
                await self.fk_validator.validate(object_name, payload, context.user.tenant_id, hydrated_context, tx_id=tx_id)

                # Stage 5: Field-Level Security Stripping
                if context.mode == 'USER':
                    await self.fls_processor.enforce(object_name, payload, context.user.user_id)

                # Stage 6: Before Save Hooks
                self.hooks.broadcast("BEFORE_SAVE", object_name, payload)

                # --- NEW: SYSTEM AUDIT FIELDS INJECTION ---
                current_time = datetime.datetime.now(datetime.timezone.utc).isoformat()
                # If the record is new (doesn't exist in DB yet)
                if not existing_record:
                    payload['CreatedDate'] = current_time
                    payload['CreatedById'] = context.user.user_id
                else:
                    # Preserve existing creation data
                    payload['CreatedDate'] = existing_record.get('CreatedDate')
                    payload['CreatedById'] = existing_record.get('CreatedById')

                # Always stamp modification data
                payload['SystemModstamp'] = current_time
                payload['LastModifiedDate'] = current_time
                payload['LastModifiedById'] = context.user.user_id

                # Stage 7: Physical Storage Write & Temporal Ledger Logging
                await self.db.physical_save(tx_id, context.user.tenant_id, context.user.user_id, object_name, payload)

                # --- ARCHITECTURE FIX: RECURSIVE PARENT CASCADE ---
                # Create a closure that sends the parent back to the TOP of the pipeline
                # in SYSTEM mode so formulas and cross-object flows re-evaluate.
                async def recursive_parent_save(tx_id, tenant_id, actor_id, object_name, payload):
                    # Elevate the context to SYSTEM so rollups bypass user validation blocks
                    cascade_context = context.switch_mode('SYSTEM')

                    # Send it back through the pipeline chunk processor
                    await self._process_save_chunk(object_name, [payload], cascade_context, tx_id)

                # # NEW Stage 7.25: Execute Materialized Rollup Summaries
                await self.rollup_engine.execute(
                    child_object_name=object_name,
                    child_payloads=[payload],
                    tenant_id=context.user.tenant_id,
                    user_id=context.user.user_id,
                    tx_id=tx_id,
                    physical_save_fn=recursive_parent_save
                )

                # Stage 7.5: Execute Flows AFTER Physical Save (Cross-Object DML)
                # Pass the successfully saved record as the payload
                # Create a closure bound to the exact same Postgres connection
                # async def transactional_save(object_name, payloads, context, allow_partial_success=False):
                #     return await self._process_save_chunk(object_name, payloads, context, tx_id)

                await self.object_flow_executor.execute(
                    blueprint, object_name, payload, existing_record, context,
                    hydrated_context=hydrated_context,
                    execution_phase="AFTER_SAVE",
                    internal_save_fn=transactional_save
                )

                # Stage 8: After Save Hooks
                self.hooks.broadcast("AFTER_SAVE", object_name, payload)

                results.append(SaveResult(record_id=record_id, success=True))

            except Exception as e:
                print(f"[Pipeline Error] Record '{record_id}' save failed: {str(e)}")
                results.append(SaveResult(record_id=record_id, success=False, errors=[str(e)]))

        return results

    # --- DELETE PIPELINE & CASCADE ENGINE ---
    async def execute_delete(
        self,
        object_name: str,
        record_ids: List[str],
        context: RequestContext
    ) -> List[DeleteResult]:
        results: List[DeleteResult] = []
        tx_id = await self.db.begin_transaction(context.user.tenant_id)

        try:
            if context.mode == 'USER':
                if not await self.security_core.has_object_access(context.user.user_id, object_name, 'DELETE'):
                    raise PermissionError(f"User '{context.user.user_id}' lacks DELETE permissions on '{object_name}'")

            for record_id in record_ids:
                if context.mode == 'USER':
                    if not await self.security_core.has_record_access(context.user.user_id, object_name, record_id, 'EDIT'):
                        raise PermissionError(f"User '{context.user.user_id}' lacks access to delete record '{record_id}'")

                await self.cascade_engine.process_cascades(
                    object_name, record_id, context, tx_id, self.db.physical_save, self.db.physical_delete
                )

                await self.db.physical_delete(tx_id, context.user.tenant_id, context.user.user_id, object_name, record_id)
                results.append(DeleteResult(record_id=record_id, success=True))

            await self.db.commit(tx_id)

        except Exception as e:
            await self.db.rollback(tx_id, str(e))
            for rid in record_ids:
                results.append(DeleteResult(record_id=rid, success=False, errors=[str(e)]))

        return results
