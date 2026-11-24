import os
from typing import List, Any
from fastapi import APIRouter, Header, HTTPException, Depends
from elasticsearch import AsyncElasticsearch
from capabilities.base import CapabilityPlugin
from runtime.events.event_bus import Event

search_router = APIRouter(prefix="/search", tags=["Global Search"])

# --- 1. Module-Level State for FastAPI Dependency Injection ---
_es_client_instance: AsyncElasticsearch = None

def get_es_client() -> AsyncElasticsearch:
    """FastAPI Dependency to inject the singleton ES client into routes."""
    if not _es_client_instance:
        raise HTTPException(status_code=503, detail="Search engine is not initialized.")
    return _es_client_instance


class ElasticsearchPlugin(CapabilityPlugin):
    def __init__(self):
        self.es_url = os.environ.get("ELASTICSEARCH_URL", "http://localhost:9200")

    @property
    def name(self) -> str:
        return "Elasticsearch_Global_Search"

    def get_routers(self) -> List[APIRouter]:
        return [search_router]

    async def on_startup(self, services: Any) -> None:
        global _es_client_instance
        # --- 2. Architecturally Pure: Initialize connection ONCE on server boot ---
        if not _es_client_instance:
            _es_client_instance = AsyncElasticsearch(self.es_url)

        self.es_client = _es_client_instance

        print("[Elasticsearch] Bootstrapping global search indexer...")
        services.event_bus.subscribe("ON_RECORD_SAVE", self._handle_record_upsert)
        services.event_bus.subscribe("ON_RECORD_DELETE", self._handle_record_delete)

    async def _handle_record_upsert(self, event: Event) -> None:
        successful_records = event.payload
        index_name = f"erp_{event.tenant_id.lower()}"

        indexed_count = 0
        for record in successful_records:
            record_data = record if isinstance(record, dict) else record.__dict__

            # # 1. Extract the correct ID field based on your pipeline's payload
            doc_id = record_data.get("record_id")
            is_success = record_data.get("success")

            if doc_id and is_success:
                # # 2. FETCH THE FULL DATA FROM POSTGRES
                # # Since we only have the ID, we need to query your database for the actual fields.
                # # ---> TODO: Replace this mock dictionary with an actual DB query using self.db or self.query_pipeline
                full_record_data = {
                    "record_id": doc_id,
                    "Searchable_Text": "This is a placeholder until we wire up the DB fetch!"
                }
                # # 3. Save to Elasticsearch
                await self.es_client.index(
                    index=index_name,
                    id=str(doc_id),
                    document={
                        "object_name": event.object_name,
                        "data": full_record_data,
                    }
                )
                indexed_count += 1

        print(f"[Elasticsearch Worker] Actually indexed {indexed_count} out of {len(successful_records)} records.")

    async def _handle_record_delete(self, event: Event) -> None:
        index_name = f"erp_{event.tenant_id.lower()}"
        for doc_id in event.payload:
            try:
                await self.es_client.delete(index=index_name, id=doc_id)
            except Exception:
                pass

    # --- DECOUPLED API ENDPOINT ---

    @search_router.get("/")
    async def perform_global_search(
        q: str,
        x_tenant_id: str = Header(...),
        x_user_id: str = Header(...),
        # --- 3. Architecturally Pure: Inject the dependency ---
        client: AsyncElasticsearch = Depends(get_es_client)
    ):
        if len(q) < 2:
            raise HTTPException(status_code=400, detail="Search query must be at least 2 characters.")

        index_name = f"erp_{x_tenant_id.lower()}"

        try:
            response = await client.search(
                index=index_name,
                body={
                    "query": {
                        "multi_match": {
                            "query": q,
                            "fuzziness": "AUTO"
                        }
                    }
                }
            )

            results = [
                {
                    "object": hit["_source"].get("object_name"),
                    "id": hit["_id"],
                    "data": hit["_source"].get("data")
                }
                for hit in response["hits"]["hits"]
            ]

            return {"query": q, "total_hits": len(results), "results": results}

        except Exception as e:
            print(f"[Elasticsearch Error] {str(e)}")
            return {"query": q, "total_hits": 0, "results": []}
