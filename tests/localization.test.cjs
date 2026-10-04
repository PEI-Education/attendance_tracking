// Run with: node --test tests/localization.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const A = 'psx.htmlc.admin_attendance.attendance_tracking.';
const S = 'psx.htmlc.admin_students.attendance_tracking.';
function catalog(locale) {
    const entries = read(`MessageKeys/attendance_tracking.${locale}.properties`).trim().split(/\r?\n/).map(line => {
        const i = line.indexOf('=');
        assert.ok(i > 0);
        return [line.slice(0, i), line.slice(i + 1)];
    });
    assert.equal(new Set(entries.map(([key]) => key)).size, entries.length, 'duplicate keys');
    return Object.fromEntries(entries);
}
function files(dir) {
    return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(entry => {
        const name = `${dir}/${entry.name}`;
        return entry.isDirectory() ? files(name) : [name];
    });
}
function environment(page, dictionary) {
    const nodes = [...read(page).matchAll(/<span data-att-message="([^"]+)">~\[text:([^\]]+)\]<\/span>/g)].map(([, name, key]) => {
        assert.ok(dictionary[key], `missing ${key}`);
        return { getAttribute: () => name, textContent: dictionary[key] };
    });
    assert.ok(nodes.length);
    const document = {
        querySelectorAll: () => nodes,
        getElementById: id => ({ value: id === 'termid' ? '3601' : id === 'gradeInYear' ? '11' : '' }),
        createElement: () => ({ setAttribute(key, value) { this[key] = value; document.download = this; }, click() {} })
    };
    let localization;
    vm.runInNewContext(read('WEB_ROOT/scripts/peiAttTrack/messages.js'), { document, define: factory => { localization = factory(); } });
    return { document, localization };
}
function component(file, env, dependencies) {
    let registered;
    const module = { controller(name, args) { registered = args; }, directive(name, args) { registered = args; } };
    const angular = { forEach: (items, fn) => items.forEach(fn) };
    vm.runInNewContext(read(file), {
        ...env, angular, alert: dependencies.alert || (() => {}),
        define: factory => factory(name => name === 'peiAttTrack/messages' ? env.localization : module)
    });
    return registered.at(-1)(...registered.slice(0, -1).map(key => dependencies[key]));
}
test('catalogue parity, placeholders, references, and standalone JS syntax', () => {
    const en = catalog('US_en'), fr = catalog('CA_fr');
    assert.deepEqual(Object.keys(en).sort(), Object.keys(fr).sort());
    for (const key of Object.keys(en)) {
        const tokens = value => (value.match(/\$\{[^}]+\}|\{\{.*?\}\}|\{code\}|~\[[^\]]+\]|~\([^)]*\)/g) || []).sort();
        assert.deepEqual(tokens(en[key]), tokens(fr[key]), key);
        assert.ok(fr[key].trim());
    }
    for (const file of [...files('WEB_ROOT'), ...files('pagecataloging')]) {
        if (!/\.(html|js|json|txt)$/.test(file)) continue;
        const source = read(file);
        for (const [, key] of source.matchAll(/~\[text:(psx\.htmlc\.[^\],]+)/g)) assert.ok(en[key] && fr[key], `${file}: ${key}`);
        if (file.endsWith('.js')) {
            assert.ok(!source.includes('~[text:'), `${file}: server tags in static JS`);
            new vm.Script(source, { filename: file });
        }
    }
    for (const page of JSON.parse(read('pagecataloging/attendance_tracking.json')).pages) assert.ok(en[page.title] && fr[page.title]);
});
for (const locale of ['US_en', 'CA_fr']) {
    test(`${locale}: dashboard covers every SQL status, export field, and tile label`, () => {
        const dict = catalog(locale);
        const env = environment('WEB_ROOT/admin/pei_reports/attendance_tracking.html', dict);
        const scope = { $watch() {} };
        component('WEB_ROOT/scripts/components/attTrack/controllers/controller.js', env, { $scope: scope, state: { spinner: {} } });
        const sql = read('WEB_ROOT/admin/pei_reports/json/attendance_tracking.json');
        const statuses = [...sql.matchAll(/then '([^']+)'|else\s+'([^']+)'/g)].map(m => m[1] || m[2]);
        for (const status of statuses) assert.ok(scope.stepMap[status], status);
        const row = Object.fromEntries([...sql.matchAll(/"(\w+)"\s*:/g)].map(([, key]) => [key, 0]));
        row.currentStep = 'No steps taken'; row.stepDate = new Date(2026, 9, 4);
        scope.exportData([row]);
        const exported = decodeURIComponent(env.document.download.href.split(',')[1]).split('\n');
        assert.ok(!exported[0].split('\t').includes(''), 'untranslated export header');
        assert.ok(exported[1].includes(dict[A + 'no_steps_taken']));
        const tileSource = read('WEB_ROOT/admin/pei_reports/json/attendance_summary.json');
        const labels = [...tileSource.matchAll(/"(prefix_name|name)"\s*:\s*"([^"]+)"/g)];
        const messages = env.localization.read();
        for (const [, , value] of labels) assert.ok(messages['tile:' + value], value);
        const tiles = [{ prefix_name: 'Referral', name: 'Closed', count: 2 }];
        let rendered;
        const state = { spinner: {} };
        const service = { getData: () => ({ then(fn) { fn(tiles); } }) };
        const directive = component('WEB_ROOT/scripts/components/attTrack/directives/attTiles.js', env, { dataService: service, state });
        // The directive controller resets ctrlData, then fetches asynchronously.
        let receive;
        directive.controller.at(-1)({ getData: () => ({ then(fn) { receive = fn; } }) }, state);
        state.ctrlData.pssTilesVidget = { setTiles(value) { rendered = value; } };
        receive(tiles);
        assert.equal(rendered[0].prefix_name, dict[S + 'referral']);
        assert.equal(rendered[0].name, dict[A + 'closed']);
        assert.equal(rendered[0].count, 2);
    });
    test(`${locale}: bulk steps and success count use resolved messages`, async () => {
        const dict = catalog(locale);
        const env = environment('WEB_ROOT/admin/pei_reports/attUpdateChecklist.html', dict);
        const scope = {}, state = { spinner: {}, task: {} };
        component('WEB_ROOT/scripts/components/attTrack/controllers/update.js', env, {
            $scope: scope, state, $timeout: fn => fn(), $q: { all: promises => Promise.all(promises) },
            dataService: { getData: () => Promise.resolve([{}]), updateRecord: () => Promise.resolve(1) }
        });
        assert.equal(scope.steps.length, 11);
        assert.equal(scope.steps[0].label, dict[A + 'student_notification']);
        assert.ok(scope.steps.every(step => step.label));
        scope.validStudents = [{ recid: 1 }, { recid: 2 }];
        scope.save('sn');
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(state.task.success, dict[A + 'all_sum_students'].replace('${result.length}', '2'));
    });
    test(`${locale}: both student pages supply every alert and preserve punctuation`, () => {
        const dict = catalog(locale);
        for (const page of ['WEB_ROOT/admin/students/pei_attendance_tracking.html', 'WEB_ROOT/teachers/studentpages/pei_attendance_tracking.html']) {
            const env = environment(page, dict);
            const messages = env.localization.read();
            for (const key of ['grade_load_error', 'email_not_sent', 'section_not_saved']) assert.equal(messages[key], dict[S + key]);
            assert.equal(env.localization.format(messages.email_not_sent, '{code}', -1), dict[S + 'email_not_sent'].replace('{code}', '-1'));
            assert.equal(env.localization.format('L’élève "A" — {code}', '{code}', '$&'), 'L’élève "A" — $&');
        }
    });
}
test('shared controller uses each portal’s exact endpoint and localized teacher email', () => {
    const dict = catalog('CA_fr');
    for (const page of ['WEB_ROOT/admin/students/pei_attendance_tracking.html', 'WEB_ROOT/teachers/studentpages/pei_attendance_tracking.html']) {
        const source = read(page);
        assert.ok(source.includes('data-require-path="peiAttTrack/peiAttTrack202610"'));
        const endpoint = source.match(/id="recordDataFile" value="([^"]+)"/)[1];
        const directory = path.posix.dirname(page);
        assert.ok(files(`${directory}/json`).includes(`${directory}/${endpoint}`), 'exact filename case');
        const env = environment(page, dict);
        const originalGet = env.document.getElementById;
        env.document.getElementById = id => id === 'recordDataFile' ? { value: endpoint } : originalGet(id);
        let controller;
        const module = { controller(name, args) { controller = args.at(-1); }, factory() {} };
        vm.runInNewContext(read('WEB_ROOT/scripts/peiAttTrack/peiAttTrack202610.js'), {
            document: env.document, define: (dependencies, factory) => factory({ module: () => module }, {}, env.localization)
        });
        const requests = [];
        controller({}, { getRecord(url) { requests.push(url); return { then() {} }; } }, () => {});
        assert.equal(requests[0], `${endpoint}?term=3601`);
        if (page.includes('/teachers/')) {
            for (const id of ['emailSubject', 'emailBody']) {
                const value = source.match(new RegExp(`id="${id}"[^>]*?value="([^"]*)"`))[1];
                assert.ok(value.includes('~[text:'));
                assert.ok(!value.includes('has requested') && !value.includes('Contact powerschoolhelp'));
            }
        }
    }
    const emails = [...Object.values(dict).join('\n').matchAll(/[\w.+-]+@[\w.-]+\.[A-Za-z]+/g)].map(m => m[0]);
    assert.ok(emails.length > 0);
    assert.ok(emails.every(email => email === 'jhdoyle@edu.pe.ca'));
});
test('student message banks are in the document body and inline scripts compile', () => {
    for (const page of ['WEB_ROOT/admin/students/pei_attendance_tracking.html', 'WEB_ROOT/teachers/studentpages/pei_attendance_tracking.html']) {
        const source = read(page);
        for (const [, script] of source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) {
            assert.ok(!script.includes('id="attTrackMessages"'), 'message bank must not enter print-window source');
            new vm.Script(script, { filename: page });
        }
        assert.equal((source.match(/id="attTrackMessages"/g) || []).length, 1);
        assert.ok(source.indexOf('id="attTrackMessages"') > source.indexOf('</head>'));
    }
});
