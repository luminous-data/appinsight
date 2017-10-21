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
	.factory("User", [
	    "$http", "$q", "Auth", function(
		 $http,   $q,   Auth) {

	var serviceRoot = routingConfig.serviceRoot,
		userRoles	= routingConfig.userRoles,
		data = {};
	
    return {
        getAll: function() {
        	var dfd = $q.defer();
        	$http({
            	url: serviceRoot[0] + "/user/list",
            	method: "POST",
            	headers: {"X-AUTH-HEADER": Auth.authToken["value"]},
            	data: {}
            })
            .then(function(result) { // result = {data:string|Object, headers:function, config:Object, status:number, statusText:string}
            	var users = result.data["users"],
            		usersResult = [];
            	if (result.data["status"] === "OK") {
            		for (var i=0; i<users.length; i++) {
            			var role;
            			if      (users[i][4] === userRoles["user"]["bitMask"])
        					role = angular.copy( userRoles["user"] );
        				else if (users[i][4] === userRoles["tenant"]["bitMask"])
        					role = angular.copy( userRoles["tenant"] );
        				else if (users[i][4] === userRoles["admin"]["bitMask"])
        					role = angular.copy( userRoles["admin"] );
            			else
            				role = angular.copy( userRoles["public"] );
            			
            			usersResult.push({
            				guid:		users[i][0],
            				name:		users[i][1],
            				email:		users[i][2],
            				tenantGuid:	users[i][3],
            				role:		role,
            				source:		users[i]
            			});
            		}
            		result.data = usersResult;
            		dfd.resolve(result);
            	}
            	else {
            		dfd.reject(result);
            	}
            })
            .catch(function(result) {
            	dfd.reject(result);
            });
        	return dfd.promise;
        },
        add: function(user) {
            return $http({
            	url: serviceRoot[0] + "/user/new",
            	method: "POST",
            	headers: {"X-AUTH-HEADER": Auth.authToken["value"]},
            	data: user
            });
        },
//        list: function(user, success, error) {
//            console.log(user);
//            $http({
//            	url: serviceRoot[0] + "/user/list",
//            	method: "POST",
//            	headers: {"X-AUTH-HEADER": Auth.authToken["value"]}
//            })
//            .success(function(res){
//                success(res);
//            })
//            .error(error);
//        },
        delete: function(userGuid) {
            return $http({
            	url: serviceRoot[0] + "/user/deleteById",
            	method: "POST",
            	headers: {"X-AUTH-HEADER": Auth.authToken["value"]},
            	data: {id: userGuid}
            });
        }
    };
}]);

angular.module("insightal.users")
    	.factory("Tenant", [
            "$http", "$q", "Auth", function(
    		 $http,   $q,   Auth) {
    
	var serviceRoot = routingConfig.serviceRoot,
    	data = {};

    return {
        add: function(tenant) {
        	return $http({
                url: serviceRoot[0] + "/tenant/new",
                method: "POST",
                headers: {"X-AUTH-HEADER": Auth.authToken["value"]},
                data: tenant
            });
        },
        addTenantWithUser: function(tenant) {
            return $http({
                url: serviceRoot[0] + "/tenant/newWithUser",
                method: "POST",
                headers: {"X-AUTH-HEADER": Auth.authToken["value"]},
                data: tenant
            });
        },
        list: function(tenant) {
            return $http({
                url: serviceRoot[0] + "/tenant/list",
                method: "POST",
                headers: {"X-AUTH-HEADER": Auth.authToken["value"]},
                data: tenant
            });
        },
        getAll: function(success, error) {
            var dfd = $q.defer();
        	$http({
                url: serviceRoot[0] + "/tenant/list",
                method: "POST",
                headers: {"X-AUTH-HEADER": Auth.authToken["value"]},
                data: {}
            })
            .then(function(result) { // result = {data:string|Object, headers:function, config:Object, status:number, statusText:string}
        		var tenants = result.data["tenants"],
        			tenantsResult = [];
        		for (var i=0; i<tenants.length; i++) {
        			tenantsResult.push({
        				guid:	tenants[i][0],
        				name:	tenants[i][1],
        				email:	tenants[i][2],
        				source: tenants[i]
        			});
        		}
        		result.data = tenantsResult;
        		dfd.resolve(result);
            })
            .catch(function(result) {
            	dfd.reject(result);
            });
        	return dfd.promise;
        },
        delete: function(tenantGuid, success, error) {
            return $http({
            	url: serviceRoot[0] + "/tenant/deleteById",
                method: "POST",
                headers: {"X-AUTH-HEADER": Auth.authToken["value"]},
                data: {id: tenantGuid}
            });
        }
    };
}]);

