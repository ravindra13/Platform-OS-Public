import uuid
from typing import List, Dict, Any, Tuple
from runtime.context.context_models import RequestContext, ExecutionMode
from runtime.context.context_hydrator import ContextHydrator
from runtime.context.bulkification_splitter import BulkificationSplitter

class RequestAndContextManager:
    """
    Prepares and initializes API request execution contexts, assigns transaction IDs,
    and chunks large mutation payloads.
    """

    def __init__(self, hydrator: ContextHydrator):
        self.hydrator = hydrator

    async def prepare_request(
        self,
        tenant_id: str,
        user_id: str,
        payloads: List[Dict[str, Any]],
        batch_size: int = 200,
        initial_mode: ExecutionMode = 'USER'
    ) -> Tuple[RequestContext, List[List[Dict[str, Any]]]]:

        print("\n--- INITIATING REQUEST & CONTEXT MANAGER ---")

        # # 1. Generate unique Transaction ID
        tx_id = f"TX-{uuid.uuid4().hex[:8].upper()}"
        print(f"[Request Manager] Generated Transaction ID: {tx_id}")

        # # 2. Context Hydration
        user_context = await self.hydrator.hydrate(tenant_id, user_id)
        # # 3. Create active Request Context
        request_context = RequestContext(
            transaction_id=tx_id,
            user=user_context,
            mode=initial_mode
        )

        # # 4. Chunk payloads
        chunks = BulkificationSplitter.chunk_payloads(payloads, batch_size)

        print("--- CONTEXT PREPARATION COMPLETE ---\n")
        return request_context, chunks
