define(['angular', 'components/shared/index'], function(angular) {

    var attTrackApp = angular.module('attTrackMod', ['powerSchoolModule']);
  
    attTrackApp.controller('attTrackCtrl', ['$scope', 'attTrackHttpService', '$timeout', function($scope, attTrackHttpService, $timeout) {
                
        let init = function() {
            loadingDialog();
            $scope.termid = document.getElementById('termid').value;
            $scope.record = {};
            $scope.getGrade('attTrackGrade.json');
            $scope.getRecord('attTrack.json');
            $scope.validTerm();
            $scope.message = '';
        };
        
        $scope.getRecord = function(datafile) {
            attTrackHttpService.getRecord(datafile).then(function(retData) {
                if (typeof retData === "object") {
                  $scope.record = retData;
                } else {
                  $scope.record.parent_call_1 = 0;
                  $scope.record.parent_call_2 = 0;
                  $scope.record.parent_call_3 = 0;
                  $scope.record.concern_2 = 0;
                  $scope.record.concern_3 = 0;
                  $scope.record.concern_4 = 0;
                  $scope.record.referral = 0;
                  $scope.record.concern_2_notes = '';
                  $scope.record.concern_3_notes = '';
                  $scope.record.concern_4_notes = '';
                }
             });
          }
  
          // Adds the student's grade_level in the context of the termid, and sets the student_notification property to 'na' if that level is less than Grade 10
          $scope.getGrade = function(datafile) {
              attTrackHttpService.getRecord(datafile).then(function(retData) {
                if (typeof(retData) === 'number') {
                    $scope.gradeInYear = retData;
                    if ($scope.gradeInYear < 10) {
                        $scope.record.student_notification = 'na';
                    }
                } else {
                    alert('bad response to getGrade');
                }
            })
        }
        
        // Checks if the termid is valid for the student's grade_level in the context of the termid
        $scope.validTerm = function() {
            let remainder = parseInt(document.getElementById('termid').value) % 100
            if (remainder !== 0 && $scope.gradeInYear < 10) { 
                return false
            } 
            if (remainder === 0 && $scope.gradeInYear > 9) {
                return false
            }
            return true
        }
        
        // Sums the three parent_call_# properties on the record. If sum >= 3 (3 calls with no contact or 1 call with contact, minimum), process can move on to letters
        $scope.radioSum = function() {
            return ($scope.record.parent_call_1 + $scope.record.parent_call_2 + $scope.record.parent_call_3) < 3;
        }
        
        // Returns the number of days passed between two dates
        $scope.daysPassed = function(earlyDate, laterDate) {
            let date1 = new Date(earlyDate);
            let date2 = new Date(laterDate);
            return Math.ceil((date2 - date1)/(1000 * 3600 * 24));
        }
        
        // Logic for disabling the buttons relating to written notifications
        // Previous letter must have been sent and at least 5 weekdays (1 week) must have passed
        $scope.disableConcern = function(prevConcern) {
            const DAYS = 7;
            const PREVACTIONS = 2;
            if ($scope.record[prevConcern] < PREVACTIONS) {
                return true;
            }
            if ($scope.daysPassed($scope.record[`${prevConcern}_sent_date`], document.getElementById('dateToday').value) < DAYS) {
                return true;
            }
            return false;
        }
        
        // Logic for disabling the referral section
        $scope.disableReferral = function() {
            let concerns = ['concern_2', 'concern_3', 'concern_4']
            for (const concern of concerns) {
                if ($scope.record[concern] != 2) {
                    return true
                }
                if ($scope.record[`${concern}_notes`].length < 10) {
                    return true;
                }
            }
            return false;
        }
        
        // Auto-fills the staff and date for student notification and referral sections when appropriate
        $scope.actionResponse = function(e, step) {
            e.preventDefault();
            if (step === 'student_notification') {
              $scope.record.student_notification = true;
            }
            if (step === 'referral') {
                $scope.record.referral = 1;
            }
            $scope.record[`${step}_staff`] = $scope.record[`${step}_staff`] ? $scope.record[`${step}_staff`] : document.getElementById('staffName').value;
            $scope.record[`${step}_date`] = $scope.record[`${step}_date`] ? $scope.record[`${step}_date`] : document.getElementById('dateToday').value;
        }
        
        // Auto-fills staff and date for parent call sections when appropriate
        $scope.radioActionResponse = function(e, step, result) {
            $scope.record[step] = result;
            if (!$scope.record[`${step}_staff`]) {
                  $scope.record[`${step}_staff`] = document.getElementById('staffName').value;
                  $scope.recordView[`${step}_staff`].$setDirty();
            }
            if (!$scope.record[`${step}_date`]) {
                  $scope.record[`${step}_date`] = document.getElementById('dateToday').value;
                  $scope.recordView[`${step}_staff`].$setDirty();
            }
            $scope.recordView[step].$setDirty();
          }
        
        // Autofills staff and date of request and sending of written notifications
        $scope.writtenActionResponse = function(e, step, direction, result) {
            e.preventDefault();
            $scope.record[step] = result;
            $scope.recordView[step].$setDirty();
            if (!$scope.record[`${step}_${direction}_staff`]) {
                $scope.record[`${step}_${direction}_staff`] = document.getElementById('staffName').value;
                $scope.recordView[`${step}_${direction}_staff`].$setDirty();
            }
            if (!$scope.record[`${step}_${direction}_date`]) {
                $scope.record[`${step}_${direction}_date`] = document.getElementById('dateToday').value;
                $scope.recordView[`${step}_${direction}_date`].$setDirty();
            }
        }
  
        // Saves data to the u_pei_att_track table
        const SAVED = 'saved';
        const SAVING = 'saving';
        const UNSAVED = 'unsaved';

        $scope.save = function(e, step) {
            e.preventDefault();
            loadingDialog();
            
            let list = document.querySelectorAll(`[data-step="${step}"]`);
            let elements = {};
            list.forEach(item => elements[item.id] = $scope.record[item.id]);
            if (step.substring(0,11) === 'parent_call' ) {
                elements.parent_call_notes = $scope.record.parent_call_notes;
            }
            if (!$scope.record.id) {
                elements.termid = document.getElementById('termid').value;
                attTrackHttpService.insertRecord(document.getElementById('studentsdcid').value, elements, function(retID) {
                    if (retID === '-1') {
                       console.log(`${step} data saved successfully`);
                       $scope[`${step}_save`] = SAVING;
                       $timeout(function() {
                           $scope[`${step}_save`] = SAVED;
                           $scope.getRecord('attTrack.json');
                        }, 1000);   
                    } else {
                        alert(`${step} not saved.`);
                    }
                });
            } else {
                attTrackHttpService.updateRecord($scope.record.id, elements, function(retID) {
                    if (retID === '-1' || retID === $scope.record.id) {
                        $scope.getRecord('attTrack.json');
                        console.log(`${step} data saved successfully`);
                        $scope[`${step}_save`] = SAVING
                       $timeout(function() {
                           $scope[`${step}_save`] = SAVED
                           $scope.getRecord('attTrack.json');
                        }, 1000);
                    } else {
                        console.log(`${step} not saved.`);
                    }
                });
            }
            
            
        }
        
      $scope.$watchGroup(['record.student_notification', 'record.student_notification_staff','record.student_notification_date'], function(newVal, oldVal) { 
          
          if (newVal !== oldVal) {
             $timeout(() => $scope.student_notification_save = UNSAVED, 1000);
          }
      });  
      
      $scope.$watchGroup(['record.parent_call_1', 'record.parent_call_1_staff','record.parent_call_1_date'], function(newVal, oldVal) { 
      
          if (newVal !== oldVal) {
              $timeout(() => $scope.parent_call_1_save = UNSAVED, 1000);
          }
      }); 
      
      $scope.$watchGroup(['record.parent_call_2', 'record.parent_call_2_staff','record.parent_call_2_date'], function(newVal, oldVal) { 
      
          if (newVal !== oldVal) {
              $scope.parent_call_2_save = UNSAVED;
          }
      }); 
      
      
      $scope.$watchGroup(['record.parent_call_3', 'record.parent_call_3_staff','record.parent_call_3_date'], function(newVal, oldVal) { 
      
          if (newVal !== oldVal) {
              $timeout(() => $scope.parent_call_3_save = UNSAVED, 1000);
          }
      }); 
      
        $scope.$watch('record.parent_call_notes', function(newVal, oldVal) { 
      
          if (newVal !== oldVal) {
              $timeout(() => $scope.parent_call_notes_save = UNSAVED, 1000);
          }
      }); 
      
       $scope.$watchGroup(['record.concern_2', 'record.concern_2_req_staff','record.concern_2_req_date','record.concern_2_sent_staff','record.concern_2_sent_date','record.concern_2_notes'], function(newVal, oldVal) { 
      
            if (newVal !== oldVal) {
                $timeout(() => $scope.concern_2_save = UNSAVED, 1000);
            }
        }); 

        $scope.$watchGroup(['record.concern_3', 'record.concern_3_req_staff','record.concern_3_req_date','record.concern_3_sent_staff','record.concern_3_sent_date','record.concern_3_notes'], function(newVal, oldVal) { 
      
            if (newVal !== oldVal) {
                $timeout(() => $scope.concern_3_save = UNSAVED, 1000);
            }
        }); 

        $scope.$watchGroup(['record.concern_4', 'record.concern_4_req_staff','record.concern_4_req_date','record.concern_4_sent_staff','record.concern_4_sent_date','record.concern_4_notes'], function(newVal, oldVal) { 
      
            if (newVal !== oldVal) {
                $timeout(() => $scope.concern_4_save = UNSAVED, 1000);
            }
        }); 
        
        $scope.$watchGroup(['record.referral', 'record.referral_staff','record.referral_date','record.referral_notes'], function(newVal, oldVal) { 
          
          if (newVal !== oldVal) {
             $timeout(() => $scope.referral_save = UNSAVED, 1000);
          }
      }); 
      
      init();
        
    }]);
  
    attTrackApp.factory('attTrackHttpService', function($http) {
        return {
            getRecord: function(datafile) {
                return $http.get(datafile)
                    .then(function(result) {
                        return result.data;
                    });
            },
            updateRecord: function(recordid, fields, callback) {
                let table = $psq('u_pei_att_track');
                table.update(recordid, fields, callback);
            },
            insertRecord: function(studentsdcid, fields, callback) {
                let table = $psq('u_pei_att_track');
                table.insertChild({table: 'students', id: studentsdcid}, fields, callback);
            }
        }
    });
    
  });