angular.module("insightal.users")
	.factory("Auth", [
	    "$http", "$q", "$cookieStore", "DBG", function(
		 $http,   $q,   $cookieStore,	DBG) {

	var serviceRoot		= routingConfig.serviceRoot,
    	accessLevels	= routingConfig.accessLevels,
        userRoles		= routingConfig.userRoles,
        currentUser		= $cookieStore.get("user") || { userId:"", username:"", role:userRoles.public, tenantId:"" },
    	authToken		= {value: null};

    var changeUser = function(user) {
    	console.debug("Changing user");
        angular.extend(currentUser, user);
        console.debug(currentUser);
    };
    
    var getRoleByBitMask = function(bitMask) {
    	for (var key in userRoles) {
    		if (userRoles[key].bitMask == bitMask)
    			return userRoles[key];
    	}
    	return null;
    };
    
    return {
        authorize: function(accessLevel, role) {
        	if (role === undefined)
                role = currentUser.role;
            return accessLevel.bitMask & role.bitMask;
        },
        isLoggedIn: function(user) {
            if (user === undefined)
                user = currentUser;
            return user.role.title == userRoles.user.title || user.role.title == userRoles.admin.title;
        },
        register: function(user, success, error) {
            $http.post(serviceRoot[0] + "/user/new", user).success(function(res) {
                changeUser(res);
                success();
            }).error(error);
        },
        login: function(user) {
            // BEGIN OFFLINE
        	if (DBG.isOffline) {
        		var dfd = $q.defer();
        		changeUser(  DBG["Auth"]["login"] );
        		dfd.resolve( DBG["Auth"]["login"] );
        		$cookieStore.put("user", currentUser);
        		$cookieStore.put("appInsightSessionId", "offline_session");
        		authToken.value = "offline_session";
        		return dfd.promise;
            }
        	// END OFFLINE
            else {
            	var dfd = $q.defer();
            	$http({
            		url: serviceRoot[0] + "/login",
            		method: "POST",
            		data: user
            	})
            	.then(function(result) { // result = {data:string|Object, headers:function, config:Object, status:number, statusText:string}
            		var userRole = result.data["role"],
            			receivedUserData = {
            				userId:		result.data["userId"],
            				username:	result.data["username"],
            				tenantId:	result.data["tenantIds"][0],
            				role:		userRoles.public
            			};
            		
            		if      (userRole === "user")
            			receivedUserData["role"] = userRoles.user;
            		else if (userRole === "tenant")
            			receivedUserData["role"] = userRoles.tenant;
            		else if (userRole === "admin")
            			receivedUserData["role"] = userRoles.admin;
            		
            		changeUser(receivedUserData);
            		$cookieStore.put("user", currentUser);
            		$cookieStore.put("appInsightSessionId", result.headers("X-Auth-Header").replace(/%22/g,""));
            		authToken.value = result.headers("X-Auth-Header");
            		dfd.resolve(currentUser);
            	})
            	.catch(function(result) {
            		dfd.reject(result);
            	});
            	return dfd.promise;
            }
        },
        logout: function() {
        	var dfd = $q.defer();
        	$http({
            	 url: serviceRoot[0] + "/logout",
                 method: "POST",
                 headers: {"X-AUTH-HEADER": authToken["value"]}
            })
            .then(function(result) {
            	changeUser({
                    username: "",
                    userId:   "",
                    tenantId: "",
                    role: userRoles.public
                });
                $cookieStore.remove("appInsightSessionId");
                $cookieStore.remove("user");
                dfd.resolve(result);
            })
            .catch(function(result) {
            	dfd.reject(result);
            });
        	return dfd.promise;
        },
        getRoleByBitmask:	getRoleByBitMask,
        accessLevels:		accessLevels,
        userRoles:			userRoles,
        user:				currentUser,
        authToken:			authToken
    };
}]);

angular.module("insightal.users")
    .factory("Group", [
	    "$http", "Auth", function(
		 $http,   Auth) {
	
	var serviceRoot = routingConfig.serviceRoot,
		data = {};
	
    return {
        add: function(config) {
        	return $http({
            	url: serviceRoot[0] + "/group/new",
                method: "POST",
                headers: {"X-AUTH-HEADER": Auth.authToken["value"]},
                data: config["group"]
            });
        },
        getAll: function(config) {
        	var params = {};
        	if ( angular.isString( config["tenantId"] ) )
        		params["tenantId"] = config["tenantId"];
            
            return $http({
                url: serviceRoot[0] + "/group/list",
                method: "POST",
                headers: {"X-AUTH-HEADER": Auth.authToken["value"]},
                data: params
            });
        },
        delete: function(config) {
        	return $http({
            	url: serviceRoot[0] + "/group/deleteById",
                method: "POST",
                headers: {"X-AUTH-HEADER": Auth.authToken["value"]},
                data: {id:config["groupGuid"]}
            });
        }
    };
}]);

