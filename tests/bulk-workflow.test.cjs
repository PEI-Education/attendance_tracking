const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('WEB_ROOT/admin/pei_reports/attUpdateChecklist.html');
function load(name, term = '3600', customUpdate, locale = 'en') {
    let definition;
    const module = { controller(name, args) { definition = args; } };
    const state = { spinner: {}, task: {} }, writes = [];
    const scope = { $watch() {} };
    const deps = {
        $scope: scope, state, $timeout: fn => fn(), $q: Object.assign(fn => new Promise(fn), { all: promises => Promise.all(promises) }),
        dataService: {
            getData: () => Promise.resolve([{}]),
            updateRecord: customUpdate || ((id, fields) => { writes.push({ id, fields: { ...fields } }); return Promise.resolve(id); })
        }
    };
    vm.runInNewContext(read(`WEB_ROOT/scripts/components/attTrack/controllers/${name}.js`), {
        document: { getElementById: id => ({ value: { termid: term, staffName: 'Test Staff', dateToday: '10/04/2026', localeLang: locale }[id] }) },
        define: factory => factory(key => key === 'peiAttTrack/messages'
            ? { read: () => ({}), format: () => '' } : module)
    });
    definition.at(-1)(...definition.slice(0, -1).map(key => deps[key]));
    return { scope, state, writes };
}
function input(id) {
    const tag = [...html.matchAll(/<input\b[^>]*>/g)].map(m => m[0]).find(tag => tag.includes(`id="${id}"`));
    assert.ok(tag, id);
    return Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
}
function change(scope, id, checked) {
    const attrs = input(id);
    const [group, field] = attrs['ng-model'].split('.');
    scope[group][field] = Number(attrs[checked ? 'ng-true-value' : 'ng-false-value']);
    assert.ok(attrs['ng-change'], `${id} must react after its model changes`);
    vm.runInNewContext(attrs['ng-change'], scope);
}
test('dashboard distinguishes full-year terms from semesters', () => {
    for (const [term, expected] of [['3600', false], ['3601', true], ['3602', true], ['3700', false]]) {
        const { scope, state } = load('controller', term);
        assert.equal(scope.setHS(), expected);
        assert.equal(state.hs, expected);
    }
});
test('student notification excludes younger students from writes, without duplicate classifications', () => {
    const { scope, writes } = load('update');
    scope.gridData = [
        { recid: 1, termGrade: 8, currentStepIdx: 1 },
        { recid: 2, termGrade: 9, currentStepIdx: 2 },
        { recid: 3, termGrade: 10, currentStepIdx: 1 },
        { recid: 4, termGrade: 11, currentStepIdx: 2 },
        { recid: 5, termGrade: 12, currentStepIdx: 5 }
    ];
    scope.stepChoice = { id: 2 };
    scope.verifySelection();
    assert.equal(JSON.stringify(scope.validStudents.map(s => s.recid)), '[3,4]');
    assert.equal(JSON.stringify(scope.invalidStudents.map(s => s.recid)), '[1,2,5]');
    scope.save('sn');
    assert.deepEqual(writes.map(w => w.id), [3,4]);
});
test('first-letter eligibility still allows sufficient call points', () => {
    const { scope } = load('update');
    scope.gridData = [{ recid: 1, termGrade: 8, currentStepIdx: 3, callPoints: 3 }];
    scope.stepChoice = { id: 7 }; scope.verifySelection();
    assert.equal(scope.validStudents.length, 1);
    assert.equal(scope.invalidStudents.length, 0);
});
test('bulk referral fields flow into the saved payload and clear when unchecked', () => {
    const { scope, writes } = load('update');
    scope.validStudents = [{ recid: 42 }];
    change(scope, 'referral', true);
    assert.equal(scope.referral.referral_staff, 'Test Staff');
    assert.equal(scope.referral.referral_date, '10/04/2026');
    for (const [id, value] of [['referral_staff', 'Chosen Staff'], ['referral_date', '10/03/2026']]) {
        const [group, field] = input(id)['ng-model'].split('.');
        scope[group][field] = value;
    }
    scope.save('referral');
    assert.deepEqual(writes[0], { id: 42, fields: { referral: 1, referral_staff: 'Chosen Staff', referral_date: '10/03/2026' } });
    const next = load('update'); next.scope.validStudents = [{ recid: 42 }];
    change(next.scope, 'referral', false); next.scope.save('referral');
    assert.deepEqual(next.writes[0].fields, { referral: 0, referral_staff: null, referral_date: null });
});
for (const n of [2,3,4]) {
    for (const [phase, active, inactive] of [['req',1,0], ['sent',2,1]]) {
        test(`letter ${n-1} ${phase}: sets, preserves, clears, and saves only real fields`, () => {
            const { scope, writes } = load('update');
            const group = `c${n}${phase}`, field = `concern_${n}`, step = `${field}_${phase}`;
            scope.validStudents = [{ recid: 42 }];
            change(scope, step, true);
            assert.equal(scope[group][field], active);
            assert.equal(scope[group][`${step}_staff`], 'Test Staff');
            assert.equal(scope[group][`${step}_date`], '10/04/2026');
            scope[group][`${step}_staff`] = 'Original Staff';
            scope[group][`${step}_date`] = '10/01/2026';
            change(scope, step, true);
            assert.equal(scope[group][`${step}_staff`], 'Original Staff');
            assert.equal(scope[group][`${step}_date`], '10/01/2026');
            scope.save(group);
            assert.deepEqual(Object.keys(writes[0].fields).sort(), [field, `${step}_staff`, `${step}_date`].sort());
            const next = load('update'); next.scope.validStudents = [{ recid: 42 }];
            change(next.scope, step, false); next.scope.save(group);
            assert.deepEqual(next.writes[0].fields, { [field]: inactive, [`${step}_staff`]: null, [`${step}_date`]: null });
        });
    }
}
test('existing call and student notification timestamp handling remains intact', () => {
    const { scope } = load('update');
    scope.setValues('pc1', 'parent_call_1', 3);
    assert.equal(scope.pc1.parent_call_1_staff, 'Test Staff');
    scope.setValues('pc1', 'parent_call_1', 0);
    assert.equal(scope.pc1.parent_call_1_date, null);
    scope.sn.student_notification = 1; scope.setStaffDate('sn', 'student_notification');
    assert.equal(scope.sn.student_notification_staff, 'Test Staff');
});

