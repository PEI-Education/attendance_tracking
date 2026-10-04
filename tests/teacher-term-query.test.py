"""Check the actual teacher lookup predicates against SQLite term fixtures.
PowerSchool macro rendering and Oracle execution still require live verification.
Run: python3 tests/teacher-term-query.test.py
"""
import re
import sqlite3
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / 'WEB_ROOT/teachers/studentpages/pei_attendance_tracking.html').read_text()
QUERY = re.search(r'~\[tlist_sql;(.*?);nonemessage=\]', HTML, re.S)[1]
QUERY = QUERY.replace("TO_DATE('~[date]', '~[dateformat]')", ':today')
for macro, parameter in [('curstudid', 'student'), ('curschoolid', 'school'), ('curyearid', 'year')]:
    QUERY = QUERY.replace(f'~({macro})', f':{parameter}')


class TeacherTermQueryTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.addCleanup(self.db.close)
        self.db.executescript('''
            CREATE TABLE students (id INTEGER, grade_level INTEGER, schoolid INTEGER);
            INSERT INTO students VALUES (123, 11, 100);
            CREATE TABLE ps_schoolenrollment (studentid INTEGER, grade_level INTEGER, schoolid INTEGER, schoolname TEXT, yearid INTEGER, entrydate TEXT, exitdate TEXT);
            INSERT INTO ps_schoolenrollment VALUES (123, 11, 100, 'School', 36, '2026-09-01', '2027-07-01');
            CREATE TABLE terms (id INTEGER, name TEXT, schoolid INTEGER, yearid INTEGER, firstday TEXT, lastday TEXT);
            INSERT INTO terms VALUES
              (3600, 'Year', 100, 36, '2026-09-01', '2027-06-30'),
              (3601, 'Semester 1', 100, 36, '2026-09-01', '2027-01-31'),
              (3602, 'Semester 2', 100, 36, '2027-02-01', '2027-06-30'),
              (3603, 'Quarter', 100, 36, '2026-09-01', '2026-11-15'),
              (3601, 'Other school', 200, 36, '2026-09-01', '2027-01-31'),
              (3501, 'Earlier year', 100, 35, '2025-09-01', '2026-01-31');
        ''')

    def lookup(self, grade, today):
        self.db.execute('UPDATE ps_schoolenrollment SET grade_level = ?', (grade,))
        return self.db.execute(QUERY, dict(student=123, school=100, year=36, today=today)).fetchall()

    def test_grades_zero_through_nine_always_use_selected_year(self):
        for grade in range(10):
            for today in ['2026-08-01', '2026-10-04', '2027-03-01', '2027-07-01']:
                with self.subTest(grade=grade, today=today):
                    self.assertEqual(self.lookup(grade, today), [(3600, 'Year', grade)])

    def test_high_school_semester_boundaries_and_exclusion_of_quarters(self):
        for grade in range(10, 13):
            for today, term, name in [
                ('2026-09-01', 3601, 'Semester 1'), ('2026-10-04', 3601, 'Semester 1'),
                ('2027-01-31', 3601, 'Semester 1'), ('2027-02-01', 3602, 'Semester 2'),
                ('2027-06-30', 3602, 'Semester 2')
            ]:
                with self.subTest(grade=grade, today=today):
                    self.assertEqual(self.lookup(grade, today), [(term, name, grade)])

    def test_no_matching_semester_or_unsupported_grade_returns_no_row(self):
        for grade, today in [(10, '2026-08-31'), (12, '2027-07-01'), (-1, '2026-10-04'), (13, '2026-10-04')]:
            self.assertEqual(self.lookup(grade, today), [])

    def test_overlapping_or_duplicate_terms_do_not_choose_arbitrarily(self):
        self.db.execute("UPDATE terms SET firstday = '2027-01-31' WHERE id = 3602")
        self.assertEqual(self.lookup(11, '2027-01-31'), [])
        self.db.execute('INSERT INTO terms SELECT * FROM terms WHERE id = 3600')
        self.assertEqual(self.lookup(9, '2026-10-04'), [])

    def test_teacher_uses_enrollment_grade_and_current_school_visibility(self):
        self.db.execute('UPDATE students SET grade_level = 12')
        self.assertEqual(self.lookup(9, '2026-10-04'), [(3600, 'Year', 9)])
        self.db.execute('UPDATE students SET schoolid = 200')
        self.assertEqual(self.lookup(11, '2026-10-04'), [])
        self.db.execute('UPDATE students SET schoolid = 100')
        self.db.execute('DELETE FROM ps_schoolenrollment')
        self.assertEqual(self.lookup(11, '2026-10-04'), [])


class TeacherEndpointTermTests(unittest.TestCase):
    def test_endpoint_resolves_the_same_term_without_url_input(self):
        endpoint = (ROOT / 'WEB_ROOT/teachers/studentpages/json/pei_AttTrack.json').read_text()
        self.assertNotIn('gpv', endpoint)
        lookup = re.search(r'~\[tlist_sql;(.*?);nonemessage=\]', HTML, re.S)[1]
        rules = lambda sql: re.search(r'FROM terms t.*?HAVING COUNT\(\*\) = 1', sql, re.S)[0]
        self.assertEqual(rules(endpoint), rules(lookup))


if __name__ == '__main__':
    unittest.main()