angular.module("insightal.users")
	.factory("Application",	[
	    "$http", "$q", "Auth", function(
		 $http,   $q,   Auth) {
	
	var serviceRoot = routingConfig.serviceRoot,
    	data = {};
	
    return {
        add: function(config) {
            return $http({
                url: serviceRoot[0] + "/application/new",
                method: "POST",
                headers: {"X-AUTH-HEADER": Auth.authToken["value"]},
                data: config["application"]
            });
        },
        getAppsByGroup: function(config) {
            var params = {};
        	if ( angular.isString( config["groupId"] ) )
        		params["groupId"] = config["groupId"];
            
            return $http({
                url: serviceRoot[0] + "/application/list",
                method: "POST",
                data: params,
                headers: {"X-AUTH-HEADER": Auth.authToken["value"]}
            });
        },
        delete: function(config) {
        	return $http({
            	url: serviceRoot[0] + "/application/deleteById",
                method: "POST",
                headers: {"X-AUTH-HEADER": Auth.authToken["value"]},
                data: {id:config["appGuid"]}
            });
        },
        getApplicationFields: function(config) {
        	var dfd = $q.defer();
        	var formatData = function(data) {
        		var formatted = {};
        		
        		for (var j=0; j<data.length; j++) {
        			var index = data[j],
        			colGuid = index["collectionId"];
        			if (typeof formatted[ index["collectionId"] ] === "undefined") {
        				formatted[ colGuid ] = {
        						name: index["collectionName"],
        						documents: {}
        				}
        			}
        			for (var docGuid in index["result"]) {
        				for (var docName in index["result"][ docGuid ]["mappings"]) {
        					var doc = index["result"][ docGuid ]["mappings"][ docName ];
        					formatted[ colGuid ]["documents"][ docName ] = {};
        					if (typeof doc["properties"]["@fields"] === "undefined") {
        						formatted[ colGuid ]["documents"][ docName ]["fields"] = angular.copy( doc["properties"] );
        						for (var field in doc["properties"]) {
        							if (doc["properties"][field]["type"] == "long")
        								formatted[ colGuid ]["documents"][ docName ]["fields"][ field ]["attributes"] = ["min", "max", "average"];
        							else
        								formatted[ colGuid ]["documents"][ docName ]["fields"][ field ]["attributes"] = ["count"];
        						}
        					}
        					else {
        						formatted[ colGuid ]["documents"][ docName ]["fields"] = angular.copy( doc["properties"]["@fields"]["properties"] );
        						for (var field in doc["properties"]["@fields"]["properties"]) {
        							if (doc["properties"]["@fields"]["properties"][field]["type"] == "long")
        								formatted[ colGuid ]["documents"][ docName ]["fields"][ field ]["attributes"] = ["min", "max", "average"];
        							else
        								formatted[ colGuid ]["documents"][ docName ]["fields"][ field ]["attributes"] = ["count"];
        						}
        					}
        				}
        			}
        		}
        		return formatted;
        	};
        	
        	$http({
        		url: serviceRoot[0] + "/getApplicationFields",
        		method: "POST",
        		data: {applicationId: config["applicationId"]},
        		headers: {"X-AUTH-HEADER": Auth.authToken["value"]}
        	})
    		.then(function(result) { // result = {data:string|Object, headers:function, config:Object, status:number, statusText:string}
        		result.data = formatData( result.data["result"] );
        		dfd.resolve(result);
            })
            .catch(function(result) {
            	dfd.reject(result);
            });
        	
        	return dfd.promise;
        }
    };
}]);

angular.module("insightal.users")
	.factory("Collection", [
	    "$http", "Auth", function(
		 $http,   Auth) {

	var serviceRoot = routingConfig.serviceRoot,
    	data = {};
    
    return {
        add: function(config) {
        	return $http({
                url: serviceRoot[0] + "/collection/new",
                method: "POST",
                headers: {"X-AUTH-HEADER": Auth.authToken["value"]},
                data: config["collection"]
            });
        },
        getCollectionsByApp: function(config) {
        	var params = {};
        	if ( angular.isString( config["applicationId"] ) )
        		params["applicationId"] = config["applicationId"];
            
            return $http({
                url: serviceRoot[0] + "/collection/list",
                method: "POST",
                data: params,
                headers: {"X-AUTH-HEADER": Auth.authToken["value"]}
            });
        },
        delete: function(config) {
        	return $http({
            	url: serviceRoot[0] + "/collection/deleteById",
                method: "POST",
                headers: {"X-AUTH-HEADER": Auth.authToken["value"]},
                data: {id:config["colGuid"]}
            });
        }
    };
}]);