test('mixed bulk results settle, prevent duplicates, and retry only failures with frozen fields', async () => {
    const calls = [], pending = [];
    const { scope, state } = load('update', '3600', (id, fields) => {
        calls.push({ id, fields });
        return new Promise((resolve, reject) => pending.push({ resolve, reject }));
    });
    scope.validStudents = [1,2,3].map(recid => ({ recid }));
    scope.sn.student_notification_staff = 'Original';
    const batch = scope.save('sn');
    scope.save('sn'); scope.retryFailed();
    scope.sn.student_notification_staff = 'Changed';
    scope.validStudents[1].recid = 99;
    assert.equal(calls.length, 3);
    pending[1].reject({ outcome: 'failed' });
    pending[2].reject({ outcome: 'unconfirmed' });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(state.spinner.wait, true);
    pending[0].resolve(1);
    await batch;
    assert.equal(state.spinner.wait, false);
    assert.equal(scope.savedStudents.length, 1);
    assert.equal(scope.failedStudents.length, 1);
    assert.equal(scope.unconfirmedStudents.length, 1);
    const retry = scope.retryFailed();
    scope.retryFailed(); scope.save('sn');
    assert.equal(calls.length, 4);
    assert.equal(calls[3].id, 2);
    assert.equal(calls[3].fields.student_notification_staff, 'Original');
    pending[3].resolve(2); await retry;
    assert.equal(scope.savedStudents.length, 2);
    assert.equal(scope.failedStudents.length, 0);
    assert.equal(scope.unconfirmedStudents.length, 1);
});
test('synchronous write exceptions become unconfirmed and release busy state', async () => {
    const { scope, state } = load('update', '3600', () => { throw Error('unknown'); });
    scope.validStudents = [{ recid: 1 }];
    await scope.save('sn');
    assert.equal(scope.unconfirmedStudents.length, 1);
    assert.equal(scope.saveBusy, false);
    assert.equal(state.spinner.wait, false);
});
test('bulk French dates normalize only the outgoing payload', async () => {
    const { scope, writes } = load('update', '3600', undefined, 'fr');
    scope.validStudents = [{ recid: 1 }];
    scope.sn.student_notification_date = '24/10/2026';
    await scope.save('sn');
    assert.equal(writes[0].fields.student_notification_date, '10/24/2026');
    assert.equal(scope.sn.student_notification_date, '24/10/2026');
});
test('bulk service verifies callback IDs and distinguishes explicit failure from uncertainty', async () => {
    let factory, callback;
    vm.runInNewContext(read('WEB_ROOT/scripts/components/attTrack/services/dataService.js'), {
        define: fn => fn(() => ({ factory(name, args) { factory = args.at(-1); } })),
        $psq: () => ({ update(id, fields, cb) { callback = cb; } })
    });
    const service = factory({}, {}, fn => new Promise(fn));
    for (const value of [42, '42', 0, '0', -1, undefined, null, 43, 'garbage']) {
        const result = service.updateRecord(42, {});
        callback(value);
        if (value === 42 || value === '42') await result;
        else await assert.rejects(result, error => error.outcome === (value === 0 || value === '0' ? 'failed' : 'unconfirmed'));
    }
});

test('French bulk failure retry preserves normalized leap-day payload and draft', async () => {
    const writes = [];
    let fail = true;
    const e = load('update', '3600', (id, fields) => {
        writes.push({ id, fields });
        return fail ? Promise.reject({ outcome: 'failed' }) : Promise.resolve(id);
    }, 'fr');
    await new Promise(resolve => setImmediate(resolve));
    e.scope.validStudents = [{ recid: 1 }, { recid: 2 }];
    e.scope.sn.student_notification_date = '29/02/2024';
    await e.scope.save('sn');
    assert.equal(e.scope.failedStudents.length, 2);
    assert.equal(e.state.spinner.wait, false);
    e.scope.sn.student_notification_date = '01/03/2024';
    fail = false;
    const retry = e.scope.retryFailed();
    e.scope.retryFailed();
    await retry;
    assert.equal(writes.length, 4);
    assert.ok(writes.every(write => write.fields.student_notification_date === '02/29/2024'));
    assert.equal(e.scope.sn.student_notification_date, '01/03/2024');
    assert.equal(e.scope.savedStudents.length, 2);
    assert.equal(e.scope.failedStudents.length, 0);
});
