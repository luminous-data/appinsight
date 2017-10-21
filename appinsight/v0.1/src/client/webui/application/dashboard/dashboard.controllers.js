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
	.controller("DashboardCtrl", [
		"$scope", "$rootScope", "$modal", "$interval", "$timeout", "$state", "$stateParams", "$window", "$q", "Dashboard", "DashboardCharts", "DataService", "Sensor", "Auth", "UiMessage", "InChartUtils", "Utils", function(
		 $scope,   $rootScope,   $modal,   $interval,   $timeout,   $state,   $stateParams,   $window,   $q,   Dashboard,   DashboardCharts,   DataService,   Sensor,   Auth,   UiMessage,   InChartUtils,   Utils) {
	$scope.applicationList = [];
	$scope.applicationFields = {};
	$scope.sensorList = [];
	$scope.dashboard = null;
	$scope.dashboardList = [];
	$scope.widgetList = [];
	
	$scope.isInitializing = false;
	$scope.hasUnsavedChanges = false;
	
	$scope.chartRefreshInterval = 15000;
	
	// attach event handlers
	$scope.$on("$viewContentLoaded", function(event) {
		if (!$scope.isInitializing) {
			$scope.isInitializing = true;
			DataService.listApplications({
				tenantId: Auth.user["tenantId"],
				success: function(appList) {
					$scope.applicationList = appList;
					DataService.getApplicationFields({
						applicationList: appList,
						success: function(data) {
							$scope.applicationFields = data;
						},
						error: function(error) {}
					});
				},
				error: function(error) {}
			});
			
			Dashboard.list({
				success: function(data, status, headers, httpConfig) {
					var dashboardList = data["dashboards"];
					for (var k=0; k<dashboardList.length; k++) {
						var guid = dashboardList[k][0],
							dashboard = Utils.parseJSON(dashboardList[k][2]),
							pos  = Utils.getIndexByGuid( guid, $scope.dashboardList );
						// TODO: change API function to include GUID straight away
						dashboard["guid"] = guid;
						
						if (pos >= 0) {
							$scope.dashboardList[pos] = dashboard;
						}
						else {
							$scope.dashboardList.push( dashboard );
						}
					}
					if (dashboardList.length > 0) {
						$scope.displayDashboard( $stateParams["guid"] );
					}
				},
				error: function(data, status, headers, httpConfig) {
					var message = (typeof data["message"] == "undefined")? "---" : data["message"];
					UiMessage.add("danger", "An error occured when listing user's dashboards.\nMessage: " + message);
				}
			});
			
			// TODO: replace with Sensor.list - collectionId is needed here
			Sensor.getAll()
			.then(function(result) {
				var results = result.data["results"],
					sensors = [];
				for (var key in results)
					sensors.push( results[key] );
				$scope.sensorList = sensors;
			})
			.catch(function(result) {
				console.error(result.data)
			});
		};
    });
	
	$scope.$on("$destroy", function() {
		clearAllDataQueryIntervals();
	    $window.onbeforeunload = null;
	});
	
	var unsavedChangesHandler = function(event, next, current) {
		if (!$scope.hasUnsavedChanges)
			return undefined;
		
		if (typeof next == "undefined") {
			return "There are unsaved changes in the dashboard which will be lost if you leave this page.\nAre you sure you want to navigate away?";
		}
		else {
			var answer = confirm("There are unsaved changes in the dashboard which will be lost if you leave this page.\nAre you sure you want to navigate away?");
			if (!answer) {
				event.preventDefault();
			}
		}
	};
	
	$window.onbeforeunload = unsavedChangesHandler;
	$scope.$on("$stateChangeStart", unsavedChangesHandler);
    
	$scope.dashboardConfigMeta = [
		{name:"name",			type:"string",	defaultVal:null,	title:"Name",			modifyType:["user"],	configType:"text"},
		{name:"description",	type:"string",	defaultVal:null,	title:"Description",	modifyType:["user"],	configType:"textArea"},
		{name:"rowHeight",		type:"integer",	defaultVal:300,		title:"Chart Height",	modifyType:["user"],	configType:"text",		userInfo:"Sets height of all charts (in pixels)."},
		{name:"guid",			type:"string",	defaultVal:null,	title:"",				modifyType:["script"],	configType:null},
		{name:"user",			type:"object",	defaultVal:null,	title:"",				modifyType:["script"],	configType:null},
		{name:"active",			type:"string",	defaultVal:1,		title:"",				modifyType:["script"],	configType:null},
		{name:"creationDate",	type:"date",	defaultVal:null,	title:"",				modifyType:["script"],	configType:null},
		{name:"modificationDate",type:"date",	defaultVal:null,	title:"",				modifyType:["script"],	configType:null},
//		{name:"datasources",	type:"array",	defaultVal:[],		title:"",				modifyType:["script"],	configType:null},
		{name:"widgets",		type:"array",	defaultVal:[],		title:"",				modifyType:["script"],	configType:null},
		{name:"transientCfg",	type:"object",	defaultVal:{},		title:"",				modifyType:["script"],	configType:null}
	];
	
	$scope.dashboardConfigMetaTransient = [
  	];
	
	$scope.datasourceConfigCommon = [
		{name:"name",			type:"string",	defaultVal:null,	title:"Name",			modifyType:["user"],	configType:"text"},
		{name:"type",			type:"string",	defaultVal:null,	title:"Type",			modifyType:["script"],	configType:"selectOne"},
		{name:"typeName",		type:"string",	defaultVal:null,	title:"",				modifyType:["script"],	configType:null},
		{name:"guid",			type:"string",	defaultVal:null,	title:"",				modifyType:["script"],	configType:null},
		{name:"getDataFn",		type:"function",defaultVal:null,	title:"",				modifyType:["script"],	configType:null},
		{name:"specific",		type:"object",	defaultVal:{},		title:"",				modifyType:["script"],	configType:null}
	];
	
	$scope.openEditDashboardModal = function() {
		var modalInstance = $modal.open({
    		templateUrl: "partials/editDashboardModal.html",
    		controller: "editDashboardModalCtrl as modal",
    		scope: $scope
    	});

		modalInstance.result.then(
			function(config) {
				angular.extend( $scope.dashboard, config );
				$scope.hasUnsavedChanges = true;
			}
		);
		
		return false;
	};
	
	$scope.saveDashboard = function() {
		var dashboard = angular.copy( $scope.dashboard ),
			charts = [];
		for (var i=0; i<$scope.widgetList.length; i++) {
			charts[i] = ($scope.widgetList[i].api["getPersistentOptions"])();
			for (var j=0; j<charts[i]["series"].length; j++) {
				charts[i]["series"][j]["data"] = [];
				delete charts[i]["series"][j]["dataQueryPromise"];
			}
//			console.debug("CHART " + i);
//			console.debug(charts[i]);
		}
		dashboard.widgets = charts;
		dashboard.transientCfg = {};
		Dashboard.update({
			guid: dashboard["guid"],
			dashboard: dashboard,
			success: function() {
				UiMessage.add("success", "Dashboard " + dashboard.name + " has been saved.");
				$scope.hasUnsavedChanges = false;
//				$rootScope.$broadcast("dashboardChanged");
			},
			error: function() {
				UiMessage.add("danger", "An error occured when saving dashboard " + dashboard.name + ".");
			}
		});
		
		return false;
	};
	
	$scope.removeDashboard = function() {
		var dashboardToDelete = angular.copy( $scope.dashboard );
		
		var modalInstance = $modal.open({
    		templateUrl: "partials/removeDashboardModal.html",
    		controller: "removeDashboardModalCtrl",
    		scope: $scope,
    		resolve: {
    			modalData: function() {
	    			return {
	    				dashboard: dashboardToDelete
	    			};
	    		}
    		}
    	});

		modalInstance.result.then(
			function() {
				Dashboard.delete({
					dashboardGuid: dashboardToDelete["guid"],
					success: function() {
//						var idx = Utils.getIndexByGuid( dashboardToDelete["guid"], $scope.dashboardList );
						clearAllDataQueryIntervals();
						$scope.widgetList = [];
						$scope.dashboard = null;
//						$scope.dashboardList.splice(idx, 1);
						UiMessage.add("success", "Dashboard " + dashboardToDelete["name"] + " has been deleted.");
//						$rootScope.$broadcast("dashboardDeleted");
						$state.go("user.dashboardList");
					},
					error: function() {
						UiMessage.add("danger", "An error occured when deleting dashboard " + dashboardToDelete["name"] + ".");
						$scope.dashboard = angular.copy( dashboardToDelete );
						$scope.widgetList = angular.copy( dashboardToDelete.widgets );
					}
				});
				$scope.dashboard = null;
				$scope.widgetList = [];
			}
		);
		
		return false;
	};
	
	$scope.displayDashboard = function(guid) {
		var idx			= Utils.getIndexByGuid(guid, $scope.dashboardList),
			dashboard	= angular.copy( $scope.dashboardList[idx] ),
			widgetList	= angular.copy( $scope.dashboardList[idx].widgets );
		for (var i=0; i<$scope.dashboardConfigMetaTransient.length; i++) {
			dashboard["transientCfg"][ $scope.dashboardConfigMetaTransient[i]["name"] ] = $scope.dashboardConfigMetaTransient[i]["defaultVal"];
		}
		clearAllDataQueryIntervals();
		for (var i=0; i<widgetList.length; i++) {
			// eventXAxisSetExtremes doesn't do anything so far
			widgetList[i]["eventXAxisSetExtremes"] = $scope.zoomDataFn( widgetList[i]["guid"] );
//			widgetList[i]["version"] = 0;
		}
		
		$scope.dashboard = dashboard;
		$scope.widgetList = widgetList;
		
		for (var i=0; i<widgetList.length; i++) {
			for (var j=0; j<widgetList[i]["series"].length; j++) {
				if ( !angular.isArray( widgetList[i]["series"][j]["data"] ) ) {
					widgetList[i]["series"][j]["data"] = [];
				}
			}
			startChartData( widgetList[i] );
//			$timeout((function(idx) {
//				return function() {
//					widgetList[idx].apiStack.push( {fn:"reflowChart", args:[]} );
//					widgetList[idx].apiStack.idx++;
//				};
//			})(i), 2000);
		
		}
	};
	
	var prepareDashboardConfig = function() {
		var config			= {},
			configTransient	= {},
			commonConfig			= angular.copy( $scope.dashboardConfigMeta ),
			commonConfigTransient	= angular.copy( $scope.dashboardConfigMetaTransient );
		
		for (var i=0; i<commonConfig.length; i++) {
			config[ commonConfig[i].name ] = commonConfig[i].defaultVal;
		}
		for (var i=0; i<commonConfigTransient.length; i++) {
			configTransient[ commonConfigTransient[i].name ] = commonConfigTransient[i].defaultVal;
		}
		
		config["transientCfg"] = configTransient;
		return config;
	};
	
	$scope.prepareDatasourceConfigCommon = function() {
		var config = {},
			commonConfig = angular.copy( $scope.datasourceConfigCommon );
		for (var i=0; i<commonConfig.length; i++) {
			config[ commonConfig[i].name ] = commonConfig[i].defaultVal;
		}
		
		return config;
	};
	
	var clearAllDataQueryIntervals = function() {
		for (var i=0; i<$scope.widgetList.length; i++) {
			for (var j=0; j<$scope.widgetList[i]["series"].length; j++) {
				$interval.cancel( $scope.widgetList[i]["series"][j]["dataQueryPromise"] );
			}
		}
	};
	
/*
 * WIDGETS
 */
	
	var xFn = function(widgetGuid) {
		return function(d) {
			return d[0];
		};
	};
	
	var yFn = function(widgetGuid) {
		return function(d) {
			return d[1];
		};
	};
	
	var sizeFn = function(widgetGuid) {
		return function(d) {
			if (typeof d[2] === "undefined")
				return 0.1; // default datapoint size
			else
				return d[2];
		};
	};
	
	var colorFn = function(widgetGuid) {
		var widget = Utils.getElementByGuid( widgetGuid, $scope.widgetList );
		return function(d, i) {
			var series = i;
			if (typeof d.series != "undefined")
				series = d.series; // nv.d3 charts don"t use the "i" argument consistently, some use d.series instead
			if (typeof widget["metric"][series].color === "undefined")
				return $scope.colors[series].hex // no color defined
			else
				return widget["metric"][series].color;
		};
	};
	
    var xAxisTickFormatFn = function(widgetGuid) {
    	var widget = Utils.getElementByGuid( widgetGuid, $scope.widgetList );
    	return function(d){
    		var type = widget.specific["xAxisTickFormatType"]; 
            if (type == "time") {
            	return d3.time.format( widget.specific["xAxisTickFormatTime"] )( new Date(d) );
            }
            else if (type == "") {
            	return d;
            }
            else {
            	var formatStr = type;
            	if (widget.specific["xAxisTickFormatPrecision"] >= 0)
            		formatStr = "." + widget.specific["xAxisTickFormatPrecision"] + formatStr;
            	if (widget.specific["xAxisTickFormatCommaDivide"])
            		formatStr = "," + formatStr;
            	return d3.format( formatStr )(d);
            }
        }
    }

    var yAxisTickFormatFn = function(widgetGuid) {
    	var widget = Utils.getElementByGuid( widgetGuid, $scope.widgetList );
        return function(d) {
            var type = widget.specific["yAxisTickFormatType"]; 
            if (type == "time") {
            	return d3.time.format( widget.specific["yAxisTickFormatTime"] )( new Date(d) );
            }
            else if (type == "") {
            	return d;
            }
            else {
            	var formatStr = type;
            	if (widget.specific["yAxisTickFormatPrecision"] >= 0)
            		formatStr = "." + widget.specific["yAxisTickFormatPrecision"] + formatStr;
            	if (widget.specific["yAxisTickFormatCommaDivide"])
            		formatStr = "," + formatStr;
            	return d3.format( formatStr )(d);
            }
        }
    }
    
    $scope.chartOptionsAddMeta = {
		title:		{ord: 1,	type:"string",		group:"general",	defaultVal:null,	title:"",				modifyType:["script"],	configType:"text"},
    	position:	{ord: 2,	type:"int",			group:"general",	defaultVal:-1,		title:"",				modifyType:["script"],	configType:"text"},
		panelStyle:	{ord: 3,	type:"object",		group:"general",	defaultVal:{},		title:"",				modifyType:["script"],	configType:"text"},
		width:		{ord: 4,	type:"int",			group:"general",	defaultVal:50,		title:"Chart Width",	modifyType:["user"],	configType:"selectOne", values:[{value:50,label:"50%"}, {value:100,label:"100%"}]}
//		text: 			{ord: 5,	type:"float",		group:"general",	defaultVal:null,	title:"Text Option",				modifyType:["user"],	configType:"text"},
//		textArea:		{ord: 6,	type:"string",		group:"general",	defaultVal:null,	title:"Text Area Option",			modifyType:["user"],	configType:"textArea"},
//		selectOne:		{ord: 7,	type:"string",		group:"general",	defaultVal:null,	title:"Select One Option",			modifyType:["user"],	configType:"selectOne",		values:[{value:"mon",label:"Monday"},{value:"tue",label:"Tuesday"},{value:"wed",label:"Wednesday"}]},
//		selectOneRadio:	{ord: 8,	type:"int",			group:"general",	defaultVal:1,		title:"Select One Radio Option",	modifyType:["user"],	configType:"selectOneRadio",values:[{value:1,label:"January"},{value:2,label:"February"},{value:3,label:"March"}]},
//		selectMultiple:	{ord: 9,	type:"array<string>",group:"general",	defaultVal:[],		title:"Select Multiple Option",		modifyType:["user"],	configType:"selectMultiple",values:[{value:"banana",label:"Banana"},{value:"orange",label:"Orange"},{value:"apple",label:"Apple"}]},
//		selectBoolean:	{ord: 10,	type:"boolean",		group:"general",	defaultVal:null,	title:"Select Boolean Option",		modifyType:["user"],	configType:"selectBoolean"},
//		integer:		{ord: 11,	type:"int",			group:"general",	defaultVal:null,		title:"Select Integer Option",		modifyType:["user"],	configType:"integer"},
//		integerRange:	{ord: 12,	type:"int",			group:"general",	defaultVal:null,		title:"Select Integer Range Option",modifyType:["user"],	configType:"integerRange", valueMin:10, valueMax:1500},
//		color:			{ord: 13,	type:"string",		group:"general",	defaultVal:null,		title:"Select Color Option",		modifyType:["user"],	configType:"color"}
    };
    
    $scope.colors = [
 		{name:"Aqua", hex:"#00FFFF"},
 		{name:"Black", hex:"#000000"},
 		{name:"Blue", hex:"#0000FF"},
 		{name:"Brown", hex:"#A52A2A"},
 		{name:"Chartreuse", hex:"#7FFF00"},
 		{name:"Coral", hex:"#FF7F50"},
 		{name:"Dark Blue", hex:"#00008B"},
 		{name:"Dark Green", hex:"#006400"},
 		{name:"Dark Orange", hex:"#FF8C00"},
 		{name:"Dim Gray", hex:"#696969"},
 		{name:"Dodger Blue", hex:"#1E90FF"},
 		{name:"Gold", hex:"#FFD700"},
 		{name:"Green", hex:"#008000"},
 		{name:"Green Yellow", hex:"#ADFF2F"},
 		{name:"Magenta", hex:"#FF00FF"},
 		{name:"Orange", hex:"#FFA500"},
 		{name:"Orange Red", hex:"#FF4500"},
 		{name:"Orchid", hex:"#DA70D6"},
 		{name:"Red", hex:"#FF0000"},
 		{name:"Royal Blue", hex:"#4169E1"},
 		{name:"Yellow", hex:"#FFFF00"},
 		{name:"Yellow Green", hex:"#9ACD32"}
 	];
    
	// performs additional modifications of chart options, returned from add/edit widget modal dialog
	// before they're used to create new chart 
	var transformOptionsBeforeDisplay = function(chartOptions) {
		if ( !angular.isString( chartOptions["guid"] ) || chartOptions["guid"] == "" )
			chartOptions["guid"] = Utils.generateUUID();
		if (chartOptions["add"]["position"] < 0)
			chartOptions["add"]["position"] = $scope.widgetList.length;
		chartOptions["add"]["title"] = chartOptions["title"]; // the title is displayed by the outer page, not the chart itself -> we move the title to additional options
		chartOptions["title"] = null; // remove chart's own title, so that it's not displayed inside the chart
//		chartOptions["add"]["panelStyle"]["width"] = chartOptions["add"]["width"] + "%";
		return chartOptions;
	};
	
 	$scope.removeWidget = function(guid) {
    	var idx = Utils.getIndexByGuid(guid, $scope.widgetList);
    	for (var i=0; i<$scope.widgetList[idx]["series"].length; i++) {
			$interval.cancel( $scope.widgetList[idx]["series"][i]["dataQueryPromise"] );
		}
    	$scope.widgetList.splice(idx, 1);
    	$scope.hasUnsavedChanges = true;
    };
    
    $scope.openEditChartModal = function() {
    	if ($scope.dashboard != null) {
	    	var modalInstance = $modal.open({
	    		templateUrl: "partials/editChartModal.html",
	    		controller: "editChartModalCtrl as modal",
	    		scope: $scope,
	    		resolve: {
		    		modalData: function() {
		    			return {
		    				action:				"add",
		    				applicationList:	angular.copy( $scope.applicationList ),
		    				applicationFields:	angular.copy( $scope.applicationFields ),
		    				sensorList:			angular.copy( $scope.sensorList ),
		    				chartOptionsAddMeta:angular.copy( $scope.chartOptionsAddMeta )
		    			};
		    		}
	    		}
	    	});
	
			modalInstance.result.then(
				function(chartOptions) {
					chartOptions = transformOptionsBeforeDisplay(chartOptions);
					$scope.widgetList.push(chartOptions);
					$scope.hasUnsavedChanges = true;
					startChartData(chartOptions);
				}
			);
    	}
		
		return false;
    };
    
    $scope.editWidget = function(guid) {
    	var idx = Utils.getIndexByGuid(guid, $scope.widgetList);
    	var modalInstance = $modal.open({
    		templateUrl: "partials/editChartModal.html",
    		controller: "editChartModalCtrl as modal",
    		scope: $scope,
    		resolve: {
	    		modalData: function() {
	    			return {
	    				action:				"edit",
	    				applicationList:	angular.copy( $scope.applicationList ),
	    				applicationFields:	angular.copy( $scope.applicationFields ),
	    				sensorList:			angular.copy( $scope.sensorList ),
	    				chartOptionsAddMeta:angular.copy( $scope.chartOptionsAddMeta ),
	    				chartOptions:		angular.copy( $scope.widgetList[idx] )
	    			};
	    		}
	    	}
    	});

		modalInstance.result.then(
			function(chartOptions) {
				for (var i=0; i<$scope.widgetList[idx]["series"].length; i++) {
					$interval.cancel( $scope.widgetList[idx]["series"][i]["dataQueryPromise"] );
				}
				chartOptions = transformOptionsBeforeDisplay(chartOptions);
				$scope.widgetList[idx] = chartOptions;
				$scope.widgetList[idx]["version"]++;
				startChartData(chartOptions);
				$scope.hasUnsavedChanges = true;
			}
		);
    };
    
//    $scope.editMetric = function(guid) {
//    	var idx = Utils.getIndexByGuid(guid, $scope.widgetList),
//    		options = angular.copy( $scope.widgetList[idx] ),
//    		optionsMeta = InChartUtils.getChartOptionsMetaArray({ chartType:options["type"], editableBy:"user" });
//    	var modalInstance = $modal.open({
//    		templateUrl: "partials/editMetricModal.html",
//    		controller: "editMetricModalCtrl as modal",
//    		scope: $scope,
//    		resolve: {
//	    		modalData: function() {
//	    			return {
//	    				options:			options,
//	    				optionsMeta:		optionsMeta,
//	    				applicationList:	angular.copy( $scope.applicationList ),
//	    				applicationFields:	angular.copy( $scope.applicationFields )
//	    			};
//	    		}
//    		}
//    	});
//
//		modalInstance.result.then(
//			function(options) {
//				for (var i=0; i<$scope.widgetList[idx]["series"].length; i++) {
//					$interval.cancel( $scope.widgetList[idx]["series"][i]["dataQueryPromise"] );
//				}
//				$scope.widgetList[idx]["series"]["metric"] = [];
//				angular.extend( $scope.widgetList[idx], options );
//				$scope.widgetList[idx]["series"]["data"] = {};
//				$scope.widgetList[idx]["version"]++;
//				startChartData( $scope.widgetList[idx] );
//				$scope.hasUnsavedChanges = true;
//			}
//		);
//    };
    
    $scope.moveWidget = function(guid, distance) {
    	var	min, max, step,
    		length	= $scope.widgetList.length,
    		idx		= Utils.getIndexByGuid(guid, $scope.widgetList),
    		pos		= $scope.widgetList[idx]["add"]["position"];
    	if (distance == 0) {
    		return;
    	}
    	else if (distance > 0) {
    		min = pos + 1;
    		max = Math.min( pos + distance, length - 1 );
    		step = -1;
    	}
    	else if (distance < 0) {
    		min = Math.max( pos + distance, 0 );
    		max = pos - 1;
    		step = 1;
    	}
    	
    	var getIndexByPosition = function(pos) {
    		for (var i=0; i<length; i++) {
    			if ( $scope.widgetList[i]["add"]["position"] == pos )
    				return i;
    		}
    	};
    	
    	for (var i=min; i<=max; i++) {
    		var idx2 = getIndexByPosition(i);
    		$scope.widgetList[idx2]["add"]["position"] += step;
    	}
    	
    	$scope.widgetList[idx]["add"]["position"] += distance;
    	$scope.hasUnsavedChanges = true;
    };
    
	$scope.getWidgetDefByType = function(type) {
		for (var i=0; i<$scope.widgetTypes.length; i++) {
			if (type == $scope.widgetTypes[i].type)
				return $scope.widgetTypes[i];
		} 
	};
	
	var isSeriesType = function(types, seriesOptions, chartOptions) {
		if ( angular.isString( types ) ) {
			return seriesOptions["type"] == types || (seriesOptions["type"] == "inherit" && chartOptions["type"] == types)
		}
		if ( angular.isArray( types ) ) {
			for (var i=0; i<types.length; i++) {
				if (seriesOptions["type"] == types[i] || (seriesOptions["type"] == "inherit" && chartOptions["type"] == types[i])) {
					return true;
				}
			}
		}
		return false;
	};
	 
	var removeItem = function(idx, array, idxName) {
		for (var i=0; i<array.length; i++) {
			if (array[i][idxName] == idx)
				array.splice(i,1);
		}
	};
	
	var prepareOptionsCommon = function() {
		var config = {},
			commonConfig = angular.copy( $scope.widgetConfigCommon );
		for (var i=0; i<commonConfig.length; i++) {
			config[ commonConfig[i].name ] = commonConfig[i].defaultVal;
		}
		
		return config;
	};
	
	var getDataFn = function(chartGuid, seriesGuid) {
		var chart  = Utils.getElementByGuid(chartGuid, $scope.widgetList),
			series = Utils.getElementByGuid(seriesGuid, chart["series"]),
			namePrefix = (series["name"].length > 0)? series["name"] + " " : "",
			metric	= series["metric"],
			metric2	= series["metric2"],
			metric3	= series["metric3"],
			metricType = metric["type"],
			hasMetric2 = angular.isObject(series["metric2"]) && angular.isString(metric2["application"]) && angular.isString(metric2["collection"])
						&& angular.isString(metric2["document"]) && angular.isString(metric2["field"]) && angular.isString(metric2["attribute"]),
			hasMetric3 = angular.isObject(series["metric3"]) && angular.isString(metric3["application"]) && angular.isString(metric3["collection"])
						&& angular.isString(metric3["document"]) && angular.isString(metric3["field"]) && angular.isString(metric3["attribute"]),
			redrawChart = true,
			shiftChart  = true,
			deferredTotal = $q.defer(),
			iteration = 0,
			intervalStart = (new Date()).getTime(),
			intervalLength = 15000;
			
		// SENSOR
		if ( angular.isString( metricType ) && metricType == "sensor" ) {
			return function() {
				var startDt = new Date( Date.now() - 15000 ),
					endDt   = new Date();
//				startDt.setDate(30); endDt.setDate(30);
//				startDt.setMonth(3); endDt.setMonth(3);
//				startDt.setTime( endDt.getTime() - 60000 );
				
				Sensor.getData({
					sensorId:		metric["sensor"],
					startDateTime:	Utils.dateToStrUtc(startDt),
					endDateTime:	Utils.dateToStrUtc(endDt)
				})
				.then(function(result) {
					if ( angular.isObject( result.data["sensorData"] ) && angular.isArray( result.data["sensorData"]["datapoints"] ) ) {
						var datapoints = result.data["sensorData"]["datapoints"], 
							chartData = Utils.getElementByGuid(series["name"], series["data"], "id");
						for (var i=0; i<datapoints.length; i++) {
							redrawChart = (i == datapoints.length - 1); // redraw when last point is added
							shiftChart = (chartData["values"].length >= (20 - i)); // if chart has less that 20 values, don't remove the oldest data point
							chart.api["addSeriesPoint"](seriesGuid, series["name"], datapoints[i], redrawChart, shiftChart);
						}
					}
				})
				.catch(function(result) {
					console.debug("Get chart data (type sensor) failed.");
					console.error(result);
				});
			};
		}
		// "CLASSICAL" METRIC
		else {
			// success handler that runs when data for all 3 metrics (if defined) have arrived
			// result (input for this function) is an object with structure: {promise1: {data:..., status:..., header:..., config:...}, promise2: {data:..., status:..., header:..., config:...}, promise3: {...the same} }
			var successHandler = function (result) {
				var data, datapoint, chartData;
				iteration++;
				
				if (hasMetric2) {
					var data1 = result.promise1["data"],
						data2 = result.promise2["data"];
					if (data1.length == 0 || data2.length == 0) {
						// do nothing
					}
					// in case there's only one data-series returned, use series name as data-series identifier(name)
					else if (data1.length == 1) {
						datapoint = null;
						if ( series["type"] == "scatter" || (series["type"] == "inherit" && chart["type"] == "scatter") ) {
							datapoint = [ data1[0]["value"][1], data2[0]["value"][1] ];
						}
						else {
							datapoint = [ data1[0]["value"][0], data1[0]["value"][1], data2[0]["value"][1] ];
						}
						
						// add datapoint to data-series
						chartData = Utils.getElementByGuid(series["name"], series["data"], "id");
						shiftChart = (chartData["values"].length >= 20); // if chart has less that 20 values, don't remove the oldest data point
						chart.api["addSeriesPoint"](seriesGuid, series["name"], datapoint, redrawChart, shiftChart);
					}
					// even if a series has only one metric, this metric can return multiple data-series
					else {
	//					if ( series["type"] == "pie" || (series["type"] == "inherit" && chart["type"] == "pie") ) { // we make one series from the last element of multiple series
	//						var pieData = {
	//								name: series["name"],
	//								values: []
	//						};
	//						for (var i=0; i<data.length; i++) {
	//							pieData["values"].push([ data[i]["name"], data[i]["values"][ data[i]["values"].length-1 ][1] ]); // prefix the data-series name with series name (in not empty)
	//						}
	//						chart.api["removeSeriesData"](seriesGuid, series["name"]);
	//						chart.api["addSeries"](seriesGuid, series["name"], pieData);
	//					}
	//					else {
	//						for (var i=0; i<data.length; i++) {
	//							var dataseriesName = data[i]["name"],
	//							chartData = Utils.getElementByGuid(dataseriesName, series["data"], "id");
	//							// the data-series does not exist yet, create it and insert all data there
	//							if (chartData == null) {
	//								data[i]["name"] = namePrefix + data[i]["name"]; 
	//								chart.api["addSeries"](seriesGuid, dataseriesName, data[i]);
	//							}
	//							// if data-series exists, add 1 point
	//							else {
	//								shiftChart = (chartData["values"].length >= 20); // if chart has less that 20 values, don't remove the oldest data point
	//								chart.api["addSeriesPoint"](seriesGuid, dataseriesName, data[i]["values"][0], redrawChart, shiftChart);
	//							}
	//						}
	//					}
					}
				}
				else {
					data = result.promise1["data"];
					if (data.length == 0) {
						// do nothing
					}
					// in case there's only one data-series returned, use series name as data-series identifier(name)
					else if (data.length == 1) {
						datapoint = data[0]["value"];
						chartData = Utils.getElementByGuid(series["name"], series["data"], "id");
						// add datapoint to data-series
						shiftChart = (chartData["values"].length >= 20); // if chart has less that 20 values, don't remove the oldest data point
						chart.api["addSeriesPoint"](seriesGuid, series["name"], datapoint, redrawChart, shiftChart);
					}
					// even if a series has only one metric, this metric can return multiple data-series
					else {
						if ( isSeriesType("pie", series, chart) ) { // we make one series from the last element of multiple series
							var pieData = {
								name: series["name"],
								values: []
							};
							for (var i=0; i<data.length; i++) {
								pieData["values"].push([ data[i]["name"], data[i]["value"][1] ]); // prefix the data-series name with series name (in not empty)
							}
							chart.api["removeSeriesData"](seriesGuid, series["name"]);
							chart.api["addSeries"](seriesGuid, series["name"], pieData);
							// write time to a custom label on the chart
							var dt = new Date( data[0]["value"][0] );
							chart.api["addText"]({
								id:		"customTimeElement",
								text:	"Date and time:<br/>" + Utils.formatDate(dt, "date-fullYear") + "<br/>" + Utils.formatDate(dt, "time-seconds"),
								x:		0,
								y:		0
							});
						}
						else {
							for (var i=0; i<data.length; i++) {
								var chartData = Utils.getElementByGuid(data[i]["name"], series["data"], "id");
								// the data-series does not exist yet, create it and insert all data there
								if (chartData == null) {
									var newDataseries = {
										name:	namePrefix + data[i]["name"],
										values:	[ data[i]["value"] ]
									};
									chart.api["addSeries"](seriesGuid, data[i]["name"], newDataseries);
								}
								// if data-series exists, add 1 point
								else {
									shiftChart = (chartData["values"].length >= 20); // if chart has less that 20 values, don't remove the oldest data point
									chart.api["addSeriesPoint"](seriesGuid, data[i]["name"], data[i]["value"], redrawChart, shiftChart);
								}
							}
						}
					}
				}
				
				deferredTotal.resolve(data);
			};
			
			// error handler that runs when data for all 3 metrics (if defined) have arrived
			// result is an object with structure: {promise1: {data:..., status:..., header:..., config:...}, promise2: {data:..., status:..., header:..., config:...}, promise3: {...the same} }
			var errorHandler = function (result) {
				deferredTotal.reject(result);
			};
			
			// the "main" function itself - it makes 1, 2 or 3 data calls (DataService.getData) and then runs the total success/error-Handler
			return function() {
				
				var dfr = $q.defer(), dfr2 = $q.defer(), dfr3 = $q.defer(), 
					promises = {promise1: dfr.promise, promise2: dfr2.promise, promise3: dfr3.promise},
					startTime	= intervalStart	+ (intervalLength * iteration),
					endTime		= startTime		+  intervalLength;
			
				// API call for metric 1
				var params = {
					collection: metric["collection"],
					field:		metric["field"],
					attribute:	metric["attribute"],
					startTime:	startTime,
					endTime:	endTime,
					timestampField: "@timestamp",
					success: function(data, status, header, config) {
						if (typeof series == "undefined" || typeof metric == "undefined")
							dfr.reject({data:data, status:status, header:header, config:config});						
						else
							dfr.resolve({data:data, status:status, header:header, config:config});
					},
					error: function(data, status, header, config) {
						dfr.reject({data:data, status:status, header:header, config:config});
					}
				};
				if (typeof metric["searchTerm"] != "undefined" && metric["searchTerm"] != "")
					params["searchTerm"] = metric["searchTerm"];
				DataService.getData(params);
				
				// API call for metric 2
				if (hasMetric2) {
					var params2 = {
						collection: metric2["collection"],
						field:		metric2["field"],
						attribute:	metric2["attribute"],
						startTime:	startTime,
						endTime:	endTime,
						timestampField: "@timestamp",
						success: function(data, status, header, config) {
							if (typeof series == "undefined" || typeof metric2 == "undefined")
								dfr2.reject({data:data, status:status, header:header, config:config});						
							else
								dfr2.resolve({data:data, status:status, header:header, config:config});
						},
						error: function(data, status, header, config) {
							dfr2.reject({data:data, status:status, header:header, config:config});
						}
					};
					if (typeof metric2["searchTerm"] != "undefined" && metric2["searchTerm"] != "")
						params2["searchTerm"] = metric2["searchTerm"];
					DataService.getData(params2);
				}
				else {
					dfr2.resolve();
				}
				
				// API call for metric 3
				if (hasMetric3) {
					var params3 = {
						collection: metric3["collection"],
						field:		metric3["field"],
						attribute:	metric3["attribute"],
						startTime:	startTime,
						endTime:	endTime,
						timestampField: "@timestamp",
						success: function(data, status, header, config) {
							if (typeof series == "undefined" || typeof metric3 == "undefined")
								dfr3.reject({data:data, status:status, header:header, config:config});						
							else
								dfr3.resolve({data:data, status:status, header:header, config:config});
						},
						error: function(data, status, header, config) {
							dfr3.reject({data:data, status:status, header:header, config:config});
						}
					};
					if (typeof metric3["searchTerm"] != "undefined" && metric3["searchTerm"] != "")
						params3["searchTerm"] = metric3["searchTerm"];
					DataService.getData(params3);
				}
				else {
					dfr3.resolve();
				}
				
				// wait for all promises to return and then process the data (inside successHandler)
				$q.all(promises)
				.then(successHandler, errorHandler);
				
				return deferredTotal.promise;
			};
		}
	};
	
	var getDataAggregateFn = function(chartGuid, seriesGuid) {
		var chart  = Utils.getElementByGuid(chartGuid, $scope.widgetList),
			series = Utils.getElementByGuid(seriesGuid, chart["series"]),
			namePrefix = (series["name"].length > 0)? series["name"] + " " : "",  
			metric	= series["metric"],
			metric2	= series["metric2"],
			metric3	= series["metric3"],
			metricType = metric["type"],
			hasMetric2 = angular.isObject(series["metric2"]) && angular.isString(metric2["application"]) && angular.isString(metric2["collection"])
						&& angular.isString(metric2["document"]) && angular.isString(metric2["field"]) && angular.isString(metric2["attribute"]),
			hasMetric3 = angular.isObject(series["metric3"]) && angular.isString(metric3["application"]) && angular.isString(metric3["collection"])
						&& angular.isString(metric3["document"]) && angular.isString(metric3["field"]) && angular.isString(metric3["attribute"]),
			deferredTotal = $q.defer();
		
		// SENSOR
		if ( angular.isString( metricType ) && metricType == "sensor" ) {
			return function() {
				var getPastDate = function(timeToSubtract) {
					var timestamp = Date.now();
					if (timeToSubtract === "month")
						timestamp -= 2592000000;
					else if (timeToSubtract === "week")
						timestamp -=  604800000;
					else if (timeToSubtract === "day")
						timestamp -=   86400000;
					else if (timeToSubtract === "hour")
						timestamp -=    3600000;
					else // minute
						timestamp -=      60000;
					return new Date(timestamp);
				};
				
				var startDt = getPastDate( metric["sensorPeriod"] ),
					endDt	= new Date(),
					promise;
//				startDt.setDate(30); endDt.setDate(30);
//				startDt.setMonth(3); endDt.setMonth(3);
//				startDt.setTime( endDt.getTime() - 60000 );
				
				
				promise = Sensor.getData({
					sensorId:		metric["sensor"],
					startDateTime:	Utils.dateToStrUtc(startDt),
					endDateTime:	Utils.dateToStrUtc(endDt)
				});
				
				promise.then(function(result) {
					if ( angular.isObject( result.data["sensorData"] ) && angular.isArray( result.data["sensorData"]["datapoints"] ) ) {
						var seriesData = {
							name:	series["name"],
							values: result.data["sensorData"]["datapoints"]
						};
						chart.api["removeSeriesData"](seriesGuid);
						chart.api["addSeries"](seriesGuid, series["name"], seriesData);
					}
				})
				.catch(function(result) {
					console.debug("Get chart data aggregate (type sensor) failed.");
					console.error(result);
				});
				
				return promise;
			};
		}
		// "CLASSICAL" METRIC
		else {
			// success handler that runs when data for all 3 metrics (if defined) have arrived
			// result is an object with structure: {promise1: {data:..., status:..., header:..., config:...}, promise2: {data:..., status:..., header:..., config:...}, promise3: {...the same} }
			var successHandler = function (result) {
				var data;
				chart.api["removeSeriesData"](seriesGuid);
				
				if (series["metric2Enabled"] && hasMetric2) {
					var data1 = result.promise1["data"],
						data2 = result.promise2["data"];
					// data-series is identified by series name in case there's only one data-series returned,
					// otherwise a name returned inside the data is used
					if (data1.length == 0 || data2.length == 0) {
						// do nothing
					}
					else if (data1.length == 1 && data2.length == 1) {
						data = {
							name: series["name"],
							values: []
						};
						if ( series["type"] == "scatter" || (series["type"] == "inherit" && chart["type"] == "scatter") ) {
							for (var i=0; i<data1[0]["values"].length; i++) {
								data.values.push([ data1[0]["values"][i][1], data2[0]["values"][i][1] ]);
							}
						}
						else {
							for (var i=0; i<data1[0]["values"].length; i++) {
								data.values.push([ data1[0]["values"][i][0], data1[0]["values"][i][1], data2[0]["values"][i][1] ]);
							}
						}
						chart.api["addSeries"](seriesGuid, series["name"], data);
					}
					// although a series has only one metric, this metric can return multiple data-series
					else {
						console.error("Multiple metrics are disabled for queries of type term_count");
	//					if ( series["type"] == "pie" || (series["type"] == "inherit" && chart["type"] == "pie") ) { // we make one series from the last element of multiple series
	//						var pieData = {
	//								name: series["name"],
	//								values: []
	//						};
	//						for (var i=0; i<data.length; i++) {
	//							pieData["values"].push([ data[i]["name"], data[i]["values"][ data[i]["values"].length-1 ][1] ]); // prefix the data-series name with series name (in not empty)
	//						}
	//						chart.api["addSeries"](seriesGuid, series["name"], pieData);
	//					}
	//					else {
	//						for (var i=0; i<data.length; i++) {
	//							var dataseriesName = data[i]["name"];
	//							data[i]["name"] = namePrefix + data[i]["name"]; // prefix the data-series name with series name (in not empty)
	//							chart.api["addSeries"](seriesGuid, dataseriesName, data[i]); // use original data-series name as data-series ID
	//						}
	//					}
					}
				}
				else {
					data = result.promise1["data"];
					// data-series is identified by series name in case there's only one data-series returned,
					// otherwise a name returned inside the data is used
					if (data.length == 0) {
						//do nothing
					}
					else if (data.length == 1) {
						data[0]["name"] = series["name"];
						chart.api["addSeries"](seriesGuid, series["name"], data[0]);
					}
					// although a series has only one metric, this metric can return multiple data-series
					else {
						if ( series["type"] == "pie" || (series["type"] == "inherit" && chart["type"] == "pie") ) { // we make one series from the last element of multiple series
							var pieData = {
									name: series["name"],
									values: []
							};
							for (var i=0; i<data.length; i++) {
								pieData["values"].push([ data[i]["name"], data[i]["values"][ data[i]["values"].length-1 ][1] ]); // prefix the data-series name with series name (in not empty)
							}
							chart.api["addSeries"](seriesGuid, series["name"], pieData);
							// write time to a custom label on the chart
							var dt = new Date( data[0]["values"][ data[0]["values"].length-1 ][0] );
							chart.api["addText"]({
								id:		"customTimeElement",
								text:	"Date and time:<br/>" + Utils.formatDate(dt, "date-fullYear") + "<br/>" + Utils.formatDate(dt, "time-seconds"),
								x:		0,
								y:		0
							});
						}
						else {
							for (var i=0; i<data.length; i++) {
								var dataseriesName = data[i]["name"];
								data[i]["name"] = namePrefix + data[i]["name"]; // prefix the data-series name with series name (in not empty)
								chart.api["addSeries"](seriesGuid, dataseriesName, data[i]); // use original data-series name as data-series ID
							}
						}
					}
				}
				deferredTotal.resolve(data);
			};
			
			// error handler that runs when data for all 3 metrics (if defined) have arrived
			// result is an object with structure: {promise1: {data:..., status:..., header:..., config:...}, promise2: {data:..., status:..., header:..., config:...}, promise3: {...the same} }
			var errorHandler = function (result) {
				deferredTotal.reject(result);
			};
			
			// the "main" function itself - it makes 1, 2 or 3 data calls (DataService.getDataAggregate) and then runs the total success/error-Handler
			return function() {
				var dfr = $q.defer(), dfr2 = $q.defer(), dfr3 = $q.defer(), 
					promises = {promise1: dfr.promise, promise2: dfr2.promise, promise3: dfr3.promise};
				
				// API call for metric 1
				var params = {
					collection: metric["collection"],
					field:		metric["field"], // e.g. "bytes", 
					attribute:	metric["attribute"], // e.g. "avg", 
					timestampField: "@timestamp",
					success: function (data, status, header, config) {
						dfr.resolve({data:data, status:status, header:header, config:config});
					},
					error: function (data, status, header, config) {
						dfr.reject({data:data, status:status, header:header, config:config});
					}
				};
				if ( angular.isString( metric["searchTerm"] ) && metric["searchTerm"] != "" )
					params["searchTerm"] = metric["searchTerm"];
				DataService.getDataAggregate(params);
				
				// API call for metric 2
				if (hasMetric2) {
					var params2 = {
						collection: metric2["collection"],
						field:		metric2["field"], // e.g. "bytes", 
						attribute:	metric2["attribute"], // e.g. "avg", 
						timestampField: "@timestamp",
						success: function (data, status, header, config) {
							dfr2.resolve({data:data, status:status, header:header, config:config});
						},
						error: function (data, status, header, config) {
							dfr2.reject({data:data, status:status, header:header, config:config});
						}
					};
					if ( angular.isString( metric2["searchTerm"] ) && metric2["searchTerm"] != "" )
						params2["searchTerm"] = metric2["searchTerm"];
					DataService.getDataAggregate(params2);
				}
				else {
					dfr2.resolve();
				}
				
				// API call for metric 3
				if (hasMetric3) {
					var params3 = {
						collection: metric3["collection"],
						field:		metric3["field"], // e.g. "bytes", 
						attribute:	metric3["attribute"], // e.g. "avg", 
						timestampField: "@timestamp",
						success: function (data, status, header, config) {
							dfr3.resolve({data:data, status:status, header:header, config:config});
						},
						error: function (data, status, header, config) {
							dfr3.reject({data:data, status:status, header:header, config:config});
						}
					};
					if ( angular.isString( metric3["searchTerm"] ) && metric3["searchTerm"] != "" )
						params3["searchTerm"] = metric3["searchTerm"];
					DataService.getDataAggregate(params3);
				}
				else {
					dfr3.resolve();
				}
				
				// wait for all promises to return and then process the data (inside successHandler)
				$q.all(promises)
				.then(successHandler, errorHandler);
				
				return deferredTotal.promise;
			};
		}
	};
	
	var startChartData = function(chartOptions) {
		for (var i=0; i<chartOptions["series"].length; i++) {
			var dataFunction	= getDataFn(          chartOptions["guid"], chartOptions["series"][i]["guid"] ),
				dataFunctionAgg = getDataAggregateFn( chartOptions["guid"], chartOptions["series"][i]["guid"] );
			dataFunctionAgg().then(
				function(data) { // this fixes the wrong Highcharts size issue
					var chart = Utils.getElementByGuid(chartOptions["guid"], $scope.widgetList);
					chart.api["reflowChart"]();
				},
				function(data) {/* there was an error */}
			);
			if ( angular.isDefined( chartOptions["series"][i]["dataQueryPromise"] ) )
				$interval.cancel(   chartOptions["series"][i]["dataQueryPromise"] );
			chartOptions["series"][i]["dataQueryPromise"] = $interval(dataFunction, $scope.chartRefreshInterval);
		}
	};
	
	$scope.zoomDataFn = function(widgetGuid) {
		return function(event) {
//			var chart = Utils.getElementByGuid( widgetGuid, $scope.widgetList );
//			console.debug("Will refresh chart data after zoom. Event object:");
//			console.debug(event);
		};
	};
	
	$scope.$watch("dashboard['rowHeight']", function(newVal) {
		for (var i=0; i<$scope.widgetList.length; i++) {
			$scope.widgetList[i]["add"]["panelStyle"]["height"] = newVal + "px";
			$scope.widgetList[i]["cssHeight"] = (newVal - 92) + "px";
			$scope.widgetList[i]["version"]++;
		}
	});
	
}]);

