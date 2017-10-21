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
	.service("DataService",	[
	    "$http", "$q", "$timeout", "Auth", "Utils", "DBG", function(
	 	 $http,   $q,   $timeout,   Auth,   Utils,   DBG) {
	var serviceRoot = routingConfig.serviceRoot;
	
	// DEV BEGIN
    if ( !angular.isObject( DBG["DataService"] ) ) {
		DBG["DataService"] = {};
	}
    // DEV END
			
	this.listApplications = function(config) {
		// DEV BEGIN
    	if (DBG.isOffline) {
    		var offlineData = DBG["DataService"]["listApplications"],
    			delay = Math.floor(Math.random() * (801)) + 200;
    		if ( angular.isDefined( offlineData ) )
    			$timeout(function(){ config.success(offlineData) }, delay);
        	else
        		$timeout(function(){ config.error({status:"ERROR", message:"No offline data."}) }, delay);
    		return;
    	}
    	// DEV END
    	
    	var tenantId = config["tenantId"];
		
		$http({
            url: serviceRoot[0] + "/group/list",
            method: "POST",
            data: {tenantId: tenantId},
            headers: {"X-AUTH-HEADER": Auth.authToken["value"]}
        })
        .success(function(data, status, headers, httpConfig, statusText) {
        	var groups = data["groups"],
        		promises = [];
        	for (var i=0; i<groups.length; i++) {
        		promises.push(
    				$http({
                        url: serviceRoot[0] + "/application/list",
                        method: "POST",
                        data: {groupId: groups[i][0]},
                        headers: {"X-AUTH-HEADER": Auth.authToken["value"]}
                    })
                );
        	}
        	$q.all(promises).then(
    			function(dataArray) {
            		var appList = [];
            		for (var i=0; i<dataArray.length; i++) {
            			appList = appList.concat( dataArray[i].data["applications"] );
            		}
            		// DEV BEGIN
            		if (DBG.isRecording) {
            			DBG["DataService"]["listApplications"] = appList;
            		}
            		// DEV END
            		config.success(appList);
    			},
    			config.error
        	);
        })
        .error(config.error);
		
		// DEV BEGIN
//		$timeout(function(){
//			config["success"]([ ["675e0476-303d-45b1-b509-1f75b13a6a54", "My Application"] ]);
//		}, 500);
	  	// DEV END
	};
	
	this.getApplicationFields = function(config) {
		// DEV BEGIN
    	if (DBG.isOffline) {
    		var offlineData = DBG["DataService"]["getApplicationFields"],
    			delay = Math.floor(Math.random() * (801)) + 200;
    		if ( angular.isDefined( offlineData ) )
    			$timeout(function(){ config.success(offlineData) }, delay);
        	else
        		$timeout(function(){ config.error({status:"ERROR", message:"No offline data."}) }, delay);
    		return;
    	}
    	// DEV END
		
		var promises = [];
    	for (var i=0; i<config["applicationList"].length; i++) {
    		promises.push(
				$http({
                    url: serviceRoot[0] + "/getApplicationFields",
                    method: "POST",
                    data: {applicationId: config["applicationList"][i][0]},
                    headers: {"X-AUTH-HEADER": Auth.authToken["value"]}
                })
            );
    	}
    	$q.all(promises).then(
			function(dataArray) {
        		config.success( formatData(dataArray, config["applicationList"]) );
			},
			config.error
    	);
    	
    	var formatData = function(dataArray, appArray) {
    		var formatted = {};
    		for (var i=0; i<dataArray.length; i++) {
    			var appGuid = appArray[i][0],
    				data = dataArray[i]["data"];
    			if (data["status"] != "OK")
    				continue;
    			formatted[ appGuid ] = {}; 
    			formatted[ appGuid ]["name"]		= appArray[i][1];
    			formatted[ appGuid ]["collections"]	= {};
    			for (var j=0; j<data["result"].length; j++) {
    				var index = data["result"][j];
    				if (typeof formatted[ appGuid ].collections[ index["collectionId"] ] === "undefined") {
    					formatted[ appGuid ].collections[ index["collectionId"] ] = {};
    					formatted[ appGuid ].collections[ index["collectionId"] ]["name"]		= index["collectionName"];
    					formatted[ appGuid ].collections[ index["collectionId"] ]["documents"]	= {};
    				}
    				for (var docGuid in index["result"]) {
    					for (var docName in index["result"][ docGuid ]["mappings"]) {
	    					var doc = index["result"][ docGuid ]["mappings"][ docName ];
	    					formatted[ appGuid ].collections[ index["collectionId"] ].documents[ docName ] = {};
	    					if (typeof doc["properties"]["@fields"] === "undefined") {
	    						formatted[ appGuid ].collections[ index["collectionId"] ].documents[ docName ]["fields"] = angular.copy( doc["properties"] );
	    						for (var field in doc["properties"]) {
	    							if (doc["properties"][field]["type"] == "long")
	    								formatted[ appGuid ].collections[ index["collectionId"] ].documents[ docName ].fields[ field ]["attributes"] = ["min", "max", "average"];
	    							else
	    								formatted[ appGuid ].collections[ index["collectionId"] ].documents[ docName ].fields[ field ]["attributes"] = ["count"];
	    						}
	    					}
	    					else {
	    						formatted[ appGuid ].collections[ index["collectionId"] ].documents[ docName ]["fields"] = angular.copy( doc["properties"]["@fields"]["properties"] );
	    						for (var field in doc["properties"]["@fields"]["properties"]) {
	    							if (doc["properties"]["@fields"]["properties"][field]["type"] == "long")
	    								formatted[ appGuid ].collections[ index["collectionId"] ].documents[ docName ].fields[ field ]["attributes"] = ["min", "max", "average"];
	    							else
	    								formatted[ appGuid ].collections[ index["collectionId"] ].documents[ docName ].fields[ field ]["attributes"] = ["count"];
	    						}
	    					}
    					}
    				}
    			}
    		}
    		// DEV BEGIN
    		if (DBG.isRecording) {
    			DBG["DataService"]["getApplicationFields"] = formatted;
    		}
    		// DEV END
    		
    		return formatted;
    	};
		
		// DEV BEGIN
//		var sampleResult = {
//				status: "OK",
//				result: [{
//					status: "OK",
//					collectionName: "mycollection",
//					searchIndexName: "default",
//					collectionId: "2e608ca7-c5bc-4d27-8602-e458ab03be5f",
//					searchIndexId: "24d04c71-64bc-4e1a-9d15-a3d47e1f825d",
//					result: {
//						"24d04c71-64bc-4e1a-9d15-a3d47e1f825d": {
//							mappings: {
//								"apacheAccess": {
//									properties: {
//										"ident":		{"type": "string"},
//										"resource":		{"type": "string"},
//										"remoteUser":	{"type": "string"},
//										"@timestamp":	{"type": "date", "format": "dateOptionalTime"},
//										"bytes":		{"type": "long"},
//										"docType":		{"type": "string"},
//										"http_status":	{"type": "string"},
//										"time":			{"type": "double"},
//										"clientIP":		{"type": "string"},
//										"@type":		{"type": "string"}
//									}
//								},
//								"Java": {
//									properties: {
//										"level":		{"type": "string"},
//										"@timestamp":	{"type": "date", "format": "dateOptionalTime"},
//										"httpStatus":	{"type": "long"},
//										"docType":		{"type": "string"},
//										"time":			{"type": "long"},
//										"message":		{"type": "string"},
//										"foo":			{"type": "string"},
//										"parameter":	{"type": "string"},
//										"@type":		{"type": "string"}
//									}
//								}
//							}
//						}
//					}
//				}]
//			},
//			dataArray = [];
//		
//		// assign sample data
//		for (var i=0; i<config["applicationList"].length; i++) {
//			dataArray[i] = {
//				data: angular.copy(sampleResult)
//			};
//		}
//		
//		$timeout(function() {
//			config.success( formatData(dataArray, ["675e0476-303d-45b1-b509-1f75b13a6a54"]) );
//		}, 500);
		// DEV END
	};
	
	this.getDataAggregate = function(config) {
		// DEV BEGIN
    	if (DBG.isOffline) {
    		var offlineData = DBG["DataService"]["getDataAggregate"],
    			delay = Math.floor(Math.random() * (801)) + 200;
    		if ( angular.isDefined( offlineData ) )
    			$timeout(function(){ config.success(offlineData) }, delay);
        	else
        		$timeout(function(){ config.error({status:"ERROR", message:"No offline data."}) }, delay);
    		return;
    	}
    	// DEV END
		
		var requestConfig = {
				collections:	config["collection"],
				field:			config["field"],
				tstampField:	config["timestampField"],
				dryrun:			0
			},
			statistic = config["attribute"];
		if (statistic == "average")
			statistic = "avg";
		
		if (typeof config["searchTerm"] != "undefined" && config["searchTerm"] != "") {
			requestConfig["queryType"] = "term_query_stats";
			requestConfig["match"] = config["searchTerm"];
		}
		else if (statistic == "count") {
			requestConfig["queryType"] = "field_term_stats";
		}
		else {
			requestConfig["queryType"] = "numeric_stats";
			requestConfig["statistic"] = statistic;
		}

		if (typeof config["startTime"] != "undefined" && config["startTime"] != "") {
			requestConfig["startTime"] = Math.floor( config["startTime"] / 1000 ); // we need timestamp in seconds, javascript gives milliseconds
		}
		if (typeof config["endTime"] != "undefined" && config["endTime"] != "") {
			requestConfig["endTime"] = Math.floor( config["endTime"] / 1000 ); // we need timestamp in seconds, javascript gives milliseconds
		}
		
		$http({
            url: serviceRoot[0] + "/getAggregateStatsNew",
            method: "POST",
            data: requestConfig,
            headers: {"X-AUTH-HEADER": Auth.authToken["value"]}
        })
        .success(function(data, status, header, httpConfig) {
        	var formattedData = [];
        	
//        	if (requestConfig["queryType"] == "term_query_stats") {
//        		rawData = data["aggs"]["data"];
//    			series = {name:"series", values:[]};
//    			for (var i=0; i<rawData.length; i++) {
//    				var date = Utils.strToDate(rawData[i][0]),
//    					value = rawData[i][1];
//    				series["values"].push([
//                        date.getTime(),
//                        value==null? 0 : value
//                    ]);
//    			}
//    			formattedData.push(series);
//        	}
//        	else if (requestConfig["queryType"] == "field_term_stats") {
//        		rawData = data["aggs"]["data"];
//        		for (var key in rawData) {
//        			series = {name:key, values:[]};
//        			for (var i=0; i<rawData[key].length; i++) {
//        				var date = Utils.strToDate(rawData[key][i][0]),
//        					value = rawData[key][i][1];
//        				series["values"].push([
//	                        date.getTime(),
//	                        value==null? 0 : value
//                        ]);
//        			}
//        			formattedData.push(series);
//        		}
//        	}
//        	else { //queryType == "numeric_stats"
//            	
//        	}
        	
        	
        	if ( angular.isArray( data["aggregations"] ) ){
        		for (var i=0; i<data["aggregations"].length; i++) {
		// DEBUG BEGIN
//		        	var getRandomInt = function(min, max) {
//		        		return Math.floor(Math.random() * (max - min + 1)) + min;
//		        	}
//		        	for (var j=0; j<data["aggregations"][i]["data"].length; j++) {
//		        		data["aggregations"][i]["data"][j][1] = getRandomInt(0, 100);
//		        	}
    	// DEBUG END
        			formattedData.push({
        				name:	"series" + i,
        				values:	angular.copy( data["aggregations"][i]["data"] )
        			});
        		} 
        	}
        	else if ( angular.isObject( data["aggregations"] ) ) {
        		for (var key in data["aggregations"]) {
        			formattedData.push({
        				name:	key,
        				values:	angular.copy( data["aggregations"][key] )
        			});
        		}
        	}
        	
        	// DEV BEGIN
    		if (DBG.isRecording) {
    			DBG["DataService"]["getDataAggregate"] = formattedData;
    		}
    		// DEV END
    		
        	config.success( formattedData, status, header, config);
        })
        .error(config.error); //function(data, status, headers, config) {}
		
		
		// DEV BEGIN
//		var rawData = [],
//			formattedData = [];
//		
//		var getRandomInt = function(min, max) {
//			return Math.floor(Math.random() * (max - min + 1)) + min;
//		}
//		var now = new Date(),
//		nowTimestamp = now.getTime();
//		nowTimestamp = ( Math.floor( now/15000 ) ) * 15000;
//		if (requestConfig["queryType"] == "term_query_stats") {
//			formattedData.push({
//				name: "series",
//				values: [[
//				          nowTimestamp,
//				          getRandomInt(-500,500)
//				          ]]
//			});
//		}
//		else if (requestConfig["queryType"] == "field_term_stats") {
//			rawData = {
//					200: getRandomInt(0,100),
//					400: getRandomInt(0, 40),
//					401: getRandomInt(0, 10),
//					404: getRandomInt(0, 20)
//			};
//			for (var key in rawData) {
//				formattedData.push({
//					name: key,
//					values: [[
//					          nowTimestamp,
//					          rawData[key]
//					          ]]
//				});
//			}
//		}
//		else { //queryType == "numeric_stats"
//			formattedData.push({
//				name: "series",
//				values: [[
//				          nowTimestamp,
//				          getRandomInt(0,100)
//				          ]]
//			});
//		}
//		
//		$timeout(function() {
//			config.success(formattedData)
//		}, 750);
		// DEV END
	};
	
	this.getData = function(config) {
		// DEV BEGIN
    	if (DBG.isOffline) {
    		var offlineData = DBG["DataService"]["getData"],
    			delay = Math.floor(Math.random() * (801)) + 200;
    		if ( angular.isDefined( offlineData ) )
    			$timeout(function(){ config.success(offlineData) }, delay);
        	else
        		$timeout(function(){ config.error({status:"ERROR", message:"No offline data."}) }, delay);
    		return;
    	}
    	// DEV END
		
		var requestConfig = {
				collections:	config["collection"],
				field:			config["field"],
				tstampField:	config["timestampField"],
				startTime: 		Math.floor( config["startTime"] / 1000 ), // we need timestamp in seconds, javascript gives milliseconds
				endTime:		Math.floor( config["endTime"]   / 1000 ),
				dryrun:			0
			},
			statistic = config["attribute"];
		if (statistic == "average")
			statistic = "avg";
		
		if (typeof config["searchTerm"] != "undefined" && config["searchTerm"] != "") {
			requestConfig["queryType"] = "term_query_stats";
			requestConfig["match"] = config["searchTerm"];
		}
		else if (statistic == "count") { // the statistic need not to be specified in requestConfig, there's only one - "count"
			requestConfig["queryType"] = "field_term_stats";
		}
		else {
			requestConfig["queryType"] = "numeric_stats";
			requestConfig["statistic"] = statistic; // for numeric stats, specify which statistic we need
		}
		
		$http({
            url: serviceRoot[0] + "/getAggregateStatsNextDatapointNew",
            method: "POST",
            data: requestConfig,
            headers: {"X-AUTH-HEADER": Auth.authToken["value"]},
            params: {"__doNotShowWaiting": true}
        })
        .success(function(data, status, header, httpConfig) {
        	var formattedData = [];
//	    	
//	    	if (requestConfig["queryType"] == "term_query_stats") {
//	    		rawData = data["aggs"]["data"];
//				var date = Utils.strToDate(rawData[ rawData.length-1 ][0]),
//    				value = rawData[ rawData.length-1 ][1];
//				formattedData.push({
//    				name: "series",
//    				values: [[
//                        date.getTime(),
//                        value==null? 0 : value
//                    ]]
//    			});
//	    	}
//	    	else if (requestConfig["queryType"] == "field_term_stats") {
//	    		rawData = data["aggs"]["data"];
//	    		for (var key in rawData) {
//    				var date = Utils.strToDate(rawData[key][ rawData[key].length-1 ][0]),
//	    				value = rawData[key][ rawData[key].length-1 ][1];
//    				formattedData.push({
//	    				name: key,
//	    				values: [[
//	                        date.getTime(),
//	                        value==null? 0 : value
//	                    ]]
//	    			});
//	    		}
//	    	}
//	    	else { //queryType == "numeric_stats"
//	    		rawData = data["aggs"]["data"][statistic];
//				var date = Utils.strToDate(rawData[ rawData.length-1 ][0]),
//    				value = rawData[ rawData.length-1 ][1];
//				formattedData.push({
//    				name: "series",
//    				values: [[
//                        date.getTime(),
//                        value==null? 0 : value
//                    ]]
//    			});
//	    	}
        	
        	if ( angular.isArray( data["aggregations"] ) ){
        		for (var i=0; i<data["aggregations"].length; i++) {
        			formattedData.push({
            			name:	"series" + i,
            			value:	[ config["startTime"], data["aggregations"][i]["data"] ]
                	});
        		} 
        	}
        	else if ( angular.isObject( data["aggregations"] ) ) {
        		for (var key in data["aggregations"]) {
        			formattedData.push({
        				name:	key,
        				value:	[ config["startTime"], data["aggregations"][key] ]
        			});
        		}
        	}
        	
        	// DEV BEGIN
    		if (DBG.isRecording) {
    			DBG["DataService"]["getData"] = formattedData;
    		}
    		// DEV END
    		
    		console.debug("getData (raw|formatted):");
    		console.debug(data);
    		console.debug(formattedData);
	    	
	    	config.success(formattedData, status, header, config);
        })
        .error(config.error); //function(data, status, headers, config) {}
		
		// DEV BEGIN
//		var rawData = [],
//			formattedData = [],
//			series = {},
//			now = new Date(),
//			nowTimestamp = now.getTime(),
//			timestamps = [],
//			values = [];
//		var getRandomInt = function(min, max) {
//			return Math.floor(Math.random() * (max - min + 1)) + min;
//		}
//		nowTimestamp = ( Math.floor( now/15000 ) ) * 15000;
//		for (var i=0, t=nowTimestamp; i<20; i++, t-=15000 ) {
//			timestamps.unshift(t);
//		}
//		if (requestConfig["queryType"] == "term_query_stats") {
//			for (var i=0; i<20; i++) {
//				values.push([
//				             timestamps[i],
//				             getRandomInt(-500,500)
//				             ]);
//			}
//			formattedData.push({
//				name: "series",
//				values: values
//			});
//		}
//		else if (requestConfig["queryType"] == "field_term_stats") {
//			rawData = {
//					200: 100,
//					400: 40,
//					401: 10,
//					404: 20
//			};
//			for (var key in rawData) {
//				values = [];
//				for (var i=0; i<20; i++) {
//					values.push([
//					             timestamps[i],
//					             getRandomInt(0,rawData[key])
//					             ]);
//				}
//				formattedData.push({
//					name: key,
//					values: values
//				});
//			}
//		}
//		else { //queryType == "numeric_stats"
//			for (var i=0; i<20; i++) {
//				values.push([
//				             timestamps[i],
//				             getRandomInt(0,100)
//				             ]);
//			}
//			formattedData.push({
//				name: "series",
//				values: values
//			});
//		}
//		setTimeout(function() {config.success(formattedData)}, 750);
		// DEV END
	};
	
}]);