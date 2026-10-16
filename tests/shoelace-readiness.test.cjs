const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(`${__dirname}/../WEB_ROOT/scripts/peiAttTrack/shoelace-2.0.0/chunks/chunk.3U56GCHF.js`, 'utf8');
const handler = source.match(/  async handleSlotChange\(\) \{([\s\S]*?)\n  \}\n  updateCheckedRadio/)[1];
function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}
function group(radios) {
    return { isConnected: true, value: '{{record.calls.parent_call_1}}', getAllRadios: () => radios };
}
function run(host, whenDefined = () => Promise.resolve()) {
    return vm.runInNewContext(`(async function() {${handler}})`, { customElements: { whenDefined } }).call(host);
}
test('slot initialization waits for registration and first render before accessing shadow DOM', async () => {
    const registration = deferred();
    const render = deferred();
    const radio = { localName: 'sl-radio-button', tagName: 'SL-RADIO-BUTTON', value: '0', shadowRoot: null };
    const host = group([radio]);
    const pending = run(host, () => registration.promise);
    await Promise.resolve();
    assert.equal(radio.checked, undefined);
    radio.updateComplete = render.promise;
    registration.resolve();
    await Promise.resolve();
    assert.equal(radio.checked, undefined);
    const button = { tabIndex: -1 };
    radio.shadowRoot = { querySelector: () => button };
    render.resolve();
    await pending;
    assert.equal(button.tabIndex, 0);
    assert.equal(radio.checked, false);
    host.value = '0';
    await run(host);
    assert.equal(radio.checked, true);
});
test('empty groups and children replaced or disconnected during loading are safe', async () => {
    await run(group([]));
    for (const disconnected of [false, true]) {
        const registration = deferred();
        const radio = { localName: 'sl-radio-button', shadowRoot: null };
        const host = group([radio]);
        const pending = run(host, () => registration.promise);
        if (disconnected) host.isConnected = false;
        else host.getAllRadios = () => [];
        registration.resolve();
        await pending;
        assert.equal(radio.checked, undefined);
    }
});