angular.module("insightal.dashboard")
	.controller("DashboardListCtrl", [
		"$scope", "$modal", "Dashboard", "UiMessage", "Utils", function(
		 $scope,   $modal,   Dashboard,   UiMessage,   Utils) {
	this.dashboardList = {
		items:		[],
		numPages:	 0,
		numPerPage:	10, // constant - set this to change list page size
		numResults:	 0, 
		currentPage: 1
	};
	this.dashboardListDisplayed = [];
	this.listOrderKey = "name";
	this.listOrderReverse = false;
	
	this.formatDate = function(dateStr) {
		var dt = Utils.strToDate(dateStr);
		var pad = function(number) {
    		return (number<10? "0":"") + number;
    	};
		return (dt.getMonth()+1) + "/" + dt.getDate() + "/" + dt.getFullYear() + " " + dt.getHours() + ":" + pad( dt.getMinutes() ); 
	};
	
	this.changeOrderTo = function(key) {
		this.listOrderReverse = (key === this.listOrderKey)? !this.listOrderReverse : false;
		this.listOrderKey = key;
	};
	
	this.listDashboards = function() {
		Dashboard.list({
			success: angular.bind(this, function(data, status, headers, httpConfig) {
				var dsbList = [];
				for (var i=0; i<data["dashboards"].length; i++) {
					var dsb = Utils.parseJSON( data["dashboards"][i][2] );
					dsb["guid"] = data["dashboards"][i][0]; // if user deletes recently added dashboard, the GUID may not have yet been propagated to dashboard definition JSON, but it's available in dashb.list array
					dsbList.push( dsb );
				}
				this.dashboardList["items"]		 = dsbList;
				this.dashboardList["numResults"] = dsbList.length;
				this.dashboardList["numPages"]	 = Math.floor( dsbList.length / this.dashboardList.numPerPage ) + ( (dsbList.length % this.dashboardList.numPerPage > 0)? 1 : 0 );
				this.changeDashboardListPage(1);
			}),
			error: angular.bind(this, function(data, status, headers, httpConfig) {
				var message = (typeof data["message"] == "undefined")? "---" : data["message"];
				UiMessage.add("danger", "An error occured when listing user's dashboards.\nMessage: " + message);
			})
		});
	};
	
	this.removeDashboard = function(guid) {
		var dashboardToDelete = Utils.getElementByGuid(guid, this.dashboardList["items"]);
		
		var modalInstance = $modal.open({
    		templateUrl: "partials/removeDashboardModal.html",
    		controller: "removeDashboardModalCtrl",
    		scope: $scope,
    		resolve: {
    			modalData: function() {
	    			return {
	    				dashboard: dashboardToDelete
	    			};
	    		}
    		}
    	});

		modalInstance.result.then(
			angular.bind(this, function() {
				Dashboard.delete({
					dashboardGuid: dashboardToDelete["guid"],
					success: angular.bind(this, function() {
						UiMessage.add("success", "Dashboard " + dashboardToDelete["name"] + " has been deleted.");
						this.listDashboards();
					}),
					error: angular.bind(this, function() {
						UiMessage.add("danger", "An error occured when deleting dashboard " + dashboardToDelete["name"] + ".");
					})
				});
			})
		);
		
		return false;
	};
	
	this.changeDashboardListPage = function(page) {
		var list = [];
		for (var i = (page-1)*this.dashboardList.numPerPage; i < Math.min(page*this.dashboardList.numPerPage, this.dashboardList.numResults); i++) {
			var dashboard = angular.copy( this.dashboardList.items[i] );
			dashboard["_chartCount"] = dashboard.widgets.length;
			dashboard["_creationDate"] = ( Utils.strToDate( dashboard.creationDate ) ).getTime();
			list.push( dashboard );
		}
		this.dashboardListDisplayed = list;
	};
	
	$scope.$watch(
		angular.bind(this, function() {
			return this.dashboardList.currentPage;
		}),
		angular.bind(this, this.changeDashboardListPage)
	);
	
	// initial actions
	this.listDashboards();
}]);

