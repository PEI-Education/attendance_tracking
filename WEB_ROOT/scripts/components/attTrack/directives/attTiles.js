'use strict';
define(function(require) {
    var module = require('components/attTrack/module');
    var localization = require('peiAttTrack/messages');
    module.directive("attTiles", ["dataService", "state", function (dataService, state) {
        return {
            priority: 100,
            require: ["pssVidget", "pssTilesVidget"],

            controller: ["dataService", "state",
               function (dataService, state) {
                  state.ctrlData = {
                     pssVidgetTiles: null,
                  };
                  
                  state.reloadTiles = function() {
                      if (state.spinner.tiles) return;
                      state.spinner.tiles = true;
                      state.spinner.tilesError = '';
                      var messages = localization.read();
                      return dataService.getData('json/attendance_summary.json?hs=' + state.hs)
                          .then(function(retData) {
                              if (!Array.isArray(retData)) throw new Error('Invalid tile response');
                              retData.forEach(function(tile) {
                                  tile.prefix_name = messages['tile:' + tile.prefix_name];
                                  tile.name = messages['tile:' + tile.name];
                              });
                              state.ctrlData.pssTilesVidget.setTiles(retData);
                          }).catch(function() {
                              state.spinner.tilesError = messages.load_error;
                          }).finally(function() {
                              state.spinner.tiles = false;
                          });
                  };
                  state.reloadTiles();
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