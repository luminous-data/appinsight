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

angular.module("insightal.users")
	.controller("LoginCtrl",[
		"$scope", "$state", "Auth",	function(
		 $scope,   $state,   Auth) {
	
	this.username = "";
	this.password = "";
	this.rememberMe = true;
	this.validationErrors = [];
		
	this.login = function() {
		this.validationErrors = [];
		Auth.login({
			username:	this.username,
			password:	this.password,
			rememberme:	this.rememberme
		})
		.then(function(user) {
            if (user.role["title"] === "admin")
            	$state.go("admin.siteadmin");
            else
            	$state.go("user.home");
		})
		.catch(angular.bind(this, function(result) { // result = {data:string|Object, headers:function, config:Object, status:number, statusText:string}
			this.validationErrors.push({
				message: "Login failed."
			});
			this.password = "";
		}));
	};
	
}]);

angular.module("insightal.users")
	.controller("SettingsCredentialsCtrl", [
		"$scope", "Auth", "UiMessage", function(
		 $scope,   Auth,   UiMessage) {
	this.user = angular.copy( Auth.user );
	this.username = this.user.username;
	this.validationErrors = [];
	
	this.save = function() {
		this.validationErrors = [];
		var isPasswordNonEmpty = true;
		if (typeof this.user["password"] == "undefined" || this.user["password"] == "") {
			this.validationErrors.push({ message:"The password field is empty.", field:"password" });
			isPasswordNonEmpty = false;
		}
		if (typeof this.user["passwordCheck"] == "undefined" || this.user["passwordCheck"] == "") {
			this.validationErrors.push({ message:"The password-retype field is empty.", field:"passwordCheck" });
			isPasswordNonEmpty = false;
		}
		if (typeof this.user["passwordCurrent"] == "undefined" || this.user["passwordCurrent"] == "") {
			this.validationErrors.push({ message:"The current password field is empty.", field:"passwordCurrent" });
		}
		if (isPasswordNonEmpty && this.user["password"] != this.user["passwordCheck"]) {
			this.validationErrors.push({ message:"Passwords don't match.", field:"passwordCheck" });
		}

		if (this.validationErrors.length == 0) {
			UiMessage.add("info", "Change user credentials feature is not implemented yet.");
			// TODO: wire up to server API once it exists
			// (change password, get user info)
			this.user = angular.copy( Auth.user );
		}
	};
	
	this.isValid = function(fieldId) {
		for (var i=0; i<this.validationErrors.length; i++) {
			if (this.validationErrors[i]["field"] == fieldId)
				return false;
		}
		return true;
	};
	
}]);

angular.module("insightal.users")
	.controller("SettingsDefaultsCtrl", [
		"$scope", "Auth", "UiMessage", function(
		 $scope,   Auth,   UiMessage) {
	this.validationErrors = [];
	
	this.save = function() {
		this.validationErrors = [];
			
		if (this.validationErrors.length == 0) {
			UiMessage.add("info", "Setting user dafaults feature is not implemented yet.");
			// TODO: wire up to server API once it exists
		}
	};
	
	this.isValid = function(fieldId) {
		for (var i=0; i<this.validationErrors.length; i++) {
			if (this.validationErrors[i]["field"] == fieldId)
				return false;
		}
		return true;
	};

}]);

angular.module("insightal.users")
	.controller("RegisterCtrl", [
		"$rootScope", "$scope", "$location", "Auth", function(
		 $rootScope,   $scope,   $location,   Auth) {
	$scope.role = Auth.userRoles.user;
	$scope.userRoles = Auth.userRoles;
	$scope.register = function() {
		Auth.register(
			{
				username: $scope.username,
				password: $scope.password,
				role: $scope.role
			},
			function() {
				$location.path("/");
			},
			function(err) {
				$rootScope.error = err;
			}
		);
	};
}]);

angular.module("insightal.users")
	.controller("SiteAdminCtrl", [
		"$scope", "$modal", "Tenant", "User", "Auth", "UiMessage", "Utils", function(
		 $scope,   $modal,   Tenant,   User,   Auth,   UiMessage,   Utils) {
	this.tenants = [];
	this.tenantListDisplayed = [];
	this.currentTenant = null;
	this.currentTenantOriginal = null;
	this.userAction = "";
	
	this.pgNumPages		= 0;
	this.pgNumPerPage	= 10;  // constant - set this to change list page size
	this.pgNumResults	= 0;
	this.pgCurrentPage	= 1;
	
	this.listOrderKey = "name";
	this.listOrderReverse = false;
	
	this.editTenant = function(guid, userAction) {
		this.currentTenant = angular.copy( Utils.getElementByGuid(guid, this.tenants) );
		this.currentTenantOriginal = angular.copy( this.currentTenant);
		this.userAction = userAction;
		
		var modalInstance = $modal.open({
			templateUrl: "partials/editTenantModal.html",
			controller: "EditTenantModalCtrl as modal",
			scope: $scope
		});
		
		modalInstance.result.then( angular.bind(this, function() {
			if (this.userAction === "Edit") {
				UiMessage.add("info", "This feature is not implemented yet. Tenant " + this.currentTenant["name"] + " was not updated.");
			}
			else {
				Tenant.addTenantWithUser({
	    			tenantName:	this.currentTenant["name"],
	                email:		this.currentTenant["email"],
	                password:	this.currentTenant["password"]
	            })
	            .then(angular.bind(this, function(result) { // result = {data:string|Object, headers:function, config:Object, status:number, statusText:string}
	            	UiMessage.add("success", "Tenant and user created successfully. Username: '" + result.data["userName"] + "'");
	            	this.currentTenant = null;
	            	this.currentTenantOriginal = null;
	            	this.getTenantList();
	            }))
	            .catch(function(data, status, headers, httpConfig) {
	            	UiMessage.add("danger", "Failed to create tenant \"" + result.config.data["name"] + "\".<br/>Message: '" + result.data["message"] + "'");
	            });
			}
		}));
		
		return false;
	};
	
	this.deleteTenant = function(guid) {
		this.currentTenant = angular.copy( Utils.getElementByGuid(guid, this.tenants) );
		
		var modalInstance = $modal.open({
    		templateUrl: "partials/removeTenantModal.html",
    		controller: "RemoveTenantModalCtrl as modal",
    		scope: $scope
    	});

		modalInstance.result.then( angular.bind(this, function() {
			Tenant.delete(this.currentTenant["guid"])
			.then(angular.bind(this, function(result) {
				this.getTenantList();
				UiMessage.add("success", "Tenant " + this.currentTenant["name"] + " has been deleted.");
				this.currentTenant = null;
			}))
			.catch(angular.bind(this, function(result) {
				UiMessage.add("danger", "An error occured when deleting tenant " + this.currentTenant["name"] + ".");
			}));
		}));
		
		return false;
	};
	
	this.getTenantList = function() {
		Tenant.getAll()
		.then(angular.bind(this, function(result) { // result = {data:string|Object, headers:function, config:Object, status:number, statusText:string}
			this.tenants = result.data;
			this.pgNumResults = this.tenants.length;
			this.pgNumPages = Math.floor( this.tenants.length / this.pgNumPerPage ) + ( (this.tenants.length % this.pgNumPerPage > 0)? 1 : 0 );
			this.pgCurrentPage = 1;
		}))
		.catch(angular.bind(this, function(result) {
			UiMessage.add("danger", "Failed to fetch tenants.");
		}));			
	};
	
	this.changeOrderTo = function(key) {
		this.listOrderReverse = (key === this.listOrderKey)? !this.listOrderReverse : false;
		this.listOrderKey = key;
	};
	
//	this.changeTenantListPage = function(page) {
//		var list = [];
//		for (var i = (page-1)*this.pgNumPerPage; i < Math.min(page*this.pgNumPerPage, this.pgNumResults); i++) {
//			list.push( angular.copy( this.tenants[i] ) );
//		}
//		this.tenantListDisplayed = list;
//	};
//	
//	$scope.$watch(
//		angular.bind(this, function() {
//			return this.pgCurrentPage;
//		}),
//		angular.bind(this, this.changeTenantListPage)
//	);
	
	// initial actions
	this.getTenantList();
}]);

