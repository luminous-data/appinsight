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
		.controller("SearchCtrl", [
			"$rootScope", "$scope", "$modal", "$timeout", "$q", "Search", "Group", "Application", "Collection", "Auth", "UiMessage", "Globals", "Utils", function(
			 $rootScope,   $scope,   $modal,   $timeout,   $q,   Search,   Group,   Application,   Collection,   Auth,   UiMessage,   Globals,   Utils) {
				
	this.searchResult = {};
	this.searchResultColumns = {};
	this.searchResultColumnsDefault = [/time/, /message/]; // regular expressions
	this.formattedResults = [];
	this.numResults = 0;
	this.numColumns = 0;
	this.facets = [];
	this.facetsSelected = [];
	this.query = "";
	this.queryPrevious = "";
	this.chartQueryParams = {};
	this.applicationList = [];
	this.collectionList  = [];
	this.selectedAppGuid = null;
	this.selectedColGuid = null;
	this.collectionListByApp = {};
	this.chartRawData = [];
	this.isChartZoomed = false;
	this.isChartBeingZoomed = false;
	this.chartZoomedExtremes = {min:null, max:null, minStr:null, maxStr:null};
	this.chartCategoriesCount = 20;
	this.chart = {
		title: null,
		subtitle: null,
		type: "column",
		guid: "searchResultsChart",
		series: [{
			name: "Search Results",
			id: "",
			guid: "searchResultsSeries1",
			type: "inherit",
			data: [],
			color: "#99cc33",
			markerEnabled: true,
			markerSize: 4,
			markerSymbol: null,
			zIndex: 1
		}],
		active: 1,
		xAxisType: "categories",
		xAxisAllowDecimals: true,
		xAxisCategories: null,
//		xAxisDataFormat: "%H:%M:%S",
		xAxisMax: null,
		xAxisMin: null,
		xAxisOffset: 0,
		xAxisOpposite: false,
		xAxisReversed: false,
		xAxisTitle: "Time",
		xTickInterval: null,
		xTickLength: 10,
		xTickPositions: null,
		yAxisType: "linear",
		yAxisAllowDecimals: true,
		yAxisCategories: null,
//		yAxisDataFormat: "",
		yAxisMax: null,
		yAxisMin: null,
		yAxisOffset: 0,
		yAxisOpposite: false,
		yAxisReversed: false,
		yAxisTitle: "Count",
		yTickInterval: null,
		yTickLength: 10,
		yTickPositions: null,
		showLegend: false,
		showCredits: false,
		ttHeaderFormat: "", // "{point.key}<br/>",
		ttBodyFormat: "<b>{point.y}</b> results",
		ttFooterFormat: "",
		cssHeight: "200px",
		version: 0,
		zoom: "x",
		eventXAxisSetExtremes: angular.bind(this, function(event) {
			/* In case that:
			 * - chart is being zoomed,
			 * - the selected area does not mean any zoom,
			 * - the zoom is so close that there wouldn't be unique values for seconds on X-axis (test for this is near the bottom of this function)
			 * don't do anything.
			 */ 
			if (this.isChartBeingZoomed || ( !angular.isDefined(event.min) && !angular.isDefined(event.max) ) )
				return;
			else
				this.isChartBeingZoomed = true;
			
			var dataSize = this.chartRawData.length,
				minIdx, maxIdx,
				newMin, newMax;
			if ( !angular.isNumber( event.min ) )
				event.min = 0;
			if ( !angular.isNumber( event.max ) )
				event.max = dataSize - 1;
			minIdx = Math.floor(event.min);
			maxIdx = Math.ceil(event.max);
			newMin = Math.round( (event.min - minIdx) * ( this.chartRawData[ minIdx+1 ][0] - this.chartRawData[ minIdx   ][0] ) + this.chartRawData[ minIdx ][0] ); // timestamp
			newMax = Math.round( (event.max - maxIdx) * ( this.chartRawData[ maxIdx   ][0] - this.chartRawData[ maxIdx-1 ][0] ) + this.chartRawData[ maxIdx ][0] ); // timestamp
			
			if (newMax - newMin < 1000*this.chartCategoriesCount) {
				$timeout( angular.bind(this, this.chart.api["zoomOut"]), 1000); // this removes the zoom button and chart internal zoom
				$timeout( angular.bind(this, function() {this.isChartBeingZoomed = false;}), 2000); // this makes the chart zoomable again
				return;
			}
			
			this.chartZoomedExtremes["min"] = newMin;
			this.chartZoomedExtremes["max"] = newMax;
//			this.search( Utils.dateToStrUtc( new Date(newMin) ), Utils.dateToStrUtc( new Date(newMax) ) );
			console.debug("SEARCH: Set axis extremes");
			this.search();
		})
	};
    
    var now = new Date(); now.setMilliseconds(0); now.setSeconds(0);
	this.startDate = new Date( now.getTime() - 24*60*60*1000 ); //subtract 1 day
	this.endDate   = new Date( now.getTime() );
	this.startDateString = "";
	this.endDateString   = "";
//	this.chartStartDate = null;
//	this.chartEndDate = null;
	this.isFirstTime = true;
	
    this.stepMillis = 3600000;
    this.stepOptions = [
        {label:"1 second",		value:      1000 },
        {label:"5 seconds",		value:      5000 },
        {label:"10 seconds",	value:     10000 },
        {label:"1 minute",		value:     60000 },
        {label:"5 minutes",		value:    300000 },
        {label:"10 minutes",	value:    600000 },
        {label:"1 hour",		value:   3600000 },
        {label:"5 hours",		value:  18000000 },
        {label:"10 hours",		value:  36000000 },
        {label:"1 day",			value:  86400000 },
        {label:"7 days",		value: 604800000 },
        {label:"30 days",		value:2592000000 }
    ];
    
    this.currentPage = 1;
    this.numPerPage = 10;
    this.maxPagerSize = 10;
    this.numPages = 1;
    this.expandedRows = [false, false, false, false, false, false, false, false, false, false];

//    this.isDateRangeCollapsed = true;
//    this.isColumnListCollapsed = false;
    this.isWaitingForResults = false;
    
    this.Math = Math;
    
    this.getCollectionsForSearch = function() {
    	Group.getAll({tenantId: Auth.user.tenantId})
    	.then(angular.bind(this, function(result) { // result = {data:string|Object, headers:function, config:Object, status:number, statusText:string}
    		var groups = result.data["groups"],
    			promises = [];
        	for (var i=0; i<groups.length; i++) {
        		promises.push(
    				Application.getAppsByGroup({
	        			groupId: groups[i][0]
	        		})
        		);
        	}
        	return $q.all( promises );
    	}))
    	.then(angular.bind(this, function(resultList) { // previous function returns an array of results!
    		var apps = [], promises = [],
	    		selectedAppGuid = Globals["search"]["selectedApplicationGuid"];
    		for (var i=0; i<resultList.length; i++) {
    			apps = apps.concat( resultList[i].data["applications"] );
    		}
	    	for (var i=0; i<apps.length; i++) {
	    		this.applicationList.push({
	    			guid: apps[i][0],
	    			name: apps[i][1]
	    		});
	    		this.collectionListByApp[ apps[i][0] ] = [];
	    		promises.push(
    				Collection.getCollectionsByApp({
		    			applicationId: apps[i][0]
		    		})
	    		);
	    	}
	    	if ( angular.isString( selectedAppGuid ) && selectedAppGuid.length > 0 &&
	    			angular.isObject( this.applicationList[ selectedAppGuid ] ) )
	    		this.selectedAppGuid = selectedAppGuid;
			else if ( angular.isArray( this.applicationList ) && this.applicationList.length > 0 )
				this.selectedAppGuid = this.applicationList[0]["guid"];
	    	
	    	return $q.all( promises );
    	}))
    	.then(angular.bind(this, function(resultList) {  // previous function returns an array of results!
    		var prevSelectedColGuid = Globals["search"]["selectedCollectionGuid"],
    			collections;
    		for (var i=0; i<resultList.length; i++) {
    			collections = resultList[i].data["collections"];
    			for (var j=0; j<collections.length; j++) {
    				this.collectionList.push({
    					guid: collections[j][0],
    					name: collections[j][1]
    				});
    				this.collectionListByApp[ resultList[i].config["data"]["applicationId"] ].push({
    					guid: collections[j][0],
    					name: collections[j][1]
    				});
    			}
    		}
	    	
	    	if ( !angular.isString( this.selectedColGuid ) || this.selectedColGuid.length == 0 ) {
	    		if ( angular.isString( prevSelectedColGuid ) && prevSelectedColGuid.length > 0 )
	        		this.selectedColGuid = prevSelectedColGuid;
	    		else if ( angular.isString( this.selectedAppGuid ) && this.selectedAppGuid.length > 0 )
	    			this.selectedColGuid = this.collectionListByApp[ this.selectedAppGuid ][0]["guid"];
	    		console.debug("SEARCH: after get collections");
	    		this.search();
	    	}
    	}))
    	.catch(function(result) {
    		console.error("There was an error when calling API function:");
        	console.error(result);
    	});
    };
    
    this.formatResults = function(input, columns) {
    	var output = [];
    	if (input.length == 0)
    		return output;

		for (var i=0; i<input.length; i++) {
    		var dataRow = {
				__idx: i,
    			__expanded: false
    		};
			for (var key in columns) {
    			if ( angular.isArray( input[i][key] ) ) {
    				dataRow[key] = "";
    				for (var j=0; j<input[i][key].length; j++)
    					dataRow[key] += input[i][key][j] + ", ";
    				dataRow[key] = dataRow[key].slice(0, dataRow[key].length - 2);
    			}
    			else if (typeof input[i][key] != "undefined") {
    				dataRow[key] = input[i][key].toString();
    			}
    			else {
    				dataRow[key] = " ";
    			}
			}
			output.push(dataRow);
		}
    		
    	return output;
    };
    
    this.getDatetimeCategories = function(input) {
    	var size = input.length,
    		dates = [],
    		whereThingsChange = [],
    		topChange = "", // year, month, day, ...
    		tmp = [],
    		output = [];
    	var hasUniqueValues = function(arr) {
    		var u = {};
			for (var i=0; i<arr.length; i++){
				if ( u.hasOwnProperty( arr[i] ) ) {
					return false;
				}
				u[ arr[i] ] = true;
			}
			return true;
    	};
    	var markIdxWhereThingsChange = function(dateArr) {
    		var maxIdx = dateArr.length - 1,
    			res = {year:[], month:[], day:[], hour:[], minute:[], second:[], top:""},
    			top = [];
    		for (var i=1; i<=maxIdx; i++) {
    			var prevDateObj	= dateToObj( dateArr[i-1] ),
    				dateObj		= dateToObj( dateArr[i] );
    			if (     dateObj.year   != prevDateObj.year)
    				{res["year"].push(i);	top.push("year");} 
    			else if (dateObj.month  != prevDateObj.month)
    				{res["month"].push(i);	top.push("month");}
    			else if (dateObj.day    != prevDateObj.day)
    				{res["day"].push(i);	top.push("day");}
    			else if (dateObj.hour   != prevDateObj.hour)
    				{res["hour"].push(i);	top.push("hour");}
    			else if (dateObj.minute != prevDateObj.minute)
    				{res["minute"].push(i);	top.push("minute");}
    			else if (dateObj.second != prevDateObj.second)
    				{res["second"].push(i);	top.push("second");}
    		}
			if (      top.indexOf("year")	>= 0 )
				res["top"] = "year";
			else if ( top.indexOf("month")	>= 0 )
				res["top"] = "month";
			else if ( top.indexOf("day")	>= 0 )
				res["top"] = "day";
			else if ( top.indexOf("hour")	>= 0 )
				res["top"] = "hour";
			else if ( top.indexOf("minute")	>= 0 )
				res["top"] = "minute";
			else if ( top.indexOf("second")	>= 0 )
				res["top"] = "second";
    		return res;
    	};
    	var dateToObj = function(date) {
    		return {
    			year:	date.getFullYear(),
    			month:	date.getMonth(),
    			day:	date.getDate(),
    			hour:	date.getHours(),
    			minute:	date.getMinutes(),
    			second:	date.getSeconds()
    		}; 
    	};
    	var pad = function(number) {
    		return (number<10? "0":"") + number;
    	};
    	
    	for (var i=0; i<size; i++) {
    		dates.push( new Date(input[i]) );
    	}
    	whereThingsChange = markIdxWhereThingsChange(dates);
    	topChange = whereThingsChange["top"]; 
    	
    	// YEARS: e.g. "2008", "2009", "2010" 
    	for (var i=0; i<size; i++) {
    		tmp[i] = dates[i].getFullYear();
    	}
    	if ( hasUniqueValues(tmp) ) {
    		output = tmp;
    	}
    	else {
    	// MONTHS: e.g. "11/2014", "12/2014", "1/2015", "2/2015"
    		for (var i=0; i<size; i++) {
        		tmp[i] = (dates[i].getMonth() + 1) + "/" + dates[i].getFullYear();
        	}
        	if ( hasUniqueValues(tmp) ) {
        		output = tmp;
        	}
        	else {
        // DAYS: e.g. "12/10 2014", "12/20", "12/30", "1/9 2015", "1/19", "1/29", "2/8", "2/18 2015"
        		for (var i=0; i<size; i++) {
            		tmp[i] = (dates[i].getMonth() + 1) + "/" + dates[i].getDate() + " " + dates[i].getFullYear();
            	}
            	if ( hasUniqueValues(tmp) ) {
            		for (var i=0; i<size; i++) {
            			if (i == 0 || i == (size-1) || whereThingsChange["year"].indexOf(i) >= 0) {
            				output[i] = (dates[i].getMonth() + 1) + "/" + dates[i].getDate() + " " + dates[i].getFullYear();
            			}
            			else {
            				output[i] = (dates[i].getMonth() + 1) + "/" + dates[i].getDate();
            			}
            		}
            	}
            	else {
		// HOURS: e.g. "6/18 20:33", "21:36", "22:38", "23:40", "6/19 0:42", "1:45", "6/19 2:48"
            		for (var i=0; i<size; i++) {
                		tmp[i] = (dates[i].getMonth() + 1) + "/" + dates[i].getDate() + " " + dates[i].getHours();
                	}
                	if ( hasUniqueValues(tmp) ) {
                		for (var i=0; i<size; i++) {
                			if ( ( ( i == 0 || i == (size-1) ) && topChange == "year" ) ||
                					whereThingsChange["year"].indexOf(i) >= 0 ) {
                				output[i] = (dates[i].getMonth() + 1) + "/" + dates[i].getDate() + " " + dates[i].getFullYear() + " " + dates[i].getHours() + ":" + pad( dates[i].getMinutes() );
                			}
                			else if ( ( i == 0 || i == (size-1) ) ||
                					whereThingsChange["month"].indexOf(i) >= 0 ||
                					whereThingsChange["day"].indexOf(i) >= 0 ) {
                				output[i] = (dates[i].getMonth() + 1) + "/" + dates[i].getDate() + " " + dates[i].getHours() + ":" + pad( dates[i].getMinutes() );
                			}
                			else {
                				output[i] = dates[i].getHours() + ":" + pad( dates[i].getMinutes() );
                			}
                		}
                	}
                	else {
		// MINUTES e.g. "6/18 23:43", "23:53", "6/19 0:03", "0:13", "0:23", "0:33", "6/19 0:43"
                		for (var i=0; i<size; i++) {
                    		tmp[i] = (dates[i].getMonth() + 1) + "/" + dates[i].getDate() + " " + dates[i].getHours() + ":" + dates[i].getMinutes();
                    	}
                    	if ( hasUniqueValues(tmp) ) {
                    		for (var i=0; i<size; i++) {
                    			if ( ( ( i == 0 || i == (size-1) ) && topChange == "year" ) ||
                    					whereThingsChange["year"].indexOf(i) >= 0 ) {
                    				output[i] = (dates[i].getMonth() + 1) + "/" + dates[i].getDate() + " " + dates[i].getFullYear() + " " + dates[i].getHours() + ":" + pad( dates[i].getMinutes() );
                    			}
                    			else if ( ( i == 0 || i == (size-1) ) ||
                    					whereThingsChange["month"].indexOf(i) >= 0 ||
                    					whereThingsChange["day"].indexOf(i) >= 0 ) {
                    				output[i] = (dates[i].getMonth() + 1) + "/" + dates[i].getDate() + " " + dates[i].getHours() + ":" + pad( dates[i].getMinutes() );
                    			}
                    			else {
                    				output[i] = dates[i].getHours() + ":" + pad( dates[i].getMinutes() );
                    			}
                    		}
                    	}
                    	else {
		// SECONDS e.g. "13:58:56", "59:06", "59:16", "59:26", "59:36", "59:46", "59:56", "14:00:06", "14:00:16"
                    		for (var i=0; i<size; i++) {
                        		tmp[i] = dates[i].getDate() + " " + dates[i].getHours() + ":" + dates[i].getMinutes() + ":" + dates[i].getSeconds();
                        	}
                        	if ( hasUniqueValues(tmp) ) {
                        		for (var i=0; i<size; i++) {
                        			if ( ( ( i == 0 || i == (size-1) ) && topChange == "year" ) ||
                        					whereThingsChange["year"].indexOf(i) >= 0 ) {
                        				output[i] = (dates[i].getMonth() + 1) + "/" + dates[i].getDate() + " " + dates[i].getFullYear() + " " + dates[i].getHours() + ":" + pad( dates[i].getMinutes() ) + ":" + pad( dates[i].getSeconds() );
                        			}
                        			else if ( ( ( i == 0 || i == (size-1) ) && ( topChange == "month" || topChange == "day") ) ||
                        					whereThingsChange["month"].indexOf(i) >= 0 ||
                        					whereThingsChange["day"].indexOf(i) >= 0 ) {
                        				output[i] = (dates[i].getMonth() + 1) + "/" + dates[i].getDate() + " " + dates[i].getHours() + ":" + pad( dates[i].getMinutes() ) + ":" + pad( dates[i].getSeconds() );
                        			}
                        			else if ( ( i == 0 || i == (size-1) ) ||
                        					whereThingsChange["hour"].indexOf(i) >= 0 ) {
                        				output[i] = dates[i].getHours() + ":" + pad( dates[i].getMinutes() ) + ":" + pad( dates[i].getSeconds() );
                        			}
                        			else {
                        				output[i] = pad( dates[i].getMinutes() ) + ":" + pad( dates[i].getSeconds() );
                        			}
                        		}
                        	}
                        	else {
                        		console.error("Search results chart contains non-unique values on X-axis.");
                        	}
                    	}
                	}
            	}
        	}
    	}
    	
    	return output;
    };
    
    this.getResultColumns = function(input) {
    	var output = {},
    		selectedCount = 0;
    	if (input.length == 0)
    		return output;
    	
		for (var i=0; i<input.length; i++) {
	    	for (var key in input[i]) {
    			output[key] = false;
	    	}
    	}
    	
    	return output;
    };
    
    this.refreshResultColumns = function(newCols, oldCols) {
    	var changed = false;
    	for (var key in newCols) {
    		if (typeof oldCols[key] === "boolean") {
    			newCols[key] = oldCols[key];
    			changed = true;
    		}
    	}
    	
    	if (!changed) {
    		for (var i=0; i<this.searchResultColumnsDefault.length; i++) {
    			for (var key in newCols) {
//    			if ( key.indexOf("@") != 0 && this.searchResultColumnsDefault.indexOf(key) >= 0 ) {
    				if ( this.searchResultColumnsDefault[i].test( key ) ) // this.searchResultColumnsDefault is an array of regExps
    					newCols[key] = true;
    				changed = true;
    			}
    		}
    	}
    	
    	return newCols;
    };
    
//    this.isEqualColumns = function(oldCols, newCols) {
//    	if ( Object.keys( oldCols ).length != Object.keys( newCols ).length )
//    		return false;
//    	
//    	for (var key in oldCols) {
//    		if (typeof newCols[key] === "undefined")
//    			return false;
//    	}
//    	
//    	return true;
//    };
    
    this.formatFacets = function(input) {
    	var output = [];
    	for (var i=0; i<input.length; i++) {
    		output.push({
    			key:	input[i][0],
    			count:	input[i][1]
    		});
    	}
    	return output;
    };
    
    this.selectFacet = function(facetKey) {
    	this.facetsSelected.push(facetKey);
    };
    
    this.unselectFacet = function(facetKey) {
    	for (var i=0; i<this.facetsSelected.length; i++) {
    		if (this.facetsSelected[i] == facetKey)
    			this.facetsSelected.splice(i, 1);
    	}
    };
    
    this.resetFacets = function() {
    	this.facetsSelected = [];
    };
    
//    this.formatChartData = function(input) {
//    	var output = [];
//
//    	for (var i=0; i<input.length; i++) {
//    		var date = Utils.strToDate( input[i][0] );
//    		output.push({ x:date.getTime(), y:input[i][1] });
//    	}
//    	
//    	return output;
//    };
    
    this.copyArray = function(source) {
    	var result = [],
    		keys = Object.keys( source );
    	for (var i=0; i<keys.length; i++) {
    		result[ keys[i] ] = angular.copy( source[ keys[i] ] );
    	}
    	return result;
    };
    
    this.resetChartZoom = function() {
    	this.chartZoomedExtremes = {min:null, max:null, minStr:null, maxStr:null};
    	this.isChartZoomed = false;
    };
    
    this.search = angular.bind(this, function(startDate, endDate) {
    	if (this.selectedColGuid == null || this.selectedColGuid == "" || this.collectionList.length == 0)
    		return;
    	
    	if (this.isWaitingForResults)
    		return;
    	else
    		this.isWaitingForResults = true;
    	
    	if ( !angular.isDefined( startDate ) ) {
    		if ( angular.isNumber( this.chartZoomedExtremes["min"] ) )
    			startDate = Utils.dateToStrUtc( new Date( this.chartZoomedExtremes["min"] ) );
    		else
    			startDate = this.startDateString;
    	}
    		
    	if ( !angular.isDefined( endDate ) ) {
    		if ( angular.isNumber( this.chartZoomedExtremes["max"] ) )
    			endDate = Utils.dateToStrUtc( new Date( this.chartZoomedExtremes["max"] ) );
    		else    		
    			endDate = this.endDateString;
    	}
    	
    	var params = {
    		match: 			this.query,
    		collectionId:	this.selectedColGuid,
    		startTime:		startDate,
    		endTime:		endDate,
    		from:			(this.currentPage - 1) * this.numPerPage,
    		tstampField:	"@timestamp"
    	};
    	
    	params["success"] = angular.bind(this, function(data) {
			var columns = this.getResultColumns( data["results"] ),
				chartData = [],
				timestamps = [],
				timeCategories = [];
			
			// get aggregate-by-date timestamps and based on them, produce time categories (strings) that will be shown in the chart
			// and display the data in the timeline chart
			for (var i=0; i<data["aggregateByDate"].length; i++) {
				timestamps.push(data["aggregateByDate"][i][0]);
				chartData.push(data["aggregateByDate"][i][1]);
			}
			timeCategories = this.getDatetimeCategories( timestamps );
			this.chartZoomedExtremes["minStr"] = timeCategories[0];
			this.chartZoomedExtremes["maxStr"] = timeCategories[ timeCategories.length-1 ];
			this.chartRawData = data["aggregateByDate"];
			this.chart.api["addSeries"]( "searchResultsSeries1", "searchResultData1", {name:"Search Results", values:chartData} );
			this.chart.api["setAxisCategories"]( "x", null, timeCategories);
			// display the data in the results details table
			this.searchResult = data["results"];
			this.numResults = data["resultsCount"];
			this.formattedResults = this.formatResults( data["results"], columns );
			// get facets
			this.facets = this.formatFacets( data["aggregateByDocType"] );
			for (var i=0; i>this.expandedRows.length; i++) {
				this.expandedRows[i] = false;
			}
        	// if the search results have the same columns as the previous search, display the same columns as in the previous search
			this.searchResultColumns = this.refreshResultColumns(columns, this.searchResultColumns); 
            this.queryPrevious = this.query;
            this.numColumns = Object.keys( this.searchResultColumns ).length;
            // the zoom happens in 2 steps:
            // 1) chart internal zoom, which only magnifies the already existing data
            // 2) more detailed data are retrieved from the server and displayed
            // when data from step 2 arrive, we must reset the chart zoom created in step 1
            this.isWaitingForResults = false;
            if (this.isChartBeingZoomed) {
            	this.chart.api["zoomOut"](); // this only removes the zoom button and chart internal zoom
            	this.isChartZoomed = true;
            	this.isChartBeingZoomed = false;
            }
        });
    	
        params["error"] = angular.bind(this, function(err) {
        	var message = "";
			if ( typeof err.message != "undefined" && angular.isString(err.message) ) {
				message = "\nMessage: " + err.message; 
			}
			UiMessage.add("danger", "An error occured during the search." + message);
			this.isWaitingForResults = false;
        });
        
        if (this.facetsSelected.length > 0) {
        	var filters = [];
        	for (var i=0; i<this.facetsSelected.length; i++) {
        		filters.push({ type:"term", "field":"_type", "value":this.facetsSelected[i] });
        	}
        	params["filters"] = filters; 
        }
        
        console.debug("SEARCH: -----> calling service");
        Search.search(params);
    });

    $scope.$watch(
		angular.bind(this, function() {
			return this.startDate;
		}),
		angular.bind(this, function(newValue) {
			this.startDateString = Utils.dateToStrUtc(this.startDate);
		})
    );
    
    $scope.$watch(
		angular.bind(this, function() {
			return this.endDate;
		}),
		angular.bind(this, function(newValue) {
			this.endDateString = Utils.dateToStrUtc(this.endDate);
		})
    );
    
    $scope.$watch(
		angular.bind(this, function() {
			return this.selectedAppGuid;
		}),
		angular.bind(this, function(newAppGuid) {
			Globals["search"]["selectedApplicationGuid"] = newAppGuid;
			if ( angular.isString( this.collectionListByApp[newAppGuid] ) && this.collectionListByApp[newAppGuid].length > 0 ) {
				this.selectedColGuid = this.collectionListByApp[newAppGuid][0]["guid"];
				Globals["search"]["selectedCollectionGuid"] = this.collectionListByApp[newAppGuid][0]["guid"];
			}
		})
    );
    
    $scope.$watch(
		angular.bind(this, function() {
			return this.selectedColGuid;
		}),
		angular.bind(this, function(newColGuid) {
			if ( angular.isString( newColGuid ) && newColGuid.length > 0 ) { 
				Globals["search"]["selectedCollectionGuid"] = newColGuid;
			}
		})
    );
    
	this.openDatePickerModal = function() {
		var modalInstance = $modal.open({
    		templateUrl: "partials/searchDatePickerModal.html",
    		controller: "searchDatePickerModalCtrl as modal",
    		resolve: {
    			startMillis: angular.bind(this, function() {
					return this.startDate.getTime();
    			}),
    			endMillis: angular.bind(this, function() {
					return this.endDate.getTime();
    			})
    		}
    	});

		modalInstance.result.then(
			angular.bind(this, function(result) {
				this.startDate = result.startDate;
				this.endDate   = result.endDate;
			})
		);
		
		return false;
	};
	
	// perform initial actions
	this.getCollectionsForSearch();

}]);

