'use strict';
define(function(require) {
// Example of sub folder definition for services.
// Always require the index of the sub folder because
// they should require all the files at that level of the directory structure.

// Example of how to require the files within the current folder level
    require('components/attTrack/services/state');
    require('components/attTrack/services/dataService');
});