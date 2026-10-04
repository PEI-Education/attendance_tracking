"""Exercise the dashboard's actual SQL CASE expressions using SQLite fixtures.
This checks portable CASE/COALESCE logic, not PowerSchool rendering or Oracle joins.
Run: python3 tests/referral-query.test.py
"""
import re
import sqlite3
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SQL = (ROOT / 'WEB_ROOT/admin/pei_reports/json/attendance_tracking.json').read_text()
LABEL = re.search(r"case\s+when u.referral.*?end as current_step,", SQL, re.S)[0][:-1]
INDEX = re.search(r"case\s+when u.referral = 2 then 16.*?end as current_step_idx,", SQL, re.S)[0][:-1]
DATE = re.search(r"coalesce\(case when u.referral.*?\) action_date,", SQL, re.S)[0][:-1]
FIELDS = set(re.findall(r'u\.(\w+)', LABEL + INDEX + DATE))

class ReferralQueryTests(unittest.TestCase):
    def evaluate(self, **changes):
        values = {key: None if key.endswith('_date') else 0 for key in FIELDS}
        values.update(changes)
        with sqlite3.connect(':memory:') as db:
            row = ', '.join(f':{key} AS {key}' for key in values)
            return db.execute(f'SELECT {LABEL}, {INDEX}, {DATE} FROM (SELECT {row}) u', values).fetchone()

    def test_closed_referral_takes_precedence_and_matches_tile_filter(self):
        result = self.evaluate(referral=2, concern_4=2, referral_date='2026-09-23', referral_closed_date='2026-10-04')
        self.assertEqual(result, ('Referral closed', 16, '2026-10-04'))
        # The grid takes no URL parameters into SQL; the "Referral Closed" tile filters on this index.
        self.assertNotIn('gpv.step', SQL)
        tiles = (ROOT / 'WEB_ROOT/scripts/components/attTrack/directives/attTiles.js').read_text()
        self.assertIn("{ id: 16, prefix_name: 'Referral', name: 'Closed' }", tiles)

    def test_open_or_reopened_referral_ignores_old_closure_date(self):
        result = self.evaluate(referral=1, concern_4=2, referral_date='2026-10-04', referral_closed_date='2026-09-23')
        self.assertEqual(result, ('Referred to Director', 15, '2026-10-04'))
        self.assertNotEqual(result[1], 16)

    def test_missing_closure_date_falls_back_and_earlier_steps_still_work(self):
        self.assertEqual(self.evaluate(referral=2, referral_date='2026-09-23'), ('Referral closed', 16, '2026-09-23'))
        self.assertEqual(self.evaluate(concern_4=2, concern_4_sent_date='2026-09-22'), ('Letter 3 sent', 14, '2026-09-22'))
        self.assertEqual(self.evaluate(), ('No steps taken', 1, None))

if __name__ == '__main__':
    unittest.main()
