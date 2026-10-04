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
        if (file.includes('/shoelace-2.0.0/')) continue; // Vendored ES modules, checked separately.
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
    test(`${locale}: dashboard covers every SQL status, export field, and tile label`, async () => {
        const dict = catalog(locale);
        const env = environment('WEB_ROOT/admin/pei_reports/attendance_tracking.html', dict);
        const scope = { $watch() {} };
        component('WEB_ROOT/scripts/components/attTrack/controllers/controller.js', env, { $scope: scope, state: { spinner: {} }, dataService: { getData: () => new Promise(() => {}) } });
        const sql = read('WEB_ROOT/admin/pei_reports/json/attendance_tracking.json');
        const statuses = [...sql.matchAll(/then '([^']+)'|else\s+'([^']+)'/g)].map(m => m[1] || m[2]);
        for (const status of statuses) assert.ok(scope.stepMap[status], status);
        const row = Object.fromEntries([...sql.matchAll(/"(\w+)"\s*:/g)].map(([, key]) => [key, 0]));
        row.currentStep = 'No steps taken'; row.stepDate = new Date(2026, 9, 4);
        scope.exportData([row]);
        const exported = decodeURIComponent(env.document.download.href.split(',')[1]).split('\n');
        assert.ok(!exported[0].split('\t').includes(''), 'untranslated export header');
        assert.ok(exported[1].includes(dict[A + 'no_steps_taken']));
        assert.equal(scope.stepMap['Referral closed'], dict[S + 'referral_closed']);
        row.currentStep = 'Referral closed';
        scope.exportData([row]);
        assert.ok(decodeURIComponent(env.document.download.href).includes(dict[S + 'referral_closed']));
        const tileSource = read('WEB_ROOT/scripts/components/attTrack/directives/attTiles.js');
        const labels = [...tileSource.matchAll(/(prefix_name|name): '([^']+)'/g)];
        assert.ok(labels.length >= 26);
        const messages = env.localization.read();
        for (const [, , value] of labels) assert.ok(messages['tile:' + value], value);
        let rendered;
        const state = { spinner: {}, hs: true };
        const directive = component('WEB_ROOT/scripts/components/attTrack/directives/attTiles.js', env, { state });
        directive.controller.at(-1)(state);
        state.ctrlData.pssTilesVidget = { setTiles(value) { rendered = value; } };
        state.setTileRows([{ currentStepIdx: 16 }, { currentStepIdx: 16 }]);
        const closed = rendered.find(tile => tile.id === 16);
        assert.equal(closed.prefix_name, dict[S + 'referral']);
        assert.equal(closed.name, dict[A + 'closed']);
        assert.equal(closed.count, 2);
        assert.ok(rendered.every(tile => tile.prefix_name && tile.name));
    });
    test(`${locale}: bulk steps and success count use resolved messages`, async () => {
        const dict = catalog(locale);
        const env = environment('WEB_ROOT/admin/pei_reports/attUpdateChecklist.html', dict);
        const scope = {}, state = { spinner: {}, task: {} };
        component('WEB_ROOT/scripts/components/attTrack/controllers/update.js', env, {
            $scope: scope, state, $timeout: fn => fn(), $q: Object.assign(fn => new Promise(fn), { all: promises => Promise.all(promises) }),
            dataService: { getData: () => Promise.resolve([{}]), updateRecord: () => Promise.resolve(1) }
        });
        assert.equal(scope.steps.length, 11);
        assert.equal(scope.steps[0].label, dict[A + 'student_notification']);
        assert.ok(scope.steps.every(step => step.label));
        scope.validStudents = [{ recid: 1 }, { recid: 2 }];
        scope.setValues('sn', 'student_notification', 1);
        Object.assign(scope.sn, { student_notification_staff: 'Staff', student_notification_date: '04/10/2026' });
        scope.save('sn');
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(state.task.success, dict[A + 'bulk_summary'].replace('{saved}', '2').replace('{failed}', '0').replace('{unconfirmed}', '0'));
    });
    test(`${locale}: both student pages supply every alert and preserve punctuation`, () => {
        const dict = catalog(locale);
        for (const page of ['WEB_ROOT/admin/students/pei_attendance_tracking.html', 'WEB_ROOT/teachers/studentpages/pei_attendance_tracking.html']) {
            const env = environment(page, dict);
            const messages = env.localization.read();
            for (const key of ['save_unconfirmed', 'section_not_saved']) assert.equal(messages[key], dict[S + key]);
            assert.equal(env.localization.format(messages.section_not_saved, '{code}', -1), dict[S + 'section_not_saved'].replace('{code}', '-1'));
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
        controller({}, { getRecord(url) { requests.push(url); return new Promise(() => {}); } }, () => {});
        assert.equal(requests[0], endpoint);
        if (page.includes('/teachers/')) {
            for (const id of ['emailSubject', 'emailBody']) {
                const match = source.match(new RegExp(`id="${id}"[^>]*?value="([^"]*)"`)) || source.match(new RegExp(`<textarea id="${id}"[^>]*>([\\s\\S]*?)</textarea>`));
                const value = match[1];
                assert.ok(value.includes('~[text:'));
                assert.ok(!value.includes('has requested') && !value.includes('Contact powerschoolhelp'));
            }
        }
        // Text inputs strip newlines from their value; the body must be a textarea so its blank line survives.
        assert.match(source, /<textarea id="emailBody"[^>]*>[^<]*\n\n[^<]*<\/textarea>/);
        assert.ok(!source.includes('&#13;'));
    }
    const emails = [...Object.values(dict).join('\n').matchAll(/[\w.+-]+@[\w.-]+\.[A-Za-z]+/g)].map(m => m[0]);
    assert.ok(emails.length > 0);
    assert.ok(emails.every(email => email === 'jhdoyle@edu.pe.ca'));
});
test('admin referral recipient is always a quoted value with balanced board conditionals', () => {
    const source = read('WEB_ROOT/admin/students/pei_attendance_tracking.html');
    const input = source.match(/<input[^>]*id="emailTo"[^>]*>/)[0];
    const value = input.match(/value="([^"]*)"/)[1];
    for (const label of ['psb', 'cslf']) {
        assert.equal((value.match(new RegExp(`~\\[if#${label}\\.`, 'g')) || []).length, 1, label);
        assert.equal((value.match(new RegExp(`\\[/if#${label}\\]`, 'g')) || []).length, 1, label);
    }
    assert.ok(value.includes('~(schoolid)<500') && value.includes('~(schoolid)<601'));
    const en = catalog('US_en'), fr = catalog('CA_fr');
    for (const dict of [en, fr]) assert.ok(dict[S + 'you_can_review_their_file_by_l'].includes("'student_number=~(student_number)'"));
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
test('referral display and print views label each step with its own fields', () => {
    const teacher = read('WEB_ROOT/teachers/studentpages/pei_attendance_tracking.html');
    const admin = read('WEB_ROOT/admin/students/pei_attendance_tracking.html');
    // Teacher checkboxes are read-only views of 0 = none, 1 = referred, 2 = closed.
    assert.match(teacher, /ng-checked="record\.referral\.referral > 0" name="referral" id="referral" disabled/);
    assert.match(teacher, /ng-checked="record\.referral\.referral == 2" name="referral_closed" id="referral_closed" disabled/);
    for (const source of [teacher, admin]) {
        const print = source.slice(source.indexOf('id="printarea"'));
        // Admin print repeats each letter heading as its row label; the teacher print labels rows "flag concern".
        const perLetter = source === admin ? 2 : 1;
        for (const n of [1, 2, 3]) assert.equal((print.match(new RegExp(`written_notification_${n}\\]`, 'g')) || []).length, perLetter, `letter ${n}`);
        assert.ok(print.includes('{{ record.referral.referral_closed_staff }}') && print.includes('{{ record.referral.referral_closed_date }}'));
        assert.ok(!source.includes('row-span') && !source.includes('``'));
        assert.match(source, /popupWin\.document\.close\(\);/);
        assert.match(source, /'<\/body><\/html>'\);/);
    }
});
test('export uses fixed columns, the page date format, and survives rows without an action date', () => {
    const dict = catalog('CA_fr');
    const env = environment('WEB_ROOT/admin/pei_reports/attendance_tracking.html', dict);
    const getElementById = env.document.getElementById;
    env.document.getElementById = id => id === 'dateFormat' ? { value: 'dd/MM/yyyy' } : getElementById(id);
    const scope = { $watch() {} };
    component('WEB_ROOT/scripts/components/attTrack/controllers/controller.js', env,
        { $scope: scope, state: { spinner: {} }, dataService: { getData: () => new Promise(() => {}) } });
    const row = { recid: 1, lastName: 'Le\tBlanc', firstName: 'Zoé\nA', currentStep: 'Letter 1 sent', stepDate: new Date(2026, 9, 4), $$hashKey: 'object:7' };
    const empty = { recid: 2, lastName: 'Gallant', firstName: 'Max', currentStep: 'No steps taken', stepDate: '' };
    scope.exportData([row, empty]);
    const lines = decodeURIComponent(env.document.download.href.split(',').slice(1).join(',')).split('\n');
    const header = lines[0].split('\t');
    assert.equal(lines.length, 3);
    assert.equal(header.length, 23);
    assert.ok(header.every(Boolean));
    assert.ok(!lines.join('\n').includes('object:7'));
    const first = lines[1].split('\t'), second = lines[2].split('\t');
    assert.equal(first.length, 23);
    assert.equal(first[4], 'Le Blanc');
    assert.equal(first[5], 'Zoé A');
    assert.equal(first[13], '04/10/2026');
    assert.equal(second[13], '');
    assert.equal(second[11], dict[A + 'no_steps_taken']);
});
test('Shoelace radio components load from the plugin, with every module import present', () => {
    const vendor = 'WEB_ROOT/scripts/peiAttTrack/shoelace-2.0.0';
    for (const page of ['WEB_ROOT/admin/students/pei_attendance_tracking.html', 'WEB_ROOT/teachers/studentpages/pei_attendance_tracking.html',
        'WEB_ROOT/admin/pei_reports/attUpdateChecklist.html']) {
        const source = read(page);
        assert.ok(!source.includes('cdn.jsdelivr.net'), page);
        for (const [, url] of source.matchAll(/(?:src|href)="(\/scripts\/peiAttTrack\/shoelace-2\.0\.0\/[^"]+)"/g)) {
            assert.ok(fs.existsSync(path.join(root, 'WEB_ROOT', url)), url);
        }
        assert.ok(source.includes('/components/radio-group/radio-group.js') && source.includes('/components/radio-button/radio-button.js'), page);
    }
    for (const file of files(vendor).filter(file => file.endsWith('.js'))) {
        for (const [, specifier] of read(file).matchAll(/(?:import|export)\s*(?:[^'"]*?from\s*)?["']([^"']+)["']/g)) {
            assert.ok(specifier.startsWith('.'), `${file}: ${specifier}`);
            assert.ok(fs.existsSync(path.join(root, path.posix.dirname(file), specifier)), `${file}: ${specifier}`);
        }
    }
    assert.ok(!read('plugin.xml').includes('cdn'));
    assert.ok(fs.existsSync(path.join(root, vendor, 'LICENSE.md')));
});
test('icons are inline SVG; no page depends on the external Foundation icon stylesheet', () => {
    for (const file of files('WEB_ROOT').filter(file => /\.(html|txt)$/.test(file))) {
        const source = read(file);
        assert.ok(!source.includes('foundation-icons') && !/class="fi[- ]/.test(source), file);
        for (const [svg] of source.matchAll(/<svg class="att-icon[^>]*>/g)) assert.match(svg, /aria-hidden="true"/, file);
    }
});
test('no page or endpoint reads URL parameters (gpv), which PowerSchool substitutes before parsing tags', () => {
    for (const file of files('WEB_ROOT').filter(file => /\.(html|json|txt)$/.test(file))) {
        assert.ok(!/~\(gpv\./.test(read(file)), file);
    }
});
