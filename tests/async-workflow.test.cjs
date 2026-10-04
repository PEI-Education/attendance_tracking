const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}
function load(file, dependencies) {
    let definition;
    const capture = (name, args) => { definition = args; };
    vm.runInNewContext(fs.readFileSync(path.join(root, 'WEB_ROOT/scripts/components/attTrack', file), 'utf8'), {
        document: { getElementById: () => ({ value: '3601' }) },
        define: factory => factory(name => name === 'peiAttTrack/messages'
            ? { read: () => ({ load_error: 'Load failed', selection_error: 'Selection failed' }) }
            : { controller: capture, factory: capture, directive: capture })
    });
    return definition.at(-1)(...definition.slice(0, -1).map(name => dependencies[name]));
}
function grid(service) {
    const scope = { $watch() {} }, state = { spinner: {} };
    load('controllers/controller.js', { $scope: scope, state, dataService: service });
    return { scope, state };
}
test('HTTP service preserves success responses and rejected failures without legacy extensions', async () => {
    const failure = { status: 500, data: 'error' }, success = { status: 200, data: 'ok' };
    const requests = [];
    let fail = false;
    const service = load('services/dataService.js', {
        $httpParamSerializer: () => 'encoded=form',
        $http: {
            post(url, body, config) {
                requests.push({ url, body, config });
                return fail ? Promise.reject(failure) : Promise.resolve(success);
            },
            get: () => Promise.resolve(success)
        }
    });
    assert.equal(await service.postData('/selection', {}), success);
    assert.equal(await service.getData('/records'), 'ok');
    assert.equal(requests[0].body, 'encoded=form');
    assert.equal(requests[0].config.headers['Content-Type'], 'application/x-www-form-urlencoded');
    fail = true;
    await assert.rejects(service.postData('/selection', {}), error => error === failure);
});
test('selection failure releases its own busy state and repeated clicks do not POST twice', async () => {
    const pending = [], calls = [];
    const { scope, state } = grid({ postData(url, payload) {
        const request = deferred(); pending.push(request); calls.push(payload); return request.promise;
    } });
    scope.gridDataFiltered = [{ studentsdcid: 10 }, { studentsdcid: 20 }];
    const first = scope.makeCurrentSelection();
    scope.makeCurrentSelection();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].ac, 'buildsel;table=students;list=0,10,20');
    state.spinner.wait = true; // A separate grid request must retain its indicator.
    pending[0].reject(Error('HTTP 500')); await first;
    assert.equal(scope.selectionBusy, false);
    assert.equal(state.spinner.wait, true);
    assert.equal(scope.selectionError, 'Selection failed');
    assert.equal(scope.showActions, false);
    state.spinner.wait = false;
    const retry = scope.makeCurrentSelection();
    pending[1].resolve({ status: 200 }); await retry;
    assert.equal(scope.showActions, true);
    assert.equal(state.stuSelection.length, 2);
    assert.equal(scope.selectionError, '');
});
test('out-of-order grid responses cannot overwrite the latest filter or stop its spinner', async () => {
    const pending = [];
    const { scope, state } = grid({ getData() { const request = deferred(); pending.push(request); return request.promise; } });
    const older = scope.loadGrid(), latest = scope.loadGrid();
    pending[0].resolve([{ recid: 1 }, {}]); await older;
    assert.equal(scope.gridData.length, 0);
    assert.equal(state.spinner.wait, true);
    pending[1].resolve([{ recid: 2 }, {}]); await latest;
    assert.equal(scope.gridData[0].recid, 2);
    assert.equal(state.spinner.wait, false);
    const next = scope.loadGrid();
    pending[2].reject(Error('HTTP 500')); await next;
    assert.equal(scope.loadError, 'Load failed');
    assert.equal(scope.gridData.length, 0);
    assert.equal(state.spinner.wait, false);
    const retry = scope.loadGrid();
    pending[3].resolve([{ recid: 3 }, {}]); await retry;
    assert.equal(scope.loadError, '');
    assert.equal(scope.gridData[0].recid, 3);
});
test('tile failure and retry clean up independently of grid loading', async () => {
    const pending = [], state = { spinner: { wait: true } };
    const service = { getData() { const request = deferred(); pending.push(request); return request.promise; } };
    const directive = load('directives/attTiles.js', { dataService: service, state });
    directive.controller.at(-1)(service, state);
    state.ctrlData.pssTilesVidget = { setTiles() {} };
    pending[0].reject(Error('HTTP 500')); await tick();
    assert.equal(state.spinner.tilesError, 'Load failed');
    assert.equal(state.spinner.tiles, false);
    assert.equal(state.spinner.wait, true);
    const retry = state.reloadTiles();
    state.reloadTiles();
    assert.equal(pending.length, 2);
    pending[1].resolve([]); await retry;
    assert.equal(state.spinner.tilesError, '');
    assert.equal(state.spinner.tiles, false);
});
test('bulk load failure is recoverable and does not enable a stale student list', async () => {
    const pending = [], scope = {}, state = { spinner: {}, task: {} };
    load('controllers/update.js', { $scope: scope, state, dataService: {
        getData() { const request = deferred(); pending.push(request); return request.promise; }
    } });
    assert.equal(state.spinner.wait, true);
    scope.reloadStudents();
    assert.equal(pending.length, 1);
    pending[0].reject(Error('HTTP 500')); await tick();
    assert.equal(scope.loadError, 'Load failed');
    assert.equal(state.spinner.wait, false);
    assert.equal(scope.gridData.length, 0);
    const retry = scope.reloadStudents();
    pending[1].resolve([{ recid: 1 }, {}]); await retry;
    assert.equal(scope.loadError, '');
    assert.equal(scope.gridData.length, 1);
});
