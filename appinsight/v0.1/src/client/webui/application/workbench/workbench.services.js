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

angular.module("insightal.workbench")
	.factory("Workbench", [
	    "$http", "$q", "$cookies", "Utils", "Auth", "DBG", function(
		 $http,   $q,   $cookies,   Utils,   Auth,   DBG) {
	var serviceRoot = routingConfig.serviceRoot;
	
	// DEV BEGIN
	if ( !angular.isObject( DBG["Workbench"] ) ) {
		DBG["Workbench"] = {};
	}
	// DEV END
	
	return {
		create: function(config) {
//			$http({
//		        url: serviceRoot[0] + "/???",
//		        method: "POST",
//		        data: {
//		        	name: config["name"],
//		        	workbench: Utils.stringifyJSON( config["workbench"] )
//		        },
//		        headers: {"X-AUTH-HEADER": Auth.authToken["value"]}
//		    })
//		    .success(function(data, status, headers, httpConfig) {
//		    	if (data["status"] === "OK")
//		    		config.success(data, status, headers, httpConfig);
//		    	else
//		    		config.error(data, status, headers, httpConfig);
//		    })
//		    .error(config.error); //function(data, status, headers, httpConfig) {}
			
			// BEGIN dev
			config.success({"status": "OK", "workbenchId": "9a8329b1-426a-aa13-a275-73800acff821"}, {}, {}, {data:{name:config["name"]}});
			// END dev
		},
		list: function(config) {
//			$http({
//                url: serviceRoot[0] + "/workbench/list",
//                method: "POST",
//                data: {},
//                headers: {"X-AUTH-HEADER": Auth.authToken["value"]}
//            })
//            .success(function(data, status, headers, httpConfig) {
//            	if (data["status"] === "OK")
//            		config.success(data, status, headers, httpConfig);
//            	else
//            		config.error(data, status, headers, httpConfig);
//            })
//            .error(config.error); //function(data, status, headers, httpConfig) {}
		
			// BEGIN DEV
			config.success({"status": "OK", "workbenches": [
                   ["9a0bd9e1-46ae-4007-aece-7c4fb41658e9", "wb1", "{\"name\":\"Offline Workbench 1\"}"], 
                   ["8ed0ad0c-2033-4edf-9d6a-8d5e3e1f5d9b", "wb2", "{\"name\":\"Offline Workbench 2\"}"]
            ]});
			// END DEV
		},
		update: function(config) {
//			$http({
//                url: serviceRoot[0] + "/workbench/update",
//                method: "POST",
//                data: {
//                	id: config["guid"],
//                	dashboard: Utils.stringifyJSON( config["workbench"] )
//                },
//                headers: {"X-AUTH-HEADER": Auth.authToken["value"]}
//            })
//            .success(function(data, status, headers, httpConfig) {
//            	if (data["status"] === "OK")
//            		config.success(data, status, headers, httpConfig);
//            	else
//            		config.error(data, status, headers, httpConfig);
//            })
//            .error(config.error); //function(data, status, headers, httpConfig) {}
			
			// BEGIN DEV
			config.success();
			// END DEV
		},
		delete: function(config) {
//			$http({
//                url: serviceRoot[0] + "/workbench/deleteById",
//                method: "POST",
//                data: {id: config["workbenchGuid"]},
//                headers: {"X-AUTH-HEADER": Auth.authToken["value"]}
//            })
//            .success(function(data, status, headers, httpConfig) {
//            	if (data["status"] === "OK")
//            		config.success(data, status, headers, httpConfig);
//            	else
//            		config.error(data, status, headers, httpConfig);
//            })
//            .error(config.error); //function(data, status, headers, httpConfig) {}
			
			// BEGIN DEV
			config.success();
			// END DEV
		}
	};
}]);

