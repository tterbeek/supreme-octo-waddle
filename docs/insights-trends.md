# Insights: Trends periods

The top-right Year / Month / Week dropdown controls all activity trend charts.
Week remains the default and retains the current week plus nine previous weeks.
Month includes the current calendar month and eleven previous months, showing
only buckets with a logged measurement. Year includes every recorded year with
measurements. Future-dated activities are excluded. Weeks start on Monday;
calendar bounds use the browser's IANA timezone, with UTC fallback.

Distance and duration are summed independently. A missing measurement does not
become zero; an explicitly logged zero remains visible. Metric toggles, enabled
activity-type ordering, default-metric preferences and imperial conversions are
preserved. Labels and tooltips follow the selected period. The current partial
period retains the existing separate-point presentation.

`stats_activity_trends` aggregates both metrics in one request, avoiding raw
history downloads, row-cap truncation and extra requests on metric toggles. It
uses the signed-in account and existing activity RLS. Old weekly RPCs remain
available to older clients. Period changes cancel stale UI updates and clear
the previous series while loading.

Apply `20261027050000_trend_periods.sql` before deploying the frontend:

```bash
npx supabase migration up --local
```

For a separately authorized production rollout, use `npx supabase db push
--linked` before publishing the frontend. No Edge Function changes or new secrets
are needed. The normal local development stack was stopped during implementation;
the migration was verified in the isolated schema checker, not applied to that
stopped stack or to production.

Verification: 161 unit tests, complete isolated migration replay/database checks,
production build, focused lint and 21 browser assertions. Browser fixtures cover
mobile/desktop layouts, month gaps, historical years, metric toggles without
refetching, units, rapid switching, error recovery and empty/enlarged-text states.
Screenshots: `/tmp/movenotes-trends-previews`. The fixtures are fictional; live
production performance and large real histories were not measured.
