from typing import Dict, Any, Optional, List
from foundation.core.schema_types import ( FieldDefinition, ObjectDefinition, FieldType,
                                           ReferenceConfig, ValidationRuleDefinition, FlowDefinition,
                                           RelationshipType, DeletionBehavior )
from foundation.metadata.metadata_repository import MetadataRepository
from foundation.metadata.relationship_mapper import RelationshipGraphMapper, DependencyNode
from foundation.metadata.type_validator import FieldTypeValidator

class MetadataSchemaEngine:
    def __init__(self, repository: MetadataRepository, graph_mapper: RelationshipGraphMapper):
        self.repository = repository
        self.graph_mapper = graph_mapper # Injected dependency

    async def bootstrap_relationships(self) -> None:
        """
        Scans all saved object blueprints at startup and maps their
        REFERENCE fields into the in-memory relationship graph.
        """
        all_objects = await self.repository.list_schemas()

        for obj_name in all_objects:
            schema = await self.repository.get_schema(obj_name)
            if not schema:
                continue

            for field_name, field_def in schema.fields.items():
                if field_def.data_type == FieldType.REFERENCE and field_def.config:
                    # Safely extract target_object and deletion_behavior
                    # whether config is a dict or a ReferenceConfig dataclass
                    if isinstance(field_def.config, dict):
                        target_obj = field_def.config.get('target_object')
                        behavior = field_def.config.get('deletion_behavior')
                    else:
                        target_obj = getattr(field_def.config, 'target_object')
                        behavior = getattr(field_def.config, 'deletion_behavior')

                    if target_obj:
                        self.graph_mapper.register_relationship(
                            child_object=obj_name,
                            child_field=field_name,
                            target_object=target_obj,
                            behavior=behavior
                        )

        print("[Schema Engine] Relationship Graph Bootstrapped.")

    async def create_object(self, object_name: str, label: str, enable_rls: bool = True, has_owner: bool = True) -> ObjectDefinition:
        existing = await self.repository.get_schema(object_name)
        if existing:
            raise ValueError(f"Object {object_name} already exists in the Foundation.")

        new_object = ObjectDefinition(
            object_name=object_name,
            label=label,
            # Disable Record-Level Security for foundational master data
            enable_rls=enable_rls
        )
        # 1. The Machine ID (Hidden from users)
        new_object.fields['Id'] = FieldDefinition(
            field_name='Id',
            data_type=FieldType.STRING,
            required=True,
            is_system=True  # <-- ARCHITECTURE FIX: Mark as System!
        )

        # 2. The Human ID (Readable)
        new_object.fields['DisplayId'] = FieldDefinition(
            field_name='DisplayId',
            data_type=FieldType.STRING,
            required=False,
            is_system=True  # <-- ARCHITECTURE FIX: Mark as System!
        )

        # Decoupled structural injection
        if has_owner:
            new_object.fields['OwnerId'] = FieldDefinition(
                field_name='OwnerId',
                data_type=FieldType.REFERENCE,
                config=ReferenceConfig(
                    target_object='User',
                    relationship_type=RelationshipType.LOOKUP,
                    deletion_behavior=DeletionBehavior.RESTRICT
                ),
                required=False,
                is_system=True
            )
        # 2. Standard System Audit Fields
        new_object.fields['CreatedDate'] = FieldDefinition(field_name='CreatedDate', data_type=FieldType.DATETIME, required=False, is_system=True)

        # --- ARCHITECTURE FIX: Define as proper Reference to User ---
        new_object.fields['CreatedById'] = FieldDefinition(
            field_name='CreatedById',
            data_type=FieldType.REFERENCE,
            config=ReferenceConfig(
                target_object='User',
                relationship_type=RelationshipType.LOOKUP,
                deletion_behavior=DeletionBehavior.RESTRICT
            ),
            required=False,
            is_system=True
        )

        new_object.fields['LastModifiedDate'] = FieldDefinition(field_name='LastModifiedDate', data_type=FieldType.DATETIME, required=False, is_system=True)

        # --- ARCHITECTURE FIX: Define as proper Reference to User ---
        new_object.fields['LastModifiedById'] = FieldDefinition(
            field_name='LastModifiedById',
            data_type=FieldType.REFERENCE,
            config=ReferenceConfig(
                target_object='User',
                relationship_type=RelationshipType.LOOKUP,
                deletion_behavior=DeletionBehavior.RESTRICT
            ),
            required=False,
            is_system=True
        )
        new_object.fields['SystemModstamp'] = FieldDefinition(field_name='SystemModstamp', data_type=FieldType.DATETIME, required=False, is_system=True)

        await self.repository.save_schema(new_object)
        return new_object

    async def add_field(self, object_name: str, field_def: FieldDefinition) -> None:
        schema = await self.repository.get_schema(object_name)
        if not schema:
            raise ValueError(f"Cannot add field. Object {object_name} does not exist.")

        if field_def.data_type == FieldType.REFERENCE and isinstance(field_def.config, ReferenceConfig):
            self.graph_mapper.register_relationship(
                child_object=object_name,
                child_field=field_def.field_name,
                target_object=field_def.config.target_object,
                behavior=field_def.config.deletion_behavior
            )

        schema.fields[field_def.field_name] = field_def
        await self.repository.save_schema(schema)
        print(f"[Foundation] Field '{field_def.field_name}' added to '{object_name}'.")

    async def get_object_blueprint(self, object_name: str) -> Optional[ObjectDefinition]:
        return await self.repository.get_schema(object_name)

    async def validate_payload(self, object_name: str, payload: Dict[str, Any]) -> bool:
        schema = await self.repository.get_schema(object_name)
        if not schema:
            raise ValueError(f"Unknown object: {object_name}")

        for field_name, field_def in schema.fields.items():
            incoming_value = payload.get(field_name)

            if field_def.required and (incoming_value is None or incoming_value == ""):
                raise ValueError(f"Validation Failed: {field_name} is required.")

            # 2. Delegate Data Type Constraints
            FieldTypeValidator.validate(field_name, incoming_value, field_def)

        return True

    # Add this method to MetadataSchemaEngine inside foundation/metadata/metadata_schema_engine.py

    async def add_validation_rule(
        self, object_name: str, rule: ValidationRuleDefinition
    ) -> None:
        schema = await self.repository.get_schema(object_name)
        if not schema:
            raise ValueError(f"Object '{object_name}' does not exist.")

        schema.validation_rules.append(rule)
        await self.repository.save_schema(schema)
        print(f"[Schema Engine] Added Validation Rule '{rule.rule_id}' to object '{object_name}'")

    async def update_validation_rule(
        self,
        object_name: str,
        rule_id: str,
        error_condition_expr: Optional[str] = None,
        error_message: Optional[str] = None
    ) -> None:
        """Updates an existing validation rule's formula or error message."""
        schema = await self.repository.get_schema(object_name)
        if not schema:
            raise ValueError(f"Object '{object_name}' does not exist.")

        # 1. Locate the specific rule
        target_rule = next((r for r in schema.validation_rules if r.rule_id == rule_id), None)
        if not target_rule:
            raise ValueError(f"Validation rule '{rule_id}' not found on '{object_name}'.")

        # 2. Mutate the rule properties if new values are provided
        if error_condition_expr is not None:
            target_rule.error_condition_expr = error_condition_expr
        if error_message is not None:
            target_rule.error_message = error_message

        # 3. Save the mutated schema back to the repository
        await self.repository.save_schema(schema)
        print(f"[Schema Engine] Updated Validation Rule '{rule_id}' on '{object_name}'")

    def evaluate_deletion_impact(self, object_name: str) -> List[DependencyNode]:
        dependencies = self.graph_mapper.get_dependencies(object_name)
        if dependencies:
            print(f"[Schema Engine] Evaluated deletion impact for '{object_name}'. Found {len(dependencies)} dependency rule(s).")
        return dependencies

