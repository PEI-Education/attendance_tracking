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
function load(file, dependencies, globals = {}) {
    let definition;
    const capture = (name, args) => { definition = args; };
    vm.runInNewContext(fs.readFileSync(path.join(root, 'WEB_ROOT/scripts/components/attTrack', file), 'utf8'), {
        ...globals,
        document: { getElementById: () => ({ value: '3601' }) },
        define: factory => factory(name => name === 'peiAttTrack/messages'
            ? { read: () => ({ load_error: 'Load failed', selection_error: 'Selection failed' }) }
            : { controller: capture, factory: capture, directive: capture })
    });
    return definition.at(-1)(...definition.slice(0, -1).map(name => dependencies[name]));
}
function grid(service) {
    const scope = { $watch() {} }, state = { spinner: {} };
    // The controller loads the grid once on construction.
    const dataService = Object.assign({ getData: () => Promise.resolve([{}]) }, service);
    load('controllers/controller.js', { $scope: scope, state, dataService });
    return { scope, state };
}
test('queue service accepts psQuery insert success and rejects zero', async () => {
    let result;
    const service = load('services/dataService.js', { $q: executor => new Promise(executor) }, {
        $psq: table => {
            assert.equal(table, 'queue');
            return { insert(fields, callback) { callback(result); } };
        }
    });
    for (result of [-1, '-1', 902, '902']) assert.equal(await service.queueEmail({type:100}), result);
    for (result of [0, '0']) await assert.rejects(service.queueEmail({type:100}), error => error.outcome === 'failed');
    result = undefined;
    await assert.rejects(service.queueEmail({type:100}), error => error.outcome === 'unconfirmed');
});
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
    await tick();
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
    pending[0].resolve([{ recid: 0 }, {}]); await tick(); // superseded below
    const older = scope.loadGrid(), latest = scope.loadGrid();
    pending[1].resolve([{ recid: 1 }, {}]); await older;
    assert.equal(scope.gridData.length, 0);
    assert.equal(state.spinner.wait, true);
    pending[2].resolve([{ recid: 2 }, {}]); await latest;
    assert.equal(scope.gridData[0].recid, 2);
    assert.equal(state.spinner.wait, false);
    const next = scope.loadGrid();
    pending[3].reject(Error('HTTP 500')); await next;
    assert.equal(scope.loadError, 'Load failed');
    assert.equal(scope.gridData.length, 0);
    assert.equal(state.spinner.wait, false);
    const retry = scope.loadGrid();
    pending[4].resolve([{ recid: 3 }, {}]); await retry;
    assert.equal(scope.loadError, '');
    assert.equal(scope.gridData[0].recid, 3);
});
test('tiles count students currently at each step and filter the grid to that step', async () => {
    const watchers = [], scope = { $watch(get, fn) { watchers.push(fn); } }, state = { spinner: {}, hs: true };
    let tiles;
    const directive = load('directives/attTiles.js', { state });
    directive.controller.at(-1)(state);
    directive.link(null, null, null, [null, { setTiles(value) { tiles = value; }, addTilesFilterListener(fn) { state.listen = fn; } }]);
    const rows = [{ recid: 1, currentStepIdx: 1 }, { recid: 2, currentStepIdx: 3 }, { recid: 3, currentStepIdx: 16 }, { recid: 4, currentStepIdx: 16 }, {}];
    load('controllers/controller.js', { $scope: scope, state, dataService: { getData: () => Promise.resolve(rows) } });
    await tick();
    const count = id => tiles.find(tile => tile.id === id).count;
    assert.equal(count(1), 4);
    assert.equal(count(3), 1);
    assert.equal(count(4), 0);
    assert.equal(count(16), 2);
    assert.ok(tiles.some(tile => tile.id === 2));
    state.listen({ id: 16 }); watchers[0]();
    assert.deepEqual(scope.gridData.map(row => row.recid), [3, 4]);
    state.listen({ id: 1 }); watchers[0]();
    assert.equal(scope.gridData.length, 4);
    state.listen(null); watchers[0]();
    assert.equal(scope.gridData.length, 4);
    state.hs = false; state.setTileRows(state.tileRows);
    assert.ok(!tiles.some(tile => tile.id === 2));
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