angular.module("insightal.users")
	.controller("EditTenantModalCtrl", [
		"$scope", "$modalInstance", function(
		 $scope,   $modalInstance) {
	this.validationErrors = [];
	
	this.isValid = function(fieldId) {
		for (var i=0; i<this.validationErrors.length; i++) {
			if (this.validationErrors[i]["field"] == fieldId)
				return false;
		}
		return true;
	};
	
	this.isUnchanged = function(tenant1, tenant2) {
		return angular.equals(tenant1, tenant2);
	};	
	
	this.save = function(tenantEditForm) {
		this.validationErrors = [];
		if (typeof $scope.admin.currentTenant["name"] == "undefined" || $scope.admin.currentTenant["name"] == "") {
			this.validationErrors.push({ message:"The name field is empty.", field:"tenantName" });
		}
		if (typeof $scope.admin.currentTenant["email"] == "undefined" || $scope.admin.currentTenant["email"] == "" ||
			!tenantEditForm["tenantEmail"].$valid) {
			this.validationErrors.push({ message:"The email field is empty or not valid.", field:"tenantEmail" });
		}
		// provided this is editing a tenant, check if one of password field has been touched
		if ( $scope.admin.userAction != 'Edit' ||
			(typeof $scope.admin.currentTenant["password"     ] != "undefined" && $scope.admin.currentTenant["password"     ] != "") ||
			(typeof $scope.admin.currentTenant["passwordCheck"] != "undefined" && $scope.admin.currentTenant["passwordCheck"] != "") ) {
			// if password fields have been touched, check that they're not empty
			var isPasswordNonEmpty = true;
			if (typeof $scope.admin.currentTenant["password"] == "undefined" || $scope.admin.currentTenant["password"] == "") {
				this.validationErrors.push({ message:"The password field is empty.", field:"tenantPassword" });
				isPasswordNonEmpty = false;
			}
			if (typeof $scope.admin.currentTenant["passwordCheck"] == "undefined" || $scope.admin.currentTenant["passwordCheck"] == "") {
				this.validationErrors.push({ message:"The password-retype field is empty.", field:"tenantPasswordCheck" });
				isPasswordNonEmpty = false;
			}
			// check that passwords match (only if passwords have been filled in)
			if (isPasswordNonEmpty && $scope.admin.currentTenant["password"] != $scope.admin.currentTenant["passwordCheck"]) {
				this.validationErrors.push({ message:"Passwords don't match.", field:"tenantPasswordCheck" });
			}
		}

		if (this.validationErrors.length == 0) {
			$modalInstance.close();
		}
	};
	
	this.cancel = function() {
		$modalInstance.dismiss();
	};
}]);

angular.module("insightal.users")
	.controller("RemoveTenantModalCtrl", [
		"$scope", "$modalInstance", function(
		 $scope,   $modalInstance) {
	this.save = function() {
		$modalInstance.close();
	};
	
	this.cancel = function() {
		$modalInstance.dismiss();
	};
}]);

angular.module("insightal.users")
	.controller("TenantUsersCtrl", [
		"$scope", "$modal", "User", "Tenant", "Auth", "UiMessage", "Utils", function(
		 $scope,   $modal,   User,   Tenant,   Auth,   UiMessage,   Utils) {
	this.userList = {
		items:		[],
		numPages:	 0,
		numPerPage:	10, // constant - set this to change list page size
		numResults:	 0, 
		currentPage: 1
	};
	this.userListDisplayed = [];
	this.currentUser = null;
	this.currentUserOriginal = null;
	this.userAction = "";
	this.availableRoles = [];
	
	this.editUser = function(guid, userAction) {
		this.currentUser = angular.copy( Utils.getElementByGuid(guid, this.userList.items) );
		this.currentUserOriginal = angular.copy( this.currentUser);
		this.userAction = userAction;
		
		var modalInstance = $modal.open({
			templateUrl: "partials/editUserModal.html",
			controller: "EditUserModalCtrl as modal",
			scope: $scope
		});
		
		modalInstance.result.then( angular.bind(this, function() {
			if (this.userAction === "Edit") {
				UiMessage.add("info", "This feature is not implemented yet. User " + this.currentUser["name"] + " was not updated.");
				this.currentUser = null;
				this.currentUserOriginal = null;
			}
			else {
				if (this.currentUser["role"] == Auth.userRoles["user"].bitMask) {
					User.add({
						name:       this.currentUser["name"],
						email:      this.currentUser["email"],
						password:   this.currentUser["password"],
						tenantId:	Auth.user["tenantId"],
						role:		this.currentUser["role"]//Auth.userRoles["user"].bitMask
					})
					.then(angular.bind(this, function(result) { // result = {data:string|Object, headers:function, config:Object, status:number, statusText:string}
						UiMessage.add("success", "User \"" + this.currentUser["name"] + "\" created successfully.");
						this.currentUser = null;
						this.currentUserOriginal = null;
						this.getUserList();
					}))
					.catch(angular.bind(this, function(result) {
						UiMessage.add("danger", "Failed to create user \"" + this.currentUser["name"] + "\".");
					}));
				}
				else if (this.currentUser["role"] == Auth.userRoles["tenant"].bitMask) {
					Tenant.addTenantWithUser({
		    			tenantName:	this.currentUser["name"],
		                email:		this.currentUser["email"],
		                password:	this.currentUser["password"]
		            })
		            .then(angular.bind(this, function(result) { // result = {data:string|Object, headers:function, config:Object, status:number, statusText:string}
		            	UiMessage.add("success", "Tenant and user created successfully. Username: '" + result.data["userName"] + "'");
		            	this.currentUser = null;
						this.currentUserOriginal = null;
						this.getUserList();
		            }))
		            .catch(angular.bind(this, function(result) {
		            	UiMessage.add("danger", "Failed to create tenant admin and user \"" + this.currentUser["name"] + "\".<br/>Message: '" + result.data["message"] + "'");
		            }));
				}
				else {
					UiMessage.add("danger", "Could not create user. The user role is not known (should be user or tenant admin).");
				}
			}
		}));
		
		return false;
	};
	
	this.deleteUser = function(guid) {
		this.currentUser = angular.copy( Utils.getElementByGuid(guid, this.userList.items) );
		
		var modalInstance = $modal.open({
    		templateUrl: "partials/removeUserModal.html",
    		controller: "RemoveUserModalCtrl as modal",
    		scope: $scope
    	});

		modalInstance.result.then( angular.bind(this, function() {
			User.delete( this.currentUser["guid"] )
			.then(angular.bind(this, function(result) { // result = {data:string|Object, headers:function, config:Object, status:number, statusText:string}
				this.getUserList();
				UiMessage.add("success", "User " + this.currentUser["name"] + " has been deleted.");
				this.currentUser = null;
			}))
			.catch(angular.bind(this, function(result) {
				UiMessage.add("danger", "An error occured when deleting user " + this.currentUser["name"] + ".");
			}));
		}));
		
		return false;
	};
	
	this.getUserList = function() {
		User.getAll()
		.then(angular.bind(this, function(result) { // result = {data:string|Object, headers:function, config:Object, status:number, statusText:string}
			var users = result.data,
				usersFiltered = [];
			if (Auth.user["role"]["bitMask"] == Auth.userRoles["admin"]["bitMask"]) {
				usersFiltered = users;
			}
			else {
				// if this is not admin user, remove admin user(s) from the listing
				for (var i=0; i<users.length; i++) {
					if (users[i]["role"]["bitMask"] != Auth.userRoles["admin"]["bitMask"]) {
						usersFiltered.push( users[i] );
					}
				}
			}
			this.userList.items = usersFiltered;
			this.userList.numResults = usersFiltered.length;
			this.userList.numPages = Math.floor( usersFiltered.length / this.userList.numPerPage ) + ( (usersFiltered.length % this.userList.numPerPage > 0)? 1 : 0 );
			this.changeUserListPage(1);
		}))
		.catch(function(result) {
			UiMessage.add("danger", "Failed to fetch users.");
		});
	};
	
	this.getRoleNameByBitmask = function(bitmask) {
		var role = Auth.getRoleByBitmask(bitmask);
		return role["title"];
	};
	
	this.initAvailableRoles = function() {
		var userRoles = Auth.userRoles;
		if ( !angular.isArray( this.availableRoles ) ) {
			this.availableRoles = [];
		}
		this.availableRoles.push({
			label: "User",
			value: userRoles["user"].bitMask
		});
		this.availableRoles.push({
			label: "Tenant Administrator",
			value: userRoles["tenant"].bitMask
		});
   	
	};
	
	this.changeUserListPage = function(page) {
		var list = [];
		for (var i = (page-1)*this.userList.numPerPage; i < Math.min(page*this.userList.numPerPage, this.userList.numResults); i++) {
			list.push( angular.copy( this.userList.items[i] ) );
		}
		this.userListDisplayed = list;
	};
	
	$scope.$watch(
		angular.bind(this, function() {
			return this.userList.currentPage;
		}),
		angular.bind(this, this.changeUserListPage)
	);
	
	// initial actions
	this.initAvailableRoles();
	this.getUserList();
}]);

