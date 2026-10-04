/* PowerSchool expands message keys in HTML, not in standalone JavaScript.
 * Read text nodes so quotes, accents and markup never become JavaScript source.
 */
define(function() {
    'use strict';
    function read() {
        var messages = Object.create(null);
        document.querySelectorAll('#attTrackMessages [data-att-message]').forEach(function(node) {
            messages[node.getAttribute('data-att-message')] = node.textContent;
        });
        return messages;
    }
    function format(message, token, value) {
        return message.split(token).join(String(value));
    }
    return { read: read, format: format };
});
