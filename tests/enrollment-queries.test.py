"""Run portable query logic using fixtures; not a PowerSchool/Oracle integration test."""
import re
import sqlite3
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def sql_blocks(path):
    source = (ROOT / 'WEB_ROOT' / path).read_text()
    return re.findall(r'~\[tlist_sql;(.*?)(?:;nonemessage=[^\]]*\]|\n\s*\])', source, re.S)


def fixture_sql(sql, school=100, term=3601, student=1):
    # Explicitly substitute the known PS conditionals, not a general PS renderer.
    sql = re.sub(r'~\[if(?:#\w+)?\.is\.a\.school\](.*?)\[/if(?:#\w+)?\]',
                 lambda m: m[1] if school else '', sql, flags=re.S)
    sql = re.sub(r'~\[if\.~\(gpv\.(?:update|step|exact).*?\[/if\]', '', sql, flags=re.S)
    for tag, value in [('curtermid', term), ('gpv.term', term), ('curyearid', term // 100), ('curschoolid', school), ('curstudid', student)]:
        sql = sql.replace(f'~({tag})', str(value))
    sql = sql.replace('~[dateformat]', 'mm/dd/yyyy')
    if 'order by term_grade, last_name]' in sql:
        sql = sql.split('order by term_grade, last_name]')[0] + 'order by term_grade, last_name'
    return sql.strip().rstrip(';')


class EnrollmentQueryTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.addCleanup(self.db.close)
        self.db.create_function('nvl', 2, lambda value, fallback: fallback if value is None else value)
        self.db.create_function('to_char', 2, lambda value, fmt: value)
        schema = ET.parse(ROOT / 'user_schema_root/u_pei_att_track.xml')
        self.defaults = {field.attrib['name']: 0 if field.attrib['type'] == 'Integer' else None
                         for field in schema.findall('.//{http://www.powerschool.com}field')}
        self.defaults.update(id=None, studentsdcid=None, whencreated='2026-09-01')
        columns = ', '.join(f'{key} {"INTEGER" if isinstance(value, int) or key in ["id", "studentsdcid"] else "TEXT"}'
                            for key, value in self.defaults.items())
        self.db.execute(f'CREATE TABLE u_pei_att_track ({columns})')
        self.db.executescript('''
            CREATE TABLE students (id INTEGER, dcid INTEGER, schoolid INTEGER, grade_level INTEGER,
                                   student_number INTEGER, first_name TEXT, last_name TEXT);
            CREATE TABLE terms (id INTEGER, yearid INTEGER, schoolid INTEGER, firstday TEXT, lastday TEXT);
            INSERT INTO terms VALUES
                (3600,36,100,'2026-09-01','2027-06-30'), (3601,36,100,'2026-09-01','2027-01-31'),
                (3600,36,200,'2026-09-01','2027-06-30'), (3601,36,200,'2026-09-01','2027-01-31');
            CREATE TABLE ps_schoolenrollment (studentid INTEGER, schoolid INTEGER, schoolname TEXT,
                                            yearid INTEGER, grade_level INTEGER, entrydate TEXT, exitdate TEXT);
        ''')

    def add_student(self, student=1, current_school=100, grade=12):
        self.db.execute('INSERT INTO students VALUES (?,?,?,?,?,?,?)', (student, student + 100, current_school, grade, student + 1000, 'First', str(student)))

    def enroll(self, student=1, school=100, grade=11, entry='2026-09-01', exit='2027-07-01', year=36):
        self.db.execute('INSERT INTO ps_schoolenrollment VALUES (?,?,?,?,?,?,?)', (student, school, str(school), year, grade, entry, exit))

    def checklist(self, student=1, **changes):
        values = dict(self.defaults, id=student * 10, studentsdcid=student + 100, termid=3601)
        values.update(changes)
        self.db.execute(f'INSERT INTO u_pei_att_track ({", ".join(values)}) VALUES ({", ".join("?" for _ in values)})', list(values.values()))

    def query(self, path, branch=0, **context):
        return self.db.execute(fixture_sql(sql_blocks(path)[branch], **context)).fetchall()

    def grid(self, **context):
        return self.query('admin/pei_reports/json/attendance_tracking.json', **context)

    def summary(self, branch=0, **context):
        return self.query('admin/pei_reports/json/attendance_summary.json', branch=branch, **context)[0]

    def test_transfer_is_visible_only_at_current_school_and_counted_once(self):
        self.add_student(current_school=200)
        self.enroll(school=100, grade=12, exit='2026-10-01')
        self.enroll(school=200, grade=11, entry='2026-10-01')
        self.enroll(school=200, grade=11, entry='2026-10-01')  # duplicate enrollment
        self.checklist(concern_2=1)
        self.checklist(id=11, whencreated='2026-10-02', referral=2)
        self.checklist(id=1, whencreated=None, concern_4=2)
        self.assertEqual(self.grid(school=100), [])
        self.assertEqual(self.summary(school=100)[0], 0)
        for school in [200, 0]:
            rows = self.grid(school=school)
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0][0], 10)
            self.assertEqual(rows[0][7], 11)  # latest grade, not highest/current grade
            self.assertEqual(rows[0][9], 200)
            self.assertEqual(self.summary(school=school)[0], 1)
            self.assertEqual(self.summary(school=school)[5], 1)  # first letter requested
            self.assertEqual(self.summary(school=school)[12], 0)  # duplicate's closure ignored
        for portal in ['admin/students/json/pei_attTrack.json', 'teachers/studentpages/json/pei_AttTrack.json']:
            self.assertEqual(self.query(portal, school=100), [])
            self.assertEqual(self.query(portal, school=200)[0][0], 10)
        self.assertEqual(self.query('admin/students/json/pei_attTrackGrade.json', school=200), [(11,)])
        self.assertEqual(self.query('admin/students/pei_attendance_tracking.html', school=200), [(11,)])
        self.assertEqual(self.query('admin/students/json/pei_attTrackGrade.json', school=100), [])
        notice = self.query('admin/home.peiAttTrack.content.footer.txt', school=200)
        self.assertEqual(notice, [(1, 0, 0)])

    def test_overlap_uses_full_year_and_excludes_invalid_enrollment_intervals(self):
        intervals = [
            ('2026-08-01', '2026-09-02', 36, True),
            ('2027-02-01', '2027-07-01', 36, True),  # after semester 1, within school year
            ('2026-08-01', '2026-09-01', 36, False),
            ('2027-06-30', '2027-07-01', 36, False),
            ('2026-10-01', '2026-10-01', 36, False),
            ('2026-10-02', '2026-10-01', 36, False),
            ('2026-09-01', '2027-07-01', 35, False),
        ]
        for student, (entry, exit, year, _) in enumerate(intervals, 1):
            self.add_student(student)
            self.enroll(student, entry=entry, exit=exit, year=year)
            self.checklist(student)
        self.assertEqual([row[2] for row in self.grid()], [101, 102])
        self.assertEqual(self.summary()[0], 2)
        for student in [1, 2]:
            self.assertEqual(self.query('admin/students/json/pei_attTrackGrade.json', student=student), [(11,)])
        for student in range(3, 8):
            self.assertEqual(self.query('admin/students/json/pei_attTrackGrade.json', student=student), [])

    def test_historical_school_is_not_used_to_grant_visibility(self):
        self.add_student(current_school=200)
        self.enroll(school=100)
        self.checklist()
        self.assertEqual(self.grid(school=100), [])
        self.assertEqual(self.grid(school=200)[0][9], 100)
        self.assertEqual(self.summary(school=200)[0], 1)
        self.assertEqual(self.query('admin/students/json/pei_attTrackGrade.json', school=200), [(11,)])

    def test_full_year_summary_also_matches_grid(self):
        self.add_student(grade=8)
        self.enroll(grade=8)
        self.checklist(termid=3600, referral=2)
        self.checklist(id=11, termid=3600, whencreated='2026-09-02', referral=0)
        self.assertEqual(self.summary(branch=1, term=3600)[0], len(self.grid(term=3600)))
        self.assertEqual(self.summary(branch=1, term=3600)[11], 1)


