'use strict';
define(function(require) {
    var module = require('components/attTrack/module');
    module.factory('state', function() {
      return {
         ctrlData: {},
         stuSelection: undefined,
         selectedStep: undefined,
         selectedExactStep: undefined,
         hs: undefined,
         spinner: { wait: true },
         task: {
             success: '',
             errors: [],
             successCount: 0,
             complete: false
         }
      };
    });
});