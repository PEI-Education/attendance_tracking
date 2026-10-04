'use strict';
define(function(require) {
    var module = require('components/attTrack/module');
    module.factory('dataService', ['$http', '$httpParamSerializer', '$q', function($http, $httpParamSerializer, $q) {
      return {
         getData: function (datafile) {
            return $http.get(datafile).then(function (result) {
               return result.data;
            });
         },
         postData: function (url, payload) {
            // Keep HTTP failures rejected so callers can handle them consistently.
            return $http.post(url, $httpParamSerializer(payload), {headers: {'Content-Type':'application/x-www-form-urlencoded'}});
         },
        updateRecord: function(recordID, fields) {
              return $q(function(resolve, reject) {
                $psq('u_pei_att_track').update(recordID, fields, function(retID) {
                  var id = Number(retID);
                  if (/^[1-9]\d*$/.test(String(retID)) && id <= 9007199254740991 && id === Number(recordID)) {
                    resolve(retID);
                  } else {
                    reject({ outcome: retID === 0 || retID === '0' ? 'failed' : 'unconfirmed' });
                  }
                });
              });
            },
        queueEmail: function(fields) {
              return $q(function(resolve, reject) {
                $psq('queue').insert(fields, function(retID) {
                  if (/^[1-9]\d*$/.test(String(retID)) && Number(retID) <= 9007199254740991) {
                    resolve(retID);
                  } else {
                    reject({ outcome: retID === 0 || retID === '0' ? 'failed' : 'unconfirmed' });
                  }
                });
              });
            }
        }
    
    }]);
});