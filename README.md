# Attendance Tracking Interface for PSB
Interface for tracking concerns and interventions relating to student attendance. Includes:
1. Individual student tracking interface for admin users
2. Individual student tracking interface for teacher users

## Dependencies
- psQuery by Jim Parsons (https://support.powerschool.com/exchange/view.action?download.id=846&fromSearchResults=true)
- Shoelace 2.0 (https://shoelace.style/)

Shoelace, you can do without with some minor mods to the HTML and CSS of the section for the 3 parent calls. psQuery, however, is pretty integral to the functioning of the plugin. Without it, you would need to either replicate its functionakity with a hidden form or find some way to include the right ID for a DirectTable.Select on U_PEI_ATT_TRACK