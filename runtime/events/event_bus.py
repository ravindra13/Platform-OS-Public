import asyncio
from typing import Callable, Dict, List, Any
from dataclasses import dataclass

@dataclass
class Event:
    topic: str
    object_name: str
    tenant_id: str
    user_id: str
    payload: Any

# Type alias for async event handler callbacks
EventHandler = Callable[[Event], Any]

class EventBus:
    """
    Decoupled In-Memory Pub/Sub Event Bus.
    Allows capabilities to listen to runtime events post-transaction.
    """

    def __init__(self):
        self._subscribers: Dict[str, List[EventHandler]] = {}

    def subscribe(self, topic: str, handler: EventHandler) -> None:
        """Registers a listener for a specific topic."""
        if topic not in self._subscribers:
            self._subscribers[topic] = []
        self._subscribers[topic].append(handler)
        print(f"[EventBus] Registered handler for topic '{topic}'")

    def publish(self, topic: str, object_name: str, tenant_id: str, user_id: str, payload: Any) -> None:
        """Fires an event asynchronously to all registered listeners."""
        if topic not in self._subscribers:
            return

        event = Event(
            topic=topic,
            object_name=object_name,
            tenant_id=tenant_id,
            user_id=user_id,
            payload=payload
        )

        for handler in self._subscribers[topic]:
            # Schedule execution on the event loop so it runs non-blocking in the background
            asyncio.create_task(self._safe_execute(handler, event))

    async def _safe_execute(self, handler: EventHandler, event: Event) -> None:
        """Executes event handlers safely without crashing the engine process."""
        try:
            if asyncio.iscoroutinefunction(handler):
                await handler(event)
            else:
                handler(event)
        except Exception as e:
            print(f"[EventBus Error] Exception handling '{event.topic}' on '{event.object_name}': {e}")
