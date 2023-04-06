'use strict';
define(function(require) {
    var module = require('components/attTrack/module');
    module.controller('attUpdateCtrl', ['$scope', 'dataService', 'state', '$q', '$timeout', function($scope, dataService, state, $q, $timeout) {
         $scope.gridData = [];
         $scope.spinner = state.spinner;
         $scope.task = state.task;
         $scope.steps = [
            { id: 2, label: "Student Notification" },
            { id: 3, label: "Parent Call 1" },
            { id: 4, label: "Parent Call 2" },
            { id: 5, label: "Parent Call 3" },
            { id: 7, label: "Letter 1 requested" },
            { id: 8, label: "Letter 1 sent" },
            { id: 10, label: "Letter 2 requested" },
            { id: 11, label: "Letter 2 sent" },
            { id: 13, label: "Letter 3 requested" },
            { id: 14, label: "Letter 3 sent" },
            { id: 15, label: "Referred to the Director" }
        ];
        $scope.sn = {
            student_notification: 0,
            student_notification_staff: '',
            student_notification_date: ''
        };
        $scope.pc1  = {
            parent_call_1: 0, 
            parent_call_1_staff: '', 
            parent_call_1_date: '', 
            parent_call_notes: ''
        };
        $scope.pc2  = {
            parent_call_2: 0, 
            parent_call_2_staff: '', 
            parent_call_2_date: '', 
            parent_call_notes: ''            
        };
        $scope.pc3  = {
            parent_call_3: 0, 
            parent_call_3_staff: '', 
            parent_call_3_date: '', 
            parent_call_notes: ''            
        };
        $scope.c2req = {
            concern_2: 0, 
            concern_2_req_staff: '', 
            concern_2_req_date: '', 
            concern_2_notes: ''
        };
        $scope.c2sent = {
            concern_2: 1,
            concern_2_sent_staff: '', 
            concern_2_sent_date: '', 
            concern_2_notes: ''
        };
        $scope.c3req = {
            concern_3: 0, 
            concern_3_req_staff: '', 
            concern_3_req_date: '', 
            concern_3_notes: ''
        };
        $scope.c3sent = {
            concern_3: 1,
            concern_3_sent_staff: '', 
            concern_3_sent_date: '', 
            concern_3_notes: ''
        };
        $scope.c4req = {
            concern_4: 0, 
            concern_4_req_staff: '', 
            concern_4_req_date: '', 
            concern_4_notes: ''
        };
        $scope.c4sent = {
            concern_4: 1,
            concern_4_sent_staff: '', 
            concern_4_sent_date: '', 
            concern_4_notes: ''
        };
        $scope.referral = {
            referral: 0,
            referral_staff: '',
            referral_date: ''
        };
    
        let getStudents = function() {
            state.task.allDone= false;
            state.spinner.wait = true;
            dataService.getData('json/attendance_tracking.json?update=1')
            .then(function(retData) {
                retData.pop();
                
                retData.forEach(data => {
                    if (data.stepDate) {
                        data.stepDate = new Date(data.stepDate);
                    }
                });
                $scope.gridData = retData;
                console.log(retData);
                state.spinner.wait = false;
            });
        };
        
        let init = function() {
          state.spinner.wait = true;
          $scope.gridData = getStudents();
          $scope.currentUser = document.getElementById('staffName').value;
          $scope.currentDate = document.getElementById('dateToday').value;
          $scope.showValidation = false;
          //stepChoice will be step the user selects; stepSelection will be the variable used to display content, after it is verified that the selection is valid fo the users.
          $scope.stepChoice = undefined;
          $scope.stepSelection = undefined;
          state.spinner.wait = false;
          state.task.allDone = false;
        };
        
        init();
        
        $scope.verifySelection = function() {
            state.spinner.wait = true;
            state.task.allDone = false;
            let students = $scope.gridData;
            let validStudents = [];
            let invalidStudents= [];
            let validSteps;
            
            
            let step = $scope.stepChoice.id;
            if (step === 7 || step === 10 || step === 13) {
                validSteps = [step, step-1, step-2]
            } else {
                validSteps = [step, step-1]
            }
            
            students.forEach(student => {
                if (step === 2 && student.termGrade < 10) {
                    invalidStudents.push(student);
                } if (step === 7 && student.currentStepIdx < 7 && student.callPoints >= 3) {
                    validStudents.push(student)
                } else if (validSteps.includes(student.currentStepIdx)) {
                    validStudents.push(student);
                } else {
                    invalidStudents.push(student);
                }
            });
            $scope.validStudents = validStudents;
            $scope.invalidStudents = invalidStudents;
            $scope.showValidation = true;
            $scope.stepSelection = validStudents.length === 0 ? 0 : $scope.stepChoice;
            state.spinner.wait = false;
        }
        
        $scope.setStaffDate = function(group,step) {
            console.log('setStaffDate triggered')
            if (parseInt($scope[group][step])===0) {
                $scope[group][`${step}_staff`] = null;
                $scope[group][`${step}_date`] = null;
                console.log('null - no action')
            } else {
                $scope[group][`${step}_staff`] = $scope.currentUser;
                $scope[group][`${step}_date`] = $scope.currentDate;
                $scope.$apply;
            }
        };
        
        $scope.setValues = function(group,step,value) {
            $scope[group][step] = value;
            $scope.setStaffDate(group,step);
        }
        
        $scope.save = function(step) {
            state.spinner.wait = true;
            let promises = [];
            
            $scope.validStudents.forEach(student => {
                promises.push(dataService.updateRecord(student.recid, $scope[step]))
            });
            
            $q.all(promises).then(function(result) {
                if (result.length === $scope.validStudents.length) {

                    $timeout(function() {
                        state.task.success = `All ${result.length} students' checklists were updated.`
                        state.task.allDone = true;
                        state.spinner.wait = false;
                    },1500);
                }
            });
                
        };
        
    }]);
});