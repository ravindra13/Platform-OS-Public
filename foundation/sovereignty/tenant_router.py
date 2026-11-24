from typing import Dict, Optional
from foundation.core.sovereignty_types import DataRegion, TenantRoutingConfig

class SovereigntyRouter:
    """
    Manages tenant data residency rules and resolves physical database
    connection targets for the Action Pipeline and Query Engine.
    """

    def __init__(self):
        # In production, this registry lives in a global, highly available
        # configuration store (e.g., Consul, Redis, or AWS Parameter Store)
        self._routing_table: Dict[str, TenantRoutingConfig] = {}

    def onboard_tenant(
        self,
        tenant_id: str,
        region: DataRegion,
        connection_string: str,
        read_replica_url: Optional[str] = None
    ) -> TenantRoutingConfig:
        """Registers a new tenant and strictly binds them to a geographic region and database."""
        config = TenantRoutingConfig(
            tenant_id=tenant_id,
            region=region,
            db_connection_string=connection_string,
            read_replica_url=read_replica_url or f"{connection_string}-replica",
            is_active=True
        )
        self._routing_table[tenant_id] = config
        print(f"[Sovereignty Router] Provisioned Tenant '{tenant_id}' in region '{region.value}' ({region.name})")
        return config
    def get_primary_connection(self, tenant_id: str) -> str:
        """Called by the Action Pipeline to locate the primary DB for write operations."""
        config = self._get_active_config(tenant_id)
        return config.db_connection_string

    def get_read_connection(self, tenant_id: str) -> str:
        """Called by the Query Engine to direct GET/Search queries to read replicas."""
        config = self._get_active_config(tenant_id)
        return config.read_replica_url or config.db_connection_string

    def get_region(self, tenant_id: str) -> DataRegion:
        """Identifies the geographic jurisdiction governing the tenant's data."""
        config = self._get_active_config(tenant_id)
        return config.region

    def deactivate_tenant(self, tenant_id: str) -> None:
        """Instantly blocks all read/write routing for a tenant (e.g., account suspension)."""
        if tenant_id in self._routing_table:
            self._routing_table[tenant_id].is_active = False
            print(f"[Sovereignty Router] Deactivated routing for Tenant '{tenant_id}'")

    def _get_active_config(self, tenant_id: str) -> TenantRoutingConfig:
        config = self._routing_table.get(tenant_id)
        if not config:
            raise PermissionError(f"FATAL: Unregistered tenant ID: '{tenant_id}'. Refusing execution.")
        if not config.is_active:
            raise PermissionError(f"FATAL: Inactive/Suspended tenant ID: '{tenant_id}'. Access denied.")
        return config