angular.module("insightal.dashboard")
	.controller("DashboardCreateCtrl", [
		"$scope", "$rootScope", "$state", "$stateParams", "Dashboard", "UiMessage", function(
		 $scope,   $rootScope,   $state,   $stateParams,   Dashboard,   UiMessage) {
	this.configMeta = [
   		{name:"name",			type:"string",	defaultVal:null,	title:"Name",			modifyType:["user"],	configType:"text"},
		{name:"description",	type:"string",	defaultVal:null,	title:"Description",	modifyType:["user"],	configType:"textArea"},
		{name:"guid",			type:"string",	defaultVal:null,	title:"",				modifyType:["script"],	configType:null},
		{name:"user",			type:"object",	defaultVal:null,	title:"",				modifyType:["script"],	configType:null},
		{name:"active",			type:"string",	defaultVal:1,		title:"",				modifyType:["script"],	configType:null},
		{name:"creationDate",	type:"date",	defaultVal:null,	title:"",				modifyType:["script"],	configType:null},
		{name:"modificationDate",type:"date",	defaultVal:null,	title:"",				modifyType:["script"],	configType:null},
		{name:"datasources",	type:"array",	defaultVal:[],		title:"",				modifyType:["script"],	configType:null},
		{name:"widgets",		type:"array",	defaultVal:[],		title:"",				modifyType:["script"],	configType:null},
		{name:"transientCfg",	type:"object",	defaultVal:{},		title:"",				modifyType:["script"],	configType:null}
	];
	this.configTransientMeta = [];
	
	this.prepareDashboardConfig = function() {
		var config			= {},
			configTransient	= {},
			commonConfig			= angular.copy( this.configMeta ),
			commonConfigTransient	= angular.copy( this.configTransientMeta );
		
		for (var i=0; i<commonConfig.length; i++) {
			config[ commonConfig[i].name ] = commonConfig[i].defaultVal;
		}
		for (var i=0; i<commonConfigTransient.length; i++) {
			configTransient[ commonConfigTransient[i].name ] = commonConfigTransient[i].defaultVal;
		}
		
		config["transientCfg"] = configTransient;
		return config;
	};
	
	this.save = function() {
		this.config["creationDate"]		= new Date();
		this.config["modificationDate"]	= new Date();
		this.config["widgets"] = [];
		
		var configToPersist = angular.copy( this.config );
		configToPersist["transientCfg"] = {};
		Dashboard.create({
			name:		configToPersist["name"],
			dashboard:	configToPersist,
			success:	function(data, status, headers, httpConfig) {
//				$rootScope.$broadcast("dashboardCreated");
				UiMessage.add("success", "Dashboard " + httpConfig.data["name"] + " saved successfully.");
				$state.go("user.dashboard", {guid:data["dashboardId"]});
			},
			error: function(data, status, headers, httpConfig) {
				var message = (typeof data["message"] == "undefined")? "---" : data["message"];
				UiMessage.add("danger", "An error occured when saving dashboard " + dashboard.name + ".\nMessage: " + message);
			}
		});
	};
	
	this.config = this.prepareDashboardConfig();
}]);

