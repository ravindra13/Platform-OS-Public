class EnterpriseIDGenerator:
    def __init__(self, db_adapter):
        self.db_adapter = db_adapter

    async def generate(self, object_name: str, payload: dict) -> str:
        record_id = payload.get('Id', 'UNKNOWN')

        if not record_id or record_id == 'UNKNOWN' or str(record_id).strip() == "":
            seq_num = await self.db_adapter.get_next_sequence(object_name)

            prefix_3 = (object_name[:3] if len(object_name) >= 3 else object_name).upper()
            display_id = f"{prefix_3}-{seq_num:05d}"

            prefix_4 = (object_name[:4].ljust(4, 'X')).upper()

            chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
            n = seq_num
            b36_str = ""
            while n > 0:
                n, mod = divmod(n, 36)
                b36_str = chars[mod] + b36_str
            b36_padded = b36_str.zfill(7) if b36_str else '0000000'

            system_id = f"01{prefix_4}00000{b36_padded}"

            payload['Id'] = system_id
            payload['DisplayId'] = display_id

            return system_id

        return record_id
