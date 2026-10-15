const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('WEB_ROOT/admin/pei_reports/attUpdateChecklist.html');
function load(name, term = '3600', customUpdate, locale = 'en', services = {}) {
    let definition;
    const module = { controller(name, args) { definition = args; } };
    const state = { spinner: {}, task: {} }, writes = [];
    const scope = { $watch() {} };
    const deps = {
        $scope: scope, state, $timeout: fn => fn(), $q: Object.assign(fn => new Promise(fn), { all: promises => Promise.all(promises) }),
        dataService: {
            getData: () => Promise.resolve([{}]),
            updateRecord: customUpdate || ((id, fields) => { writes.push({ id, fields: { ...fields } }); return Promise.resolve(id); }),
            ...services
        }
    };
    vm.runInNewContext(read(`WEB_ROOT/scripts/components/attTrack/controllers/${name}.js`), {
        document: { getElementById: id => ({ value: { termid: term, staffName: 'Test Staff', dateToday: '10/04/2026', localeLang: locale,
            emailFrom: 'admin@example.test', emailToPSB: 'psb@example.test', emailToCSLF: 'cslf@example.test', emailDate: '10/04/2026', emailTime: '10:00' }[id] }) },
        define: factory => factory(key => key === 'peiAttTrack/messages'
            ? { read: () => ({ bulk_referral_subject: 'Referrals: {count}', bulk_referral_intro: 'Intro', bulk_referral_student: '{name} ({label}: {number}; student_number={number}) - {school}', student_number: 'Student Number', email_generated: 'Generated.', email_contact: 'Contact.' }),
                format: (text, token, value) => String(text).split(token).join(String(value)) } : module)
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
// Bulk saves require the step to be set, with a staff name and date.
function notify(scope) { scope.setValues('sn', 'student_notification', 1); }
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
    notify(scope);
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
    // Unticking clears the fields but cannot be bulk-saved; clearing happens on the student's own checklist.
    const next = load('update'); next.scope.validStudents = [{ recid: 42 }];
    change(next.scope, 'referral', false); next.scope.save('referral');
    assert.deepEqual({ ...next.scope.referral }, { referral: 0, referral_staff: null, referral_date: null });
    assert.equal(next.writes.length, 0);
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
            assert.deepEqual({ ...next.scope[group] }, { [field]: inactive, [`${step}_staff`]: null, [`${step}_date`]: null });
            assert.equal(next.writes.length, 0);
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
    notify(scope);
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
    notify(scope);
    await scope.save('sn');
    assert.equal(scope.unconfirmedStudents.length, 1);
    assert.equal(scope.saveBusy, false);
    assert.equal(state.spinner.wait, false);
});
test('bulk French dates normalize only the outgoing payload', async () => {
    const { scope, writes } = load('update', '3600', undefined, 'fr');
    scope.validStudents = [{ recid: 1 }];
    notify(scope);
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
    notify(e.scope);
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

test('call 1 accepts students with no steps taken, including notification-exempt K-9', () => {
    const { scope } = load('update');
    scope.gridData = [{ recid: 1, termGrade: 8, currentStepIdx: 1 }, { recid: 2, termGrade: 11, currentStepIdx: 2 },
        { recid: 3, termGrade: 11, currentStepIdx: 3 }, { recid: 4, termGrade: 11, currentStepIdx: 4 }];
    scope.stepChoice = { id: 3 }; scope.verifySelection();
    assert.equal(JSON.stringify(scope.validStudents.map(s => s.recid)), '[1,2,3]');
    assert.equal(JSON.stringify(scope.invalidStudents.map(s => s.recid)), '[4]');
});
test('save stays blocked until the step is set with a staff name and date', () => {
    const { scope, writes } = load('update');
    scope.validStudents = [{ recid: 1 }];
    for (const group of ['sn', 'pc1', 'pc2', 'pc3', 'c2req', 'c2sent', 'c3req', 'c3sent', 'c4req', 'c4sent', 'referral']) {
        assert.equal(scope.canSave(group), false, group);
        scope.save(group);
    }
    assert.equal(writes.length, 0);
    scope.setValues('pc2', 'parent_call_2', 0);
    assert.equal(scope.canSave('pc2'), false);
    scope.setValues('pc2', 'parent_call_2', 1);
    assert.equal(scope.canSave('pc2'), true);
    scope.pc2.parent_call_2_date = ' ';
    assert.equal(scope.canSave('pc2'), false);
    for (const [, group] of html.matchAll(/id="bulk_(\w+)_save" ng-disabled="!canSave\('(\w+)'\)"/g)) assert.ok(group);
    assert.equal([...html.matchAll(/ng-disabled="!canSave\('(\w+)'\)"/g)].length, 11);
    assert.ok(!html.includes('ng-model="parent_call_notes"'), 'call 2 notes are not saved and must not be offered');
});
function referralRows() {
    return [
        { recid: 1, currentStepIdx: 14, currentSchool: 120, firstName: 'Ann', lastName: 'Arsenault', studentNumber: 1001, termSchoolName: 'PSB School' },
        { recid: 2, currentStepIdx: 14, currentSchool: 540, firstName: 'Bea', lastName: 'Blanchard', studentNumber: 1002, termSchoolName: 'CSLF School' },
        { recid: 3, currentStepIdx: 15, currentSchool: 130, firstName: 'Cal', lastName: 'Campbell', studentNumber: 1003, termSchoolName: 'PSB School' },
        { recid: 4, currentStepIdx: 14, currentSchool: 150, firstName: 'Dee', lastName: 'Doucette', studentNumber: 1004, termSchoolName: 'PSB School' }
    ];
}
test('bulk referral queues one summary per board for newly referred students only', async () => {
    const emails = [];
    const { scope } = load('update', '3600', undefined, 'en', { queueEmail: fields => { emails.push(fields); return Promise.resolve(900 + emails.length); } });
    scope.validStudents = referralRows();
    scope.setValues('referral', 'referral', 1);
    await scope.save('referral');
    assert.equal(emails.length, 2);
    const psb = emails.find(email => email.tdata2 === 'psb@example.test');
    const cslf = emails.find(email => email.tdata2 === 'cslf@example.test');
    assert.equal(psb.tdata3, 'Referrals: 2');
    assert.equal(psb.tdata4, 'Intro\n\nArsenault, Ann (Student Number: 1001; student_number=1001) - PSB School\nDoucette, Dee (Student Number: 1004; student_number=1004) - PSB School\n\nGenerated. Contact.');
    assert.equal(cslf.tdata3, 'Referrals: 1');
    assert.ok(!emails.some(email => email.tdata4.includes('Campbell')), 'already-referred students are not re-notified');
    assert.deepEqual({ type: psb.type, tdata1: psb.tdata1, date: psb.date, time: psb.time }, { type: 100, tdata1: 'admin@example.test', date: '10/04/2026', time: '10:00' });
    assert.equal(scope.referralEmail.sent, true);
});
test('referral summary retries only explicit failures; uncertain queue results are not resent', async () => {
    const attempts = [];
    let result = { outcome: 'failed' };
    const { scope } = load('update', '3600', undefined, 'en', { queueEmail: fields => { attempts.push(fields.tdata2); return result ? Promise.reject(result) : Promise.resolve(1); } });
    scope.validStudents = referralRows().filter(row => row.currentSchool < 500);
    scope.setValues('referral', 'referral', 1);
    await scope.save('referral');
    assert.equal(scope.referralEmail.failed, true);
    result = null;
    await scope.retryReferralEmails();
    assert.deepEqual(attempts, ['psb@example.test', 'psb@example.test']);
    assert.equal(scope.referralEmail.failed, false);
    assert.equal(scope.referralEmail.sent, true);
    assert.equal(scope.retryReferralEmails(), undefined);

    const uncertain = load('update', '3600', undefined, 'en', { queueEmail: () => Promise.reject({ outcome: 'unconfirmed' }) });
    uncertain.scope.validStudents = referralRows().filter(row => row.currentSchool < 500);
    uncertain.scope.setValues('referral', 'referral', 1);
    await uncertain.scope.save('referral');
    assert.equal(uncertain.scope.referralEmail.unconfirmed, true);
    assert.equal(uncertain.scope.retryReferralEmails(), undefined);
});
test('non-referral steps never queue email', async () => {
    const emails = [];
    const { scope } = load('update', '3600', undefined, 'en', { queueEmail: fields => { emails.push(fields); return Promise.resolve(1); } });
    scope.validStudents = referralRows();
    scope.setValues('c4sent', 'concern_4', 2); scope.setStaffDate('c4sent', 'concern_4_sent', 'concern_4', 2);
    await scope.save('c4sent');
    assert.equal(emails.length, 0);
});
