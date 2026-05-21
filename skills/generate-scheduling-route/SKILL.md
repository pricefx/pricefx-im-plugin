---
name: generate-scheduling-route
description: Use when an existing Pricefx Integration Manager route should only run during a defined time window (e.g., 23:00-06:00 UTC) — says "restrict to off-peak hours", "avoid overlap with business hours", "reduce resource contention", "add start/stop schedule", or wants Quartz-based activation control around an existing long-running route.
---

# Generate Scheduling Route (Start/Stop Time Window)

You are adding time-window scheduling to a Pricefx Integration Manager route. Follow the steps below. The target route will be controlled by two new Quartz scheduler routes.

## Step 1: Gather Information

Ask the user for the following (or read from `$ARGUMENTS` if already provided):

1. **Route ID to schedule** — the existing route ID that should only run during the time window (e.g., `import-products`). The route XML file must already exist.
2. **Start time** — when to start the route (e.g., `23:00`). In 24-hour format.
3. **Stop time** — when to stop the route (e.g., `06:00`). In 24-hour format.
4. **Timezone** — the timezone for both cron expressions (e.g., `UTC`, `Europe/Prague`, `America/New_York`). Default: `UTC`.
5. **Days of week** (optional) — restrict to specific days? Default: every day (`?`).

If `$ARGUMENTS` already specifies the route ID, skip asking for it.

## Step 2: Convert to Quartz Cron Expressions

Quartz cron format: `seconds minutes hours dayOfMonth month dayOfWeek`

**Important:** Use `+` instead of spaces in the Quartz URI (URL-safe format for XML attributes).

| User input | Cron (URI-safe, `+` as separator) |
|---|---|
| 23:00 every day | `0+0+23+?+*+*` |
| 06:00 every day | `0+0+6+?+*+*` |
| 02:30 Mon-Fri only | `0+30+2+?+*+MON-FRI` |
| 08:00 every day | `0+0+8+?+*+*` |

Present the derived cron expressions to the user for confirmation before generating files.

## Step 3: Read and Update the Target Route

1. Read the existing route file for `{ROUTE_ID}`.
2. Find the `<route id="{ROUTE_ID}"` element.
3. Write the updated file back.

## Step 4: Generate the Scheduler Routes

Create file: `src/main/resources/repo/routes/schedule-{ROUTE_ID}.xml`

```xml
<routes xmlns="http://camel.apache.org/schema/spring">

  <!-- Start {ROUTE_ID} at {{schedule.{ROUTE_ID}.start.cron}} -->
  <route id="start-{ROUTE_ID}">
    <from uri="quartz://scheduler-start-{ROUTE_ID}?cron={{schedule.{ROUTE_ID}.start.cron}}&amp;trigger.timeZone={{schedule.{ROUTE_ID}.timezone}}&amp;stateful=true"/>
    <log message="[start-{ROUTE_ID}] Starting {ROUTE_ID} at ${date:now:HH:mm z}" loggingLevel="INFO"/>
    <toD uri="controlbus:route?routeId={ROUTE_ID}&amp;action=start"/>
  </route>

  <!-- Stop {ROUTE_ID} at {{schedule.{ROUTE_ID}.stop.cron}} -->
  <route id="stop-{ROUTE_ID}">
    <from uri="quartz://scheduler-stop-{ROUTE_ID}?cron={{schedule.{ROUTE_ID}.stop.cron}}&amp;trigger.timeZone={{schedule.{ROUTE_ID}.timezone}}&amp;stateful=true"/>
    <log message="[stop-{ROUTE_ID}] Stopping {ROUTE_ID} at ${date:now:HH:mm z}" loggingLevel="INFO"/>
    <toD uri="controlbus:route?routeId={ROUTE_ID}&amp;action=stop"/>
  </route>

</routes>
```

Replace `{ROUTE_ID}` with the actual route ID provided by the user.

## Step 5: Add Properties

Add to `src/main/resources/repo/config/application.properties`:

```properties
# Scheduling window for {ROUTE_ID}
# Cron format: seconds+minutes+hours+dayOfMonth+month+dayOfWeek (Quartz, + as space)
schedule.{ROUTE_ID}.start.cron=0+0+23+?+*+*
schedule.{ROUTE_ID}.stop.cron=0+0+6+?+*+*
schedule.{ROUTE_ID}.timezone=UTC
```

Replace the cron values with those confirmed in Step 2.

## Step 6: Verify

After generating, confirm:

1. The scheduler file `schedule-{ROUTE_ID}.xml` has two routes: `start-{ROUTE_ID}` and `stop-{ROUTE_ID}`.
2. Both scheduler routes use `stateful=true` on the Quartz URI.
5. `trigger.timeZone` is set on both Quartz URIs.
6. Properties are present in `application.properties`.
7. Route IDs match file names:
   - `schedule-{ROUTE_ID}.xml` → routes `start-{ROUTE_ID}` and `stop-{ROUTE_ID}`

Report any issues found and fix them.

## Cron Quick Reference

| Schedule | Cron (URI-safe) |
|---|---|
| Every day at 23:00 | `0+0+23+?+*+*` |
| Every day at 06:00 | `0+0+6+?+*+*` |
| Every day at 02:30 | `0+30+2+?+*+*` |
| Mon-Fri at 22:00 | `0+0+22+?+*+MON-FRI` |
| Every 2 hours | `0+0+0/2+?+*+*` |

## Important Rules

- ALWAYS set `stateful=true` on both Quartz URIs — without it, overlapping scheduler firings can start or stop the route multiple times simultaneously
- ALWAYS set `trigger.timeZone` explicitly — omitting it causes cron to fire in the JVM default timezone, which may differ between environments
- Use `+` instead of spaces in cron expressions within XML URI attributes — spaces in URIs cause parse errors
- `controlbus:route?routeId=...&action=start/stop` is graceful — in-progress exchanges complete before the route is stopped; no data loss occurs
- Use `<toD>` not `<to>` for the controlbus URI — the routeId is a literal string but `toD` allows future dynamic use
- NEVER put the `routeId` in a property placeholder for the controlbus call — it must be the literal route ID
- Both scheduler routes should reference the SAME timezone property — divergent timezone settings cause a split window
- Quartz scheduler name (the path segment in `quartz://scheduler-start-{ROUTE_ID}`) must be globally unique across all routes in the project; include the route ID in the name to avoid conflicts

## References

- [Scheduling Start/Stop Pattern](../../../integration-manager/docs/patterns/scheduling-start-stop.md)
- [PA Import Integration](../generate-pa-import-integration/SKILL.md) — example of a long-running route that benefits from scheduling