angular.module("insightal.users")
	.controller("EditUserModalCtrl", [
		"$scope", "$modalInstance", function(
		 $scope,   $modalInstance) {
	this.validationErrors = [];
	
	this.isValid = function(fieldId) {
		for (var i=0; i<this.validationErrors.length; i++) {
			if (this.validationErrors[i]["field"] == fieldId)
				return false;
		}
		return true;
	};
	
	this.isUnchanged = function(obj1, obj2) {
		return angular.equals(obj1, obj2);
	};	
	
	this.save = function(userEditForm) {
		this.validationErrors = [];
		if (typeof $scope.users.currentUser["role"] == "undefined" || $scope.users.currentUser["role"] == "") {
			this.validationErrors.push({ message:"The role is not selected.", field:"userRole" });
		}
		if (typeof $scope.users.currentUser["name"] == "undefined" || $scope.users.currentUser["name"] == "") {
			this.validationErrors.push({ message:"The name field is empty.", field:"userName" });
		}
		if (typeof $scope.users.currentUser["email"] == "undefined" || $scope.users.currentUser["email"] == "" ||
			!userEditForm["userEmail"].$valid) {
			this.validationErrors.push({ message:"The email field is empty or not valid.", field:"userEmail" });
		}
		// provided this is editing a user, check if one of password field has been touched
		if ( $scope.users.userAction != 'Edit' ||
			(typeof $scope.users.currentUser["password"     ] != "undefined" && $scope.users.currentUser["password"     ] != "") ||
			(typeof $scope.users.currentUser["passwordCheck"] != "undefined" && $scope.users.currentUser["passwordCheck"] != "") ) {
			// if password fields have been touched, check that they're not empty
			var isPasswordNonEmpty = true;
			if (typeof $scope.users.currentUser["password"] == "undefined" || $scope.users.currentUser["password"] == "") {
				this.validationErrors.push({ message:"The password field is empty.", field:"userPassword" });
				isPasswordNonEmpty = false;
			}
			if (typeof $scope.users.currentUser["passwordCheck"] == "undefined" || $scope.users.currentUser["passwordCheck"] == "") {
				this.validationErrors.push({ message:"The password-retype field is empty.", field:"userPasswordCheck" });
				isPasswordNonEmpty = false;
			}
			// check that passwords match (only if passwords have been filled in)
			if (isPasswordNonEmpty && $scope.users.currentUser["password"] != $scope.users.currentUser["passwordCheck"]) {
				this.validationErrors.push({ message:"Passwords don't match.", field:"userPasswordCheck" });
			}
		}
		
		if (this.validationErrors.length == 0) {
			$modalInstance.close();
		}
	};
	
	this.cancel = function() {
		$modalInstance.dismiss();
	};
}]);

angular.module("insightal.users")
	.controller("RemoveUserModalCtrl", [
		"$scope", "$modalInstance", function(
		 $scope,   $modalInstance) {
	this.save = function() {
		$modalInstance.close();
	};
	
	this.cancel = function() {
		$modalInstance.dismiss();
	};
}]);

