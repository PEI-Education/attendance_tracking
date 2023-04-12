'use strict';
define(function(require) {
// Example of sub folder definition for directives.
// Always require the index of the sub folder because
// they should require all the files at that level of the directory structure.
//    require('components/<module foldername>/directives/sub_folder1/index');
//    require('components/<module foldername>/directives/.../index');
//    require('components/<module foldername>/directives/sub_folderN/index');
// Example of how to require the files within the current folder level
    require('components/attTrack/directives/attTiles');
});