angular.module("insightal.users")
	.factory("Plugin", [
	    "$http", "Auth", "Utils", function(
		 $http,   Auth,   Utils) {

	var serviceRoot = routingConfig.serviceRoot,
		data = {};
	
	return {
	    add: function(config) {
	    	var formData = new FormData(),
	    		jsonBlob,
	    		requestParams = {
	    			name: config["name"], // required
	    			docTypes: config["docTypes"] // required
	    		};
	    	if ( angular.isArray( config["collectionIds"] ) )
	    		requestParams["collectionIds"] = config["collectionIds"]; // optional
	    	if ( angular.isArray( config["applicationIds"] ) )
	    		requestParams["applicationIds"] = config["applicationIds"]; // optional
	    	if ( angular.isArray( config["groupIds"] ) )
	    		requestParams["groupIds"] = config["groupIds"]; // optional
	    	if ( angular.isArray( config["tenantIds"] ) )
	    		requestParams["tenantIds"] = config["tenantIds"]; // optional
	    	
	    	jsonBlob = new Blob( [ Utils.stringifyJSON(requestParams) ], {type:"application/json"} );
	    	formData.append( "plugin", config["file"] );
	    	formData.append( "json", jsonBlob );
	    	
	    	return $http({
	            url: serviceRoot[0] + "/plugin/new",
	            method: "POST",
	            headers: {
	            	"X-AUTH-HEADER": Auth.authToken["value"],
	            	"Content-Type": undefined
	            },
	            transformRequest: angular.identity,
	            data: formData
	        });
	    },
	    list: function(config) {
	        return $http({
	            url: serviceRoot[0] + "/plugin/list",
	            method: "POST",
	            headers: {"X-AUTH-HEADER": Auth.authToken["value"]}
	        });
	    },
	    delete: function(config) {
	    	return $http({
	        	url: serviceRoot[0] + "/plugin/deleteById",
	            method: "POST",
	            headers: {"X-AUTH-HEADER": Auth.authToken["value"]},
	            data: {id:config["pluginGuid"]}
	        });
	    }
	};
}]);

angular.module("insightal.users")
	.factory("Facet", [
	    "$http", "$q", "Auth", "Utils", function(
		 $http,   $q,   Auth,   Utils) {
	
	var serviceRoot = routingConfig.serviceRoot,
		data = {};
	
	return {
	    add: function(config) {
	    	var requestParams,
	    		aggregationType,
	    		facetName;
	    	
	    	if (config["fieldType"] == "date") {
	    		aggregationType = "range";
	    		facetName = config["docType"] + "_" + config["fieldName"] + "_date_range_agg"; // by convention;
	    	}
	    	else {
	    		aggregationType = "terms";
	    		facetName = config["docType"] + "_" + config["fieldName"] + "_agg"; // by convention;
	    	}
	    	
	    	requestParams = { // required params:
    			docType: config["docType"],
    			expr: [{
    				name:	facetName,
    				field:	config["fieldName"],
    				type:	aggregationType,
    				display_label:	config["facetLabel"]
    			}]
    		};
	    	if ( angular.isString( config["tenantGuid"] ) ) {
	    		// optional, can also have value "all" (for values that are to be used for all tenants in addition to ones defined for each tenant)
	    		// or "default" (for items that are used to initialize new tenants)
	    		// if omitted, tenantGuid of user's tenant is used
	    		requestParams["tenantId"] = config["tenantGuid"];
	    	}
	    	
	    	return $http({
	    		url: serviceRoot[0] + "/aggregationCriteria/set",
                method: "POST",
                headers: {"X-AUTH-HEADER": Auth.authToken["value"]},
                data: requestParams
	        });
	    },
	    list: function(config) {
	    	var dfd = $q.defer(),
	    		requestParams = { // required params:
	    			docType: config["docType"]
				};
	    	if ( angular.isString( config["tenantGuid"] ) ) {
	    		// optional, can also have value "all" (for values that are to be used for all tenants in addition to ones defined for each tenant)
	    		// or "default" (for items that are used to initialize new tenants)
	    		// if omitted, tenantGuid of user's tenant is used
	    		requestParams["tenantId"] = config["tenantGuid"];
	    	}
	    	
	        $http({
	            url: serviceRoot[0] + "/aggregationCriteria/list",
	            method: "POST",
	            headers: {"X-AUTH-HEADER": Auth.authToken["value"]},
	            data: requestParams
	        })
	        .then(function(result) { // result = {data:string|Object, headers:function, config:Object, status:number, statusText:string}
	        	if (result.data["status"] === "OK") {
	        		result.data = {
        				status: result.data["status"],
        				facets: angular.isArray(result.data["expr"])? result.data["expr"] : [] 
        			};
	        		dfd.resolve(result);
	        	}
	        	else {
	        		dfd.reject(result);
	        	}
	        })
	        .catch(function(result) {
            	dfd.reject(result);
            });
	        return dfd.promise;
	    },
	    delete: function(config) {
	    	var requestParams = { // required params:
	    			docType: config["docType"],
	    			expr: null
	    		};
	    	if ( angular.isString( config["tenantGuid"] ) ) {
	    		requestParams["tenantId"] = config["tenantGuid"];
	    	}
	    	
	    	return $http({
	    		url: serviceRoot[0] + "/aggregationCriteria/set",
                method: "POST",
                headers: {"X-AUTH-HEADER": Auth.authToken["value"]},
                data: requestParams
	        });
	    }
	};
}]);

