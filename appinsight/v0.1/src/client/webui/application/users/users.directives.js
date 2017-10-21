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

angular.module("insightal.users")
	.directive("accessLevel", [
	    "Auth", function(
		 Auth) {
    return {
        restrict: "A",
        link: function(scope, element, attrs) {
            var prevDisp = element.css("display"),
            	userRole,
                accessLevel;
            scope.user = Auth.user;
            
            attrs.$observe("userId", function(userId) {
                if (Auth.user.role)
                    userRole = Auth.user.role;
                updateCSS();
            });

            attrs.$observe("accessLevel", function(al) {
                if (al) accessLevel = scope.$eval(al);
                updateCSS();
            });

            function updateCSS() {
                if (userRole && accessLevel) {
                    if(!Auth.authorize(accessLevel, userRole))
                        element.css("display", "none");
                    else
                        element.css("display", prevDisp);
                }
            }
        }
    };
}]);