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

//angular.module("insightal.common")
//	.directive("activeNav", [
//	    "$location", function(
//		 $location) {
//    return {
//        restrict: "A",
//        link: function(scope, element, attrs) {
//            var nestedA = element.find("a")[0];
//            var path = nestedA.href;
//
//            scope.location = $location;
//            scope.$watch("location.absUrl()", function(newPath) {
//                if (path === newPath || path === newPath + "/" || path + "/" === newPath) {
//                    element.addClass("active");
//                }
//                else {
//                    element.removeClass("active");
//                }
//            });
//        }
//
//    };
//}]);

angular.module("insightal.common")
	.filter("startFrom", function() {
	return function(input, start) {
		if (input) {
			start = +start; // parse to int
			return input.slice(start);
		}
		return [];
	};
});

angular.module("insightal.common")
	.directive("scrollToTopWhen", [
	    "$timeout", function(
		 $timeout) {
	return {
		link: function(scope, element, attrs) {
			scope.$on(attrs.scrollToTopWhen, function () {
				$timeout(function() {
					angular.element(element)[0].scrollTop = 0;
				});
			});
		}
	}
}]);

angular.module("insightal.common")
	.directive("loading", [
	    "$http", "$rootScope", function(
		 $http,   $rootScope) {
	return {
		restrict: "A",
		link: function(scope, element, attrs) {
			scope.isWaitingResult = function() {
				if (scope.isWaiting)
					return true;
				
				var countedRequestsCount = 0;
				for (var i=0; i<$http.pendingRequests.length; i++)
					if (typeof $http.pendingRequests[i].params === "undefined")
						return true;
					else if (typeof $http.pendingRequests[i].params["__doNotShowWaiting"] === "undefined")
						return true;
			};
		
			scope.$watch(scope.isWaitingResult, function (newVal) {
				if (newVal) {
					element.show();
				}
				else {
					element.hide();
				}
			});
		}
	};
}]);

angular.module("insightal.common")
	.directive("fileModel", [
	    "$parse", function(
		 $parse) {
	return {
		restrict: "A",
		link: function(scope, element, attrs) {
			var model		= $parse(attrs.fileModel),
				modelSetter	= model.assign;
			
			element.bind('change', function(){
			    scope.$apply(function(){
			        modelSetter(scope, element[0].files[0]);
			    });
			});
		}
	};
}]);

angular.module("insightal.common")
	.directive("sizeLimits", [
		"$parse", function(
		 $parse) {
	// we use $parse service instead of isolate scope for this directive, because we don't want to create unnecessary additional scopes
	return {
		restrict: "A",
		link: function(scope, element, attrs) {
			// get a function that will parse (evaluate) the DOM element "size-limits" attribute each time we call this fn
			var changeSizeParser = $parse(attrs.sizeLimits);
			var getSizeVal = function(val) {
				if ( angular.isString(val) )
					return val;
				if ( isFinite(val) )
					return val.toString() + "px";
				return null;
			};
			
			scope.$watch(
				function(scope) {
					return changeSizeParser(scope);
				},
				function(sizeObj, sizeObjPrevious) {
					var sizeObjSafe = {},
						keys = ["minWidth", "maxWidth", "minHeight", "maxHeight"]; 
					for (var i=0; i<keys.length; i++) {
						var val = getSizeVal( sizeObj[ keys[i] ] );
						if (val != null)
							sizeObjSafe[ keys[i] ] = val;
					}
					element.css(sizeObjSafe);
				},
				true // use angular.equals instead of comparing for reference equality
			);
		}
	};
}]);
