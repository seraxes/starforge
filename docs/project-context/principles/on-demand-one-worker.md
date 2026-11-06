# On Demand — one cloud worker

**When:** Always for this Project, unless Zoltan explicitly overrides for a named exception.

**Rule:** At most one cloud worker may run at a time. No parallel PR workers, no stacked explore/subagent fan-out to accelerate the same wave, no second agent “while CI waits.”

**After stop conditions:** Worker ERROR, On Demand balance scare, or spend complaint → coordinator pauses. Resume only on explicit opt-in.

**Prefer local:** Connected self-hosted / local for small UI nits (padding, empty-state title, copy). Cloud VMs are for coherent PR slices that need a full checkout + CI path.

**Stopping boundary:** Does not ban the Project coordinator itself; bans multiplying child cloud agents and long idle VMs. Does not require refusing work — only serializing and waiting when spend is at risk.
