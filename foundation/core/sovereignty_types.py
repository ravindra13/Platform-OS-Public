from enum import Enum
from dataclasses import dataclass
from typing import Optional

class DataRegion(Enum):
    US_EAST = 'us-east-1'       # e.g., Virginia, USA
    EU_CENTRAL = 'eu-central-1' # e.g., Frankfurt, Germany (GDPR strict)
    AP_SOUTH = 'ap-south-1'     # e.g., Mumbai, India (DPDP Act strict)

@dataclass
class TenantRoutingConfig:
    tenant_id: str
    region: DataRegion
    db_connection_string: str   # The physical Postgres/DB URL
    read_replica_url: Optional[str] = None # For routing GET queries to a faster read-only node
    is_active: bool = True
