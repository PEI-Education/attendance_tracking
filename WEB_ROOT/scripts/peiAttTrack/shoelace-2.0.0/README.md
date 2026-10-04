# Shoelace 2.0.0 (vendored subset)

Unmodified files from `@shoelace-style/shoelace@2.0.0` (`dist/`), MIT licensed (see `LICENSE.md`).
Only `sl-radio-group` and `sl-radio-button` are used by this plugin. This folder holds those two
component entry points, the chunks they import (which also register `sl-button-group`, used
internally by the radio group), and `themes/light.css`.

To rebuild: `npm pack @shoelace-style/shoelace@2.0.0`, then copy the two component files and
follow their relative `import` statements to collect the chunks. `tests/localization.test.cjs`
fails if any import is missing.
