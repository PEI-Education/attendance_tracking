/*  PEI Attendance Concerns Tracking Controller
    Version 2026.10.0

    Controller for both admin and teacher portals.
    Questions? Contact lawalker@gov.pe.ca
 */
define(['angular', 'components/shared/index', 'peiAttTrack/messages'], function(angular, shared, localization) {

  // Reads the locale set server-side via the localeLang hidden input (~[locale.lang] is not substituted in this static JS file).
  function getLocaleLang() {
      let el = document.getElementById('localeLang');
      return el ? el.value.trim().toLowerCase() : '';
  }

  // Calculation-only parser. Never rewrites display strings or psQuery save values.
  // UTC day numbers avoid daylight-saving shifts when comparing calendar dates.
  const DAY_MS = 24 * 60 * 60 * 1000;
  function calendarDay(value) {
      if (typeof value !== 'string') return null;
      const parts = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
      if (!parts) return null;
      const french = getLocaleLang() === 'fr';
      const day = Number(parts[french ? 1 : 2]);
      const month = Number(parts[french ? 2 : 1]);
      const year = Number(parts[3]);
      if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return null;
      const date = new Date(0);
      date.setUTCFullYear(year, month - 1, day);
      // Reject rollover dates such as February 30 instead of silently correcting them.
      if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
      return date.getTime() / DAY_MS;
  }

  var attTrackApp = angular.module('attTrackMod', ['powerSchoolModule']);

  attTrackApp.controller('attTrackCtrl', ['$scope', 'dbConnect', '$timeout', '$q', function($scope, dbConnect, $timeout, $q) {
      
      var messages = localization.read();
      var recordDataFile = document.getElementById('recordDataFile').value;
      const persistedStates = {};
      const pendingEmails = {};
      const formNames = { student: 'stu', referral: 'ref' };
      $scope.saveBusy = false;
      $scope.submitBusy = false;
      $scope.emailBusy = {};
      $scope.notificationFailed = {};
      $scope.notificationUnknown = {};
      $scope.writeUncertain = false;
      $scope.recordLoading = false;
      $scope.recordLoadError = false;

      let init = function() {
          const termInput = document.getElementById('termid');
          const termName = document.getElementById('resolvedTermName');
          const gradeInput = document.getElementById('gradeInYear');
          // A teacher lookup with zero/multiple matches renders no inputs.
          $scope.termid = termInput ? termInput.value.trim() : '-1';
          $scope.termUnavailable = !/^\d+$/.test($scope.termid) ||
              !Number.isSafeInteger(Number($scope.termid)) || Number($scope.termid) <= 0;
          $scope.termName = termName ? (termName.textContent || '').trim() : '';
          $scope.record = {};
          $scope.gradeInYear = gradeInput ? gradeInput.value : '';
          $scope.forms = {};
          $scope.concerns = {};
          $scope.referral = {};
          $scope.queue = {};
          if ($scope.validTerm()) $scope.getRecord(recordDataFile);
      };
      
      $scope.getRecord = function(datafile) {
          if (!$scope.validTerm()) return;
          if ($scope.recordLoading) return;
          $scope.recordLoading = true;
          $scope.recordLoadError = false;
          // The endpoint resolves the term server-side; never pass it in the URL.
          return dbConnect.getRecord(datafile).then(function(retData) {
              if (retData && typeof retData === 'object') {
                  // A record for another term (e.g. term switched in another tab) must not be edited here.
                  if (String(retData.termid) !== String($scope.termid) ||
                      !Number.isSafeInteger(Number(retData.id)) || Number(retData.id) <= 0 ||
                      ['student', 'calls', 'concern_2', 'concern_3', 'concern_4', 'referral'].some(function(key) {
                          return !retData[key] || typeof retData[key] !== 'object';
                      })) throw new Error('Invalid checklist response');
                  $scope.record = retData;                  
                  // set the value of flag concern and letter sent indicators based on value of concern_2, concern_3 and concern_4
                  for (var i=2; i < 5; i++) {
                      if ($scope.record[`concern_${i}`][`concern_${i}`] == 1) {
                        $scope.concerns[`concern_${i}_req`] = true;
                        $scope.concerns[`concern_${i}_sent`] = false;
                      } else if ($scope.record[`concern_${i}`][`concern_${i}`] == 2) {
                          $scope.concerns[`concern_${i}_req`] = true;
                          $scope.concerns[`concern_${i}_sent`] = true;
                      } else {
                          $scope.concerns[`concern_${i}_req`] = false;
                          $scope.concerns[`concern_${i}_sent`] = false;                          
                      }
                  }
                  if ($scope.record.referral.referral === 0) {
                    $scope.referral = { referral: false, referral_closed: false };
                  } else if ($scope.record.referral.referral === 1) {
                    $scope.referral = { referral: true, referral_closed: false };
                  } else if ($scope.record.referral.referral === 2) {
                    $scope.referral = { referral: true, referral_closed: true };
                  }
              } else if (Number(retData) === -1) {
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
                  };
                  if ($scope.gradeInYear < 10) {
                      $scope.record.student.student_notification = '-1';
                  }
              } else {
                  throw new Error('Invalid checklist response');
              }
              ['concern_2', 'concern_3', 'concern_4', 'referral'].forEach(function(phase) {
                  persistedStates[phase] = Number($scope.record[phase][phase]);
              });
              for (const prop in $scope.forms) {
                  $scope.forms[prop].$setPristine();
              };

          }).catch(function() {
              $scope.recordLoadError = true;
          }).finally(function() {
              $scope.recordLoading = false;
          });
      };
      $scope.retryLoad = function() { return $scope.getRecord(recordDataFile); };
      
      // Checks if the termid is valid for the student's grade_level in the context of the termid
      $scope.validTerm = function() {
          if ($scope.termUnavailable || String($scope.gradeInYear).trim() === '' ||
              !Number.isFinite(Number($scope.gradeInYear)) || Number($scope.gradeInYear) === -9) return false;
          let remainder = $scope.termid % 100;
          if (remainder !== 0 && $scope.gradeInYear < 10) { 
              return false;
          } 
          if (remainder === 0 && $scope.gradeInYear > 9) {
              return false;
          }
          return true;
      };
      
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
      };
      
      // Calls pass through this function to set the value (1 for attempted, 3 for 'made contact').
      $scope.recordCall = function(e, step, value) {
          $scope.record.calls[step] = value;
          $scope.forms.calls.$setDirty();
          $scope.toggle(e, 'calls', step);
      };
      
      // Determines whether or not written notification can begin, based on whether all three calls have been attempted, or one call succeeded.
      $scope.countCalls = function() {
          if (!$scope.record.calls) {
              return true;
          }
          return ($scope.record.calls.parent_call_1 + $scope.record.calls.parent_call_2 + $scope.record.calls.parent_call_3) < 3;
      };
      
      // Compare calendar days without asking the browser to guess the locale.
      $scope.daysPassed = function(earlyDate, laterDate) {
          const earlyDay = calendarDay(earlyDate);
          const laterDay = calendarDay(laterDate);
          return earlyDay === null || laterDay === null ? NaN : laterDay - earlyDay;
      };

      // Preserve the existing seven-calendar-day rule and local timestamp return type
      // used by the HTML's Angular date filter. Invalid inputs produce no minimum date.
      $scope.addFiveDays = function(date) {
          const day = calendarDay(date);
          if (day === null) return null;
          const target = new Date((day + 7) * DAY_MS);
          const localDate = new Date(0);
          localDate.setFullYear(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
          localDate.setHours(0, 0, 0, 0);
          return localDate.getTime();
      };

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
          const elapsedDays = $scope.daysPassed($scope.record[prevConcern][`${prevConcern}_sent_date`], document.getElementById('dateToday').value);
          if (!Number.isFinite(elapsedDays) || elapsedDays < DAYS) {
              return true;
          }
          return false;
      };
      
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
                  $scope.record[phase][phase] = 0;
              } else {
                  $scope.record[phase][phase] = 1;
              }
              $scope.record[phase][`${step}_staff`] = null;
              $scope.record[phase][`${step}_date`] = null;
          }
          let form = $scope.forms[phase];
          form.$setDirty();
      }
      
      // Logic for handling a referral or closure of a referral
      $scope.handleReferral = function(e, step) {
        if ($scope.referral[step]) {
          if (step === 'referral') {
            $scope.record.referral.referral = 1;
          } else {
              $scope.record.referral.referral = 2;
          }
          if (!$scope.record.referral[`${step}_staff`]) {
            $scope.record.referral[`${step}_staff`] = document.getElementById('staffName').value;
          }
          if (!$scope.record.referral[`${step}_date`]) {
              $scope.record.referral[`${step}_date`] = document.getElementById('dateToday').value;
          }
        } else {
          if (step === 'referral') {
            $scope.record.referral.referral = 0;
          } else {
              $scope.record.referral.referral = 1;
          }
          $scope.record.referral[`${step}_staff`] = null;
          $scope.record.referral[`${step}_date`] = null;
        }        
        let form = $scope.forms.ref
        form.$setDirty();
      }
      
      function emailPayload() {
          return {
              type: 100,
              tdata1: document.getElementById('emailFrom').value,
              tdata2: document.getElementById('emailTo').value,
              tdata3: document.getElementById('emailSubject').value,
              tdata4: document.getElementById('emailBody').value,
              date: document.getElementById('emailDate').value,
              time: document.getElementById('emailTime').value
          };
      }

      // psQuery 0.8 documents a positive record ID on success; 0 or an error on failure.
      function writeRecord(operation) {
          return $q(function(resolve, reject) {
              operation(function(retID) {
                  const id = Number(retID);
                  if (Number.isSafeInteger(id) && id > 0) resolve(id);
                  else reject(retID);
              });
          });
      }

      function sendPendingEmail(phase) {
          const payload = pendingEmails[phase];
          if (!payload || $scope.emailBusy[phase]) return $q.when(false);
          $scope.emailBusy[phase] = true;
          return writeRecord(function(done) {
              dbConnect.triggerEmail({ ...payload }, done);
          }).then(function() {
              delete pendingEmails[phase];
              $scope.notificationFailed[phase] = false;
              $scope[`${phase}_emailed`] = 1;
              return true;
          }, function(error) {
              if (Number(error) === -1) {
                  delete pendingEmails[phase];
                  $scope.notificationFailed[phase] = false;
                  $scope.notificationUnknown[phase] = true;
                  return false;
              }
              // The checklist is already saved. Retain only the failed email for retry.
              $scope.notificationFailed[phase] = true;
              return false;
          }).finally(function() {
              $scope.emailBusy[phase] = false;
          });
      }

      $scope.retryEmail = function(phase) {
          if (!$scope.validTerm() || $scope.recordLoading || $scope.recordLoadError || $scope.writeUncertain || $scope.saveBusy || $scope.submitBusy ||
              persistedStates[phase] !== 1 || Number($scope.record[phase][phase]) !== 1) return $q.when(false);
          return sendPendingEmail(phase);
      };

      // Saves data to the u_pei_att_track table
      const SAVED = 'saved';
      const SAVING = 'saving';
      const UNSAVED = 'unsaved';

      $scope.save = function(e, phase) {
          if (e && e.preventDefault) e.preventDefault();
          const form = $scope.forms[formNames[phase] || phase];
          if (!$scope.validTerm() || $scope.recordLoading || $scope.recordLoadError || $scope.writeUncertain || $scope.saveBusy || Object.values($scope.emailBusy).some(Boolean) ||
              (form && (form.$invalid || form.$pristine))) return $q.when(null);
          // Snapshot flat database fields; never replace the on-screen record after a save.
          const snapshot = { ...$scope.record[phase] };
          const previousState = persistedStates[phase] || 0;
          let list = { ...snapshot };
           if (getLocaleLang() === "fr") {
                for (const key of Object.keys(list)) {
                    if (key.endsWith('_date')) {
                        const frDate = list[key];
                        if (frDate) {
                            const [day, month, year] = frDate.split('/');
                            list[key] = `${month}/${day}/${year}`
                        }
                    }
                }
            }
          $scope.saveBusy = true;
          $scope[`${phase}_save`] = SAVING;
          const inserting = !$scope.record.id;
          if (inserting) list.termid = $scope.record.termid;
          return writeRecord(function(done) {
              const complete = function(id) {
                  // Retain a successful insert ID before releasing the shared write lock.
                  if (inserting && Number.isSafeInteger(Number(id)) && Number(id) > 0) {
                      $scope.record.id = String(id);
                  }
                  // A different ID on update is not confirmation of this record's write.
                  done(!inserting && Number(id) > 0 && Number(id) !== Number($scope.record.id) ? -1 : id);
              };
              if (inserting) dbConnect.insertRecord($scope.record.studentsdcid, list, complete);
              else dbConnect.updateRecord($scope.record.id, list, complete);
          }).then(function() {
              persistedStates[phase] = Number(snapshot[phase]);
              const current = $scope.record[phase];
              const unchanged = Object.keys({ ...snapshot, ...current }).every(function(key) {
                  return snapshot[key] === current[key];
              });
              $scope[`${phase}_save`] = unchanged ? SAVED : UNSAVED;
              if (form) {
                  if (unchanged) form.$setPristine();
                  else form.$setDirty();
              }
              if (Number(snapshot[phase]) !== 1) {
                  delete pendingEmails[phase];
                  $scope.notificationFailed[phase] = false;
                  $scope[`${phase}_emailed`] = 0;
              }
              return { notify: previousState === 0 && Number(snapshot[phase]) === 1 };
          }, function(error) {
              $scope[`${phase}_save`] = UNSAVED;
              if (Number(error) === -1) $scope.writeUncertain = true;
              throw error;
          }).finally(function() {
              $scope.saveBusy = false;
              closeLoading();
          });
      };

      $scope.saveAndEmail = function(e, phase) {
          const payload = emailPayload();
          return $scope.save(e, phase).then(function(result) {
              if (!result || !result.notify) return result;
              // No recipients are configured for this school; the page already says so.
              if (!String(payload.tdata2 || '').trim()) return result;
              $scope.notificationUnknown[phase] = false;
              pendingEmails[phase] = payload;
              $scope[`${phase}_emailed`] = 0;
              return sendPendingEmail(phase);
          });
      };

      // One entry point for UI submissions; rejected saves never reach email insertion.
      $scope.submitSection = function(e, phase, notify) {
          if (e && e.preventDefault) e.preventDefault();
          if (!$scope.validTerm() || $scope.recordLoading || $scope.recordLoadError || $scope.writeUncertain || $scope.submitBusy || $scope.saveBusy || Object.values($scope.emailBusy).some(Boolean)) return $q.when(false);
          $scope.submitBusy = true;
          return $q(function(resolve) {
              resolve(notify ? $scope.saveAndEmail(e, phase) : $scope.save(e, phase));
          }).catch(function(error) {
                  alert($scope.writeUncertain ? messages.save_unconfirmed : localization.format(messages.section_not_saved, '{code}', error && error.message || error));
                  return false;
              }).finally(function() {
                  $scope.submitBusy = false;
              });
      };

      $scope.sectionKeydown = function(e, phase, notify) {
          // ng-form table sections have no native submit event. Preserve textarea newlines.
          if (e.key === 'Enter' && !e.isComposing && e.target.tagName === 'INPUT') {
              const button = e.currentTarget && e.currentTarget.querySelector('button[id="' + phase + '_save"]');
              if (button && button.disabled) {
                  e.preventDefault();
                  return;
              }
              return $scope.submitSection(e, phase, notify);
          }
      };
      
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
              table.insertChild({table: 'students', id: studentsdcid},fields, callback);
          },
          triggerEmail: function(fields, callback) {
              let table = $psq('queue');
              table.insert(fields, callback);
          }
      };
  }]);
  
});