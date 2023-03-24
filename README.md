# attendance_tracking
Attendance Tracking Interface for PSB schools.

## v1 components
- **DB Extention Schema** - Adds a new one-to-many table that extends students, allowing each student to have a checklist for each FY term (K-9) or semester (10-12) that starts fresh each term but is maintained for the historical record.
- **Student Checklist** - Currently admin-only, with a teacher interface to follow shortly. The interface is not currently printer-friendly - a fix for this is in progress.

## Future components
- **Teacher interface** - Similar to the admin, but further restricted to only the steps that teachers can take action on. Everything else is displaye in read-only
- **Admin Reporting & Bulk Actions** - Find batches of students at the same step in the process and performing actions on them as a group, including printing form letters and updating checklists.

## Dependencies
- **psQuery** - psQuery must be installed on the PowerSchool server for this plugin to work. You can download it from [PowerSource](https://support.powerschool.com/exchange/view.action?download.id=846)

## Change History
- 2023-03-24 - v1 installed on production