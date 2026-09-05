# Reliable playback controls

Pause can be intercepted by the Apple adapter after playback falls back to direct audio. Core navigation bypasses provider routing, and asynchronous loads can finish after a newer selection. Fix these controls without changing Ámpula Core, storage keys, import semantics or sharing.

Success: pause/resume reaches the actual provider; next/previous and row selection use the preferred provider; switching stops previous audio; obsolete loads cannot replace the latest selection; system media controls recognize provider-specific statuses.
