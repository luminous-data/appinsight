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

angular.module("jsPlumb")
	.directive("jsPlumbContainer", [
	    "PlumbContainers", "PlumbUtils", function (
		 PlumbContainers,   PlumbUtils) {

	var container = null;
	    	
	return {
		restrict: "A",
		scope: {
			containerId: "@jsPlumbContainer"
		},
		link: function(scope, element, attrs) {
			var containerId = scope["containerId"];
			if ( !angular.isString( containerId ) || containerId.length == 0 ) {
				containerId = "jsPlumb-container-" + PlumbUtils.generateUUID(); 
			}
			element.attr("id", containerId);
			element.css("position", "relative");
			
			container = jsPlumb.getInstance({
				Container: containerId,
				DragOptions: {
					containment: true
				},
				Endpoint: ["Dot", {radius: 2}],
				Connector: "StateMachine"
			});
			container.registerConnectionType("basic", {
				anchor: "Continuous",
				connector: "StateMachine"
			});
			
			PlumbContainers.catalog[containerId] = container;
			
			// debug
			window["plumb"] = container;
			
//			container.draggable(["el1", "el2"]);
//			container.connect({
//				source:"el1",
//				target:"el2",
//				endpoint:"Rectangle"
//			});

		}
	};
	
}]);

angular.module("jsPlumb")
	.directive("jsPlumbState", [
	    "PlumbContainers", "PlumbUtils", function (
		 PlumbContainers,   PlumbUtils) {

	var container = null;
	    	
	return {
		restrict: "A",
		scope: {
			id: "@jsPlumbState",
			x: "@",
			y: "@"
		},
		link: function(scope, element, attrs) {
			var stateId = scope["id"];
			if ( !angular.isString( stateId ) || stateId.length == 0 ) {
				stateId = "jsPlumb-state-" + PlumbUtils.generateUUID(); 
			}
			element.attr("id", stateId);
			element.css({
				position: "absolute",
				left:	scope["x"] + "px",
				top:	scope["y"] + "px",
				cursor:	"move"
			});
			
			container = PlumbContainers.catalog["jsPlumb1"];
			container.draggable(stateId);
			container.makeSource(stateId, {
				filter: ".endpoint"
			});
			container.makeTarget(stateId);
		}
	};

}]);