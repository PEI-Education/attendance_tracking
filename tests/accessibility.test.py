"""Static accessibility contracts; live PowerSchool keyboard/screen-reader QA is separate."""
import collections
import re
import unittest
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGES = [
    'admin/students/pei_attendance_tracking.html',
    'teachers/studentpages/pei_attendance_tracking.html',
    'admin/pei_reports/attUpdateChecklist.html',
    'admin/pei_reports/attendance_tracking.html',
    'admin/pei_reports/attPrintLetters.html',
]


class Markup(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.tags = []
        source = re.sub(r'~\[tlist_sql;.*?\[/tlist_sql\]', '', source, flags=re.S)
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))


class AccessibilityTests(unittest.TestCase):
    def test_ids_are_unique_and_labels_have_targets(self):
        for page in PAGES:
            tags = Markup((ROOT / 'WEB_ROOT' / page).read_text()).tags
            ids = [attrs['id'] for _, attrs in tags if 'id' in attrs]
            self.assertEqual(len(ids), len(set(ids)), (page, collections.Counter(ids)))
            for tag, attrs in tags:
                if tag == 'label' and 'for' in attrs:
                    self.assertIn(attrs['for'], ids, page)

    def test_save_buttons_have_visible_localized_names_and_remain_mounted(self):
        for page in PAGES:
            source = (ROOT / 'WEB_ROOT' / page).read_text()
            for button in re.findall(r'<button\b.*?</button>', source, re.S):
                if 'fi-checkbox' in button:
                    self.assertIn('~[text:psx.htmlc.admin_attendance.attendance_tracking.save]', button, page)
                    self.assertIn('aria-hidden="true"', button, page)
                    self.assertNotIn('ng-if=', button, page)

    def test_radio_groups_and_contact_links_are_named(self):
        for page in PAGES:
            for tag, attrs in Markup((ROOT / 'WEB_ROOT' / page).read_text()).tags:
                if tag == 'sl-radio-group':
                    self.assertTrue(attrs.get('label'), page)
                if tag == 'img':
                    self.assertTrue(attrs.get('alt'), page)

    def test_native_print_controls_have_accessible_names(self):
        source = (ROOT / 'WEB_ROOT/admin/pei_reports/attPrintLetters.html').read_text()
        for tag, attrs in Markup(source).tags:
            if tag in ['input', 'select'] and attrs.get('type') != 'hidden':
                self.assertTrue(attrs.get('aria-label'), attrs)

    def test_plugin_css_does_not_target_host_navigation(self):
        for filename in ['pei_att_track.css', 'pei_att_track_print.css']:
            source = (ROOT / 'WEB_ROOT/images/css' / filename).read_text()
            source = re.sub(r'/\*.*?\*/', '', source, flags=re.S)
            for selector in re.findall(r'([^{}]+)\{', source):
                if selector.strip().startswith('@'):
                    continue
                for item in selector.split(','):
                    self.assertTrue(item.strip().startswith(('.pei-att-track ', 'body.pei-att-track')), item)
        for page in PAGES:
            self.assertIn('pei-att-track', (ROOT / 'WEB_ROOT' / page).read_text())


if __name__ == '__main__':
    unittest.main()
