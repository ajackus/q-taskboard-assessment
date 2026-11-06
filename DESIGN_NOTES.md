# Design Notes: Activity Feed Write Failures

**Decision**: The original change (task creation, update, comment) should **NOT** roll back if the activity log write fails.

**Reasoning**: In a project management application, the core user flow—managing and updating tasks—is mission-critical and must remain highly available. The audit trail, while valuable for transparency, is a secondary feature. Rolling back a successful task update because the activity database experienced a transient issue would create a frustrating user experience. Therefore, we use a "best effort" approach (fire-and-forget or try/catch) for logging activities so that primary mutations can succeed independently.
