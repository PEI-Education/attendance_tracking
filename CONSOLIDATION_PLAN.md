# Proposed consolidation for discussion

Keep PowerSchool's supplied AngularJS 1.4.7 and the separate admin/teacher URLs.
The source organization can improve without changing the host framework or
assuming that PowerSchool expands template tags in standalone JavaScript.

## Implementation sequence

1. Establish a single source for checklist field names, types, SELECT ordering,
   and JSON output positions. Generate the admin/teacher row templates from it,
   retaining their portal-specific filters and paths.
2. Extract reusable source fragments for oldest-checklist selection, enrollment
   overlap, latest-enrollment ordering, and current-school visibility. Generate
   the deployed PSHTML/JSON files before packaging the plugin. Keep generated
   files in the repository so ordinary PowerSchool installation still works.
3. Add a generation check that fails when checked-in outputs differ from the
   shared source. Preserve the SQL and response contracts first; do not combine
   consolidation with query tuning.
4. Share workflow metadata for section names, form names, state fields and
   localized message IDs. Keep different portal permissions explicit. Continue
   resolving localized strings in HTML and reading its message bank from JS.
5. Consolidate page markup only after confirming the common workflows, keeping
   teacher restrictions, admin referral controls, print content, and form scope
   differences visible in review.

Build-time generation is the initial recommendation because it adds no runtime
template/include requirement. PowerSchool web-content includes are another
possibility, but cross-portal processing and SQL-fragment expansion would need a
small live proof before choosing that approach. Neither approach is implemented
by this proposal.

## Oracle execution-plan review

There is no live Oracle connection in this workspace. The SQLite fixtures verify
selection logic, not Oracle performance or PowerSchool template expansion.

Capture the actual rendered SQL and its school, student, year, term and filter
context for: a school dashboard, district dashboard, both summary variants,
one student's grade/checklist lookup, and a representative bulk selection.
Use the same data/context before and after any proposed optimization.

Ask the database administrator for the matching cursor plan, if available:

```sql
SELECT *
FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR(
    :sql_id, :child_number, 'ALLSTATS LAST +PREDICATE +ALIAS'
));
```

Actual row statistics require statistics to have been collected for that
execution. Otherwise an estimated `EXPLAIN PLAN` is a useful first step, but does
not establish actual elapsed time or rows processed. Explain-plan capture writes
to a plan table and requires the appropriate database permissions.

Review these concrete questions:

- Are student, school, year and term restrictions applied before large scans or
  analytic sorts, especially for a single-student grade lookup?
- How does Oracle expand `ps_schoolenrollment`, and which underlying tables and
  existing indexes does it use?
- Do estimated and actual row counts differ substantially? Are window sorts
  spilling to temporary storage? Are repeated starts or buffer reads excessive?
- Do the `EXISTS` summary checks avoid enrollment multiplication as intended?
- Are full scans appropriate for district-wide requests, rather than assuming
  every full scan is a problem?

Only then propose a query change or index, with result parity, elapsed time,
buffer reads, and plan evidence. Do not add indexes to PowerSchool-managed tables
or assume a view can be indexed without checking its structure and the supported
deployment path. No indexes or optimizer hints have been added.

## AngularJS compatibility

AngularJS 1.4.7 already supports `$http` promises and `$q` cleanup. Use
`.then()`, `.catch()` and `.finally()` within this plugin, without changing global
HTTP configuration that might affect PowerSchool's code. Keep database callback
wrappers on `$q` so their results participate in Angular's digest cycle. Network
and uncertain write outcomes remain distinct; never automatically retry a write
whose result is unknown.

Sources: [AngularJS 1.4.7 HTTP implementation](https://github.com/angular/angular.js/blob/v1.4.7/src/ng/http.js),
[AngularJS 1.4.7 promises](https://github.com/angular/angular.js/blob/v1.4.7/src/ng/q.js),
[Oracle DBMS_XPLAN documentation](https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/DBMS_XPLAN.html).
