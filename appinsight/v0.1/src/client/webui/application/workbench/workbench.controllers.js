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
	.controller("WorkbenchListCtrl", [
		"$scope", "Workbench", "UiMessage", "InChartUtils", function(
		 $scope,   Workbench,   UiMessage,   InChartUtils) {
	this.workbenchList = [];
	
	Workbench.list({
		success: angular.bind(this, function(data, status, headers, httpConfig) {
			this.workbenchList = data["workbenches"];
		}),
		error: angular.bind(this, function(data, status, headers, httpConfig) {
			var message = (typeof data["message"] == "undefined")? "---" : data["message"];
			UiMessage.add("danger", "An error occured when listing user's workbenches.\nMessage: " + message);
		})
	});
	
}]);


angular.module("insightal.workbench")
	.controller("WorkbenchCreateCtrl", [
		"$scope", "$rootScope", "$state", "$stateParams", "Workbench", "UiMessage", function(
		 $scope,   $rootScope,   $state,   $stateParams,   Workbench,   UiMessage) {
	this.configMeta = [
		{name:"name",			type:"string",	defaultVal:null,	title:"Name",			userConfigurable:true,	configType:"text"},
		{name:"description",	type:"string",	defaultVal:null,	title:"Description",	userConfigurable:true,	configType:"textArea"},
		{name:"guid",			type:"string",	defaultVal:null,	title:"",				userConfigurable:false,	configType:null},
		{name:"user",			type:"object",	defaultVal:null,	title:"",				userConfigurable:false,	configType:null},
		{name:"active",			type:"string",	defaultVal:1,		title:"",				userConfigurable:false,	configType:null},
		{name:"creationDate",	type:"date",	defaultVal:null,	title:"",				userConfigurable:false,	configType:null},
		{name:"modificationDate",type:"date",	defaultVal:null,	title:"",				userConfigurable:false,	configType:null},
		{name:"charts",			type:"array",	defaultVal:null,	title:"",				userConfigurable:false,	configType:null},
		{name:"transientCfg",	type:"object",	defaultVal:{},		title:"",				userConfigurable:false,	configType:null}
	];
	this.configTransientMeta = [];

	this.prepareWorkbenchConfig = function() {
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
		Workbench.create({
			name:		configToPersist["name"],
			workbench:	configToPersist,
			success:	function(data, status, headers, httpConfig) {
				$rootScope.$broadcast("workbenchCreated");
				UiMessage.add("success", "Workbench " + httpConfig.data["name"] + " saved successfully.");
				$state.go("user.workbench", {guid:data["workbenchId"]});
			},
			error: function(data, status, headers, httpConfig) {
				var message = (typeof data["message"] == "undefined")? "---" : data["message"];
				UiMessage.add("danger", "An error occured when saving workbench " + workbench.name + ".\nMessage: " + message);
			}
		});
	};
	
	this.config = this.prepareWorkbenchConfig();
}]);


/***********************************************************************************************/

angular.module("insightal.workbench")
	.controller("WbCatalogCtrl", [
		"$window", function(
		 $window) {
			
	this.openNotebook = function() {
		// TODO: do some stuff to get the exact link
		$window.open("http://45.79.102.84:8000/", "_blank");
	};
		
}]);


