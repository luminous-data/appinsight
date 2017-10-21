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
	.controller("InJsonTreeCtrl", [
		"$scope", "InJsonTreeUtils", function(
		 $scope,   InJsonTreeUtils) {
	
	$scope.$watch("modelRoot", function(newType, oldType) {
		$scope.modelRaw = InJsonTreeUtils.getModelFromExtended( $scope.modelRoot );
	}, true);
	
	$scope.$on("jsontree.nodeCompiled", angular.bind(this, function(event, fieldGuid) {
		event.stopPropagation();
		var idx = $scope.firstLevelNodes.indexOf(fieldGuid);
		if (idx >= 0)
			$scope.firstLevelNodes.splice(idx, 1);
	}));
	
	$scope.$on("jsontree.removeField", angular.bind(this, function(event, field) {
		event.stopPropagation();
		InJsonTreeUtils.removeFieldByKey( $scope.modelRoot, field["key"] );
	}));
	
	$scope.addField = function() {
		var idx  = $scope.modelRoot.length;
		if ($scope.modelRoot["type"] === "array") {
			$scope.modelRoot.push({
				key:	idx,
				value:	"",
				type:	"string",
				guid:	InJsonTreeUtils.generateUUID()
			});
		}
		else if ($scope.modelRoot["type"] === "object") {
			var key = "field-" + idx;
			while (InJsonTreeUtils.hasField($scope.modelRoot, key)) {
				key = "field-" + (++idx);
			}
			$scope.modelRoot.push({
				key:	key,
				value:	"",
				type:	"string",
				guid:	InJsonTreeUtils.generateUUID()
			});
			
		}
	};
	
	$scope.$watch("firstLevelNodes.length", function(newVal, oldVal) {
		if (newVal == 0 && oldVal > 0)
			$scope.isTreeReady = true;
	});
	
}]);

angular.module("inJsonTree")
	.controller("InJsonTreeNodeCtrl", [
		"$scope", "InJsonTreeUtils", function(
		 $scope,   InJsonTreeUtils) {
	
	this.model = $scope.model;
	
	this.isInEditMode	= false;
	this.isExpanded		= false;
	this.oldModelType	= "";
	this.stringValue	= "";
	
	this.isHidden		= (function(key, hidden) {
		if (!angular.isArray( hidden ))
			return false;
		for (var i=0; i<hidden.length; i++) {
			var regex = new RegExp(hidden[i]);
			if (regex.test(key))
				return true;
		}
		return false;
	})(this.model["key"], $scope.options["hiddenFields"]);
	
	this.isDisabled		= (function(key, dis) {
		if (!angular.isArray( dis ))
			return false;
		for (var i=0; i<dis.length; i++) {
			var regex = new RegExp(dis[i]);
			if (regex.test(key))
				return true;
		}
		return false;
	})(this.model["key"], $scope.options["disabledFields"]);
	
	this.addField = function() {
		var type = this.model["type"],
			idx  = this.model["value"].length;
		if (type === "object") {
			var key = "field-" + idx;
			while (InJsonTreeUtils.hasField(this.model, key)) {
				key = "field-" + (++idx);
			}
			this.model["value"].push({
				key:	key,
				value:	"",
				type:	"string",
				guid:	InJsonTreeUtils.generateUUID()
			});
		}
		else if (type === "array") {
			this.model["value"].push({
				key:	idx,
				value:	"",
				type:	"string",
				guid:	InJsonTreeUtils.generateUUID()
			});
		}
	};
	
	this.removeField = function() {
		$scope.$emit("jsontree.removeField", this.model);
	};
	
	this.onFieldTypeChange = function() {
		var type	= this.model["type"],
			typeOld	= this.oldModelType,
			val		= this.model["value"];
		if (type != typeOld) {
			if (typeOld === "object" || typeOld === "array") {
				if (type === "number") {
					val = 0;
				}
				else if (type === "boolean") {
					val = false;
				}
				else if (type === "object") { // array -> object
					var valNew = [];
					valNew.type = "object";
					for (var i=0; i<val.length; i++) {
						valNew.push({
							key:	"key-" + i,
							value:	val[i]["value"],
							type:	val[i]["type"],
							guid:	val[i]["guid"]
						});
					}
					val = valNew;
				}
				else if (type === "array") { // object -> array
					var valNew = [];
					valNew.type = "array";
					for (var i=0; i<val.length; i++) {
						valNew.push({
							key:	i,
							value:	val[i]["value"],
							type:	val[i]["type"],
							guid:	val[i]["guid"]
						});
					}
					val = valNew;
				}
				else { // string
					val = val.toString();
				}
			}
			else { // typeOld is "number", "string" or "boolean"
				if (type === "number") {
					var valInt   = parseInt(val),
						valFloat = parseFloat(val);
					if (Number.isFinite(valInt) && valInt === valFloat) {
						// parsed int
						val = valInt;
					}
					else if (Number.isFinite(valFloat)) {
						// parsed float
						val = valFloat;
					}
					else {
						// not a number
						val = 0;
					}
				}
				else if (type === "boolean") {
					val = val? true : false;
				}
				else if (type === "object") {
					var valNew = []; // this is an array of extended model items! (array of objects like {key: "xyz", value:"something", type:"string", guid:"..."})
					valNew.type = "object";
					val = valNew; 
				}
				else if (type === "array") {
					var valNew = []; // this is an array of extended model items! (array of objects like {key: "xyz", value:"something", type:"string", guid:"..."})
					valNew.type = "array";
					val = valNew;
				}
				else { // string
					val = val.toString();
				}
			}
			this.model["value"] = val;
		}
	};
	
	this.getJsonString = function(ext) {
		var rawModel = InJsonTreeUtils.getModelFromExtended(ext);
		return JSON.stringify(rawModel);
	};
	
	$scope.$on("jsontree.removeField", angular.bind(this, function(event, field) {
		if (event["currentScope"]["$id"] != event["targetScope"]["$id"]) {
			event.stopPropagation();
			InJsonTreeUtils.removeFieldByKey( this.model["value"], field["key"] );
		}
	}));
	
	$scope.$watch("model.type", angular.bind(this, function(newType, oldType) {
		this.newModelType = newType;
	}));
	
	$scope.$watch(
		angular.bind(this, function(scope) {
			return this.isExpanded;
		}),
		angular.bind(this, function(newVal, oldVal) {
			if (oldVal && !newVal) {
				console.debug("will sync string value");
				console.debug(this.model);
				this.stringValue = this.getJsonString(this.model["value"]);
			}
		})
	);
	
	// init actions
	this.stringValue = this.getJsonString( this.model["value"] );
			
}]);