angular.module("insightal.workbench")
	.factory("DataCatalog", [
	    "$http", "$q", "$timeout", "Auth", "Utils", "DBG", function(
		 $http,   $q,   $timeout,   Auth,   Utils,   DBG) {
	var serviceRoot = routingConfig.serviceRoot;
	
	var getRandomInt = function(min, max) {
		return Math.floor(Math.random() * (max - min + 1)) + min;
	}
	var dirCounter = 0,
		fileCounter = 0;
	
	// DEV BEGIN
	if ( !angular.isObject( DBG["DataCatalog"] ) ) {
		DBG["DataCatalog"] = {};
	}
	// DEV END
	
	return {
		createTenantRootDirectory: function(config) {
			return $http({
				url: serviceRoot[1] + "/createTenantFolder",
            	method: "POST",
            	headers: {"X-AUTH-HEADER": Auth.authToken["value"]},
            	data: {
            		tenantId: config["tenantId"]
            	}
			});
		},
		createDirectory: function(config) {
			// if the "parentDirName" param is missing, the directory is created in tenant's root dir
			var httpData = {
        		tenantId: config["tenantId"],
        		folderName: config["name"]
        	};
			if ( angular.isString(config["parentDirName"]) && config["parentDirName"].length > 0 ) {
				httpData["baseName"] = config["parentDirName"];
			}
				
			return $http({
				url: serviceRoot[1] + "/createFolder",
            	method: "POST",
            	headers: {"X-AUTH-HEADER": Auth.authToken["value"]},
            	data: httpData
			});
		},
		/**
		 * listDirectory:
		 * config = {
		 *     tenantId: tenant's ID
		 *     name: folder path and name, e.g. root/myDirectory/directoryToList
		 * }
		 */
		listDirectory: function(config) {
			var params = { tenantId: config["tenantId"] },
				dfd = $q.defer();
			
			// the "folderName" param holds the directory to be listed, including it's parent directories,
			// e.g. "root/myDirectory/directoryToList"
			if ( angular.isString( config["name"] ) )
				params["folderName"] = config["name"];
			
			// BEGIN OFFLINE
//			var result = {data:{ folders:[], files:[] }},
//				folderCount	= Utils.getRandomInt(0, 3),
//				fileCount	= Utils.getRandomInt(1, 4),
//				prefix = config["name"];
//			if (prefix.indexOf("/") >= 0)
//				prefix = prefix.substr( prefix.indexOf("/") + 1);
//			prefix = prefix.substr(6);
//			for (var i=0; i<folderCount; i++) {
//				result.data["folders"].push("Folder" + prefix + "-" + i);
//			}
//			for (var i=0; i<fileCount; i++) {
//				result.data["files"].push("File" + prefix + "-" + i);
//			}
//			dfd.resolve(result);
//			return dfd.promise;
			// END OFFLINE
			
			$http({
				url: serviceRoot[1] + "/listFolder",
            	method: "POST",
            	headers: {"X-AUTH-HEADER": Auth.authToken["value"]},
            	data: params
			})
			.then(function(result) { // result = {data:string|Object, headers:function, config:Object, status:number, statusText:string}
				var folders = result.data["folders"],
					files	= result.data["files"],
					foldersFormatted = [],
					filesFormatted   = [];
				
				if ( angular.isArray(folders) ) {
					for (var i=0; i<folders.length; i++) {
						var idx = folders[i].lastIndexOf("/"); 
						if (idx > 0)
							foldersFormatted.push( folders[i].substr( idx + 1 ) );
						else
							foldersFormatted.push( folders[i] )
					}
					result.data["folders"] = foldersFormatted;
				}
				else {
					result.data["folders"] = [];
				}
				
				if ( angular.isArray(files) ) {
					for (var i=0; i<files.length; i++) {
						var idx = files[i].lastIndexOf("/"); 
						if (idx > 0)
							filesFormatted.push( files[i].substr( idx + 1 ) );
						else
							filesFormatted.push( files[i] )
					}
					result.data["files"] = filesFormatted;
				}
				else {
					result.data["files"] = [];
				}
				
				dfd.resolve(result);
			})
			.catch(function(result) {
				dfd.reject(result);
			});
			
			return dfd.promise;
		},
		listSparkDirectory: function(config) {
			var params = {
				tenantId: config["tenantId"],
				isGenerated: true
			};
			
			// the "folderName" param holds the directory to be listed, including it's parent directories,
			// e.g. "root/myDirectory/directoryToList"
			if ( angular.isString( config["name"] ) )
				params["folderName"] = config["name"];
			
			return $http({
				url: serviceRoot[1] + "/listFolder",
            	method: "POST",
            	headers: {"X-AUTH-HEADER": Auth.authToken["value"]},
            	data: params
			});
		},
		uploadFile: function(config) {
			var formData = new FormData(),
	    		jsonBlob,
	    		requestParams = {
	    			tenantId:	config["tenantId"],
	    			folderPath:	config["dirPath"],
	    			fileName:	config["fileName"]
	    		};
			
	    	jsonBlob = new Blob( [ Utils.stringifyJSON(requestParams) ], {type:"application/json"} );
	    	formData.append( "file", config["file"] );
	    	formData.append( "json", jsonBlob );
	    	
	    	return $http({
	            url: serviceRoot[1] + "/uploadFile",
	            method: "POST",
	            headers: {
//	            	"X-AUTH-HEADER": Auth.authToken["value"],
	            	"Content-Type": undefined
	            },
	            transformRequest: angular.identity,
	            data: formData
	        });
		},
		getFileColumns: function(config) {
			return $http({
				url: serviceRoot[1] + "/getFields",
            	method: "POST",
            	headers: {"X-AUTH-HEADER": Auth.authToken["value"]},
            	data: {
            		tenantId: config["tenantId"],
            		filePath: config["filePath"]
            	}
			});
		},
		getFileData: function(config) {
			var filePathAndName = config["filePath"] + (config["filePath"].length>0? "/" : "") + config["fileName"],
				datasetPromise,
				paramsDatasets = {
					tenantId: config["tenantId"]
				},
				paramsFileColumns = {
					tenantId: config["tenantId"],
					filePath: filePathAndName
				},
				paramsFileData = {
					tenantId:			config["tenantId"],
					saveOutput:			false,
					returnResults:		true,
					outputFolderPath:	"",
					outputFolderName:	"",
					outputTableName:	"",
					transforms: {
						type: "JOIN" ,
						tables: [], // filled based on getDatasets result, e.g. ["dept"],
						selectColumns: [] // filled based on getFileColumns result, {fieldNames:["dept.name"], newFieldName:"dept_name"}
					}
				};
			
			datasetPromise = this.getDatasets(paramsDatasets)
			.then(angular.bind(this, function(result) {
				var datasetObj = result.data["results"],
					ds;
				for (var guid in datasetObj) {
					ds = datasetObj[guid];
					if (angular.isArray( ds["files"] ) && ds["files"].length == 1 && ds.files[0] === filePathAndName) {
						return $q.when({ data:ds }); // this just directly returns promise, resolved with object ds
					}
				}
				return this.createDataset({
            		tenantId:	config["tenantId"],
            		name:		config["fileName"].replace(/\./g, "_"),
            		files:		[filePathAndName]
            	});
			}));
			
			return $q.all({
				dataset:		datasetPromise,
				fileColumns:	this.getFileColumns(paramsFileColumns)
			})
			// when the dataset and file colums are both resolved
			.then(function(resultObj) {
				var dataset = resultObj["dataset"].data,
					columns = resultObj["fileColumns"].data["fields"],
					selectColumns = [];
				if ( !angular.isArray( columns ) ) {
					return $q.reject(resultObj);
				}
				
				for (var i=0; i<columns.length; i++) {
					selectColumns.push({
						fieldNames: [ dataset["name"] + "." + columns[i] ],
						newFieldName: columns[i]
					});
				}
				paramsFileData["transforms"]["selectColumns"] = selectColumns;
				paramsFileData["transforms"]["tables"] = [ dataset["name"] ];
				
				return $http({
					url: serviceRoot[1] + "/transform/join",
	            	method: "POST",
	            	headers: {"X-AUTH-HEADER": Auth.authToken["value"]},
	            	data: paramsFileData
				});
			}) // when the file data is resolved, we want to parse JSON strings and return the result
			.then(function(result) {
				var data = result.data["data"],
					parsed = [];
				if ( !angular.isArray(data) )
					return $q.reject(result);
				for (var i=0; i<data.length; i++) {
					parsed.push( JSON.parse( data[i] ) );
				}
				return $q.when({ fileData:parsed });
			});
		},
		getDatasets: function(config) {
			return $http({
				url: serviceRoot[2] + "/getDatasets",
            	method: "POST",
//            	headers: {"X-AUTH-HEADER": Auth.authToken["value"]},
            	data: {
            		tenantId: config["tenantId"]
            	}
			});
		},
		getDatasetContents: function(config) {
			var params = {
					tenantId:			config["tenantId"],
					saveOutput:			false,
					returnResults:		true,
					outputFolderPath:	"",
					outputFolderName:	"",
					outputTableName:	"",
					transforms: {
						type: "JOIN" ,
						tables: [ config["datasetName"] ],
						selectColumns: [] // filled based on getFileColumns result, {fieldNames:["dept.name"], newFieldName:"dept_name"}
					}
				};
			
			return this.getDatasets({
				tenantId: config["tenantId"]
			})
			.then(angular.bind(this, function(result) {
				var dataset = result.data["results"][ config["datasetGuid"] ];
				if (angular.isArray( dataset["files"] ) && dataset["files"].length > 0) {
					return $q.when({ data: {files:dataset["files"]} }); // this just directly returns promise, resolved with file path
				}
				else if (angular.isArray( dataset["folders"] ) && dataset["folders"].length > 0) {
					return this.listDirectory({
						tenantId:	config["tenantId"],
						name:		dataset["folders"][0]
					});
				}
				return $q.when({ files:[] });
			}))
			.then(angular.bind(this, function(result) {
				var files = result.data["files"];
				if (!angular.isArray( files ) || files.length == 0) {
					return $q.reject(result);
				}
				return this.getFileColumns({
					tenantId: config["tenantId"],
					filePath: (angular.isString(result.data["logicalPath"])? (result.data["logicalPath"] + "/") : "") +  files[0]
				})
			}))
			.then(function(result) {
				var columns = result.data["fields"],
					selectColumns = [];
				if (!angular.isArray( columns ) ) {
					return $q.reject(result);
				}
				
				for (var i=0; i<columns.length; i++) {
					selectColumns.push({
						fieldNames: [ config["datasetName"] + "." + columns[i] ],
						newFieldName: columns[i]
					});
				}
				params["transforms"]["selectColumns"] = selectColumns;
				
				return $http({
					url: serviceRoot[1] + "/transform/join",
	            	method: "POST",
	            	headers: {"X-AUTH-HEADER": Auth.authToken["value"]},
	            	data: params
				});
			}) // when the file data is resolved, we want to parse JSON strings and return the result
			.then(function(result) {
				var data = result.data["data"],
					parsed = [];
				if ( !angular.isArray(data) )
					return $q.reject(result);
				for (var i=0; i<data.length; i++) {
					parsed.push( JSON.parse( data[i] ) );
				}
				return $q.when({ datasetData:parsed });
			});
		},
		createDataset: function(config) {
			return $http({
				url: serviceRoot[2] + "/createDataset",
            	method: "POST",
//            	headers: {"X-AUTH-HEADER": Auth.authToken["value"]},
            	data: {
            		tenantId:	config["tenantId"],
            		name:		config["name"],
            		folders:	angular.isArray(config["dirs"])?  config["dirs"]  : [],
            		files:		angular.isArray(config["files"])? config["files"] : []
            	}
			});
		},
		getWorkflows: function(config) {
			return $http({
				url: serviceRoot[2] + "/getWorkflows",
            	method: "POST",
//            	headers: {"X-AUTH-HEADER": Auth.authToken["value"]},
            	data: config
			});
		},
		createWorkflow: function(config) {
			return $http({
				url: serviceRoot[2] + "/addWorkflow",
            	method: "POST",
//            	headers: {"X-AUTH-HEADER": Auth.authToken["value"]},
            	data: config
			});
		},
		executeWorkflow: function(config) {
			return $http({
				url: serviceRoot[4] + "/executeWorkflow",
            	method: "POST",
//            	headers: {"X-AUTH-HEADER": Auth.authToken["value"]},
            	data: config
			});
		},
		getWorkflowExecutions: function(config) {
			return $http({
				url: serviceRoot[2] + "/getWorkflowInstancesForWorkflow",
            	method: "POST",
//            	headers: {"X-AUTH-HEADER": Auth.authToken["value"]},
            	data: config
			});
		},
		getWorkflowStatus: function(config) {
			return $http({
				url: serviceRoot[4] + "/getWorkflowInstanceStatus",
            	method: "POST",
//            	headers: {"X-AUTH-HEADER": Auth.authToken["value"]},
            	data: config
			});
		}
	};
}]);

//angular.module("insightal.workbench")
//	.factory("Filesystem", [
//	    "Utils", function(
//		 Utils) {
//	
//	var fsCatalog = {};
//	
//	
//	
//}]);