angular.module("insightal.workbench")
	.controller("WbFilesCtrl", [
		"$scope", "$q", "$modal", "DataCatalog", "Auth", "UiMessage", "TreeUtils", "Utils", function(
		 $scope,   $q,   $modal,   DataCatalog,   Auth,   UiMessage,   TreeUtils,   Utils) {
	
	this.files					= [];
	this.selectedDir			= null;
	this.selectedDirAncestors	= [{id:"#", text:"Home", isDirectory:true}];
	this.selectedDirItems		= [];
	this.isSparkDir				= false;
	this.sparkContents			= [];
	this.selectedFile			= null;
	this.selectedFileColumns	= [];
	this.selectedFileContents	= [];
	this.selectedFileOrderKey	= null;
	this.selectedFileOrderReverse = false;
	this.fileContForCurrentPage	= [];
	this.fileContPage			= 1;
	this.fileContPageCount		= 0;
	this.fileContRowCount		= 0;
	this.fileContRowsPerPage	= 10;
	this.showFile = false;
	
	this.loadDirItems = function(dirId, successCB, noCache) {
		var dir = TreeUtils.getNodeById(dirId, this.files),
			dirChildren = TreeUtils.getNodesByParentId(dirId, this.files);
		
		if ( angular.isUndefined(noCache) || noCache != true )
			noCache = false;
		
		if ( dirId != "#" && (dir == null || !dir["isDirectory"]) )
			return;
		
		// the following block creates "Home" directory as an only child of root "#" directory
		if (dirId == "#") {
			var newNodes = [{
				id: "##",
				text: "Home",
				parent: "#",
				isDirectory: true,
				children: true
			}];
			this.files = newNodes;
			if ( angular.isFunction( successCB ) ) {
				successCB(newNodes);
			}
			return;
		}
		
		if ( !noCache && dirChildren.length > 0 ) {
			// get data from cache
			if ( angular.isFunction( successCB ) ) {
				successCB(dirChildren);
			}
		}
		else { // get data from server
			// remove any existing data first
			this.files = TreeUtils.deleteNodesByParentId(dirId, this.files);
			
			// construct the full path to be used in DataCatalog.listDirectory
			var path = TreeUtils.getNodePath(dirId, this.files, null, "##"); // the last argument instructs to remove the "##" from the beginning of the path
//				dirAncestors = TreeUtils.getNodeAncestors(dirId, this.files);
//			for (var i=1; i<dirAncestors.length; i++) {
//				path += "/" + dirAncestors[i]["id"];
//			}
			
			DataCatalog.listDirectory({
				name: path,
				tenantId: Auth.user["tenantId"]
			})
			.then(angular.bind(this, function(result) {
				var newNodes = [];
				if ( angular.isString( result.data["metadata"] ) && result.data["metadata"] == "spark_generated" ) {
					if (!angular.isObject( dir["metadata"] ))
						dir["metadata"] = {};
					dir["metadata"]["spark_generated"] = true;
				}
				if ( angular.isArray( result.data["folders"] ) ) {
					for (var i=0; i<result.data["folders"].length; i++) {
						newNodes.push({
							id:			result.data["folders"][i],
							text:		result.data["folders"][i],
							parent:		dirId,
							isDirectory: true,
							children:    true
						});
					}
				}
				if ( angular.isArray( result.data["files"] ) ) {
					for (var i=0; i<result.data["files"].length; i++) {
						newNodes.push({
							id: result.data["files"][i],
							text: result.data["files"][i],
							parent: dirId,
							isDirectory: false
						});
					}
				}
				this.files = this.files.concat( newNodes );
				if ( angular.isFunction( successCB ) ) {
					successCB(newNodes);
				}
			}))
			.catch(angular.bind(this, function(result) {
				console.error("list directory error!");
				console.error(result);
			}));
		}
	};
	
	this.createDir = function(dirConfig) {
//		console.debug("createDir");
//		console.debug(arguments);
		var dirPath = TreeUtils.getNodePath(dirConfig["parent"], this.files, null, "##"); // the last argument instructs to remove the "##" from the beginning of the path
		
		DataCatalog.createDirectory({
			name: dirConfig["name"],
			parentDirName: dirPath,
			tenantId: Auth.user["tenantId"]
		})
		.then(angular.bind(this, (function(dirConfig) {
			return function(result) { // result = {data:string|Object, headers:function, config:Object, status:number, statusText:string}
				UiMessage.add("success", "Directory '" + dirConfig["name"] + "' created successfully.");
				this.treeNodesToLoad = [ dirConfig["parent"] ];
			};
		})(dirConfig)))
		.catch(angular.bind(this, function(result) {
			var message = "";
			if ( angular.isObject( result["data"] ) && angular.isString( result["data"]["result"] ) )
				message = " Message: '" + result["data"]["result"] + "'";
			UiMessage.add("danger", "Failed to create the directory." + message);
			console.error("list directory error!");
			console.error(result);
		}));
	};
	
	this.uploadFile = function(fileConfig) {
		var path = TreeUtils.getNodePath(fileConfig["dirId"], this.files, null, "##"); // the last argument instructs to remove the "##" from the beginning of the path
		
		DataCatalog.uploadFile({
			file: fileConfig["file"],
			fileName: fileConfig["file"]["name"],
			dirPath: path,
			tenantId: Auth.user["tenantId"]
		})
		.then(angular.bind(this, (function(fileConfig){
			return function(result) { // this keeps the fileConfig available in the successHandler
				UiMessage.add("success", "File '" + fileConfig["file"]["name"] + "' uploaded successfully.");
				this.treeNodesToLoad = [ fileConfig["dirId"] ];
				this.treeNodesToOpen = [ fileConfig["dirId"] ];
			};
		})(fileConfig)))
		.catch(angular.bind(this, function(result) {
			UiMessage.add("danger", "Failed to upload the file.");
			console.error("file upload error!");
			console.error(result);
		}));
	};
	
	this.openDir = function(dirId) {
		this.loadDirItems(
			dirId,
			angular.bind(this, function(result) {
				this.navigateToDir(dirId);
			})
		);
	};
	
	this.navigateToDir = function(dirId) {
		var dir = TreeUtils.getNodeById(dirId, this.files);
		this.selectedDirItems = angular.copy( TreeUtils.getNodesByParentId(dirId, this.files) );
		this.selectedDirAncestors = TreeUtils.getNodeAncestorsAndSelf(dirId, this.files);
		if ( angular.isObject( dir["metadata"] ) && dir["metadata"]["spark_generated"] )
			this.isSparkDir = true;
	};
	
	this.viewFileContents = function(fileId) {
		this.selectedFile = TreeUtils.getNodeById(fileId, this.files);
		if (this.selectedFile["isDirectory"]) {
			this.selectedFile = null;
			return;
		}
		
		DataCatalog.getFileData({
			tenantId: Auth.user["tenantId"],
			filePath: TreeUtils.getNodeAncestorsPath(fileId, this.files).replace(/##\//g, "").replace(/##/g, ""),
			fileName: fileId
		})
		.then(angular.bind(this, function(result) {
			var fileData = result["fileData"],
				fileColumns = [],
				rowCount = fileData.length;
			if (rowCount > 0) {
				for (var column in fileData[0]) {
					fileColumns.push( column );
				}
			}
			this.fileContPage			= 1;
			this.fileContPageCount		= Math.ceil( rowCount / this.fileContRowsPerPage );
			this.fileContRowCount		= rowCount;
			this.selectedFileColumns	= fileColumns;
			this.selectedFileOrderKey	= fileColumns[0];
			this.selectedFileOrderReverse = false;
			this.selectedFileContents	= this.getDataReordered(fileData, fileColumns[0]);
		}))
		.catch(function(result) {
			UiMessage.add("danger", "An error occurred while retrieving the file contents.");
			console.error("viewFileContents ERROR");
			console.debug(result);
		});
	};
	
	this.viewSparkDir = function() {
		DataCatalog.listSparkDirectory({ tenantId:Auth.user["tenantId"] })
		.then(angular.bind(this, function(result) {
			var fileStatuses = result.data["FileStatuses"]["FileStatus"],
				results = [],
				status;
			if (angular.isArray( fileStatuses )) {
				for (var i=0; i<fileStatuses.length; i++) {
					status = "";
					for (var key in fileStatuses[i]) {
						status += key + " = " + fileStatuses[i][key] + " | ";
					}
					if (status.length > 0)
						status = status.substr(0, status.length - 3);
					results.push(status);
				}
			}
			this.sparkContents = results;
		}))
		.catch(function(result) {
			console.error("Listing the spark directory failed.");
			console.debug(result);
		});
	};
	
	this.showFileContentsPage = function() {
		var pageContents = [],
			iMin = Math.max(0, (this.fileContPage - 1) * this.fileContRowsPerPage),
			iMax = Math.min(iMin + this.fileContRowsPerPage, this.fileContRowCount);
		for (var i=iMin; i<iMax; i++) {
			pageContents.push( this.selectedFileContents[i] );
		}
		this.fileContForCurrentPage = pageContents;
	};
	
	this.getDataReordered = function(data, column, reverse) {
		if ( angular.isUndefined( reverse ) )
			reverse = false;
		return Utils.sortArrayOfObj(data, column, reverse);
	};
	
	this.selectedFileChangeOrder = function(columnName) {
		if (this.selectedFileOrderKey === columnName) {
			this.selectedFileOrderReverse = !this.selectedFileOrderReverse;
		}
		else {
			this.selectedFileOrderKey = columnName;
			this.selectedFileOrderReverse = false;
		}
		this.selectedFileContents = this.getDataReordered(this.selectedFileContents, this.selectedFileOrderKey, this.selectedFileOrderReverse);
	};
	
	/* methods prefixed "tree" are used for purposes of the jsTree directive */
	
	this.treeNodesToLoad = [];
	this.treeNodesToOpen = [];
	
	this.treeRootLoaded = angular.bind(this, function() {
		this.treeNodesToOpen = ["##"];
		$scope.$apply();
	});
	
	this.treeActivateNodeCB = angular.bind(this, function(event, data) {
		if (data.node["state"]["loaded"]) {
			this.treeOpenNodeCB(event, data);
		}
	});
	
	this.treeOpenNodeCB = angular.bind(this, function(event, data) {
		var nodeId = data.node["id"],
			isDirectory = data.node["original"]["isDirectory"];
		if (isDirectory) {
			$scope.$broadcast("catalogJsTree.openNode", {nodeId:nodeId});
			$scope.$apply();
		}
	});
	
	this.treeGetNodeChildren = angular.bind(this, function(nodeToLoad, callback) {
		this.loadDirItems(nodeToLoad["id"], angular.bind(this, function(nodeChildrenData) {
			var newNodes = angular.copy( nodeChildrenData );
			for (var i=0; i<newNodes.length; i++) {
				if ( !newNodes[i]["isDirectory"] ) {
					newNodes[i]["icon"] = "jstree-file";
				}
			}
			if (nodeToLoad["id"] === "#") // "#" represents jsTree root element
				$scope.$broadcast("catalogJsTree.openNode", {nodeId:"##"}); // "##" is ID of the "Home" directory in the view
			else if (newNodes.length == 0) // openNode doesn't happen automaticaly for empty directories
				$scope.$broadcast("catalogJsTree.openNode", {nodeId:nodeToLoad["id"]}); // "##" is ID of the "Home" directory in the view
			callback(newNodes);
		}), true); // the last argument means that potentially cached results should not be used (always reload)
	});
	
	this.treeCreateFolder = angular.bind(this, function(node) {
		if ( ( angular.isObject( node["original"] ) && !node["original"]["isDirectory"] ) ||
			 (!angular.isObject( node["original"] ) && !node["isDirectory"] ) ) {
			UiMessage.add("danger", "Cannot create directory, the parent folder is not selected.");
			return false;
		}
		
		var modalInstance;
		DataCatalog.listDirectory({
			tenantId: Auth.user["tenantId"],
			name: TreeUtils.getNodePath(node["id"], this.files, null, "##")
		})
		.then(angular.bind(this, function(result) {
			var modalInstance = $modal.open({
				templateUrl: "partials/workbench/createDirModal.html",
				controller: "CreateDirModalCtrl as modal",
				scope: $scope,
				resolve: {
					modalData: function() {
						return {
							parentDir: node,
							parentDirContents: result.data
						};
					}
				}
			});
			
			modalInstance.result.then( angular.bind(this, this.createDir) );
		}))
		.catch(angular.bind(this, function(result) {
			UiMessage.add("danger", "Cannot create folder, because listing the parent folder contents failed.");
			console.error("Cannot create folder, because listing the parent folder contents failed.");
			console.debug(result);
		}));
		return false;
	});
	
	this.treeUploadFile = angular.bind(this, function(node) {
		if ( ( angular.isObject( node["original"] ) && !node["original"]["isDirectory"] ) ||
			 (!angular.isObject( node["original"] ) && !node["isDirectory"] ) ) {
			UiMessage.add("danger", "Cannot upload file, the parent folder is not selected.");
			return false;
		}
		
		DataCatalog.listDirectory({
			tenantId: Auth.user["tenantId"],
			name: TreeUtils.getNodePath(node["id"], this.files, null, "##")
		})
		.then(angular.bind(this, function(result) {
			return $modal.open({
				templateUrl: "partials/workbench/uploadFileModal.html",
				controller: "UploadFileModalCtrl as modal",
				scope: $scope,
				resolve: {
					modalData: function() {
						return {
							parentDir: node,
							parentDirContents: result.data
						};
					}
				}
			}).result;
		}))
		.then(angular.bind(this, this.uploadFile))
		.catch(angular.bind(this, function(result) {
			if (!( angular.isString(result) && result == "modal.cancelled" )) {
				UiMessage.add("danger", "Cannot upload file, because listing the parent folder contents failed.");
				console.error("Cannot upload file, because listing the parent folder contents failed.");
				console.debug(result);
			}
		}));
		
		return false;
	});
	
	this.treeContextMenu = {
		items: {
			createFolder:	{label:'Create Folder',	action:this.treeCreateFolder},
			uploadFile:		{label:'Upload File',	action:this.treeUploadFile}
		}
	};
	
	$scope.$on("catalogJsTree.openNode", angular.bind(this, function(event, data) {
		this.navigateToDir( data["nodeId"] );
	}));
	
	$scope.$watch(
		angular.bind(this, function(scope) {
			return this.selectedDirAncestors;
		}),
		angular.bind(this, function(newVal, oldVal) {
			this.selectedDir = angular.copy( this.selectedDirAncestors[ this.selectedDirAncestors.length-1 ] );
		})
	);
	
	$scope.$watch(
		angular.bind(this, function(scope) {
			return this.fileContPage;
		}),
		angular.bind(this, this.showFileContentsPage)
	);
	
	$scope.$watch(
		angular.bind(this, function(scope) {
			return this.selectedFileContents;
		}),
		angular.bind(this, function(newVal, oldVal) {
			this.fileContPage = 1;
			this.showFileContentsPage();
		})
	);
	
	//init actions
	
}]);

angular.module("insightal.workbench")
	.controller("CreateDirModalCtrl", [
		"$scope", "$modalInstance", "modalData", function(
		 $scope,   $modalInstance,   modalData) {
	this.parentDir			= modalData["parentDir"];
	this.parentDirContents	= modalData["parentDirContents"];
	this.validationErrors	= [];
	this.newDir = {
		parent: this.parentDir["id"],
		name:	""
	};
	
	this.isValid = function(fieldId) {
		for (var i=0; i<this.validationErrors.length; i++) {
			if (this.validationErrors[i]["field"] == fieldId)
				return false;
		}
		return true;
	};
	
	this.save = function(formData) {
		var name = this.newDir["name"];
		this.validationErrors = [];
		if ( !angular.isString(name) || name.length == 0 ) {
			this.validationErrors.push({ message:"The name field is empty.", field:"name" });
		}
		if ( angular.isString(name) && name.indexOf(" ") >= 0 ) {
			this.validationErrors.push({ message:"The name must not contain spaces.", field:"name" });
		}
		if ( this.parentDirContents["folders"].indexOf(name) >= 0 ||
			 this.parentDirContents["files"  ].indexOf(name) >= 0 ) {
			var msg = "A folder or file with name \"" + name + "\" already exists";
			msg += angular.isString( this.parentDir["text"] )? (" in folder \"" + this.parentDir["text"] + "\".") : " in this folder.";
			this.validationErrors.push({ message:msg, field:"name" });
		}

		if (this.validationErrors.length == 0) {
			$modalInstance.close(this.newDir);
		}
	};
	
	this.cancel = function() {
		$modalInstance.dismiss();
	};
}]);

angular.module("insightal.workbench")
	.controller("UploadFileModalCtrl", [
		"$scope", "$modalInstance", "modalData", function(
		 $scope,   $modalInstance,   modalData) {
	this.parentDir			= modalData["parentDir"];
	this.parentDirContents	= modalData["parentDirContents"];
	this.validationErrors = [];
	this.file = null;
	
	this.isValid = function(fieldId) {
		for (var i=0; i<this.validationErrors.length; i++) {
			if (this.validationErrors[i]["field"] == fieldId)
				return false;
		}
		return true;
	};
	
	this.save = function(formData) {
		var name;
		this.validationErrors = [];
		if ( angular.isUndefined( this.file ) || this.file == null ) {
			this.validationErrors.push({ message:"Please, select a file to upload.", field:"file" });
		}
		else {
			name = this.file["name"];
		}
		if ( angular.isString(name) && name.indexOf(" ") >= 0 ) {
			this.validationErrors.push({ message:"The file name must not contain spaces.", field:"file" });
		}
		if ( this.parentDirContents["folders"].indexOf(name) >= 0 ||
			 this.parentDirContents["files"  ].indexOf(name) >= 0 ) {
			var msg = "A file or folder with name \"" + name + "\" already exists";
			msg += angular.isString( this.parentDir["text"] )? (" in folder \"" + this.parentDir["text"] + "\".") : " in this folder.";
			this.validationErrors.push({ message:msg, field:"file" });
		}
	
		if (this.validationErrors.length == 0) {
			$modalInstance.close({ file:this.file, dirId:this.parentDir["id"] });
		}
	};
	
	this.cancel = function() {
		$modalInstance.dismiss("modal.cancelled");
	};
}]);

angular.module("insightal.workbench")
	.controller("WbCollectionsCtrl", [
		"$scope", "Group", "Application", "Collection", "Sensor", "Auth", "TreeUtils", "Utils", function(
		 $scope,   Group,   Application,   Collection,   Sensor,   Auth,   TreeUtils,   Utils) {
	
	this.collections = [];
	this.collectionsFiltered = [];
	this.collectionsRetrieved = false;
	
	// TODO change level numbers to 11 = group, 21 = app., 31 = coll., 41 = document, 42 = sensor ...
	this.levels  = ["", "group", "application", "collection", "document", "field"];
	
	this.getLevelName = function(level) {
		if ( angular.isString( this.levels[level] ) )
			return this.levels[level];
		else
			return "";
	};
	
	this.loadNodeItems = function(node, successCB, noCache) {
		var dir = TreeUtils.getNodeById(node["id"], this.collections),
			dirChildren = TreeUtils.getNodesByParentId(node["id"], this.collections);
		
		if ( angular.isUndefined(noCache) || noCache != true )
			noCache = false;
		
		if ( node["id"] != "#" && (dir == null || !dir["isDirectory"]) )
			return;
		
		// the following block creates "Home" directory as an only child of root "#" directory
		if (node["id"] == "#") {
			var newNodes = [{
				id: "##",
				text: "My Groups",
				parent: "#",
				isDirectory: true,
				children: true,
				level: 0
			}];
			this.collections = newNodes;
			if ( angular.isFunction( successCB ) ) {
				successCB(newNodes);
			}
			return;
		}
		
		if ( !noCache && dirChildren.length > 0 ) {
			// get data from cache
			if ( angular.isFunction( successCB ) ) {
				successCB(dirChildren);
			}
		}
		else { // get data from server
			// remove any existing data first
			this.collections = TreeUtils.deleteNodesByParentId(node["id"], this.collections);
			
			// construct the full path to be used in DataCatalog.listDirectory
			var path = TreeUtils.getNodePath(node["id"], this.collections).replace(/##/g, Auth.user["tenantId"]);
			
			var errorHandler = angular.bind(this, function(result) {
				console.error("list directory error!");
				console.error(result);
			});
			
			if (node["level"] == 0) {
				Group.getAll({ tenantId:Auth.user["tenantId"] })
				.then( angular.bind(this, this.getNodeChildrenSuccessFn(node, "groups", successCB)) )
				.catch(errorHandler);
			}
			else if (node["level"] == 1) {
				Application.getAppsByGroup({ groupId:node["id"] })
				.then( angular.bind(this, this.getNodeChildrenSuccessFn(node, "applications", successCB)) )
				.catch(errorHandler);
			}
			else if (node["level"] == 2) {
				Collection.getCollectionsByApp({ applicationId:node["id"] })
				.then( angular.bind(this, this.getNodeChildrenSuccessFn(node, "collections", successCB)) )
				.catch(errorHandler);
			}
		}
	};
	
	this.getNodeChildrenSuccessFn = function(parent, resKey, successCB) {
		return function(result) { // result = {data:string|Object, headers:function, config:Object, status:number, statusText:string}
			var data = result.data[resKey],
				newNodes = [];
			if ( angular.isArray(data) ) {
				for (var i=0; i<data.length; i++) {
					newNodes.push({
						id:		data[i][0],
						text:	data[i][1],
						parent:		parent["id"],
						isDirectory:parent["level"] < 2,
						children:	parent["level"] < 2,
						level:		parent["level"] + 1
					});
				}
			}
			this.collections = this.collections.concat( newNodes );
			if ( angular.isFunction( successCB ) ) {
				successCB(newNodes);
			}
			if (resKey === "collections") {
				this.collectionsRetrieved = true;
			}
		};
	};
	
	/* methods prefixed "tree" are used for purposes of the jsTree directive */
	
	this.treeNodesToLoad = [];
	this.treeNodesToOpen = [];
	
	this.treeRootLoaded = angular.bind(this, function() {
		this.treeNodesToOpen = ["##"];
		$scope.$apply();
	});
	
	this.treeActivateNodeCB = angular.bind(this, function(event, data) {
		if (data.node["state"]["loaded"]) {
			this.treeOpenNodeCB(event, data);
		}
	});
	
	this.treeOpenNodeCB = angular.bind(this, function(event, data) {
		var nodeId = data.node["id"],
			isDirectory = data.node["original"]["isDirectory"];
		if (isDirectory) {
			$scope.$broadcast("catalogJsTree.openNode", {nodeId:nodeId});
			$scope.$apply();
		}
	});
	
	this.treeGetNodeChildren = angular.bind(this, function(nodeToLoad, callback) {
		var nodeOriginal = ( angular.isObject(nodeToLoad["original"]) )? nodeToLoad["original"] : nodeToLoad;
		this.loadNodeItems(nodeOriginal, angular.bind(this, function(nodeChildrenData) {
			var newNodes = angular.copy( nodeChildrenData );
			for (var i=0; i<newNodes.length; i++) {
				var levelName = (newNodes[i]["level"] < 3)? this.getLevelName( newNodes[i]["level"] ) : "";
				if (levelName.length > 0)
					newNodes[i]["text"] += " [" + levelName + "]"; 
				if ( !newNodes[i]["isDirectory"] ) {
					newNodes[i]["icon"] = "jstree-file";
				}
			}
			if (nodeToLoad["id"] === "#") // "#" represents jsTree root element
				$scope.$broadcast("catalogJsTree.openNode", {nodeId:"##"}); // "##" is ID of the "Home" directory in the view
			else if (newNodes.length == 0) // openNode doesn't happen automaticaly for empty directories
				$scope.$broadcast("catalogJsTree.openNode", {nodeId:nodeToLoad["id"]}); // "##" is ID of the "Home" directory in the view
			callback(newNodes);
		}), true); // the last argument means that potentially cached results should not be used (always reload)
	});
	
	$scope.$watch(
			angular.bind(this, function(scope) {
				return this.collections.length;
			}),
			angular.bind(this, function(newVal, oldVal) {
				var colList = [];
				for (var i=0; i<this.collections.length; i++) {
					if (this.collections[i]["level"] == 3) {
						colList.push( angular.copy( this.collections[i] ) );
					}
				}
				this.collectionsFiltered = colList;
			})
		);

}]);

angular.module("insightal.workbench")
	.controller("WbDatasetsCtrl", [
		"$scope", "$window", "DataCatalog", "Auth", "Utils", function(
		 $scope,   $window,   DataCatalog,   Auth,   Utils) {
	
	this.list = { // dataset list
		all:			[],
		numPages:		 0,
		numPerPage:		10, // constant - set this to change list page size
		numResults:		 0, 
		currentPage:	 1,
		orderKey:		"name",
		orderReverse:	false
	};
	
	this.selectedDataset = {
		name:			"",
		columns:		[],
		all:			[],
		numPages:		 0,
		numPerPage:		10, // constant - set this to change list page size
		numResults:		 0, 
		currentPage:	 1,
		orderKey:		"",
		orderReverse:	false
	};
	
	this.displayDatasetList = function() {
		DataCatalog.getDatasets({ tenantId:Auth.user["tenantId"] })
		.then(angular.bind(this, function(result) {
			var datasets = result.data["results"],
				list = [],
				dirString, fileString,
				dir, file;
			for (var guid in datasets) {
				dirString = "";
				if (angular.isArray( datasets[guid]["folders"] )) {
					for (var i=0; i<datasets[guid]["folders"].length; i++) {
						dir = datasets[guid]["folders"][i];
						dir = dir.substr( dir.lastIndexOf("/") + 1 );
						dirString += dir + ", ";
					}
				}
				if (dirString.length > 0) {
					dirString = dirString.substr(0, dirString.length - 2);
				}
				fileString = "";
				if (angular.isArray( datasets[guid]["files"] )) {
					for (var i=0; i<datasets[guid]["files"].length; i++) {
						file = datasets[guid]["files"][i];
						file = file.substr( file.lastIndexOf("/") + 1 );
						fileString += file + ", ";
					}
				}
				if (fileString.length > 0) {
					fileString = fileString.substr(0, fileString.length - 2);
				}
				list.push({
					guid:	guid,
					name:	datasets[guid]["name"],
					dirs:	datasets[guid]["folders"],
					files:	datasets[guid]["files"],
					dirString:	dirString,
					fileString:	fileString
				});
			}
			this.list["all"] = list;
		}))
		.catch(function(result) {
			console.error("Getting the dataset list failed:");
			console.debug(result);
		});
	};
	
	this.viewDataset = function(datasetGuid, datasetName) {
		DataCatalog.getDatasetContents({
			tenantId: Auth.user["tenantId"],
			datasetGuid: datasetGuid,
			datasetName: datasetName
		})
		.then(angular.bind(this, function(result) {
			var datasetRows = result["datasetData"],
				columns = [];
			if (angular.isArray( datasetRows ) && datasetRows.length > 0) {
				for (var column in datasetRows[0]) {
					columns.push( column );
				}
			}
			this.selectedDataset["name"]	 = datasetName;
			this.selectedDataset["columns"]	 = columns;
			this.selectedDataset["orderKey"] = columns[0];
			this.selectedDataset["all"]		 = datasetRows;
		}))
		.catch(angular.bind(this, function(result) {
			console.error("View dataset contents failed.");
			console.debug(result);
		}));
	};
	
	this.formatDate = function(timestamp) {
		return Utils.formatDate(new Date(timestamp), "date-time");
	};
	
	this.changeListOrder = function(listName, key) {
		var list = this[listName];
		list["orderReverse"] = (key === list["orderKey"])? !list["orderReverse"] : false;
		list["orderKey"] = key;
	};
	
	$scope.$watchCollection( // this watches not only for array pointer change, but also for elements addition/removal
		angular.bind(this, function(scope) {
			return this.list["all"];
		}),
		angular.bind(this, function(newList, oldList) {
			var itemCount	= this.list["all"].length,
				itemPerPage	= this.list["numPerPage"];
			this.list["numResults"]	= itemCount;
			this.list["numPages"]	= Math.floor(itemCount / itemPerPage) + ((itemCount % itemPerPage > 0)? 1 : 0);
		})
	);
	
	$scope.$watchCollection( // this watches not only for array pointer change, but also for elements addition/removal
		angular.bind(this, function(scope) {
			return this.selectedDataset["all"];
		}),
		angular.bind(this, function(newList, oldList) {
			var itemCount	= this.selectedDataset["all"].length,
				itemPerPage	= this.selectedDataset["numPerPage"];
			this.selectedDataset["numResults"]	= itemCount;
			this.selectedDataset["numPages"]	= Math.floor(itemCount / itemPerPage) + ((itemCount % itemPerPage > 0)? 1 : 0);
		})
	);
	
	// init actions
	this.displayDatasetList();
	
}]);

angular.module("insightal.workbench")
	.controller("WbDatasetWizardCtrl", [
		"$scope", "$state", "Auth", "DataCatalog", "UiMessage", "TreeUtils", "Utils", function(
		 $scope,   $state,   Auth,   DataCatalog,   UiMessage,   TreeUtils,   Utils) {
	
	this.dataset = {
		name: "",
		description: "",
		files: [],
		dirs:  []
	};
	
//	this.dataset = {
//		name: null,
//		description: null,
//		file: {
//			id: null,
//			name: null,
//			path: null,
//			type: "csv",
//			rowDelimiter: "newLine",
//			columnDelimiter: "comma",
//			escapeCharacter: "backslash",
//			quoteCharacter: "quoteDouble"
//		},
//		columns: [] // e.g. {order:0, guid:"...", name:"Count", type:"int", show:true},
//	};
//	this.colOrder = [0,1,2,3,4,5,6,7];
//	this.datasetDisplayData = [];
			
	this.files = [];
	this.treeNodesToLoad = [];
	this.treeNodesToOpen = [];
	
//	this.sourceFileColumns = [];
//	this.sourceFileContents = [];
	
	this.validationErrors = []; // e.g.: {field:"dsName", message:"The field must not be empty."}
	this.isValid = function(fieldId) {
		for (var i=0; i<this.validationErrors.length; i++) {
			if (this.validationErrors[i]["field"] == fieldId)
				return false;
		}
		return true;
	};
	
	this.loadDirItems = function(dirId, successCB, noCache) {
		var dir = TreeUtils.getNodeById(dirId, this.files),
			dirChildren = TreeUtils.getNodesByParentId(dirId, this.files);
		
		if ( angular.isUndefined(noCache) || noCache != true )
			noCache = false;
		
		if ( dirId != "#" && (dir == null || !dir["isDirectory"]) )
			return;
		
		// the following block creates "Home" directory as an only child of root "#" directory
		if (dirId == "#") {
			var newNodes = [{
				id: "##",
				text: "Home",
				parent: "#",
				isDirectory: true,
				children: true
			}];
			this.files = newNodes;
			if ( angular.isFunction( successCB ) ) {
				successCB(newNodes);
			}
			return;
		}
		
		if ( !noCache && dirChildren.length > 0 ) {
			// get data from cache
			if ( angular.isFunction( successCB ) ) {
				successCB(dirChildren);
			}
		}
		else { // get data from server
			// remove any existing data first
			this.files = TreeUtils.deleteNodesByParentId(dirId, this.files);
			
			// construct the full path to be used in DataCatalog.listDirectory
			var path = TreeUtils.getNodePath(dirId, this.files, null, "##"); // the last argument instructs to remove the "##" from the beginning of the path
			
			DataCatalog.listDirectory({
				name: path,
				tenantId: Auth.user["tenantId"]
			})
			.then(angular.bind(this, function(result) {
				var newNodes = [];
				if ( angular.isArray( result.data["folders"] ) ) {
					for (var i=0; i<result.data["folders"].length; i++) {
						newNodes.push({
							id:		result.data["folders"][i],
							text:	result.data["folders"][i],
							parent:	dirId,
							isDirectory: true,
							children:	 true
						});
					}
				}
				if ( angular.isArray( result.data["files"] ) ) {
					for (var i=0; i<result.data["files"].length; i++) {
						newNodes.push({
							id:		result.data["files"][i],
							text:	result.data["files"][i],
							parent:	dirId,
							isDirectory: false
						});
					}
				}
				this.files = this.files.concat( newNodes );
				if ( angular.isFunction( successCB ) ) {
					successCB(newNodes);
				}
			}))
			.catch(angular.bind(this, function(result) {
				console.error("list directory error!");
				console.error(result);
			}));
		}
	};
		
	this.treeRootLoaded = angular.bind(this, function() {
		this.treeNodesToOpen = ["##"];
		$scope.$apply();
	});
	
	this.treeActivateNodeCB = angular.bind(this, function(event, data) {
		if (data.node["state"]["loaded"]) {
			this.treeOpenNodeCB(event, data);
		}
	});
	
	this.treeOpenNodeCB = angular.bind(this, function(event, data) {
		var nodeId = data.node["id"],
			isDirectory = data.node["original"]["isDirectory"];
		if (isDirectory) {
			$scope.$broadcast("catalogJsTree.openNode", {nodeId:nodeId});
			$scope.$apply();
		}
	});
	
	this.treeSelectNodeCB = angular.bind(this, function(event, data) {
		var nodeIdsList = data["selected"],
			dirList  = [],
			fileList = [],
			node;
		for (var i=0; i<nodeIdsList.length; i++) {
			node = angular.copy( Utils.getElementByGuid(nodeIdsList[i], this.files, "id") );
			if (node != null) {
				node["path"] = TreeUtils.getNodeAncestorsPath(node["id"], this.files).replace(/##\//g, "").replace(/##/g, ""); 
				if (node["isDirectory"])
					dirList.push(node);
				else
					fileList.push(node);
			}
		}
		this.dataset["dirs"]  = dirList;
		this.dataset["files"] = fileList;
		$scope.$apply();
	});
	
	this.treeGetNodeChildren = angular.bind(this, function(nodeToLoad, callback) {
		this.loadDirItems(nodeToLoad["id"], angular.bind(this, function(nodeChildrenData) {
			var newNodes = angular.copy( nodeChildrenData );
			for (var i=0; i<newNodes.length; i++) {
				if ( !newNodes[i]["isDirectory"] ) {
					newNodes[i]["icon"] = "jstree-file";
				}
			}
			if (nodeToLoad["id"] === "#") // "#" represents jsTree root element
				$scope.$broadcast("catalogJsTree.openNode", {nodeId:"##"}); // "##" is ID of the "Home" directory in the view
			else if (newNodes.length == 0) // openNode doesn't happen automaticaly for empty directories
				$scope.$broadcast("catalogJsTree.openNode", {nodeId:nodeToLoad["id"]}); // "##" is ID of the "Home" directory in the view
			callback(newNodes);
		}), true); // the last argument means that potentially cached results should not be used (always reload)
	});			
			
	this.goToStep = function(toStep, sref) {
		var validationErrors = [];
		if (toStep == 2) {
			if ( !angular.isString( this.dataset["name"] ) || this.dataset["name"].length == 0)
				validationErrors.push({ field:"dsName", message:"The dataset name must not be empty." });
		}
		
		if (validationErrors.length == 0) {
			this.currentStep = toStep;
			$state.go(sref);
		}
		this.validationErrors = validationErrors;
	};
			
	this.validationErrors = [];
	this.currentStep = 1;
	
	this.saveDataset = function() {
		var dirPaths  = [],
			filePaths = [];
		for (var i=0; i<this.dataset["dirs"].length; i++) {
			var dir = this.dataset["dirs"][i];
			dirPaths.push( dir["path"] + (dir["path"].length>0? "/" : "") + dir["id"] );
		}
		for (var i=0; i<this.dataset["files"].length; i++) {
			var file = this.dataset["files"][i];
			filePaths.push( file["path"] + (file["path"].length>0? "/" : "") + file["id"] );
		}
		
		DataCatalog.createDataset({
			tenantId:	Auth.user["tenantId"],
			name:		this.dataset["name"],
			dirs:		dirPaths,
			files:		filePaths
		})
		.then(function(result) {
			$state.go("user.workbench.catalog.datasets");
		})
		.catch(function(result) {
			console.error("Creating the dataset failed.");
			console.debug(result);
		});
	};
	
//	this.options = {
//		fileType: [
//			{value:"csv", label:"CSV"},
//			{value:"json", label:"JSON"}
//		],
//		rowDelimiter: [
//			{value:"newLine", label:"Any New Line"},
//			{value:"newLine2", label:"Carriage Return + New Line Characters"}
//		],
//		columnDelimiter: [
//   			{value:"comma", label:"Comma (\",\")"},
//   			{value:"semicolon", label:"Semicolon (\";\")"},
//   			{value:"tab", label:"Tab"}
//   		],
//   		escapeCharacter: [
//  			{value:"backslash", label:"Backslash (\"\\\")"},
//  			{value:"escChar2", label:"Another Option (\"?\")"}
//  		],
//  		quoteCharacter: [
//   			{value:"quoteSingle", label:"Single Quote (')"},
//   			{value:"quoteDouble", label:"Double Quote (\")"}
//   		],
//  		columnType: [
//   			{value:"string", label:"String"},
//   			{value:"int", label:"Integer"},
//   			{value:"float", label:"Float"}
//   		]
//	};
//	
//	this.getSourceFileData = function() {
//		var fileId = this.dataset["file"]["id"];
//		this.selectedFile = TreeUtils.getNodeById(fileId, this.files);
//		
//		DataCatalog.getFileData({
//			tenantId:	Auth.user["tenantId"],
//			outputFolderPath: TreeUtils.getNodeAncestorsPath(fileId, this.files).replace(/##\//g, "").replace(/##/g, ""),
//			fileName:	fileId
//		})
//		.then(angular.bind(this, function(result) {
//			console.debug("viewFileContents SUCCESS");
//			console.debug(result);
//			var rawData = result["data"]["data"],
//				fileData = [], fileColumns = [], keys = [],
//				fileColumnsObj = [];
//			for (var i=0; i<rawData.length; i++) {
//				fileData.push( JSON.parse( rawData[i] ) );
//			}
//			if (fileData.length > 0) {
//				for (var colKey in fileData[0])
//					keys[ rawData[0].indexOf(colKey) ] = colKey;
//				for (var key in keys)
//					fileColumns.push( keys[key].substr(2) );
//			}
//			this.sourceFileColumns  = fileColumns;
//			this.sourceFileContents = fileData;
//			
//			for (var i=0; i<fileColumns.length; i++) {
//				fileColumnsObj.push({
//					order: i,
//					guid: Utils.generateUUID(),
//					name: fileColumns[i],
//					type: "string",
//					show: true
//				});
//			}
//			this.dataset["columns"] = fileColumnsObj; 
//		}))
//		.catch(function(result) {
//			UiMessage.add("danger", "An error occurred while retrieving the file contents.");
//			console.debug("viewFileContents ERROR");
//			console.debug(result);
//		});
//	};
//	
//	this.getColumnsOrderArray = function() {
//		var a = [""];
//		for (var i=1; i<=this.dataset.columns.length; i++) {
//			a.push( i.toString() );
//		}
//		return a;
//	};
//	
//	this.changeColumnsOrder = function(colGuid, newPosition) {
//		var column =  Utils.getElementByGuid(colGuid, this.dataset["columns"]),
//			oldPosition = column["order"],
//			positions = [],//, columns = [],
//			minPos, maxPos, incPos, getPos;
//		if (oldPosition < 0 || oldPosition == newPosition)
//			return;
//		
//		minPos = Math.min(oldPosition, newPosition);
//		maxPos = Math.max(oldPosition, newPosition);
//		incPos = Math.sign(oldPosition - newPosition);
//		getPos = function(idx) {
//			if (idx < minPos || idx > maxPos)
//				return idx;
//			if (idx == oldPosition)
//				return newPosition;
//			return idx + incPos;
//		};
//		
//		for (var i=0; i<this.dataset["columns"].length; i++) {
//			var newPos = getPos( this.dataset["columns"][i]["order"] );
//			this.dataset["columns"][i]["order"] = newPos;
//			this.colOrder[newPos] = i;
//		}
//		
//		this.reorderDatasetColumns();
//	};
//	
//	this.reorderDatasetColumns = function() {
//		var columns = Utils.sortArrayOfObj(this.dataset["columns"], "order", false, "number"),
//			sourceFileColumns = [];
//		for (var i=0; i<columns.length; i++) {
//			sourceFileColumns.push( columns[i]["name"] );
//		}
//		this.sourceFileColumns = sourceFileColumns;
//	};
//	
//	$scope.$watch(
//		angular.bind(this, function(scope) {
//			return this.currentStep;
//		}),
//		angular.bind(this, function(newVal, oldVal) {
//			if (newVal == 4) {
//				this.getSourceFileData();
//			}
//		})
//	);
	
	// init actions
//	this.datasetDisplayData = this.exampleData;
	
}]);

angular.module("insightal.workbench")
	.controller("WbDataviewWizardCtrl", [
		"$scope", "$state", "Auth", "DataCatalog", "Utils", function(
		 $scope,   $state,   Auth,   DataCatalog,   Utils) {
	
	this.dataset = {
		name: null,
		description: null,
		sourceDatasets: [], // e.g. ["someGuid", "anotherGuid"]
		columns: [], // e.g. {name:"Column 1", include:true, originDatasetName:"My Dataset 1", originColumnName:"Column 1",	data:["one", "two"]}
		joinConditions: [],
		filters: []
	};
	this.colOrder = [0,1,2,3,4,5,6,7];
	this.datasetDisplayData = [];
	
	this.sourceDatasets = [
		"cb80ee10-24f9-4491-9e76-464c6aa82e12",
		"33acbfd1-4207-4388-b5f0-0e7d3798f304",
		"a9d30015-2d1b-40b0-a958-a14982cd9b4f"
	];
	
	// remove later
	this.joinConditions = [{guid:"9051a4ab-227e-4007-acfb-e9e8884f87a0", dsLeft:"cb80ee10-24f9-4491-9e76-464c6aa82e12", dsRight:"33acbfd1-4207-4388-b5f0-0e7d3798f304", colLeft:"Column 1", colRight:"Column 1"}];
	// remove later
	this.filters = [{guid:"bbba0a55-4034-4821-ae7a-86356dd6cc6c", dataset:"cb80ee10-24f9-4491-9e76-464c6aa82e12", column:"Column 1", operator:"==", value:null}];
	
	this.filterOperators = [
		{value:"==", label:"IS EQUAL TO"},
		{value:"!=", label:"IS NOT EQUAL TO"},
		{value:">", label:"IS GREATER THAN"},
		{value:"<", label:"IS LESS THAN"},
		{value:">=", label:"IS GREATER THAN OR EQUAL TO"},
		{value:"<=", label:"IS LESS THAN OR EQUAL TO"},
		{value:"timestamp>", label:"(DATE) IS AFTER"},
		{value:"timestamp<", label:"(DATE) IS BEFORE"},
		{value:"string_cotains", label:"(STRING) CONTAINS"},
		{value:"string_not_contains", label:"(STRING) DOES NOT CONTAIN"}
	];
	
	// remove later
	this.datasetNewColumns = [
		{
			name: "Column 1",
			include: true,
			originDatasetName: "My Dataset 1",
			originColumnName: "Column 1",
			data: ["Maryland", "Massachusetts", "Minnesota", "Maine", "Michigan", "Missouri", "Montana", "Mississippi"]
		},
		{
			name: "Column 2",
			include: true,
			originDatasetName: "My Dataset 4",
			originColumnName: "Column 2",
			data: ["251", "711", "455", "477", "101", "281", "300", "924"]
		},
		{
			name: "Column 3",
			include: true,
			originDatasetName: "My Dataset 4",
			originColumnName: "Column 3",
			data: ["green", "green", "red", "black", "green"]
		}
	];
	
	this.getSourceDatasets = function() {
		var datasets = [];
		for (var i=0; i<this.sourceDatasets.length; i++) {
			datasets.push( Utils.getElementByGuid( this.sourceDatasets[i], this.exampleDatasets ) );
		}
		return datasets;
	};
	
	this.getDatasetColumns = function(dsGuid) {
		var columns = [],
			dataset = Utils.getElementByGuid(dsGuid, this.exampleDatasets);
		if (dataset == null)
			return [];
		for (var i=0; i<dataset["columns"].length; i++) {
			columns.push( dataset["columns"][i]["name"] );
		}
		return columns;
	};
	
	this.formatDate = function(timestamp) {
		return Utils.formatDate(new Date(timestamp), "date-time");
	};
	
	this.addJoinCondition = function() {
		this.joinConditions.push({
			guid: Utils.generateUUID(),
			dsLeft: null,
			dsRight: null,
			colLeft: null,
			colRight: null
		});
	};
	
	this.removeJoinCondition = function(guid) {
		this.joinConditions.splice( Utils.getIndexByGuid(guid, this.joinConditions), 1 );
	};
	
	this.addFilter = function() {
		this.filters.push({
			guid: Utils.generateUUID(),
			dataset: null,
			column: null,
			operator: null,
			value: null
		});
	};
	
	this.removeFilter = function(guid) {
		this.filters.splice( Utils.getIndexByGuid(guid, this.filters), 1 );
	};
			
	this.goToStep = function(toStep, sref) {
		var validationErrors = [];
		if (toStep == 2) {
			if ( !angular.isString( this.dataset["name"] ) || this.dataset["name"].length == 0)
				validationErrors.push({ field:"dsName", message:"The dataset name must not be empty." });
		}
		
		if (validationErrors.length == 0) {
			this.currentStep = toStep;
			$state.go(sref);
		}
		this.validationErrors = validationErrors;
	};
			
	this.validationErrors = [];
	this.currentStep = 1;
	
	this.getColumnsOrderArray = function() {
		var a = [""];
		for (var i=1; i<=this.dataset.columns.length; i++) {
			a.push( i.toString() );
		}
		return a;
	};
	
	this.changeColumnsOrder = function(colGuid, newPosition) {
//					console.debug("Change col order, guid = " + colGuid + ", new position = " + newPosition);
		var column =  Utils.getElementByGuid(colGuid, this.dataset["columns"]),
			oldPosition = column["order"],
			positions = [],//, columns = [],
			minPos, maxPos, incPos, getPos;
		if (oldPosition < 0 || oldPosition == newPosition)
			return;
		
		minPos = Math.min(oldPosition, newPosition);
		maxPos = Math.max(oldPosition, newPosition);
		incPos = Math.sign(oldPosition - newPosition);
		getPos = function(idx) {
			if (idx < minPos || idx > maxPos)
				return idx;
			if (idx == oldPosition)
				return newPosition;
			return idx + incPos;
		};
		
		for (var i=0; i<this.dataset["columns"].length; i++) {
			var newPos = getPos( this.dataset["columns"][i]["order"] );
			this.dataset["columns"][i]["order"] = newPos;
			this.colOrder[newPos] = i;
		}
		
		this.reorderDatasetColumns();
	};
	
	this.orderDataByIndexArray = function(data, indexArray) {
		var dataReordered = [];
		for (var i=0; i<data.length; i++)
			dataReordered[i] = data[ indexArray[i] ];
		return dataReordered;
	};
	
	this.reorderDatasetColumns = function() {
		var datasetReordered = [];
		for (var i=0; i<this.exampleData.length; i++)
			datasetReordered.push( this.orderDataByIndexArray(this.exampleData[i], this.colOrder) );
		this.datasetDisplayData = datasetReordered;
	};
	
	this.isValid = function(fieldId) {
		for (var i=0; i<this.validationErrors.length; i++) {
			if (this.validationErrors[i]["field"] == fieldId)
				return false;
		}
		return true;
	};
	
	this.exampleDatasets = [
  		{
			guid: "cb80ee10-24f9-4491-9e76-464c6aa82e12",
  			name: "My Dataset 1",
			files: ["File 1","File 2","File 3"],
			user: "Test User",
			tenant: "Tenant",
			lastUpdated: 1455641062308,
			columns:[
				{name:"Column 1",type:"int"},
				{name:"Column 2",type:"string"},
				{name:"Column 3",type:"float"},
				{name:"Column 4",type:"string"}
			]
		},
		{
			guid: "2bfe58b5-780c-402b-b6be-aadf151f8ce3",
			name: "My Dataset 2",
			files: ["File 11"],
			user: "Test User",
			tenant: "Tenant",
			lastUpdated: 1455640062308,
			columns:[
				{name:"Column 1",type:"int"},
				{name:"Column 2",type:"string"}
			]
		},
		{
			guid: "25563750-f426-41f8-ba91-1ae3a0bec463",
			name: "My Dataset 3",
			files: ["File 21"],
			user: "Test User",
			tenant: "Tenant",
			lastUpdated: 1455621062308,
			columns:[
				{name:"Column 1",type:"int"},
				{name:"Column 2",type:"string"},
				{name:"Column 3",type:"float"},
				{name:"Column 4",type:"string"},
				{name:"Column 5",type:"int"},
				{name:"Column 6",type:"string"}
			]
		},
		{
			guid: "33acbfd1-4207-4388-b5f0-0e7d3798f304",
  			name: "My Dataset 4",
			files: ["File 41","File 42","File 43"],
			user: "Test User",
			tenant: "Tenant",
			lastUpdated: 1455691062308,
			columns:[
				{name:"Column 1",type:"int"},
				{name:"Column 2",type:"string"},
				{name:"Column 3",type:"float"},
				{name:"Column 4",type:"string"}
			]
		},
		{
			guid: "a9d30015-2d1b-40b0-a958-a14982cd9b4f",
			name: "My Dataset 5",
			files: ["File 51"],
			user: "Test User",
			tenant: "Tenant",
			lastUpdated: 1455780062308,
			columns:[
				{name:"Column 1",type:"int"},
				{name:"Column 2",type:"string"}
			]
		}
	];
	
	this.exampleDataColumns = ["Rank","State","2009","2008","2007","2004–2006","Cost of Living Index","2009 Data"];
	this.exampleData = [
["1","Maryland","$69.272","$70.545","$68.080","$62.372","124.81","$55.502"],
["2","New Jersey","$68.342","$70.378","$67.035","$64.169","128.47","$53.197"],
["3","Connecticut","$67.034","$68.595","$65.967","$59.972","130.22","$51.477"],
["4","Alaska","$66.953","$68.460","$64.333","$57.639","132.64","$50.477"],
["5","Hawaii","$64.098","$67.214","$63.746","$60.681","165.56","$38.716"],
["6","Massachusetts","$64.081","$65.401","$62.365","$56.236","117.8","$54.398"],
["7","New Hampshire","$60.567","$63.731","$62.369","$60.489","116.68","$51.909"],
["8","Virginia","$59.330","$61.233","$59.562","$55.108","97.66","$60.752"],
["-","District of Columbia","$59.290","$57.936","$54.317","$47.221 (2005)","139.92","$42.374"],
["9","California","$58.931","$61.021","$59.948","$53.770","132.56","$44.456"],
["10","Delaware","$56.860","$57.989","$54.610","$52.214","102.4","$55.527"],
["11","Washington","$56.548","$58.078","$55.591","$53.439","103.98","$54.384"],
["12","Minnesota","$55.616","$57.288","$55.082","$57.363","102.23","$54.403"],
["13","Colorado","$55.430","$56.993","$55.212","$54.039","102.23","$54.221"],
["14","Utah","$55.117","$56.633","$55.109","$55.179","95.15","$57.926"],
["15","New York","$54.659","$56.033","$53.514","$48.201","128.29","$42.606"],
["16","Rhode Island","$54.119","$55.701","$53.568","$52.003","123.25","$43.910"],
["17","Illinois","$53.966","$56.235","$54.124","$49.280","96.08","$56.168"],
["18","Nevada","$53.341","$56.361","$55.062","$50.819","101.39","$52.610"],
["19","Wyoming","$52.664","$53.207","$51.731","$47.227","98.66","$53.379"],
["20","Vermont","$51.618","$52.104","$49.907","$51.622","120.38","$42.879"],
["-","United States","$50.221","$52.029","$50.740","$46.242 (2005)","-","-	"],
["21","Wisconsin","$49.993","$52.094","$50.578","$48.874","96.45","$51.833"],
["22","Pennsylvania","$49.520","$50.713","$48.576","$47.791","100.67","$49.190"],
["23","Arizona","$48.745","$50.958","$49.889","$46.729","103.73","$46.992"],
["24","Oregon","$48.457","$50.169","$48.730","$45.485","110.47","$43.864"],
["25","Texas","$48.259","$50.043","$47.548","$43.425","91.04","$53.009"],
["26","Iowa","$48.044","$48.980","$47.292","$47.489","93.98","$51.122"],
["27","North Dakota","$47.827","$45.685","$43.753","$43.753","95.91","$49.867"],
["28","Kansas","$47.817","$50.177","$47.451","$44.264","91.31","$52.368"],
["29","Georgia","$47.590","$50.861","$49.136","$46.841","92.21","$51.610"],
["30","Nebraska","$47.357","$49.693","$47.085","$48.126","91.09","$51.989"],
["31","Maine","$45.734","$46.581","$45.888","$45.040","116.42","$39.284"],
["32","Indiana","$45.424","$47.966","$47.448","$44.806","94.19","$48.226"],
["33","Ohio","$45.395","$47.988","$46.597","$45.837","93.85","$48.370"],
["34","Michigan","$45.255","$48.591","$47.950","$47.064","95.25","$47.512"],
["35","Missouri","$45.229","$46.867","$45.114","$44.651","91.66","$49.344"],
["36","South Dakota","$45.043","$46.032","$43.424","$44.624","98.53","$45.715"],
["37","Idaho","$44.926","$47.576","$46.253","$46.395","93.04","$48.287"],
["38","Florida","$44.736","$47.778","$47.804","$44.448","98.39","$45.468"],
["39","South Carolina","$44.625","$43.329","$40.822","-","98.71","$42.997"],
["40","North Carolina","$43.674","$46.549","$44.670","$42.061","96.21","$45.394"],
["41","New Mexico","$43.028","$43.508","$41.452","$40.827","98.88","$43.515"],
["42","Louisiana","$42.492","$43.733","$40.926","$37.943","96.15","$44.193"],
["43","Montana","$42.322","$43.654","$43.531","$38.629","100","$42.322"],
["44","Tennessee","$41.725","$43.614","$42.367","$40.676","89.49","$46.625"],
["45","Oklahoma","$41.664","$42.822","$41.567","$40.001","90.09","$46.247"],
["46","Alabama","$40.489","$42.666","$40.554","$38.473","92.74","$43.659"],
["47","Kentucky","$40.072","$41.538","$40.267","$38.466","89.21","$44.919"],
["48","Arkansas","$40.489","$41.393","$42.229","$41.679","90.61","$41.743"],
["49","West Virginia","$37.435","$37.989","$37.060","$37.227","94.4","$39.656"],
["50","Mississippi","$36.646","$37.790","$36.338","$35.261","92.26","$39.720"]
];
	
	// init actions
//	this.datasetDisplayData = this.exampleData;
	
}]);

angular.module("insightal.workbench")
	.controller("WbWorkflowsCtrl", [
		"$scope", "$window", "$modal", "$state", "DataCatalog", "Auth", "UiMessage", "Utils", function(
		 $scope,   $window,   $modal,   $state,   DataCatalog,   Auth,   UiMessage,   Utils) {

	this.list = { // workflow list
		items:			[],
		numPages:		 0,
		numPerPage:		10, // constant - set this to change list page size
		numResults:		 0, 
		currentPage:	 1,
		orderKey:		"name", // default column for sorting rows
		orderReverse:	false
	};
	
	this.displayWorkflowList = function() {
		DataCatalog.getWorkflows({ tenantId:Auth.user["tenantId"] })
		.then(angular.bind(this, function(result) {
			var workflows = result.data,
				list = [];
			for (var guid in workflows) {
				list.push({
					guid:		guid,
					name:		workflows[guid]["name"],
					steps:		workflows[guid]["steps"],
					stepCount:	workflows[guid]["steps"].length
				});
			}
			this.list["items"] = list;
		}))
		.catch(function(result) {
			console.error("Getting the workflow list failed:");
			console.debug(result);
		});
	};
	
	this.changeListOrder = function(key) {
		var list = this.list;
		list["orderReverse"] = (key === list["orderKey"])? !list["orderReverse"] : false;
		list["orderKey"] = key;
	};
	
	this.showWorkflowDef = function(guid) {
		var modalInstance = $modal.open({
			templateUrl: "partials/workbench/workflowDefinitionModal.html",
			controller: "WorkflowDefinitionModalCtrl as modal",
			resolve: {
				modalData: angular.bind(this, function() {
					return {
						workflow: Utils.getElementByGuid(guid, this.list["items"])
					};
				})
			}
		});
	};
	
	this.showExecuteModal = function(guid) {
		$modal.open({
			templateUrl: "partials/workbench/workflowExecuteModal.html",
			controller: "WorkflowExecuteModalCtrl as modal",
			size: "lg",
			resolve: {
				modalData: angular.bind(this, function() {
					return {
						workflow: Utils.getElementByGuid(guid, this.list["items"])
					};
				})
			}
		})
		.result.then(angular.bind(this, function(result) {
			this.executeWorkflow(result["workflowGuid"], result["steps"]);
		}));
	};
	
	this.executeWorkflow = function(guid, stepParams) {
		DataCatalog.executeWorkflow({ workflowId:guid, params:stepParams, tenantId:Auth.user["tenantId"] })
		.then(angular.bind(this, function(result) {
			var executionId = result.data["workflowInstanceId"];
			UiMessage.add("success", "The Workflow instance has been started. The instance ID is '" + executionId + "'. Keep this ID to check the workflow instance status.");
			$state.go("user.workbench.catalog.workflowExecutions", {guid:guid});
			console.debug("Workflow execution result:");
			console.debug(result);
		}))
		.catch(angular.bind(this, function(result) {
			UiMessage.add("danger", "Executing the workflow failed.");
			console.error("Executing the workflow (ID = '" + this.selectedWfId + "') failed.");
			console.debug(result);
		}));
	};
	
	$scope.$watchCollection( // this watches not only for array pointer change, but also for elements addition/removal
		angular.bind(this, function(scope) {
			return this.list["items"];
		}),
		angular.bind(this, function(newList, oldList) {
			var itemCount	= this.list["items"].length,
				itemPerPage	= this.list["numPerPage"];
			this.list["numResults"]	= itemCount;
			this.list["numPages"]	= Math.floor(itemCount / itemPerPage) + ((itemCount % itemPerPage > 0)? 1 : 0);
		})
	);
	
	// init actions
	this.displayWorkflowList();

}]);

angular.module("insightal.workbench")
	.controller("WorkflowDefinitionModalCtrl", [
		"$modalInstance", "modalData", function(
		 $modalInstance,   modalData) {
	
	this.workflow = modalData["workflow"];
	this.workflowString = JSON.stringify( this.workflow["steps"], undefined, 4);
	
	this.cancel = function() {
		$modalInstance.dismiss();
	};
	
}]);

angular.module("insightal.workbench")
	.controller("WorkflowExecuteModalCtrl", [
		"$modalInstance", "modalData", "Auth", "Utils", function(
		 $modalInstance,   modalData,   Auth,   Utils) {
	
	this.workflow = modalData["workflow"];
	this.workflowString = JSON.stringify( this.workflow["steps"], undefined, 4);
	this.workflowParams = (function(steps) {
		var res = [];
		if (!angular.isArray( steps ))
			return [];
		for (var i=0; i<steps.length; i++) {
			var stepParams = {
				name: steps[i]["name"],
				actionType: steps[i]["actionType"],
				params: {}
			};
			for (var key in steps[i]) {
				if ( key == "name" || key == "actionType" || (key == "scriptParams" && steps[i]["actionType"] == "executeSparkScript") )
					continue;
				var isMultiline = angular.isObject(steps[i][key]) || angular.isArray(steps[i][key]);
				stepParams["params"][key] = {
					value: isMultiline? Utils.stringifyJSON(steps[i][key]) : steps[i][key],
					isMultiline: isMultiline
				};
			}
			if (steps[i]["actionType"] == "executeSparkScript") {
				stepParams["sparkScriptParams"] = {
					tables:			{ value:"[]",		isMultiline:true  },
					sql:			{ value:"",			isMultiline:false },
					outputFolder:	{ value:"", 		isMultiline:false },
					saveOutput:		{ value:"false",	isMultiline:false },
					returnResults:	{ value:"true",		isMultiline:false }
				};
			}
			res.push(stepParams);
		}
		return res;
	})( this.workflow["steps"] );
	
	this.jsonTreeOptions = {
		hiddenFields:	["^\\$\\$.*"],
		disabledFields:	["name", "actionType"]
	};
	
	this.execute = function() {
//		var steps = [];
//		for (var i=0; i<this.workflowParams.length; i++) {
//			var params = {
//				name: this.workflowParams[i]["name"],
//				actionType: this.workflowParams[i]["actionType"]
//			};
//			for (var key in this.workflowParams[i]["params"]){
//				var p = this.workflowParams[i]["params"][key];
//				params[key] = p["isMultiline"]? Utils.parseJSON(p["value"]) : p["value"]
//			}
//			if (this.workflowParams[i]["actionType"] == "executeSparkScript") {
//				for (var key in this.workflowParams[i]["sparkScriptParams"]){
//					var p = this.workflowParams[i]["sparkScriptParams"][key];
//					// TODO: shouldn't it be inserted inside params.scriptParams, instead of just params?
//					params[key] = p["isMultiline"]? Utils.parseJSON(p["value"]) : p["value"]
//				}
//				params["tenantId"] = Auth.user["tenantId"];
//			}
//			steps[i] = params;
//		}
		$modalInstance.close({ workflowGuid:this.workflow["guid"], steps:this.workflow["steps"] });
	};
	
	this.cancel = function() {
		$modalInstance.dismiss();
	};

}]);

angular.module("insightal.workbench")
	.controller("WbWorkflowExecutionsCtrl", [
		"$scope", "$window", "$stateParams", "$modal", "DataCatalog", "Auth", function(
		 $scope,   $window,   $stateParams,   $modal,   DataCatalog,   Auth) {
	
	this.workflowGuid = $stateParams["guid"];
	this.workflow = null;
			
	this.list = { // execution list
		items:			[],
		numPages:		 0,
		numPerPage:		10, // constant - set this to change list page size
		numResults:		 0, 
		currentPage:	 1,
		orderKey:		"instanceId", // default column for sorting rows
		orderReverse:	false
	};
	
	this.getWorkflow = function(guid) {
		DataCatalog.getWorkflows({ tenantId:Auth.user["tenantId"] })
		.then(angular.bind(this, function(result) {
			var workflows = result.data;
			if (angular.isObject( workflows[guid] )) {
				this.workflow = {
					guid:		guid,
					name:		workflows[guid]["name"],
					steps:		workflows[guid]["steps"],
					stepCount:	workflows[guid]["steps"].length
				};
			}
		}))
		.catch(function(result) {
			console.error("Getting the workflow list failed:");
			console.debug(result);
		});
	};
	
	this.displayExecutionList = function() {
		DataCatalog.getWorkflowExecutions({ workflowId:this.workflowGuid })
		.then(angular.bind(this, function(result) {
			this.list["items"] = result.data;
		}))
		.catch(function(result) {
			console.error("Getting the execution list failed:");
			console.debug(result);
		});
	};
	
	this.changeListOrder = function(key) {
		var list = this.list;
		list["orderReverse"] = (key === list["orderKey"])? !list["orderReverse"] : false;
		list["orderKey"] = key;
	};
	
	this.showStatus = function(guid) {
		DataCatalog.getWorkflowStatus({ instanceId:guid })
		.then(angular.bind(this, function(result) {
			var modalInstance = $modal.open({
				templateUrl: "partials/workbench/executionStatusModal.html",
				controller: "WorkflowExecutionStatusModalCtrl as modal",
				resolve: {
					modalData: function() {
						return {
							execution: result.data
						};
					}
				}
			});
		}))
		.catch(angular.bind(this, function(result) {
			UiMessage.add("danger", "Checking the the workflow execution status failed.");
			console.error("Checking execution status (ID = '" + this.selectedWfId + "') failed.");
			console.debug(result);
		}));
	};
	
	$scope.$watchCollection( // this watches not only for array pointer change, but also for elements addition/removal
		angular.bind(this, function(scope) {
			return this.list["items"];
		}),
		angular.bind(this, function(newList, oldList) {
			var itemCount	= this.list["items"].length,
				itemPerPage	= this.list["numPerPage"];
			this.list["numResults"]	= itemCount;
			this.list["numPages"]	= Math.floor(itemCount / itemPerPage) + ((itemCount % itemPerPage > 0)? 1 : 0);
		})
	);
	
	// init actions
	this.displayExecutionList();
	this.getWorkflow( this.workflowGuid );

}]);

angular.module("insightal.workbench")
	.controller("WorkflowExecutionStatusModalCtrl", [
		"$modalInstance", "modalData", function(
		 $modalInstance,   modalData) {
	
	this.execution = modalData["execution"];
	this.message = angular.isString(this.execution.result)? this.execution.result : "";
	this.resultStrings = (function(results) {
		var output = [];
		if (!angular.isArray( results ))
			return [];
		for (var i=0; i<results.length; i++) {
			output.push( JSON.stringify(results[i], undefined, 4) );
		}
		return output;
	})(this.execution["results"]); 
	
	this.cancel = function() {
		$modalInstance.dismiss();
	};

}]);

angular.module("insightal.workbench")
	.controller("WbWorkflowsWizardCtrl", [
		"Utils", function(
		 Utils) {
	
	this.states = [
		{id:"stEl1", caption:"STATE 1", x:10, y:10},
		{id:"stEl2", caption:"STATE 2", x:300, y:10}
	];

}]);

angular.module("insightal.workbench")
	.controller("WbWorkflowCreateCtrl", [
		"$scope", "$window", "$state", "DataCatalog", "Auth", "UiMessage", "Utils", function(
		 $scope,   $window,   $state,   DataCatalog,   Auth,   UiMessage,   Utils) {
	
	this.name = "";
	this.description = "";
	this.steps = [];
	this.datasets = [];
	
	this.stepTypes = [
		{value:"filesystem",	label:"File / Folder Action"},
		{value:"script",		label:"Execute Script"},
		{value:"transform",		label:"Transform Data"}
	];
	
	this.addStep = function() {
		var guid = Utils.generateUUID();
		this.steps.push({
			type:	"filesystem",
			guid:	guid,
			name:	"Step " + (this.steps.length + 1)
			// file for source type
			// source and script for script type
			// sourceList and sql for transform type
		});
		$scope.$broadcast("workflowCreate.stepsChanged", this.steps);
	};
	
	this.removeStep = function(guid) {
		var idx = Utils.getIndexByGuid(guid, this.steps);
		if (idx >= 0) {
			this.steps.splice(idx, 1);
			$scope.$broadcast("workflowCreate.stepsChanged", this.steps);
		}
	};
	
	this.onStepTypeChange = function(stepGuid) {
		$scope.$broadcast("workflowCreate.stepsChanged", this.steps);
	};
	
	this.getPathAndFilename = function(fileObj) {
		if ( !angular.isObject( fileObj ) || !angular.isString( fileObj["path"] ) || !angular.isString( fileObj["name"] ) )
			return "";
		else
			return ( (fileObj["path"].length > 0)? (fileObj["path"] + "/") : "" ) + fileObj["name"];
	};
	
	this.getStepJson = function(input) {
//		console.debug("GET STEP JSON, calling with input: " + JSON.stringify(input));
		var step = {};
		step["name"] = input["name"];
		if ( input["type"] === "filesystem" ) {
			var fsAction = input["fs"]["actionType"],
				parent		= this.getPathAndFilename( input["fs"]["parentNode"] ),
				parentDest	= this.getPathAndFilename( input["fs"]["parentNodeDest"] )
			step["actionType"] = fsAction;
			if (fsAction == "createFolder") {
				var parentNode = input["fs"]["parentNode"],
					baseName = parentNode["path"] + ( (parentNode["path"].length>0 && parentNode["id"].length>0)? "/" : "" ) + parentNode["id"];
				if (baseName.length > 0)
					step["baseName"] = baseName;
				step["folderName"] = input["fs"]["nodeName"];
			}
			else if (fsAction == "deleteFolder") {
				step["filePath"] = parent + (parent.length>0? "/":"") + input["fs"]["nodeName"];
			}
			else if (fsAction == "copyFile") {
				step["sourceLocation"] = parent + (parent.length>0? "/":"") + input["fs"]["nodeName"];
				step["destinationLocation"] = parentDest + (parentDest.length>0? "/":"") + input["fs"]["nodeNameDest"];
			}
			else if (fsAction == "deleteFile") {
				step["filePath"] = parent + (parent.length>0? "/":"") + input["fs"]["nodeName"];
			}
		}
		else if ( input["type"] === "script" ) {
			if ( input["script"]["type"] === "spark" )
				step["actionType"] = "executeSparkScript";
			else
				step["actionType"] = "executeScript";
			step["scriptParams"] = {}; // SET INPUT DATA AND OUTPUT FOLDER
			step["scriptPath"] = this.getPathAndFilename( input["script"]["file"] );
		}
		else if ( input["type"] === "transform" ) {
			step["actionType"] = "transformJoin";
			step["saveOutput"] = input["transform"]["saveOutput"];
			if (step["saveOutput"]) {
				step["outputFolderPath"] = input["transform"]["outputFolderPath"];
				step["outputFolderName"] = input["transform"]["outputFolderName"];
				step["outputTableName"]  = input["transform"]["outputTableName"];
			}
			step["transforms"] = {
				type:	"JOIN",
				tables:	input["transform"]["inputs"],
				sql:	input["transform"]["sql"]
			}
		}
		else {
			return;
		}
//		console.debug("GET STEP JSON, returning: " + JSON.stringify(step));
		return step;
	};
	
	this.saveWorkflow = function() {
		var wf = {
				tenantId:	Auth.user["tenantId"],
				name:		this.name,
				enabled:	true,
				steps:		[]
			},
			step;
		
		for (var i=0; i<this.steps.length; i++) {
			step = this.getStepJson( this.steps[i] );
			if ( angular.isObject(step) )
				wf["steps"].push(step);
		}
		
//		console.debug("The complete workflow JSON, that will be saved on the server: " + JSON.stringify(wf));
//		console.debug("Workflow to save:");
//		console.debug(wf);
		
		DataCatalog.createWorkflow(wf)
		.then(angular.bind(this, function(result) {
			var wfId = result.data["id"];
			UiMessage.add("success", "The workflow has been saved successfully. The workflow ID is '" + wfId + "'. Please, copy this ID to use it for executing the workflow.");
			$state.go("user.workbench.catalog.workflows");
		}))
		.catch(angular.bind(this, function(result) {
			UiMessage.add("danger", "Saving the workflow failed.");
			console.debug("Saving a workflow failed:");
			console.error(result);
		}));
	};
	
	// type SOURCE
	$scope.setSourceNode = angular.bind(this, function(stepGuid, actionType, parent, nodeName, parent2, nodeName2) {
		var stepIdx = Utils.getIndexByGuid(stepGuid, this.steps);
		if (stepIdx >= 0) {
			this.steps[stepIdx]["type"] = "filesystem";
			this.steps[stepIdx]["fs"] = {
				actionType: actionType,
				parentNode: parent,
				nodeName: nodeName
			};
			if (actionType == "copyFile") {
				this.steps[stepIdx]["fs"]["parentNodeDest"] = parent2;
				this.steps[stepIdx]["fs"]["nodeNameDest"] = nodeName2;
			}
		}
	});
	
	// type SCRIPT
	$scope.setScriptNode = angular.bind(this, function(stepGuid, scriptType, inputType, input, script, output) {
		var stepIdx = Utils.getIndexByGuid(stepGuid, this.steps);
		if (stepIdx >= 0) {
			this.steps[stepIdx]["type"] = "script";
			this.steps[stepIdx]["script"] = {
				type:		scriptType,
				inputType:	inputType,
				input:		input,
				file:		script,
				output:		output
			};
		}
	});
	
	// type TRANSFORM
	$scope.setTransformNode = angular.bind(this, function(stepGuid, inputs, sql, output) {
		var getDatasetNames = function(guidList, datasets) {
			var res = [];
			for (var i=0; i<guidList.length; i++) {
				if (angular.isObject( datasets[ guidList[i] ] ))
					res.push( datasets[ guidList[i] ]["name"] );
			}
			return res;
		};
		var stepIdx = Utils.getIndexByGuid(stepGuid, this.steps),
			path;
		if (stepIdx >= 0) {
			this.steps[stepIdx]["type"] = "transform";
			this.steps[stepIdx]["transform"] = { 
				inputs:	getDatasetNames(inputs, this.datasets),
				sql:	sql
			};
			if (angular.isObject( output )) {
				console.debug("output");
				console.debug(output);
				path = output["name"];
				if (output["path"].length > 0)
					path = output["path"] + "/" + path;
				this.steps[stepIdx]["transform"]["saveOutput"] = true;
				this.steps[stepIdx]["transform"]["outputFolderPath"] = path
				this.steps[stepIdx]["transform"]["outputFolderName"] = output["folderName"];
				this.steps[stepIdx]["transform"]["outputTableName"]  = output["tableName"];
			}
			else {
				this.steps[stepIdx]["transform"]["saveOutput"] = false;
			}
		}
	});
	
	// init actions
	DataCatalog.getDatasets({ tenantId:Auth.user["tenantId"] })
	.then(angular.bind(this, function(result) {
		this.datasets = result.data["results"];
	}))
	.catch(function(result) {
		console.error("Could not get datasets.");
		console.debug(result);
	});
	
}]);

angular.module("insightal.workbench")
	.controller("WorkflowStepTypeFileCtrl", [
		"$scope", "Auth", "DataCatalog", "TreeUtils", "Utils", function(
		 $scope,   Auth,   DataCatalog,   TreeUtils,   Utils) {
			
	this.stepGuid = ""; // initialized from view
	this.actionTypes = [
        {value:"createFolder", label:"Create Folder"},
        {value:"deleteFolder", label:"Delete Folder"},
        {value:"copyFile", label:"Copy File"},
        {value:"deleteFile", label:"Delete File"}
	];
	this.files = [];
	this.treeNodesToLoad  = [];
	this.treeNodesToOpen  = [];
	this.treeNodesToOpen2 = [];
	this.fileActionType   = "createFolder";
	
	this.nodeName = "";
	this.selectedParentDisplayPath = "";
	this.selectedParent = {
		id: "",
		name: "",
		path: ""
	};
	
	this.nodeName2 = "";
	this.selectedParentDisplayPath2 = "";
	this.selectedParent2 = {
		id: "",
		name: "",
		path: ""
	};
	
	this.updateNodeInParentScope = function() {
		if ( angular.isString( this.selectedParent["id"] ) && this.selectedParent["id"].length > 0 ) {
			var parent = angular.copy( this.selectedParent ),
				path = "";
			if (parent["id"] == "##") {
				parent["id"] = "";
				parent["name"] = "";
			}
			if (parent["name"].length > 0)
				path = "/" + parent["name"];
			if (parent["path"].length > 0)
				path = "/" + parent["path"] + path;
			this.selectedParentDisplayPath = "Home" + path;
			if (this.fileActionType == "copyFile" && angular.isString( this.selectedParent2["id"] ) && this.selectedParent2["id"].length > 0) {
				var parent2 = angular.copy( this.selectedParent2 ),
					path2 = "";
				if (parent2["id"] == "##") {
					parent2["id"] = "";
					parent2["name"] = "";
				}
				if (parent2["name"].length > 0)
					path2 = "/" + parent2["name"];
				if (parent2["path"].length > 0)
					path2 = "/" + parent2["path"] + path2;
				this.selectedParentDisplayPath2 = "Home" + path2;
			}
			$scope.$parent.setSourceNode(this.stepGuid, this.fileActionType, parent, this.nodeName, parent2, this.nodeName2);
		}
	};
	
	this.loadDirItems = function(dirId, successCB, noCache) {
		var dir = TreeUtils.getNodeById(dirId, this.files),
			dirChildren = TreeUtils.getNodesByParentId(dirId, this.files);
		
		if ( angular.isUndefined(noCache) || noCache != true )
			noCache = false;
		
		if ( dirId != "#" && (dir == null || !dir["isDirectory"]) )
			return;
		
		// the following block creates "Home" directory as an only child of root "#" directory
		if (dirId == "#") {
			var newNodes = [{
				id: "##",
				text: "Home",
				parent: "#",
				isDirectory: true,
				children: true
			}];
			this.files = newNodes;
			if ( angular.isFunction( successCB ) ) {
				successCB(newNodes);
			}
			return;
		}
		
		if ( !noCache && dirChildren.length > 0 ) {
			// get data from cache
			if ( angular.isFunction( successCB ) ) {
				successCB(dirChildren);
			}
		}
		else { // get data from server
			// remove any existing data first
			this.files = TreeUtils.deleteNodesByParentId(dirId, this.files);
			
			// construct the full path to be used in DataCatalog.listDirectory
			var path = TreeUtils.getNodePath(dirId, this.files, null, "##"); // the last argument instructs to remove the "##" from the beginning of the path
			
			DataCatalog.listDirectory({
				name: path,
				tenantId: Auth.user["tenantId"]
			})
			.then(angular.bind(this, function(result) {
				var newNodes = [];
				if ( angular.isArray( result.data["folders"] ) ) {
					for (var i=0; i<result.data["folders"].length; i++) {
						newNodes.push({
							id:		result.data["folders"][i],
							text:	result.data["folders"][i],
							parent:	dirId,
							isDirectory: true,
							children:	 true
						});
					}
				}
				if ( angular.isArray( result.data["files"] ) ) {
					for (var i=0; i<result.data["files"].length; i++) {
						newNodes.push({
							id: result.data["files"][i],
							text: result.data["files"][i],
							parent: dirId,
							isDirectory: false
						});
					}
				}
				this.files = this.files.concat( newNodes );
				if ( angular.isFunction( successCB ) ) {
					successCB(newNodes);
				}
			}))
			.catch(angular.bind(this, function(result) {
				console.error("list directory error!");
				console.error(result);
			}));
		}
	};
		
	this.treeRootLoaded = angular.bind(this, function() {
		this.treeNodesToOpen  = ["##"];
		$scope.$apply();
	});
	
	this.treeRootLoaded2 = angular.bind(this, function() {
		this.treeNodesToOpen2  = ["##"];
		$scope.$apply();
	});
	
	this.treeSelectNodeCB = angular.bind(this, function(event, data) {
		if (data.node["original"]["isDirectory"]) {
			this.selectedParent["id"]   = data.node["id"];
			this.selectedParent["name"] = data.selected[0];
			this.selectedParent["path"] = TreeUtils.getNodeAncestorsPath(data.node["id"], this["files"]).replace(/##\//g, "").replace(/##/g, ""); // .replace(/##/g, Auth.user["tenantId"]);
			$scope.$apply();
		}
	});
	
	this.treeSelectNodeCB2 = angular.bind(this, function(event, data) {
		if (data.node["original"]["isDirectory"]) {
			this.selectedParent2["id"]   = data.node["id"];
			this.selectedParent2["name"] = data.selected[0];
			this.selectedParent2["path"] = TreeUtils.getNodeAncestorsPath(data.node["id"], this["files"]).replace(/##\//g, "").replace(/##/g, ""); // .replace(/##/g, Auth.user["tenantId"]);
			$scope.$apply();
		}
	});
	
	this.treeGetNodeChildren = angular.bind(this, function(nodeToLoad, callback) {
		this.loadDirItems(nodeToLoad["id"], angular.bind(this, function(nodeChildrenData) {
			var newNodes = angular.copy( nodeChildrenData );
			for (var i=0; i<newNodes.length; i++) {
				if ( !newNodes[i]["isDirectory"] ) {
					newNodes[i]["icon"] = "jstree-file";
				}
			}
			callback(newNodes);
		}), true); // the last argument means that potentially cached results should not be used (always reload)
	});
	
	$scope.$watch(
		angular.bind(this, function() {
			return this.selectedParent["id"] + this.selectedParent2["id"] + this.nodeName + this.nodeName2;
		}),
		angular.bind(this, this.updateNodeInParentScope)
	);

}]);

angular.module("insightal.workbench")
	.controller("WorkflowStepTypeScriptCtrl", [
		"$scope", "$modal", "Auth", "DataCatalog", "UiMessage", "TreeUtils", "Utils", function(
		 $scope,   $modal,   Auth,   DataCatalog,   UiMessage,   TreeUtils,   Utils) {
			
	this.stepGuid = ""; // initialized from view
	this.scriptType = "general";
	this.scriptTypes = [
		{value:"general",	label:"General Type Script"},
		{value:"spark",		label:"Spark Script"}
    ];
	this.files = [];
	this.treeNodesToLoad  = [];
	this.treeNodesToOpen  = [];
	this.treeNodesToOpen2 = [];
	this.treeNodesToOpen3 = [];
	this.inputSteps = [];
	
	this.inputType = "file";
	this.inputDisplayPath = "";
	this.selectedInputStep = "";
	this.selectedInputFile = {
		id: "",
		name: "",
		path: ""
	};
	
	this.scriptDisplayPath = "";
	this.selectedScript = {
		id: "",
		name: "",
		path: ""
	};
	
	this.outputDisplayPath = "";
	this.outputDir = {
		id: "",
		name: "",
		path: ""
	};
	
	this.updateDataInParentScope = function() {
		var hasInputFile = angular.isString( this.selectedInputFile["id"] ) && this.selectedInputFile["id"].length > 0,
			hasInputStep = angular.isString( this.selectedInputStep )       && this.selectedInputStep.length > 0,
			hasScript    = angular.isString( this.selectedScript["id"] )    && this.selectedScript["id"].length > 0,
			hasOutput    = angular.isString( this.outputDir["id"] )         && this.outputDir["id"].length > 0,
			input, script, output, path;
		if (hasInputFile && this.inputType == "file") {
			input = angular.copy( this.selectedInputFile );
			path = "";
			if (input["id"] == "##") {
				input["id"]   = "";
				input["name"] = "";
			}
			if (input["name"].length > 0)
				path = "/" + input["name"];
			if (input["path"].length > 0)
				path = "/" + input["path"] + path;
			this.inputDisplayPath = "File: Home" + path;
		}
		if (hasInputStep && this.inputType == "step") {
			input = angular.copy( Utils.getElementByGuid(this.selectedInputStep, this.inputSteps) );
			this.inputDisplayPath = "Output of step: " + input["name"];
		}
		if (hasScript) {
			script = angular.copy( this.selectedScript );
			path = "";
			if (script["id"] == "##") {
				script["id"]   = "";
				script["name"] = "";
			}
			if (script["name"].length > 0)
				path = "/" + script["name"];
			if (script["path"].length > 0)
				path = "/" + script["path"] + path;
			this.scriptDisplayPath = "Home" + path;
		}
		if (hasOutput) {
			output = angular.copy( this.outputDir );
			path = "";
			if (output["id"] == "##") {
				output["id"]   = "";
				output["name"] = "";
			}
			if (output["name"].length > 0)
				path = "/" + output["name"];
			if (output["path"].length > 0)
				path = "/" + output["path"] + path;
			this.outputDisplayPath = "Home" + path;
		}
		
		// TODO: uncomment the following line, if input and output locations of the script are defined from the UI
//		if ( (hasInputFile || hasInputStep) && hasScript && hasOutput ) {
		if (hasScript) {
			$scope.$parent.setScriptNode(this.stepGuid, this.scriptType, this.inputType, input, script, output);
		}
	};
	
	this.loadDirItems = function(dirId, successCB, noCache) {
		var dir = TreeUtils.getNodeById(dirId, this.files),
			dirChildren = TreeUtils.getNodesByParentId(dirId, this.files);
		
		if ( angular.isUndefined(noCache) || noCache != true )
			noCache = false;
		
		if ( dirId != "#" && (dir == null || !dir["isDirectory"]) )
			return;
		
		// the following block creates "Home" directory as an only child of root "#" directory
		if (dirId == "#") {
			var newNodes = [{
				id: "##",
				text: "Home",
				parent: "#",
				isDirectory: true,
				children: true
			}];
			this.files = newNodes;
			if ( angular.isFunction( successCB ) ) {
				successCB(newNodes);
			}
			return;
		}
		
		if ( !noCache && dirChildren.length > 0 ) {
			// get data from cache
			if ( angular.isFunction( successCB ) ) {
				successCB(dirChildren);
			}
		}
		else { // get data from server
			// remove any existing data first
			this.files = TreeUtils.deleteNodesByParentId(dirId, this.files);
			
			// construct the full path to be used in DataCatalog.listDirectory
			var path = TreeUtils.getNodePath(dirId, this.files, null, "##"); // the last argument instructs to remove the "##" from the beginning of the path
			
			DataCatalog.listDirectory({
				name: path,
				tenantId: Auth.user["tenantId"]
			})
			.then(angular.bind(this, function(result) {
				var newNodes = [];
				if ( angular.isArray( result.data["folders"] ) ) {
					for (var i=0; i<result.data["folders"].length; i++) {
						newNodes.push({
							id:		result.data["folders"][i],
							text:	result.data["folders"][i],
							parent:	dirId,
							isDirectory: true,
							children:	 true
						});
					}
				}
				if ( angular.isArray( result.data["files"] ) ) {
					for (var i=0; i<result.data["files"].length; i++) {
						newNodes.push({
							id: result.data["files"][i],
							text: result.data["files"][i],
							parent: dirId,
							isDirectory: false
						});
					}
				}
				this.files = this.files.concat( newNodes );
				if ( angular.isFunction( successCB ) ) {
					successCB(newNodes);
				}
			}))
			.catch(angular.bind(this, function(result) {
				console.error("list directory error!");
				console.error(result);
			}));
		}
	};
	
//	this.createDir = function(dirConfig) {
//		var dirPath = TreeUtils.getNodePath(dirConfig["parent"], this.files, null, "##"); // the last argument instructs to remove the "##" from the beginning of the path
//		
//		DataCatalog.createDirectory({
//			name:			dirConfig["name"],
//			parentDirName:	dirPath,
//			tenantId:		Auth.user["tenantId"]
//		})
//		.then(angular.bind(this, (function(dirConfig) {
//			return function(result) { // result = {data:string|Object, headers:function, config:Object, status:number, statusText:string}
////				UiMessage.add("success", "Directory '" + dirConfig["name"] + "' created successfully.");
//				this.treeNodesToLoad = [ dirConfig["parent"] ];
//			};
//		})(dirConfig)))
//		.catch(angular.bind(this, function(result) {
//			var message = "";
//			if ( angular.isObject( result["data"] ) && angular.isString( result["data"]["result"] ) )
//				message = " Message: '" + result["data"]["result"] + "'";
//			UiMessage.add("danger", "Failed to create the directory." + message);
//			console.error("list directory error!");
//			console.error(result);
//		}));
//	};
		
	this.treeRootLoaded = angular.bind(this, function() {
		this.treeNodesToOpen  = ["##"];
		$scope.$apply();
	});
	
	this.treeRootLoaded2 = angular.bind(this, function() {
		this.treeNodesToOpen2 = ["##"];
		$scope.$apply();
	});
	
	this.treeRootLoaded3 = angular.bind(this, function() {
		this.treeNodesToOpen3 = ["##"];
		$scope.$apply();
	});
	
	this.treeSelectNodeCB = angular.bind(this, function(event, data) {
		if (!data.node["original"]["isDirectory"]) {
			this.inputType = "file";
			this.selectedInputFile["id"]   = data.node["id"];
			this.selectedInputFile["name"] = data.selected[0];
			this.selectedInputFile["path"] = TreeUtils.getNodeAncestorsPath(data.node["id"], this["files"]).replace(/##\//g, "").replace(/##/g, ""); // .replace(/##/g, Auth.user["tenantId"]);
			$scope.$apply();
		}
	});
	
	this.treeSelectNodeCB2 = angular.bind(this, function(event, data) {
		if (!data.node["original"]["isDirectory"]) {
			this.selectedScript["id"]   = data.node["id"];
			this.selectedScript["name"] = data.selected[0];
			this.selectedScript["path"] = TreeUtils.getNodeAncestorsPath(data.node["id"], this["files"]).replace(/##\//g, "").replace(/##/g, ""); // .replace(/##/g, Auth.user["tenantId"]);
			$scope.$apply();
		}
	});
	
	this.treeSelectNodeCB3 = angular.bind(this, function(event, data) {
		if (data.node["original"]["isDirectory"]) {
			this.outputDir["id"]   = data.node["id"];
			this.outputDir["name"] = data.selected[0];
			this.outputDir["path"] = TreeUtils.getNodeAncestorsPath(data.node["id"], this["files"]).replace(/##\//g, "").replace(/##/g, ""); // .replace(/##/g, Auth.user["tenantId"]);
			$scope.$apply();
		}
	});
	
//	this.treeCreateFolder = angular.bind(this, function(node) {
//		var modalInstance = $modal.open({
//			templateUrl: "partials/workbench/createDirModal.html",
//			controller: "CreateDirModalCtrl as modal",
//			scope: $scope,
//			resolve: {
//				modalData: function() {
//					return {
//						parentDirId: node["id"]
//					};
//				}
//			}
//		});
//
//		modalInstance.result.then( angular.bind(this, this.createDir) );
//		return false;
//	});
//	
//	this.treeContextMenu = {
//		items: {
//			createFolder:	{label:"Create Folder",	action:this.treeCreateFolder}
//		}
//	};
	
	this.treeGetNodeChildren = angular.bind(this, function(nodeToLoad, callback) {
		this.loadDirItems(nodeToLoad["id"], angular.bind(this, function(nodeChildrenData) {
			var newNodes = angular.copy( nodeChildrenData );
			for (var i=0; i<newNodes.length; i++) {
				if ( !newNodes[i]["isDirectory"] ) {
					newNodes[i]["icon"] = "jstree-file";
				}
			}
			callback(newNodes);
		}), true); // the last argument means that potentially cached results should not be used (always reload)
	});
	
	this.filterInputSteps = angular.bind(this, function(eventOrData, data) {
		var inSteps = angular.isObject(data)? data["inputSteps"] : eventOrData,
			stepIdx = Utils.getIndexByGuid(this.stepGuid, inSteps);
		inSteps.splice(stepIdx, 1);
		this.inputSteps = angular.copy( inSteps );
	});
	
	$scope.$on("workflowCreate.stepsChanged", this.filterInputSteps);
	
	$scope.$watch(
		angular.bind(this, function() {
			return this.selectedInputFile["id"] + this.selectedScript["id"] + this.outputDir["id"];
		}),
		angular.bind(this, this.updateDataInParentScope)
	);
	
	$scope.$watch(
		angular.bind(this, function() {
			return this.selectedInputStep;
		}),
		angular.bind(this, function() {
			this.inputType = "step";
			this.updateDataInParentScope();
		})
	);
	
	// init actions
//	this.filterInputSteps( $scope.$parent.getInputSteps() );

}]);

angular.module("insightal.workbench")
	.controller("WorkflowStepTypeTransformCtrl", [
		"$scope", "$timeout", "$modal", "Auth", "DataCatalog", "TreeUtils", "Utils", function(
		 $scope,   $timeout,   $modal,   Auth,   DataCatalog,   TreeUtils,   Utils) {
			
	this.stepGuid		= ""; // initialized from view
	this.datasets		= {}; // initialized from view
	this.inputs 		= [];
//	this.inputCounter	= 1;
	this.sql			= "";
	this.sqlUpdateTimeout = null;
	
	this.files = [];
	this.treeNodesToLoad  = [];
	this.treeNodesToOpen  = [];
	
	this.isSavingOutput = false;
	this.outputDir = {
		id: "",
		name: "",
		path: ""
	};
	this.outputDisplayPath	= "";
	this.outputFolderName	= "";
	this.outputTableName	= "";
	
	this.toggleInput = function(inputGuid) {
		var idx = this.inputs.indexOf(inputGuid); 
		if (idx >= 0)
			this.inputs.splice(idx, 1);
		else
			this.inputs.push(inputGuid);
	};
	
	this.updateDataInParentScope = function() {
		var output, path;
		if (this.isSavingOutput) {
			output = angular.copy( this.outputDir );
			path = "";
			if (output["id"] == "##") {
				output["id"]   = "";
				output["name"] = "";
			}
			if (output["name"].length > 0)
				path = "/" + output["name"];
			if (output["path"].length > 0)
				path = "/" + output["path"] + path;
			this.outputDisplayPath = "Home" + path;
			output["folderName"] = this.outputFolderName;
			output["tableName"]  = this.outputTableName;
		}

		$scope.$parent.setTransformNode(this.stepGuid, this.inputs, this.sql, output);
	};
	
	this.loadDirItems = function(dirId, successCB, noCache) {
		var dir = TreeUtils.getNodeById(dirId, this.files),
			dirChildren = TreeUtils.getNodesByParentId(dirId, this.files);
		
		if ( angular.isUndefined(noCache) || noCache != true )
			noCache = false;
		
		if ( dirId != "#" && (dir == null || !dir["isDirectory"]) )
			return;
		
		// the following block creates "Home" directory as an only child of root "#" directory
		if (dirId == "#") {
			var newNodes = [{
				id: "##",
				text: "Home",
				parent: "#",
				isDirectory: true,
				children: true
			}];
			this.files = newNodes;
			if ( angular.isFunction( successCB ) ) {
				successCB(newNodes);
			}
			return;
		}
		
		if ( !noCache && dirChildren.length > 0 ) {
			// get data from cache
			if ( angular.isFunction( successCB ) ) {
				successCB(dirChildren);
			}
		}
		else { // get data from server
			// remove any existing data first
			this.files = TreeUtils.deleteNodesByParentId(dirId, this.files);
			
			// construct the full path to be used in DataCatalog.listDirectory
			var path = TreeUtils.getNodePath(dirId, this.files, null, "##"); // the last argument instructs to remove the "##" from the beginning of the path
			
			DataCatalog.listDirectory({
				name: path,
				tenantId: Auth.user["tenantId"]
			})
			.then(angular.bind(this, function(result) {
				var newNodes = [];
				if ( angular.isArray( result.data["folders"] ) ) {
					for (var i=0; i<result.data["folders"].length; i++) {
						newNodes.push({
							id:		result.data["folders"][i],
							text:	result.data["folders"][i],
							parent:	dirId,
							isDirectory: true,
							children:	 true
						});
					}
				}
				if ( angular.isArray( result.data["files"] ) ) {
					for (var i=0; i<result.data["files"].length; i++) {
						newNodes.push({
							id: result.data["files"][i],
							text: result.data["files"][i],
							parent: dirId,
							isDirectory: false
						});
					}
				}
				this.files = this.files.concat( newNodes );
				if ( angular.isFunction( successCB ) ) {
					successCB(newNodes);
				}
			}))
			.catch(angular.bind(this, function(result) {
				console.error("list directory error!");
				console.error(result);
			}));
		}
	};
	
	this.createDir = function(dirConfig) {
		var dirPath = TreeUtils.getNodePath(dirConfig["parent"], this.files, null, "##"); // the last argument instructs to remove the "##" from the beginning of the path
		
		DataCatalog.createDirectory({
			name:			dirConfig["name"],
			parentDirName:	dirPath,
			tenantId:		Auth.user["tenantId"]
		})
		.then(angular.bind(this, (function(dirConfig) {
			return function(result) {
				this.treeNodesToLoad = [ dirConfig["parent"] ];
			};
		})(dirConfig)))
		.catch(angular.bind(this, function(result) {
			var message = "";
			if ( angular.isObject( result["data"] ) && angular.isString( result["data"]["result"] ) )
				message = " Message: '" + result["data"]["result"] + "'";
			UiMessage.add("danger", "Failed to create the directory." + message);
			console.error("list directory error!");
			console.error(result);
		}));
	};
		
	this.treeRootLoaded = angular.bind(this, function() {
		this.treeNodesToOpen  = ["##"];
		$scope.$apply();
	});
	
	this.treeSelectNodeCB = angular.bind(this, function(event, data) {
		if (data.node["original"]["isDirectory"]) {
			this.outputDir["id"]   = data.node["id"];
			this.outputDir["name"] = data.selected[0];
			this.outputDir["path"] = TreeUtils.getNodeAncestorsPath(data.node["id"], this["files"]).replace(/##\//g, "").replace(/##/g, ""); // .replace(/##/g, Auth.user["tenantId"]);
			$scope.$apply();
		}
	});
	
	this.treeCreateFolder = angular.bind(this, function(node) {
		if (!node["original"]["isDirectory"]) {
			UiMessage.add("danger", "Cannot create directory, the parent folder is not selected.");
			return false;
		}
		
		var modalInstance;
		DataCatalog.listDirectory({
			tenantId: Auth.user["tenantId"],
			name: TreeUtils.getNodePath(node["id"], this.files, null, "##")
		})
		.then(angular.bind(this, function(result) {
			var modalInstance = $modal.open({
				templateUrl: "partials/workbench/createDirModal.html",
				controller: "CreateDirModalCtrl as modal",
				scope: $scope,
				resolve: {
					modalData: function() {
						return {
							parentDir: node,
							parentDirContents: result.data
						};
					}
				}
			});
			
			modalInstance.result.then( angular.bind(this, this.createDir) );
		}))
		.catch(angular.bind(this, function(result) {
			UiMessage.add("danger", "Cannot create folder, because listing the parent folder contents failed.");
			console.error("Cannot create folder, because listing the parent folder contents failed.");
			console.debug(result);
		}));
		return false;
	});
	
	this.treeContextMenu = {
		items: {
			createFolder:	{label:"Create Folder",	action:this.treeCreateFolder}
		}
	};
	
	this.treeGetNodeChildren = angular.bind(this, function(nodeToLoad, callback) {
		this.loadDirItems(nodeToLoad["id"], angular.bind(this, function(nodeChildrenData) {
			var newNodes = angular.copy( nodeChildrenData );
			for (var i=0; i<newNodes.length; i++) {
				if ( !newNodes[i]["isDirectory"] ) {
					newNodes[i]["icon"] = "jstree-file";
				}
			}
			callback(newNodes);
		}), true); // the last argument means that potentially cached results should not be used (always reload)
	});
	
	$scope.$watch(
		angular.bind(this, function(scope) {
			return this.sql;
		}),
		angular.bind(this, function(newVal, oldVal) {
			if (this.sqlUpdateTimeout != null)
				$timeout.cancel( this.sqlUpdateTimeout );
			this.sqlUpdateTimeout = $timeout(angular.bind(this, function() {
				this.updateDataInParentScope();
				this.sqlUpdateTimeout = null;
			}), 1500);
		})
	);
	
	$scope.$watch(
		angular.bind(this, function() {
			return this.isSavingOutput;
		}),
		angular.bind(this, this.updateDataInParentScope)
	);
	
	$scope.$watch(
		angular.bind(this, function() {
			return this.outputDir["id"];
		}),
		angular.bind(this, this.updateDataInParentScope)
	);
	
	$scope.$watch(
		angular.bind(this, function() {
			return this.outputFolderName;
		}),
		angular.bind(this, this.updateDataInParentScope)
	);
	
	$scope.$watch(
		angular.bind(this, function() {
			return this.outputTableName;
		}),
		angular.bind(this, this.updateDataInParentScope)
	);
	
}]);

angular.module("insightal.workbench")
	.controller("FileViewModalCtrl", [
		"$scope", "$modalInstance", "modalData", "DataCatalog", "Auth", "UiMessage", "TreeUtils", "Utils", function(
		 $scope,   $modalInstance,   modalData,   DataCatalog,   Auth,   UiMessage,   TreeUtils,   Utils) {
	
	this.fileData = modalData["fileData"];
	
	this.selectedFileColumns	= [];
	this.selectedFileContents	= [];
	this.selectedFileOrderKey	= null;
	this.selectedFileOrderReverse = false;
	this.fileContForCurrentPage	= [];
	this.fileContPage			= 1;
	this.fileContPageCount		= 0;
	this.fileContRowCount		= 0;
	this.fileContRowsPerPage	= 10;
	
	this.viewFileContents = function() {
		var fileColumns = [],
			rowCount = this.fileData.length;
		if (rowCount > 0) {
			for (var column in this.fileData[0]) {
				fileColumns.push( column );
			}
		}
		this.fileContPage			= 1;
		this.fileContPageCount		= Math.ceil( rowCount / this.fileContRowsPerPage );
		this.fileContRowCount		= rowCount;
		this.selectedFileColumns	= fileColumns;
		this.selectedFileOrderKey	= fileColumns[0];
		this.selectedFileOrderReverse = false;
		this.selectedFileContents	= this.getDataReordered(this.fileData, fileColumns[0]);
	};
	
	this.showFileContentsPage = function() {
		var pageContents = [],
			iMin = Math.max(0, (this.fileContPage - 1) * this.fileContRowsPerPage),
			iMax = Math.min(iMin + this.fileContRowsPerPage, this.fileContRowCount);
		for (var i=iMin; i<iMax; i++) {
			pageContents.push( this.selectedFileContents[i] );
		}
		this.fileContForCurrentPage = pageContents;
	};
	
	this.getDataReordered = function(data, column, reverse) {
		if ( angular.isUndefined( reverse ) )
			reverse = false;
		return Utils.sortArrayOfObj(data, column, reverse);
	};
	
	this.selectedFileChangeOrder = function(columnName) {
		if (this.selectedFileOrderKey === columnName) {
			this.selectedFileOrderReverse = !this.selectedFileOrderReverse;
		}
		else {
			this.selectedFileOrderKey = columnName;
			this.selectedFileOrderReverse = false;
		}
		this.selectedFileContents = this.getDataReordered(this.selectedFileContents, this.selectedFileOrderKey, this.selectedFileOrderReverse);
	};
	
	this.cancel = function() {
		$modalInstance.dismiss();
	};
	
	$scope.$watch(
		angular.bind(this, function(scope) {
			return this.fileContPage;
		}),
		angular.bind(this, this.showFileContentsPage)
	);
	
	$scope.$watch(
		angular.bind(this, function(scope) {
			return this.selectedFileContents;
		}),
		angular.bind(this, function(newVal, oldVal) {
			this.fileContPage = 1;
			this.showFileContentsPage();
		})
	);
	
	// init actions
	this.viewFileContents();
	
}]);

angular.module("insightal.workbench")
	.controller("WbVisualsCtrl", [
		"$scope", "$q", "$modal", "$timeout", "Group", "Application", "Collection", "Auth", "DataService", "UiMessage", "Utils", function(
		 $scope,   $q,   $modal,   $timeout,   Group,   Application,   Collection,   Auth,   DataService,   UiMessage,   Utils) {
	
	this.interval = { // initialized in init block
		start:	new Date( Date.now() - 86400000 ), // 1 day ago
		end:	new Date() // now
	};
	
	this.x = {
		sourceType:		"document",
		series:			[],
		seriesSelected:	[]
	};
	
	this.y = {
		sourceType:		"document",
		series:			[],
		seriesSelected:	[]
	};
	
	this.sourceTypes = {
		x: [
			{value:"time",		label:"Time Based Plot"},
			{value:"document",	label:"Document"},
//			{value:"file",		label:"File"}
		],
		y: [
			{value:"document",	label:"Document"}//,
//			{value:"file",		label:"File"}
		]
	};
	
	this.chartRedrawDisabled = false;
	this.chart = {};
	this.chartPrototype = {
		title: null,
		subtitle: null,
		type: "scatter",
		guid: "workbenchVisualsChart",
		series: [],
		active: 1,
		xAxisType: "linear",
		xAxisAllowDecimals: true,
		xAxisCategories: null,
//			xAxisDataFormat: "%H:%M:%S",
		xAxisMax: null,
		xAxisMin: null,
		xAxisOffset: 0,
		xAxisOpposite: false,
		xAxisReversed: false,
		xAxisTitle: "X",
		xTickInterval: null,
		xTickLength: 10,
		xTickPositions: null,
		yAxisType: "linear",
		yAxisAllowDecimals: true,
		yAxisCategories: null,
//			yAxisDataFormat: "",
		yAxisMax: null,
		yAxisMin: null,
		yAxisOffset: 0,
		yAxisOpposite: false,
		yAxisReversed: false,
		yAxisTitle: "Y",
		yTickInterval: null,
		yTickLength: 10,
		yTickPositions: null,
		showLegend: true,
		showCredits: false,
		ttHeaderFormat: "", // "{point.key}<br/>",
		ttBodyFormat: "<b>{point.y}</b> results",
		ttFooterFormat: "",
		cssHeight: "400px",
		version: 0,
		apiStack: []
	};
	
	this.groups	= [];
	this.apps	= {}; // apps by group ID
	this.cols	= {}; // collections by app ID
	this.docs	= {}; // docs by collection ID
	
	this.getDataTree = function() {
		Group.getAll({ tenantId:Auth.user["tenantId"] })
		.then(angular.bind(this, function(result) {
			var groups = result.data["groups"],
				groupsFormatted = [],
				appPromises = [];
			for (var i=0; i<groups.length; i++) {
				groupsFormatted.push({
					id:		groups[i][0],
					name:	groups[i][1]
				});
				appPromises.push(
					Application.getAppsByGroup({ groupId:groups[i][0] })
				);
			}
			this.groups = groupsFormatted;
			return $q.all(appPromises);
		}))
		.then(angular.bind(this, function(resultList) {
			var apps, appsFormatted,
				colPromises = [];
			for (var i=0; i<resultList.length; i++) {
				apps = resultList[i].data["applications"];
				appsFormatted = [];
				for (var j=0; j<apps.length; j++) {
					appsFormatted.push({
						id:		apps[j][0],
						name:	apps[j][1]
					});
					colPromises.push(
						Collection.getCollectionsByApp({ applicationId:apps[j][0] })
					);
				}
				this.apps[ resultList[i].config["data"]["groupId"] ] = angular.copy( appsFormatted );
			}
			return $q.all(colPromises);
		}))
		.then(angular.bind(this, function(resultList) {
			var cols, colsFormatted,
				fieldPromises = [];
			for (var i=0; i<resultList.length; i++) {
				cols = resultList[i].data["collections"];
				colsFormatted = [];
				for (var j=0; j<cols.length; j++) {
					colsFormatted.push({
						id:		cols[j][0],
						name:	cols[j][1]
					});
				}
				this.cols[ resultList[i].config["data"]["applicationId"] ] = angular.copy( colsFormatted );
			}
			// get docs / fields
			for (var appId in this.cols) {
				fieldPromises.push(
					Application.getApplicationFields({ applicationId:appId })
				);
			}
			return $q.all(fieldPromises);
		}))
		.then(angular.bind(this, function(resultList) {
			var docs, docsFormatted = {},
				fields;
			for (var i=0; i<resultList.length; i++) {
				for (var colId in resultList[i].data) {
					docs = resultList[i].data[ colId ]["documents"];
					docsFormatted = {};
					for (var docName in docs) {
						fields = docs[ docName ]["fields"];
						docsFormatted[ docName ] = {};
						for (var fieldName in fields) {
							docsFormatted[ docName ][ fieldName ] = angular.copy( fields[ fieldName ]["attributes"] );
						}
					}
					this.docs[ colId ] = angular.copy( docsFormatted );
				}
			}
			
			this.x.group	= "b2653a86-b04d-421b-bd54-ed2b67bf7a2f";
			this.x.app		= "27b2afe3-462d-4939-986b-6cc9e86d32f8";
			this.x.col		= "bf785777-27a9-4c19-b653-d52453d8c0f0";
			this.x.doc		= "apacheAccess";
			this.x.field	= "http_status";
			this.x.attr		= "count";
			
			this.y.group	= "b2653a86-b04d-421b-bd54-ed2b67bf7a2f";
			this.y.app		= "27b2afe3-462d-4939-986b-6cc9e86d32f8";
			this.y.col		= "bf785777-27a9-4c19-b653-d52453d8c0f0";
			this.y.doc		= "apacheAccess";
			this.y.field	= "bytes";
			this.y.attr		= "average";
		}))
		.catch(angular.bind(this, function(result) {
			var msg = (angular.isString( result.data["message"] ))? " Message: \"" + result.data["message"] + "\"" : ""; 
			UiMessage.add("danger", "An error occurred when listing groups, applications, collections or documents." + msg);
			console.error(result);
		}));
	};
	
	this.openDatepicker = angular.bind(this, function(type) {
		if ( !angular.isString( type ) || type.length == 0 )
			type = "start";
		var dateOriginal = this.interval[type];
		$modal.open({
			templateUrl: "partials/workbench/chartDatePickerModal.html",
			controller: "DatePickerModalCtrl as modal",
			scope: $scope,
			resolve: {
				modalData: function() {
					return {
						type: type,
						date: angular.copy( dateOriginal )
					};
				}
			}
		})
		.result.then(angular.bind(this, function(date) {
			this.interval[type] = date;
		}));
		return false;
	});
	
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
		
		this.interval["start"]	= start;
		this.interval["end"]	= end;
	};
	
	this.toggleSeries = function(axis, series) {
		if (axis == "x" || axis == "y")
			this[axis]["seriesSelected"] = Utils.toggleSelection(this[axis]["seriesSelected"], series);
	};
	
	this.getChartData = function() {
		var xDfd = $q.defer(),
			yDfd = $q.defer();
		
		var xSuccessHandler = angular.bind(this, function(data, status, headers, config) {
			xDfd.resolve(data);
		});
		
		var ySuccessHandler = angular.bind(this, function(data, status, headers, config) {
			yDfd.resolve(data);
		});
		
		var errorHandler = angular.bind(this, function(data, status, headers, config) {
			UiMessage.add("danger", "An error occurred while retrieving the chart data.");
			console.error(data);
		});
		
		this.chartRedrawDisabled = true;
		
		if (this.x["sourceType"] === "time") {
			this.x["field"] = "time";
			xDfd.resolve(); // all data comes from yDfd
		}
		else if (this.x["sourceType"] === "document") {
			DataService.getDataAggregate({
				collection:	this.x["col"],
				field:		this.x["field"],
				attribute:	this.x["attr"],
				timestampField: "@timestamp",
//			startTime:	this.interval["start"].getTime(),
//			endTime:	this.interval["end"].getTime(),
				success:	xSuccessHandler,
				error:		errorHandler
			});
		}
		
		DataService.getDataAggregate({
			collection:	this.y["col"],
			field:		this.y["field"],
			attribute:	this.y["attr"],
			timestampField: "@timestamp",
//			startTime:	this.interval["start"].getTime(),
//			endTime:	this.interval["end"].getTime(),
			success:	ySuccessHandler,
			error:		errorHandler
		});
		
		$q.all({x:xDfd.promise, y:yDfd.promise})
		.then( angular.bind(this, function(result) {
//			console.debug("data both:");
//			console.debug(result);
			var xData = result.x,
				yData = result.y;
			this.x.series = [];
			this.y.series = [];
			
			if (this.x["sourceType"] === "time") {
				this.y["seriesSelected"] = [];
				for (var i=0; i<yData.length; i++) {
					this.y.series.push({
						id:		yData[i]["name"],
						name:	yData[i]["name"],
						data:	yData[i]
					});
					this.y["seriesSelected"].push( yData[i]["name"] );
				}
			}
			else if (this.x["sourceType"] === "document") {
				for (var i=0; i<xData.length; i++) {
					this.x["series"].push({
						id:		xData[i]["name"],
						name:	xData[i]["name"],
						data:	xData[i]
					});
				}
				if (xData.length > 0)
					this.x["seriesSelected"] = [ xData[0]["name"] ];
				
				for (var i=0; i<yData.length; i++) {
					this.y.series.push({
						id:		yData[i]["name"],
						name:	yData[i]["name"],
						data:	yData[i]
					});
				}
				if (yData.length > 0)
					this.y["seriesSelected"] = [ yData[0]["name"] ];
			}
			
			this.drawChart();
			$timeout(angular.bind(this, function() {
				this.chartRedrawDisabled = false;
			}), 1000);
		}));
	};
	
	this.drawChart = function() {
		var xSeries, xData, xName,
			ySeries, yData, yName,
			corrData, result, resultList = [],
			chart;
		
		if (this.x["sourceType"] === "time") {
			for (var i=0; i<this.y["seriesSelected"].length; i++) {
				yName = this.y["field"] + " " + ( (this.y["attr"] == "count")? ySeries["name"] : this.y["attr"] );
				ySeries = Utils.getElementByGuid(this.y["seriesSelected"][i], this.y["series"], "id");
				yData = ySeries["data"]["values"];
				resultList.push({
					name:	yName,
					values:	yData
				});
			}
		}
		else if (this.x["sourceType"] === "document") {
			for (var i=0; i<this.x["seriesSelected"].length; i++) {
				xSeries = Utils.getElementByGuid(this.x["seriesSelected"][i], this.x["series"], "id");
				if (xSeries == null)
					continue;
				xData = xSeries["data"]["values"];
				for (var j=0; j<this.y["seriesSelected"].length; j++) {
					ySeries = Utils.getElementByGuid(this.y["seriesSelected"][j], this.y["series"], "id");
					if (ySeries == null)
						continue;
					yData = ySeries["data"]["values"];
					
					corrData = {};
					result = [];
					for (var k=0; k<xData.length; k++) {
						var key = "T" + xData[k][0];
						corrData[key] = [ xData[k][1] ];
					}
					for (var k=0; k<yData.length; k++) {
						var key = "T" + yData[k][0];
						if ( !angular.isArray( corrData[key] ) )
							corrData[key] = [];
						corrData[key].push( yData[k][1] );
					}
					for (var key in corrData) {
						if (corrData[key].length == 2)
							result.push( corrData[key] )
					}
					xName = this.x["field"] + " " + ( (this.x["attr"] == "count")? xSeries["name"] : this.x["attr"] ); 
					yName = this.y["field"] + " " + ( (this.y["attr"] == "count")? ySeries["name"] : this.y["attr"] );
					resultList.push({
						name: xName + " -|- " + yName,
						values: result
					});
				}
			}
		}
//		console.debug("CHART DRAW:");
//		console.debug(resultList);
		
//		this.removeAllSeriesData();
//		this.addChartSeries(resultList);
		
		chart = angular.copy( this.chartPrototype );
		chart["xAxisTitle"] = this.x["field"];
		chart["yAxisTitle"] = this.y["field"];
		chart["series"] = [];
		chart["apiStack"] = [];
		if (this.x["sourceType"] === "time") {
			chart["xAxisType"] = "datetime";
		}
		for (var i=0; i<resultList.length; i++) {
			var seriesId     = "visualisationSeries_" + i,
				seriesDataId = "visualisationData_"   + i; 
			// this adds the series to the options - interface to inCharts, but it does not render the series
			chart["series"].push({
				name: resultList[i]["name"],
				id: "",
				guid: seriesId,
				type: "inherit",
				data: [],//resultList[i],
//				color: "#99cc33",
				markerEnabled: true,
				markerSize: 4,
				markerSymbol: null,
				zIndex: 1
			});
			// this will call "addSeries" (which renders the series), just after the chart is created
			chart["apiStack"].push({
				fn: "addSeries",
				args: [seriesId, seriesDataId, angular.copy(resultList[i])]
			});
		}
		
//		for (var i=0; i<resultList.length; i++) {
////			this.chart.api["addSeries"]( this.chart["series"][i]["guid"], "visualisationData_" + i, resultList[i] );
//		}
		
		if ( isFinite( this.chart["version"] ) ) // this will provoke chart redraw
			chart["version"] = this.chart["version"] + 1;
		this.chart = chart;
	};
	
//	this.addChartSeries = function(seriesList) {
//		for (var i=0; i<seriesList.length; i++) {
//			this.chart["series"].push({
//				name: seriesList[i]["name"],
//				id: "",
//				guid: "visualisationSeries_" + i,
//				type: "inherit",
//				data: [],
////				color: "#99cc33",
//				markerEnabled: true,
//				markerSize: 4,
//				markerSymbol: null,
//				zIndex: 1
//			});
//			this.chart.api["addSeries"]( "visualisationSeries_" + i, "visualisationData_" + i, seriesList[i] );
//		}
//	};
//	
//	this.removeAllSeriesData = function() {
//		this.chart["series"] = [];
//	};
	
	$scope.$watch(
		angular.bind(this, function() {
			return this.x["seriesSelected"].length; 
		}),
		angular.bind(this, function(newVal, oldVal) {
//			console.debug("redraw X, oldVal = '" + oldVal + "', newVal = '" + newVal + "', disabled = " + this.chartRedrawDisabled);
			if ( !this.chartRedrawDisabled && newVal != oldVal )
				this.drawChart();
		})
	);
	
	$scope.$watch(
		angular.bind(this, function() {
			return this.y["seriesSelected"].length; 
		}),
		angular.bind(this, function(newVal, oldVal) {
//			console.debug("redraw Y, oldVal = '" + oldVal + "', newVal = '" + newVal + "', disabled = " + this.chartRedrawDisabled);
			if ( !this.chartRedrawDisabled && newVal != oldVal )
				this.drawChart();
		})
	);
	
	// init actions
	this.interval["start"].setSeconds(0);
	this.interval["start"].setMilliseconds(0);
	this.interval["end"].setSeconds(0);
	this.interval["end"].setMilliseconds(0);
	
	this.getDataTree();
	
}]);

angular.module("insightal.workbench")
	.controller("DatePickerModalCtrl", [
		"$scope", "$modalInstance", "modalData", function(
		 $scope,   $modalInstance,   modalData) {
	
	this.type = modalData["type"];
	this.date = modalData["date"];
	this.validationErrors = [];
	
	this.save = function(formData) {
		this.validationErrors = [];
//		if ( ... ) {
//			this.validationErrors.push({ message:"The name field is empty.", field:"name" });
//		}
	
		if (this.validationErrors.length == 0) {
			$modalInstance.close(this.date);
		}
	};
	
	this.cancel = function() {
		$modalInstance.dismiss();
	};
	
	// init actions
	this.date.setSeconds(0);
	this.date.setMilliseconds(0);
	
}]);



/***********************************************************************************************/


angular.module("insightal.workbench")
	.controller("WorkbenchCtrl", [
		"$scope", "$modal", "$window", "DataService", "Auth", "UiMessage", "Utils", function(
		 $scope,   $modal,   $window,   DataService,   Auth,   UiMessage,   Utils) {
//	this.metricList = [];
//	this.metricData = [];
	this.applicationList = [];
	this.applicationFields = {};
	this.chartList = [];
	this.isLeftPanelCollapsed = false;
	this.hasUnsavedChanges = false;
	
	this.config = {
		name: "Offline Workbench 1",
		description: "Some decription...",
		guid: "9a0bd9e1-46ae-4007-aece-7c4fb41658e9",
		user: null,
		active: 1,
		creationDate: "2014-12-21 12:00:00",
		modificationDate: "2014-12-21 12:00:00",
		charts: {},
		transientCfg: {}
	};
	
	this.addChartConfig = {
		metric: { 
			guid: "" //other metric properties are defined from the view (UI)
		},
		timeframe: {
			start: new Date(),
			end: new Date()
		},
		chartType: "line"
	};
	
	// event handlers BEGIN
	
	$scope.$on("$destroy", function() {
	    $window.onbeforeunload = null;
	});
	
	this.unsavedChangesHandler = function(event, next, current) {
		if (!this.hasUnsavedChanges)
			return undefined;
		
		if (typeof next == "undefined") {
			return "There are unsaved changes in the workbench which will be lost if you leave this page.\nAre you sure you want to navigate away?";
		}
		else {
			var answer = confirm("There are unsaved changes in the workbench which will be lost if you leave this page.\nAre you sure you want to navigate away?")
			if (!answer) {
				event.preventDefault();
			}
		}
	};
	
	$window.onbeforeunload = this.unsavedChangesHandler;
	$scope.$on("$stateChangeStart", this.unsavedChangesHandler);
	
	// event handlers END
	
	this.addChart = function() {
		var config = this.prepareWgConfigCommon();
		config["name"] = this.addChartConfig.metric.name;
		config["description"] = "";
		config["type"] = this.addChartConfig.chartType;
		config["guid"] = Utils.generateUUID();
		config["position"] = this.chartList.length;
		config["metric"][0] = this.addChartConfig.metric;
		config["metric"][0]["guid"] = Utils.generateUUID(); 
		config["startDate"] = Utils.dateToStr(this.addChartConfig.timeframe.start),
		config["endDate"]   = Utils.dateToStr(this.addChartConfig.timeframe.end),
		config = this.prepareWgConfigSpecific(config);
		this.chartList.push(config);
		this.addChartConfig["metric"] = {guid:""};
	};
	
	this.chartConfigCommon = [
   		{name:"name",			type:"string",	defaultVal:null,	title:"Name",			userConfigurable:true,	configType:"text"},
   		{name:"description",	type:"string",	defaultVal:null,	title:"Description",	userConfigurable:true,	configType:"textArea"},
   		{name:"type",			type:"string",	defaultVal:null,	title:"Chart Type",		userConfigurable:false,	configType:null},
   		{name:"typeName",		type:"string",	defaultVal:null,	title:"",				userConfigurable:false,	configType:null},
   		{name:"guid",			type:"string",	defaultVal:null,	title:"",				userConfigurable:false,	configType:null},
   		{name:"active",			type:"string",	defaultVal:1,		title:"",				userConfigurable:false,	configType:null},
   		{name:"position",		type:"integer",	defaultVal:null,	title:"",				userConfigurable:false,	configType:null},
   		{name:"data",			type:"array",	defaultVal:[],		title:"",				userConfigurable:false,	configType:null},
   		{name:"metric",			type:"array",	defaultVal:[],		title:"",				userConfigurable:false,	configType:null},
   		{name:"panelStyle",		type:"object",	defaultVal:{"width":"50%", "height":"400px"},	title:"",	userConfigurable:false,	configType:null},
   		{name:"startDate",		type:"string",	defaultVal:null,	title:"",				userConfigurable:false,	configType:null},
   		{name:"endDate",		type:"string",	defaultVal:null,	title:"",				userConfigurable:false,	configType:null},
   		{name:"specific",		type:"object",	defaultVal:{},		title:"",				userConfigurable:false,	configType:null},
   		{name:"transientCfg",	type:"object",	defaultVal:{},		title:"",				userConfigurable:false,	configType:null}
   	];
	
	this.chartTypes =  [
   	    {
   	    	type: "line",
   	    	typeName: "Line Chart",
   	    	config: [
   	            {name:"id",							type:"string",		defaultVal:null,			title:"",				userConfigurable:false,	configType:null},
   	            {name:"x",							type:"function",	defaultVal:null,			title:"",				userConfigurable:false,	configType:null},
   	            {name:"xAxisLabel",					type:"string",		defaultVal:"",				title:"X Axis Label",	userConfigurable:true,	configType:"text"},
  				{name:"xAxisTickFormat",			type:"function",	defaultVal:null,			title:"",				userConfigurable:false,	configType:null},
  				{name:"xAxisTickFormatType",		type:"string",		defaultVal:"time",			title:"X Axis Data Type",		userConfigurable:true,	configType:"select", values:[{value:"",label:"unspecified"},{value:"g",label:"general (number)"},{value:"d",label:"integer"},{value:"f",label:"float"},{value:"e",label:"exponential"},{value:"r",label:"rounded"},{value:"%",label:"percentage"},{value:"p",label:"percentage rounded"},{value:"s",label:"SI prefixed (e.g. 1k for 1000)"},{value:"time",label:"time"}]},
  				{name:"xAxisTickFormatPrecision",	type:"integer",		defaultVal:-1,				title:"X Axis Data Precision",	userConfigurable:true,	configType:"text", displayCondition: "config.specific['xAxisTickFormatType'] != 'time'"},
  				{name:"xAxisTickFormatCommaDivide",	type:"boolean",		defaultVal:true,			title:"X Axis Use Comma to Divide Thousands",	userConfigurable:true, configType:"checkbox", values:[{value:true,label:""}], displayCondition: "config.specific['xAxisTickFormatType'] != 'time'"},
  				{name:"xAxisTickFormatTime",		type:"string",		defaultVal:"%m/%d %H:%M",		title:"X Axis Time Format",		userConfigurable:true,	configType:"select", displayCondition: "config.specific['xAxisTickFormatType'] == 'time'", values:[{value:"%M:%S",label:"minutes:seconds"},{value:"%H:%M:%S",label:"hours:minutes:seconds"},{value:"%H:%M",label:"hours:minutes"},{value:"%m/%d %H:%M:%S",label:"month/day hours:minutes:seconds"},{value:"%m/%d %H:%M",label:"month/day hours:minutes"},{value:"%m/%d",label:"month/day"},{value:"%m/%d/%y",label:"month/day/year"},{value:"%m/%d/%Y",label:"month/day/full year"}]},
  				{name:"showXAxis",					type:"boolean",		defaultVal:true,			title:"Show X Axis",	userConfigurable:false,	configType:"checkboxSingle"},
  				{name:"y",							type:"function",	defaultVal:null,			title:"",				userConfigurable:false,	configType:null},
  				{name:"yAxisLabel",					type:"string",		defaultVal:"",				title:"Y Axis Label",	userConfigurable:true,	configType:"text"},
   	            {name:"yAxisTickFormat",			type:"function",	defaultVal:null,			title:"",				userConfigurable:false,	configType:null},
   	            {name:"yAxisTickFormatType",		type:"string",		defaultVal:"g",				title:"Y Axis Data Type",		userConfigurable:true,	configType:"select", values:[{value:"",label:"unspecified"},{value:"g",label:"general (number)"},{value:"d",label:"integer"},{value:"f",label:"float"},{value:"e",label:"exponential"},{value:"r",label:"rounded"},{value:"%",label:"percentage"},{value:"p",label:"percentage rounded"},{value:"s",label:"SI prefixed (e.g. 1k for 1000)"},{value:"time",label:"time"}]},
   	            {name:"yAxisTickFormatPrecision",	type:"integer",		defaultVal:-1,				title:"Y Axis Data Precision",	userConfigurable:true,	configType:"text", displayCondition: "config.specific['yAxisTickFormatType'] != 'time'"},
              	{name:"yAxisTickFormatCommaDivide",	type:"boolean",		defaultVal:true,			title:"Y Axis Use Comma to Divide Thousands",	userConfigurable:true, configType:"checkbox", values:[{value:true,label:""}], displayCondition: "config.specific['yAxisTickFormatType'] != 'time'"},
              	{name:"yAxisTickFormatTime",		type:"string",		defaultVal:"%m/%d %H:%M",		title:"Y Axis Time Format",		userConfigurable:true,	configType:"select", displayCondition: "config.specific['yAxisTickFormatType'] == 'time'", values:[{value:"%c",label:"date and time"},{value:"%x",label:"date"},{value:"%X",label:"time"}]},
   	            {name:"showYAxis",					type:"boolean",		defaultVal:true,			title:"Show Y Axis",	userConfigurable:false,	configType:"checkboxSingle"},
   	            {name:"showLegend",					type:"boolean",		defaultVal:true,			title:"",				userConfigurable:false,	configType:null},
   	            {name:"width",						type:"integer",		defaultVal:100,				title:"Chart Width",	userConfigurable:true,	configType:"select", values:[{value:50,label:"50%"}, {value:100,label:"100%"}]},
  	            {name:"height",						type:"integer",		defaultVal:100,				title:"Chart Height",	userConfigurable:false,	configType:"text"},
   	            {name:"color",						type:"function",	defaultVal:null,			title:"",				userConfigurable:false,	configType:null},
   	            {name:"isArea",						type:"boolean",		defaultVal:false,			title:"Is Area",		userConfigurable:true,	configType:"checkbox", values:[{value:true,label:""}]},
   	            {name:"noData",						type:"string",		defaultVal:null,			title:"",				userConfigurable:false,	configType:null},
   	            {name:"interactive",				type:"boolean",		defaultVal:null,			title:"",				userConfigurable:false,	configType:null},
   	            {name:"useInteractiveGuideLine",	type:"boolean",		defaultVal:null,			title:"",				userConfigurable:false,	configType:null},
   	            {name:"tooltips",					type:"boolean",		defaultVal:null,			title:"",				userConfigurable:false,	configType:null},
   	            {name:"tooltipcontent",				type:"function",	defaultVal:null,			title:"",				userConfigurable:false,	configType:null},
   	            {name:"clipEdge",					type:"boolean",		defaultVal:null,			title:"",				userConfigurable:false,	configType:null},
   	            {name:"clipVoronoi",				type:"boolean",		defaultVal:null,			title:"",				userConfigurable:false,	configType:null},
   	            {name:"interpolate",				type:"enum",		defaultVal:null,			title:"",				userConfigurable:false,	configType:null}
   			],
   			configTransient: [
                   {name:"version",					type:"integer",		defaultVal:0,				title:"",				userConfigurable:false,	configType:null},
                   {name:"xForceValues",				type:"array",		defaultVal:null,			title:"",				userConfigurable:false,	configType:null},
                   {name:"yForceValues",				type:"array",		defaultVal:null,			title:"",				userConfigurable:false,	configType:null}
               ]
   		},
   		{
 	    	type: "barVertical",
 	    	typeName: "Bar Chart",
 	    	config: [
  	            {name:"id",							type:"string",		defaultVal:null,			title:"",				userConfigurable:false,	configType:null},
  	            {name:"x",							type:"function",	defaultVal:null,			title:"",				userConfigurable:false,	configType:null},
	            {name:"xAxisLabel",					type:"string",		defaultVal:"",				title:"X Axis Label",	userConfigurable:true,	configType:"text"},
				{name:"xAxisTickFormat",			type:"function",	defaultVal:null,			title:"",				userConfigurable:false,	configType:null},
				{name:"xAxisTickFormatType",		type:"string",		defaultVal:"time",			title:"X Axis Data Type",		userConfigurable:true,	configType:"select", values:[{value:"",label:"unspecified"},{value:"g",label:"general (number)"},{value:"d",label:"integer"},{value:"f",label:"float"},{value:"e",label:"exponential"},{value:"r",label:"rounded"},{value:"%",label:"percentage"},{value:"p",label:"percentage rounded"},{value:"s",label:"SI prefixed (e.g. 1k for 1000)"},{value:"time",label:"time"}]},
				{name:"xAxisTickFormatPrecision",	type:"integer",		defaultVal:-1,				title:"X Axis Data Precision",	userConfigurable:true,	configType:"text", displayCondition: "config.specific['xAxisTickFormatType'] != 'time'"},
				{name:"xAxisTickFormatCommaDivide",	type:"boolean",		defaultVal:true,			title:"X Axis Use Comma to Divide Thousands",	userConfigurable:true, configType:"checkbox", values:[{value:true,label:""}], displayCondition: "config.specific['xAxisTickFormatType'] != 'time'"},
				{name:"xAxisTickFormatTime",		type:"string",		defaultVal:"%m/%d %H:%M",		title:"X Axis Time Format",		userConfigurable:true,	configType:"select", displayCondition: "config.specific['xAxisTickFormatType'] == 'time'", values:[{value:"%M:%S",label:"minutes:seconds"},{value:"%H:%M:%S",label:"hours:minutes:seconds"},{value:"%H:%M",label:"hours:minutes"},{value:"%m/%d %H:%M:%S",label:"month/day hours:minutes:seconds"},{value:"%m/%d %H:%M",label:"month/day hours:minutes"},{value:"%m/%d",label:"month/day"},{value:"%m/%d/%y",label:"month/day/year"},{value:"%m/%d/%Y",label:"month/day/full year"}]},
				{name:"showXAxis",					type:"boolean",		defaultVal:true,			title:"Show X Axis",	userConfigurable:false,	configType:"checkboxSingle"},
				{name:"y",							type:"function",	defaultVal:null,			title:"",				userConfigurable:false,	configType:null},
				{name:"yAxisLabel",					type:"string",		defaultVal:"",				title:"Y Axis Label",	userConfigurable:true,	configType:"text"},
	            {name:"yAxisTickFormat",			type:"function",	defaultVal:null,			title:"",				userConfigurable:false,	configType:null},
	            {name:"yAxisTickFormatType",		type:"string",		defaultVal:"g",				title:"Y Axis Data Type",		userConfigurable:true,	configType:"select", values:[{value:"",label:"unspecified"},{value:"g",label:"general (number)"},{value:"d",label:"integer"},{value:"f",label:"float"},{value:"e",label:"exponential"},{value:"r",label:"rounded"},{value:"%",label:"percentage"},{value:"p",label:"percentage rounded"},{value:"s",label:"SI prefixed (e.g. 1k for 1000)"},{value:"time",label:"time"}]},
	            {name:"yAxisTickFormatPrecision",	type:"integer",		defaultVal:-1,				title:"Y Axis Data Precision",	userConfigurable:true,	configType:"text", displayCondition: "config.specific['yAxisTickFormatType'] != 'time'"},
				{name:"yAxisTickFormatCommaDivide",	type:"boolean",		defaultVal:true,			title:"Y Axis Use Comma to Divide Thousands",	userConfigurable:true, configType:"checkbox", values:[{value:true,label:""}], displayCondition: "config.specific['yAxisTickFormatType'] != 'time'"},
				{name:"yAxisTickFormatTime",		type:"string",		defaultVal:"%m/%d %H:%M",		title:"Y Axis Time Format",		userConfigurable:true,	configType:"select", displayCondition: "config.specific['yAxisTickFormatType'] == 'time'", values:[{value:"%c",label:"date and time"},{value:"%x",label:"date"},{value:"%X",label:"time"}]},
	            {name:"showYAxis",					type:"boolean",		defaultVal:true,			title:"Show Y Axis",	userConfigurable:false,	configType:"checkboxSingle"},
 	            {name:"showLegend",					type:"boolean",		defaultVal:true,			title:"",				userConfigurable:false,	configType:null},
 	            {name:"width",						type:"integer",		defaultVal:100,				title:"Chart Width",	userConfigurable:true,	configType:"select", values:[{value:50,label:"50%"}, {value:100,label:"100%"}]},
 	            {name:"height",						type:"integer",		defaultVal:100,				title:"Chart Height",	userConfigurable:false,	configType:"text"},
 	            {name:"color",						type:"function",	defaultVal:null,			title:"",				userConfigurable:false,	configType:null},
 	            {name:"isArea",						type:"boolean",		defaultVal:false,			title:"Is Area",		userConfigurable:true,	configType:"checkbox", values:[{value:true,label:""}]},
 	            {name:"noData",						type:"string",		defaultVal:null,			title:"",				userConfigurable:false,	configType:null},
 	            {name:"interactive",				type:"boolean",		defaultVal:null,			title:"",				userConfigurable:false,	configType:null},
 	            {name:"useInteractiveGuideLine",	type:"boolean",		defaultVal:null,			title:"",				userConfigurable:false,	configType:null},
 	            {name:"tooltips",					type:"boolean",		defaultVal:null,			title:"",				userConfigurable:false,	configType:null},
 	            {name:"tooltipcontent",				type:"function",	defaultVal:null,			title:"",				userConfigurable:false,	configType:null},
 	            {name:"clipEdge",					type:"boolean",		defaultVal:null,			title:"",				userConfigurable:false,	configType:null},
 	            {name:"clipVoronoi",				type:"boolean",		defaultVal:null,			title:"",				userConfigurable:false,	configType:null},
 	            {name:"interpolate",				type:"enum",		defaultVal:null,			title:"",				userConfigurable:false,	configType:null}
 			],
 			configTransient: [
                 {name:"version",					type:"integer",		defaultVal:0,				title:"",				userConfigurable:false,	configType:null},
                 {name:"yForceValues",				type:"array",		defaultVal:null,			title:"",				userConfigurable:false,	configType:null}
            ]
 		}
	];
	
	this.xFn = function(widgetGuid) {
		return function(d) {
			return d[0];
		};
	};
	
	this.yFn = function(widgetGuid) {
		return function(d) {
			return d[1];
		};
	};
	
	this.xAxisTickFormatFn = angular.bind(this, function(widgetGuid) {
    	var widget = Utils.getElementByGuid( widgetGuid, this.chartList );
    	return function(d) {
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
    });

    this.yAxisTickFormatFn = angular.bind(this, function(widgetGuid) {
    	var widget = Utils.getElementByGuid( widgetGuid, this.chartList );
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
    });
    
    this.colorFn = angular.bind(this, function(widgetGuid) {
		var widget = Utils.getElementByGuid( widgetGuid, this.chartList );
		return function(d, i) {
			var series = i;
			if (typeof d.series != "undefined")
				series = d.series; // nv.d3 charts don"t use the "i" argument consistently, some use d.series instead
			if (typeof widget["metric"][series].color === "undefined")
				return this.colors[series].hex // no color defined
			else
				return widget["metric"][series].color;
		};
	});

	this.prepareWgConfigCommon = function() {
		var config = {},
			commonConfig = angular.copy( this.chartConfigCommon );
		for (var i=0; i<commonConfig.length; i++) {
			config[ commonConfig[i].name ] = commonConfig[i].defaultVal;
		}
		
		return config;
	};
	
	this.prepareWgConfigSpecific = function(config) {
		var type = config["type"],
			specificConfig = angular.copy( this.getWidgetDefByType(type) );
		for (var i=0; i<specificConfig.config.length; i++) {
			config.specific[ specificConfig.config[i].name ] = specificConfig.config[i].defaultVal;
			
			//TODO: without this workaround, config fields of type function are "undefined"
			if (specificConfig.config[i].name == "x")
				config.specific[ specificConfig.config[i].name ] = this.xFn;
			if (specificConfig.config[i].name == "y")
				config.specific[ specificConfig.config[i].name ] = this.yFn;
			if (specificConfig.config[i].name == "xAxisTickFormat")
				config.specific[ specificConfig.config[i].name ] = this.xAxisTickFormatFn;
			if (specificConfig.config[i].name == "yAxisTickFormat")
				config.specific[ specificConfig.config[i].name ] = this.yAxisTickFormatFn;
				
		}
		for (var i=0; i<specificConfig.configTransient.length; i++) {
			config.transientCfg[ specificConfig.configTransient[i].name ] = specificConfig.configTransient[i].defaultVal;
		}
		for (var key in specificConfig) {
			if ( !(key == "config" || key == "configTransient")
					&& typeof config[key] !== "undefined" && !this.isUserConfigurable(key) )
				config[key] = specificConfig[key];
		}
		
		return config;
	};
	
	this.getWidgetDefByType = function(type) {
		for (var i=0; i<this.chartTypes.length; i++) {
			if (type == this.chartTypes[i].type)
				return this.chartTypes[i];
		} 
	};
	
	this.isUserConfigurable = function(propertyName) {
		for (var i=0; i<this.chartConfigCommon.length; i++) {
			if (this.chartConfigCommon[i].name == propertyName)
				return this.chartConfigCommon[i].userConfigurable;
		}
		return false;
	};
	
	this.getData = angular.bind(this, function(config) {
		DataService.getData(config);
	});
	
	this.getDataAggregate = angular.bind(this, function(config) {
		DataService.getDataAggregate(config);
	});
	
	this.editWidget = angular.bind(this, function(guid) {
    	var idx = Utils.getIndexByGuid(guid, this.chartList),
    		config = angular.copy( this.chartList[idx] );
    	var modalInstance = $modal.open({
    		templateUrl: "partials/editWidgetModalAs.html",
    		controller: "editWidgetModalCtrlAs as modal",
    		scope: $scope,
    		resolve: {
	    		config: function() {
	    			return config;
	    		}//,
//	    		chartConfigCommon: function() {
//	    			return this.chartConfigCommon;
//	    		},
//	    		chartTypes: function() {
//	    			return this.chartTypes;
//	    		}
    		}
    	});

		modalInstance.result.then(
			angular.bind(this, function(config) {
				config.transientCfg.version++;
				angular.extend( this.chartList[idx], config );
			})
		);
    });
 	
 	this.removeWidget = angular.bind(this, function(guid) {
    	var idx = Utils.getIndexByGuid(guid, this.chartList);
    	this.chartList.splice(idx, 1);
    });
    
    this.moveWidget = angular.bind(this, function(guid, distance) {
    	var	min, max, step,
    		length = this.chartList.length,
    		idx = Utils.getIndexByGuid(guid, this.chartList);
    	if (distance == 0) {
    		return;
    	}
    	else if (distance > 0) {
    		min = idx + 1;
    		max = Math.min( idx + distance, length - 1 );
    		step = -1;
    	}
    	else if (distance < 0) {
    		min = Math.max( idx + distance, 0 );
    		max = idx - 1;
    		step = 1;
    	}
    	
    	for (var i=0; i<length; i++) {
    		if ( this.chartList[i].position >= min && this.chartList[i].position <= max )
    			this.chartList[i].position += step;
    	}
    	this.chartList[idx].position += distance;
    });
	
	this.widgetApi = {
        removeWidget: this.removeWidget,
        editWidget: this.editWidget,
        editMetric: function() {}, //this.editMetric,
        moveWidget: this.moveWidget,
        getData: this.getData,
        getDataAggregate: this.getDataAggregate
	};
	
	this.openDatePickerModal = function() {
		var modalInstance = $modal.open({
    		templateUrl: "partials/workbenchDatePickerModal.html",
    		controller: "workbenchDatePickerModalCtrl as modal",
    		resolve: {
    			startMillis: angular.bind(this, function() {
					return this.addChartConfig.timeframe.start.getTime();
    			}),
    			endMillis: angular.bind(this, function() {
					return this.addChartConfig.timeframe.end.getTime();
    			})
    		}
    	});

		modalInstance.result.then(
			angular.bind(this, function(result) {
				this.addChartConfig.timeframe.start = result.startDate;
				this.addChartConfig.timeframe.end   = result.endDate;
			})
		);
		
		return false;
	};
	
//	this.addMetric = function() {
//    	var modalInstance = $modal.open({
//    		templateUrl: "partials/addWorkbenchMetricModal.html",
//    		controller: "addWorkbenchMetricModalCtrl as modal",
//    		scope: $scope
//    	});
//
//		modalInstance.result.then(
//			angular.bind(this, function(metric) {
//				this.metricList.push(metric);
//				DataService.getDataAggregate({
//					metricIdx: this.metricList.length-1,
//					collection: metric["collection"],
//					field: metric["field"],
//					attribute: metric["attribute"],
//					timestampField: "@timestamp",
//					success: angular.bind(this, function(data, status, headers, httpConfig) {
//						var metricIdx = httpConfig["metricIdx"],
//							statistic = this.metricList[metricIdx]["attribute"],
//							datapoints = [];
//						if (statistic == "average")
//							statistic = "avg";
//						
//						for (var i=0; i<data.length; i++) {
//							datapoints.push( { x:data[i]["time"].getTime(), y:data[i]["values"][statistic], series:metricIdx } );
//						}
//						this.metricData[metricIdx] = datapoints;
//						this.chart["data"].push({
//							key: this.metricList[metricIdx]["name"],
//							values: datapoints
//						});
//					}),
//					error: function(error) {
//						UiMessage.add("danger", "An error occured when getting data for a metric.");
//					}
//				});
//			})
//		);
//		
//		return false;
//	};
//	
//	this.chart = {
//		config: {
//			visible: true, // default: true
//			extended: false, // default: false
//			disabled: false, // default: false
//			autorefresh: true, // default: true
//			refreshDataOnly: false // default: false
//		},
//		options: {
//			chart: {
//                type: "lineWithFocusChart",
//                height: 450,
//                margin : {
//                    top: 20,
//                    right: 20,
//                    bottom: 60,
//                    left: 40
//                },
//                transitionDuration: 500,
//                xAxis: {
//                    axisLabel: "X Axis",
//                    tickFormat: function(d){
//                        return d3.format(",f")(d);
//                    }
//                },
//                x2Axis: {
//                    tickFormat: function(d){
//                        return d3.format(",f")(d);
//                    }
//                },
//                yAxis: {
//                    axisLabel: "Y Axis",
//                    tickFormat: function(d){
//                        return d3.format(",.2f")(d);
//                    },
//                    rotateYLabel: false
//                },
//                y2Axis: {
//                    tickFormat: function(d){
//                        return d3.format(",.2f")(d);
//                    }
//                }
//
//            }
//		},
//		data: [] //generateData()
//	};
//	
//    /* Random Data Generator (took from nvd3.org) */
//    function generateData() {
//        return stream_layers(3,10+Math.random()*200,.1).map(function(data, i) {
//            return {
//                key: "Stream" + i,
//                values: data
//            };
//        });
//    }
//
//    /* Inspired by Lee Byron"s test data generator. */
//    function stream_layers(n, m, o) {
//        if (arguments.length < 3) o = 0;
//        function bump(a) {
//            var x = 1 / (.1 + Math.random()),
//                y = 2 * Math.random() - .5,
//                z = 10 / (.1 + Math.random());
//            for (var i = 0; i < m; i++) {
//                var w = (i / m - y) * z;
//                a[i] += x * Math.exp(-w * w);
//            }
//        }
//        return d3.range(n).map(function() {
//            var a = [], i;
//            for (i = 0; i < m; i++) a[i] = o + o * Math.random();
//            for (i = 0; i < 5; i++) bump(a);
//            return a.map(stream_index);
//        });
//    }
//
//    /* Another layer generator using gamma distributions. */
//    function stream_waves(n, m) {
//        return d3.range(n).map(function(i) {
//            return d3.range(m).map(function(j) {
//                var x = 20 * j / m - i / 3;
//                return 2 * x * Math.exp(-.5 * x);
//            }).map(stream_index);
//        });
//    }
//
//    function stream_index(d, i) {
//        return {x: i, y: Math.max(0, d)};
//    }
    
    // perform initial actions
    DataService.listApplications({
		tenantId: Auth.user["tenantId"],
		success: angular.bind(this, function(appList) {
			this.applicationList = appList;
			 DataService.getApplicationFields({
				applicationList: appList,
				success: angular.bind(this, function(data) {
					this.applicationFields = data;
				}),
				error: this.errorCallback
			});
		}),
		error: this.errorCallback
	});
    
    this.errorCallback = angular.bind(this, function(data, status, headers, httpConfig, statusText) {
    	var message = (typeof data["message"] == "undefined")? "---" : data["message"];
		UiMessage.add("danger", "An error occured when listing user's applications/application fields.\nMessage: " + message);
    });
    
    var millisNow = (new Date()).getTime();
    this.addChartConfig.timeframe.start.setTime( millisNow - 86400000 ); //subtract 1 day
}]);

angular.module("insightal.workbench")
	.controller("addWorkbenchMetricModalCtrl", [
		"$scope", "$modalInstance", function(
		 $scope,   $modalInstance) {
	this.metric = {};
		
	this.save = function() {
		$modalInstance.close( angular.copy( this.metric ) );
	};
	
	this.cancel = function() {
		$modalInstance.dismiss();
	};
}]);

angular.module("insightal.workbench")
	.controller("workbenchDatePickerModalCtrl", [
		"$scope", "$modalInstance", "startMillis", "endMillis", function(
		 $scope,   $modalInstance,   startMillis,   endMillis) {
	this.startDate = new Date( startMillis );
	this.endDate   = new Date( endMillis );
		
	this.save = function() {
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