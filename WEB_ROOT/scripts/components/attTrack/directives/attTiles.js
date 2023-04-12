'use strict';
define(function(require) {
    var module = require('components/attTrack/module');
    module.directive("attTiles", ["dataService", "state", function (dataService, state) {
        return {
            priority: 100,
            require: ["pssVidget", "pssTilesVidget"],

            controller: ["dataService", "state",
               function (dataService, state) {
                  state.ctrlData = {
                     pssVidgetTiles: null,
                  };
                  
                  state.spinner.wait = true;

                  dataService
                     .getData("json/attendance_summary.json?hs=" + state.hs)
                     .then(function (retData) {
                        state.ctrlData.pssTilesVidget.setTiles(retData);
                     });
                     
                  state.spinner.wait = false;
               },
            ],

            link: function (scope, element, attributes, controllers) {
               
               state.ctrlData.pssTilesVidget = controllers[1];
               let filterListener = function (newValue, oldValue) {
                  state.selectedStep = newValue.id;
               };

               state.ctrlData.pssTilesVidget.addTilesFilterListener(filterListener);
            },
        };
    }]);   
});