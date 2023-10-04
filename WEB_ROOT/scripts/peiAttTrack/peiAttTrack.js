define(['angular', 'components/shared/index'], function(angular) {
    
    var attTrackApp = angular.module('attTrackMod', ['powerSchoolModule']);
 
    attTrackApp.controller('attTrackCtrl', ['$scope', 'dbConnect', '$timeout', function($scope, dbConnect, $timeout) {
        
        let init = function() {
            $scope.termid = document.getElementById('termid').value;
            $scope.record = {};
            $scope.gradeInYear = document.getElementById('gradeInYear').value;
            $scope.validTerm();
            $scope.forms = {};
            $scope.getRecord('pei_attTrack.json');
            $scope.concerns = {}
        }
        
        $scope.getRecord = function(datafile) {
            dbConnect.getRecord(datafile).then(function(retData) {
                if (typeof retData === "object") {
                    $scope.record = retData;
                    // set the value of flag concern and letter sent indicators based on value of concern_2, concern_3 and concern_4
                    for (var i=2; i < 5; i++) {
                        if ($scope.record[`concern_${i}`][`concern_${i}`] == 1) {
                            $scope.concerns[`concern_${i}_req`] = true
                            $scope.concerns[`concern_${i}_sent`] = false
                        } else if ($scope.record[`concern_${i}`][`concern_${i}`] == 2) {
                            $scope.concerns[`concern_${i}_req`] = true
                            $scope.concerns[`concern_${i}_sent`] = true
                        } else {
                            $scope.concerns[`concern_${i}_req`] = false
                            $scope.concerns[`concern_${i}_sent`] = false                            
                        }
                    }
                    $scope.referral = $scope.record.referral.referral===1 ? true : false;
 
                } else {
                    $scope.record = {
                        studentsdcid: document.getElementById('studentsdcid').value,
                        termid: $scope.termid,
                        student: {
                            student_notification: 0
                        },
                        calls: {
                            parent_call_1: 0,
                            parent_call_2: 0,
                            parent_call_3: 0
                        },
                        concern_2: {
                            concern_2: 0
                        },
                        concern_3: {
                            concern_3: 0
                        },
                        concern_4: {
                            concern_4: 0
                        },
                        referral: {
                            referral: 0
                        }
                    }
                }
                for (const prop in $scope.forms) {
                    $scope.forms[prop].$setPristine();
                }
            });
 
        }
        
        /* 
        NO LONGER NECESSARY - built tlist sql in to html page.
        Adds the student's grade_level in the context of the termid, and sets the student_notification property to 'na' if that level is less than Grade 10
        $scope.getGrade = function(datafile) {
            dbConnect.getRecord(datafile).then(function(retData) {
                if (typeof(retData) === 'number') {
                    $scope.gradeInYear = retData;
                    if ($scope.gradeInYear < 10) {
                        $scope.record.student.student_notification = '-1';
                    }
                } else {
                    alert('bad response to getGrade');
                }
            });
        } */
        
        // Checks if the termid is valid for the student's grade_level in the context of the termid
        $scope.validTerm = function() {
            let remainder = parseInt(document.getElementById('termid').value) % 100
            if (remainder !== 0 && $scope.gradeInYear < 10) { 
                return false;
            } 
            if (remainder === 0 && $scope.gradeInYear > 9) {
                return false;
            }
            return true;
        }
        
        // Function to toggle student notification, calls (after recordCalls), and referrals on/off
        $scope.toggle = function(e, phase, step) {
            if (parseInt($scope.record[phase][step])===0) {
                $scope.record[phase][`${step}_staff`] = null;
                $scope.record[phase][`${step}_date`] = null;
            } else {
                if (!$scope.record[phase][`${step}_staff`]) {
                    $scope.record[phase][`${step}_staff`] = document.getElementById('staffName').value;
                }
                if (!$scope.record[phase][`${step}_date`]) {
                    $scope.record[phase][`${step}_date`] = document.getElementById(`dateToday`).value;
                }
            }
        }
        
        // Calls pass through this function to set the value (1 for attempted, 3 for 'made contact').
        $scope.recordCall = function(e, step, value) {
            $scope.record.calls[step] = value;
            $scope.forms.calls.$setDirty();
            $scope.toggle(e, 'calls', step);
        }
        
        // Determines whether or not written notification can begin, based on whether all three calls have been attempted, or one call succeeded
        $scope.countCalls = function() {
            if (!$scope.record.calls) {
                return true;
            }
            return ($scope.record.calls.parent_call_1 + $scope.record.calls.parent_call_2 + $scope.record.calls.parent_call_3) <3
        }
        
        // Returns the number of days between two dates, for use in calculating whether or not student is eligibe for next stepss
        $scope.daysPassed = function(earlyDate, laterDate) {
            let date1 = new Date(earlyDate);
            let date2 = new Date(laterDate);
            return Math.ceil((date2 - date1)/(1000 * 3600 * 24));
        }
        
        // Returns date + 5 days 
        $scope.addFiveDays = function(date) {
            let originalDate = new Date(date);
            let numberOfDays = 7 // 5 business days + a weekend
            return originalDate.setDate(originalDate.getDate() + numberOfDays);
        }
        
        // Logic for disabling the buttons relating to written notifications
        // Previous letter must have been sent and at least 5 weekdays (1 week) must have passed
        $scope.disableConcern = function(prevConcern) {
            const DAYS = 7;
            const PREVACTIONS = 2;
            if (!$scope.record[prevConcern]) {
                return true;   
            }
            if ($scope.record[prevConcern][prevConcern] < PREVACTIONS) {
                return true;
            }
            if ($scope.daysPassed($scope.record[prevConcern][`${prevConcern}_sent_date`], document.getElementById('dateToday').value) < DAYS) {
                return true;
            }
            return false;
        }
        
        // Similar to toggle, but handles the additional logic of flagging concerns and then sending a letter in a single variable.
        $scope.handleConcern = function(e, phase, step) {
            if($scope.concerns[step]) {
                if (step.slice(step.length-4)==='_req') {
                    $scope.record[phase][phase] = 1;
                } else {
                    $scope.record[phase][phase] = 2;
                }
                if (!$scope.record[phase][`${step}_staff`]) {
                    $scope.record[phase][`${step}_staff`] = document.getElementById('staffName').value;
                }
                if (!$scope.record[phase][`${step}_date`]) {
                    $scope.record[phase][`${step}_date`] = document.getElementById(`dateToday`).value;
                }
            } else {
                if (step.slice(step.length-4)==='_req') {
                    $scope.record[phase][phase] = 0
                } else {
                    $scope.record[phase][phase] = 1
                }
                $scope.record[phase][`${step}_staff`] = null;
                $scope.record[phase][`${step}_date`] = null;
            }
            $scope.forms.concern_2.$setDirty();
        }
    
        // Logic for disabling the referral section
        $scope.disableReferral = function() {
            let concerns = ['concern_2', 'concern_3', 'concern_4']
            for (const concern of concerns) {
                if (!$scope.record[concern]) {
                    return true;
                }
                if ($scope.record[concern][concern] != 2) {
                    return true;
                }
                if (!$scope.record[concern][`${concern}_notes`] || $scope.record[concern][`${concern}_notes`].length < 20) {
                    return true;
                }
            }
            return false;
        }
        
        // Saves data to the u_pei_att_track table
        const SAVED = 'saved';
        const SAVING = 'saving';
        const UNSAVED = 'unsaved';
 
        $scope.save = function(e, phase) {
            $scope[`${phase}_save`] = SAVING
            let list = $scope.record[phase]
            if (!$scope.record.id) {
                list.termid = $scope.record.termid;
                dbConnect.insertRecord($scope.record.studentsdcid, list, function(retID) {
                    console.log(retID)
                    if (retID === '-1' || retID > 0) {
                       $timeout(function() {
                           $scope[`${phase}_save`] = SAVED;
                           $scope.getRecord('pei_attTrack.json');
                        }, 1000);   
                    } else {
                        console.error(`${phase} not saved.`);
                        $scope[`${phase}_save`] = UNSAVED;
                    }
                });
            } else {
                dbConnect.updateRecord($scope.record.id, list, function(retID) {
                    if (retID === '-1' || retID === $scope.record.id) {
                        $timeout(function() {
                           $scope[`${phase}_save`] = SAVED
                           $scope.getRecord('pei_attTrack.json');
                        }, 1000);
                    } else {
                        console.error(`${phase} not saved.`);
                    }
                });
            }
        }
        
        init();
        
    }]);
    
    // Service to interact with PowerSchool database via PSQuery
    attTrackApp.factory('dbConnect', ['$http', function($http) {
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
        };
    }]);
    
 });