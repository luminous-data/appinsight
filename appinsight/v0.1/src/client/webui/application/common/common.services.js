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

angular.module("insightal.common")
	.factory("Globals", [
	    "$rootScope", function(
		 $rootScope) {
	// Globals holds object-catalog of all global variables that should be accessible throughout the app.
	return {
		search: {
			selectedApplicationGuid: "",
			selectedCollectionGuid: ""
		}
	};
}]);

angular.module("insightal.common")
	.factory("UiMessage", [
	    "$rootScope", function(
		 $rootScope) {
	var messageList	= [];
	
	return {
		add: function(type, text, body) {
			var msg = {type: type};
			if (typeof body === "undefined") {
				msg["body"] = text;
			}
			else {
				msg["title"] = text;
				msg["body"]  = body;
			}
		    messageList.push(msg);
		    $rootScope.$broadcast("message_added");
		},
		delete: function(idx) {
			messageList.splice(idx, 1)
		},
		clearAll: function() {
			messageList.length = 0;
		},
		messages: messageList
	};
}]);

angular.module("insightal.common")
	.factory("Utils", function() {
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
		getRandomInt: function(min, max) {
			return Math.floor(Math.random() * (max - min + 1)) + min;
		},
		getIndexByGuid: function(guid, array, guidKey) {
			if ( !angular.isNumber(guidKey) && !angular.isString(guidKey) )
				guidKey = "guid";
			for (var i=0; i<array.length; i++) {
				if (typeof array[i] !== "undefined" && typeof array[i][guidKey] !== "undefined" 
						&& array[i][guidKey] == guid)
					return i;
			}
			return -1;
		},
		getElementByGuid: function(guid, array, guidKey) {
			if ( !angular.isNumber(guidKey) && !angular.isString(guidKey) )
				guidKey = "guid";
			for (var i=0; i<array.length; i++) {
				if (typeof array[i] !== "undefined" && typeof array[i][guidKey] !== "undefined" 
						&& array[i][guidKey] == guid)
					return array[i];
			}
			return null;
		},
		getKeyCount: function(obj) {
			if ( angular.isObject(obj) )
				return Object.keys(obj).length;
			else
				return -1;
		},
		toggleSelection: function(selectedElements, element) {
			var idx = selectedElements.indexOf(element);
			if (idx > -1)
				selectedElements.splice(idx, 1);
			else
				selectedElements.push(element);
			return selectedElements;
		},
		parseJSON: function(json) {
			if (typeof JSON != "undefined" && typeof JSON.parse == "function") {
				return JSON.parse( json );
			}
			else if (typeof jQuery != "undefined") {
				return jQuery.parseJSON( json );
			}
			else {
				return "could not parse JSON";
			}
		},
		stringifyJSON: function(json) {
			if (typeof JSON != "undefined" && typeof JSON.stringify == "function") {
				return JSON.stringify( json );
			}
			else {
				return "could not stringify JSON";
			}
		},
		strToDate: function(input) {
			var dateTimeStrings = input.split("T"),
				date = dateTimeStrings[0].split("-"),
				time = dateTimeStrings[1].substring(0, dateTimeStrings[1].length-1 ).split(":");
			
			return new Date(date[0], date[1]-1, date[2], time[0], time[1], time[2], 0);
	    },
	    strToDateUtc: function(input) {
	    	var dateTimeStrings = input.split("T"),
		    	date  = dateTimeStrings[0].split("-"),
		    	timeZ = dateTimeStrings[1].split("Z"),
		    	time  = timeZ[0].split(":"),
		    	result = new Date();
	    	
	    	result.setUTCFullYear( date[0] );
	    	result.setUTCMonth( date[1] - 1 );
	    	result.setUTCDate( date[2] );
	    	result.setUTCHours( time[0] );
	    	result.setUTCMinutes( time[1] );
	    	result.setUTCSeconds( time[2] );
	    	result.setUTCMilliseconds(0);
	    	
	    	return result;
	    },
	    dateToStr: function(date) {
	    	var pad = function(number) {
	    		return (number<10? "0":"") + number;
	    	};
	    	
	    	var out = date.getFullYear() + "-" + pad(date.getMonth()+1) + "-" + pad(date.getDate()) + "T";
	    	out += pad(date.getHours()) + ":" + pad(date.getMinutes()) + ":" + pad(date.getSeconds()) + "Z";
	    	return out;
	    },
	    dateToStrUtc: function(date) {
	    	var pad = function(number) {
	    		return (number<10? "0":"") + number;
	    	};
	    	
	    	var out = date.getUTCFullYear() + "-" + pad(date.getUTCMonth()+1) + "-" + pad(date.getUTCDate()) + "T";
	    	out += pad(date.getUTCHours()) + ":" + pad(date.getUTCMinutes()) + ":" + pad(date.getUTCSeconds()) + "Z";
	    	return out;
	    },
	    formatDate: function(date, type) {
	    	var pad = function(number) {
	    		return (number<10? "0":"") + number;
	    	};
	    	
	    	if ( !angular.isDate( date ) ) {
	    		return "";
	    	}
	    	else if ( angular.isString( type ) && type == "date" ) {
	    		return (date.getMonth() + 1) + "/" + date.getDate();
	    	}
	    	else if ( angular.isString( type ) && type == "date-year" ) {
	    		return (date.getMonth() + 1) + "/" + date.getDate() + "/" + date.getFullYear().toString().substr(2);
	    	}
	    	else if ( angular.isString( type ) && type == "date-fullYear" ) {
	    		return (date.getMonth() + 1) + "/" + date.getDate() + "/" + date.getFullYear();
	    	}
	    	else if ( angular.isString( type ) && type == "time" ) {
	    		return date.getHours() + ":" + pad( date.getMinutes() );
	    	}
	    	else if ( angular.isString( type ) && type == "time-seconds" ) {
	    		return date.getHours() + ":" + pad( date.getMinutes() ) + ":" + pad( date.getSeconds() );
	    	}
	    	else if ( angular.isString( type ) && type == "date-time" ) {
	    		return (date.getMonth() + 1) + "/" + date.getDate() + " " + date.getHours() + ":" + pad( date.getMinutes() ); 
	    	}
	    	else { // full date-year-time-seconds
	    		return (date.getMonth() + 1) + "/" + date.getDate() + "/" + date.getFullYear() + " " + date.getHours() + ":" + pad( date.getMinutes() ) + ":" + pad( date.getSeconds() );
	    	}
	    },
	    isOfType: function(variable, type) {
	    	var isOfBasicType = function(x, t) {
	    		if ( !angular.isString(t) ) {
		    		return false;
		    	}
		    	else if (t === "int") {
		    		return isFinite(x) && (Math.round(x) == x);
		    	}
		    	else if (t === "float") {
		    		return isFinite(x);
		    	}
				else if (t === "boolean") {
					return typeof x === "boolean";
		    	}
				else if (t === "string") {
					return angular.isString(x);
				}
				else if (t === "object") {
					return angular.isObject(x) && !angular.isArray(x);
				}
				else if (t === "array") {
					return angular.isArray(x);
				}
				else if (t === "function") {
					return angular.isFunction(x);
				}
				else {
					return false;
				}
	    	};
	    	
	    	if ( !angular.isString(type) ) {
	    		return false;
	    	}
	    	else if(type.indexOf("int") == 0 ||
	    			type.indexOf("float") == 0 ||
	    			type.indexOf("boolean") == 0 ||
	    			type.indexOf("function") == 0) {
	    		return isOfBasicType(variable, type);
	    	}
			else if (type.indexOf("string") == 0) {
				if ( !isOfBasicType(variable, "string") ) {
					return false;
				}
				if (type === "string") {
					return true;
				}
				else { // e.g. "string<here_is_some_regexp_to_match_against||modifiers>", modifiers are i, g, m
					var args = type.substring(7, type.length-1).split("||"),
						pattern = new RegExp(args[0], args[1]);
					return pattern.test(variable);
				}
			}
			else if (type.indexOf("object") == 0) {
				if ( !isOfBasicType(variable, "object") ) {
					return false;
				}
				if (type === "object") {
					return true;
				}
				else { // e.g. "object<'key1':'type1','key2':'type2'>"
					var prototype = JSON.parse("{" + type.substring(7, type.length-1) + "}");
					for (var key in prototype) {
						if ( !angular.isDefined( variable[key] ) || !isOfBasicType( variable[key], prototype[key] ) ) {
							return false;
						}
					}
					return true;
				}
			}
			else if (type.indexOf("array") == 0) {
				if ( !isOfBasicType(variable, "array") ) {
					return false;
				}
				if (type === "array") {
					return true;
				}
				else { // e.g. "array<type>"
					var arrayType = type.substring(6, type.length-1);
					for (var i=0; i<variable.length; i++) {
						if ( !isOfBasicType( variable[i], arrayType ) ) {
							return false;
						}
					}
					return true;
				}
			}
//			else if (type.indexOf("datetime") == 0) {
//				if ( !isOfBasicType( variable, "string" ) ) {
//					return false;
//				}
//				// do some time pattern check
//			}
			else if (type.indexOf("timestamp") == 0) {
				return !isOfBasicType(variable, "int") && variable > 0;
			}
			else {
				return false;
			}
	    },
	    sortArrayOfObj: function(arrayIn, key, reverse, compType) {
	    	// compType is one of: "string" (default), "number", "smart" (will choose between string or number, based on the data)
	    	if ( !angular.isArray( arrayIn ) )
	    		return;
	    	if ( angular.isUndefined( reverse ) )
	    		reverse = false;
	    	if ( !angular.isString( compType ) )
	    		compType = "smart";
	    	if (compType === "smart") {
	    		var isNumeric = true, i = 0;
	    		while (i<arrayIn.length && isNumeric) {
	    			isNumeric = isFinite( arrayIn[i][key] ) && (typeof arrayIn[i][key] === "number" || typeof arrayIn[i][key] === "string");
	    			i++;
	    		}
	    		compType = isNumeric? "number" : "string";
	    	}
	    	
	    	var arrayOut = angular.copy( arrayIn ),
	    		rev = reverse? -1 : 1,
    			compFn;
	    	if (compType === "number") {
	    		compFn = function(a, b) {
	    			return rev * (a[key] - b[key]);
	    		};
	    	}
	    	else {
	    		compFn = function(a, b) {
	    			return rev * a[key].toString().localeCompare( b[key].toString() );
	    		};
	    	}
	    	arrayOut.sort(compFn);
	    	return arrayOut;
	    }
	}
});

