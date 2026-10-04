'use strict';
define(function(require) {
    var module = require('components/attTrack/module');
    var localization = require('peiAttTrack/messages');
    // Tile ids match current_step_idx in json/attendance_tracking.json. Id 1 is the total.
    // Labels are stable identifiers, translated through the page's tile: messages.
    var TILES = [
        { id: 1, prefix_name: 'Checklists', name: 'Created' },
        { id: 2, prefix_name: 'Student', name: 'Notified', hsOnly: true },
        { id: 3, prefix_name: 'Call 1', name: 'Complete' },
        { id: 4, prefix_name: 'Call 2', name: 'Complete' },
        { id: 5, prefix_name: 'Call 3', name: 'Complete' },
        { id: 7, prefix_name: 'Letter 1', name: 'Requested' },
        { id: 8, prefix_name: 'Letter 1', name: 'Sent' },
        { id: 10, prefix_name: 'Letter 2', name: 'Requested' },
        { id: 11, prefix_name: 'Letter 2', name: 'Sent' },
        { id: 13, prefix_name: 'Letter 3', name: 'Requested' },
        { id: 14, prefix_name: 'Letter 3', name: 'Sent' },
        { id: 15, prefix_name: 'Referred to', name: 'Director' },
        { id: 16, prefix_name: 'Referral', name: 'Closed' }
    ];
    module.directive("attTiles", ["state", function (state) {
        return {
            priority: 100,
            require: ["pssVidget", "pssTilesVidget"],

            controller: ["state",
               function (state) {
                  state.ctrlData = {
                     pssTilesVidget: null,
                  };

                  // Counts students currently at each step, from the rows the grid already loaded.
                  state.setTileRows = function(rows) {
                      if (!state.ctrlData.pssTilesVidget) return;
                      var messages = localization.read();
                      state.ctrlData.pssTilesVidget.setTiles(TILES.filter(function(tile) {
                          return state.hs || !tile.hsOnly;
                      }).map(function(tile) {
                          return {
                              id: tile.id,
                              prefix_name: messages['tile:' + tile.prefix_name],
                              name: messages['tile:' + tile.name],
                              count: tile.id === 1 ? rows.length : rows.filter(function(row) {
                                  return row.currentStepIdx === tile.id;
                              }).length,
                              carouselItem: true
                          };
                      }));
                  };
               },
            ],

            link: function (scope, element, attributes, controllers) {

               state.ctrlData.pssTilesVidget = controllers[1];
               let filterListener = function (newValue, oldValue) {
                  state.selectedStep = newValue ? newValue.id : undefined;
               };

               state.ctrlData.pssTilesVidget.addTilesFilterListener(filterListener);
               // Rows may arrive before the tiles widget links.
               if (state.tileRows) state.setTileRows(state.tileRows);
            },
        };
    }]);
});
