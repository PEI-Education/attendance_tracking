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
            let termid = parseInt(document.getElementById('termid'));

            return termid  % 100 === 0 ? false : true;
        };
        
        state.hs = $scope.setHS();

        $scope.makeCurrentSelection = function() {
            state.spinner.wait = true;
            let studentList = 0;
            $scope.gridDataFiltered.forEach(function(row) {
		        studentList = studentList + "," + row.studentsdcid;
		    });                    
		    let url = "/admin/changesrecorded.white.html";
		    let payload = {ac:'buildsel;table=students;list=' + studentList};
            dataService.postData(url, payload).then(function(result){
                state.spinner.wait = false;
                if (result.status === 'error') {
                    alert(messages.selection_error);
                } else {
                    state.stuSelection = $scope.gridData;
                    $scope.showActions = true;
                }
            });
        };      
        
        
        function dateToText(date) {
            return `${date.getMonth()+1}/${date.getDate()}/${date.getFullYear()}`;
        }
        
        $scope.exportData = function(rowObjects) {
             
            state.spinner.wait = true;        
            
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
            state.spinner.wait = false;
        };
        
         $scope.$watch(
            function () {
               return state.selectedStep;
            },
            function () {
            state.spinner.wait = true;
               
               dataService
                  .getData('json/attendance_tracking.json?step=' + (state.selectedStep || ''))
                  .then(function (retData) {
                    retData.pop();
                    //apply any transformations that can't be made in the view
                    retData.forEach(data => {
                        if (data.stepDate) {
                            data.stepDate = new Date(data.stepDate)
                        }
                    });
                    $scope.gridData = retData;
                    state.spinner.wait = false;
                  });
            },
            true
         );
      },
   ]);
});