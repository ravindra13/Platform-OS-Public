from typing import Any

class HookBroadcaster:
    """Fires sync and async lifecycle hooks (BEFORE_SAVE, AFTER_SAVE, AFTER_COMMIT)."""

    @staticmethod
    def broadcast(event_type: str, object_name: str, data: Any) -> None:
        print(f"[Hook Broadcaster] Event: {event_type} -> Object: {object_name}")
