const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../WEB_ROOT/scripts/peiAttTrack/peiAttTrack202610.js'), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
function setup({ fresh = false, requested = 0, term = '3601', grade = '11', teacher = false, readResults } = {}) {
    let controller;
    const record = { id: '42', termid: '3601', studentsdcid: '123', calls: { parent_call_1: 0 }, student: {}, referral: { referral: 0 },
        concern_2: { concern_2: requested, concern_2_notes: 'Saved notes', concern_2_req_date: '23/09/2026' },
        concern_3: { concern_3: 0 }, concern_4: { concern_4: 0 } };
    const saves = [], emails = [], alerts = [], readUrls = [];
    let reads = 0, throwSave = false, throwEmail = false;
    const scope = {};
    const inputs = { recordDataFile: teacher ? 'json/pei_AttTrack.json' : 'json/pei_attTrack.json', termid: term, gradeInYear: grade, studentsdcid: '123', localeLang: 'fr',
        emailFrom: 'sender@example.test', emailTo: 'office@example.test', emailSubject: 'Subject', emailBody: 'Body', emailDate: '10/04/2026', emailTime: '10:00' };
    vm.runInNewContext(source, {
        document: { getElementById: id => id === 'termid' && term === null ? null : ({ value: inputs[id] || '', textContent: id === 'resolvedTermName' ? 'Resolved term name' : '' }) }, closeLoading() {}, alert: text => alerts.push(text),
        define: (deps, factory) => factory({ module: () => ({ controller(name, args) { controller = args.at(-1); }, factory() {} }) }, {}, {
            read: () => ({ section_not_saved: 'Save failed: {code}', save_unconfirmed: 'Save unconfirmed', unexpected_error: 'Erreur inattendue' }),
            format: (text, token, value) => text.replace(token, value)
        })
    });
    const write = operation => (id, fields, callback) => {
        if (throwSave) throw Error('write failed');
        saves.push({ operation, id, fields, callback });
    };
    controller(scope, {
        getRecord(url) { readUrls.push(url); reads++; const result = readResults && readResults.length ? readResults.shift() : fresh ? -1 : record;
            return result instanceof Error ? Promise.reject(result) : Promise.resolve(result); },
        insertRecord: write('insert'), updateRecord: write('update'),
        triggerEmail(fields, callback) { if (throwEmail) throw Error('queue failed'); emails.push({ fields, callback }); }
    }, () => {}, Object.assign(fn => new Promise(fn), { when: value => Promise.resolve(value) }));
    function form() { return { $invalid: false, $pristine: false, $dirty: true, $setPristine() { this.$pristine=true; this.$dirty=false; }, $setDirty() { this.$pristine=false; this.$dirty=true; } }; }
    return { scope, saves, emails, alerts, inputs, form, readUrls, reads: () => reads, failSave: () => { throwSave = true; }, failEmail: () => { throwEmail = true; } };
}
async function ready(options) {
    const env = setup(options); await tick();
    for (const name of ['stu','calls','concern_2','concern_3','concern_4','ref']) env.scope.forms[name] = env.form();
    return env;
}
test('only the saved section becomes pristine; other drafts and in-flight edits survive', async () => {
    const e = await ready();
    e.scope.record.concern_3.notes = 'Other draft';
    const result = e.scope.submitSection(null,'concern_2',false);
    e.scope.record.concern_2.concern_2_notes = 'Typed while saving';
    e.saves[0].callback('42'); await result;
    assert.equal(e.scope.record.concern_2.concern_2_notes, 'Typed while saving');
    assert.equal(e.scope.forms.concern_2.$dirty, true);
    assert.equal(e.scope.forms.concern_3.$dirty, true);
    assert.equal(e.scope.record.concern_3.notes, 'Other draft');
    assert.equal(e.reads(), 1);
    const again=e.scope.submitSection(null,'concern_2',false); e.saves[1].callback(42); await again;
    assert.equal(e.scope.forms.concern_2.$pristine,true);
    assert.equal(e.scope.forms.concern_3.$dirty,true);
    assert.equal(e.scope.record.concern_2.concern_2_req_date,'23/09/2026');
    assert.equal(e.saves[0].fields.concern_2_req_date,'09/23/2026');
});
test('email waits for successful save and note-only edits do not resend', async () => {
    const e=await ready();e.scope.record.concern_2.concern_2=1;
    const job=e.scope.submitSection(null,'concern_2',true);
    assert.equal(e.emails.length,0);e.saves[0].callback(42);await tick();
    assert.equal(e.emails.length,1);e.emails[0].callback(900);await job;
    assert.equal(e.scope.concern_2_emailed,1);
    e.scope.forms.concern_2.$setDirty();e.scope.record.concern_2.concern_2_notes='Updated notes';
    const notes=e.scope.submitSection(null,'concern_2',true);e.saves[1].callback(42);await notes;
    assert.equal(e.emails.length,1);
});
test('clearing and re-requesting sends a fresh notification', async () => {
    const e=await ready({requested:1});e.scope.record.concern_2.concern_2=0;
    const clear=e.scope.submitSection(null,'concern_2',true);e.saves[0].callback(42);await clear;
    e.scope.forms.concern_2.$setDirty();e.scope.record.concern_2.concern_2=1;
    const request=e.scope.submitSection(null,'concern_2',true);e.saves[1].callback(42);await tick();
    assert.equal(e.emails.length,1);e.emails[0].callback(901);await request;
});
test('failed saves and thrown errors never enqueue email and release locks', async () => {
    for(const throws of [false,true]) {
        const e=await ready();e.scope.record.concern_2.concern_2=1;if(throws)e.failSave();
        const job=e.scope.submitSection(null,'concern_2',true);if(!throws)e.saves[0].callback(0);await job;
        assert.equal(e.emails.length,0);assert.equal(e.scope.saveBusy,false);assert.equal(e.scope.submitBusy,false);
        assert.equal(e.scope.forms.concern_2.$dirty,true);assert.equal(e.alerts.length,1);
        assert.equal(e.alerts[0], throws ? 'Save failed: Erreur inattendue' : 'Save failed: 0');
    }
});
test('failed email retries only its captured notification, not the checklist', async () => {
    const e=await ready();e.scope.record.concern_2.concern_2=1;
    const job=e.scope.submitSection(null,'concern_2',true);e.saves[0].callback(42);await tick();e.emails[0].callback(0);await job;
    assert.equal(e.scope.notificationFailed.concern_2,true);assert.equal(e.scope.forms.concern_2.$pristine,true);
    e.inputs.emailBody='Changed';const retry=e.scope.retryEmail('concern_2');
    await e.scope.retryEmail('concern_2');assert.equal(e.emails.length,2);assert.equal(e.saves.length,1);
    assert.equal(e.emails[1].fields.tdata4,'Body');e.emails[1].callback(902);await retry;
    assert.equal(e.scope.notificationFailed.concern_2,false);
});
test('shared lock prevents duplicate inserts and later sections use the retained ID', async () => {
    const e=await ready({fresh:true});const first=e.scope.submitSection(null,'calls',false);
    await e.scope.submitSection(null,'calls',false);await e.scope.submitSection(null,'concern_2',false);
    assert.equal(e.saves.length,1);assert.equal(e.saves[0].operation,'insert');e.saves[0].callback('71');await first;
    assert.equal(e.scope.record.id,'71');const next=e.scope.submitSection(null,'concern_2',false);
    assert.equal(e.saves[1].operation,'update');assert.equal(e.saves[1].id,'71');e.saves[1].callback(71);await next;
    assert.equal(e.reads(),1);
});
test('unconfirmed lookup results are not treated as success or automatically retried', async () => {
    const e=await ready({fresh:true});e.scope.record.concern_2.concern_2=1;
    const job=e.scope.submitSection(null,'concern_2',true);e.saves[0].callback(-1);await job;
    assert.equal(e.scope.writeUncertain,true);assert.equal(e.emails.length,0);
    await e.scope.submitSection(null,'concern_2',true);assert.equal(e.saves.length,1);
});
test('psQuery -1 confirms email insertion without allowing a duplicate retry', async () => {
    for (const result of [-1, '-1']) {
        const f=await ready();f.scope.record.concern_2.concern_2=1;
        const send=f.scope.submitSection(null,'concern_2',true);f.saves[0].callback(42);await tick();f.emails[0].callback(result);await send;
        assert.equal(f.scope.notificationUnknown.concern_2,false);
        assert.equal(f.scope.notificationFailed.concern_2,false);
        assert.equal(f.scope.concern_2_emailed,1);
        await f.scope.retryEmail('concern_2');assert.equal(f.emails.length,1);
    }
});
test('invalid forms and pristine forms cannot submit; Enter ignores textarea newlines', async () => {
    const e=await ready();e.scope.forms.calls.$invalid=true;await e.scope.submitSection(null,'calls',false);assert.equal(e.saves.length,0);
    e.scope.forms.calls.$invalid=false;e.scope.forms.calls.$setPristine();await e.scope.submitSection(null,'calls',false);assert.equal(e.saves.length,0);
    e.scope.forms.calls.$setDirty();e.scope.sectionKeydown({key:'Enter',target:{tagName:'TEXTAREA'}},'calls',false);assert.equal(e.saves.length,0);
    let prevented=0;const job=e.scope.sectionKeydown({key:'Enter',target:{tagName:'INPUT'},preventDefault(){prevented++;}},'calls',false);
    assert.equal(e.saves.length,1);assert.ok(prevented);e.saves[0].callback(42);await job;
});
test('existing requests do not email on first note edit after loading', async () => {
    const e=await ready({requested:1});e.scope.record.concern_2.concern_2_notes='New notes';
    const job=e.scope.submitSection(null,'concern_2',true);e.saves[0].callback('42');await job;
    assert.equal(e.emails.length,0);
});
test('unexpected update ID is unconfirmed, not a successful save', async () => {
    const e=await ready();const job=e.scope.submitSection(null,'calls',false);e.saves[0].callback(99);await job;
    assert.equal(e.scope.writeUncertain,true);assert.equal(e.scope.forms.calls.$dirty,true);
});
test('admin referral follows the same notification transition policy', async () => {
    const e=await ready();e.scope.record.referral.referral=1;
    const job=e.scope.submitSection(null,'referral',true);e.saves[0].callback(42);await tick();
    assert.equal(e.emails.length,1);e.emails[0].callback(901);await job;
    assert.equal(e.scope.forms.ref.$pristine,true);
});
test('a failed clear does not change the persisted notification baseline', async () => {
    const e=await ready({requested:1});e.scope.record.concern_2.concern_2=0;
    const clear=e.scope.submitSection(null,'concern_2',true);e.saves[0].callback(0);await clear;
    e.scope.record.concern_2.concern_2=1;
    const again=e.scope.submitSection(null,'concern_2',true);e.saves[1].callback(42);await again;
    assert.equal(e.emails.length,0);
});
test('Enter respects the section save button’s workflow restrictions', async () => {
    const e=await ready();let prevented=false;
    e.scope.sectionKeydown({key:'Enter',target:{tagName:'INPUT'},currentTarget:{querySelector:()=>({disabled:true})},preventDefault(){prevented=true;}},'concern_2',true);
    assert.equal(e.saves.length,0);assert.equal(prevented,true);
});

