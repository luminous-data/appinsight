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
	.controller("WidgetCtrl", [
		"$scope", "$interval", "Utils", function(
		 $scope,   $interval,   Utils) {
	$scope.formattedData = [];
			
	$scope.changeWidgetType = function() {
		$scope.widgetApi.changeWidgetType( $scope.config.guid );
	};
	
	$scope.editWidget = function() {
		$scope.widgetApi.editWidget( $scope.config.guid );
	};
	
	$scope.editMetric = function() {
		$scope.widgetApi.editMetric( $scope.config.guid );
	};
	
	$scope.removeWidget = function() {
		for (var i=0; i<$scope.config["metric"].length; i++) {
			$interval.cancel( $scope.config["metric"][i]["dataQueryPromise"] );
		}
		$scope.widgetApi.removeWidget( $scope.config.guid );
	};
	
	$scope.move = function(distance) {
		$scope.widgetApi.moveWidget( $scope.config.guid, distance );
	}
	
	var getSeriesAsArray_X_Y = function(metricX, metricY) {
		var series = [], x, y;
		for (var j=0; j<$scope.config["data"].length; j++) {
			x = $scope.config["data"][j][ metricX ];
			y = $scope.config["data"][j][ metricY ];
			series.push( [x,y] );
		}
		return series;
	};
	
	var getSeriesAsArray_X_Y_SIZE = function(metricX, metricY, metricSize) {
		var series = [], x, y, size;
		for (var j=0; j<$scope.config["data"].length; j++) {
			x	= $scope.config["data"][j][ metricX ];
			y 	= $scope.config["data"][j][ metricY ];
			size= $scope.config["data"][j][ metricSize ]
			series.push( [x,y,size] );
		}
		return series;
	};
	
	var formatData = function(seriesId, dataStore) {
		var idx = -1;
		// does the series already exist in formatted data array?
		for (var i=0; i<dataStore.length; i++) {
			if (dataStore[i].internalId === seriesId) {
				idx = i;
				break;
			}
		}
		
		// insert new data
		if ($scope.config["type"] == "pie" || $scope.config["type"] == "sparkline") {
			if (idx < 0) { //new series - add it
				dataStore.push({
					internalId:	seriesId,
					values:		$scope.config["data"][seriesId]
				});
			}
			else { //existing series - just swap the data
				dataStore[idx]["values"] = angular.copy( $scope.config["data"][seriesId] )
			}
		}
		else {
			if (idx < 0) { //new series - add it
				dataStore.push({
					internalId:	seriesId,
					key:		$scope.config["data"][seriesId]["name"], 
					values:		$scope.config["data"][seriesId]["values"]
				});
			}
			else { //existing series - just swap the data
				dataStore[idx]["key"]    = $scope.config["data"][seriesId]["name"];
				dataStore[idx]["values"] = $scope.config["data"][seriesId]["values"];
			}
		}
	};
	
	var formatXTicks = function() {
		var values = [];
		for (var i=0; i<$scope.config["data"].length; i++) {
			for (var j=0; j<$scope.config["data"][i].length; j++) {
				values.push($scope.config["data"][i][j][0]);
			}
		}
		return values;
	};
	
	$scope.$watch("config['metric']", function() {
		// preparatory code: getDataFn and getDataAggregateFn functions
		var getDataFn = function(metricIdx) {
			return function() {
				var params = {
					metricGuid: $scope.config["metric"][metricIdx]["guid"],
					collection: $scope.config["metric"][metricIdx]["collection"],
					field:		$scope.config["metric"][metricIdx]["field"],
					attribute:	$scope.config["metric"][metricIdx]["attribute"],
					timestampField: "@timestamp",
					success: function(data, status, header, config) {
						if (typeof $scope.config["metric"][metricIdx] == "undefined")
							return;
						
						var metricGuid = config["metricGuid"],
							metricName = $scope.config["metric"][metricIdx]["name"];
						if (data.length == 1) {
							if (typeof $scope.config["data"][metricGuid] == "undefined") {
								data[0]["name"] = metricName;
								$scope.config["data"][metricGuid] = data[0];
							}
							else {
//								if ($scope.config["data"][metricGuid]["values"].length >= 20)
//									$scope.config["data"][metricGuid]["values"].shift();
//								$scope.config["data"][metricGuid]["values"].push( data[0]["values"][0] );
								if ($scope.config["data"][metricGuid]["values"].length >= 20) {
									var newData = angular.copy( $scope.config["data"][metricGuid]["values"] );
									newData.shift().push( data[0]["values"][0] );
									$scope.config["data"][metricGuid]["values"] = newData;
								}
								else {
									$scope.config["data"][metricGuid]["values"].push( data[0]["values"][0] );
								}
							}
							formatData(metricGuid, $scope.formattedData);
						}
						else {
							for (var i=0; i<data.length; i++) {
								var seriesName = data[i]["name"],
									seriesId   = metricGuid + "__" + seriesName;
								if (typeof $scope.config["data"][seriesId] == "undefined") {
									if (metricName != null && metricName.trim() != "")
										data[i]["name"] = metricName + " " + seriesName;
									$scope.config["data"][seriesId] = data[i];
								}
								else {
									if ($scope.config["data"][seriesId]["values"].length >= 20)
										$scope.config["data"][seriesId]["values"].shift();
									$scope.config["data"][seriesId]["values"].push( data[i]["values"][0] );
								}
								formatData(seriesId, $scope.formattedData);
							}
						}
						
//						if (typeof $scope.config.transientCfg["xForceValues"] != "undefined") {
//							//xForceValues should go before change of formattedData, because changing formattedData automatically updates the chart completely, including axis ticks
//							$scope.config.transientCfg["xForceValues"] = formatXTicks();
//						}
						
						// force chart redraw
						$scope.config.transientCfg["version"]++;
					},
					error: function(error) {}
				};
				
				if (typeof $scope.config["metric"][metricIdx]["searchTerm"] != "undefined" && $scope.config["metric"][metricIdx]["searchTerm"] != "")
					params["searchTerm"] = $scope.config["metric"][metricIdx]["searchTerm"];
				
				$scope.widgetApi.getData(params);
			};
		};
		
		var getDataAggregateFn = function(i) {
			return function() {
				var params = {
					metricGuid: $scope.config["metric"][i]["guid"],
					collection: $scope.config["metric"][i]["collection"],
					field:		$scope.config["metric"][i]["field"], // e.g. "bytes", 
					attribute:	$scope.config["metric"][i]["attribute"], // e.g. "avg", 
					timestampField: "@timestamp",
					success: function(data, status, header, config) {
						var metricGuid = config["metricGuid"],
							metricIdx  = Utils.getIndexByGuid(metricGuid, $scope.config["metric"]),
							metricName = $scope.config["metric"][metricIdx]["name"];
						if (data.length == 1) {
							data[0]["name"] = metricName;
							$scope.config["data"][metricGuid] = data[0];
							formatData(metricGuid, $scope.formattedData);
						}
						else {
							for (var i=0; i<data.length; i++) {
								var seriesName = data[i]["name"],
									seriesId   = metricGuid + "__" + seriesName;
								if (metricName != null && metricName.trim() != "")
									data[i]["name"] = metricName + " " + seriesName;
								$scope.config["data"][ seriesId ] = data[i];
								formatData(seriesId, $scope.formattedData);
							}
						}
						// force chart redraw
						$scope.config.transientCfg["version"]++;
					},
					error: function(error) {}	
				};
				
				if (typeof $scope.config["metric"][i]["searchTerm"] != "undefined" && $scope.config["metric"][i]["searchTerm"] != "")
					params["searchTerm"] = $scope.config["metric"][i]["searchTerm"];
				
				$scope.widgetApi.getDataAggregate(params);
			};
		};
		
		// the main part of the function
		
		if ( !angular.isObject( $scope.config["data"] ) )
			$scope.config["data"] = {};
		
		// remove metrics that has been deleted by user
		var newGuidList = [],
			newFormattedData = [];
		for (var i=0; i<$scope.config["metric"].length; i++)
			newGuidList.push( $scope.config["metric"][i]["guid"] );
		for (var i=0; i<$scope.formattedData.length; i++) {
			var guid = $scope.formattedData[i]["internalId"].split("__")[0];
			if (newGuidList.indexOf(guid) >= 0)
				newFormattedData.push( $scope.formattedData[i] );
		}
		$scope.formattedData = newFormattedData;
		
		// get new data
		for (var i=0; i<$scope.config["metric"].length; i++) {
			var dataFunction = getDataFn(i), // for single value
				initDataFunction = getDataAggregateFn(i); // for set of values
			// get initial set of data
			initDataFunction();
			// clear existing data intervals and start new interval for periodic fetching of single data value
			if ( angular.isDefined( $scope.config["metric"][i]["dataQueryPromise"] ) )
				$interval.cancel( $scope.config["metric"][i]["dataQueryPromise"] );
			$scope.config["metric"][i]["dataQueryPromise"] = $interval(dataFunction, 15000);
		}
	});
	
	$scope.$watch("config['specific']['width']", function(newVal) {
		$scope.config["panelStyle"]["width"] = newVal + "%";
	});
	
}]);

