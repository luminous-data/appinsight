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
	.service("InChartUtils", [
	    "$rootScope", function(
		 $rootScope) {
	    	
	var isInt = function(x) {
		return isFinite(x) && x%1 === 0 && !angular.isString(x);
	}
	    	
	var isOptionRequested = function(optionMeta, cfg) {
		if (!(cfg["editableBy"] == "all") &&
			!(cfg["editableBy"] == "user"   && optionMeta["modifyType"].indexOf("user") >= 0) &&
			!(cfg["editableBy"] == "script" && optionMeta["modifyType"].indexOf("script") >= 0) &&
			!(cfg["editableBy"] == "none"   && optionMeta["modifyType"].length == 0) )
			return false;
		
		if ( cfg["groups"].indexOf("all") < 0 &&
			 cfg["groups"].indexOf( optionMeta["group"] ) < 0 )
			return false;
		
		// private options are always printed to options-object
		// private options are printed to options-meta-object, if you explicitly ask for them (cfg["groups"] contains "private")
		if ( optionMeta["group"] == "private" && cfg["optionsType"] == "meta" && cfg["groups"].indexOf("private") < 0 )
			return false;
		
		return true;
	};
	    	
	var getChartOptionsInternal = function(args, optionsMeta, optionsType) {
		var options = {},
			meta = {},
			cfg = { // config defaults of this function, replaced by args object values (if defined)
				chartType: "common",
				editableBy: "all", //other options: "user", "script", "none"
				groups: ["all"],
				optionsType: "regular"
			};
		
		cfg = angular.extend(cfg, args);
		if ( !angular.isObject( optionsMeta[ cfg["chartType"] ] ) ) {
			console.error("inCharts.services.js (getChartOptions): The chart type ('" + cfg["chartType"] + "') doesn't exist.");
			return;
		}
		if ( !angular.isString( optionsType ) ) {
			optionsType = "regular";
		}
		else {
			cfg["optionsType"] = optionsType;
		}
		
		var inheritFrom = function(name) {
			var parent = optionsMeta[name]["_parent"]["defaultVal"];
			if ( angular.isString( parent ) )
				return angular.extend( inheritFrom(parent), optionsMeta[name] );
			else
				return angular.copy( optionsMeta[name] );
		};
		meta = inheritFrom( cfg["chartType"] );
		delete meta["_parent"];
//		console.debug("meta (" + optionsType + ", " + cfg["chartType"] + "):");
//		console.debug(meta);
		
		for (var key in meta) {
			if ( isOptionRequested( meta[key], cfg ) ) {
				if (optionsType == "regular")
					options[key] = angular.copy( meta[key]["defaultVal"] );
				else if (optionsType == "meta")
					options[key] = angular.copy( meta[key] );
			}
		}
		
		return options;
	};
	
	var optionsToArray = function(options) {
		var optionsArray = [];
		for (var key in options) {
			var item = options[key];
			item["name"] = key;
			optionsArray.push( item );
		}
		
		optionsArray.sort(function(x, y) {
			if ( angular.isNumber( x.ord ) ) {
				return angular.isNumber(y.ord)? (x.ord - y.ord) : -1; 
			}
			else {
				return angular.isNumber(y.ord)?  1 : 0;
			}
		});
		return optionsArray;
	};
	
	// returns chart options for specified chart type with default values filled in
	this.getChartOptions = function(args) {
		return getChartOptionsInternal(args, this.chartOptionsMeta,  "regular");
	};
	
	// returns series options for specified chart type with default values filled in
	this.getSeriesOptions = function(args) {
		return getChartOptionsInternal(args, this.seriesOptionsMeta,  "regular");
	};
	
	// returns chart options metadata (option description)
	this.getChartOptionsMeta = function(args) {
		return getChartOptionsInternal(args, this.chartOptionsMeta,  "meta");
	};
	
	// returns series options metadata (option description)
	this.getSeriesOptionsMeta = function(args) {
		return getChartOptionsInternal(args, this.seriesOptionsMeta,  "meta");
	};
	
	// returns chart options metadata (option description) as an array, ordered by "ord" property values
	this.getChartOptionsMetaArray = function(args) {
		var options = getChartOptionsInternal(args, this.chartOptionsMeta, "meta");
		return optionsToArray(options);
	};
	
	// returns series options metadata (option description) as an array, ordered by "ord" property values
	this.getSeriesOptionsMetaArray = function(args) {
		var options = getChartOptionsInternal(args, this.seriesOptionsMeta, "meta");
		return optionsToArray(options);
	};
	
	var isExistingLocation = function(obj, loc) {
		var current = angular.copy(obj);
		if ( !angular.isObject(loc) || !angular.isArray(loc) )
			return false;
		for (var i=0; i<loc.length; i++) {
			current = current[ loc[i] ];
			if (typeof current === "undefined")
				return false;
		}
		return true;
	};
	
	var getValueByLocation = function(obj, loc) {
		var current = angular.copy(obj);
		for (var i=0; i<loc.length; i++)
			current = current[ loc[i] ];
		return current;
	};
	
	var setValueByLocation = function(obj, loc, val) {
		var current = obj;
		for (var i=0; i<loc.length-1; i++) {
			if ( isInt( loc[i+1] ) ) {
				if ( !angular.isDefined( current[ loc[i] ] ) ) {
					current[ loc[i] ] = [];
				}
				else if ( !angular.isArray( current[ loc[i] ] ) ) {
					console.error("inCharts.services.js (setValueByLocation): The location inside the object is not reachable. The following key does not point to an array: " + loc[i]);
					return;
				}
			}
			else {
				if ( !angular.isDefined( current[ loc[i] ] ) ) {
					current[ loc[i] ] = {};
				}
				else if ( !angular.isObject( current[ loc[i] ] ) ) {
					console.error("inCharts.services.js (setValueByLocation): The location inside the object is not reachable. The following key does not point to an object: " + loc[i]);
					return;
				}
			}
			current = current[ loc[i] ];
		}
		current[ loc[loc.length-1] ] = angular.copy(val);
	};
	
	// fills in chart options (public chart state defined by outer page) based on chart config (inCharts private definition used to create the chart)
	this.fillChartOptions = function(chartConfig, chartOptions) {
		if ( !angular.isObject( chartConfig ) ) {
			console.error("inCharts.services.js (fillChartOptions): The chart config is not an object.");
			return;
		}
		if ( !angular.isObject( chartOptions ) ) {
			console.error("inCharts.services.js (fillChartOptions): The chart options is not an object.");
			return;
		}
		
		var optionsMeta = this.getChartOptionsMeta({ chartType:chartConfig["chart"]["type"] });
		for (var key in optionsMeta) {
			if ( isExistingLocation( chartConfig, optionsMeta[key]["location"] ) ) {
				chartOptions[key] = getValueByLocation( chartConfig, optionsMeta[key]["location"] );
			}
		}
		
		return chartOptions;
	};
	
	// fills in chart config (inCharts private definition used to create the chart) based on chart options (public chart state defined by outer page)
	// The function can be also used to fill in series config (just use different optionsMeta).
	this.fillChartConfig = function(chartOptions, chartConfig, optionsMeta) {
		if ( !angular.isObject( chartOptions ) ) {
			console.error("inCharts.services.js (fillChartConfig): The chart options is not an object.");
			return;
		}
		if ( !angular.isObject( chartConfig ) ) {
			console.error("inCharts.services.js (fillChartConfig): The chart config is not an object.");
			return;
		}
		if ( !angular.isString( chartOptions["type"] ) || !angular.isObject( this.chartOptionsMeta[ chartOptions["type"] ] ) ) {
			console.error("inCharts.services.js (fillChartConfig): The chart options metadata for chart type '" + chartOptions["type"] + "' does not exist.");
			return;
		}
		
		for (var key in chartOptions) {
			if ( angular.isObject( optionsMeta[key] ) && angular.isArray( optionsMeta[key]["location"] ) ) {
				var value = chartOptions[key];
				if (optionsMeta[key]["type"] === "int") {
					value = parseInt(value);
					if ( isNaN(value) ) {
						value = optionsMeta[key]["defaultVal"];
					}
				}
				if (optionsMeta[key]["type"] === "float") {
					value = parseFloat(value);
					if ( isNaN(value) ) {
						value = optionsMeta[key]["defaultVal"];
					}
				}
				setValueByLocation(chartConfig, optionsMeta[key]["location"], value);
			}
		}
		
		return chartConfig;
	};
	
	/**
	 * persist all options that are:
	 * 1) defined by inCharts module AND are not from group "transient"
	 * 2) not defined by inCharts module (i.e. anything unknown by this module is left untouched)
	 */
	this.getPersistentOptions = function(chartOptions) {
		var chartType = chartOptions["type"],
			optionsMeta,
			res = {};
		if ( !angular.isString( chartType ) ) {
			console.error("inCharts.services.js (getPersistentOptions): Cannot find chart type in chart options.");
			return;
		}
		
		optionsMeta = this.getChartOptionsMeta({ chartType:chartType });
		for (var key in chartOptions) {
			if ( typeof optionsMeta[key] === "undefined" || optionsMeta[key]["group"] != "transient") {
				res[key] = angular.copy( chartOptions[key] );
			}
		}
		return res;
	};
	
	this.fillTransientOptionsIfEmpty = function(chartOptions) {
		var chartType = chartOptions["type"],
			optionsMeta;
		if ( !angular.isString( chartType ) ) {
			console.error("inCharts.services.js (fillTransientOptionsIfEmpty): Cannot find chart type in chart options.");
			return;
		}
		
		optionsMeta = this.getChartOptionsMeta({ chartType:chartType });
		for (var key in optionsMeta) {
			if (optionsMeta[key]["group"] === "transient" &&
				typeof chartOptions[key]  === "undefined") {
				chartOptions[key] = angular.copy( optionsMeta[key]["defaultVal"] );
			}
		}
		return chartOptions;
	};
	
	this.fillNonUserConfigurableOptionsByDefaults = function(chartOptions) {
		var chartType = chartOptions["type"],
			optionsMeta;
		if ( !angular.isString( chartType ) ) {
			console.error("inCharts.services.js (fillNonUserConfigurableOptions): Cannot find chart type in chart options.");
			return;
		}
		
		optionsMeta = this.getChartOptionsMeta({ chartType:chartType, editableBy:"none" });
		for (var key in optionsMeta) {
			chartOptions[key] = angular.copy( optionsMeta[key]["defaultVal"] );
		}
		return chartOptions;
	};
	
	this.getChartOptionGroups = function() {
		return angular.copy( this.chartOptionGroups );
	};
	
	this.getChartOptionGroupsArray = function() {
		return optionsToArray( this.chartOptionGroups );
	};
	
	this.formatData = function(data, seriesOptions, chartOptions) {
		var out = null;
		
//		if (chartOptions["xAxisType"] == "datetime") {
//			for (var i=0; i<data["values"].length; i++) {
//				data["values"][i][0] = Highcharts.dateFormat( chartOptions["xAxisDataFormat"], data["values"][i][0] ); 
//			}
//		}
//		if (chartOptions["yAxisType"] == "datetime") {
//			for (var i=0; i<data["values"].length; i++) {
//				data["values"][i][1] = Highcharts.dateFormat( chartOptions["yAxisDataFormat"], data["values"][i][1] ); 
//			}
//		}
		
		if (seriesOptions["type"] == "pie") {
			out = [];
			for (var i=0; i<data["values"].length; i++) {
				out.push({
					name:	data["values"][i][0],
					y:		data["values"][i][1]
				});
			}
		}
		else {
			out = angular.copy( data["values"] );
		}
		
		return out;
	};
	
	this.formatPoint = function(point, config) {
		if (config["xDataType"] == "time") {
			point[0] = Highcharts.dateFormat( config["xDataFormat"], point[0] ); 
		}
		if (config["yDataType"] == "time") {
			point[1] = Highcharts.dateFormat( config["yDataFormat"], point[1] ); 
		}
		
		return point;
	};
	
	this.getIndexById = function(id, array, idKeys) {
		// maximum depth in array objects where id can be searched is 3 levels
		if ( angular.isArray(idKeys) && idKeys.length > 0 ) {
			for (var i=0; i<idKeys.length; i++) {
				if ( !angular.isNumber( idKeys[i] ) && !angular.isString( idKeys[i] ) )
					return null;
			}
		}
		else {
			idKeys = ["id"];
		}
		
		if (idKeys.length == 1) {
			for (var i=0; i<array.length; i++) {
				if (typeof array[i] !== "undefined"
					&& typeof array[i][ idKeys[0] ] !== "undefined" 
					&& array[i][ idKeys[0] ] == id)
					return i;
			}
		}
		if (idKeys.length == 2) {
			for (var i=0; i<array.length; i++) {
				if (typeof array[i] !== "undefined"
					&& typeof array[i][ idKeys[0] ] !== "undefined"
					&& typeof array[i][ idKeys[0] ][ idKeys[1] ] !== "undefined" 
					&& array[i][ idKeys[0] ][ idKeys[1] ] == id)
					return i;
			}
		}
		if (idKeys.length == 3) {
			for (var i=0; i<array.length; i++) {
				if (typeof array[i] !== "undefined"
					&& typeof array[i][ idKeys[0] ] !== "undefined"
					&& typeof array[i][ idKeys[0] ][ idKeys[1] ] !== "undefined"
					&& typeof array[i][ idKeys[0] ][ idKeys[1] ][ idKeys[2] ] !== "undefined" 
					&& array[i][ idKeys[0] ][ idKeys[1] ][ idKeys[2] ] == id)
					return i;
			}
		}
		
		return -1;
	};
	
	this.getElementById = function(id, array, idKeys) {
		var idx = this.getIndexById(id, array, idKeys);
		return (idx >= 0)? array[idx] : null;
	};
	
	this.getIndexStartingById = function(id, array, idKeys) {
		var result = [];
		
		// maximum depth in array objects where id can be searched is 3 levels
		if ( angular.isArray(idKeys) && idKeys.length > 0 ) {
			for (var i=0; i<idKeys.length; i++) {
				if ( !angular.isNumber( idKeys[i] ) && !angular.isString( idKeys[i] ) )
					return null;
			}
		}
		else {
			idKeys = ["id"];
		}
		
		if (idKeys.length == 1) {
			for (var i=0; i<array.length; i++) {
				if (typeof array[i] !== "undefined"
					&& typeof array[i][ idKeys[0] ] !== "undefined" 
					&& array[i][ idKeys[0] ].indexOf(id) == 0 )
					result.push(i);
			}
		}
		if (idKeys.length == 2) {
			for (var i=0; i<array.length; i++) {
				if (typeof array[i] !== "undefined"
					&& typeof array[i][ idKeys[0] ] !== "undefined"
					&& typeof array[i][ idKeys[0] ][ idKeys[1] ] !== "undefined" 
					&& array[i][ idKeys[0] ][ idKeys[1] ].indexOf(id) == 0)
					result.push(i);
			}
		}
		if (idKeys.length == 3) {
			for (var i=0; i<array.length; i++) {
				if (typeof array[i] !== "undefined"
					&& typeof array[i][ idKeys[0] ] !== "undefined"
					&& typeof array[i][ idKeys[0] ][ idKeys[1] ] !== "undefined"
					&& typeof array[i][ idKeys[0] ][ idKeys[1] ][ idKeys[2] ] !== "undefined" 
					&& array[i][ idKeys[0] ][ idKeys[1] ][ idKeys[2] ].indexOf(id) == 0)
					result.push(i);
			}
		}
		
		return result;
	};
	
	this.getElementStartingById = function(id, array, idKeys) {
		var idxArray = this.getIndexStartingById(id, array, idKeys),
			result = [];
		for (var i=0; i<idxArray.length; i++)
			result.push( array[i] );
		return result;
	};
	
	this.generateUUID = function() {
		var d = new Date().getTime();
		var uuid = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
			var r = (d + Math.random()*16)%16 | 0;
			d = Math.floor(d/16);
			return (c=="x" ? r : (r&0x7|0x8)).toString(16);
		});
		return uuid;
	};
	
	this.chartOptionGroups = {
		private:	{ord: -1, 	title:"Private",		description:""},
		transient:	{ord: -1, 	title:"Transient",		description:""},
		general:	{ord: 1, 	title:"General",		description:"General options"},
		series:		{ord: 2, 	title:"Series",			description:"Chart data options"},
		axesX:		{ord: 3, 	title:"X Axis",			description:""},
		axesY:		{ord: 4, 	title:"Y Axis",			description:""}//,
//		tooltips:	{ord: 5, 	title:"Tooltips",		description:"Tooltips for chart data points"}
	};
	
	/**
	 * OPTIONS PROTOTYPES:
	 * text: 			{ord: 5,	type:"float",		group:"general",	defaultVal:0,		title:"Text Option",				modifyType:["user"],	configType:"text"},
	 * textArea:		{ord: 6,	type:"string",		group:"general",	defaultVal:"",		title:"Text Area Option",			modifyType:["user"],	configType:"textArea"},
	 * selectOne:		{ord: 7,	type:"string",		group:"general",	defaultVal:"",		title:"Select One Option",			modifyType:["user"],	configType:"selectOne",		values:[{value:"mon",label:"Monday"},{value:"tue",label:"Tuesday"},{value:"wed",label:"Wednesday"}]},
	 * selectOneRadio:	{ord: 8,	type:"int",			group:"general",	defaultVal:1,		title:"Select One Radio Option",	modifyType:["user"],	configType:"selectOneRadio",values:[{value:1,label:"January"},{value:2,label:"February"},{value:3,label:"March"}]},
	 * selectMultiple:	{ord: 9,	type:"array<string>",group:"general",	defaultVal:[],		title:"Select Multiple Option",		modifyType:["user"],	configType:"selectMultiple",values:[{value:"banana",label:"Banana"},{value:"orange",label:"Orange"},{value:"apple",label:"Apple"}]},
	 * selectBoolean:	{ord: 10,	type:"boolean",		group:"general",	defaultVal:false,	title:"Select Boolean Option",		modifyType:["user"],	configType:"selectBoolean"},
	 * integer:			{ord: 11,	type:"int",			group:"general",	defaultVal:0,		title:"Select Integer Option",		modifyType:["user"],	configType:"integer"},
	 * integerRange:	{ord: 12,	type:"int",			group:"general",	defaultVal:0,		title:"Select Integer Range Option",modifyType:["user"],	configType:"integerRange", valueMin:10, valueMax:1500},
	 * color:			{ord: 13,	type:"string",		group:"general",	defaultVal:"",		title:"Select Color Option",		modifyType:["user"],	configType:"color"}
	 */
	
	this.chartOptionsMeta = {
		common: { // if the option is not to be saved inside the chart config object, just leave out the "location" property
			_parent:			{ord: -1,	type:"string",		group:"private",											defaultVal: null,									modifyType:[],			configType:null},
			api:				{ord: -1,	type:"object",		group:"transient",	/*used for chart API*/					defaultVal:{},			title:"",					modifyType:["script"],	configType:null},
			apiStack:			{ord: -1,	type:"array",		group:"transient",	/*used for chart API future calls*/		defaultVal:[],			title:"",					modifyType:["script"],	configType:null},
//			eventHandlers:		{ord: -1,	type:"object",		group:"transient",	/*used for chart event handlers*/		defaultVal:{/*see init block*/}, title:"",			modifyType:["script"],	configType:null},
			add:				{ord: -1,	type:"object",		group:"additional",	/*outer page can store data here*/		defaultVal:{},			title:"",					modifyType:["script"],	configType:null},
			series:				{ord: -1,	type:"array",		group:"series",		/*container for series options*/		defaultVal:[],			title:"",					modifyType:["script"],	configType:null},
			guid:				{ord:  1,	type:"string",		group:"general",	location: ["guid"],						defaultVal:"",			title:"",					modifyType:["script"],	configType:null},
			type:				{ord:  2,	type:"string",		group:"general",	location: ["chart","type"],				defaultVal:"line",		title:"Chart Type",			modifyType:["user"],	configType:"selectOne", values:[/*created in init block*/]},
//			typeName:			{ord:  3,	type:"string",		group:"general",	location: ["chart","typeName"],			defaultVal:null,		title:"",					modifyType:["script"],	configType:null},
			active:				{ord:  4,	type:"string",		group:"general",	location: ["active"],					defaultVal:1,			title:"",					modifyType:["script"],	configType:null},
	 		title:				{ord:  5,	type:"string",		group:"general",	location: ["title","text"],				defaultVal:null,		title:"Title",				modifyType:["user"],	configType:"text",	constraints:["required"]},
	  		subtitle:			{ord:  6,	type:"string",		group:"general",	location: ["subtitle","text"],			defaultVal:null,		title:"Subtitle",			modifyType:["user"],	configType:"text"},
	  		zoom:				{ord:  7,	type:"string",		group:"general",	location: ["chart","zoomType"],			defaultVal:"x",			title:"Zoom Type",			modifyType:["script"],	configType:"selectOne", values:[]},
	  		showLegend:			{ord: -1,	type:"boolean",		group:"general",	location: ["legend","enabled"],			defaultVal:true,		title:"",					modifyType:["script"],	configType:null},
	  		cssHeight:			{ord: -1,	type:"string",		group:"style",		location: ["style","cssHeight"],		defaultVal:"inherit",	title:"",					modifyType:["script"],	configType:"text"},
	  		xAxisType:			{ord:  8,	type:"string",		group:"axesX",		location: ["xAxis", "type"],			defaultVal:"datetime",	title:"Axis Type",			modifyType:["user"],	configType:"selectOne", values:[{value:"linear",label:"Linear"}, {value:"datetime",label:"Date and Time"},  {value:"category",label:"Categories"}]},
	  		xAxisTitle:			{ord:  9,	type:"string",		group:"axesX",		location: ["xAxis","title","text"],		defaultVal:"",			title:"Label",				modifyType:["user"],	configType:"text"},
	  		xAxisCategories:	{ord: 10,	type:"array",		group:"axesX",		location: ["xAxis", "categories"],		defaultVal:null,		title:"Displayed Categories",modifyType:["user"],	configType:"text", condition:"__chart__.xAxisType=='category'", userInfo:"Comma separated list of categories displayed on X axis."},
	  		xAxisMin:			{ord: 11,	type:"int",			group:"axesX",		location: ["xAxis", "min"],				defaultVal:null,		title:"Minimum",			modifyType:["user"],	configType:"text"},
	  		xAxisMax:			{ord: 12,	type:"int",			group:"axesX",		location: ["xAxis", "max"],				defaultVal:null,		title:"Maximum",			modifyType:["user"],	configType:"text"},
	  		xAxisOpposite:		{ord: 13,	type:"boolean",		group:"axesX",		location: ["xAxis", "opposite"],		defaultVal:false,		title:"Show Axis on Opposite Side",		modifyType:["user"],	configType:"selectBoolean"},
	  		xAxisReversed:		{ord: 14,	type:"boolean",		group:"axesX",		location: ["xAxis", "reversed"],		defaultVal:false,		title:"Reverse Direction of the Axis",	modifyType:["user"],	configType:"selectBoolean"},
	  		xAxisAllowDecimals:	{ord: 15,	type:"boolean",		group:"axesX",		location: ["xAxis", "allowDecimals"],	defaultVal:true,		title:"Allow Decimals",		modifyType:["user"],	configType:"selectBoolean"},
	  		xAxisOffset:		{ord: 16,	type:"int",			group:"axesX",		location: ["xAxis", "offset"],			defaultVal:0,			title:"Axis Offset",		modifyType:["user"],	configType:"text"},
	  		eventXAxisSetExtremes:{ord: -1,	type:"function",	group:"transient",	location: ["xAxis", "events", "setExtremes"], defaultVal:null,	title:"",					modifyType:["script"],	configType:null},
	  		xTickInterval:		{ord: 17,	type:"int",			group:"axesX",		location: ["xAxis", "tickInterval"],	defaultVal:null,		title:"Tick Interval",		modifyType:["user"],	configType:"text"},
	  		xTickLength:		{ord: 18,	type:"int",			group:"axesX",		location: ["xAxis", "tickLength"],		defaultVal:10,			title:"Tick Length",		modifyType:["user"],	configType:"text"},
	  		xTickPositions:		{ord: 19,	type:"array",		group:"axesX",		location: ["xAxis", "tickPositions"],	defaultVal:null,		title:"Tick Positions",		modifyType:["user"],	configType:"text"},
	  		xTickAmount:		{ord: -1,	type:"int",			group:"axesX",		location: ["xAxis", "tickAmount"],		defaultVal:null,		title:"Tick Amount",		modifyType:["script"],	configType:"text"},
	  		yAxisType:			{ord: 20,	type:"string",		group:"axesY",		location: ["yAxis", "type"],			defaultVal:"linear",	title:"Axis Type",			modifyType:["user"],	configType:"selectOne", values:[{value:"linear",label:"Linear"}, {value:"datetime",label:"Date and Time"},  {value:"category",label:"Categories"}]},
	  		yAxisTitle:			{ord: 21,	type:"string",		group:"axesY",		location: ["yAxis","title","text"],		defaultVal:"",			title:"Label",				modifyType:["user"],	configType:"text"},
	  		yAxisCategories:	{ord: 22,	type:"array",		group:"axesY",		location: ["yAxis", "categories"],		defaultVal:null,		title:"Displayed Categories",modifyType:["user"],	configType:"text",condition:"__chart__.yAxisType=='category'",  userInfo:"Comma separated list of categories displayed on Y axis."},
	  		yAxisMin:			{ord: 23,	type:"int",			group:"axesY",		location: ["yAxis", "min"],				defaultVal:null,		title:"Minimum",			modifyType:["user"],	configType:"text"},
	  		yAxisMax:			{ord: 24,	type:"int",			group:"axesY",		location: ["yAxis", "max"],				defaultVal:null,		title:"Maximum",			modifyType:["user"],	configType:"text"},
	  		yAxisOpposite:		{ord: 25,	type:"boolean",		group:"axesY",		location: ["yAxis", "opposite"],		defaultVal:false,		title:"Show Axis on Opposite Side",	   modifyType:["user"],	configType:"selectBoolean"},
	  		yAxisReversed:		{ord: 26,	type:"boolean",		group:"axesY",		location: ["yAxis", "reversed"],		defaultVal:false,		title:"Reverse Direction of the Axis", modifyType:["user"],	configType:"selectBoolean"},
	  		yAxisAllowDecimals:	{ord: 27,	type:"boolean",		group:"axesY",		location: ["yAxis", "allowDecimals"],	defaultVal:true,		title:"Allow Decimals",		modifyType:["user"],	configType:"selectBoolean"},
	  		yAxisOffset:		{ord: 28,	type:"int",			group:"axesY",		location: ["yAxis", "offset"],			defaultVal:0,			title:"Axis Offset",		modifyType:["user"],	configType:"text"},
	  		yTickInterval:		{ord: 29,	type:"int",			group:"axesY",		location: ["yAxis", "tickInterval"],	defaultVal:null,		title:"Tick Interval",		modifyType:["user"],	configType:"text"},
	  		yTickLength:		{ord: 30,	type:"int",			group:"axesY",		location: ["yAxis", "tickLength"],		defaultVal:10,			title:"Tick Length",		modifyType:["user"],	configType:"text"},
	  		yTickPositions:		{ord: 31,	type:"array",		group:"axesY",		location: ["yAxis", "tickPositions"],	defaultVal:null,		title:"Tick Positions",		modifyType:["user"],	configType:"text"},
	  		yTickAmount:		{ord: -1,	type:"int",			group:"axesY",		location: ["yAxis", "tickAmount"],		defaultVal:null,		title:"Tick Amount",		modifyType:["script"],	configType:"text"},
	  		ttHeaderFormat:		{ord: 41,	type:"string",		group:"tooltips",	location: ["tooltip", "headerFormat"],	defaultVal:"<span style='font-size: 10px'>{point.key}</span><br/>",	title:"Tooltip Header Format",	modifyType:["script"], configType:"text"},
	  		ttBodyFormat:		{ord: 42,	type:"string",		group:"tooltips",	location: ["tooltip", "pointFormat"],	defaultVal:"{series.name}: <b>{point.y}</b><br/>",					title:"Tooltip Body Format",	modifyType:["script"], configType:"text"},
	  		ttFooterFormat:		{ord: 43,	type:"string",		group:"tooltips",	location: ["tooltip", "footerFormat"],	defaultVal:"",														title:"Tooltip Footer Format",	modifyType:["script"], configType:"text"},
	  		txtNoDataText:		{ord: 51,	type:"string",		group:"text",		location: ["lang","noData"],			defaultVal:"No data to display.",	title:"Message to show in case there is no data",	modifyType:["script"],	configType:"text"},
	  		version:			{ord: 101,	type:"int",			group:"transient",											defaultVal:0,			title:"",					modifyType:["script"],	configType:null},
	  		showCredits:		{ord: -1,	type:"boolean",		group:"private",	location: ["credits","enabled"],		defaultVal:false,		title:"",					modifyType:[],			configType:null}
		},
		lineLike: {
			_parent:		{ord: -1,	type:"string",	group:"private",	defaultVal: "common",										title:"",					modifyType:[],			configType:null}
//	  	    xAxisDataFormat:{ord: 103,	type:"string",	group:"axes",											defaultVal:"%H:%M:%S",	title:"X Axis Data Format",	modifyType:["user"],	configType:"text"},
//	  	    yAxisDataFormat:{ord: 106,	type:"string",	group:"axes",											defaultVal:"",			title:"Y Axis Data Format",	modifyType:["user"],	configType:"text"},
	  	},
	  	line: {
	  		_parent:		{ord:  -1,	type:"string",	group:"private",	defaultVal: "lineLike",										title:"",					modifyType:[],			configType:null},
	  		lineWidth:		{ord: 101,	type:"int",		group:"general",	location: ["plotOptions", "series", "lineWidth"], defaultVal:1, title:"Line Width",		modifyType:["user"],	configType:"text"}
	  	},
	  	spline: {
	  		_parent:		{ord:  -1,	type:"string",	group:"private",	defaultVal: "lineLike",										title:"",					modifyType:[],			configType:null},
	  		lineWidth:		{ord: 101,	type:"int",		group:"general",	location: ["plotOptions", "series", "lineWidth"], defaultVal:1, title:"Line Width",		modifyType:["user"],	configType:"text"}
	  	},
	  	area: {
	  		_parent:		{ord: -1,	type:"string",	group:"private",	defaultVal: "lineLike",										title:"",					modifyType:[],			configType:null}
	  	},
	  	areaspline: {
	  		_parent:		{ord: -1,	type:"string",	group:"private",	defaultVal: "lineLike",										title:"",					modifyType:[],			configType:null}
	  	},
	  	arearange: {
	  		_parent:		{ord: -1,	type:"string",	group:"private",	defaultVal: "lineLike",										title:"",					modifyType:[],			configType:null},
	  		ttBodyFormat:	{ord: 42,	type:"string",	group:"tooltips",	location: ["tooltip", "pointFormat"],	defaultVal:"{series.name}: <b>{point.low} - {point.high}</b><br/>",		title:"Tooltip Body Format",	modifyType:[], configType:"text"}
	  	},
	  	bar: {
	  		_parent:		{ord: -1,	type:"string",	group:"private",	defaultVal: "lineLike",										title:"",					modifyType:[],			configType:null},
	  		stacking:		{ord: 201,	type:"string",	group:"general",	location: ["plotOptions","series","stacking"], defaultVal:null, title:"Stacking",		modifyType:["user"],	configType:"selectOne", values:[{value:null,label:"none"}, {value:"normal",label:"normal"}, {value:"percent",label:"percent"}]},
	  	},
	  	column: {
	  		_parent:		{ord: -1,	type:"string",	group:"private",	defaultVal: "lineLike",										title:"",					modifyType:[],			configType:null},
	  		stacking:		{ord: 201,	type:"string",	group:"general",	location: ["plotOptions","series","stacking"], defaultVal:null, title:"Stacking",		modifyType:["user"],	configType:"selectOne", values:[{value:null,label:"none"}, {value:"normal",label:"normal"}, {value:"percent",label:"percent"}]},
	  	},
	  	columnrange: {
	  		_parent:		{ord: -1,	type:"string",	group:"private",	defaultVal: "lineLike",										title:"",					modifyType:[],			configType:null},
	  		ttBodyFormat:	{ord: 42,	type:"string",	group:"tooltips",	location: ["tooltip", "pointFormat"],	defaultVal:"{series.name}: <b>{point.low} - {point.high}</b><br/>",		title:"Tooltip Body Format",	modifyType:[], configType:"text"}
	  	},
	  	scatter: {
	  		_parent:		{ord: -1,	type:"string",	group:"private",	defaultVal: "common",										title:"",					modifyType:[],			configType:null}
	  	},
//	  	bubble: {
//	  		_parent:		{ord: -1,	type:"string",	group:"private",	defaultVal: "common",										title:"",					modifyType:[],			configType:null}
//	  	},
	  	pie: {
	  		_parent:		{ord:  -1,	type:"string",	group:"private",	defaultVal: "common",										title:"",					modifyType:[],			configType:null},
//	  		showInLegend:	{ord:  -1,	type:"string",	group:"general",	location: ["plotOptions","series","showInLegend"], defaultVal:true, title:"Show series legend",	modifyType:[],	configType:"selectBoolean"},
//	  		label1Html:		{ord: -1,	type:"string",	group:"general",	location: ["labels","items",0,"html"],	defaultVal:"Time: 7/29/2015 16:01",		title:"",					modifyType:["script"],	configType:null},
//	  		label1Css:		{ord: -1,	type:"object",	group:"general",	location: ["labels","items",0,"style"],	defaultVal:{left:"0px", top:"0px"},	title:"",					modifyType:["script"],	configType:null},
	  		xAxisTitle:		{ord: 101,	type:"string",	group:"axes",		location: ["xAxis","title","text"],	defaultVal:"",			title:"X Axis Label",		modifyType:["user"],	configType:"text"},
	  	    xAxisDataType:	{ord: 102,	type:"string",	group:"axes",		location: ["xAxis","type"],			defaultVal:"datetime",	title:"X Axis Data Type",	modifyType:["user"],	configType:"text"},
	  	    xAxisDataFormat:{ord: 103,	type:"string",	group:"axes",											defaultVal:"%H:%M:%S",	title:"X Axis Data Format",	modifyType:["user"],	configType:"text"},
	  	    yAxisTitle:		{ord: 104,	type:"string",	group:"axes",		location: ["yAxis","title","text"],	defaultVal:"",			title:"Y Axis Label",		modifyType:["user"],	configType:"text"},
	  	    yAxisDataType:	{ord: 105,	type:"string",	group:"axes",											defaultVal:"",			title:"Y Axis Data Type",	modifyType:["user"],	configType:"text"},
	  	    yAxisDataFormat:{ord: 106,	type:"string",	group:"axes",											defaultVal:"",			title:"Y Axis Data Format",	modifyType:["user"],	configType:"text"},
	  	    ttHeaderFormat:	{ord:  41,	type:"string",	group:"tooltips",	location: ["tooltip", "headerFormat"],	defaultVal:"<span style='font-size: 10px'>{point.key}</span><br/>",	title:"Tooltip Header Format",	modifyType:[], configType:"text"},
	  		ttBodyFormat:	{ord:  42,	type:"string",	group:"tooltips",	location: ["tooltip", "pointFormat"],	defaultVal:"count: <b>{point.y}</b><br/>",							title:"Tooltip Body Format",	modifyType:[], configType:"text"},
	  		ttFooterFormat:	{ord:  43,	type:"string",	group:"tooltips",	location: ["tooltip", "footerFormat"],	defaultVal:"",														title:"Tooltip Footer Format",	modifyType:[], configType:"text"}
	  	}
	};
	
	// TRANSIENT FIELDS ARE NOT INITIALIZED FOR SERIES!
	this.seriesOptionsMeta = {
		common: {
			_parent:		{ord: -1,	type:"string",	group:"private",	defaultVal: null,											title:"",					modifyType:[],			configType:null},
			metric:			{ord: -1,	type:"object",	group:"additional",	/*metric definition*/				defaultVal:{},			title:"",					modifyType:["script"],	configType:null},
			metric2:		{ord: -1,	type:"object",	group:"additional",	/*metric definition*/				defaultVal:{},			title:"",					modifyType:["script"],	configType:null},
			metric2Enabled:	{ord: -1,	type:"boolean",	group:"additional",										defaultVal: false,		title:"",					modifyType:["script"],	configType:null},
			metric3:		{ord: -1,	type:"object",	group:"additional",	/*metric definition*/				defaultVal:{},			title:"",					modifyType:["script"],	configType:null},
			metric3Enabled:	{ord: -1,	type:"boolean",	group:"additional",										defaultVal: false,		title:"",					modifyType:["script"],	configType:null},
			data:			{ord: -1,	type:"array",	group:"general",	/*data to be displayed*/			defaultVal:[],			title:"",					modifyType:["script"],	configType:null},
			guid:			{ord:  1,	type:"string",	group:"general",	location: ["guid"],					defaultVal:"",			title:"",					modifyType:["script"],	configType:null},
			type:			{ord:  3,	type:"string",	group:"general",	location: ["type"],					defaultVal:"inherit",	title:"Type",				modifyType:["user"],	configType:"selectOne", values:[/*created in init block*/]},
			name:			{ord:  4,	type:"string",	group:"general",	location: ["name"],					defaultVal:"",			title:"Name",				modifyType:["user"],	configType:"text"},
			color:			{ord:  5,	type:"string",	group:"general",	location: ["color"],				defaultVal:null,		title:"Color",				modifyType:["user"],	configType:"selectOne", values:[/*created in init block*/], condition:"__series__.type!='pie' && (__series__.type!='inherit' || __chart__.type!='pie')"},
			zIndex:			{ord:  6,	type:"int",		group:"general",	location: ["zIndex"],				defaultVal:1,			title:"Stacking Index",		modifyType:["user"],	configType:"text"}
		},
		inherit: {
	  		_parent:		{ord: -1,	type:"string",	group:"private",	defaultVal: "common",										title:"",					modifyType:[],			configType:null}
	  	},
	  	line: {
	  		_parent:		{ord:  -1,	type:"string",	group:"private",	defaultVal: "common",										title:"",					modifyType:[],			configType:null},
	  		lineWidth:		{ord: 201,	type:"int",		group:"general",	location: ["lineWidth"],			defaultVal:1,			title:"Line Width",			modifyType:["user"],	configType:"text"},
	  		markerEnabled:	{ord: 202,	type:"boolean",	group:"general",	location: ["marker", "enabled"],	defaultVal:true,		title:"Show Point Markers",	modifyType:["user"],	configType:"selectBoolean"},
	  		markerSize:		{ord: 203,	type:"int",		group:"general",	location: ["marker", "radius"],		defaultVal:4,			title:"Point Markers Size",	modifyType:["user"],	configType:"selectOne", values:[{value:1, label:"1"}, {value:2, label:"2"}, {value:3, label:"3"}, {value:4, label:"4"}, {value:5, label:"5"}, {value:6, label:"6"}, {value:7, label:"7"}, {value:8, label:"8"}, {value:9, label:"9"}, {value:10, label:"10"}]},
	  		markerSymbol:	{ord: 204,	type:"string",	group:"general",	location: ["marker", "symbol"],		defaultVal:null,		title:"Point Markers Type",	modifyType:["user"],	configType:"selectOne", values:[{value:null, label:"Automatic"}, {value:"circle", label:"Circle"}, {value:"square", label:"Square"}, {value:"diamond", label:"Diamond"}, {value:"triangle", label:"Triangle"}, {value:"triangle-down", label:"Triangle Down"}]}
	  	},
	  	spline: {
	  		_parent:		{ord:  -1,	type:"string",	group:"private",	defaultVal: "common",										title:"",					modifyType:[],			configType:null},
	  		lineWidth:		{ord: 201,	type:"int",		group:"general",	location: ["lineWidth"],			defaultVal:1,			title:"Line Width",			modifyType:["user"],	configType:"text"},
	  		markerEnabled:	{ord: 202,	type:"boolean",	group:"general",	location: ["marker", "enabled"],	defaultVal:true,		title:"Show Point Markers",	modifyType:["user"],	configType:"selectBoolean"},
	  		markerSize:		{ord: 203,	type:"int",		group:"general",	location: ["marker", "radius"],		defaultVal:4,			title:"Point Markers Size",	modifyType:["user"],	configType:"selectOne", values:[{value:1, label:"1"}, {value:2, label:"2"}, {value:3, label:"3"}, {value:4, label:"4"}, {value:5, label:"5"}, {value:6, label:"6"}, {value:7, label:"7"}, {value:8, label:"8"}, {value:9, label:"9"}, {value:10, label:"10"}]},
	  		markerSymbol:	{ord: 204,	type:"string",	group:"general",	location: ["marker", "symbol"],		defaultVal:null,		title:"Point Markers Type",	modifyType:["user"],	configType:"selectOne", values:[{value:null, label:"Automatic"}, {value:"circle", label:"Circle"}, {value:"square", label:"Square"}, {value:"diamond", label:"Diamond"}, {value:"triangle", label:"Triangle"}, {value:"triangle-down", label:"Triangle Down"}]}
	  	},
	  	area: {
	  		_parent:		{ord: -1,	type:"string",	group:"private",	defaultVal: "common",										title:"",					modifyType:[],			configType:null},
	  		markerEnabled:	{ord: 202,	type:"boolean",	group:"general",	location: ["marker", "enabled"],	defaultVal:true,		title:"Show Point Markers",	modifyType:["user"],	configType:"selectBoolean"},
	  		markerSize:		{ord: 203,	type:"int",		group:"general",	location: ["marker", "radius"],		defaultVal:4,			title:"Point Markers Size",	modifyType:["user"],	configType:"selectOne", values:[{value:1, label:"1"}, {value:2, label:"2"}, {value:3, label:"3"}, {value:4, label:"4"}, {value:5, label:"5"}, {value:6, label:"6"}, {value:7, label:"7"}, {value:8, label:"8"}, {value:9, label:"9"}, {value:10, label:"10"}]},
	  		markerSymbol:	{ord: 204,	type:"string",	group:"general",	location: ["marker", "symbol"],		defaultVal:null,		title:"Point Markers Type",	modifyType:["user"],	configType:"selectOne", values:[{value:null, label:"Automatic"}, {value:"circle", label:"Circle"}, {value:"square", label:"Square"}, {value:"diamond", label:"Diamond"}, {value:"triangle", label:"Triangle"}, {value:"triangle-down", label:"Triangle Down"}]}
	  	},
	  	areaspline: {
	  		_parent:		{ord: -1,	type:"string",	group:"private",	defaultVal: "common",										title:"",					modifyType:[],			configType:null},
	  		markerEnabled:	{ord: 202,	type:"boolean",	group:"general",	location: ["marker", "enabled"],	defaultVal:true,		title:"Show Point Markers",	modifyType:["user"],	configType:"selectBoolean"},
	  		markerSize:		{ord: 203,	type:"int",		group:"general",	location: ["marker", "radius"],		defaultVal:4,			title:"Point Markers Size",	modifyType:["user"],	configType:"selectOne", values:[{value:1, label:"1"}, {value:2, label:"2"}, {value:3, label:"3"}, {value:4, label:"4"}, {value:5, label:"5"}, {value:6, label:"6"}, {value:7, label:"7"}, {value:8, label:"8"}, {value:9, label:"9"}, {value:10, label:"10"}]},
	  		markerSymbol:	{ord: 204,	type:"string",	group:"general",	location: ["marker", "symbol"],		defaultVal:null,		title:"Point Markers Type",	modifyType:["user"],	configType:"selectOne", values:[{value:null, label:"Automatic"}, {value:"circle", label:"Circle"}, {value:"square", label:"Square"}, {value:"diamond", label:"Diamond"}, {value:"triangle", label:"Triangle"}, {value:"triangle-down", label:"Triangle Down"}]}
	  	},
	  	arearange: {
	  		_parent:		{ord: -1,	type:"string",	group:"private",	defaultVal: "common",										title:"",					modifyType:[],			configType:null},
	  		metric2Enabled:	{ord: -1,	type:"boolean",	group:"additional",										defaultVal:true,		title:"",					modifyType:["script"],	configType:null},
	  		markerEnabled:	{ord: 202,	type:"boolean",	group:"general",	location: ["marker", "enabled"],	defaultVal:true,		title:"Show Point Markers",	modifyType:["user"],	configType:"selectBoolean"},
	  		markerSize:		{ord: 203,	type:"int",		group:"general",	location: ["marker", "radius"],		defaultVal:4,			title:"Point Markers Size",	modifyType:["user"],	configType:"selectOne", values:[{value:1, label:"1"}, {value:2, label:"2"}, {value:3, label:"3"}, {value:4, label:"4"}, {value:5, label:"5"}, {value:6, label:"6"}, {value:7, label:"7"}, {value:8, label:"8"}, {value:9, label:"9"}, {value:10, label:"10"}]},
	  		markerSymbol:	{ord: 204,	type:"string",	group:"general",	location: ["marker", "symbol"],		defaultVal:null,		title:"Point Markers Type",	modifyType:["user"],	configType:"selectOne", values:[{value:null, label:"Automatic"}, {value:"circle", label:"Circle"}, {value:"square", label:"Square"}, {value:"diamond", label:"Diamond"}, {value:"triangle", label:"Triangle"}, {value:"triangle-down", label:"Triangle Down"}]}
	  	},
	  	bar: {
	  		_parent:		{ord: -1,	type:"string",	group:"private",	defaultVal: "common",										title:"",					modifyType:[],			configType:null}
	  	},
	  	column: {
	  		_parent:		{ord: -1,	type:"string",	group:"private",	defaultVal: "common",										title:"",					modifyType:[],			configType:null}
	  	},		
	  	columnrange: {
	  		_parent:		{ord: -1,	type:"string",	group:"private",	defaultVal: "common",										title:"",					modifyType:[],			configType:null},
	  		metric2Enabled:	{ord: -1,	type:"boolean",	group:"additional",										defaultVal:true,		title:"",					modifyType:["script"],	configType:null}
	  	},
	  	scatter: {
	  		_parent:		{ord: -1,	type:"string",	group:"private",	defaultVal: "common",										title:"",					modifyType:[],			configType:null},
	  		metric2Enabled:	{ord: -1,	type:"boolean",	group:"additional",										defaultVal:true,		title:"",					modifyType:["script"],	configType:null}
	  	},
//	  	bubble: {
//	  		_parent:		{ord: -1,	type:"string",	group:"private",	defaultVal: "common",										title:"",					modifyType:[],			configType:null}
//	  	},
	  	pie: {
	  		_parent:		{ord: -1,	type:"string",	group:"private",	defaultVal: "common",										title:"",					modifyType:[],			configType:null}
	  	}
	};
	
	// BEGIN init block
	var chartTypeNames = [
	    {value:"line",		label: "Line Chart"},
	    {value:"spline",	label: "Spline Chart"},
	    {value:"area",		label: "Area Chart"},
	    {value:"areaspline",label: "Spline Area Chart"},
	    {value:"arearange",	label: "Area Range Chart"},
	    {value:"bar",		label: "Bar Chart"},
	    {value:"column",	label: "Column Chart"},
	    {value:"columnrange",label:"Column Range Chart"},
	    {value:"scatter",	label: "Scatter Plot"},
//	    {value:"bubble",	label: "Bubble Chart"},
	    {value:"pie",		label: "Pie Chart"}
    ];
	var seriesTypeNames = [
	    {value:"inherit",	label: "Same as Chart Type"},
	    {value:"line",		label: "Line"},
	    {value:"spline",	label: "Spline"},
	    {value:"area",		label: "Area"},
	    {value:"areaspline",label: "Spline Area"},
	    {value:"arearange",	label: "Area Range"},
	    {value:"bar",		label: "Bar"},
	    {value:"column",	label: "Column"},
	    {value:"columnrange",label:"Column Range"},
	    {value:"scatter",	label: "Scatter"},
//	    {value:"bubble",	label: "Bubble"},
	    {value:"pie",		label: "Pie"}
    ];
	this.chartOptionsMeta["common"]["type"]["values"]  = angular.copy( chartTypeNames );
	this.seriesOptionsMeta["common"]["type"]["values"] = angular.copy( seriesTypeNames );
	
//	var chartEvents = {
//		xAxisSetExtremes: null
//	};
//	this.chartOptionsMeta["common"]["eventHandlers"]["defaultVal"]  = angular.copy( chartEvents );
	
	var colors = [
        {label:"Automatic",		value:null},
   		{label:"Aqua",			value:"#00FFFF"},
 		{label:"Black",			value:"#000000"},
 		{label:"Blue",			value:"#0000FF"},
 		{label:"Brown",			value:"#A52A2A"},
 		{label:"Chartreuse",	value:"#7FFF00"},
 		{label:"Coral",			value:"#FF7F50"},
 		{label:"Dark Blue",		value:"#00008B"},
 		{label:"Dark Green",	value:"#006400"},
 		{label:"Dark Orange",	value:"#FF8C00"},
 		{label:"Dim Gray",		value:"#696969"},
 		{label:"Dodger Blue",	value:"#1E90FF"},
 		{label:"Gold",			value:"#FFD700"},
 		{label:"Green",			value:"#008000"},
 		{label:"Green Yellow",	value:"#ADFF2F"},
 		{label:"Magenta",		value:"#FF00FF"},
 		{label:"Orange",		value:"#FFA500"},
 		{label:"Orange Red",	value:"#FF4500"},
 		{label:"Orchid",		value:"#DA70D6"},
 		{label:"Red",			value:"#FF0000"},
 		{label:"Royal Blue",	value:"#4169E1"},
 		{label:"Yellow",		value:"#FFFF00"},
 		{label:"Yellow Green",	value:"#9ACD32"}
 	];
	this.seriesOptionsMeta["common"]["color"]["values"] = angular.copy( colors );
	// END init block
	
}]);