'use strict';
define(function(require) {
    var module = require('components/attTrack/module');
    var localization = require('peiAttTrack/messages');
    module.controller('attUpdateCtrl', ['$scope', 'dataService', 'state', '$q', '$timeout', function($scope, dataService, state, $q, $timeout) {
         $scope.gridData = [];
         $scope.spinner = state.spinner;
         $scope.task = state.task;
         var messages = localization.read();
         $scope.steps = [
            { id: 2, label: messages.student_notification },
            { id: 3, label: messages.parent_call_1 },
            { id: 4, label: messages.parent_call_2 },
            { id: 5, label: messages.parent_call_3 },
            { id: 7, label: messages.letter_1_requested },
            { id: 8, label: messages.letter_1_sent },
            { id: 10, label: messages.letter_2_requested },
            { id: 11, label: messages.letter_2_sent },
            { id: 13, label: messages.letter_3_requested },
            { id: 14, label: messages.letter_3_sent },
            { id: 15, label: messages.referred_to_the_director }
        ];
        $scope.sn = {
            student_notification: 0,
            student_notification_staff: '',
            student_notification_date: ''
        };
        $scope.pc1  = {
            parent_call_1: 0, 
            parent_call_1_staff: '', 
            parent_call_1_date: ''
        };
        $scope.pc2  = {
            parent_call_2: 0, 
            parent_call_2_staff: '', 
            parent_call_2_date: ''
        };
        $scope.pc3  = {
            parent_call_3: 0, 
            parent_call_3_staff: '', 
            parent_call_3_date: '' 
        };
        $scope.c2req = {
            concern_2: 0, 
            concern_2_req_staff: '', 
            concern_2_req_date: ''
        };
        $scope.c2sent = {
            concern_2: 1,
            concern_2_sent_staff: '', 
            concern_2_sent_date: ''
        };
        $scope.c3req = {
            concern_3: 0, 
            concern_3_req_staff: '', 
            concern_3_req_date: ''
        };
        $scope.c3sent = {
            concern_3: 1,
            concern_3_sent_staff: '', 
            concern_3_sent_date: ''
        };
        $scope.c4req = {
            concern_4: 0, 
            concern_4_req_staff: '', 
            concern_4_req_date: ''
        };
        $scope.c4sent = {
            concern_4: 1,
            concern_4_sent_staff: '', 
            concern_4_sent_date: ''
        };
        $scope.referral = {
            referral: 0,
            referral_staff: '',
            referral_date: ''
        };
    
        let getStudents = function() {
            state.task.allDone = false;
            state.spinner.wait = true;
            $scope.loadError = '';
            return dataService.getData('json/attendance_tracking_selection.json')
                .then(function(retData) {
                    if (!Array.isArray(retData)) throw new Error('Invalid student response');
                    const rows = retData.slice();
                    if (rows.length && Object.keys(rows[rows.length - 1]).length === 0) rows.pop();
                    rows.forEach(function(data) {
                        if (data.stepDate) data.stepDate = new Date(data.stepDate);
                    });
                    $scope.gridData = rows;
                }).catch(function() {
                    $scope.gridData = [];
                    $scope.loadError = messages.load_error;
                }).finally(function() {
                    state.spinner.wait = !!$scope.saveBusy;
                });
        };
        $scope.reloadStudents = function() {
            if (state.spinner.wait || $scope.batchStarted) return;
            return getStudents();
        };

        let init = function() {
          state.spinner.wait = true;
          getStudents();
          $scope.currentUser = document.getElementById('staffName').value;
          $scope.currentDate = document.getElementById('dateToday').value;
          $scope.showValidation = false;
          //stepChoice will be step the user selects; stepSelection will be the variable used to display content, after it is verified that the selection is valid fo the users.
          $scope.stepChoice = undefined;
          $scope.stepSelection = undefined;
          state.task.allDone = false;
        };
        
        init();
        
        $scope.verifySelection = function() {
            if ($scope.batchStarted || $scope.loadError || !$scope.stepChoice) return;
            state.spinner.wait = true;
            state.task.allDone = false;
            let students = $scope.gridData;
            let validStudents = [];
            let invalidStudents= [];
            let validSteps;
            
            
            let step = $scope.stepChoice.id;
            if (step === 7 || step === 10 || step === 13) {
                validSteps = [step, step-1, step-2]
            } else if (step === 3) {
                // Call 1 does not require student notification (K-9 students are exempt).
                validSteps = [3, 2, 1];
            } else {
                validSteps = [step, step-1]
            }
            
            students.forEach(student => {
                if (step === 2 && student.termGrade < 10) {
                    invalidStudents.push(student);
                } else if (step === 7 && student.currentStepIdx < 7 && student.callPoints >= 3) {
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
        
        $scope.setStaffDate = function(group, step, stateField, activeValue) {
            // Letter request/sent metadata shares a single numeric concern state.
            let value = parseInt($scope[group][stateField || step], 10);
            let active = activeValue === undefined ? value > 0 : value === activeValue;
            if (!active) {
                $scope[group][`${step}_staff`] = null;
                $scope[group][`${step}_date`] = null;
            } else {
                if (!$scope[group][`${step}_staff`]) {
                    $scope[group][`${step}_staff`] = $scope.currentUser;
                }        
                if (!$scope[group][`${step}_date`]) {
                    $scope[group][`${step}_date`] = $scope.currentDate;
                }
            }
        };
        
        $scope.setValues = function(group,step,value) {
            $scope[group][step] = value;
            $scope.setStaffDate(group,step);
        }

        // Bulk saves only set a step; clearing a step is done on the student's own checklist.
        const BULK_STEPS = {
            sn: { field: 'student_notification', step: 'student_notification', active: 1 },
            pc1: { field: 'parent_call_1', step: 'parent_call_1' },
            pc2: { field: 'parent_call_2', step: 'parent_call_2' },
            pc3: { field: 'parent_call_3', step: 'parent_call_3' },
            c2req: { field: 'concern_2', step: 'concern_2_req', active: 1 },
            c2sent: { field: 'concern_2', step: 'concern_2_sent', active: 2 },
            c3req: { field: 'concern_3', step: 'concern_3_req', active: 1 },
            c3sent: { field: 'concern_3', step: 'concern_3_sent', active: 2 },
            c4req: { field: 'concern_4', step: 'concern_4_req', active: 1 },
            c4sent: { field: 'concern_4', step: 'concern_4_sent', active: 2 },
            referral: { field: 'referral', step: 'referral', active: 1 }
        };
        $scope.canSave = function(group) {
            const definition = BULK_STEPS[group], fields = $scope[group];
            if (!definition || !fields || $scope.saveBusy || $scope.batchStarted) return false;
            const value = Number(fields[definition.field]);
            const active = definition.active === undefined ? value > 0 : value === definition.active;
            return active && !!String(fields[`${definition.step}_staff`] || '').trim() &&
                !!String(fields[`${definition.step}_date`] || '').trim();
        };
        
        // Newly referred students are summarized in one email per board after each referral batch.
        var pendingEmails = [];
        $scope.referralEmail = {};
        function board(row) {
            var school = Number(row.student.currentSchool);
            return school < 500 ? 'PSB' : school < 601 ? 'CSLF' : null;
        }
        function value(id) {
            var element = document.getElementById(id);
            return element ? String(element.value || '').trim() : '';
        }
        function referralPayloads(rows) {
            var groups = {};
            rows.forEach(function(row) {
                // Only students moving from Letter 3 sent to referred; re-saving a referral does not notify again.
                if (row.outcome !== 'saved' || row.referralNotified || row.student.currentStepIdx !== 14) return;
                var name = board(row), recipient = name && value('emailTo' + name);
                if (!recipient) return;
                row.referralNotified = true;
                (groups[name] = groups[name] || { to: recipient, rows: [] }).rows.push(row);
            });
            return Object.keys(groups).map(function(name) {
                var group = groups[name];
                var lines = group.rows.map(function(row) {
                    var line = localization.format(messages.bulk_referral_student, '{name}', row.student.lastName + ', ' + row.student.firstName);
                    line = localization.format(line, '{label}', messages.student_number);
                    line = localization.format(line, '{number}', row.student.studentNumber);
                    return localization.format(line, '{school}', row.student.termSchoolName);
                });
                return {
                    type: 100,
                    tdata1: value('emailFrom'),
                    tdata2: group.to,
                    tdata3: localization.format(messages.bulk_referral_subject, '{count}', group.rows.length),
                    tdata4: [messages.bulk_referral_intro, ''].concat(lines, ['', messages.email_generated + ' ' + messages.email_contact]).join('\n'),
                    date: value('emailDate'),
                    time: value('emailTime')
                };
            });
        }
        function sendReferralEmails() {
            $scope.referralEmail.busy = true;
            $scope.referralEmail.failed = false;
            return $q.all(pendingEmails.slice().map(function(payload) {
                // Wrap synchronous errors too; an exception does not prove no email was queued.
                return $q(function(resolve) { resolve(dataService.queueEmail(payload)); }).then(function() {
                    pendingEmails.splice(pendingEmails.indexOf(payload), 1);
                    $scope.referralEmail.sent = true;
                }, function(error) {
                    if (error && error.outcome === 'failed') {
                        $scope.referralEmail.failed = true;
                    } else {
                        pendingEmails.splice(pendingEmails.indexOf(payload), 1);
                        $scope.referralEmail.unconfirmed = true;
                    }
                });
            })).finally(function() {
                $scope.referralEmail.busy = false;
            });
        }
        $scope.retryReferralEmails = function() {
            if ($scope.saveBusy || $scope.referralEmail.busy || !pendingEmails.length) return;
            return sendReferralEmails();
        };

        var batchFields;
        $scope.batchStarted = false;
        $scope.saveBusy = false;
        $scope.results = [];
        function copyFields(fields) {
            var copy = {};
            Object.keys(fields).forEach(function(key) { copy[key] = fields[key]; });
            return copy;
        }
        function runBatch(rows) {
            $scope.saveBusy = true;
            state.spinner.wait = true;
            state.task.allDone = false;
            var promises = rows.map(function(row) {
                row.outcome = 'pending';
                // Wrap synchronous errors too; an exception does not prove no write occurred.
                return $q(function(resolve) {
                    resolve(dataService.updateRecord(row.student.recid, copyFields(batchFields)));
                }).then(function() {
                    row.outcome = 'saved';
                }, function(error) {
                    row.outcome = error && error.outcome === 'failed' ? 'failed' : 'unconfirmed';
                });
            });
            return $q.all(promises).then(function() {
                $scope.savedStudents = $scope.results.filter(function(row) { return row.outcome === 'saved'; });
                $scope.failedStudents = $scope.results.filter(function(row) { return row.outcome === 'failed'; });
                $scope.unconfirmedStudents = $scope.results.filter(function(row) { return row.outcome === 'unconfirmed'; });
                state.task.success = localization.format(messages.bulk_summary, '{saved}', $scope.savedStudents.length);
                state.task.success = localization.format(state.task.success, '{failed}', $scope.failedStudents.length);
                state.task.success = localization.format(state.task.success, '{unconfirmed}', $scope.unconfirmedStudents.length);
                state.task.allDone = true;
                if (batchFields.referral !== 1) return;
                pendingEmails = pendingEmails.concat(referralPayloads(rows));
                if (pendingEmails.length) return sendReferralEmails();
            }).finally(function() {
                $scope.saveBusy = false;
                state.spinner.wait = false;
            });
        }
        $scope.save = function(step) {
            if (!$scope.canSave(step) || !$scope.validStudents || !$scope.validStudents.length) return;
            batchFields = copyFields($scope[step]);
            // Only the outgoing copy uses psQuery's required MM/DD/YYYY format.
            var locale = document.getElementById('localeLang');
            if (locale && String(locale.value).trim().toLowerCase() === 'fr') {
                Object.keys(batchFields).forEach(function(key) {
                    if (/_date$/.test(key) && batchFields[key]) {
                        var parts = batchFields[key].split('/');
                        batchFields[key] = parts[1] + '/' + parts[0] + '/' + parts[2];
                    }
                });
            }
            $scope.batchStarted = true;
            $scope.results = $scope.validStudents.map(function(student) {
                return { student: copyFields(student), outcome: 'pending' };
            });
            return runBatch($scope.results);
        };
        $scope.retryFailed = function() {
            if ($scope.saveBusy || !$scope.failedStudents || !$scope.failedStudents.length) return;
            return runBatch($scope.failedStudents.slice());
        };

    }]);
});