# Make sure to import FlowDefinition at the top:
# from core.schema_types import ..., FlowDefinition
    # async def add_flow_definition(
    #     self, object_name: str, flow_def: 'FlowDefinition'
    # ) -> None:
    #     schema = await self.repository.get_schema(object_name)
    #     if not schema:
    #         raise ValueError(f"Object '{object_name}' does not exist.")
    #
    #     # Ensure the flows array exists (safeguard for older schema versions)
    #     if not hasattr(schema, 'flows'):
    #         schema.flows = []
    #
    #     schema.flows.append(flow_def)
    #     await self.repository.save_schema(schema)
    #     print(f"[Schema Engine] Added Flow '{flow_def.flow_id}' to object '{object_name}'")

    async def upsert_flow_definition(
        self, object_name: str, flow_def: FlowDefinition
    ) -> None:
        """Creates or updates a flow definition on the specified object blueprint."""
        schema = await self.repository.get_schema(object_name)
        if not schema:
            raise ValueError(f"Object '{object_name}' does not exist.")

        # Ensure the flows array exists
        if not hasattr(schema, 'flows'):
            schema.flows = []

        # 1. Remove the old flow version if it exists
        updated_flows = []
        for f in schema.flows:
            f_id = f.get('flow_id') if isinstance(f, dict) else getattr(f, 'flow_id', None)
            if f_id != flow_def.flow_id:
                updated_flows.append(f)

        # 2. Append the new flow version
        updated_flows.append(flow_def)
        schema.flows = updated_flows

        # 3. Save the mutated schema back to the repository
        await self.repository.save_schema(schema)
        print(f"[Schema Engine] Upserted Flow '{flow_def.flow_id}' on object '{object_name}'")

    async def get_field_type_by_path(self, object_name: str, field_path: str) -> Optional['FieldType']:
        """
        Recursively resolves dot-notation paths (e.g. 'CustomerId.OwnerId.Name')
        to determine the final field's data type.
        """
        parts = field_path.split('.')
        current_obj_name = object_name

        for i, part in enumerate(parts):
            # Fetch the current schema blueprint
            schema = await self.get_object_blueprint(current_obj_name)
            if not schema:
                raise ValueError(f"Object '{current_obj_name}' not found while resolving path '{field_path}'.")

            # Verify the field exists on the current object
            if part not in schema.fields:
                raise ValueError(f"Field '{part}' not found on object '{current_obj_name}'.")

            field_def = schema.fields[part]

            # If this is the final piece of the dot-notation, return its data type
            if i == len(parts) - 1:
                return field_def.data_type

            # If the path continues, this field MUST be a Reference
            if field_def.data_type != FieldType.REFERENCE or not field_def.config:
                raise ValueError(f"Field '{part}' on '{current_obj_name}' is not a reference field. Cannot traverse further.")

            # Traverse to the parent object for the next loop iteration
            # Note: Assuming config is a ReferenceConfig dataclass or dictionary
            if isinstance(field_def.config, dict):
                current_obj_name = field_def.config.get('target_object')
            else:
                current_obj_name = getattr(field_def.config, 'target_object')

        return None

    async def update_field(
        self,
        object_name: str,
        field_name: str,
        required: Optional[bool] = None,
        config: Optional[Any] = None
    ) -> None:
        """Updates an existing field's properties and safely persists the changes."""
        schema = await self.repository.get_schema(object_name)
        if not schema:
            raise ValueError(f"Object '{object_name}' does not exist.")

        if field_name not in schema.fields:
            raise ValueError(f"Field '{field_name}' does not exist on '{object_name}'.")
        field_def = schema.fields[field_name]

        # 1. Update primitive attributes
        if required is not None:
            field_def.required = required

        # 2. Update complex configurations if provided
        if config is not None:
            field_def.config = config

            # If modifying a Reference field, ensure the graph mapper tracks the new relationship
            if field_def.data_type == FieldType.REFERENCE and isinstance(config, ReferenceConfig):
                self.graph_mapper.register_relationship(
                    child_object=object_name,
                    child_field=field_name,
                    target_object=config.target_object,
                    behavior=config.deletion_behavior
                )

        # 3. Save the mutated schema back to the repository
        await self.repository.save_schema(schema)
        print(f"[Schema Engine] Field '{field_name}' updated on '{object_name}'.")

    # async def update_system_layout(
    #     self, object_name: str, layout_name: str, layout_config: Dict[str, Any]
    # ) -> None:
    #     """Updates a default system layout (e.g., list, kanban, detail) in view_mappings."""
    #     schema = await self.repository.get_schema(object_name)
    #     print(f"DEBUG 2A [Engine]: Schema loaded. view_mappings: {getattr(schema, 'view_mappings', 'MISSING')}")
    #     if not schema:
    #         raise ValueError(f"Object '{object_name}' does not exist.")

    #     # Ensure the dictionary exists

    #     if not hasattr(schema, 'view_mappings'):
    #         schema.view_mappings = {}

    #     # Update the layout blueprint
    #     schema.view_mappings[layout_name] = layout_config

    #     print(f"DEBUG 2B [Engine]: Schema mutated. view_mappings keys now: {list(schema.view_mappings.keys())}")
    #     await self.repository.save_schema(schema)
    #     print(f"[Schema Engine] Updated system layout '{layout_name}' on '{object_name}'.")


    async def update_system_layout(
        self, object_name: str, layout_name: str, layout_config: Dict[str, Any]
    ) -> None:
        """Updates a default system layout (e.g., list, kanban, detail) in view_mappings."""
        schema = await self.repository.get_schema(object_name)
        if not schema:
            raise ValueError(f"Object '{object_name}' does not exist.")

        # Ensure the dictionary exists
        if not hasattr(schema, 'view_mappings'):
            schema.view_mappings = {}

        # Update the layout blueprint directly
        schema.view_mappings[layout_name] = layout_config

        await self.repository.save_schema(schema)
        print(f"[Schema Engine] Updated system layout '{layout_name}' on '{object_name}'.")

    async def upsert_custom_view(
        self,
        object_name: str,
        view_id: str,
        tab_label: Optional[str],
        view_type: Optional[str],
        visible_to_roles: Optional[List[str]],
        view_config: Dict[str, Any]
    ) -> None:
        """Creates or updates a customized user view in saved_views."""
        schema = await self.repository.get_schema(object_name)


        if not schema:
            raise ValueError(f"Object '{object_name}' does not exist.")

        # Ensure the array exists
        if not hasattr(schema, 'saved_views'):
            schema.saved_views = []

        # 1. Look for an existing view
        target_view = next(
            (v for v in schema.saved_views if (isinstance(v, dict) and v.get('view_id') == view_id) or (hasattr(v, 'view_id') and getattr(v, 'view_id') == view_id)),
            None
        )

        if target_view:
            # 2. Update existing view (Handling dicts natively based on JSON blueprint)
            if isinstance(target_view, dict):
                target_view.update(view_config)
                if tab_label: target_view['tab_label'] = tab_label
                if view_type: target_view['view_type'] = view_type
                if visible_to_roles is not None: target_view['visible_to_roles'] = visible_to_roles
        else:
            # 3. Create a brand new view
            new_view = {
                "view_id": view_id,
                "tab_label": tab_label,
                "view_type": view_type,
                "visible_to_roles": visible_to_roles or [],
                **view_config
            }
            schema.saved_views.append(new_view)

        await self.repository.save_schema(schema)
        print(f"[Schema Engine] Upserted custom view '{view_id}' on '{object_name}'.")

    async def update_object_capabilities(self, object_name: str, capabilities: List[str]) -> None:
        """Updates the root-level capabilities (e.g., audit_trail, file_attachments) for an object."""
        schema = await self.repository.get_schema(object_name)
        if not schema:
            raise ValueError(f"Object '{object_name}' does not exist.")
            
        # Bind the capabilities array to the root schema object
        schema.capabilities = capabilities
         
        # Save the mutated schema back to the repository
        await self.repository.save_schema(schema)
        print(f"[Schema Engine] Updated capabilities on '{object_name}': {capabilities}")


    async def delete_field(self, object_name: str, field_name: str) -> None:
        """
        Phase-Gated Field Deletion:
        1. Validates field existence and checks the is_system security gate.
        2. Evaluates internal dependencies (Validation Rules).
        3. Cleans up the Relationship Graph.
        4. Mutates and persists the schema.
        """
        schema = await self.repository.get_schema(object_name)
        if not schema:
            raise ValueError(f"Object '{object_name}' does not exist.")

        field_def = schema.fields.get(field_name)
        if not field_def:
            raise ValueError(f"Field '{field_name}' does not exist on '{object_name}'.")

        # 1. HARD GATE: Protect System Fields
        if field_def.is_system:
            raise ValueError(f"Cannot delete foundational system field: {field_name}.")

        # 2. INTERNAL IMPACT ANALYSIS: Block deletion if used in Validation Rules
        for rule in schema.validation_rules:
            # Basic text-match dependency check
            if field_name in rule.error_condition_expr:
                raise ValueError(
                    f"Cannot delete field '{field_name}'. It is currently referenced in "
                    f"Validation Rule: '{rule.rule_id}'. Please remove the dependency first."
                )

        # 3. GRAPH SYNC: Unregister if it is a Reference field
        if field_def.data_type == FieldType.REFERENCE:
            self.graph_mapper.unregister_relationship(
                child_object=object_name, 
                child_field=field_name
            )

        # 4. MUTATE & PERSIST
        del schema.fields[field_name]
        await self.repository.save_schema(schema)
        print(f"[Schema Engine] Field '{field_name}' successfully deleted from '{object_name}'.")

    async def delete_object(self, object_name: str) -> None:
        """
        Phase-Gated Object Deletion:
        1. Analyzes incoming dependencies (who relies on this object).
        2. Blocks deletion if protected by RESTRICT referential integrity rules.
        3. Unregisters outgoing dependencies from the Graph.
        4. Executes a physical schema wipe.
        """
        schema = await self.repository.get_schema(object_name)
        if not schema:
            raise ValueError(f"Object '{object_name}' does not exist.")

        # 1. IMPACT ANALYSIS: Check who relies on this object
        dependencies = self.evaluate_deletion_impact(object_name)
        
        # 2. HARD GATE: Block if any dependency uses RESTRICT behavior
        restrictive_deps = [dep for dep in dependencies if dep.behavior == DeletionBehavior.RESTRICT]
        if restrictive_deps:
            dep_list = ", ".join([f"{d.child_object}.{d.child_field}" for d in restrictive_deps])
            raise ValueError(
                f"Cannot delete object '{object_name}'. It is protected by RESTRICT dependencies "
                f"from the following fields: {dep_list}. You must delete those fields first."
            )

        # 3. GRAPH SYNC: Unregister all outgoing relationships (where this object is the child)
        self.graph_mapper.unregister_object(child_object=object_name)

        # 4. PERSIST WIPE
        await self.repository.delete_schema(object_name)
        print(f"[Schema Engine] Object '{object_name}' successfully wiped from system.")
