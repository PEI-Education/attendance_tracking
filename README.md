# Attendance Concerns Checklist

Interface for tracking concerns and interventions relating to student attendance. Includes:

1. Individual student tracking interface for admin users (English/French)
2. Individual student tracking interface for teacher users (English/French)
3. Admin/bulk tracking interface:
   a. List of students with checklists
   b. Form letter generator
   c. Bulk checklist updater
   d. Links to admin interface on various pages including the homepage and the attendance page

## Dependencies

- psQuery by Jim Parsons (<https://support.powerschool.com/exchange/view.action?download.id=846&fromSearchResults=true>)
- Shoelace 2.0.0 (<https://shoelace.style/>), radio components only, bundled in `WEB_ROOT/scripts/peiAttTrack/shoelace-2.0.0` (no CDN)

Optional: Shoelace, you can do without with some minor mods to the HTML and CSS of the section for the 3 parent calls. Icons (check, X, save, print, flag, group) are inline SVGs, so no icon font or stylesheet is needed.

Required: psQuery is integral to the functioning of the plugin. Without it, you would need to either replicate its functionakity with a hidden form or find some way to include the right ID for a DirectTable.Select on U_PEI_ATT_TRACK. psQuery really shines with the bulk updates - a single call lets you iterate through an array of students and their related updates, so fast that I actually added a slight delay so that you actually see the loading timer.

## Version History

- 2026.10.0 - Security: the plugin reads no URL parameters (terms resolved server-side; dashboard filters in the browser; bulk update uses its own selection endpoint). Dashboard tiles count students currently at each step. Restored the student number in referral emails and fixed CSLF referral recipients. Bulk update: Call 1 accepts students with no steps, saves require a set step with staff and date, and referrals send one summary email per board. Teacher referral display and print view fixes. The attendance page's action button counts the current term, like the home page notice. Shoelace bundled locally; icons are inline SVGs.
- 2026.9.0 - Fixed issue with French date processing introduced with switch to jj/mm/aaaa format in FR locale. Also added remainder of message keys for translation.
- 2024.3.2 - Added message keys and French translations to student checklist interfaces (admin and teacher portals)

> Note: After 0.10, version numbering scheme was changed to match the year and month of the release. This is to simplify, clarify, better align with the versioning scheme of PowerSchool itself.

- 0.10 - Added email to director on referral, and eliminated largely duplicative controllers
- 0.9 - Added automatic email notifications to teacher interface
- 0.8 - Fixed bug for K-12 schools not showing anything on teacher input page
- 0.7 - Full suite ready for pilot use in production
- 0.5.2 - Admin-side checklist available for pilot use in production
