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
            return $http.post(url, $httpParamSerializer(payload), {headers: {'Content-Type':'application/x-www-form-urlencoded'}})
            .success(function (data, status, headers, config) {
                return {"status": status, "data": data};
            })
            .error(function (data, status, header, config) {
                let responseDetails = "Data: " + data +
                    "<hr />status: " + status +
                    "<hr />headers: " + header +
                    "<hr />config: " + config;
                return {"status": "error", "data": responseDetails};
            });
         },
        updateRecord: function(recordID, fields) {
              return $q(function(resolve, reject) {
                console.log(recordID, fields)
                $psq('u_pei_att_track').update(recordID, fields, function(retID) {
                  if (retID !== 0) {
                    resolve(retID);
                  } else {
                    reject('error on' + retID);
                  }
                });
              });
            }
        }
    
    }]);
});                                                                                                                                         