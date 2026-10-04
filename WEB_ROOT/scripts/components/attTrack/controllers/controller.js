'use strict';
define(function(require) {
    var module = require('components/attTrack/module');
    var localization = require('peiAttTrack/messages');
    module.controller('attGridCtrl', ['$scope', 'dataService', 'state', '$timeout', function($scope, dataService, state, $timeout) {
         $scope.gridData = [];
         $scope.spinner = state.spinner;
         var messages = localization.read();
         $scope.stepMap = {};
         Object.keys(messages).forEach(function(key) {
             if (key.indexOf('step:') === 0) {
                 $scope.stepMap[key.slice(5)] = messages[key];
             }
         });

        $scope.setHS = function() {
            let termid = parseInt(document.getElementById('termid').value, 10);

            return termid  % 100 === 0 ? false : true;
        };
        
        state.hs = $scope.setHS();

        $scope.selectionBusy = false;
        $scope.selectionError = '';
        $scope.makeCurrentSelection = function() {
            if ($scope.selectionBusy || state.spinner.wait || !$scope.gridDataFiltered || !$scope.gridDataFiltered.length) return;
            const selected = $scope.gridDataFiltered.slice();
            $scope.selectionBusy = true;
            $scope.selectionError = '';
            $scope.showActions = false;
            const payload = { ac: 'buildsel;table=students;list=0,' + selected.map(function(row) { return row.studentsdcid; }).join(',') };
            return dataService.postData('/admin/changesrecorded.white.html', payload).then(function() {
                state.stuSelection = selected;
                $scope.showActions = true;
            }).catch(function() {
                $scope.selectionError = messages.selection_error;
            }).finally(function() {
                $scope.selectionBusy = false;
            });
        };

        function dateToText(date) {
            return `${date.getMonth()+1}/${date.getDate()}/${date.getFullYear()}`;
        }
        
        $scope.exportData = function(rowObjects) {
             
            if (!rowObjects || !rowObjects.length) return;
            
            // Get the keys of the first object in the array
            var keys = Object.keys(rowObjects[0]);
        
            // Convert the data to a tab-delimited string
            let lines = [];
            lines.push(keys.map(function(key) { return messages['export:' + key]; }).join('\t'));
            angular.forEach(rowObjects, function(obj) {
              let values = [];
              angular.forEach(keys, function(key) {
                if (key === 'stepDate') {
                    values.push(dateToText(obj.stepDate));
                } else if (key === 'currentStep') {
                    values.push($scope.stepMap[obj[key]]);
                } else {
                    values.push(obj[key]);
                }
              });
              lines.push(values.join('\t'));
            });
            let tabDelimitedString = lines.join('\n');
        
            // Create a link to the file
            let link = document.createElement('a');
            link.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(tabDelimitedString));
            link.setAttribute('download', 'attendanceData.txt');
        
            // Click the link to download the file
            link.click();
        };
        
        let requestVersion = 0;
        $scope.loadGrid = function() {
            const version = ++requestVersion;
            state.spinner.wait = true;
            $scope.loadError = '';
            $scope.showActions = false;
            $scope.gridData = [];
            return dataService.getData('json/attendance_tracking.json?step=' + (state.selectedStep || ''))
                .then(function(retData) {
                    if (version !== requestVersion) return;
                    if (!Array.isArray(retData)) throw new Error('Invalid grid response');
                    const rows = retData.slice();
                    if (rows.length && Object.keys(rows[rows.length - 1]).length === 0) rows.pop();
                    rows.forEach(function(data) {
                        if (data.stepDate) data.stepDate = new Date(data.stepDate);
                    });
                    $scope.gridData = rows;
                }).catch(function() {
                    if (version === requestVersion) $scope.loadError = messages.load_error;
                }).finally(function() {
                    if (version === requestVersion) state.spinner.wait = false;
                });
        };
        $scope.reloadTiles = function() { return state.reloadTiles(); };
        $scope.$watch(function() { return state.selectedStep; }, $scope.loadGrid);
      }]);
});