angular.module("insightal.dashboard")
	.controller("createDashboardModalCtrl",	[
		"$scope", "$modalInstance", "config", function(
		 $scope,   $modalInstance,   config) {
	$scope.config = config;
	
	$scope.save = function() {
		$modalInstance.close($scope.config);
	};
	
	$scope.cancel = function() {
		$modalInstance.dismiss();
	};
}]);

angular.module("insightal.dashboard")
	.controller("editDashboardModalCtrl", [
		"$scope", "$modalInstance", function(
		 $scope,   $modalInstance) {
	this.config = angular.copy( $scope.dashboard );
	
	this.isString = function(input) {
		return angular.isString(input);
	};
	
	this.save = function() {
		$modalInstance.close(this.config);
	};
	
	this.cancel = function() {
		$modalInstance.dismiss();
	};
}]);

angular.module("insightal.dashboard")
	.controller("removeDashboardModalCtrl", [
		"$scope", "$modalInstance", "modalData", function(
		 $scope,   $modalInstance,   modalData) {
	$scope.modalData = modalData;
			
	$scope.save = function() {
		$modalInstance.close();
	};
	
	$scope.cancel = function() {
		$modalInstance.dismiss();
	};
}]);

angular.module("insightal.dashboard")
	.controller("editChartModalCtrl", [
		"$scope", "$modalInstance", "DashboardCharts", "InChartUtils", "Utils", "modalData", function(
		 $scope,   $modalInstance,   DashboardCharts,   InChartUtils,   Utils,   modalData) {
	var defaultChartType	= "line";
	this.action				= modalData["action"];
	this.applicationList	= modalData["applicationList"];
	this.applicationFields	= modalData["applicationFields"];
	this.sensorList			= modalData["sensorList"];
	this.sensorPeriodList	= [
		["minute",	"past minute"],
		["hour",	"past hour"],
		["day",		"past day"],
		["week",	"past week"],
		["month",	"past month"]
	];
	// for chart EDIT, use supplied chartOptions; for chart ADD, use just {type:...}, the rest of the options is filled in by $watch
	this.chartOptions		= (this.action == "edit")? modalData["chartOptions"] : {type:defaultChartType};
	this.chartOptionsMeta	= [];
	this.chartOptionsAddMeta = DashboardCharts.getChartOptionsMetaArray( modalData["chartOptionsAddMeta"] );
	this.optionGroupsAll	= InChartUtils.getChartOptionGroupsArray();
	this.optionGroups		= [];
	this.filterByGroupFn	= DashboardCharts.filterByGroupFn;
	this.seriesCounter		= 0;
	this.accordionOpened	= {};
	this.validationErrors	= { __length: 0 };
	this.varTypes = {
		// "the variable should be ..."
		int:		"an integer number",
		float:		"a number",
		boolean:	"either 'true' or 'false'",
		function:	"a function",
		string:		"a string",
		stringSpec:	"a string of a specific format",
		object:		"be an object",
		objectSpec: "be an object of a specific format",
		array:		"a list of values",
		arraySpec:	"a list of values of a specific type",
		timestamp:	"a timestamp, i.e. a positive integer number"
	};
	
	this.metricTypes = ["metric", "sensor"];
	
	// copy title from additional options (this value is used in UI) to regular options, so that user can edit the value
	// later, the title value is copied back to additional options (title is in our case displayed by outer page, not inside the chart)
	if ( angular.isObject( this.chartOptions["add"] ) && angular.isString( this.chartOptions["add"]["title"] ) ) {
		this.chartOptions["title"] = this.chartOptions["add"]["title"];
	}
	
	this.addSeries = function() {
		var series = InChartUtils.getSeriesOptions({ chartType:this.chartOptions["type"] }); 
		series["guid"] = Utils.generateUUID(); 
		series["name"] = "Series " + (++this.seriesCounter);
		series["metric"]["type"] = "metric";
		this.chartOptions["series"].push(series);
		this.setAccordionOpened(series["guid"], true);
	};
	
	this.removeSeries = function(seriesGuid) {
		var idx = Utils.getIndexByGuid(seriesGuid, this.chartOptions["series"]);
		this.chartOptions["series"].splice(idx, 1);
		delete this.accordionOpened[seriesGuid];
	};
	
	this.setAccordionOpened = function(seriesGuid, open) {
		if (open) {
			for (var key in this.accordionOpened) {
				this.accordionOpened[key] = false;
			}
		}
		this.accordionOpened[seriesGuid] = open;
	};
	
	this.isString = angular.isString;
	
	this.isMetaConditionTrue = angular.bind(this, function(optionMeta, idx) {
		if ( !angular.isString( optionMeta["condition"] ) )
			return true;
		else
			return eval( optionMeta["condition"].replace(/__chart__/g, "this.chartOptions") );
	});
	
	this.isSeriesType = function(types, seriesOptions, chartOptions) {
		if ( angular.isString( types ) ) {
			return seriesOptions["type"] == types || (seriesOptions["type"] == "inherit" && chartOptions["type"] == types)
		}
		if ( angular.isArray( types ) ) {
			for (var i=0; i<types.length; i++) {
				if (seriesOptions["type"] == types[i] || (seriesOptions["type"] == "inherit" && chartOptions["type"] == types[i])) {
					return true;
				}
			}
		}
		return false;
	};
	
	this.toggleCheckboxValue = function(modelName, value, category, guid) {
		if ( angular.isString( category ) ) {
			if ( angular.isString( guid ) ) {
				var categoryItemIdx = Utils.getIndexByGuid(guid, this.chartOptions[category]),
					idx = this.chartOptions[category][categoryItemIdx][modelName].indexOf(value);
				if (idx > -1)
					this.chartOptions[category][categoryItemIdx][modelName].splice(idx, 1);
				else
					this.chartOptions[category][categoryItemIdx][modelName].push(value);
			}
			else {
				var idx = this.chartOptions[category][modelName].indexOf(value);
				if (idx > -1)
					this.chartOptions[category][modelName].splice(idx, 1);
				else
					this.chartOptions[category][modelName].push(value);
			}
		}
		else {
			var idx = this.chartOptions[modelName].indexOf(value);
			if (idx > -1)
				this.chartOptions[modelName].splice(idx, 1);
			else
				this.chartOptions[modelName].push(value);
		}
	};
	
	this.isFieldValid = function(fieldId) {
		return angular.isObject( this.validationErrors[ fieldId ] );
	};
	
	this.save = function() {
		this.validationErrors = { __length: 0 };
		var validateListOfOptions = angular.bind(this, function(valueCatalog, metaList) {
			for (var i=0; i<metaList.length; i++) {
				var metaInfo = metaList[i];
//				console.debug("OPTION: " + metaInfo["name"] + " = " + valueCatalog[ metaInfo["name"] ] + ", type = " + metaInfo["type"]);
				if (metaInfo["modifyType"].indexOf("user") < 0) {
					continue;
				}
				else {
					var group = Utils.getElementByGuid( metaInfo["group"], this.optionGroupsAll, "name" );
					if ( angular.isArray( metaInfo["constraints"] ) ) {
						for (var j=0; j<metaInfo["constraints"].length; j++) {
							if (metaInfo["constraints"][j] == "required" &&	(
									!angular.isDefined( valueCatalog[ metaInfo["name"] ] ) ||
									valueCatalog[ metaInfo["name"] ] == null ||
									valueCatalog[ metaInfo["name"] ] == "" )
								) {
								this.validationErrors[ metaInfo["name"] ] = {
										message:"A value " +
										"for option \"" + metaInfo["title"] + "\" (" + group["title"] + ") " +
										"is required."
								};
								this.validationErrors.__length++;
							}
						}
					}
					if ( !Utils.isOfType( valueCatalog[ metaInfo["name"] ], metaInfo["type"] ) &&
							valueCatalog[ metaInfo["name"] ] != metaInfo["defaultVal"] ) {
						var varType = metaInfo["type"];
						if (varType.indexOf("string") == 0)
							varType = "string";
						if (varType.indexOf("object") == 0)
							varType = "object";
						if (varType.indexOf("array") == 0)
							varType = "array";
						this.validationErrors[ metaInfo["name"] ] = {
								message:"The value \"" + valueCatalog[ metaInfo["name"] ] + "\" " +
								"for option \"" + metaInfo["title"] + "\" (" + group["title"] + ") " +
								"should be " + this.varTypes[varType] + "."
						};
						this.validationErrors.__length++;
					}
				}
			}
		});
		
		var parseNumbersInOptions = angular.bind(this, function(valueCatalog, metaList) {
			for (var i=0; i<metaList.length; i++) {
				var metaInfo = metaList[i];
				if ( metaInfo["type"] === "int" && isFinite( parseInt( valueCatalog[ metaInfo["name"] ] ) ) ) {
					valueCatalog[ metaInfo["name"] ] = parseInt( valueCatalog[ metaInfo["name"] ] );
				}
				if ( metaInfo["type"] === "float" && isFinite( parseFloat( valueCatalog[ metaInfo["name"] ] ) ) ) {
					valueCatalog[ metaInfo["name"] ] = parseFloat( valueCatalog[ metaInfo["name"] ] );
				}
			}
		});
		
		parseNumbersInOptions(this.chartOptions, this.chartOptionsMeta);
		validateListOfOptions(this.chartOptions, this.chartOptionsMeta);
		parseNumbersInOptions(this.chartOptions["add"], this.chartOptionsAddMeta);
		validateListOfOptions(this.chartOptions["add"], this.chartOptionsAddMeta);
		for (var i=0; i<this.chartOptions["series"].length; i++) {
			var seriesType = (this.chartOptions["series"][i]["type"] == "inherit")? "common" : this.chartOptions["series"][i]["type"],
				seriesOptionsMeta = InChartUtils.getSeriesOptionsMetaArray({ chartType:seriesType });
			parseNumbersInOptions(this.chartOptions["series"][i], seriesOptionsMeta);
			validateListOfOptions(this.chartOptions["series"][i], seriesOptionsMeta);
			var metricElements = ["application", "collection", "document", "field", "attribute"];
			// TODO: validate series of type SENSOR
			if (this.chartOptions["series"][i]["metric"]["type"] != "sensor") {
				for (var j=0; j<metricElements.length; j++) {
					if ( !angular.isString( this.chartOptions["series"][i]["metric"][ metricElements[j] ] ) || this.chartOptions["series"][i]["metric"][ metricElements[j] ].length == 0 ) {
						this.validationErrors["series-" + i + "-metric1-" + metricElements[j] ] = {message: "You must define " + metricElements[j] + " in metric for series \"" + this.chartOptions["series"][i]["name"] + "\"."};
						this.validationErrors.__length++;
					}
				}
				// for certain series types, a second metric must be defined
				if (this.isSeriesType( ["scatter","arearange","columnrange"], this.chartOptions["series"][i], this.chartOptions) ) {
					for (var j=0; j<metricElements.length; j++) {
						if ( !angular.isString( this.chartOptions["series"][i]["metric2"][ metricElements[j] ] ) || this.chartOptions["series"][i]["metric2"][ metricElements[j] ].length == 0 ) {
							this.validationErrors["series-" + i + "-metric2-" + metricElements[j] ] = {message: "You must define " + metricElements[j] + " in 2nd metric for series \"" + this.chartOptions["series"][i]["name"] + "\"."};
							this.validationErrors.__length++;
						}
					}
				}
			}
		}
		if (this.chartOptions["series"].length == 0) {
			this.validationErrors["series"] = {message: "You must define at least one data series."};
			this.validationErrors.__length++;
		}
		
		if (this.validationErrors.__length == 0) {
			$modalInstance.close(this.chartOptions);
		}
	};
	
	this.cancel = function() {
		$modalInstance.dismiss();
	};
	
	$scope.$watch(
		angular.bind(this, function() {
			return this.chartOptions["type"];
		}),
		angular.bind(this, function(newChartType, oldChartType) {
			var newChartOptions		= InChartUtils.getChartOptions({ chartType:newChartType }), // filled with default values
				oldChartOptions		= this.chartOptions;
			
			// fill "add" option object with additional options defined by Dashboard module				
			newChartOptions["add"]	= DashboardCharts.getChartOptionsFromArray( this.chartOptionsAddMeta );
			
			// get options metadata ("add" options metadata are chart-type independent and are set at modal-creation time) 
			this.chartOptionsMeta	= InChartUtils.getChartOptionsMetaArray({ chartType:newChartType });
			
			// get non-empty groups and always include "series" group 
			this.optionGroups = DashboardCharts.getNonEmptyGroups( this.optionGroupsAll, this.chartOptionsMeta.concat([{ group:"series", modifyType:["user"] }]) );
			
			// if the option existed in the old option list, use the option value, instead of the default
			for (var key in newChartOptions) {
				if ( angular.isDefined( oldChartOptions[key] ) ) {
					newChartOptions[key] = angular.copy( oldChartOptions[key] );
				}
			}
			
			this.chartOptions = newChartOptions;
			
			// if chart has not series and the modal window has just been opened, add the first one
			if (this.chartOptions["series"].length == 0 && newChartType == oldChartType) {
				this.addSeries();
			}
		})
	);
}]);