angular.module("insightal.users")
	.factory("Sensor", [
	    "$http", "$q", "Auth", "Utils", function(
		 $http,   $q,   Auth,   Utils) {
	
	var serviceRoot = routingConfig.serviceRoot,
		data = {};
	
	return {
		add: function(config) {
			var requestParams = {
				collectionIds:	[ config["collectionId"] ], //["d9517f41-6a07-4583-8dda-bc1107412287"],
				sensorName:		config["name"],
				description:	config["description"],
				containerId:	"",
				sensorClass:	"",
				measurement:	config["measurement"],
				measurementType:config["measurementType"],
				unit:			config["unit"]
			};
			
			return $http({
				url: serviceRoot[2] + "/addSensor",
            	method: "POST",
            	headers: {"X-AUTH-HEADER": Auth.authToken["value"]},
            	data: requestParams
			});
		},
		list: function(config) {
			var dfd = $q.defer();
			$http({
				url: serviceRoot[2] + "/getSensors",
            	method: "POST",
            	headers: {"X-AUTH-HEADER": Auth.authToken["value"]},
            	data: {}
			})
			.then(function(result) { // result = {data:string|Object, headers:function, config:Object, status:number, statusText:string}
	        	var sensors, resultList = [];
				if (result.data["status"] === "success") {
	        		sensors = result.data["results"];
	        		for (var key in sensors) {
	        			if ( sensors[key]["collectionIds"].indexOf( config["collectionId"] ) >= 0 )
	        				resultList.push( sensors[key] );
	        		}
					result.data = resultList;
	        		dfd.resolve(result);
	        	}
	        	else {
	        		dfd.reject(result);
	        	}
	        })
	        .catch(function(result) {
            	dfd.reject(result);
            });
	        return dfd.promise;
		},
		getAll: function(config) {
			return $http({
				url: serviceRoot[2] + "/getSensors",
            	method: "POST",
            	headers: {"X-AUTH-HEADER": Auth.authToken["value"]},
            	data: {}
			});
		},
		getData: function(config) {
			var dfd = $q.defer();
			var requestParams = {
				sensorId:		config["sensorId"], // "be104af1-1e99-4d2d-b45d-e408af7b7cf3"
				startDateTime:	config["startDateTime"],
				endDateTime:	config["endDateTime"]
			};
			
			$http({
				url: serviceRoot[3] + "/getSensorData",
            	method: "POST",
            	headers: {"X-AUTH-HEADER": Auth.authToken["value"]},
            	data: requestParams
			})
			.then(function(result) { // result = {data:string|Object, headers:function, config:Object, status:number, statusText:string}
				var sensorData = result.data["sensorData"],
					datapoints,
					dataFormatted = [];
				if ( angular.isObject( sensorData ) && angular.isArray( sensorData["datapoints"] ) && sensorData["datapoints"].length > 0) {
					datapoints = sensorData["datapoints"];
					for (var i=0; i<datapoints.length; i++) {
						dataFormatted.push([
		                    (Utils.strToDateUtc( datapoints[i][0] )).getTime(),
		                    parseFloat( datapoints[i][1] )
	                    ]);
					}
					result.data["sensorData"]["datapoints"] = dataFormatted;
				}
				dfd.resolve(result);
			})
			.catch(function(result) {
            	dfd.reject(result);
            });
			return dfd.promise;
		}
	};

}]);