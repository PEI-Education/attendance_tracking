const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../WEB_ROOT/scripts/peiAttTrack/peiAttTrack202610.js'), 'utf8');
function controller(locale, today) {
    let definition;
    const scope = {}, writes = [];
    const module = { controller(name, args) { definition = args.at(-1); }, factory() {} };
    const inputs = { localeLang: locale, dateToday: today, termid: '3601', gradeInYear: '11', recordDataFile: 'json/pei_attTrack.json' };
    vm.runInNewContext(source, {
        document: { getElementById: id => ({ value: inputs[id] || '' }) },
        define: (deps, factory) => factory({ module: () => module }, {}, { read: () => ({}) })
    });
    definition(scope, {
        getRecord: () => new Promise(() => {}),
        insertRecord: (id, fields) => writes.push({ operation: 'insert', id, fields }),
        updateRecord: (id, fields) => writes.push({ operation: 'update', id, fields })
    }, () => {}, Object.assign(fn => new Promise(fn), { when: value => Promise.resolve(value) }));
    scope.recordLoading = false; // These tests supply their own loaded record below.
    return { scope, inputs, writes };
}
for (const locale of ['en', 'fr']) {
    const format = (y, m, d) => locale === 'fr' ? `${d}/${m}/${y}` : `${m}/${d}/${y}`;
    test(`${locale}: exact waiting boundary, future dates, and unchanged strings`, () => {
        const sent = format(2026, 9, 23);
        const { scope, inputs } = controller(locale, format(2026, 9, 24));
        scope.record = { concern_2: { concern_2: 2, concern_2_sent_date: sent } };
        for (const [day, disabled] of [[22, true], [23, true], [24, true], [29, true], [30, false]]) {
            inputs.dateToday = format(2026, 9, day);
            assert.equal(scope.disableConcern('concern_2'), disabled);
        }
        assert.equal(scope.record.concern_2.concern_2_sent_date, sent);
        scope.record.concern_2.concern_2 = 1;
        assert.equal(scope.disableConcern('concern_2'), true);
        assert.equal(scope.disableConcern('missing'), true);
    });
    test(`${locale}: month/year/leap and daylight-saving boundaries`, () => {
        const { scope } = controller(locale, '');
        const cases = [
            [[2026,9,28], [2026,10,5]],
            [[2026,12,28], [2027,1,4]],
            [[2024,2,26], [2024,3,4]],
            [[2026,3,4], [2026,3,11]],
            [[2026,10,28], [2026,11,4]]
        ];
        for (const [start, end] of cases) {
            assert.equal(scope.daysPassed(format(...start), format(...end)), 7);
            const target = new Date(scope.addFiveDays(format(...start)));
            assert.deepEqual([target.getFullYear(), target.getMonth()+1, target.getDate()], end);
            assert.equal(target.getHours(), 0);
        }
        assert.equal(scope.daysPassed(format(2024,2,28), format(2024,3,1)), 2);
    });
    test(`${locale}: invalid or missing dates keep progression disabled`, () => {
        const { scope, inputs } = controller(locale, format(2026,10,4));
        const invalid = ['', ' ', null, undefined, 0, {}, '2026-09-23', '23/09/26', format(2026,2,29), format(2026,4,31), format(2026,13,1), format(2026,0,1), format(2026,1,0)];
        for (const value of invalid) {
            scope.record = { concern_2: { concern_2: 2, concern_2_sent_date: value } };
            assert.equal(scope.disableConcern('concern_2'), true, String(value));
            assert.ok(Number.isNaN(scope.daysPassed(value, inputs.dateToday)));
            assert.equal(scope.addFiveDays(value), null);
        }
        scope.record.concern_2.concern_2_sent_date = format(2026,9,23);
        inputs.dateToday = 'invalid';
        assert.equal(scope.disableConcern('concern_2'), true);
    });
    for (const operation of ['insert', 'update']) {
        test(`${locale}: ${operation} still receives mm/dd/yyyy without mutating the record`, () => {
            const { scope, writes } = controller(locale, format(2026,10,4));
            const phase = {
                concern_2: 2,
                concern_2_req_date: format(2026,9,23),
                concern_2_sent_date: format(2026,10,4),
                concern_2_req_staff: 'Test Staff',
                concern_2_notes: 'Keep this text unchanged.',
                unused_date: null
            };
            scope.record = { studentsdcid: '42', termid: '3601', concern_2: phase };
            if (operation === 'update') scope.record.id = '123';
            const before = JSON.stringify(scope.record);
            scope.daysPassed(phase.concern_2_req_date, phase.concern_2_sent_date);
            scope.addFiveDays(phase.concern_2_sent_date);
            scope.disableConcern('concern_2');
            scope.save({}, 'concern_2');
            assert.equal(writes.length, 1);
            assert.equal(writes[0].operation, operation);
            assert.equal(writes[0].fields.concern_2_req_date, '9/23/2026');
            assert.equal(writes[0].fields.concern_2_sent_date, '10/4/2026');
            assert.equal(writes[0].fields.unused_date, null);
            assert.equal(writes[0].fields.concern_2_notes, phase.concern_2_notes);
            assert.equal(JSON.stringify(scope.record), before);
        });
    }
}
test('ambiguous dates follow the supplied locale, not the browser', () => {
    assert.equal(controller('fr', '').scope.daysPassed('04/10/2026', '05/10/2026'), 1);
    assert.equal(controller('en', '').scope.daysPassed('04/10/2026', '05/10/2026'), 30);
});
test('zero-padded French date still reaches psQuery as 09/23/2026', () => {
    const { scope, writes } = controller('fr', '04/10/2026');
    scope.record = { id: '123', student: { student_notification_date: '23/09/2026' } };
    scope.save({}, 'student');
    assert.equal(writes[0].fields.student_notification_date, '09/23/2026');
    assert.equal(scope.record.student.student_notification_date, '23/09/2026');
});