angular.module("insightal.dashboard")
	.controller("editChartModalSeriesCtrl", [
		"$scope", "InChartUtils", "Utils", function(
		 $scope,   InChartUtils,   Utils) {
	// $scope.modal controller must be editChartModalCtrl!
	this.parent = $scope.modal;
	this.seriesIdx = Utils.getIndexByGuid( $scope.series["guid"], this.parent.chartOptions["series"] );
	this.seriesOptionsMeta = [];
			
	this.changeSeriesType = function(newSeriesType, oldSeriesType) {
		var newSeriesOptions;

		if (newSeriesType == "inherit") {
			// get all options for series type equal to chart type, but show to user only common series options (others will be inherited from chart)
			newSeriesOptions		= InChartUtils.getSeriesOptions({ chartType:"common" }); //({ chartType:this.parent.chartOptions["type"] });
			this.seriesOptionsMeta	= InChartUtils.getSeriesOptionsMetaArray({ chartType:"common" });
		}
		else {
			newSeriesOptions		= InChartUtils.getSeriesOptions({ chartType:newSeriesType });
			this.seriesOptionsMeta	= InChartUtils.getSeriesOptionsMetaArray({ chartType:newSeriesType });
		}
		
		// remove properties not used for this series type
		for (var key in this.parent.chartOptions["series"][ this.seriesIdx ]) {
			if ( !angular.isDefined( newSeriesOptions[key] ) ) {
				delete this.parent.chartOptions["series"][ this.seriesIdx ][key];
			}
		}
		// add properties that are new for this series type
		for (var key in newSeriesOptions) {
			if ( !angular.isDefined( this.parent.chartOptions["series"][ this.seriesIdx ][key] ) ) {
				this.parent.chartOptions["series"][ this.seriesIdx ][key] = angular.copy( newSeriesOptions[key] );
			}
		}
		
		// do not inherit some option values for specific series types
		if ( this.parent.isSeriesType( ["scatter","arearange","columnrange"], {type:newSeriesType}, this.parent.chartOptions) ) {
			this.parent.chartOptions["series"][ this.seriesIdx ]["metric2Enabled"] = true;
		}
	};
	
	this.isMetaConditionTrue = angular.bind(this, function(optionMeta, idx) {
		if ( !angular.isString( optionMeta["condition"] ) ) {
			return true;
		}
		else {
			var conditionString = optionMeta["condition"]
									.replace(/__chart__/g,	"this.parent.chartOptions")
									.replace(/__series__/g, "this.parent.chartOptions.series[ this.seriesIdx ]");
			return eval(conditionString);
		}
	});
	
	$scope.$watch( //watch for this series type change
		function() {
			return $scope.series["type"];
		},
		angular.bind(this, this.changeSeriesType)
	);
	
	$scope.$watch( //watch for chart type change and change options of this series if it has type 'inherit'
		function() {
			// $scope.modal controller must be editChartModalCtrl!
			return $scope.modal.chartOptions["type"];
		},
		angular.bind(this, function(newChartType) {
			// $scope.modal controller must be editChartModalCtrl!
			if ($scope.series["type"] == "inherit")
				this.changeSeriesType("inherit");
		})
	);
}]);

