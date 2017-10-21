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

angular.module("insightal.dashboard")
	.factory("Dashboard", [
	    "$http", "$q", "$cookies", "$timeout", "Utils", "Auth", "DBG", function(
		 $http,   $q,   $cookies,   $timeout,   Utils,   Auth,   DBG) {
			//verify if "$cookieStore", "Utils" are necessary in production version
	var serviceRoot = routingConfig.serviceRoot;
	
	// DEV BEGIN
    if ( !angular.isObject( DBG["Dashboard"] ) ) {
		DBG["Dashboard"] = {};
	}
    // DEV END
	
	return {
		create: function(config) {
			// DEV BEGIN
	    	if (DBG.isOffline) {
	    		var offlineData = DBG["Dashboard"]["create"],
	    			delay = Math.floor(Math.random() * (801)) + 200;
	    		if ( angular.isDefined( offlineData ) )
	    			$timeout(function(){ config.success(offlineData) }, delay);
	        	else
	        		$timeout(function(){ config.error({status:"ERROR", message:"No offline data."}) }, delay);
	    		return;
	    	}
	    	// DEV END
			
			$http({
                url: serviceRoot[0] + "/dashboard/new",
                method: "POST",
                data: {
                	name: config["name"],
                	dashboard: Utils.stringifyJSON( config["dashboard"] )
                },
                headers: {"X-AUTH-HEADER": Auth.authToken["value"]}
            })
            .success(function(data, status, headers, httpConfig) {
            	if (data["status"] === "OK") {
            		// DEV BEGIN
            		if (DBG.isRecording) {
            			DBG["Dashboard"]["create"] = data;
            		}
            		// DEV END
            		
            		config.success(data, status, headers, httpConfig);
            	}
            	else
            		config.error(data, status, headers, httpConfig);
            })
            .error(config.error); //function(data, status, headers, httpConfig) {}
			
			// DEV BEGIN
//			$timeout(function() {
//				config.success({"status": "OK", "dashboardId": "d887f111-d352-44ef-80b6-1edb185d3143"}, null, null, {data:{name:"Dashboard 1"}});
//			}, 500);
			// DEV END
		},
		list: function(config) {
			// DEV BEGIN
	    	if (DBG.isOffline) {
	    		var offlineData = DBG["Dashboard"]["list"],
	    			delay = Math.floor(Math.random() * (801)) + 200;
	    		if ( angular.isDefined( offlineData ) )
	    			$timeout(function(){ config.success(offlineData) }, delay);
	        	else
	        		$timeout(function(){ config.error({status:"ERROR", message:"No offline data."}) }, delay);
	    		return;
	    	}
	    	// DEV END
			
			$http({
                url: serviceRoot[0] + "/dashboard/list",
                method: "POST",
                data: {},
                headers: {"X-AUTH-HEADER": Auth.authToken["value"]}
            })
            .success(function(data, status, headers, httpConfig) {
            	if (data["status"] === "OK") {
            		// DEV BEGIN
            		if (DBG.isRecording) {
            			DBG["Dashboard"]["list"] = data;
            		}
            		// DEV END
            		
            		config.success(data, status, headers, httpConfig);
            	}
            	else
            		config.error(data, status, headers, httpConfig);
            })
            .error(config.error); //function(data, status, headers, httpConfig) {}
		
			// DEV BEGIN
//			$timeout(function() {
//				config.success({
//					status: "OK",
//					dashboards: [
//			            ["d887f111-d352-44ef-80b6-1edb185d3143", "Test Dashboard 1", "{\"name\":\"Dashboard 1\",\"description\":\"Dashboard 1 description.\",\"guid\":null,\"user\":null,\"active\":1,\"creationDate\":\"2015-10-14T17:27:27.706Z\",\"modificationDate\":\"2015-10-14T17:27:27.706Z\",\"datasources\":[],\"widgets\":[],\"transientCfg\":{}}"],
//			            ["9a0bd9e1-46ae-4007-aece-7c4fb41658e9", "My Dashboard", "{\"name\":\"My Dashboard\",\"description\":null,\"guid\":\"9a0bd9e1-46ae-4007-aece-7c4fb41658e9\",\"user\":null,\"active\":1,\"creationDate\":\"2015-06-09T21:18:55.922Z\",\"modificationDate\":\"2015-06-09T21:18:55.922Z\",\"datasources\":[],\"widgets\":[{\"add\":{\"position\":0,\"panelStyle\":{\"width\":\"50%\"},\"width\":50},\"series\":[{\"metric\":{\"application\":\"675e0476-303d-45b1-b509-1f75b13a6a54\",\"collection\":\"2e608ca7-c5bc-4d27-8602-e458ab03be5f\",\"document\":\"apacheAccess\",\"field\":\"http_status\",\"attribute\":\"count\"},\"data\":[],\"guid\":\"5741d82c-3d76-4310-cbee-297c1743e7e8\",\"id\":\"\",\"type\":\"inherit\",\"name\":\"Series 1\",\"color\":null,\"zIndex\":1,\"lineWidth\":1,\"markerEnabled\":true,\"markerSize\":4,\"markerSymbol\":null}],\"guid\":\"3de1b93c-711c-4ccd-b451-5b72dc39178f\",\"type\":\"line\",\"typeName\":null,\"active\":1,\"title\":\"200\",\"subtitle\":null,\"zoom\":\"x\",\"showLegend\":true,\"xAxisType\":\"datetime\",\"xAxisTitle\":\"\",\"xAxisCategories\":null,\"xAxisMin\":null,\"xAxisMax\":null,\"xAxisOpposite\":false,\"xAxisReversed\":false,\"xAxisAllowDecimals\":true,\"xAxisOffset\":0,\"xTickInterval\":null,\"xTickLength\":10,\"xTickPositions\":null,\"yAxisType\":\"linear\",\"yAxisTitle\":\"\",\"yAxisCategories\":null,\"yAxisMin\":null,\"yAxisMax\":null,\"yAxisOpposite\":false,\"yAxisReversed\":false,\"yAxisAllowDecimals\":true,\"yAxisOffset\":0,\"yTickInterval\":null,\"yTickLength\":10,\"yTickPositions\":null,\"showCredits\":false,\"xAxisDataFormat\":\"%H:%M:%S\",\"yAxisDataFormat\":\"\",\"lineWidth\":1},{\"add\":{\"position\":1,\"panelStyle\":{\"width\":\"50%\"},\"width\":50},\"series\":[{\"metric\":{\"application\":\"675e0476-303d-45b1-b509-1f75b13a6a54\",\"collection\":\"2e608ca7-c5bc-4d27-8602-e458ab03be5f\",\"document\":\"apacheAccess\",\"field\":\"clientIP\",\"attribute\":\"count\"},\"data\":[],\"guid\":\"28147207-627a-4691-87bb-7be1b4522bee\",\"id\":\"\",\"type\":\"inherit\",\"name\":\"Series 1\",\"color\":null,\"zIndex\":1,\"stacking\":null}],\"guid\":\"eb0e1c5b-c1ff-4f3f-de7e-0294a1502ca9\",\"type\":\"column\",\"typeName\":null,\"active\":1,\"title\":\"ips\",\"subtitle\":null,\"zoom\":\"x\",\"showLegend\":true,\"xAxisType\":\"datetime\",\"xAxisTitle\":\"\",\"xAxisCategories\":null,\"xAxisMin\":null,\"xAxisMax\":null,\"xAxisOpposite\":false,\"xAxisReversed\":false,\"xAxisAllowDecimals\":true,\"xAxisOffset\":0,\"xTickInterval\":null,\"xTickLength\":10,\"xTickPositions\":null,\"yAxisType\":\"linear\",\"yAxisTitle\":\"\",\"yAxisCategories\":null,\"yAxisMin\":null,\"yAxisMax\":null,\"yAxisOpposite\":false,\"yAxisReversed\":false,\"yAxisAllowDecimals\":true,\"yAxisOffset\":0,\"yTickInterval\":null,\"yTickLength\":10,\"yTickPositions\":null,\"showCredits\":false,\"xAxisDataFormat\":\"%H:%M:%S\",\"yAxisDataFormat\":\"\",\"stacking\":null}],\"transientCfg\":{}}"]
//		            ]
//				});
//			}, 500);
			// DEV END
		},
		update: function(config) {
			// DEV BEGIN
	    	if (DBG.isOffline) {
	    		var offlineData = DBG["Dashboard"]["update"],
	    			delay = Math.floor(Math.random() * (801)) + 200;
	    		if ( angular.isDefined( offlineData ) )
	    			$timeout(function(){ config.success(offlineData) }, delay);
	        	else
	        		$timeout(function(){ config.error({status:"ERROR", message:"No offline data."}) }, delay);
	    		return;
	    	}
	    	// DEV END
			
			$http({
                url: serviceRoot[0] + "/dashboard/update",
                method: "POST",
                data: {
                	id: config["guid"],
                	dashboard: Utils.stringifyJSON( config["dashboard"] )
                },
                headers: {"X-AUTH-HEADER": Auth.authToken["value"]}
            })
            .success(function(data, status, headers, httpConfig) {
            	if (data["status"] === "OK") {
            		// DEV BEGIN
            		if (DBG.isRecording) {
            			DBG["Dashboard"]["update"] = data;
            		}
            		// DEV END
            		
            		config.success(data, status, headers, httpConfig);
            	}
            	else
            		config.error(data, status, headers, httpConfig);
            })
            .error(config.error); //function(data, status, headers, httpConfig) {}
			
			// DEV BEGIN
//			console.debug("Dashboard JSON:");
//			console.debug( Utils.stringifyJSON( config["dashboard"] ) );
//			$timeout(function() {
//				config.success();
//			}, 500);
			// DEV END
		},
		delete: function(config) {
			// DEV BEGIN
	    	if (DBG.isOffline) {
	    		var offlineData = DBG["Dashboard"]["delete"],
	    			delay = Math.floor(Math.random() * (801)) + 200;
	    		if ( angular.isDefined( offlineData ) )
	    			$timeout(function(){ config.success(offlineData) }, delay);
	        	else
	        		$timeout(function(){ config.error({status:"ERROR", message:"No offline data."}) }, delay);
	    		return;
	    	}
	    	// DEV END
			
			$http({
                url: serviceRoot[0] + "/dashboard/deleteById",
                method: "POST",
                data: {id: config["dashboardGuid"]},
                headers: {"X-AUTH-HEADER": Auth.authToken["value"]}
            })
            .success(function(data, status, headers, httpConfig) {
            	if (data["status"] === "OK") {
            		// DEV BEGIN
            		if (DBG.isRecording) {
            			DBG["Dashboard"]["delete"] = data;
            		}
            		// DEV END
            		
            		config.success(data, status, headers, httpConfig);
            	}
            	else
            		config.error(data, status, headers, httpConfig);
            })
            .error(config.error); //function(data, status, headers, httpConfig) {}
		}
	};
}]);

