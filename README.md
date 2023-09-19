# Attendance Concerns Checklist
Interface for tracking concerns and interventions relating to student attendance. Includes:
1. Individual student tracking interface for admin users
2. Individual student tracking interface for teacher users
3. Admin/bulk tracking interface:
   a. List of students with checklists
   b. Form letter generator
   c. Bulk checklist updater
   d. Links to admin interface on various pages including the homepage and the attendance page

## Dependencies
- psQuery by Jim Parsons (https://support.powerschool.com/exchange/view.action?download.id=846&fromSearchResults=true)
- Shoelace 2.0 (https://shoelace.style/)
- Foundations Icon Fonts 3 (https://zurb.com/playground/foundation-icon-fonts-3)

Shoelace, you can do without with some minor mods to the HTML and CSS of the section for the 3 parent calls. Foundations Icons were the cleanest set I could find for the various little graphics we needed (better than Bootstrap in this case), but you could swap in anything else that had a few key icon (X, check, save, file). alternateRow

psQuery, however, is pretty integral to the functioning of the plugin. Without it, you would need to either replicate its functionakity with a hidden form or find some way to include the right ID for a DirectTable.Select on U_PEI_ATT_TRACK. psQuery really shines with the bulk updates - a single call lets you iterate through an array of students and their related updates, so fast that I actually added a slight delay so that you actually see the loading timer.

## Version History
- 0.8 - Fixed bug for K-12 schools not showing anything on teacher input page
- 0.7 - Full suite ready for pilot use in production
- 0.5.2 - Admin-side checklist available for pilot use in production