angular.module("insightal.dashboard")
	.controller("editWidgetModalCtrl", [
		"$scope", "$modalInstance", "DashboardCharts", "modalData", function(
		 $scope,   $modalInstance,   DashboardCharts,   modalData) {
	this.options		= modalData["options"];
	this.optionsMeta	= modalData["optionsMeta"];
	this.seriesMeta		= modalData["seriesMeta"];
	this.optionGroups	 = DashboardCharts.getNonEmptyGroups( modalData["optionGroups"], modalData["optionsMeta"] );
	this.filterByGroupFn = DashboardCharts.filterByGroupFn;
	
	this.isConfigDisplayed = function(expr) {
		if (typeof expr === "undefined")
			return true;
		else
			return $scope.$eval(expr);
	};
	
	this.save = function() {
		$modalInstance.close(this.options);
	};
	
	this.cancel = function() {
		$modalInstance.dismiss();
	};
	
}]);

angular.module("insightal.dashboard")
	.controller("editWidgetModalCtrlAs", [
		"$scope", "$modalInstance", "config", function(
		 $scope,   $modalInstance,   config) {
	this.config = config;
	// TODO: remove tight coupling on the next 3 lines
	this.chartConfigCommon = $scope.$parent.workbench.chartConfigCommon;
	this.chartTypes = $scope.$parent.workbench.chartTypes;
	this.specificChartConfig = $scope.$parent.workbench.getWidgetDefByType(config["type"]).config;
	
	this.isConfigDisplayed = function(expr) {
		if (typeof expr === "undefined")
			return true;
		else
			return $scope.$eval(expr);
	};
	
	this.save = function() {
		$modalInstance.close(this.config);
	};
	
	this.cancel = function() {
		$modalInstance.dismiss();
	};
}]);

angular.module("insightal.dashboard")
	.controller("editMetricModalCtrl", [
		"$scope", "$modalInstance", "modalData", "Utils", function(
		 $scope,   $modalInstance,   modalData,   Utils) {
	this.options			= modalData["options"];
	this.optionsMeta		= modalData["optionsMeta"];
	this.applicationList	= modalData["applicationList"];
	this.applicationFields	= modalData["applicationFields"];
	
	this.addMetric = function() {
		this.options["metric"].push({
			guid: Utils.generateUUID()
		});
	};
	
	this.removeMetric = function(idx) {
		this.options["metric"].splice(idx, 1);
	};
	
	this.save = function() {
		$modalInstance.close(this.options);
	};
	
	this.cancel = function() {
		$modalInstance.dismiss();
	};
}]);