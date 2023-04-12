'use strict';
define(function(require) {
// This line will ensure angular is loaded,
// if it has not been loaded yet RequireJS will load it.
// Once loaded we will instantiate the var and use it setup our module
     angular = require('angular');
// If we have dependencies on other AngularJS modules define like this.
//   require('lib/angular/angular-route');
    require('components/shared/powerschoolModule');
    require('components/shared/index');
// powerSchoolModule is the main AngularJS module of PowerSchool which is what we use to bootstrap the document.
    return angular.module('attApp', ['powerSchoolModule']);
});