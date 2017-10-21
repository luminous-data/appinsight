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
	.factory("InJsonTreeUtils", [
	    "$rootScope", function(
		 $rootScope) {
	    	
	return {
		generateUUID: function() {
			var d = new Date().getTime();
			var uuid = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
				var r = (d + Math.random()*16)%16 | 0;
				d = Math.floor(d/16);
				return (c=="x" ? r : (r&0x7|0x8)).toString(16);
			});
			return uuid;
		},
		getFieldIdxByKey: function(objMeta, key, keyName) {
			var idx = 0;
			if (!angular.isArray( objMeta ))
				return -1;
			if (!angular.isString( keyName ) || keyName.length == 0)
				keyName = "key";
			while (idx < objMeta.length && objMeta[idx][keyName] != key)
				idx++;
			if (angular.isObject( objMeta[idx] ))
				return idx;
			else
				return -1;
		},
		getFieldByKey: function(objMeta, key, keyName) {
			var idx = this.getFieldIdxByKey(objMeta, key, keyName);
			if (idx >= 0)
				return objMeta[idx];
			else
				return undefined;
		},
		hasField: function(objMeta, key) {
			if (angular.isArray( objMeta )) {
				for (var i=0; i<objMeta.length; i++) {
					if (objMeta[i]["key"] === key)
						return true;
				}
			}
			return false;
		},
		removeFieldByKey: function(objMeta, key, keyName) {
			var idx = this.getFieldIdxByKey(objMeta, key, keyName);
			if (idx >= 0) {
				objMeta.splice(idx, 1);
				if (objMeta["type"] == "array") {
					// we have to rearrange indexes, so that they form a series 0,1,2,3,...
					for (var i=idx; i<objMeta.length; i++) {
						objMeta[i]["key"]--;
					}
				}
			}
		},
		getObjectFields: function(data) {
			var fields = [];
			fields.type = "object";
			for (var key in data) {
				if (angular.isArray( data[key] )) {
					fields.push({
						key:	key,
						value:	this.getArrayFields( data[key] ),
						type:	"array",
						guid:	this.generateUUID()
					});
				}
				else if (angular.isObject( data[key] )) {
					fields.push({
						key:	key,
						value:	this.getObjectFields( data[key] ),
						type:	"object",
						guid:	this.generateUUID()
					});
				}
				else if (typeof data[key] === "boolean") {
					fields.push({
						key:	key,
						value:	data[key],
						type:	"boolean",
						guid:	this.generateUUID()
					});
				}
				else if (angular.isNumber( data[key] )) {
					fields.push({
						key:	key,
						value:	data[key],
						type:	"number",
						guid:	this.generateUUID()
					});
				}
				else {
					fields.push({
						key:	key,
						value:	data[key],
						type:	"string",
						guid:	this.generateUUID()
					});
				}
			}
			return fields;
		},
		getArrayFields: function(data) {
			var fields = [];
			fields.type = "array";
			for (var i=0; i<data.length; i++) {
				if (angular.isArray( data[i] )) {
					fields.push({
						key:	i,
						value:	this.getArrayFields( data[i] ),
						type:	"array",
						guid:	this.generateUUID()
					});
				}
				else if (angular.isObject( data[i] )) {
					fields.push({
						key:	i,
						value:	this.getObjectFields( data[i] ),
						type:	"object",
						guid:	this.generateUUID()
					});
				}
				else if (typeof data[i] === "boolean") {
					fields.push({
						key:	i,
						value:	data[i],
						type:	"boolean",
						guid:	this.generateUUID()
					});
				}
				else if (angular.isNumber( data[i] )) {
					fields.push({
						key:	i,
						value:	data[i],
						type:	"number",
						guid:	this.generateUUID()
					});
				}
				else {
					fields.push({
						key:	i,
						value:	data[i],
						type:	"string",
						guid:	this.generateUUID()
					});
				}
			}
			return fields;
		},
		getExtendedModel: function(simpleModel) {
			if (angular.isArray( simpleModel ))
				return this.getArrayFields( simpleModel );
			else if (angular.isObject( simpleModel ))
				return this.getObjectFields( simpleModel );
			else
				return [];
		},
		getModelFromExtended: function(ext) {
			var extToPlain = function(data) {
				var res = null;
				if (data["type"] === "array") {
					res = [];
					for (var i=0; i<data.length; i++) {
						if (data[i]["type"] === "array" || data[i]["type"] === "object") {
							res[ data[i]["key"] ] = extToPlain( data[i]["value"] );
						}
						else {
							res[ data[i]["key"] ] = data[i]["value"];
						}
					}
				}
				else if (data["type"] === "object") {
					res = {};
					for (var i=0; i<data.length; i++) {
						if (data[i]["type"] === "array" || data[i]["type"] === "object") {
							res[ data[i]["key"] ] = extToPlain( data[i]["value"] );
						}
						else {
							res[ data[i]["key"] ] = data[i]["value"];
						}
					}
				}
				return res;
			}

			return extToPlain(ext);
		}
	};
	    	
}]);