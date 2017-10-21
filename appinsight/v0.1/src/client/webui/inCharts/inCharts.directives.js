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

angular.module("inCharts")
	.directive("inChart", [
	    "$timeout", "InChartUtils", function (
		 $timeout,   InChartUtils) {
	    	
	return {
        restrict: "E",
        scope: {
        	options: "=",
        	version: "="
        },
        template: "<div id=\"inchart-container-{{config.guid}}\" ng-style=\"{'height':config.style.cssHeight}\"></div>",
        controller: "InChartCtrl",
        link: function(scope, element, attrs) {
        	
        	var refreshChart = function() {
//        		console.debug("BEGIN refreshChart");
        		scope.isRefreshing		 = true;
        		scope.isRefreshRequested = false;
        		
        		if ( angular.isDefined( scope.chart ) ) {
        			scope.chart.destroy(); // delete the old chart version first
        		}
        		
        		var series		= scope.options["series"],
        			// get options metadata including private fields (private group must be mentioned explicitly)
        			optionsMeta	= InChartUtils.getChartOptionsMeta({ chartType:scope.options["type"], groups:["all","private"] });
        		
        		scope.options = InChartUtils.fillNonUserConfigurableOptionsByDefaults( scope.options ); // if the chart type changed, the values for non user configurable options should be set the new type defaults
        		scope.options = InChartUtils.fillTransientOptionsIfEmpty( scope.options ); // if the chart has just been displayed from copy saved on server, the transient fields are empty
            	scope.config  = InChartUtils.fillChartConfig( scope.options, {}, optionsMeta ); // take options and create config, which is internally used for chart creation
            	
            	/** API ***************************************************************************/
            	scope.options["api"] = {
        			addSeries:				addSeries,
        			removeSeriesData:		removeSeriesData,
        			removeAllSeriesData:	removeAllSeriesData,
        			addSeriesPoint:			addSeriesPoint,
        			removeSeriesPoint:		removeSeriesPoint,
        			addText:				addText,
        			removeElement:			removeElement,
            		reflowChart:			reflowChart,
            		redrawChart:			redrawChart,
            		getPersistentOptions:	getPersistentOptions,
            		setAxisCategories:		setAxisCategories,
            		zoomOut:				zoomOut
            	};
            	/*********************************************************************************/
            	
            	// options setup if this is a new chart
            	if ( !angular.isObject( scope.config["chart"] ) )
            		scope.config["chart"] = {};
            	if ( !angular.isString( scope.options["guid"] ) || scope.options["guid"] == "" ) {
            		scope.options["guid"] = InChartUtils.generateUUID();
            		scope.config["guid"]  = scope.options["guid"];
            	}
            	if ( !angular.isNumber( scope.version ) )
            		scope.version = 0;
            	if ( !angular.isArray( scope.options["apiStack"] ) ) {
            		scope.options["apiStack"] = [];
            	}
            	scope.config["chart"]["renderTo"] = "inchart-container-" + scope.config["guid"];
            	
            	setEventHandlers(); // for events: load, redraw, ...
            	
            	// refresh chart series
            	scope.config["series"] = [];
            	for (var i=0; i<scope.options["series"].length; i++) {
	            	if ( angular.isArray( scope.options["series"][i]["data"] ) ) {
	            		var	optionsSeries = angular.copy( scope.options["series"][i] ), // we need a copy, so that we don't alter the values in chartOptions
	            			optionsSeriesMeta,
	            			chartSeries,
	            			seriesType = (optionsSeries["type"] == "inherit")? scope.options["type"] : optionsSeries["type"]; 
            			optionsSeries["type"] = scope.options["type"]; 
            			optionsSeriesMeta	= InChartUtils.getSeriesOptionsMeta({ chartType:seriesType, groups:["all","private"] });
            			chartSeries			= InChartUtils.fillChartConfig( optionsSeries, {}, optionsSeriesMeta );
	            		for (var j=0; j<scope.options["series"][i]["data"].length; j++) {
	        				var series = angular.copy( chartSeries );
	            			series["id"]	= optionsSeries["guid"] + "_" + optionsSeries["data"][j]["name"];
	        				series["name"]	= optionsSeries["data"][j]["name"];
	        				series["data"]	= InChartUtils.formatData(optionsSeries["data"][j], optionsSeries, scope.options);
	            			scope.config["series"].push( series );
	            		}
	            	}
            	}
            	
        		// INSERT THE CHART ITSELF
            	$timeout(function() { // if $timeout delay is not provided => the default behavior is to execute the function after the DOM has completed rendering. 
//        			console.debug("BEGIN insert Highcharts.Chart");
        			scope.chart = new Highcharts.Chart(scope.config);
        			
        			if ( !isFinite( scope.options["apiStack"].idx ) ) {
        				// if there's something on the stack and idx is undefined, process the complete stack (define idx, the rest is done by $watch)
        				scope.options["apiStack"].idx = scope.options["apiStack"].length;
        			}
//        			console.debug("END insert Highcharts.Chart");
        		});
//        		console.debug("END refreshChart");
        	};
        	    	
        	var setEventHandlers = function() {
        		scope.config["chart"]["events"] = {};
            	scope.config["chart"]["events"]["load"] = chartLoadHandler;
            	scope.config["chart"]["events"]["redraw"] = chartRedrawHandler;
        	};
        	
        	var chartLoadHandler = function(event) {
//    			console.debug("Chart finished loading.");
//    			console.debug("event:");
//    			console.debug(event);
    			chartRedrawHandler(event);
        	};
        	
        	var chartRedrawHandler = function(event) {
//    			console.debug("Chart finished redrawing.");
    			scope.isRefreshing = false;
    			if (scope.isRefreshRequested) {
    				scope.isRefreshRequested = false;
    				scope.version++;
    			}
        	};
        	
        	var getPersistentOptions = function() {
        		var opt = angular.copy( scope.options );
        		opt = InChartUtils.fillChartOptions(scope.config, opt);
        		opt = InChartUtils.getPersistentOptions(opt);
        		return opt;
        	};
        	
        	var addSeries = function(seriesGuid, dataId, data) { // the structure is: options -> series(array of series) -> data(array of data-series) -> values(array of data-points)
        		// dataId is an arbitrary string used to identify data-series inside series' data array (because one series can produce multiple data-series)
        		var chartSeries,	  // series inside Highchart's internal config, identified by id = seriesId (see below)
	        		seriesId		  = seriesGuid + "_" + dataId, // seriesId is used for internal chart series identification (e.g. in Highcharts) because data-series for all series are stored in one place
    				optionsSeries	  = InChartUtils.getElementById(seriesGuid, scope.options["series"], ["guid"]),	// series defined by the outside page
    				optionsSeriesCopy = angular.copy( optionsSeries ),
    				optionsDataIdx	  = InChartUtils.getIndexById(dataId, optionsSeries["data"], ["id"]), // data index inside optionsSeries
    				seriesType		  = (optionsSeries["type"] == "inherit")? scope.options["type"] : optionsSeries["type"],
        			optionsSeriesMeta;
				
				// add series data to internal chart field -> this displays the data
        		optionsSeriesCopy["type"] = seriesType; // in case we have optionsSeries["type"] == "inherit", this rewrites the type to chart type, otherwise it remains 
				chartSeries = InChartUtils.getElementById(seriesId, scope.chart.series, ["options", "id"]);
				if (chartSeries != null) { // the data already exists inside chart's internal config, remove it first
					chartSeries.remove();
				}
        		optionsSeriesMeta	= InChartUtils.getSeriesOptionsMeta({ chartType:seriesType, groups:["all","private"] });
				chartSeries			= InChartUtils.fillChartConfig( optionsSeriesCopy, {}, optionsSeriesMeta );
				chartSeries["id"]	= seriesId; // one optionsSeries can produce multiple chartSeries, so we need the id
				chartSeries["name"]	= data["name"];
				chartSeries["data"] = InChartUtils.formatData(data, optionsSeriesCopy, scope.options);
				console.debug("scope.chart.addSeries");
				console.debug(chartSeries);
				scope.chart.addSeries(chartSeries);
				
				// add series data to options["series"] -> this keeps the options["series"] in sync with the displayed data (internal Highchart's config)
				data["id"] = dataId;
				if (optionsDataIdx < 0) { // the data doesn't exist inside options->series yet
					optionsSeries["data"].push( data );
				}
				else { // the data already exist, replace it
					optionsSeries["data"][optionsDataIdx] = data;
				}
        	};
        	
        	var addSeriesPoint = function(seriesGuid, dataId, point, redraw, shift) {
        		// dataId is an arbitrary string used to identify data-series inside series' data array (because one series can produce multiple data-series)
        		var chartSeries,	// series inside Highchart's internal config, identified by id = seriesId (see below)
        			seriesId      = seriesGuid + "_" + dataId, // seriesId is used for internal chart series identification (e.g. in Highcharts) because data-series for all series are stored in one place
        			optionsSeries = InChartUtils.getElementById(seriesGuid, scope.options["series"], ["guid"]),	// series defined by the outside page
        			optionsData   = InChartUtils.getElementById(dataId,   optionsSeries["data"],   ["id"]),	// data inside optionSeries
        			formattedPoint,
        			pointConfig; //used for point data formatting
        		pointConfig = {
    				xDataType:	scope.options["xAxisDataType"],
    				xDataFormat:scope.options["xAxisDataFormat"],
    				yDataType:	scope.options["yAxisDataType"],
    				yDataFormat:scope.options["yAxisDataFormat"]
        		};
				formattedPoint = InChartUtils.formatPoint(point, pointConfig);
				
				// add point to internal chart field -> this displays the point
				chartSeries = InChartUtils.getElementById(seriesId, scope.chart.series, ["options", "id"]);
				if (chartSeries != null) {
					chartSeries.addPoint(formattedPoint, redraw, shift);
				}
				else {
					console.error("inCharts.directives.js (API.addPoint): The series with id '" + seriesId + "' not found.");
					return;
				}
				
				// add point to options["series"] -> this keeps the options["series"] in sync with the displayed data (internal Highchart's config)
				optionsData["values"].push( point );
				if (shift)
					optionsData["values"].shift();
        	};
        	
        	var removeSeriesData = function(seriesGuid, dataId) {
        		var chartSeries = [],
        			seriesId         = seriesGuid + "_" + dataId,
        			optionsSeriesIdx = InChartUtils.getIndexById(seriesGuid, scope.options["series"], ["guid"]),
        			optionsDataIdx;
        		if ( !angular.isString( dataId ) ) { // remove all series-data that belongs to options["series"] with a given GUID
        			chartSeries = InChartUtils.getElementStartingById(seriesGuid, scope.chart.series, ["options", "id"]); // getElementStartingById returns an array!
        			scope.options["series"][ optionsSeriesIdx ]["data"] = []; // remove all series-data from chart options->series
        		}
        		else { // remove only specific series-data (with id=seriesGuid_dataId) from the given options["series"]
        			chartSeries.push( InChartUtils.getElementById(seriesId, scope.chart.series, ["options", "id"]) );
        			optionsDataIdx = InChartUtils.getIndexById(dataId, scope.options["series"][ optionsSeriesIdx ]["data"], ["id"]);
        			scope.options["series"][ optionsSeriesIdx ]["data"].splice(optionsDataIdx, 1); // remove specific series-data from chart options->series
        		}
        		
        		// remove data from chart config (internal config that handles the real chart display)
        		for (var i=0; i<chartSeries.length; i++) {
        			chartSeries[i].remove();
        		}
        	};
        	
        	var removeAllSeriesData = function() {
        		for (var i=0; i<scope.chart.series.length; i++) {
        			scope.chart.series[i].remove();
        		}
        		for (var i=0; i<scope.options["series"].length; i++) {
        			scope.options["series"][i]["data"] = [];
        		}
        	};
        	
        	var removeSeriesPoint = function(seriesGuid, dataId, pointIndex, redraw) {
        		var seriesId	= seriesGuid + "_" + dataId,
	    			chartSeries	= InChartUtils.getElementById(seriesId, scope.chart.series, ["options", "id"]),
	    			optionsSeriesIdx = InChartUtils.getIndexById(seriesGuid, scope.options["series"], ["guid"]),
	    			optionsDataIdx	 = InChartUtils.getIndexById(dataId, scope.options["series"][ optionsSeriesIdx ]["data"], ["id"]);
	    		chartSeries.removePoint(pointIndex, redraw); // remove data from internal chart array (this removes point)
	    		scope.options["series"][ optionsSeriesIdx ]["data"][ optionsDataIdx ]["values"].splice(pointIndex, 1); // sync also data stored in options
        	};
        	
        	var setAxisCategories = function(axis, axisIdx, categories, redraw) {
        		if ( !angular.isNumber(axisIdx) )
        			axisIdx = 0;
        		if ( typeof redraw != "boolean" )
        			redraw = true;
        		if (axis == "x") {
        			scope.chart.xAxis[axisIdx].setCategories(categories, redraw);
        		}
        		else if (axis == "y") {
        			scope.chart.yAxis[axisIdx].setCategories(categories, redraw);
        		}
        	};
        	
        	var reflowChart = function() {
        		scope.chart.reflow();
        	};
        	
        	var redrawChart = function() {
        		scope.chart.redraw();
        	};
        	
        	var zoomOut = function() {
        		scope.chart.zoomOut();
        	};
        	
        	var addText = function(config) {
        		if ( !angular.isString( config["text"] ) || !angular.isString( config["id"] ) )
        			return;
        		
        		config["x"] = scope.chart.plotLeft + (angular.isNumber( config["x"] ))? config["x"] : 0;
        		config["y"] = scope.chart.plotTop  + (angular.isNumber( config["y"] ))? config["y"] : 0;
        		if ( !angular.isObject( config["attr"] ) )
        			config["attr"] = {};
        		if ( !angular.isObject( config["css"] ) )
        			config["css"] = {};
        		if ( angular.isDefined( scope.chartRenderElements[ config["id"] ] ) )
        			scope.chartRenderElements[ config["id"] ].destroy();
        		
        		scope.chartRenderElements[ config["id"] ] = scope.chart.renderer
        			.text( config["text"], config["x"], config["y"] )
        			.attr( config["attr"] )
        			.css(  config["css"]  )
        			.add();
        	};
        	
        	var removeElement = function(elementId) {
        		if ( angular.isDefined( scope.chartRenderElements[elementId] ) ) {
        			scope.chartRenderElements[elementId].destroy();
        			delete scope.chartRenderElements[elementId];
        		}
        	};
        	
        	var callApi = function(fnName, args) {
        		scope.options["api"][fnName].apply(this, args);
        	};
        	
        	var processApiStack = function(newStackIdx, oldStackIdx) {
//        		console.debug("Caught apiStack update. Old idx = " + oldStackIdx + ", New idx = " + newStackIdx);
        		if ( !angular.isNumber( newStackIdx ) ){
        			return;
        		}
    			if ( !angular.isNumber( oldStackIdx ) ){
    				oldStackIdx = 0;
    			}
    			for (var i=oldStackIdx; i<newStackIdx; i++) {
    				callApi( scope.options["apiStack"][i]["fn"], scope.options["apiStack"][i]["args"] );
    			}
        	};
        	
        	
            /* watches ****************************************************************************/
        	
        	/* Use chart.events.load and chart.events.redraw event
             * just before chart insert/redraw set some scope variable like - isRefreshing=true
             * if there's version change while isRefreshing, set scope variable doUpdateChart=true
             * when load/redraw event arrives, set isRefreshing=false, and if doUpdateChart==true,
             * then increment version so that another refresh is started
             * (this will prevent running multiple refreshes if there are multiple version updates
             * while already updating)
             */
            scope.$watch(
        		function() {
        			return scope.version;
        		},
        		function(newValue, oldValue) {
//        			console.debug("Caught version update. Old = " + oldValue + ", New = " + newValue);
        			if ( ( angular.isNumber(newValue) && !angular.isNumber(oldValue) ) || ( newValue > oldValue ) ) {
        				if (!scope.isRefreshing) {
        					console.debug("Starting refresh.");
        					refreshChart();
        				}
        				else {
        					console.debug("Refresh already running...");
        					scope.isRefreshRequested = true;
        				}
        			}
        		}
    		);
            
            scope.$watch("options['apiStack'].idx", processApiStack);
            
            /* initial actions ********************************************************************/
//            console.debug("BEGIN linking ============================================================");
            
            // hash table of additional elements displayed on the chart visual area; object keys are elements' IDs
            scope.chartRenderElements = {};
            
            // display the chart
            refreshChart();
            
//            console.debug(scope.options);
//            console.debug("END linking");
//            console.debug("=========================================================================");
            
        } // END link function
    };
}]);