angular.module("insightal.users")
	.controller("TenantDataCtrl", [
		"$scope", "$modal", "$q", "Group", "Application", "Collection", "Sensor", "Plugin", "Facet", "Auth", "UiMessage", "TreeUtils", "Utils", function(
		 $scope,   $modal,   $q,   Group,   Application,   Collection,   Sensor,   Plugin,   Facet,   Auth,   UiMessage,   TreeUtils,   Utils) {

	this.nodes   = [];
	this.plugins = [];
	this.docTree = [];
	this.facets  = {};
	// TODO change level numbers to 11 = group, 21 = app., 31 = coll., 41 = document, 42 = sensor ...
	this.levels  = ["", "group", "application", "collection", "document", "field"];
	this.selectedNode = null;
	this.selectedNodeAncestors = [{id:"#", text:"My Data", typeCode:0}];
	this.selectedNodeItems   = [];
	this.selectedNodePlugins = [];
	this.selectedNodeFacets  = [];
	this.selectedLevelName   = "Group";
	this.selectedParentName  = "My Data";
	
	this.openNode = function(nodeId) {
		this.loadNodeItems(
			nodeId,
			angular.bind(this, function(result) {
				this.navigateToNode(nodeId);
			})
		);
	};
	
	this.navigateToNode = function(nodeId) {
		this.selectedNodeItems = angular.copy( TreeUtils.getNodesByParentId(nodeId, this.nodes) );
		this.selectedNodeAncestors = TreeUtils.getNodeAncestorsAndSelf(nodeId, this.nodes);
	};
	
	this.nodeDblClick = function(node) {
		if (node["level"] < 5)
			this.openNode( node["id"] );
	};
	
	this.getLevelName = function(level) {
		if ( angular.isString( this.levels[level] ) )
			return this.levels[level];
		else
			return "";
	};
	
	this.loadNodeItems = function(nodeId, successCB, noCache) {
		var node = TreeUtils.getNodeById(nodeId, this.nodes),
			nodeChildren = TreeUtils.getNodesByParentId(nodeId, this.nodes);
		
		if ( angular.isUndefined(noCache) || noCache != true )
			noCache = false;
		
		if ( nodeId != "#" && (node == null || node["typeCode"] > 1) )
			return;
		
		// the following block creates "Home" directory as an only child of root "#" directory
		if (nodeId == "#") {
			var newNodes = [{
				id: "##",
				text: "My Data",
				source: {},
				parent: "#",
				typeCode: 0,
				children: true,
				level: 0
			}];
			this.nodes = newNodes;
			if ( angular.isFunction( successCB ) ) {
				successCB(newNodes);
			}
			return;
		}
		
		if ( !noCache && nodeChildren.length > 0 ) {
			// get data from cache
			if ( angular.isFunction( successCB ) ) {
				successCB( angular.copy( nodeChildren ) );
			}
			
			// in case of level "document", list all facets
			if (node["level"] == 4) {
				this.listFacets(node)
				.then(angular.bind(this, function(result) {
					this.selectNodeFacets( node["id"] );
				}));
			}
		}
		else { // get data from server
			// remove any existing data first
			this.nodes = TreeUtils.deleteNodesByParentId(nodeId, this.nodes);
			
			var path = TreeUtils.getNodePath(nodeId, this.nodes).replace(/##/g, Auth.user["tenantId"]);
			
			var errorHandler = angular.bind(this, function(result) {
				console.error("list node error!");
				console.debug(result);
			});
			
			if (node["level"] == 0) { // ROOT
				var getter = function(data, idx, field) {
					if (idx < data["groups"].length) {
						if (field == "source")
							return data["groups"][idx];
						else if (field == "text")
							return data["groups"][idx][1];
						else
							return data["groups"][idx][0];
					}
					else
						return undefined;
				};
				Group.getAll({ tenantId:Auth.user["tenantId"] })
				.then( angular.bind(this, this.getNodeChildrenSuccessFn(node, getter, successCB)) )
				.catch(errorHandler);
			}
			else if (node["level"] == 1) { // GROUP
				var getter = function(data, idx, field) {
					if (idx < data["applications"].length) {
						if (field == "source")
							return data["applications"][idx];
						else if (field == "text")
							return data["applications"][idx][1];
						else
							return data["applications"][idx][0];
					}
					else
						return undefined;
				};
				Application.getAppsByGroup({ groupId:nodeId })
				.then( angular.bind(this, this.getNodeChildrenSuccessFn(node, getter, successCB)) )
				.catch(errorHandler);
			}
			else if (node["level"] == 2) { // APPLICATION
				var getter = function(data, idx, field) {
					if (idx < data["collections"].length) {
						if (field == "source")
							return data["collections"][idx];
						else if (field == "text")
							return data["collections"][idx][1];
						else
							return data["collections"][idx][0];
					}
					else
						return undefined;
				};
				Collection.getCollectionsByApp({ applicationId:nodeId })
				.then( angular.bind(this, this.getNodeChildrenSuccessFn(node, getter, successCB)) )
				.catch(errorHandler);
			}
			else if (node["level"] == 3) { // COLLECTION
				var getterDocs = (function(collectionId) { 
					return function(data, idx, field) {
						var docList = Object.keys(data[collectionId]["documents"]);
						if (idx < docList.length)
							return docList[idx];
						else
							return undefined;
					};
				})( node["id"] );
				
				var getterSensors = function(data, idx, field) {
					if (idx < data.length) {
						if (field == "source")
							return data[idx];
						else if (field == "text")
							return data[idx]["sensorName"];
						else
							return data[idx]["id"];
					}
					else
						return undefined;
				};
				
				var dfdDocs = $q.defer(),
					dfdSensors = $q.defer(),
					successHandlerDocs	  = angular.bind(this, this.getNodeChildrenSuccessFn(node, getterDocs)),
					successHandlerSensors = angular.bind(this, this.getNodeChildrenSuccessFn(node, getterSensors)),
					successHandlerFields  = angular.bind(this, this.saveDocumentFieldsFn(node["id"]));
				
				Application.getApplicationFields({ applicationId:node["parent"] }) // this API returns docs and their fields in one shot
				.then(angular.bind(this, function(result) {
					var newNodesDocs = successHandlerDocs(result);
					dfdDocs.resolve( newNodesDocs );
					successHandlerFields(result);
				}))
				.catch(function(result) {
					console.error("getApplicationsFields failed.");
					console.debug(result);
					dfdDocs.resolve([]);
				});
				
				Sensor.list({ collectionId:node["id"] })
				.then(angular.bind(this, function(result) {
					var newNodesSensors = successHandlerSensors(result);
					dfdSensors.resolve( newNodesSensors );
				}))
				.catch(function(result) {
					console.error("Listing sensors failed.");
					console.debug(result);
					dfdSensors.resolve([]);
				});
				
				$q.all({docs:dfdDocs.promise, sensors:dfdSensors.promise})
				.then(angular.bind(this, function(result) {
					successCB( result["docs"].concat( result["sensors"] ) );
				}))
				.catch(errorHandler);
			}
			else if (node["level"] == 4) { // DOCUMENT / SENSOR
//				// beware that all cached nodes are already deleted here!
//				// the doc fields are already retrieved from server together with docs, so just get the fields from "cache"
//				if ( angular.isFunction( successCB ) ) {
//					var nodeChildren = TreeUtils.getNodesByParentId(nodeId, this.nodes);
//					successCB( angular.copy( nodeChildren ) );
//				}
			}
		}
	};
	
	this.getNodeChildrenSuccessFn = function(parent, getter, successCB) {
		return function(result) {
			var nodeTypeCode = 0, // 0 = directory, 1 = file, 2 = file contents (field)
				idx = 0,
				newNodes = [];
			if (parent["level"] == 3)
				nodeTypeCode = 1; // document
			if (parent["level"] == 4)
				nodeTypeCode = 2; // document field
			
			while ( angular.isDefined( getter(result.data, idx, "id") ) ) {
				var source = getter(result.data, idx, "source");
				newNodes.push({
					id:			getter(result.data, idx, "id"),
					text:		getter(result.data, idx, "text"),
					source:		source,
					parent:		parent["id"],
					children:	(parent["level"] < 5) && !(angular.isObject(source) && angular.isString(source["sensorName"])),
					level:		parent["level"] + 1,
					typeCode:	nodeTypeCode
				});
				idx++;
			}
			this.nodes = this.nodes.concat( newNodes );
			if ( angular.isFunction( successCB ) ) {
				successCB(newNodes);
			}
			return newNodes;
		};
	};
	
	// this function is used for saving "field" nodes of a "document" node after request to API /getApplicationFields,
	// because this API fn returns all documents+fields for all collections in a given application
	this.saveDocumentFieldsFn = function(collectionId) {
		return function(result) { // result = {data:string|Object, headers:function, config:Object, status:number, statusText:string}
			var colDocuments = result.data[collectionId],
				docList = Object.keys(result.data[collectionId]["documents"]),
				newNodes = [];
			if ( !angular.isObject( colDocuments ) || !angular.isObject( colDocuments["documents"] ) )
				return;
			
			for (var i=0; i<docList.length; i++) {
				var docName = docList[i],
					fields = result.data[collectionId]["documents"][docName]["fields"],
					fieldList = [];
				if ( !angular.isObject( fields) ) {
					continue;
				}
				fieldList = Object.keys(fields);
				for (var j=0; j<fieldList.length; j++) {
					newNodes.push({
						id:			docName + "__" + fieldList[j],
						text:		fieldList[j],
						parent:		docName,
						children:	false,
						level:		5,
						typeCode:	2,
						fieldData:	angular.copy( result.data[collectionId]["documents"][docName]["fields"][ fieldList[j] ] )
					});
				}
			}
			
			this.nodes = this.nodes.concat( newNodes );
		};
	};
	
	this.createGroup = angular.bind(this, function(node) {
		if ( angular.isObject( node["original"] ) )
			node = node["original"];
		return this.modifyGroup(node, "Create");
	});
	
	this.updateGroup = angular.bind(this, function(node) {
		if ( angular.isObject( node["original"] ) )
			node = node["original"];
		return this.modifyGroup(node, "Edit");
	});
	
	this.modifyGroup = function(node, action) {
		var modalInstance = $modal.open({
			templateUrl: "partials/tenantAdmin/editGroupModal.html",
			controller: "EditGroupModalCtrl as modal",
			scope: $scope,
			resolve: {
				modalData: function() {
					return {
						node:	node, // this is the parent for "Create" and self for "Edit"! (different levels)
						action:	action
					};
				}
			}
		});
		
		modalInstance.result.then( angular.bind(this, function(groupConfig) {
			if (action === "Edit") {
				// groupConfig["node"] is the node itself
				UiMessage.add("info", "This feature is not implemented yet. Group '" + groupConfig["node"]["text"] + "' was not updated.");
			}
			else {
				// groupConfig["node"] is the parent node of the new node
				Group.add({
					group: {
						name:		groupConfig["name"],
						tenantId:	Auth.user["tenantId"]
					}
				})
		        .then(angular.bind(this, function(result) { // result = {data:string|Object, headers:function, config:Object, status:number, statusText:string}
	            	UiMessage.add("success", "Group \"" + groupConfig["name"] + "\" created successfully.");
	            	this.treeNodesToLoad = [ groupConfig["node"]["id"] ];
	            }))
		        .catch(angular.bind(this, function(result) {
	            	UiMessage.add("danger", "Failed to create group \"" + groupConfig["name"] + "\".");
	            }));
			}
		}));
		
		return false;
	};
	
	this.deleteGroup = angular.bind(this, function(node) {
		var modalInstance = $modal.open({
    		templateUrl: "partials/tenantAdmin/removeGroupModal.html",
    		controller: "RemoveGroupModalCtrl as modal",
    		scope: $scope,
			resolve: {
				modalData: function() {
					return {
						node: node
					};
				}
			}
    	});

		modalInstance.result.then( angular.bind(this, function(groupConfig) {
			Group.delete({ groupGuid:groupConfig["node"]["id"] })
			.then(angular.bind(this, function(result) {
				UiMessage.add("success", "Group " + groupConfig["groupName"] + " has been deleted.");
				this.treeNodesToLoad = [ groupConfig["node"]["parent"] ];
			}))
			.catch(angular.bind(this, function(result) {
				UiMessage.add("danger", "An error occured when deleting group " + groupConfig["groupName"] + ".");
			}));
		}));
		
		return false;
	});
	
	this.createApplication = angular.bind(this, function(node) {
		if ( angular.isObject( node["original"] ) )
			node = node["original"];
		return this.modifyApplication(node, "Create");
	});
	
	this.updateApplication = angular.bind(this, function(node) {
		if ( angular.isObject( node["original"] ) )
			node = node["original"];
		return this.modifyApplication(node, "Edit");
	});
	
	this.modifyApplication = function(node, action) {
		var modalInstance = $modal.open({
			templateUrl: "partials/tenantAdmin/editApplicationModal.html",
			controller: "EditApplicationModalCtrl as modal",
			scope: $scope,
			resolve: {
				modalData: function() {
					return {
						node:	node, // this is the parent for "Create" and self for "Edit"! (different levels)
						action:	action
					};
				}
			}
		});
		
		modalInstance.result.then( angular.bind(this, function(appConfig) {
			if (action === "Edit") {
				// appConfig["node"] is the node itself
				UiMessage.add("info", "This feature is not implemented yet. Application '" + appConfig["node"]["text"] + "' was not updated.");
			}
			else {
				// appConfig["node"] is the parent node of the new node
				Application.add({
					application: {
						name:		appConfig["name"],
						groupId:	appConfig["node"]["id"]
					}
				})
		        .then(angular.bind(this, function(result) { // result = {data:string|Object, headers:function, config:Object, status:number, statusText:string}
	            	UiMessage.add("success", "Application \"" + appConfig["name"] + "\" created successfully.");
	            	this.treeNodesToLoad = [ appConfig["node"]["id"] ];
	            	this.treeNodesToOpen = [ appConfig["node"]["id"] ];
	            }))
		        .catch(angular.bind(this, function(result) {
	            	UiMessage.add("danger", "Failed to create application \"" + appConfig["name"] + "\".");
	            }));
			}
		}));
		
		return false;
	};
	
	this.deleteApplication = angular.bind(this, function(node) {
		var modalInstance = $modal.open({
    		templateUrl: "partials/tenantAdmin/removeApplicationModal.html",
    		controller: "RemoveApplicationModalCtrl as modal",
    		scope: $scope,
			resolve: {
				modalData: function() {
					return {
						node: node
					};
				}
			}
    	});

		modalInstance.result.then( angular.bind(this, function(appConfig) {
			Application.delete({ appGuid:appConfig["node"]["id"] })
			.then(angular.bind(this, function(result) {
				UiMessage.add("success", "Application " + appConfig["appName"] + " has been deleted.");
				this.treeNodesToLoad = [ appConfig["node"]["parent"] ];
            	this.treeNodesToOpen = [ appConfig["node"]["parent"] ];
			}))
			.catch(angular.bind(this, function(result) {
				UiMessage.add("danger", "An error occured when deleting application " + appConfig["appName"] + ".");
			}));
		}));
		
		return false;
	});
	
	this.createCollection = angular.bind(this, function(node) {
		if ( angular.isObject( node["original"] ) )
			node = node["original"];
		return this.modifyCollection(node, "Create");
	});
	
	this.updateCollection = angular.bind(this, function(node) {
		if ( angular.isObject( node["original"] ) )
			node = node["original"];
		return this.modifyCollection(node, "Edit");
	});
	
	this.modifyCollection = function(node, action) {
		var modalInstance = $modal.open({
			templateUrl: "partials/tenantAdmin/editCollectionModal.html",
			controller: "EditCollectionModalCtrl as modal",
			scope: $scope,
			resolve: {
				modalData: function() {
					return {
						node:	node, // this is the parent for "Create" and self for "Edit"! (different levels)
						action:	action
					};
				}
			}
		});
		
		modalInstance.result.then( angular.bind(this, function(colConfig) {
			if (action === "Edit") {
				// colConfig["node"] is the node itself
				UiMessage.add("info", "This feature is not implemented yet. Collection '" + colConfig["node"]["text"] + "' was not updated.");
			}
			else {
				// colConfig["node"] is the parent node of the new node
				Collection.add({
					collection: {
						name:		colConfig["name"],
						applicationId:	colConfig["node"]["id"]
					}
				})
		        .then(angular.bind(this, function(result) { // result = {data:string|Object, headers:function, config:Object, status:number, statusText:string}
	            	UiMessage.add("success", "Collection \"" + colConfig["name"] + "\" created successfully.");
	            	this.treeNodesToLoad = [ colConfig["node"]["id"] ];
	            	this.treeNodesToOpen = [ colConfig["node"]["id"] ];
	            }))
		        .catch(angular.bind(this, function(result) {
	            	UiMessage.add("danger", "Failed to create collection \"" + colConfig["name"] + "\".");
	            }));
			}
		}));
		
		return false;
	};
	
	this.deleteCollection = angular.bind(this, function(node) {
		var modalInstance = $modal.open({
    		templateUrl: "partials/tenantAdmin/removeCollectionModal.html",
    		controller: "RemoveCollectionModalCtrl as modal",
    		scope: $scope,
			resolve: {
				modalData: function() {
					return {
						node: node
					};
				}
			}
    	});

		modalInstance.result.then( angular.bind(this, function(colConfig) {
			Collection.delete({ colGuid:colConfig["node"]["id"] })
			.then(angular.bind(this, function(result) {
				UiMessage.add("success", "Collection " + colConfig["colName"] + " has been deleted.");
				this.treeNodesToLoad = [ colConfig["node"]["parent"] ];
            	this.treeNodesToOpen = [ colConfig["node"]["parent"] ];
			}))
			.catch(angular.bind(this, function(result) {
				UiMessage.add("danger", "An error occured when deleting collection " + colConfig["colName"] + ".");
			}));
		}));
		
		return false;
	});
	
	this.createSensor = angular.bind(this, function(node) {
		if ( angular.isObject( node["original"] ) )
			node = node["original"];
		return this.modifySensor(node, "Create");
	});
	
	this.updateSensor = angular.bind(this, function(node) {
		if ( angular.isObject( node["original"] ) )
			node = node["original"];
		return this.modifySensor(node, "Edit");
	});
	
	this.modifySensor = function(node, action) {
		var modalInstance = $modal.open({
			templateUrl: "partials/tenantAdmin/editSensorModal.html",
			controller: "EditSensorModalCtrl as modal",
			scope: $scope,
			resolve: {
				modalData: function() {
					return {
						node:	node, // this is the parent for "Create" and self for "Edit"! (different levels)
						action:	action
					};
				}
			}
		});
		
		modalInstance.result.then( angular.bind(this, function(sensorConfig) {
			if (action === "Edit") {
				// sensorConfig["node"] is the node itself
				UiMessage.add("info", "This feature is not implemented yet. Sensor '" + sensorConfig["node"]["text"] + "' was not updated.");
			}
			else {
				// sensorConfig["node"] is the parent node of the new node
				Sensor.add({
					collectionId:	sensorConfig["node"]["id"],
					name:			sensorConfig["name"],
					description:	sensorConfig["description"],
					measurement:	sensorConfig["measurement"],
					measurementType:sensorConfig["measurementType"],
					unit:			sensorConfig["unit"]
				})
		        .then(angular.bind(this, function(result) { // result = {data:string|Object, headers:function, config:Object, status:number, statusText:string}
	            	UiMessage.add("success", "Sensor \"" + sensorConfig["name"] + "\" created successfully.");
	            	this.treeNodesToLoad = [ sensorConfig["node"]["id"] ];
	            	this.treeNodesToOpen = [ sensorConfig["node"]["id"] ];
	            }))
		        .catch(angular.bind(this, function(result) {
	            	UiMessage.add("danger", "Failed to create sensor \"" + sensorConfig["name"] + "\".");
	            }));
			}
		}));
		
		return false;
	};
	
	this.deleteSensor = angular.bind(this, function(node) {
		var modalInstance = $modal.open({
    		templateUrl: "partials/tenantAdmin/removeSensorModal.html",
    		controller: "RemoveSensorModalCtrl as modal",
    		scope: $scope,
			resolve: {
				modalData: function() {
					return {
						node: node
					};
				}
			}
    	});

		modalInstance.result.then( angular.bind(this, function(sensorConfig) {
			UiMessage.add("info", "This feature is not implemented yet. Sensor '" + sensorConfig["node"]["text"] + "' was not deleted.");
//			Sensor.delete({ sensorGuid:sensorConfig["node"]["id"] })
//			.then(angular.bind(this, function(result) {
//				UiMessage.add("success", "Sensor " + sensorConfig["sensorName"] + " has been deleted.");
//				this.treeNodesToLoad = [ sensorConfig["node"]["parent"] ];
//            	this.treeNodesToOpen = [ sensorConfig["node"]["parent"] ];
//			}))
//			.catch(angular.bind(this, function(result) {
//				UiMessage.add("danger", "An error occured when deleting sensor " + sensorConfig["sensorName"] + ".");
//			}));
		}));
		
		return false;
	});
	
	this.listDocs = function() {
		Group.getAll({ tenantId:Auth.user["tenantId"] })
		.then(angular.bind(this, function(result) {
			var groups = result.data["groups"],
				promises = [];
			this.docTree = [];
			for (var i=0; i<groups.length; i++) {
				this.docTree.push({
					guid:	groups[i][0],
					name:	groups[i][1],
					apps:	[]
				});
				promises.push(
					Application.getAppsByGroup({ groupId:groups[i][0] })
				);
			}
			return $q.all(promises);
		}))
		.then(angular.bind(this, function(resultList) {
			var dfdList = [],
				promises = [];
			for (var i=0; i<resultList.length; i++) {
				var apps = resultList[i].data["applications"],
					groupGuid = resultList[i].config["data"]["groupId"],
					groupIdx = Utils.getIndexByGuid(groupGuid, this.docTree);
				if (groupIdx >= 0) {
					dfdList[i] = [];
					this.docTree[groupIdx]["apps"] = [];
					for (var j=0; j<apps.length; j++) {
						this.docTree[groupIdx]["apps"].push({
							guid:	apps[j][0],
							name:	apps[j][1],
							cols:	[]
						});
						
						dfdList[i][j] = $q.defer();
						promises.push( dfdList[i][j].promise );
						
						(function(i, j, apps, groupGuid) {
							Application.getApplicationFields({ applicationId:apps[j][0] })
							.then(function(result) {
								result["groupGuid"] = groupGuid;
								result["appGuid"] = apps[j][0];
								dfdList[i][j].resolve(result);
							})
							.catch(function(result) {
								dfdList[i][j].reject(result);
							});
						})(i, j, apps, groupGuid);
					}
				}
			}
			return $q.all(promises);
		}))
		.then(angular.bind(this, function(resultList) {
			var groupGuid, groupIdx, appGuid, appIdx, colIdx;
			for (var i=0; i<resultList.length; i++) {
				groupGuid = resultList[i]["groupGuid"],
				appGuid   = resultList[i]["appGuid"],
				groupIdx  = Utils.getIndexByGuid(groupGuid, this.docTree),
				appIdx    = Utils.getIndexByGuid(appGuid,   this.docTree[groupIdx]["apps"]),
				colIdx    = 0;
				this.docTree[groupIdx]["apps"][appIdx]["cols"] = [];
				for (var colGuid in resultList[i].data) {
					this.docTree[groupIdx]["apps"][appIdx]["cols"][colIdx] = {
						guid: colGuid,
						docs: []
					};
					for (var docName in resultList[i].data[colGuid]["documents"]) {
						this.docTree[ groupIdx ]["apps"][ appIdx ]["cols"][ colIdx ]["docs"].push(docName);
					}
					colIdx++;
				}
			}
		}))
		.catch(angular.bind(this, function(result) {
			console.error(result);
		}));
	};
	
	// docs are stored in docTree variable
	// the following function returns docs that are contained in given group, app or collection
	this.getDocs = function(nodeId) {
		var element = null, tempObj = {},
			groups = [], apps = [], cols = [], docs = [],
			nodeFound = false;
		for (var i=0; i<this.docTree.length; i++) {
			if (this.docTree[i]["guid"] === nodeId) {
				groups = [ this.docTree[i] ];
				nodeFound = true;
				break;
			}
			groups.push( this.docTree[i] )
		}
		loop1: for (var i=0; i<groups.length; i++) {
			loop2: for (var j=0; j<groups[i].apps.length; j++) {
				if (groups[i].apps[j]["guid"] === nodeId) {
					apps = [ groups[i].apps[j] ];
					nodeFound = true;
					break loop1;
				}
			}
			apps = apps.concat( groups[i].apps );
		}
		loop1: for (var i=0; i<apps.length; i++) {
			loop2: for (var j=0; j<apps[i].cols.length; j++) {
				if (apps[i].cols[j]["guid"] === nodeId) {
					cols = [ apps[i].cols[j] ];
					nodeFound = true;
					break loop1;
				}
			}
			cols = cols.concat( apps[i].cols );
		}
		for (var i=0; i<cols.length; i++) {
			for (var j=0; j<cols[i].docs.length; j++) {
				tempObj[ cols[i].docs[j] ] = true; // this way we don't get duplicates
			}
		}
		if ( angular.isString(nodeId) && !nodeFound )
			return [];
		else
			return Object.keys( tempObj );
	};
	
	this.listPlugins = function() {
		var deferred = $q.defer();
		Plugin.list()
		.then(angular.bind(this, function(result) { // result = {data:string|Object, headers:function, config:Object, status:number, statusText:string}
			this.plugins = result.data["plugins"];
			deferred.resolve(result.data);
		}))
		.catch(angular.bind(this, function(result) { // result = {data:string|Object, headers:function, config:Object, status:number, statusText:string}
			UiMessage.add("danger", "Failed to list plugins.");
			deferred.reject(result.data);
		}));
		
		return deferred.promise;
	};
	
	this.getPluginsByNode = function(level, nodeId) {
		var plugins = [],
			guidKey = "";
		if (level == 1) // group
			guidKey = "groupIds";
		else if (level == 2) // application
			guidKey = "applicationIds";
		else if (level == 3) // collection
			guidKey = "collectionIds";
		else
			return [];
		
		for (var i=0; i<this.plugins.length; i++) {
			if ( this.plugins[i][ guidKey ].indexOf(nodeId) >= 0 ) {
				plugins.push( this.plugins[i] );
			}
		}
		return plugins;
	};
	
	this.openPluginModal = angular.bind(this, function(node) {
		if ( angular.isObject( node["original"] ) )
			node = node["original"];
		var docsForThisNode = this.getDocs(node["id"]);
		$modal.open({
			templateUrl: "partials/tenantAdmin/uploadPluginModal.html",
			controller: "UploadPluginModalCtrl as modal",
			scope: $scope,
			resolve: {
				modalData: function() {
					return {
						nodeId:		node["id"],
						nodeLevel:	node["level"],
						docList:	docsForThisNode
					};
				}
			}
		})
		.result.then( angular.bind(this, this.uploadPlugin) );
	});
	
	this.uploadPlugin = function(uploadConfig) {
		var serviceConfig = {
				name:		uploadConfig["name"],
				docTypes:	uploadConfig["docs"],
				file:		uploadConfig["file"]
			};
		
		if		(uploadConfig["nodeLevel"] == 1)
			serviceConfig["groupIds"]		= [ uploadConfig["nodeId"] ];
		else if (uploadConfig["nodeLevel"] == 2)
			serviceConfig["applicationIds"]	= [ uploadConfig["nodeId"] ];
		else if (uploadConfig["nodeLevel"] == 3)
			serviceConfig["collectionIds"]	= [ uploadConfig["nodeId"] ];
		
		Plugin.add(serviceConfig)
		.then(angular.bind(this, function(result) { // result = {data:string|Object, headers:function, config:Object, status:number, statusText:string}
			UiMessage.add("success", "Plugin '" + uploadConfig["name"] + "' uploaded successfully.");
			
			this.listPlugins()
			.then(angular.bind(this, function(result) {
				if (uploadConfig["nodeLevel"] >= 1 && uploadConfig["nodeLevel"] <= 3) {
					var nodeChildrenPlugins = {};
					for (var i=0; i<this.selectedNodeItems.length; i++) {
						var childId = this.selectedNodeItems[i]["id"];
						nodeChildrenPlugins[childId] = this.getPluginsByNode(uploadConfig["nodeLevel"], childId);
					}
				}
				this.selectedNodePlugins = nodeChildrenPlugins;
			}))
			.catch(angular.bind(this, function(result) {
				UiMessage.add("error", "Error while listing plugins.");
			}));
		}))
		.catch(angular.bind(this, function(result) {
			UiMessage.add("danger", "An error occured when uploading plugin '" + uploadConfig["name"] + "'.");
		}));
	};
	
	this.openDeletePluginModal = angular.bind(this, function(plugin) {
		$modal.open({
			templateUrl: "partials/tenantAdmin/removePluginModal.html",
			controller: "RemovePluginModalCtrl as modal",
			scope: $scope,
			resolve: {
				modalData: function() {
					return { plugin:plugin };
				}
			}
		})
		.result.then( angular.bind(this, function(plugin) {
			Plugin.delete({ pluginGuid:plugin["id"] })
			.then(angular.bind(this, function(result) {
				UiMessage.add("success", "Plugin " + plugin["name"] + " has been deleted.");
				this.listPlugins()
				.then(angular.bind(this, function(result) {
					this.refreshDataList();
				}))
				.catch(angular.bind(this, function(result) {
					UiMessage.add("error", "Error while listing plugins.");
				}));
			}))
			.catch(angular.bind(this, function(result) {
				UiMessage.add("danger", "An error occured when deleting plugin " + plugin["name"] + ".");
			}));
		}));
		return false;
	});
	
	this.listFacets = function(docNode) {
		var dfd = $q.defer();
		Facet.list({ docType:docNode["id"] })
		.then(angular.bind(this, function(result) {
			var facetList = result.data["facets"];
			this.facets[ docNode["id"] ] = {};
			for (var i=0; i<facetList.length; i++) {
				if ( !angular.isArray( this.facets[ docNode["id"] ][ facetList[i]["field"] ] ) )
					this.facets[ docNode["id"] ][ facetList[i]["field"] ] = [];
				this.facets[ docNode["id"] ][ facetList[i]["field"] ].push( facetList[i] );
			}
			dfd.resolve(result);
		}))
		.catch(angular.bind(this, function(result) {
			console.error("Error when listing facets.");
			console.error(result);
			dfd.reject(result);
		}));
		return dfd.promise;
	};
	
	// facets are stored in a "facets" object
	// the following function gets facets for a given document and field
	this.getFacets = function(doc, field) {
		if ( angular.isObject( this.facets[doc] ) ) {
			if ( angular.isString( field ) && angular.isArray( this.facets[doc][field] ) )
				return this.facets[doc][field];
			else
				return this.facets[doc];
		}
		return [];
		
	};
	
	this.selectNodeFacets = function(nodeId) {
		var facets = this.getFacets(nodeId),
			facetsFormatted = {};
		for (var key in facets) {
			facetsFormatted[ nodeId + "__"  + key] = facets[key];
		}
		this.selectedNodeFacets = facetsFormatted;
	}
	
	this.openFacetModal = angular.bind(this, function(node) {
		if ( angular.isObject( node["original"] ) )
			node = node["original"];
		$modal.open({
			templateUrl: "partials/tenantAdmin/createFacetModal.html",
			controller: "CreateFacetModalCtrl as modal",
			scope: $scope,
			resolve: {
				modalData: function() {
					return {node:node};
				}
			}
		})
		.result.then( angular.bind(this, this.createFacet) );
	});
	
	this.createFacet = function(facetConfig) {
		var node = facetConfig["node"];
		Facet.add({
			docType: 	node["parent"],
			fieldName:	node["text"],
			fieldType:	node["fieldData"]["type"],
			facetLabel:	facetConfig["facetLabel"]
		})
		.then(angular.bind(this, function(result) { // result = {data:string|Object, headers:function, config:Object, status:number, statusText:string}
			var docNode = TreeUtils.getNodeById(node["parent"], this.nodes);
			UiMessage.add("success", "Facet '" + facetConfig["facetLabel"] + "' on field '" + node["text"] + "' for document '" + node["parent"] + "' created successfully.");
			this.listFacets(docNode)
			.then(angular.bind(this, function(result) {
				this.selectNodeFacets( docNode["id"] );
			}));
		}))
		.catch(angular.bind(this, function(result) {
			var message = ( angular.isString(result.data["message"]) )? "---" : result.data["message"];
			UiMessage.add("danger", "Failed to create facet on field '" + node["text"] + "' for document '" + node["parent"] + "'.\nMessage: " + message);
		}));
	};
	
//	this.openDeleteFacetModal = angular.bind(this, function(node) {
//		$modal.open({
//			templateUrl: "partials/tenantAdmin/removeFacetModal.html",
//			controller: "CreateFacetModalCtrl as modal",
//			scope: $scope,
//			resolve: {
//				modalData: function() {
//					return {node:node};
//				}
//			}
//		})
//		.result.then( angular.bind(this, this.createFacet) );
//	});
	
	this.deleteFacet = function(facet) {
		console.debug("deleteFacet");
		console.debug(facet);
	};
			
	/* methods prefixed "tree" are used for purposes of the jsTree directive */
	
	this.treeNodesToLoad = [];
	this.treeNodesToOpen = [];
	
	this.treeRootLoaded = angular.bind(this, function() {
		this.treeNodesToOpen = ["##"];
		$scope.$apply();
	});
	
	this.treeActivateNodeCB = angular.bind(this, function(event, data) {
		if (data.node["state"]["loaded"] && data.node["children"].length > 0) {
			this.treeOpenNodeCB(event, data);
		}
	});
	
	this.treeOpenNodeCB = angular.bind(this, function(event, data) {
		var nodeId = data.node["id"],
			typeCode = data.node["original"]["typeCode"];
		if (typeCode < 2) {
			$scope.$broadcast("catalogJsTree.openNode", {nodeId:nodeId});
			$scope.$apply();
		}
	});
	
	this.treeGetNodeChildren = angular.bind(this, function(nodeToLoad, callback) {
		var nodeOriginal = ( angular.isObject(nodeToLoad["original"]) )? nodeToLoad["original"] : nodeToLoad,
			noCache = true;
		if ( angular.isDefined( nodeOriginal["level"] ) && nodeOriginal["level"] == 4 )
			noCache = false;
		
		this.loadNodeItems(nodeOriginal["id"], angular.bind(this, function(nodeChildrenData) {
			var newNodes = angular.copy( nodeChildrenData );
			for (var i=0; i<newNodes.length; i++) {
				var levelName = this.getLevelName( newNodes[i]["level"] );
				// TODO change level numbers to e.g. 41 = document, 42 = sensor ...
				if (newNodes[i]["level"] == 4 && angular.isDefined( newNodes[i]["source"]["sensorName"] ))
					levelName = "sensor";
				
				if (levelName.length > 0)
					newNodes[i]["text"] += " [" + levelName + "]"; 
				if ( newNodes[i]["typeCode"] == 1 ) {
					newNodes[i]["icon"] = "jstree-file";
				}
				else if ( newNodes[i]["typeCode"] == 2 ) {
					newNodes[i]["icon"] = "jstree-field";
				}
			}
			if (nodeToLoad["id"] === "#") // "#" represents jsTree root element
				$scope.$broadcast("catalogJsTree.openNode", {nodeId:"##"}); // "##" is ID of the "Home" directory in the view
			else if (newNodes.length == 0) // openNode doesn't happen automaticaly for empty directories
				$scope.$broadcast("catalogJsTree.openNode", {nodeId:nodeToLoad["id"]}); // "##" is ID of the "Home" directory in the view
			callback(newNodes);
		}), noCache); // the last argument set to false means that potentially cached results should not be used (always reload)
	});
	
	// the following array holds action items and context menu items of the rhs panel "data list"
	// it is generated automatically based on this.treeContextMenu (DRY)
	this.nodeActionsMenu = [];
	
	// defines items of context menu of the middle panel "data tree"
	this.treeContextMenu = {
		items: angular.bind(this, function(node, callback) { // we don't use the callback here, we return the menu-data
			var level = node.original["level"],
				sublevelName = this.getLevelName(level + 1),
				menuItems = {};
			sublevelName = sublevelName.charAt(0).toUpperCase() + sublevelName.substring(1);
			switch (level) {
				case 0: menuItems = {	// root level "MY DATA"
						createNode: 	{label:"Create " + sublevelName, action:this.createGroup},
					};
					break;
				case 1: menuItems = {	// GROUPS
						edit:			{label:"Edit",					action:this.updateGroup},
						delete:			{label:"Delete",				action:this.deleteGroup},
						createNode: 	{label:"Create " +sublevelName,	action:this.createApplication},
						uploadPlugin:	{label:"Upload Plugin",			action:this.openPluginModal}
					};
					break;
				case 2: menuItems = {	// APPLICATIONS
						edit:			{label:"Edit",					action:this.updateApplication},
						delete:			{label:"Delete",				action:this.deleteApplication},
						createNode: 	{label:"Create " +sublevelName,	action:this.createCollection},
						uploadPlugin:	{label:"Upload Plugin",			action:this.openPluginModal}
					};
					break;
				case 3: menuItems = {	// COLLECTIONS
						edit:			{label:"Edit",					action:this.updateCollection},
						delete:			{label:"Delete",				action:this.deleteCollection},
						createNode: 	{label:"Create Sensor",			action:this.createSensor},
						uploadPlugin:	{label:"Upload Plugin",			action:this.openPluginModal},
						copyGuid: 		{label:"Copy ID to Clipboard",	action:this.treeCreateNode}
					};
					break;
				case 4: menuItems = {};	// DOCUMENTS
					break;
				case 5: menuItems = {	// FIELDS
						addFacet: 		{label:"Add Facet",				action:this.openFacetModal}
					};
					break;
			}
			return menuItems;
		})
	};
	
	this.generateNodeActionsMenu = function() {
		var actions = [], actionsObj, actionsLevel;
		for (var i=0; i<this.levels.length; i++) {
			actionsObj = this.treeContextMenu.items({ original:{ level:i } });
			actionsLevel = [];
			for (var key in actionsObj) {
				actionsLevel.push({
					label:  actionsObj[key]["label"],
					action: actionsObj[key]["action"]
				});
			}
			actions.push(actionsLevel);
		}
		this.nodeActionsMenu = actions;
	};
	
	this.refreshDataList = function() {
		var levelName, parentName, childrenLevel,
			nodeChildrenPlugins = {};
		this.selectedNode = angular.copy( this.selectedNodeAncestors[ this.selectedNodeAncestors.length-1 ] );
		childrenLevel = this.selectedNode["level"] + 1;
		parentName = this.selectedNode["text"];
		levelName  = this.getLevelName(childrenLevel);
		if (levelName.length > 0)
			levelName = levelName.charAt(0).toUpperCase() + levelName.substring(1);
		this.selectedLevelName  = levelName;
		this.selectedParentName = parentName;
		
		if (childrenLevel >= 1 && childrenLevel <= 3) {
			for (var i=0; i<this.selectedNodeItems.length; i++) {
				var childId = this.selectedNodeItems[i]["id"];
				nodeChildrenPlugins[childId] = this.getPluginsByNode(childrenLevel, childId);
			}
		}
		this.selectedNodePlugins = nodeChildrenPlugins;
		
		if (childrenLevel == 5) {
			this.selectNodeFacets( this.selectedNode["id"] );
		}
	};
	
	$scope.$on("catalogJsTree.openNode", angular.bind(this, function(event, data) {
		this.navigateToNode( data["nodeId"] );
	}));
	
	$scope.$watch(
		angular.bind(this, function(scope) {
			return this.selectedNodeAncestors;
		}),
		angular.bind(this, function(newVal, oldVal) {
			this.refreshDataList();
		})
	);
	
	// init actions
	this.listPlugins();
	this.listDocs();
	this.generateNodeActionsMenu();

}]);

angular.module("insightal.users")
	.controller("EditGroupModalCtrl", [
		"$scope", "$modalInstance", "modalData", function(
		 $scope,   $modalInstance,   modalData) {
	this.node	= modalData["node"];
	this.action	= modalData["action"];
	this.groupName = (function(name, action) {
		if (action != "Edit")
			return "";
		if (name.indexOf(" [group]") == name.length - 8)
			return name.substr(0, name.length - 8);
		else
			return name;
	})(this.node["text"], this.action);
	this.validationErrors = [];
	
	this.isValid = function(fieldId) {
		for (var i=0; i<this.validationErrors.length; i++) {
			if (this.validationErrors[i]["field"] == fieldId)
				return false;
		}
		return true;
	};
	
	this.save = function(groupEditForm) {
		this.validationErrors = [];
		if ( !angular.isString( this.groupName ) || this.groupName.length == 0 ) {
			this.validationErrors.push({ message:"The name field is empty.", field:"groupName" });
		}
		
		if (this.validationErrors.length == 0) {
			$modalInstance.close({
				name:	this.groupName,
				node:	this.node,
				action:	this.action
			});
		}
	};
	
	this.cancel = function() {
		$modalInstance.dismiss();
	};
}]);

angular.module("insightal.users")
	.controller("RemoveGroupModalCtrl", [
		"$scope", "$modalInstance", "modalData", function(
		 $scope,   $modalInstance,   modalData) {
	this.node = modalData["node"];
	this.groupName = (function(name) {
		if (name.indexOf(" [group]") == name.length - 8)
			return name.substr(0, name.length - 8);
		else
			return name;
	})(this.node["text"]);
	
	this.save = function() {
		$modalInstance.close({
			node:		this.node,
			groupName:	this.groupName
		});
	};
	
	this.cancel = function() {
		$modalInstance.dismiss();
	};
}]);

angular.module("insightal.users")
	.controller("EditApplicationModalCtrl", [
		"$scope", "$modalInstance", "modalData", function(
		 $scope,   $modalInstance,   modalData) {
	this.node	= modalData["node"];
	this.action	= modalData["action"];
	this.appName = (function(name, action) {
		if (action != "Edit")
			return "";
		if (name.indexOf(" [application]") == name.length - 14)
			return name.substr(0, name.length - 14);
		else
			return name;
	})(this.node["text"], this.action);
	this.validationErrors = [];
	
	this.isValid = function(fieldId) {
		for (var i=0; i<this.validationErrors.length; i++) {
			if (this.validationErrors[i]["field"] == fieldId)
				return false;
		}
		return true;
	};
	
	this.save = function(appEditForm) {
		this.validationErrors = [];
		if ( !angular.isString( this.appName ) || this.appName.length == 0 ) {
			this.validationErrors.push({ message:"The name field is empty.", field:"appName" });
		}
		
		if (this.validationErrors.length == 0) {
			$modalInstance.close({
				name:	this.appName,
				node:	this.node,
				action:	this.action
			});
		}
	};
	
	this.cancel = function() {
		$modalInstance.dismiss();
	};
}]);

angular.module("insightal.users")
	.controller("RemoveApplicationModalCtrl", [
		"$scope", "$modalInstance", "modalData", function(
		 $scope,   $modalInstance,   modalData) {
	this.node = modalData["node"];
	this.appName = (function(name) {
		if (name.indexOf(" [application]") == name.length - 14)
			return name.substr(0, name.length - 14);
		else
			return name;
	})(this.node["text"]);
	
	this.save = function() {
		$modalInstance.close({
			node:		this.node,
			appName:	this.appName
		});
	};
	
	this.cancel = function() {
		$modalInstance.dismiss();
	};
}]);

angular.module("insightal.users")
	.controller("EditCollectionModalCtrl", [
		"$scope", "$modalInstance", "modalData", function(
		 $scope,   $modalInstance,   modalData) {
	this.node	= modalData["node"];
	this.action	= modalData["action"];
	this.colName = (function(name, action) {
		if (action != "Edit")
			return "";
		if (name.indexOf(" [collection]") == name.length - 13)
			return name.substr(0, name.length - 13);
		else
			return name;
	})(this.node["text"], this.action);
	this.validationErrors = [];
	
	this.isValid = function(fieldId) {
		for (var i=0; i<this.validationErrors.length; i++) {
			if (this.validationErrors[i]["field"] == fieldId)
				return false;
		}
		return true;
	};
	
	this.save = function(colEditForm) {
		this.validationErrors = [];
		if ( !angular.isString( this.colName ) || this.colName.length == 0 ) {
			this.validationErrors.push({ message:"The name field is empty.", field:"colName" });
		}
		
		if (this.validationErrors.length == 0) {
			$modalInstance.close({
				name:	this.colName,
				node:	this.node,
				action:	this.action
			});
		}
	};
	
	this.cancel = function() {
		$modalInstance.dismiss();
	};
}]);

angular.module("insightal.users")
	.controller("RemoveCollectionModalCtrl", [
		"$scope", "$modalInstance", "modalData", function(
		 $scope,   $modalInstance,   modalData) {
	this.node = modalData["node"];
	this.colName = (function(name) {
		if (name.indexOf(" [collection]") == name.length - 13)
			return name.substr(0, name.length - 13);
		else
			return name;
	})(this.node["text"]);
	
	this.save = function() {
		$modalInstance.close({
			node:		this.node,
			colName:	this.colName
		});
	};
	
	this.cancel = function() {
		$modalInstance.dismiss();
	};
}]);

angular.module("insightal.users")
	.controller("EditSensorModalCtrl", [
		"$scope", "$modalInstance", "modalData", function(
		 $scope,   $modalInstance,   modalData) {
	this.node	= modalData["node"];
	this.action	= modalData["action"];
	this.name = (function(name, action) {
		if (action != "Edit")
			return "";
		if (name.indexOf(" [sensor]") == name.length - 9)
			return name.substr(0, name.length - 9);
		else
			return name;
	})(this.node["text"], this.action);
	
	this.description		= this.node["description"];
	this.measurement 		= this.node["measurement"];
	this.measurementType	= this.node["measurementType"];
	this.unit				= this.node["unit"];
	this.validationErrors	= [];
	
	this.isValid = function(fieldId) {
		for (var i=0; i<this.validationErrors.length; i++) {
			if (this.validationErrors[i]["field"] == fieldId)
				return false;
		}
		return true;
	};
	
	this.save = function(sensorEditForm) {
		this.validationErrors = [];
		if ( !angular.isString( this.name ) || this.name.length == 0 ) {
			this.validationErrors.push({ message:"The name field is empty.", field:"name" });
		}
		
		if (this.validationErrors.length == 0) {
			$modalInstance.close({
				name:			this.name,
				description:	this.description,
				measurement:	this.measurement,
				measurementType:this.measurementType,
				unit:			this.unit,
				node:			this.node,
				action:			this.action
			});
		}
	};
	
	this.cancel = function() {
		$modalInstance.dismiss();
	};
}]);

angular.module("insightal.users")
	.controller("RemoveSensorModalCtrl", [
		"$scope", "$modalInstance", "modalData", function(
		 $scope,   $modalInstance,   modalData) {
	this.node = modalData["node"];
	this.sensorName = (function(name) {
		if (name.indexOf(" [sensor]") == name.length - 9)
			return name.substr(0, name.length - 9);
		else
			return name;
	})(this.node["text"]);
	
	this.save = function() {
		$modalInstance.close({
			node:		this.node,
			sensorName:	this.sensorName
		});
	};
	
	this.cancel = function() {
		$modalInstance.dismiss();
	};
}]);
	
angular.module("insightal.users")
	.controller("UploadPluginModalCtrl", [
		"$scope", "$modalInstance", "modalData", function(
		 $scope,   $modalInstance,   modalData) {
			
	this.nodeId		= modalData["nodeId"];
	this.nodeLevel	= modalData["nodeLevel"];
	this.documents	= modalData["docList"];
	
	this.pluginName = "";
	this.pluginApplyToDocs = []; // Array<String>
	this.pluginFile = null;
	
	this.validationErrors = [];
	
	this.toggleSelection = function(selectedElements, element) {
		var idx = selectedElements.indexOf(element);
		if (idx > -1)
			selectedElements.splice(idx, 1);
		else
			selectedElements.push(element);
	};
	
	this.isValid = function(fieldId) {
		for (var i=0; i<this.validationErrors.length; i++) {
			if (this.validationErrors[i]["field"] == fieldId)
				return false;
		}
		return true;
	};
	
	this.uploadPlugin = function(formData) {
		this.validationErrors = [];
		if ( !angular.isString( this.pluginName ) || this.pluginName.length == 0 ) {
			this.validationErrors.push({ message:"The plugin name is empty.", field:"pluginName" });
		}
		if ( !angular.isArray( this.pluginApplyToDocs ) || this.pluginApplyToDocs.length == 0 ) {
			this.validationErrors.push({ message:"Please, select at least one document type.", field:"pluginDoc" });
		}
		if ( angular.isUndefined( this.pluginFile ) || this.pluginFile == null ) {
			this.validationErrors.push({ message:"Please, select a plugin to upload.", field:"pluginFile" });
		}
		if (this.validationErrors.length == 0) {
			$modalInstance.close({
				name:		this.pluginName,
				file:		this.pluginFile,
				docs:		this.pluginApplyToDocs,
				nodeId:		this.nodeId,
				nodeLevel:	this.nodeLevel
			});
		}
	};
	
	this.cancel = function() {
		$modalInstance.dismiss();
	};
}]);

angular.module("insightal.users")
	.controller("RemovePluginModalCtrl", [
		"$scope", "$modalInstance", "modalData", function(
		 $scope,   $modalInstance,   modalData) {
	this.plugin = modalData["plugin"];
			
	this.save = function() {
		$modalInstance.close( this.plugin );
	};
	
	this.cancel = function() {
		$modalInstance.dismiss();
	};
}]);

angular.module("insightal.users")
	.controller("CreateFacetModalCtrl", [
		"$scope", "$modalInstance", "modalData", function(
		 $scope,   $modalInstance,   modalData) {
	this.node = modalData["node"];
	this.facetName = "";
	this.validationErrors = [];
	
	this.isValid = function(fieldId) {
		for (var i=0; i<this.validationErrors.length; i++) {
			if (this.validationErrors[i]["field"] == fieldId)
				return false;
		}
		return true;
	};
	
	this.createFacet = function(formData) {
		this.validationErrors = [];
		if ( !angular.isString( this.facetName ) || this.facetName.length == 0 ) {
			this.validationErrors.push({ message:"The facet name is empty.", field:"facetName" });
		}
		if (this.validationErrors.length == 0) {
			$modalInstance.close({
				node:		this.node,
				facetLabel:	this.facetName
			});
		}
	};
	
	this.cancel = function() {
		$modalInstance.dismiss();
	};
	
	// init (remove ' ["field"]')
	if (this.node["text"].indexOf(" [field]") == this.node["text"].length - 8) {
		this.node["text"] = this.node["text"].substr(0, name.length - 8);
	}
}]);