angular.module("insightal.search")
		.controller("searchDatePickerModalCtrl", [
			"$scope", "$modalInstance", "startMillis", "endMillis", function(
			 $scope,   $modalInstance,   startMillis,   endMillis) {
	this.startDate = new Date( startMillis );
    this.endDate   = new Date( endMillis );
			
	this.save = function() {
		if ( !angular.isDate( this.startDate ) )
			this.startDate = new Date( Date.parse( this.startDate ) );
		if ( !angular.isDate( this.endDate ) )
			this.endDate = new Date( Date.parse( this.endDate ) );
		
		$modalInstance.close({
			startDate: this.startDate,
			endDate: this.endDate
		});
	};
	
	this.cancel = function() {
		$modalInstance.dismiss();
	};
	
	this.setRange = function(type) {
		var start = new Date(),
			end   = new Date();
		
		if      (type === "hourThis") {
			start.setMilliseconds(0);
			start.setSeconds(0);
			start.setMinutes(0);
		}
		else if (type === "dayThis") {
			start.setMilliseconds(0);
			start.setSeconds(0);
			start.setMinutes(0);
			start.setHours(0);
		}
		else if (type === "weekThis") {
			start.setTime( start.getTime() - 86400000*start.getDay() );
			start.setMilliseconds(0);
			start.setSeconds(0);
			start.setMinutes(0);
			start.setHours(0);
		}
		else if (type === "monthThis") {
			start.setMilliseconds(0);
			start.setSeconds(0);
			start.setMinutes(0);
			start.setHours(0);
			start.setDate(1);
		}
		else if (type === "hourLast") {
			end.setMilliseconds(0);
			end.setSeconds(0);
			end.setMinutes(0);
			start.setTime( end.getTime() - 3600000 );
			end.setTime( end.getTime() - 1 );
		}
		else if (type === "dayLast") {
			end.setMilliseconds(0);
			end.setSeconds(0);
			end.setMinutes(0);
			end.setHours(0);
			start.setTime( end.getTime() - 86400000 );
			end.setTime( end.getTime() - 1 );
		}
		else if (type === "weekLast") {
			end.setTime( end.getTime() - 86400000*end.getDay() - 0 );
			end.setMilliseconds(0);
			end.setSeconds(0);
			end.setMinutes(0);
			end.setHours(0);
			start.setTime( end.getTime() - 604800000 );
			end.setTime( end.getTime() - 1 );
		}
		else if (type === "monthLast") {
			end.setMilliseconds(0);
			end.setSeconds(0);
			end.setMinutes(0);
			end.setHours(0);
			end.setDate(1);
			start.setTime( end.getTime() );
			start.setMonth( end.getMonth() - 1 );
			end.setTime( end.getTime() - 1 );
		}
		
		this.startDate = start;
		this.endDate = end;
	}
}]);