angular.module("insightal.charts")
	.controller("WidgetStaticCtrl", [
		"$scope", "Utils", function(
		 $scope,   Utils) {
	$scope.formattedData = [];
		
	$scope.editWidget = function() {
		$scope.widgetApi.editWidget( $scope.config.guid );
	};
	
	$scope.editMetric = function() {
		$scope.widgetApi.editMetric( $scope.config.guid );
	};
	
	$scope.removeWidget = function() {
		$scope.widgetApi.removeWidget( $scope.config.guid );
	};
	
	$scope.move = function(distance) {
		$scope.widgetApi.moveWidget( $scope.config.guid, distance );
	}
	
	var formatData = function(seriesId, dataStore) {
		var idx = -1;
		// does the series already exist in formatted data array?
		for (var i=0; i<dataStore.length; i++) {
			if (dataStore[i].internalId === seriesId) {
				idx = i;
				break;
			}
		}
		
		// insert new data
		if ($scope.config["type"] == "pie" || $scope.config["type"] == "sparkline") {
			if (idx < 0) { //new series - add it
				dataStore.push({
					internalId:	seriesId,
					values:		$scope.config["data"][seriesId]
				});
			}
			else { //existing series - just swap the data
				dataStore[idx]["values"] = angular.copy( $scope.config["data"][seriesId] )
			}
		}
		else {
			if (idx < 0) { //new series - add it
				dataStore.push({
					internalId:	seriesId,
					key:		$scope.config["data"][seriesId]["name"], 
					values:		$scope.config["data"][seriesId]["values"]
				});
			}
			else { //existing series - just swap the data
				dataStore[idx]["key"]    = $scope.config["data"][seriesId]["name"];
				dataStore[idx]["values"] = $scope.config["data"][seriesId]["values"];
			}
		}
	};
	
	var formatXTicks = function() {
		var values = [];
		for (var i=0; i<$scope.config["data"].length; i++) {
			for (var j=0; j<$scope.config["data"][i].length; j++) {
				values.push($scope.config["data"][i][j][0]);
			}
		}
		return values;
	};
	
	$scope.$watch("config['metric']", function() {
		// preparatory code
		var getDataAggregateFn = function(i) {
			return function() {
				var params = {
					metricGuid: $scope.config["metric"][i]["guid"],
					collection: $scope.config["metric"][i]["collection"],
					field:		$scope.config["metric"][i]["field"], // e.g. "bytes", 
					attribute:	$scope.config["metric"][i]["attribute"], // e.g. "avg", 
					startTime:	$scope.config["startDate"],
					endTime:	$scope.config["endDate"],
					timestampField: "@timestamp",
					success: function(data, status, header, config) {
						var metricGuid = config["metricGuid"],
							metricIdx  = Utils.getIndexByGuid(metricGuid, $scope.config["metric"]),
							metricName = $scope.config["metric"][metricIdx]["name"];
						if (data.length == 1) {
							data[0]["name"] = metricName;
							$scope.config["data"][metricGuid] = data[0];
							formatData(metricGuid, $scope.formattedData);
						}
						else {
							for (var i=0; i<data.length; i++) {
								var seriesName = data[i]["name"],
									seriesId   = metricGuid + "__" + seriesName;
								if (metricName != null && metricName.trim() != "")
									data[i]["name"] = metricName + " " + seriesName;
								$scope.config["data"][ seriesId ] = data[i];
								formatData(seriesId, $scope.formattedData);
							}
						}
						// force chart redraw
						$scope.config.transientCfg["version"]++;
					},
					error: function(error) {}	
				};
				
				if (typeof $scope.config["metric"][i]["searchTerm"] != "undefined" && $scope.config["metric"][i]["searchTerm"] != "")
					params["searchTerm"] = $scope.config["metric"][i]["searchTerm"];
				
				$scope.widgetApi.getDataAggregate(params);
			};
		};
		
		// the main part of the function
		
		if ( !angular.isObject( $scope.config["data"] ) )
			$scope.config["data"] = {};
		
		// remove metrics that has been deleted by user
		var newGuidList = [],
			newFormattedData = [];
		for (var i=0; i<$scope.config["metric"].length; i++)
			newGuidList.push( $scope.config["metric"][i]["guid"] );
		for (var i=0; i<$scope.formattedData.length; i++) {
			var guid = $scope.formattedData[i]["internalId"].split("__")[0];
			if (newGuidList.indexOf(guid) >= 0)
				newFormattedData.push( $scope.formattedData[i] );
		}
		$scope.formattedData = newFormattedData;
		
		// get new data
		for (var i=0; i<$scope.config["metric"].length; i++) {
			// get initial set of data
			var initDataFunction = getDataAggregateFn(i);
			initDataFunction();
		}
	});
	
	$scope.$watch("config['specific']['width']", function(newVal) {
		$scope.config["panelStyle"]["width"] = newVal + "%";
	});

}]);