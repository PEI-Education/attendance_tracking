'use strict';
define(function(require) {
// Example of sub folder definition for controllers.
// Always require the index of the sub folder because
// they should require all the files at that level of the directory structure.
//    require('components/<module foldername>/controllers/sub_folder1/index');
//    require('components/<module foldername>/controllers/.../index');
//    require('components/<module foldername>/controllers/sub_folderN/index');
// Example of how to require the files within the current folder level
    require('components/attTrack/controllers/controller');
    require('components/attTrack/controllers/update');

//    require('components/<module foldername>/controllers/...');
///   require('components/<module foldername>/controllers/controllerFileN');
});