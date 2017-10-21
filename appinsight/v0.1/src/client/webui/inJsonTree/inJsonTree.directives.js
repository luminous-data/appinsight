"use strict";

/*************************************************************************
 * 
 * Copyright 2016 Insightal Inc.
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *     http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

angular.module("inJsonTree")
	.directive("inJsonTree", [
		"InJsonTreeUtils", function (
		 InJsonTreeUtils) {
	    	
	return {
        restrict: "E",
        scope: {
        	modelRaw: "=jsonModel",
        	options: "="
        },
        templateUrl: "inJsonTree/inJsonTree.html",
        controller: "InJsonTreeCtrl as jsonTree",
        link: function(scope, element, attrs) {
        	element.addClass("in-jsontree");
	    	scope.modelRoot = InJsonTreeUtils.getExtendedModel( scope.modelRaw );
	    	if (!angular.isObject( scope.options ))
	    		scope.options = {};
	    	scope.isTreeReady = false;
	    	scope.firstLevelNodes = [];
	    	for (var i=0; i<scope.modelRoot.length; i++) {
	    		scope.firstLevelNodes.push( scope.modelRoot[i]["guid"] );
	    	}
	    } // END link function
    };
}]);

angular.module("inJsonTree")
	.directive("inJsonTreeNode", [
	    "$compile", "$http", "$templateCache", "InJsonTreeUtils", function (
	     $compile,   $http ,  $templateCache,   InJsonTreeUtils) {

	var treeNode = {
	    restrict: "E",
	    scope: {
	    	model: "=nodeModel",
	    	parentType: "=",
	    	options: "="
	    },
	    controller: "InJsonTreeNodeCtrl as node",
	    link: function(scope, element, attrs) {
	    	if (!angular.isObject( scope.options ))
	    		scope.options = {};
	    	$http.get("inJsonTree/inJsonTreeNode.html", {cache: $templateCache})
	    	.then(function(result) {
//    			element.replaceWith( $compile(result.data)(scope) );
    			element.html( $compile(result.data)(scope) );
    			scope.$emit("jsontree.nodeCompiled", scope.model["guid"]);
    		});
	    } // END link function
	};
	
	return treeNode;
}]);