angular.module("insightal.common")
	.factory("TreeUtils", function() {
	
	var getIdKey = function(idKey) {
		return (angular.isString(idKey) && idKey.length > 0)? idKey : "id";
	};
	
	var removePrefix = function(input, prefix) {
		var regExp = new RegExp( "^\/?" + prefix + "\/?" );
		return input.replace(regExp, "");
	};
		
	return {
		getNodeById: function(nodeId, nodes, idKey) {
			idKey = getIdKey(idKey);
			for (var i=0; i<nodes.length; i++) {
				if (nodes[i][idKey] === nodeId) {
					return nodes[i];
				}
			}
			return null;
		},
		getNodeIdxById: function(nodeId, nodes, idKey) {
			idKey = getIdKey(idKey);
			for (var i=0; i<nodes.length; i++) {
				if (nodes[i][idKey] === nodeId) {
					return i;
				}
			}
			return -1;
		},
		getNodesByParentId: function(nodeId, nodes, idKey) {
			var resultNodes = [];
			idKey = getIdKey(idKey);
			for (var i=0; i<nodes.length; i++) {
				if (nodes[i]["parent"] === nodeId) {
					resultNodes.push( nodes[i] );
				}
			}
			return resultNodes;
		},
		getNodesIdxByParentId: function(nodeId, nodes, idKey) {
			var indexes = [];
			idKey = getIdKey(idKey);
			for (var i=0; i<nodes.length; i++) {
				if (nodes[i]["parent"] === nodeId) {
					indexes.push(i);
				}
			}
			return indexes;
		},
		deleteNodesByParentId: function(nodeId, nodes, idKey) {
			var resultNodes = [];
			idKey = getIdKey(idKey);
			for (var i=0; i<nodes.length; i++) {
				if (nodes[i]["parent"] != nodeId) {
					resultNodes.push( nodes[i] );
				}
			}
			return resultNodes;
		},
		getNodeAncestors: function(nodeId, nodes, idKey) {
			idKey = getIdKey(idKey);
			var currentNode = this.getNodeById(nodeId, nodes, idKey),
				parentNode  = currentNode!=null? this.getNodeById(currentNode["parent"], nodes, idKey) : null;
			if (nodeId === "##" || currentNode == null || parentNode == null)
				return [];
			else
				return this.getNodeAncestors(currentNode["parent"], nodes, idKey).concat( parentNode );
		},
		getNodeAncestorsAndSelf: function(nodeId, nodes, idKey) {
			idKey = getIdKey(idKey);
			var currentNode = this.getNodeById(nodeId, nodes, idKey);
			if (currentNode == null)
				return [];
			return this.getNodeAncestors(nodeId, nodes, idKey).concat( currentNode );
		},
		getNodeAncestorsPath: function(nodeId, nodes, idKey) {
			idKey = getIdKey(idKey);
			var ancestors = this.getNodeAncestors(nodeId, nodes, idKey),
				nodePath  = "";
			
			for (var i=0; i<ancestors.length; i++)
				nodePath += ancestors[i][idKey] + "/";
			if (nodePath.length > 0)
				nodePath = nodePath.substr(0, nodePath.length-1);
			
			return nodePath;
		},
		getNodePath: function(nodeId, nodes, idKey, prefixToRemove) {
			idKey = getIdKey(idKey);
			var nodePath = this.getNodeAncestorsPath(nodeId, nodes, idKey);
			nodePath = nodePath + (nodePath.length>0? "/" : "") + nodeId;
			if (angular.isString(prefixToRemove))
				nodePath = removePrefix(nodePath, prefixToRemove);
			return nodePath;
		}
	};

});