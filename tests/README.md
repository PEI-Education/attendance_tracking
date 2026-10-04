# Local checks

Run from the project root:

```sh
TZ=America/Halifax node --test tests/*.test.cjs
for test_file in tests/*.test.py; do
    python3 "$test_file" || exit 1
done
git diff --check
```

Behavioral tests cover locale-specific dates and outbound save formats, failed
and uncertain writes, duplicate submissions, preserving drafts, notification
transitions/retries, partial bulk results, HTTP failures, overlapping reads,
and recovery after unsuccessful loads. Mapping and enrollment fixtures check
the SQL/JSON contracts. Static accessibility tests cover names, label targets,
unique IDs and stylesheet isolation.

The Node tests use promise-compatible test doubles, not a full PowerSchool
runtime. The SQL fixtures use SQLite substitutions, not Oracle query plans.
An isolated teacher-page preview was also inspected using AngularJS 1.4.7 with
fictional data; it cannot reproduce PowerSchool's global CSS, date widgets,
permissions or template renderer.

Before release, verify both portals in English and French on PowerSchool:

- Tab through the form; check visible focus, radio labels, notes errors and Save
  button names with a screen reader. Ensure host navigation styling is unchanged.
- Confirm Save stays present while pending, failed saves preserve edits, and
  keyboard submission fires once. Check bulk retries after mixed outcomes.
- Simulate failed reads and verify localized retry feedback, then successful
  recovery. Verify letter/referral writes and dates against actual psQuery.
- Inspect Print View and the longer French labels with real host styling.
