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

        // Export columns, in order; explicit so Angular's $$hashKey never becomes a column.
        const EXPORT_FIELDS = ['recid', 'termid', 'studentsdcid', 'studentNumber', 'lastName', 'firstName', 'currentGrade',
            'termGrade', 'currentSchool', 'termSchool', 'termSchoolName', 'currentStep', 'currentStepIdx', 'stepDate',
            'studentNotification', 'parentCall1', 'parentCall2', 'parentCall3', 'concern2', 'concern3', 'concern4',
            'referral', 'callPoints'];

        // Formats with the page's ~[dateformat] (e.g. dd/MM/yyyy in French); rows with no action have no date.
        function dateToText(date) {
            if (!date || typeof date.getTime !== 'function' || isNaN(date.getTime())) return '';
            const input = document.getElementById('dateFormat');
            const format = input && input.value ? input.value : 'MM/dd/yyyy';
            const pad = function(value) { return String(value).padStart(2, '0'); };
            return format.replace('yyyy', date.getFullYear()).replace('MM', pad(date.getMonth() + 1)).replace('dd', pad(date.getDate()));
        }

        $scope.exportData = function(rowObjects) {

            if (!rowObjects || !rowObjects.length) return;

            // Convert the data to a tab-delimited string
            let lines = [];
            lines.push(EXPORT_FIELDS.map(function(key) { return messages['export:' + key]; }).join('\t'));
            angular.forEach(rowObjects, function(obj) {
              let values = [];
              angular.forEach(EXPORT_FIELDS, function(key) {
                let value;
                if (key === 'stepDate') {
                    value = dateToText(obj.stepDate);
                } else if (key === 'currentStep') {
                    value = $scope.stepMap[obj[key]];
                } else {
                    value = obj[key];
                }
                // Tabs or line breaks inside a value would shift columns or rows.
                values.push(value === undefined || value === null ? '' : String(value).replace(/[\t\r\n]+/g, ' '));
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
        
        // All checklists for the term load once; tiles filter in the browser to students currently at that step.
        let allRows = [];
        function applyFilter() {
            const step = state.selectedStep;
            $scope.showActions = false;
            $scope.gridData = !step || step === 1 ? allRows : allRows.filter(function(row) { return row.currentStepIdx === step; });
        }

        let requestVersion = 0;
        $scope.loadGrid = function() {
            const version = ++requestVersion;
            state.spinner.wait = true;
            $scope.loadError = '';
            $scope.showActions = false;
            $scope.gridData = [];
            return dataService.getData('json/attendance_tracking.json')
                .then(function(retData) {
                    if (version !== requestVersion) return;
                    if (!Array.isArray(retData)) throw new Error('Invalid grid response');
                    const rows = retData.slice();
                    if (rows.length && Object.keys(rows[rows.length - 1]).length === 0) rows.pop();
                    rows.forEach(function(data) {
                        if (data.stepDate) data.stepDate = new Date(data.stepDate);
                    });
                    allRows = rows;
                    state.tileRows = rows;
                    if (state.setTileRows) state.setTileRows(rows);
                    applyFilter();
                }).catch(function() {
                    if (version === requestVersion) $scope.loadError = messages.load_error;
                }).finally(function() {
                    if (version === requestVersion) state.spinner.wait = false;
                });
        };
        $scope.$watch(function() { return state.selectedStep; }, applyFilter);
        $scope.loadGrid();
      }]);
});
