// Verify SELECT-to-JSON contracts without claiming to emulate PowerSchool's renderer.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const sources = {
    admin: 'WEB_ROOT/admin/students/json/pei_attTrack.json',
    teacher: 'WEB_ROOT/teachers/studentpages/json/pei_AttTrack.json',
    dashboard: 'WEB_ROOT/admin/pei_reports/json/attendance_tracking.json'
};

function selectExpressions(text) {
    const expressions = [];
    let start = 0, depth = 0, quoted = false;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === "'") {
            if (quoted && text[i + 1] === "'") { i++; continue; }
            quoted = !quoted;
        }
        if (quoted) continue;
        if (char === '(') depth++;
        if (char === ')') depth--;
        if (char === ',' && depth === 0) {
            expressions.push(text.slice(start, i).trim());
            start = i + 1;
        }
    }
    expressions.push(text.slice(start).trim());
    return expressions;
}
function contract(portal) {
    const source = fs.readFileSync(path.join(root, sources[portal]), 'utf8');
    const select = portal === 'dashboard'
        ? source.match(/select\s+(.*?)\s+from\s*\(/is)[1]
        : source.match(/SELECT \* FROM \(\s*SELECT\s+(.*?)\s+FROM u_pei_att_track/is)[1];
    const columns = selectExpressions(select).map(expression => expression.match(/(\w+)$/)[1]);
    const template = source.slice(source.indexOf('{'), source.lastIndexOf('}') + 1).replace(/,\s*\[\/tlist_sql\]\s*\{\}/, '');
    const fields = [...template.matchAll(/"(\w+)"\s*:\s*("?)~\(([^)]+)\)/g)].map(([, key, quote, tag]) => ({ key, quoted: !!quote, tag }));
    return { columns, template, fields };
}
const dashboardNames = {
    recid: 'recid', termid: 'termid', studentsdcid: 'studentsdcid', studentNumber: 'student_number',
    lastName: 'last_name', firstName: 'first_name', currentGrade: 'current_grade', termGrade: 'term_grade',
    currentSchool: 'current_school', termSchool: 'term_school', termSchoolName: 'term_schoolname',
    currentStep: 'current_step', currentStepIdx: 'current_step_idx', stepDate: 'action_date',
    studentNotification: 'student_notification', parentCall1: 'parent_call_1', parentCall2: 'parent_call_2',
    parentCall3: 'parent_call_3', concern2: 'concern_2', concern3: 'concern_3', concern4: 'concern_4',
    referral: 'referral', callPoints: 'call_points'
};
for (const portal of Object.keys(sources)) {
    test(`${portal}: every JSON field references the matching SELECT column explicitly`, () => {
        const { columns, fields } = contract(portal);
        assert.equal(columns.length, portal === 'dashboard' ? 23 : 41);
        assert.equal(fields.length, portal === 'teacher' ? 40 : columns.length);
        for (const { key, tag } of fields) {
            assert.match(tag, /^\d+(;json|;l)?$/, key);
            const position = Number(tag.split(';')[0]);
            assert.equal(columns[position - 1], portal === 'dashboard' ? dashboardNames[key] : key, key);
        }
    });
}
function renderFixture(portal, date) {
    const { columns, fields, template } = contract(portal);
    const row = columns.map((column, index) => {
        if (column.endsWith('_date')) return date;
        if (/staff|notes|name$|current_step$/.test(column)) return `Élève "A" — ${column}\nL’école`;
        return index + 100;
    });
    const rendered = template.replace(/~\((\d+)(?:;(json|l))?\)/g, (_, position, modifier) => {
        const value = row[Number(position) - 1];
        return modifier === 'json' ? JSON.stringify(String(value)).slice(1, -1) : String(value);
    });
    const parsed = JSON.parse(rendered);
    for (const field of fields) {
        const value = row[Number(field.tag.split(';')[0]) - 1];
        const group = Object.values(parsed).find(item => item && typeof item === 'object' && field.key in item);
        assert.equal((group || parsed)[field.key], field.quoted ? String(value) : value, field.key);
    }
    return parsed;
}
for (const date of ['10/24/2026', '24/10/2026']) {
    test(`${date}: teacher/admin payloads agree and dashboard preserves escaped strings`, () => {
        const admin = renderFixture('admin', date);
        delete admin.rn;
        assert.deepEqual(renderFixture('teacher', date), admin);
        renderFixture('dashboard', date);
    });
}
