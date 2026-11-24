from typing import List, Dict, Any

class BulkificationSplitter:
    @staticmethod
    def chunk_payloads(payloads: List[Dict[str, Any]], chunk_size: int = 200) -> List[List[Dict[str, Any]]]:
        """
        Splits an incoming array of records into execution batches to optimize
        memory usage and maintain transaction boundaries.
        """
        total_records = len(payloads)
        if total_records == 0:
            return []

        chunks = [payloads[i:i + chunk_size] for i in range(0, total_records, chunk_size)]
        print(f"[Bulkification Splitter] Chunked {total_records} record(s) into {len(chunks)} batch(es) of max size {chunk_size}.")
        return chunks