test('teacher resolved year/semester controls the lookup and new-record save', async () => {
    for (const [term, grade] of [['3600', '0'], ['3600', '9'], ['3601', '10'], ['3602', '12']]) {
        const e = await ready({ fresh: true, teacher: true, term, grade });
        assert.equal(e.scope.validTerm(), true);
        assert.equal(e.scope.termName, 'Resolved term name');
        assert.deepEqual(e.readUrls, ['json/pei_AttTrack.json']);
        assert.equal(e.scope.record.termid, term);
        const job = e.scope.submitSection(null, 'calls', false);
        assert.equal(e.saves[0].fields.termid, term);
        e.saves[0].callback(42); await job;
    }
});
test('missing, unresolved, and sentinel teacher terms cannot read, save, or notify', async () => {
    for (const term of [null, '', '-1', '0', '~(1)', '3601 3602']) {
        const e = await ready({ fresh: true, teacher: true, term });
        assert.equal(e.scope.validTerm(), false, String(term));
        e.scope.getRecord('json/pei_AttTrack.json');
        await e.scope.submitSection(null, 'concern_2', true);
        await e.scope.save(null, 'calls');
        await e.scope.saveAndEmail(null, 'concern_2');
        await e.scope.retryEmail('concern_2');
        assert.equal(e.reads(), 0);
        assert.equal(e.saves.length, 0);
        assert.equal(e.emails.length, 0);
    }
});
test('teacher display and print headings use the same resolved name with localized fallback', () => {
    const html = fs.readFileSync(path.join(__dirname, '../WEB_ROOT/teachers/studentpages/pei_attendance_tracking.html'), 'utf8');
    assert.equal((html.match(/ng-bind="termName"/g) || []).length, 2);
    assert.equal((html.match(/~\[tlist_sql;/g) || []).length, 1);
    assert.ok(html.includes('ng-if="!validTerm()" role="alert">~[text:'));
    assert.ok(html.includes('id="printarea" class="printable" ng-if="validTerm() && !recordLoading && !recordLoadError"'));
    assert.ok(!html.includes('value="3601"'));
});

test('missing enrollment grade cannot read or save a checklist', async () => {
    const e = await ready({ fresh: true, term: '3600', grade: '-9' });
    assert.equal(e.scope.validTerm(), false);
    await e.scope.submitSection(null, 'calls', false);
    assert.equal(e.reads(), 0);
    assert.equal(e.saves.length, 0);
});

test('failed and malformed checklist reads never become new records; retry recovers', async () => {
    for (const bad of [Error('HTTP 500'), '<html>Sign in</html>', null, {}, '']) {
        const e = await ready({ fresh: true, readResults: [bad] });
        assert.equal(e.scope.recordLoading, false);
        assert.equal(e.scope.recordLoadError, true);
        await e.scope.submitSection(null, 'calls', false);
        assert.equal(e.saves.length, 0);
        await e.scope.retryLoad();
        assert.equal(e.scope.recordLoadError, false);
        const job = e.scope.submitSection(null, 'calls', false);
        // Loading marks forms pristine; an actual edit enables the save.
        assert.equal(e.saves.length, 0);
        await job;
        e.scope.forms.calls.$setDirty();
        const edited = e.scope.submitSection(null, 'calls', false);
        assert.equal(e.saves[0].operation, 'insert');
        e.saves[0].callback(42); await edited;
    }
});
test('a school with no configured recipients saves without queuing an email', async () => {
    const e = await ready();
    e.inputs.emailTo = '  ';
    e.scope.record.concern_2.concern_2 = 1;
    const job = e.scope.submitSection(null, 'concern_2', true);
    e.saves[0].callback(42); await job;
    assert.equal(e.emails.length, 0);
    assert.equal(e.scope.notificationFailed.concern_2, undefined);
});
test('a checklist for a different term is rejected, never edited or saved', async () => {
    const other = { id: '77', termid: '3602', studentsdcid: '123', calls: { parent_call_1: 0 }, student: {}, referral: { referral: 0 },
        concern_2: { concern_2: 0 }, concern_3: { concern_3: 0 }, concern_4: { concern_4: 0 } };
    const e = await ready({ readResults: [other] });
    assert.equal(e.scope.recordLoadError, true);
    assert.equal(e.scope.record.id, undefined);
    await e.scope.submitSection(null, 'calls', false);
    assert.equal(e.saves.length, 0);
});
test('pending checklist load blocks both writes and duplicate reload requests', async () => {
    let resolve;
    const result = new Promise(done => { resolve = done; });
    const e = await ready({ fresh: true, readResults: [result] });
    assert.equal(e.scope.recordLoading, true);
    await e.scope.submitSection(null, 'calls', false);
    await e.scope.retryLoad();
    assert.equal(e.reads(), 1);
    assert.equal(e.saves.length, 0);
    resolve(-1); await tick();
    assert.equal(e.scope.recordLoading, false);
});
