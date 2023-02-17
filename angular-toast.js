/*!
 * @module angularjs-toast
 * @description A Simple toast notification service for AngularJS pages
 * @version v4.0.1
 * @link https://github.com/sibiraj-s/angularjs-toast#readme
 * @licence MIT License, https://opensource.org/licenses/MIT
 */

"use strict";

(function () {
  'use strict';

  var $run, $toastContainerDirective, $toastMessageDirective, $toastProvider, getUniqId;

  getUniqId = function getUniqId() {
    var s4;

    s4 = function s4() {
      return ((1 + Math.random()) * 0x10000 | 0).toString(16).substring(1);
    };

    return "".concat(new Date().getTime(), "-").concat(s4(), "-").concat(s4(), "-").concat(s4());
  };

  $run = function $run($templateCache) {
    var containerHTML, messageHTML;
    containerHTML = '<div class="angularjs-toast">' + '  <ul class="toast-container" ng-class="::[position, containerClass]">' + '    <toast-message ng-repeat="data in toastMessages track by data.id" data="data"></toast-message>' + '  </ul>' + '</div>';
    messageHTML = '<li class="animate-repeat">' + '  <div class="alert alert-dismissible" ng-class="::data.toastClass">' + '    <span ng-bind-html="::data.message"></span>' + '    <span' + '      class="close"' + '      aria-label="close"' + '      title="close"' + '      ng-click="close($index)"' + '      ng-if="::data.dismissible"' + '      >×</span>' + '  </div>' + '</li>';
    $templateCache.put('angularjs-toast/container.html', containerHTML);
    $templateCache.put('angularjs-toast/message.html', messageHTML);
  };

  $toastProvider = function $toastProvider() {
    var create, defaultOptions, destroy, options, toastMessages;
    defaultOptions = {
      containerClass: '',
      defaultToastClass: 'alert-success',
      timeout: 5 * 1000,
      dismissible: true,
      maxToast: 7,
      position: 'right',
      insertFromTop: true
    };
    options = defaultOptions;
    toastMessages = [];

    destroy = function destroy(index) {
      toastMessages.splice(index, 1);
    };

    create = function create(args) {
      var dismissible, json, message, timeout, toastClass; // user options

      message = typeof args === 'string' ? args : args.message;
      timeout = args.timeout || options.timeout;
      dismissible = args.dismissible !== void 0 ? args.dismissible : options.dismissible;
      toastClass = args.className || options.defaultToastClass;

      if (!message) {
        throw new Error("Toast message is required...");
      } // append inputs to json variable
      // this will be pushed to the ->scope.$toastMessages array


      json = {
        message: message,
        id: getUniqId(),
        toastClass: toastClass,
        dismissible: dismissible,
        timeout: timeout
      }; // remove last/ first element from ->scope.$toastMessages when the maxlength is reached

      if (toastMessages.length === options.maxToast) {
        if (!options.insertFromTop) {
          toastMessages.shift();
        } else {
          toastMessages.pop();
        }
      } // push elements to array


      if (options.insertFromTop) {
        toastMessages.unshift(json);
      } else {
        toastMessages.push(json);
      }
    };

    return {
      // setNotificationTimer(json, timeout)
      configure: function configure(c) {
        options = angular.extend({}, defaultOptions, c);
      },
      $get: function $get() {
        return {
          options: options,
          toastMessages: toastMessages,
          create: create,
          destroy: destroy
        };
      }
    };
  };

  $toastContainerDirective = function $toastContainerDirective(toast) {
    return {
      replace: true,
      restrict: 'EA',
      templateUrl: 'angularjs-toast/container.html',
      scope: {},
      compile: function compile() {
        var options;
        options = toast.options;
        return function (scope) {
          scope.toastMessages = toast.toastMessages;
          scope.position = options.position;
          scope.containerClass = options.containerClass;
        };
      }
    };
  };

  $toastMessageDirective = function $toastMessageDirective($timeout, toast) {
    return {
      replace: true,
      restrict: 'E',
      templateUrl: 'angularjs-toast/message.html',
      scope: {
        data: '='
      },
      link: function link(scope) {
        var data, destroy, options, timeout, timeoutPromise, toastMessages;
        data = scope.data;
        options = toast.options;
        timeout = data.timeout || options.timeout;
        toastMessages = toast.toastMessages;

        destroy = function destroy() {
          var index;
          index = toastMessages.indexOf(data);
          toast.destroy(index);
        };

        scope.close = destroy;
        timeoutPromise = $timeout(function () {
          destroy();
        }, timeout);
        scope.$on('$destroy', function () {
          $timeout.cancel(timeoutPromise);
        });
      }
    };
  };

  $run.$inject = ['$templateCache'];
  $toastProvider.$inject = [];
  $toastContainerDirective.$inject = ['toast'];
  $toastMessageDirective.$inject = ['$timeout', 'toast'];
  angular.module('angularjsToast', ['ngSanitize', 'ngAnimate']).run($run).provider('toast', $toastProvider).directive('toast', $toastContainerDirective).directive('toastMessage', $toastMessageDirective);
}).call(void 0);
//# sourceMappingURL=angularjs-toast.js.map