angular.module("insightal.dashboard")
	.factory("DashboardCharts", [
	    "Utils", function(
		 Utils) {
	return {
		getChartOptions: function(optionsMeta, userEditableOnly) {
			var options = {};
			if (typeof userEditableOnly != "boolean")
				userEditableOnly = false;
			for (var key in optionsMeta) {
				if ( !userEditableOnly || optionsMeta[key]["modifyType"].indexOf("user") >=0 ) {
					options[key] = angular.copy( optionsMeta[key]["defaultVal"] );
				}
			}
			return options;
		},
		getChartOptionsFromArray: function(optionsMetaArray, userEditableOnly) {
			var options = {};
			if (typeof userEditableOnly != "boolean")
				userEditableOnly = false;
			for (var i=0; i<optionsMetaArray.length; i++) {
				if ( !userEditableOnly || optionsMetaArray[i]["modifyType"].indexOf("user") >=0 ) {
					options[ optionsMetaArray[i]["name"] ] = angular.copy( optionsMetaArray[i]["defaultVal"] );
				}
			}
			return options;
		},
		getChartOptionsMetaArray: function(optionsMeta, userEditableOnly) {
			var optionsMetaArray = [];
			if (typeof userEditableOnly != "boolean")
				userEditableOnly = false;
			for (var key in optionsMeta) {
				if ( !userEditableOnly || optionsMeta[key]["modifyType"].indexOf("user") >=0 ) {
					var item = optionsMeta[key];
					item["name"] = key;
					optionsMetaArray.push( item );
				}
			}
			
			optionsMetaArray.sort(function(x, y) {
				if ( angular.isNumber( x.ord ) ) {
					if ( angular.isNumber( y.ord ) ) {
						return x.ord - y.ord;
					}
					else {
						return -1;
					}
				}
				else {
					if ( angular.isNumber( y.ord ) ) {
						return 1;
					}
					else {
						return 0;
					}
				}
			});
			
			return optionsMetaArray;
		},
		getNonEmptyGroups: function(optionGroups, optionsMeta) {
			var usedGroups = [],
				result = [];
			for (var i=0; i<optionsMeta.length; i++) {
				if ( optionsMeta[i]["modifyType"].indexOf("user") >=0 && angular.isString( optionsMeta[i]["group"] ) ) {
					usedGroups.push( optionsMeta[i]["group"] );
				}
			}
			for (var i=0; i<optionGroups.length; i++) {
				if ( usedGroups.indexOf( optionGroups[i]["name"] ) >= 0 ) {
					result.push( optionGroups[i] );
				}
			}
			return result;
		},
		filterByGroupFn: function(groupName) {
			return function(value, index) {
				return value["group"] == groupName;
			};
		}
	};
}]);