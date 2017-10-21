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

angular.module("insightal.charts")
	.directive("inChartOld", [
	    "$http", "$templateCache", "$compile", "$parse", function (
		 $http,   $templateCache,   $compile,   $parse) {
	return {
        restrict: "E",
        scope: {
        	config: "=",
        	widgetApi: "=api"
        },
        controller: "WidgetCtrl",
        link: function(scope, element, attrs) {
            $http.get("widgets/" + scope.config.type + ".html", {cache: $templateCache})
            	.success(function(templateContent) {
            		element.append( $compile(templateContent)(scope) );
            });
        }

    };

}]);

angular.module("insightal.charts")
	.directive("inChartStaticOld", [
	    "$http", "$templateCache", "$compile", "$parse", function(
		 $http,   $templateCache,   $compile,   $parse) {
	return {
        restrict: "E",
        scope: {
        	config: "=",
        	widgetApi: "=api"
        },
        controller: "WidgetStaticCtrl",
        link: function(scope, element, attrs) {
            $http.get("widgets/" + scope.config.type + ".html", {cache: $templateCache})
            	.success(function(templateContent) {
            		element.append( $compile(templateContent)(scope) );
            });
        }

    };
}]);