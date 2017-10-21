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

angular.module("insightal.search")
	.factory("Search", [
        "$http", "$timeout", "Auth", "Utils", "DBG", function(
		 $http,   $timeout,   Auth,   Utils,   DBG) {
	var serviceRoot = routingConfig.serviceRoot;
	
	// DEV BEGIN
	if ( !angular.isObject( DBG["Search"] ) ) {
		DBG["Search"] = {};
	}
	// DEV END
	
	return {
        search: function(config) {
        	var params = {
    			match:			config["match"],
    			collectionId:	config["collectionId"],
    			tstampField:	config["tstampField"],
    			startTime:		config["startTime"],
                endTime:		config["endTime"],
                from:			config["from"],
                aggregations:	1
    		};
        	
        	var formatData = function(data) {
        		var formattedData = {
    				results:			angular.copy( data["searchResults"] ),
    				resultsCount:		data["searchResultsCount"],
    				aggregateByDate:	[],
            		aggregateByDocType:	[],
    				source: data
    			};
        		
        		for (var key in data["chartData"]) {
            		if ( key.lastIndexOf("_date_range_agg") == (key.length - 15) &&
            				angular.isObject( data["chartData"][key] ) &&
            				angular.isArray(  data["chartData"][key]["data"] ) ) {
            			formattedData["aggregateByDate"] = angular.copy( data["chartData"][key]["data"] );
            			break;
            		}
        		}
        		
        		var aggByDocType = [];
        		for (var i=0; i<data["aggregations"].length; i++) {
        			var keys = Object.keys( data["aggregations"][i] ),
        				aggData;
        			if (keys.length == 1 && data["aggregations"][i][ keys[0] ]["aggregationType"] == "terms") {
        				aggByDocType = aggByDocType.concat( data["aggregations"][i][ keys[0] ]["data"] );
        			}
        		}
        		formattedData["aggregateByDocType"] = aggByDocType;
        		
        		return formattedData;
        	};
        	
        	// DEV BEGIN
        	if (DBG.isOffline) {
        		var offlineData = DBG["Search"]["search"],
        			delay = Math.floor(Math.random() * (801)) + 200;
        		if ( angular.isDefined( offlineData ) )
        			$timeout(function(){ config.success(offlineData) }, delay);
            	else
            		$timeout(function(){ config.error({status:"ERROR", message:"No offline data."}) }, delay);
        		return;
        	}
        	// DEV END
        	
        	//filters: [{type:"term", field:"_all", value:"http"}],
        	if (typeof config["filters"] != "undefined")
        		params["filters"] = config["filters"];
        	if (typeof config["aggregations"] != "undefined")
        		params["aggregations"] = config["aggregations"];
    		
        	$http({
                url: serviceRoot[0] + "/searchNew",
                method: "POST",
                data: params,
                headers: {"X-AUTH-HEADER": Auth.authToken["value"]}
            })
            .success(function(data, status, headers, httpConfig) {
            	if (data["status"] === "OK") {
            		// DEV BEGIN
            		if (DBG.isRecording) {
            			DBG["Search"]["search"] = formatData(data);
            		}
            		// DEV END
            		
            		config.success(formatData(data), status, headers, httpConfig);
            	}
            	else {
            		config.error(data, status, headers, httpConfig);
            	}
            })
            .error(config.error); //function(data, status, headers, httpConfig) {}
        	
        	// DEV BEGIN
//        	console.debug("Search.search; params:");
//        	console.debug(config);
//        	var formattedData = {
//				results:			[{time:"Tue Oct 13 2015 04:11:43 GMT+0200 (Central Europe Standard Time)",message:"Message for entry 1.",level:"INFO",ip:"105.214.184.4"},{time:"Tue Oct 13 2015 00:44:45 GMT+0200 (Central Europe Standard Time)",message:"Message for entry 2.",level:"DEBUG",ip:"175.189.189.64"},{time:"Mon Oct 12 2015 18:31:37 GMT+0200 (Central Europe Standard Time)",message:"Message for entry 3.",level:"DEBUG",ip:"239.239.85.61"},{time:"Tue Oct 13 2015 00:46:58 GMT+0200 (Central Europe Standard Time)",message:"Message for entry 4.",level:"DEBUG",ip:"216.94.111.137"},{time:"Tue Oct 13 2015 14:12:24 GMT+0200 (Central Europe Standard Time)",message:"Message for entry 5.",level:"DEBUG",ip:"215.40.34.208"},{time:"Tue Oct 13 2015 09:33:44 GMT+0200 (Central Europe Standard Time)",message:"Message for entry 6.",level:"WARN",ip:"232.229.191.230"},{time:"Mon Oct 12 2015 21:25:40 GMT+0200 (Central Europe Standard Time)",message:"Message for entry 7.",level:"DEBUG",ip:"12.116.233.116"},{time:"Mon Oct 12 2015 16:23:06 GMT+0200 (Central Europe Standard Time)",message:"Message for entry 8.",level:"WARN",ip:"8.32.112.145"},{time:"Tue Oct 13 2015 01:51:05 GMT+0200 (Central Europe Standard Time)",message:"Message for entry 9.",level:"INFO",ip:"150.43.74.101"},{time:"Tue Oct 13 2015 12:58:46 GMT+0200 (Central Europe Standard Time)",message:"Message for entry 10.",level:"INFO",ip:"190.76.105.42"}],
//				resultsCount:		25,
//				aggregateByDate:	[[1444658400000,21],[1444662720000,31],[1444667040000,97],[1444671360000,89],[1444675680000,38],[1444680000000,12],[1444684320000,86],[1444688640000,100],[1444692960000,59],[1444697280000,14],[1444701600000,86],[1444705920000,23],[1444710240000,22],[1444714560000,61],[1444718880000,50],[1444723200000,45],[1444727520000,4],[1444731840000,31],[1444736160000,63],[1444740480000,20]],
//        		aggregateByDocType:	[["Facet 1", 12],["Facet 2", 4]],
//				source:				{}
//			};
//        	
//        	$timeout(function() {
//        		config.success(formattedData, 200);
//        	}, 500);
        	// DEV END
        }
    };
}]);