class ChecklistSelectionTests(unittest.TestCase):
    def test_all_readers_choose_oldest_with_id_tiebreak_before_enrollment(self):
        paths = [
            'admin/students/json/pei_attTrack.json',
            'teachers/studentpages/json/pei_AttTrack.json',
            'admin/pei_reports/json/attendance_tracking.json',
            'admin/pei_reports/json/attendance_summary.json',
            'admin/home.peiAttTrack.content.footer.txt',
        ]
        with sqlite3.connect(':memory:') as db:
            db.executescript('''
                CREATE TABLE u_pei_att_track (id INTEGER, studentsdcid INTEGER, termid INTEGER, whencreated TEXT);
                INSERT INTO u_pei_att_track VALUES
                    (10, 101, 3601, '2026-09-01'), (11, 101, 3601, '2026-09-01'),
                    (12, 101, 3601, '2026-10-01'), (1, 101, 3601, NULL),
                    (20, 101, 3602, '2027-02-01'), (21, 101, 3602, '2027-03-01'),
                    (30, 102, 3601, NULL), (31, 102, 3601, NULL);
            ''')
            for path in paths:
                source = (ROOT / 'WEB_ROOT' / path).read_text()
                ranks = re.findall(r'ROW_NUMBER\(\) OVER\s*\(\s*PARTITION BY u\.studentsdcid, u\.termid\s+ORDER BY u\.whencreated ASC NULLS LAST, u\.id ASC\s*\)', source)
                self.assertTrue(ranks, path)
                for rank in ranks:
                    rows = db.execute(f'SELECT id FROM (SELECT id, {rank} rn FROM u_pei_att_track u) WHERE rn=1 ORDER BY id').fetchall()
                    self.assertEqual(rows, [(10,), (20,), (30,)], path)
                if 'pei_reports' in path:
                    self.assertNotIn('ORDER BY u.whencreated asc', source)
                    self.assertIn('u.checklist_rn = 1', source)

    def test_summary_tile_placeholders_follow_aggregate_order(self):
        source = (ROOT / 'WEB_ROOT/admin/pei_reports/json/attendance_summary.json').read_text()
        for branch, expected in zip(source.split('[else#hs]'), [13, 12]):
            indexes = [int(value) for value in re.findall(r'"count":\s*~\((\d+)\)', branch)]
            self.assertEqual(indexes, list(range(1, expected + 1)))


if __name__ == '__main__':
    unittest.main()
