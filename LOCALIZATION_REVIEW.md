# Localization review

Reviewed all five HTML pages, standalone JavaScript modules, six JSON files, and the related PowerSchool page-injection fragments. Existing PowerSchool-owned message keys remain in use; custom message references are checked against both catalogues in `MessageKeys`.

## Changes

- Reused existing keys for bulk-update controls and instructions, form-letter headings, dashboard notices, step choices, and success messages.
- Corrected missing/misspelled references, untranslated print-view suffixes, and stray visible characters.
- Added 17 keys per locale for missing labels, alerts, and export column headings. No duplicate keys were introduced.
- Corrected reversed French recipient messages, count placement, spelling, and French wording. All French catalogue values were reviewed. Shared words such as “Date” and “Notes”, proper names, email addresses, and template identifiers are intentionally retained where appropriate.
- Standalone scripts read translated text from hidden HTML elements through `peiAttTrack/messages`. Translations are not inserted into JavaScript string literals. Message placeholders are replaced explicitly.
- SQL step values and JSON tile labels remain stable data identifiers. The dashboard translates them before display/export. The filter map now matches the actual SQL strings, including “No steps taken”, calls with no contact, and referral status.
- Export column headings are now localized; field order and underlying numeric data are preserved. Consumers matching the old English/internal column headings will need to use the localized headings.

## Verification

Run `node --test tests/localization.test.cjs`.

Nine checks pass across English and French: catalogue parity and duplicates, custom references, placeholder parity, standalone JavaScript syntax, all SQL status mappings, all tile mappings, export headings, bulk-step labels/success counts, and student-page alert text. A source scan found no remaining hardcoded visible HTML text or label attributes, excluding SQL/template syntax.

These are local checks with simulated template substitution, not a live PowerSchool rendering test. Verify both locales on the deployed instance, especially the grid filter, tiles, export, bulk update, alerts, teacher term-name fallback, and print view.

## Confirmed integration details

- Both student pages now load the shared `peiAttTrack202610` controller. Each page supplies its exact relative JSON filename, including the teacher endpoint’s existing capitalization.
- All French support contacts now use `jhdoyle@edu.pe.ca` as confirmed. The teacher email subject and body now reuse existing message keys.

Existing SQL behavior, field mappings, date persistence, and unrelated working-tree changes were not revised as part of this localization review.

## Re-review after saved edits

Restored overwritten teacher-page and dashboard-controller localization using existing keys. Preserved the teacher page’s current term value, date-format SQL, email-date value, and other functional edits. Corrected message-bank placement in both student pages and added an inline-script syntax regression check. All nine local checks pass; live PowerSchool verification remains outstanding.

## Full source and catalogue audit — October 13, 2026

Reviewed all 43 HTML, JSON and JavaScript files, including bundled Shoelace modules, plus PowerSchool injection fragments. Both custom catalogues now contain the same 227 keys. Every custom reference resolves in both locales, and every catalogue key has a reference in shipped source outside HTML comments. Removed seven unused keys, including one referenced only by disabled bulk-notes forms. Added six keys per locale for the export filename, referral email row format, unexpected-error detail, board abbreviations and example email addresses.

French wording consistently uses « élève », « courriel », « enregistrer », « assiduité » and the existing « référence » terminology. Corrected the letter-request subject, requested-notification label, five-school-day instructions, paper dimensions, malformed closing markup, and references to CSLF that were absent from the corresponding English labels. French support contacts remain jhdoyle@edu.pe.ca; localized example addresses use example.com.

SQL/JSON status strings and tile identifiers are internal lookup values, localized at the display/export boundary; they are not translated in the endpoints. PowerSchool-owned psx.html.* keys remain delegated to the host catalogue, which is not included in this repository; their existence and translations require live verification. The vendored radio components contain no hardcoded natural-language labels; browser-native validation messages are supplied by the browser. Dates, user-entered notes, student/school names and report names remain data supplied by PowerSchool or its users.

The teacher page's numeric JavaScript suffix is intentional deployment cache busting and is preserved. Static JavaScript continues to use HTML message banks rather than server tags. Unexpected nonnumeric write errors now display localized feedback; numeric return codes remain visible. Referral emails retain the student_number search expression alongside a localized label.

Validation: 86 Node checks and 22 Python checks pass, including both language catalogues, all placeholders, status/tile/export mappings, email formatting, save feedback, JavaScript syntax, accessibility and SQL fixtures. A separate HTML-parser scan found no hardcoded natural-language text nodes or label/title/placeholder/alt/aria-label attributes after excluding server templates, SQL, scripts and styles. git diff --check passes. These are local checks; deployed template expansion and bilingual screen/print layout remain unverified.
