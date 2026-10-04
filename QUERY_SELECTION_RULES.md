# Checklist and enrollment selection

School-level visibility uses the student's current `Students.SchoolID`. Checklist
records do not contain an originating school, so this implements the user's
approved fallback. District-level admin reports retain their district-wide view.
Historical enrollment at a school does not by itself grant school-level visibility.

For each student and checklist term, select the oldest checklist using
`whencreated ASC NULLS LAST, id ASC`. Rank checklists before joining enrollment
data. This selects a consistent existing record; it does not delete duplicates
or prevent concurrent inserts.

An enrollment qualifies for the selected academic year when its `yearid` matches
and it overlaps that school's full-year Terms record (`id = yearid * 100`):

```sql
entrydate < school_year.lastday
AND exitdate > school_year.firstday
AND entrydate < exitdate
```

These strict boundaries also apply when viewing a semester checklist. They do
not restrict enrollment to the semester dates. Summary counts and the admin home
notice use `EXISTS` so multiple qualifying enrollments cannot multiply counts.

The grid and student pages use the latest qualifying enrollment, ordered by
entry date descending, then exit date descending. School ID ascending, grade
descending with nulls last, and school name ascending with nulls last break date
ties consistently. Exact duplicate rows have identical displayed values.
This selection is across schools in the selected year: historical school/grade
can differ from the student's current school/grade. Current-school visibility
is checked separately.

The teacher term lookup uses this enrollment grade for both the year/semester
decision and the displayed grade. Missing enrollment prevents loading/saving.
Term date rules and the outgoing `mm/dd/yyyy` save format remain unchanged.

Local fixture tests execute the portable SQL with known PowerSchool macros
substituted. PowerSchool parsing and Oracle execution still require live checks.
