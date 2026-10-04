const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
for (const portal of ['admin/students', 'teachers/studentpages']) {
    test(`${portal}: parent-call form has one save trigger`, () => {
        const html = fs.readFileSync(path.join(__dirname, `../WEB_ROOT/${portal}/pei_attendance_tracking.html`), 'utf8');
        const form = html.match(/<form\b[^>]*id="callsForm"[\s\S]*?<\/form>/)[0];
        assert.match(form, /ng-submit="submitSection\(\$event,'calls',false\)"/);
        const button = form.match(/<button\b[^>]*id="calls_save"[^>]*>/)[0];
        assert.match(button, /type="submit"/);
        assert.doesNotMatch(button, /ng-click=/);
    });
}

test('bulk forms use one native submit path, including keyboard submission', () => {
    const html = fs.readFileSync(path.join(__dirname, '../WEB_ROOT/admin/pei_reports/attUpdateChecklist.html'), 'utf8');
    const forms = [...html.matchAll(/<form\b[\s\S]*?<\/form>/g)];
    assert.equal(forms.length, 11);
    for (const [form] of forms) {
        assert.match(form, /ng-submit="save\('[^']+'\)"/);
        assert.doesNotMatch(form, /ng-click="save\(/);
        assert.match(form, /<button type="submit"/);
    }
});
test('teacher first-call reset respects later calls and requested letters', () => {
    const vm = require('node:vm');
    const html = fs.readFileSync(path.join(__dirname, '../WEB_ROOT/teachers/studentpages/pei_attendance_tracking.html'), 'utf8');
    const tag = html.match(/<sl-radio-button[^\n]*recordCall\(\$event, 'parent_call_1',0\)[^\n]*/)[0];
    const expression = tag.match(/ng-disabled="([^"]+)"/)[1];
    assert.doesNotMatch(html, /calsvtetls/);
    for (const [second, requested, disabled] of [[0, 0, false], [1, 0, true], [3, 0, true], [0, 1, true]]) {
        assert.equal(!!vm.runInNewContext(expression, { record: { calls: { parent_call_2: second } }, concerns: { concern_2_req: requested } }), disabled);
    }
});
