# Design

Keep the existing adapters and give them explicit suspension/ownership hooks. Route core track changes through the public playIndex entry. Each asynchronous adapter uses a generation to discard obsolete completion work. Apple capture handles its own session and delegates an active direct fallback to the direct adapter. Suspend YouTube before another provider starts and suppress its inactive events/progress.

Retain provider-independent Core and all storage keys. No new startup dependency. Requests may complete in the background but must check generation before starting audio or changing the UI. Provider availability remains external; tests use deterministic provider fakes.
