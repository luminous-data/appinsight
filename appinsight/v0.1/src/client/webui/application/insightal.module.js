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

var mainModule = angular.module("insightal", [
    "insightal.common",
    "insightal.charts",
    "insightal.dashboard",
    "insightal.search",
    "insightal.users",
    "insightal.workbench",
    "inCharts",
    "inJsonTree",
    "jsPlumb",
    "ngCookies",
    "ngRoute",
    "ngAnimate",
    "ngClipboard",
    "ngContextMenu",
    "ui.router",
    "ui.router.default", //utility for defining default child state
    "route-segment",
    "view-segment",
//    "nvd3ChartDirectives",
//    "nvd3",
    "ui.bootstrap"
]);

mainModule.config(["$stateProvider", "$urlRouterProvider", "$locationProvider", "$httpProvider", "ngClipProvider",
           function($stateProvider,   $urlRouterProvider,   $locationProvider,   $httpProvider,   ngClipProvider) {
//    	NOT USED ANYMORE: $routeSegmentProvider, $routeProvider
    
	var access = routingConfig.accessLevels;
	
	/* STATE PROVIDER ************************/
	
	/* public ********************************/
	$stateProvider
		.state("public", {
			abstract: true,
			template: "<ui-view/>",
			data: {
				access: access.public
			}
		})
		.state("public.404", {
			url: "/404/",
			templateUrl: "templates/404.html",
			data: {
				pageTitle: "Not Found"
			}
		});
	
	/* anon **********************************/
	$stateProvider
		.state("anon", {
			abstract: true,
			template: "<ui-view/>",
			data: {
				access: access.anon
			}
		})
		.state("anon.login", {
			url: "/login/",
			templateUrl: "templates/login.html",
			controller: "LoginCtrl as login",
			data: {
				pageTitle: "Insightal"
			}
		})
		.state("anon.register", {
			url: "/register/",
			templateUrl: "templates/register.html",
			controller: "RegisterCtrl",
			data: {
				pageTitle: "Insightal - Register"
			}
		});
	
	/* user **********************************/
	$stateProvider
		.state("user", {
			abstract: true,
			template: "<ui-view/>",
			data: {
				access: access.user
			}
		})
		.state("user.home", {
			url: "/",
			templateUrl: "templates/search.html",
			controller: "SearchCtrl as search",
			data: {
				pageTitle: "Insightal - Search"
			}
		})
		.state("user.settings", {
			abstract: true,
			url: "/settings",
			templateUrl: "templates/userSettings.html",
			data: {
				pageTitle: "Insightal - User Settings"
			}
		})
		.state("user.settings.credentials", {
			url: "/credentials",
			templateUrl: "templates/userSettings/credentials.html",
			controller: "SettingsCredentialsCtrl as credentials",
			data: {
				pageTitle: "Insightal - User Settings"
			}
		})
		.state("user.settings.defaults", {
			url: "/defaults",
			templateUrl: "/templates/userSettings/defaults.html",
			controller: "SettingsDefaultsCtrl as defaults",
			data: {
				pageTitle: "Insightal - User Settings"
			}
		});
	
	/* user - dashboards *********************/
	$stateProvider
		.state("user.dashboardList", {
			url: "/dashboard/list",
			templateUrl: "templates/dashboardList.html",
			controller: "DashboardListCtrl as dashboards",
			data: {
				pageTitle: "Insightal - Dashboard List"
			}
		})
		.state("user.dashboardCreate", {
			url: "/dashboard/new",
			templateUrl: "templates/dashboardCreate.html",
			controller: "DashboardCreateCtrl as dashboard",
			data: {
				pageTitle: "Insightal - Create Dashboard"
			}
		})
		.state("user.dashboard", {
			url: "/dashboard/{guid}",
			templateUrl: "templates/dashboard.html",
			controller: "DashboardCtrl",
			data: {
				pageTitle: "Insightal - Dashboard"
			}
		});
	
	/* user - workbenches ********************/
	$stateProvider
		.state("user.workbenchList", {
			url: "/workbench/list",
			templateUrl: "templates/workbenchList.html",
			controller: "WorkbenchListCtrl as workbenches",
			data: {
				pageTitle: "Insightal - Workbench List"
			}
		})
		.state("user.workbenchCreate", {
			url: "/workbench/new",
			templateUrl: "templates/workbenchCreate.html",
			controller: "WorkbenchCreateCtrl as workbench",
			data: {
				pageTitle: "Insightal - Create Workbench"
			}
		})
		.state("user.workbench", {
			abstract: "user.workbench.catalog.files",
			url: "/workbench",
			templateUrl: "templates/workbench.html",
			data: {
				pageTitle: "Insightal - Workbench"
			}
		})
		.state("user.workbench.catalog", {
			abstract: "user.workbench.catalog.files",
			url: "/catalog",
			templateUrl: "templates/workbench/catalog.html",
			controller: "WbCatalogCtrl as wbCatalog",
			data: {
				pageTitle: "Insightal - Workbench"
			}
		})
		.state("user.workbench.catalog.files", {
			url: "/files",
			templateUrl: "templates/workbench/catalog/files.html",
			controller: "WbFilesCtrl as wbFiles",
			data: {
				pageTitle: "Insightal - Workbench"
			}
//			resolve: {
//				stateData: function() {
//					return {parentScopeName: "wbCatalog"};
//				}
//			}
		})
		.state("user.workbench.catalog.collections", {
			url: "/collections",
			templateUrl: "templates/workbench/catalog/collections.html",
			controller: "WbCollectionsCtrl as wbCollections",
			data: {
				pageTitle: "Insightal - Workbench"
			}
		})
		.state("user.workbench.catalog.datasets", {
			url: "/datasets",
			templateUrl: "templates/workbench/catalog/datasets.html",
			controller: "WbDatasetsCtrl as wbDatasets",
			data: {
				pageTitle: "Insightal - Workbench"
			}
		})
		.state("user.workbench.catalog.workflows", {
			url: "/workflows",
			templateUrl: "templates/workbench/catalog/workflows.html",
			controller: "WbWorkflowsCtrl as wbWorkflows",
			data: {
				pageTitle: "Insightal - Workbench"
			}
		})
		.state("user.workbench.catalog.workflowExecutions", {
			url: "/workflow/{guid}/instances",
			templateUrl: "templates/workbench/catalog/workflowExecutions.html",
			controller: "WbWorkflowExecutionsCtrl as wbExecutions",
			data: {
				pageTitle: "Insightal - Workbench"
			}
		})
		.state("user.workbench.catalog.workflowCreate", {
			url: "/workflow-create",
			templateUrl: "templates/workbench/catalog/workflow-create.html",
			controller: "WbWorkflowCreateCtrl as workflow",
			data: {
				pageTitle: "Insightal - Workbench"
			}
		})
		.state("user.workbench.catalog.datasetCreate", {
			abstract: "user.workbench.catalog.datasetCreate.step1",
			url: "/dataset-create",
			templateUrl: "templates/workbench/catalog/datasetWizard.html",
			controller: "WbDatasetWizardCtrl as wizard",
			data: {
				pageTitle: "Insightal - Workbench"
			}
		})
		.state("user.workbench.catalog.datasetCreate.step1", {
			url: "/step1",
			templateUrl: "templates/workbench/catalog/datasetWizard/step1.html",
			data: {
				pageTitle: "Insightal - Workbench"
			}
		})
		.state("user.workbench.catalog.datasetCreate.step2", {
			url: "/step2",
			templateUrl: "templates/workbench/catalog/datasetWizard/step2.html",
			data: {
				pageTitle: "Insightal - Workbench"
			}
		})
		.state("user.workbench.catalog.dataviewCreate", {
			abstract: "user.workbench.catalog.dataviewCreate.step1",
			url: "/dataview-create",
			templateUrl: "templates/workbench/catalog/dataviewWizard.html",
			controller: "WbDataviewWizardCtrl as wizard",
			data: {
				pageTitle: "Insightal - Workbench"
			}
		})
		.state("user.workbench.catalog.dataviewCreate.step1", {
			url: "/step1",
			templateUrl: "templates/workbench/catalog/dataviewWizard/step1.html",
			data: {
				pageTitle: "Insightal - Workbench"
			}
		})
		.state("user.workbench.catalog.dataviewCreate.step2", {
			url: "/step2",
			templateUrl: "templates/workbench/catalog/dataviewWizard/step2.html",
			data: {
				pageTitle: "Insightal - Workbench"
			}
		})
		.state("user.workbench.catalog.dataviewCreate.step3", {
			url: "/step3",
			templateUrl: "templates/workbench/catalog/dataviewWizard/step3.html",
			data: {
				pageTitle: "Insightal - Workbench"
			}
		})
		.state("user.workbench.catalog.dataviewCreate.step4", {
			url: "/step4",
			templateUrl: "templates/workbench/catalog/dataviewWizard/step4.html",
			data: {
				pageTitle: "Insightal - Workbench"
			}
		})
		.state("user.workbench.catalog.dataviewCreate.step5", {
			url: "/step5",
			templateUrl: "templates/workbench/catalog/dataviewWizard/step5.html",
			data: {
				pageTitle: "Insightal - Workbench"
			}
		})
		.state("user.workbench.catalog.dataviewCreate.step6", {
			url: "/step6",
			templateUrl: "templates/workbench/catalog/dataviewWizard/step6.html",
			data: {
				pageTitle: "Insightal - Workbench"
			}
		})
		.state("user.workbench.visuals", {
			url: "/visuals",
			templateUrl: "templates/workbench/visuals.html",
			controller: "WbVisualsCtrl as visuals",
			data: {
				pageTitle: "Insightal - Workbench"
			}
		})
		.state("user.workbench.system", {
			url: "/system",
			templateUrl: "templates/workbench/system.html",
			data: {
				pageTitle: "Insightal - Workbench"
			}
		});
//		.state("user.workbench", {
//			url: "/workbench/{guid}",
//			templateUrl: "templates/workbench.html",
//			controller: "WorkbenchCtrl as workbench",
//			data: {
//				pageTitle: "Insightal - Workbench"
//			}
//		})
	
	/* admin *********************************/
	$stateProvider
		.state("admin", {
			abstract: true,
			template: "<ui-view/>",
			data: {
				access: access.admin
			}
		})
		.state("admin.siteadmin", {
			url: "/siteadmin",
			templateUrl: "templates/siteadmin.html",
			controller: "SiteAdminCtrl as admin",
			data: {
				pageTitle: "Insightal - Site Admin"
			}
		})
		.state("admin.tenantadmin", {
			abstract: ".users",
			url: "/tenant",
			templateUrl: "templates/tenantadmin.html",
			data: {
				pageTitle: "Insightal - Tenant Admin",
				access: access.tenant
			}
		})
		.state("admin.tenantadmin.users", {
			url: "/users",
			templateUrl: "templates/tenantadmin/users.html",
			controller: "TenantUsersCtrl as users",
			data: {
				pageTitle: "Insightal - Tenant Admin"
			}
		})
		.state("admin.tenantadmin.data", {
			url: "/data",
			templateUrl: "templates/tenantadmin/data.html",
			controller: "TenantDataCtrl as data",
			data: {
				pageTitle: "Insightal - Tenant Admin"
			}
		});
	
	$urlRouterProvider.otherwise("/");
	$locationProvider.html5Mode(false);
	ngClipProvider.setPath("vendor/clipboard/ZeroClipboard.swf");
 
//     $httpProvider.interceptors.push("removeTempDataInterceptor");

 }]);


mainModule.run(["$rootScope", "$state", "$stateParams", "$location", "$http", "$cookieStore", "$window", "Auth",
		function($rootScope,   $state,   $stateParams,   $location,   $http,   $cookieStore,   $window,   Auth) {
	
	var sessionId = $cookieStore.get("appInsightSessionId");
	if (typeof sessionId === "string") {
		Auth.authToken["value"] = sessionId;
	}
	
	$rootScope.isWaiting = false;
	//bind $state to $rootScope to access it from a template/view
	$rootScope.$state = $state;
	$rootScope.$stateParams = $stateParams;

	$rootScope.$on("$stateChangeStart", function (event, toState, toParams, fromState, fromParams) {
		if (!Auth.authorize(toState.data.access)) {
			$rootScope.error = "Seems like you tried accessing a route you don't have access to...";
			event.preventDefault();
			
			if (fromState.url === "^") {
				if (Auth.isLoggedIn()) {
					$state.go("user.home");
				}
				else {
					$rootScope.error = null;
					$state.go("anon.login");
				}
			}
		}
	});
	
	$rootScope.$on("$stateChangeError",	function(event, toState, toParams, fromState, fromParams, error) {
		console.error(error);
	});

}]);



/* BEGIN ROUTING CONFIG **************************************************/
(function(exports){

    var config = {

        /* List all the roles you wish to use in the app
        * You have a max of 31 before the bit shift pushes the accompanying integer out of
        * the memory footprint for an integer
        */
        roles :[
            'user',
            'tenant',
            'admin',
            'public'
        ],

        /*
        Build out all the access levels you want referencing the roles listed above
        You can use the "*" symbol to represent access to all roles
         */
        accessLevels : {
            'public':	"*",
            'anon':		['public'],
            'user':		['admin', 'tenant', 'user'],
            'tenant':	['admin', 'tenant'],
            'admin':	['admin'],
            'userOnly':	['user'],
            'tenantOnly':['tenant'],
            'nonAdmin':	['tenant', 'user']
        },
        // Home Server ngroked
//      serviceRoot : ['http://50.185.228.143:8080']
//    	serviceRoot : ['http://99.119.14.100:8080']
		serviceRoot: [
//			"http://45.79.102.84:8080",
//			"http://45.79.102.84:9505"
	    "http://45.33.32.128:8084",
            "http://45.33.32.128:9506",
            "http://45.33.32.128:9503",
            "http://45.33.32.128:9504",
            "http://45.33.32.128:9507"
		]

    }

    exports.userRoles = buildRoles(config.roles);
    exports.accessLevels = buildAccessLevels(config.accessLevels, exports.userRoles);
    exports.serviceRoot  = config.serviceRoot;
    /*
        Method to build a distinct bit mask for each role
        It starts off with "1" and shifts the bit to the left for each element in the
        roles array parameter
     */

    function buildRoles(roles){

        var bitMask = "01";
        var userRoles = {};

        for(var role in roles){
            var intCode = parseInt(bitMask, 2);
            userRoles[roles[role]] = {
                bitMask: intCode,
                title: roles[role]
            };
            bitMask = (intCode << 1 ).toString(2)
        }

        return userRoles;
    }

    /*
    This method builds access level bit masks based on the accessLevelDeclaration parameter which must
    contain an array for each access level containing the allowed user roles.
     */
    function buildAccessLevels(accessLevelDeclarations, userRoles){

        var accessLevels = {};
        for(var level in accessLevelDeclarations){

            if(typeof accessLevelDeclarations[level] == 'string'){
                if(accessLevelDeclarations[level] == '*'){

                    var resultBitMask = '';

                    for( var role in userRoles){
                        resultBitMask += "1"
                    }
                    //accessLevels[level] = parseInt(resultBitMask, 2);
                    accessLevels[level] = {
                        bitMask: parseInt(resultBitMask, 2)
                    };
                }
                else console.error("Access Control Error: Could not parse '" + accessLevelDeclarations[level] + "' as access definition for level '" + level + "'")

            }
            else {

                var resultBitMask = 0;
                for(var role in accessLevelDeclarations[level]){
                    if(userRoles.hasOwnProperty(accessLevelDeclarations[level][role]))
                        resultBitMask = resultBitMask | userRoles[accessLevelDeclarations[level][role]].bitMask
                    else console.log("Access Control Error: Could not find role '" + accessLevelDeclarations[level][role] + "' in registered roles while building access for '" + level + "'")
                }
                accessLevels[level] = {
                    bitMask: resultBitMask
                };
            }
        }

        return accessLevels;
    }

})(typeof exports === 'undefined' ? this['routingConfig'] = {} : exports);
/* END ROUTING CONFIG ****************************************************/


// TODO: remove ->

mainModule.value("DBG", {
	isRecording:	false,
	isOffline:		false,
	"Auth": {
		"login": {
			"userId": "e4158785-0598-4d08-9c60-06a950225cfe",
			"username": "tenant1-admin",
			"role": {
				"bitMask": 2,
				"title": "tenant"
			},
			"tenantId": "8c2c0f14-c8ae-418e-bae7-e5beda66d49f"
		}
	},
	"Search": {
		"search": {
			"results": [{
				"status": "WARNING",
				"_type": "test1",
				"_score": 1,
				"@timestamp": "2015-11-22T11:32:06Z",
				"_index": "bf785777-27a9-4c19-b653-d52453d8c0f0-2015-10-22t22:19:37.800409z",
				"docType": "test1",
				"value": 20,
				"_id": "5Uohq_7BS5G2v2wSBkSttw",
				"@type": "test1"
			}, {
				"status": "ERROR",
				"_type": "test1",
				"_score": 1,
				"@timestamp": "2015-11-22T11:32:11Z",
				"_index": "bf785777-27a9-4c19-b653-d52453d8c0f0-2015-10-22t22:19:37.800409z",
				"docType": "test1",
				"value": 20,
				"_id": "9snlklMmTbyBS69PMoSxcw",
				"@type": "test1"
			}, {
				"status": "INFO",
				"_type": "test1",
				"_score": 1,
				"@timestamp": "2015-11-22T11:32:04Z",
				"_index": "bf785777-27a9-4c19-b653-d52453d8c0f0-2015-10-22t22:19:37.800409z",
				"docType": "test1",
				"value": 20,
				"_id": "xiH0k_Z1T8K5LYHxP3CnTA",
				"@type": "test1"
			}, {
				"status": "WARNING",
				"_type": "test1",
				"_score": 1,
				"@timestamp": "2015-11-22T11:32:15Z",
				"_index": "bf785777-27a9-4c19-b653-d52453d8c0f0-2015-10-22t22:19:37.800409z",
				"docType": "test1",
				"value": 20,
				"_id": "nna4U_YDRqiZeSKY-JsHzQ",
				"@type": "test1"
			}, {
				"status": "WARNING",
				"_type": "test1",
				"_score": 1,
				"@timestamp": "2015-11-22T11:32:18Z",
				"_index": "bf785777-27a9-4c19-b653-d52453d8c0f0-2015-10-22t22:19:37.800409z",
				"docType": "test1",
				"value": 20,
				"_id": "TbFhdLufSxeKUgv7DakrLA",
				"@type": "test1"
			}, {
				"status": "WARNING",
				"_type": "test1",
				"_score": 1,
				"@timestamp": "2015-11-22T11:32:31Z",
				"_index": "bf785777-27a9-4c19-b653-d52453d8c0f0-2015-10-22t22:19:37.800409z",
				"docType": "test1",
				"value": 20,
				"_id": "Om1Uq8iCQR2RgTzruxTFiA",
				"@type": "test1"
			}, {
				"status": "WARNING",
				"_type": "test1",
				"_score": 1,
				"@timestamp": "2015-11-22T11:32:36Z",
				"_index": "bf785777-27a9-4c19-b653-d52453d8c0f0-2015-10-22t22:19:37.800409z",
				"docType": "test1",
				"value": 20,
				"_id": "7T4FbSgrS6mF7nIZJ6C23Q",
				"@type": "test1"
			}, {
				"status": "ERROR",
				"_type": "test1",
				"_score": 1,
				"@timestamp": "2015-11-22T11:32:14Z",
				"_index": "bf785777-27a9-4c19-b653-d52453d8c0f0-2015-10-22t22:19:37.800409z",
				"docType": "test1",
				"value": 20,
				"_id": "HQ9mY1X4QGe84gqlr-eD8Q",
				"@type": "test1"
			}, {
				"status": "ERROR",
				"_type": "test1",
				"_score": 1,
				"@timestamp": "2015-11-22T11:32:54Z",
				"_index": "bf785777-27a9-4c19-b653-d52453d8c0f0-2015-10-22t22:19:37.800409z",
				"docType": "test1",
				"value": 20,
				"_id": "zXYNb13PT_au1GsjlixYCw",
				"@type": "test1"
			}, {
				"status": "ERROR",
				"_type": "test1",
				"_score": 1,
				"@timestamp": "2015-11-22T11:33:05Z",
				"_index": "bf785777-27a9-4c19-b653-d52453d8c0f0-2015-10-22t22:19:37.800409z",
				"docType": "test1",
				"value": 20,
				"_id": "qEm1bsjsQbGh4UgmcjSiLQ",
				"@type": "test1"
			}],
			"resultsCount": 85471,
			"aggregateByDate": [
				[1448191920000, 4273],
				[1448196240000, 4274],
				[1448200560000, 4276],
				[1448204880000, 4273],
				[1448209200000, 4275],
				[1448213520000, 4276],
				[1448217840000, 4274],
				[1448222160000, 4274],
				[1448226480000, 4275],
				[1448230800000, 4275],
				[1448235120000, 4276],
				[1448239440000, 4277],
				[1448243760000, 4275],
				[1448248080000, 4274],
				[1448252400000, 4273],
				[1448256720000, 4271],
				[1448261040000, 4269],
				[1448265360000, 4269],
				[1448269680000, 4271],
				[1448274000000, 4270]
			],
			"aggregateByDocType": [
				["test1", 85471]
			],
			"source": {
				"status": "OK",
				"searchResultsCount": 85471,
				"none_doctype_agg": {
					"aggField": "_type",
					"aggType": "terms",
					"data": {
						"test1": 85471
					},
					"aggDocType": "none"
				},
				"chartData": {
					"none_date_range_agg": {
						"aggregationType": "range",
						"aggregationField": "@timestamp",
						"data": [
							[1448191920000, 4273],
							[1448196240000, 4274],
							[1448200560000, 4276],
							[1448204880000, 4273],
							[1448209200000, 4275],
							[1448213520000, 4276],
							[1448217840000, 4274],
							[1448222160000, 4274],
							[1448226480000, 4275],
							[1448230800000, 4275],
							[1448235120000, 4276],
							[1448239440000, 4277],
							[1448243760000, 4275],
							[1448248080000, 4274],
							[1448252400000, 4273],
							[1448256720000, 4271],
							[1448261040000, 4269],
							[1448265360000, 4269],
							[1448269680000, 4271],
							[1448274000000, 4270]
						],
						"docType": "none"
					}
				},
				"searchResults": [{
					"status": "WARNING",
					"_type": "test1",
					"_score": 1,
					"@timestamp": "2015-11-22T11:32:06Z",
					"_index": "bf785777-27a9-4c19-b653-d52453d8c0f0-2015-10-22t22:19:37.800409z",
					"docType": "test1",
					"value": 20,
					"_id": "5Uohq_7BS5G2v2wSBkSttw",
					"@type": "test1"
				}, {
					"status": "ERROR",
					"_type": "test1",
					"_score": 1,
					"@timestamp": "2015-11-22T11:32:11Z",
					"_index": "bf785777-27a9-4c19-b653-d52453d8c0f0-2015-10-22t22:19:37.800409z",
					"docType": "test1",
					"value": 20,
					"_id": "9snlklMmTbyBS69PMoSxcw",
					"@type": "test1"
				}, {
					"status": "INFO",
					"_type": "test1",
					"_score": 1,
					"@timestamp": "2015-11-22T11:32:04Z",
					"_index": "bf785777-27a9-4c19-b653-d52453d8c0f0-2015-10-22t22:19:37.800409z",
					"docType": "test1",
					"value": 20,
					"_id": "xiH0k_Z1T8K5LYHxP3CnTA",
					"@type": "test1"
				}, {
					"status": "WARNING",
					"_type": "test1",
					"_score": 1,
					"@timestamp": "2015-11-22T11:32:15Z",
					"_index": "bf785777-27a9-4c19-b653-d52453d8c0f0-2015-10-22t22:19:37.800409z",
					"docType": "test1",
					"value": 20,
					"_id": "nna4U_YDRqiZeSKY-JsHzQ",
					"@type": "test1"
				}, {
					"status": "WARNING",
					"_type": "test1",
					"_score": 1,
					"@timestamp": "2015-11-22T11:32:18Z",
					"_index": "bf785777-27a9-4c19-b653-d52453d8c0f0-2015-10-22t22:19:37.800409z",
					"docType": "test1",
					"value": 20,
					"_id": "TbFhdLufSxeKUgv7DakrLA",
					"@type": "test1"
				}, {
					"status": "WARNING",
					"_type": "test1",
					"_score": 1,
					"@timestamp": "2015-11-22T11:32:31Z",
					"_index": "bf785777-27a9-4c19-b653-d52453d8c0f0-2015-10-22t22:19:37.800409z",
					"docType": "test1",
					"value": 20,
					"_id": "Om1Uq8iCQR2RgTzruxTFiA",
					"@type": "test1"
				}, {
					"status": "WARNING",
					"_type": "test1",
					"_score": 1,
					"@timestamp": "2015-11-22T11:32:36Z",
					"_index": "bf785777-27a9-4c19-b653-d52453d8c0f0-2015-10-22t22:19:37.800409z",
					"docType": "test1",
					"value": 20,
					"_id": "7T4FbSgrS6mF7nIZJ6C23Q",
					"@type": "test1"
				}, {
					"status": "ERROR",
					"_type": "test1",
					"_score": 1,
					"@timestamp": "2015-11-22T11:32:14Z",
					"_index": "bf785777-27a9-4c19-b653-d52453d8c0f0-2015-10-22t22:19:37.800409z",
					"docType": "test1",
					"value": 20,
					"_id": "HQ9mY1X4QGe84gqlr-eD8Q",
					"@type": "test1"
				}, {
					"status": "ERROR",
					"_type": "test1",
					"_score": 1,
					"@timestamp": "2015-11-22T11:32:54Z",
					"_index": "bf785777-27a9-4c19-b653-d52453d8c0f0-2015-10-22t22:19:37.800409z",
					"docType": "test1",
					"value": 20,
					"_id": "zXYNb13PT_au1GsjlixYCw",
					"@type": "test1"
				}, {
					"status": "ERROR",
					"_type": "test1",
					"_score": 1,
					"@timestamp": "2015-11-22T11:33:05Z",
					"_index": "bf785777-27a9-4c19-b653-d52453d8c0f0-2015-10-22t22:19:37.800409z",
					"docType": "test1",
					"value": 20,
					"_id": "qEm1bsjsQbGh4UgmcjSiLQ",
					"@type": "test1"
				}],
				"aggregations": [{
					"none_doctype_agg": {
						"aggregationType": "terms",
						"aggregationField": "_type",
						"data": [
							["test1", 85471]
						],
						"docType": "none"
					}
				}, {
					"none_date_range_agg": {
						"aggregationType": "range",
						"aggregationField": "@timestamp",
						"data": [
							[1448191920000, 4273],
							[1448196240000, 4274],
							[1448200560000, 4276],
							[1448204880000, 4273],
							[1448209200000, 4275],
							[1448213520000, 4276],
							[1448217840000, 4274],
							[1448222160000, 4274],
							[1448226480000, 4275],
							[1448230800000, 4275],
							[1448235120000, 4276],
							[1448239440000, 4277],
							[1448243760000, 4275],
							[1448248080000, 4274],
							[1448252400000, 4273],
							[1448256720000, 4271],
							[1448261040000, 4269],
							[1448265360000, 4269],
							[1448269680000, 4271],
							[1448274000000, 4270]
						],
						"docType": "none"
					}
				}],
				"result": {
					"hits": {
						"hits": [{
							"_score": 1,
							"_type": "test1",
							"_id": "5Uohq_7BS5G2v2wSBkSttw",
							"_source": {
								"status": "WARNING",
								"@timestamp": "2015-11-22T11:32:06Z",
								"docType": "test1",
								"value": 20,
								"@type": "test1"
							},
							"_index": "bf785777-27a9-4c19-b653-d52453d8c0f0-2015-10-22t22:19:37.800409z"
						}, {
							"_score": 1,
							"_type": "test1",
							"_id": "9snlklMmTbyBS69PMoSxcw",
							"_source": {
								"status": "ERROR",
								"@timestamp": "2015-11-22T11:32:11Z",
								"docType": "test1",
								"value": 20,
								"@type": "test1"
							},
							"_index": "bf785777-27a9-4c19-b653-d52453d8c0f0-2015-10-22t22:19:37.800409z"
						}, {
							"_score": 1,
							"_type": "test1",
							"_id": "xiH0k_Z1T8K5LYHxP3CnTA",
							"_source": {
								"status": "INFO",
								"@timestamp": "2015-11-22T11:32:04Z",
								"docType": "test1",
								"value": 20,
								"@type": "test1"
							},
							"_index": "bf785777-27a9-4c19-b653-d52453d8c0f0-2015-10-22t22:19:37.800409z"
						}, {
							"_score": 1,
							"_type": "test1",
							"_id": "nna4U_YDRqiZeSKY-JsHzQ",
							"_source": {
								"status": "WARNING",
								"@timestamp": "2015-11-22T11:32:15Z",
								"docType": "test1",
								"value": 20,
								"@type": "test1"
							},
							"_index": "bf785777-27a9-4c19-b653-d52453d8c0f0-2015-10-22t22:19:37.800409z"
						}, {
							"_score": 1,
							"_type": "test1",
							"_id": "TbFhdLufSxeKUgv7DakrLA",
							"_source": {
								"status": "WARNING",
								"@timestamp": "2015-11-22T11:32:18Z",
								"docType": "test1",
								"value": 20,
								"@type": "test1"
							},
							"_index": "bf785777-27a9-4c19-b653-d52453d8c0f0-2015-10-22t22:19:37.800409z"
						}, {
							"_score": 1,
							"_type": "test1",
							"_id": "Om1Uq8iCQR2RgTzruxTFiA",
							"_source": {
								"status": "WARNING",
								"@timestamp": "2015-11-22T11:32:31Z",
								"docType": "test1",
								"value": 20,
								"@type": "test1"
							},
							"_index": "bf785777-27a9-4c19-b653-d52453d8c0f0-2015-10-22t22:19:37.800409z"
						}, {
							"_score": 1,
							"_type": "test1",
							"_id": "7T4FbSgrS6mF7nIZJ6C23Q",
							"_source": {
								"status": "WARNING",
								"@timestamp": "2015-11-22T11:32:36Z",
								"docType": "test1",
								"value": 20,
								"@type": "test1"
							},
							"_index": "bf785777-27a9-4c19-b653-d52453d8c0f0-2015-10-22t22:19:37.800409z"
						}, {
							"_score": 1,
							"_type": "test1",
							"_id": "HQ9mY1X4QGe84gqlr-eD8Q",
							"_source": {
								"status": "ERROR",
								"@timestamp": "2015-11-22T11:32:14Z",
								"docType": "test1",
								"value": 20,
								"@type": "test1"
							},
							"_index": "bf785777-27a9-4c19-b653-d52453d8c0f0-2015-10-22t22:19:37.800409z"
						}, {
							"_score": 1,
							"_type": "test1",
							"_id": "zXYNb13PT_au1GsjlixYCw",
							"_source": {
								"status": "ERROR",
								"@timestamp": "2015-11-22T11:32:54Z",
								"docType": "test1",
								"value": 20,
								"@type": "test1"
							},
							"_index": "bf785777-27a9-4c19-b653-d52453d8c0f0-2015-10-22t22:19:37.800409z"
						}, {
							"_score": 1,
							"_type": "test1",
							"_id": "qEm1bsjsQbGh4UgmcjSiLQ",
							"_source": {
								"status": "ERROR",
								"@timestamp": "2015-11-22T11:33:05Z",
								"docType": "test1",
								"value": 20,
								"@type": "test1"
							},
							"_index": "bf785777-27a9-4c19-b653-d52453d8c0f0-2015-10-22t22:19:37.800409z"
						}],
						"total": 85471,
						"max_score": 1
					},
					"_shards": {
						"successful": 5,
						"failed": 0,
						"total": 5
					},
					"took": 34,
					"aggregations": {
						"inrange": {
							"none_doctype_agg": {
								"buckets": [{
									"key": "test1",
									"doc_count": 85471
								}]
							},
							"none_date_range_agg": {
								"buckets": [{
									"from": 1448191920000,
									"from_as_string": "2015-11-22T11:32:00.000Z",
									"to_as_string": "2015-11-22T12:44:00.000Z",
									"doc_count": 4273,
									"to": 1448196240000,
									"key": "2015-11-22T11:32:00.000Z-2015-11-22T12:44:00.000Z"
								}, {
									"from": 1448196240000,
									"from_as_string": "2015-11-22T12:44:00.000Z",
									"to_as_string": "2015-11-22T13:56:00.000Z",
									"doc_count": 4274,
									"to": 1448200560000,
									"key": "2015-11-22T12:44:00.000Z-2015-11-22T13:56:00.000Z"
								}, {
									"from": 1448200560000,
									"from_as_string": "2015-11-22T13:56:00.000Z",
									"to_as_string": "2015-11-22T15:08:00.000Z",
									"doc_count": 4276,
									"to": 1448204880000,
									"key": "2015-11-22T13:56:00.000Z-2015-11-22T15:08:00.000Z"
								}, {
									"from": 1448204880000,
									"from_as_string": "2015-11-22T15:08:00.000Z",
									"to_as_string": "2015-11-22T16:20:00.000Z",
									"doc_count": 4273,
									"to": 1448209200000,
									"key": "2015-11-22T15:08:00.000Z-2015-11-22T16:20:00.000Z"
								}, {
									"from": 1448209200000,
									"from_as_string": "2015-11-22T16:20:00.000Z",
									"to_as_string": "2015-11-22T17:32:00.000Z",
									"doc_count": 4275,
									"to": 1448213520000,
									"key": "2015-11-22T16:20:00.000Z-2015-11-22T17:32:00.000Z"
								}, {
									"from": 1448213520000,
									"from_as_string": "2015-11-22T17:32:00.000Z",
									"to_as_string": "2015-11-22T18:44:00.000Z",
									"doc_count": 4276,
									"to": 1448217840000,
									"key": "2015-11-22T17:32:00.000Z-2015-11-22T18:44:00.000Z"
								}, {
									"from": 1448217840000,
									"from_as_string": "2015-11-22T18:44:00.000Z",
									"to_as_string": "2015-11-22T19:56:00.000Z",
									"doc_count": 4274,
									"to": 1448222160000,
									"key": "2015-11-22T18:44:00.000Z-2015-11-22T19:56:00.000Z"
								}, {
									"from": 1448222160000,
									"from_as_string": "2015-11-22T19:56:00.000Z",
									"to_as_string": "2015-11-22T21:08:00.000Z",
									"doc_count": 4274,
									"to": 1448226480000,
									"key": "2015-11-22T19:56:00.000Z-2015-11-22T21:08:00.000Z"
								}, {
									"from": 1448226480000,
									"from_as_string": "2015-11-22T21:08:00.000Z",
									"to_as_string": "2015-11-22T22:20:00.000Z",
									"doc_count": 4275,
									"to": 1448230800000,
									"key": "2015-11-22T21:08:00.000Z-2015-11-22T22:20:00.000Z"
								}, {
									"from": 1448230800000,
									"from_as_string": "2015-11-22T22:20:00.000Z",
									"to_as_string": "2015-11-22T23:32:00.000Z",
									"doc_count": 4275,
									"to": 1448235120000,
									"key": "2015-11-22T22:20:00.000Z-2015-11-22T23:32:00.000Z"
								}, {
									"from": 1448235120000,
									"from_as_string": "2015-11-22T23:32:00.000Z",
									"to_as_string": "2015-11-23T00:44:00.000Z",
									"doc_count": 4276,
									"to": 1448239440000,
									"key": "2015-11-22T23:32:00.000Z-2015-11-23T00:44:00.000Z"
								}, {
									"from": 1448239440000,
									"from_as_string": "2015-11-23T00:44:00.000Z",
									"to_as_string": "2015-11-23T01:56:00.000Z",
									"doc_count": 4277,
									"to": 1448243760000,
									"key": "2015-11-23T00:44:00.000Z-2015-11-23T01:56:00.000Z"
								}, {
									"from": 1448243760000,
									"from_as_string": "2015-11-23T01:56:00.000Z",
									"to_as_string": "2015-11-23T03:08:00.000Z",
									"doc_count": 4275,
									"to": 1448248080000,
									"key": "2015-11-23T01:56:00.000Z-2015-11-23T03:08:00.000Z"
								}, {
									"from": 1448248080000,
									"from_as_string": "2015-11-23T03:08:00.000Z",
									"to_as_string": "2015-11-23T04:20:00.000Z",
									"doc_count": 4274,
									"to": 1448252400000,
									"key": "2015-11-23T03:08:00.000Z-2015-11-23T04:20:00.000Z"
								}, {
									"from": 1448252400000,
									"from_as_string": "2015-11-23T04:20:00.000Z",
									"to_as_string": "2015-11-23T05:32:00.000Z",
									"doc_count": 4273,
									"to": 1448256720000,
									"key": "2015-11-23T04:20:00.000Z-2015-11-23T05:32:00.000Z"
								}, {
									"from": 1448256720000,
									"from_as_string": "2015-11-23T05:32:00.000Z",
									"to_as_string": "2015-11-23T06:44:00.000Z",
									"doc_count": 4271,
									"to": 1448261040000,
									"key": "2015-11-23T05:32:00.000Z-2015-11-23T06:44:00.000Z"
								}, {
									"from": 1448261040000,
									"from_as_string": "2015-11-23T06:44:00.000Z",
									"to_as_string": "2015-11-23T07:56:00.000Z",
									"doc_count": 4269,
									"to": 1448265360000,
									"key": "2015-11-23T06:44:00.000Z-2015-11-23T07:56:00.000Z"
								}, {
									"from": 1448265360000,
									"from_as_string": "2015-11-23T07:56:00.000Z",
									"to_as_string": "2015-11-23T09:08:00.000Z",
									"doc_count": 4269,
									"to": 1448269680000,
									"key": "2015-11-23T07:56:00.000Z-2015-11-23T09:08:00.000Z"
								}, {
									"from": 1448269680000,
									"from_as_string": "2015-11-23T09:08:00.000Z",
									"to_as_string": "2015-11-23T10:20:00.000Z",
									"doc_count": 4271,
									"to": 1448274000000,
									"key": "2015-11-23T09:08:00.000Z-2015-11-23T10:20:00.000Z"
								}, {
									"from": 1448274000000,
									"from_as_string": "2015-11-23T10:20:00.000Z",
									"to_as_string": "2015-11-23T11:32:00.000Z",
									"doc_count": 4270,
									"to": 1448278320000,
									"key": "2015-11-23T10:20:00.000Z-2015-11-23T11:32:00.000Z"
								}]
							},
							"doc_count": 85471
						}
					},
					"timed_out": false
				},
				"none_date_range_agg": {
					"aggField": "@timestamp",
					"aggType": "range",
					"data": [
						["2015-11-22T11:32:00.000Z", 4273],
						["2015-11-22T12:44:00.000Z", 4274],
						["2015-11-22T13:56:00.000Z", 4276],
						["2015-11-22T15:08:00.000Z", 4273],
						["2015-11-22T16:20:00.000Z", 4275],
						["2015-11-22T17:32:00.000Z", 4276],
						["2015-11-22T18:44:00.000Z", 4274],
						["2015-11-22T19:56:00.000Z", 4274],
						["2015-11-22T21:08:00.000Z", 4275],
						["2015-11-22T22:20:00.000Z", 4275],
						["2015-11-22T23:32:00.000Z", 4276],
						["2015-11-23T00:44:00.000Z", 4277],
						["2015-11-23T01:56:00.000Z", 4275],
						["2015-11-23T03:08:00.000Z", 4274],
						["2015-11-23T04:20:00.000Z", 4273],
						["2015-11-23T05:32:00.000Z", 4271],
						["2015-11-23T06:44:00.000Z", 4269],
						["2015-11-23T07:56:00.000Z", 4269],
						["2015-11-23T09:08:00.000Z", 4271],
						["2015-11-23T10:20:00.000Z", 4270]
					],
					"aggDocType": "none"
				}
			}
		}
	},
	"Group": {
		"getAll": [
			["b2653a86-b04d-421b-bd54-ed2b67bf7a2f", "marketing"]
		]
	},
	"Application": {
		"getAppsByGroup": {
			"status": "OK",
			"applications": [
				["27b2afe3-462d-4939-986b-6cc9e86d32f8", "campaigns"]
			]
		},
		"getApplicationFields": {
			"bf785777-27a9-4c19-b653-d52453d8c0f0": {
				"name": "website",
				"documents": {
					"test1": {
						"fields": {
							"status": {
								"type": "string",
								"attributes": ["count"]
							},
							"@timestamp": {
								"type": "date",
								"format": "dateOptionalTime",
								"attributes": ["count"]
							},
							"@type": {
								"type": "string",
								"attributes": ["count"]
							},
							"value": {
								"type": "long",
								"attributes": ["min", "max", "average"]
							},
							"docType": {
								"type": "string",
								"attributes": ["count"]
							}
						}
					}
				}
			}
		}
	},
	"Collection": {
		"getCollectionsByApp": {
			"status": "OK",
			"collections": [
				["bf785777-27a9-4c19-b653-d52453d8c0f0", "website"]
			]
		}
	},
	"Dashboard": {
		"list": {
			"status": "OK",
			"response": "[(u'214d7a50-4645-4478-ad12-6068ceff5bc2', u'Dashboard 2', u'{\"name\":\"Dashboard 2\",\"description\":\"Testing various chart types\",\"guid\":\"214d7a50-4645-4478-ad12-6068ceff5bc2\",\"user\":null,\"active\":1,\"creationDate\":\"2015-10-07T13:51:33.307Z\",\"modificationDate\":\"2015-10-07T13:51:33.307Z\",\"datasources\":[],\"widgets\":[{\"add\":{\"title\":\"Status ratio\",\"position\":1,\"panelStyle\":{},\"width\":50},\"series\":[{\"metric\":{\"application\":\"27b2afe3-462d-4939-986b-6cc9e86d32f8\",\"collection\":\"a2272483-cef3-4ca2-9e2e-837ff560294a\",\"document\":\"test1\",\"field\":\"status\",\"attribute\":\"count\"},\"metric2\":{},\"metric2Enabled\":false,\"metric3\":{},\"metric3Enabled\":false,\"data\":[],\"guid\":\"15631edc-e071-4136-94a6-2b605cdb4d25\",\"type\":\"inherit\",\"name\":\"Pie Series\",\"color\":null,\"zIndex\":1}],\"guid\":\"5ce8b78c-d437-47ee-eef5-9c1449200112\",\"type\":\"pie\",\"active\":1,\"title\":null,\"subtitle\":null,\"zoom\":\"x\",\"showLegend\":true,\"cssHeight\":\"inherit\",\"xAxisType\":\"datetime\",\"xAxisTitle\":\"\",\"xAxisCategories\":null,\"xAxisMin\":null,\"xAxisMax\":null,\"xAxisOpposite\":false,\"xAxisReversed\":false,\"xAxisAllowDecimals\":true,\"xAxisOffset\":0,\"xTickInterval\":null,\"xTickLength\":10,\"xTickPositions\":null,\"xTickAmount\":null,\"yAxisType\":\"linear\",\"yAxisTitle\":\"\",\"yAxisCategories\":null,\"yAxisMin\":null,\"yAxisMax\":null,\"yAxisOpposite\":false,\"yAxisReversed\":false,\"yAxisAllowDecimals\":true,\"yAxisOffset\":0,\"yTickInterval\":null,\"yTickLength\":10,\"yTickPositions\":null,\"yTickAmount\":null,\"ttHeaderFormat\":\"<span style=\\'font-size: 10px\\'>{point.key}</span><br/>\",\"ttBodyFormat\":\"count: <b>{point.y}</b><br/>\",\"ttFooterFormat\":\"\",\"txtNoDataText\":\"No data to display.\",\"showCredits\":false,\"xAxisDataType\":\"datetime\",\"xAxisDataFormat\":\"%H:%M:%S\",\"yAxisDataType\":\"\",\"yAxisDataFormat\":\"\"},{\"add\":{\"title\":\"Status count\",\"position\":0,\"panelStyle\":{},\"width\":100},\"series\":[{\"metric\":{\"application\":\"27b2afe3-462d-4939-986b-6cc9e86d32f8\",\"collection\":\"a2272483-cef3-4ca2-9e2e-837ff560294a\",\"document\":\"test1\",\"field\":\"status\",\"attribute\":\"count\"},\"metric2\":{},\"metric2Enabled\":false,\"metric3\":{},\"metric3Enabled\":false,\"data\":[],\"guid\":\"f0ff0939-5ae9-446b-bfc4-40f7f99ed04e\",\"type\":\"inherit\",\"name\":\"status\",\"color\":null,\"zIndex\":1}],\"guid\":\"46e12ecf-5185-4499-a8dc-e82b9688715f\",\"type\":\"column\",\"active\":1,\"title\":null,\"subtitle\":null,\"zoom\":\"x\",\"showLegend\":true,\"cssHeight\":\"inherit\",\"xAxisType\":\"datetime\",\"xAxisTitle\":\"Time\",\"xAxisCategories\":null,\"xAxisMin\":null,\"xAxisMax\":null,\"xAxisOpposite\":false,\"xAxisReversed\":false,\"xAxisAllowDecimals\":true,\"xAxisOffset\":0,\"xTickInterval\":null,\"xTickLength\":10,\"xTickPositions\":null,\"xTickAmount\":null,\"yAxisType\":\"linear\",\"yAxisTitle\":\"Count\",\"yAxisCategories\":null,\"yAxisMin\":null,\"yAxisMax\":null,\"yAxisOpposite\":false,\"yAxisReversed\":false,\"yAxisAllowDecimals\":true,\"yAxisOffset\":0,\"yTickInterval\":null,\"yTickLength\":10,\"yTickPositions\":null,\"yTickAmount\":null,\"ttHeaderFormat\":\"<span style=\\'font-size: 10px\\'>{point.key}</span><br/>\",\"ttBodyFormat\":\"{series.name}: <b>{point.y}</b><br/>\",\"ttFooterFormat\":\"\",\"txtNoDataText\":\"No data to display.\",\"showCredits\":false,\"stacking\":null},{\"add\":{\"title\":\"Status ERROR\",\"position\":2,\"panelStyle\":{},\"width\":50},\"series\":[{\"metric\":{\"application\":\"27b2afe3-462d-4939-986b-6cc9e86d32f8\",\"collection\":\"a2272483-cef3-4ca2-9e2e-837ff560294a\",\"document\":\"test1\",\"field\":\"status\",\"attribute\":\"count\",\"searchTerm\":\"error\"},\"metric2\":{},\"metric2Enabled\":false,\"metric3\":{},\"metric3Enabled\":false,\"data\":[],\"guid\":\"2eaa155f-3c94-435f-cba0-b2349a8594ac\",\"type\":\"inherit\",\"name\":\"ERROR\",\"color\":null,\"zIndex\":1}],\"guid\":\"1b97cf9d-5066-43b4-d418-330358ed436f\",\"type\":\"bar\",\"active\":1,\"title\":null,\"subtitle\":null,\"zoom\":\"x\",\"showLegend\":true,\"cssHeight\":\"inherit\",\"xAxisType\":\"datetime\",\"xAxisTitle\":\"Time\",\"xAxisCategories\":null,\"xAxisMin\":null,\"xAxisMax\":null,\"xAxisOpposite\":false,\"xAxisReversed\":false,\"xAxisAllowDecimals\":true,\"xAxisOffset\":0,\"xTickInterval\":null,\"xTickLength\":10,\"xTickPositions\":null,\"xTickAmount\":null,\"yAxisType\":\"linear\",\"yAxisTitle\":\"Count\",\"yAxisCategories\":null,\"yAxisMin\":null,\"yAxisMax\":null,\"yAxisOpposite\":false,\"yAxisReversed\":false,\"yAxisAllowDecimals\":true,\"yAxisOffset\":0,\"yTickInterval\":null,\"yTickLength\":10,\"yTickPositions\":null,\"yTickAmount\":null,\"ttHeaderFormat\":\"<span style=\\'font-size: 10px\\'>{point.key}</span><br/>\",\"ttBodyFormat\":\"{series.name}: <b>{point.y}</b><br/>\",\"ttFooterFormat\":\"\",\"txtNoDataText\":\"No data to display.\",\"showCredits\":false,\"stacking\":null}],\"transientCfg\":{}}'), (u'b11a25f9-7c87-4c7e-937e-5fcd922584e6', u'Dashboard 1', u'{\"name\":\"Dashboard 1\",\"description\":\"First testing dashboard.\",\"guid\":\"b11a25f9-7c87-4c7e-937e-5fcd922584e6\",\"user\":null,\"active\":1,\"creationDate\":\"2015-09-22T17:23:17.110Z\",\"modificationDate\":\"2015-09-22T17:23:17.110Z\",\"datasources\":[],\"widgets\":[{\"add\":{\"title\":\"Line Graph 1\",\"position\":0,\"panelStyle\":{},\"width\":50},\"series\":[{\"metric\":{\"application\":\"27b2afe3-462d-4939-986b-6cc9e86d32f8\",\"collection\":\"a2272483-cef3-4ca2-9e2e-837ff560294a\",\"document\":\"test1\",\"field\":\"value\",\"attribute\":\"average\"},\"metric2\":{},\"metric2Enabled\":false,\"metric3\":{},\"metric3Enabled\":false,\"data\":[],\"guid\":\"8c2994c2-b4f6-47d5-c58d-7e3e2ed81043\",\"type\":\"inherit\",\"name\":\"average\",\"color\":null,\"zIndex\":1},{\"metric\":{\"application\":\"27b2afe3-462d-4939-986b-6cc9e86d32f8\",\"collection\":\"a2272483-cef3-4ca2-9e2e-837ff560294a\",\"document\":\"test1\",\"field\":\"value\",\"attribute\":\"min\"},\"metric2\":{},\"metric2Enabled\":false,\"metric3\":{},\"metric3Enabled\":false,\"data\":[],\"guid\":\"9c8f7ec0-90c5-4053-9a70-c70742d7104a\",\"type\":\"inherit\",\"name\":\"minimum\",\"color\":null,\"zIndex\":1},{\"metric\":{\"application\":\"27b2afe3-462d-4939-986b-6cc9e86d32f8\",\"collection\":\"a2272483-cef3-4ca2-9e2e-837ff560294a\",\"document\":\"test1\",\"field\":\"value\",\"attribute\":\"max\"},\"metric2\":{},\"metric2Enabled\":false,\"metric3\":{},\"metric3Enabled\":false,\"data\":[],\"guid\":\"600a422c-9804-4d65-b16f-0bc086a4f5ed\",\"type\":\"inherit\",\"name\":\"maximum\",\"color\":null,\"zIndex\":1}],\"guid\":\"b1de17e7-b35a-40a7-8519-d2493f1f31ac\",\"type\":\"line\",\"active\":1,\"title\":null,\"subtitle\":null,\"zoom\":\"x\",\"showLegend\":true,\"cssHeight\":\"inherit\",\"xAxisType\":\"datetime\",\"xAxisTitle\":\"Time\",\"xAxisCategories\":null,\"xAxisMin\":null,\"xAxisMax\":null,\"xAxisOpposite\":false,\"xAxisReversed\":false,\"xAxisAllowDecimals\":true,\"xAxisOffset\":0,\"xTickInterval\":null,\"xTickLength\":10,\"xTickPositions\":null,\"xTickAmount\":null,\"yAxisType\":\"linear\",\"yAxisTitle\":\"Value\",\"yAxisCategories\":null,\"yAxisMin\":0,\"yAxisMax\":50,\"yAxisOpposite\":false,\"yAxisReversed\":false,\"yAxisAllowDecimals\":true,\"yAxisOffset\":0,\"yTickInterval\":null,\"yTickLength\":10,\"yTickPositions\":null,\"yTickAmount\":null,\"ttHeaderFormat\":\"<span style=\\'font-size: 10px\\'>{point.key}</span><br/>\",\"ttBodyFormat\":\"{series.name}: <b>{point.y}</b><br/>\",\"ttFooterFormat\":\"\",\"txtNoDataText\":\"No data to display.\",\"showCredits\":false,\"lineWidth\":1}],\"transientCfg\":{}}')]",
			"dashboards": [
				["214d7a50-4645-4478-ad12-6068ceff5bc2", "Dashboard 2", "{\"name\":\"Dashboard 2\",\"description\":\"Testing various chart types\",\"guid\":\"214d7a50-4645-4478-ad12-6068ceff5bc2\",\"user\":null,\"active\":1,\"creationDate\":\"2015-10-07T13:51:33.307Z\",\"modificationDate\":\"2015-10-07T13:51:33.307Z\",\"datasources\":[],\"widgets\":[{\"add\":{\"title\":\"Status ratio\",\"position\":1,\"panelStyle\":{},\"width\":50},\"series\":[{\"metric\":{\"application\":\"27b2afe3-462d-4939-986b-6cc9e86d32f8\",\"collection\":\"a2272483-cef3-4ca2-9e2e-837ff560294a\",\"document\":\"test1\",\"field\":\"status\",\"attribute\":\"count\"},\"metric2\":{},\"metric2Enabled\":false,\"metric3\":{},\"metric3Enabled\":false,\"data\":[],\"guid\":\"15631edc-e071-4136-94a6-2b605cdb4d25\",\"type\":\"inherit\",\"name\":\"Pie Series\",\"color\":null,\"zIndex\":1}],\"guid\":\"5ce8b78c-d437-47ee-eef5-9c1449200112\",\"type\":\"pie\",\"active\":1,\"title\":null,\"subtitle\":null,\"zoom\":\"x\",\"showLegend\":true,\"cssHeight\":\"inherit\",\"xAxisType\":\"datetime\",\"xAxisTitle\":\"\",\"xAxisCategories\":null,\"xAxisMin\":null,\"xAxisMax\":null,\"xAxisOpposite\":false,\"xAxisReversed\":false,\"xAxisAllowDecimals\":true,\"xAxisOffset\":0,\"xTickInterval\":null,\"xTickLength\":10,\"xTickPositions\":null,\"xTickAmount\":null,\"yAxisType\":\"linear\",\"yAxisTitle\":\"\",\"yAxisCategories\":null,\"yAxisMin\":null,\"yAxisMax\":null,\"yAxisOpposite\":false,\"yAxisReversed\":false,\"yAxisAllowDecimals\":true,\"yAxisOffset\":0,\"yTickInterval\":null,\"yTickLength\":10,\"yTickPositions\":null,\"yTickAmount\":null,\"ttHeaderFormat\":\"<span style='font-size: 10px'>{point.key}</span><br/>\",\"ttBodyFormat\":\"count: <b>{point.y}</b><br/>\",\"ttFooterFormat\":\"\",\"txtNoDataText\":\"No data to display.\",\"showCredits\":false,\"xAxisDataType\":\"datetime\",\"xAxisDataFormat\":\"%H:%M:%S\",\"yAxisDataType\":\"\",\"yAxisDataFormat\":\"\"},{\"add\":{\"title\":\"Status count\",\"position\":0,\"panelStyle\":{},\"width\":100},\"series\":[{\"metric\":{\"application\":\"27b2afe3-462d-4939-986b-6cc9e86d32f8\",\"collection\":\"a2272483-cef3-4ca2-9e2e-837ff560294a\",\"document\":\"test1\",\"field\":\"status\",\"attribute\":\"count\"},\"metric2\":{},\"metric2Enabled\":false,\"metric3\":{},\"metric3Enabled\":false,\"data\":[],\"guid\":\"f0ff0939-5ae9-446b-bfc4-40f7f99ed04e\",\"type\":\"inherit\",\"name\":\"status\",\"color\":null,\"zIndex\":1}],\"guid\":\"46e12ecf-5185-4499-a8dc-e82b9688715f\",\"type\":\"column\",\"active\":1,\"title\":null,\"subtitle\":null,\"zoom\":\"x\",\"showLegend\":true,\"cssHeight\":\"inherit\",\"xAxisType\":\"datetime\",\"xAxisTitle\":\"Time\",\"xAxisCategories\":null,\"xAxisMin\":null,\"xAxisMax\":null,\"xAxisOpposite\":false,\"xAxisReversed\":false,\"xAxisAllowDecimals\":true,\"xAxisOffset\":0,\"xTickInterval\":null,\"xTickLength\":10,\"xTickPositions\":null,\"xTickAmount\":null,\"yAxisType\":\"linear\",\"yAxisTitle\":\"Count\",\"yAxisCategories\":null,\"yAxisMin\":null,\"yAxisMax\":null,\"yAxisOpposite\":false,\"yAxisReversed\":false,\"yAxisAllowDecimals\":true,\"yAxisOffset\":0,\"yTickInterval\":null,\"yTickLength\":10,\"yTickPositions\":null,\"yTickAmount\":null,\"ttHeaderFormat\":\"<span style='font-size: 10px'>{point.key}</span><br/>\",\"ttBodyFormat\":\"{series.name}: <b>{point.y}</b><br/>\",\"ttFooterFormat\":\"\",\"txtNoDataText\":\"No data to display.\",\"showCredits\":false,\"stacking\":null},{\"add\":{\"title\":\"Status ERROR\",\"position\":2,\"panelStyle\":{},\"width\":50},\"series\":[{\"metric\":{\"application\":\"27b2afe3-462d-4939-986b-6cc9e86d32f8\",\"collection\":\"a2272483-cef3-4ca2-9e2e-837ff560294a\",\"document\":\"test1\",\"field\":\"status\",\"attribute\":\"count\",\"searchTerm\":\"error\"},\"metric2\":{},\"metric2Enabled\":false,\"metric3\":{},\"metric3Enabled\":false,\"data\":[],\"guid\":\"2eaa155f-3c94-435f-cba0-b2349a8594ac\",\"type\":\"inherit\",\"name\":\"ERROR\",\"color\":null,\"zIndex\":1}],\"guid\":\"1b97cf9d-5066-43b4-d418-330358ed436f\",\"type\":\"bar\",\"active\":1,\"title\":null,\"subtitle\":null,\"zoom\":\"x\",\"showLegend\":true,\"cssHeight\":\"inherit\",\"xAxisType\":\"datetime\",\"xAxisTitle\":\"Time\",\"xAxisCategories\":null,\"xAxisMin\":null,\"xAxisMax\":null,\"xAxisOpposite\":false,\"xAxisReversed\":false,\"xAxisAllowDecimals\":true,\"xAxisOffset\":0,\"xTickInterval\":null,\"xTickLength\":10,\"xTickPositions\":null,\"xTickAmount\":null,\"yAxisType\":\"linear\",\"yAxisTitle\":\"Count\",\"yAxisCategories\":null,\"yAxisMin\":null,\"yAxisMax\":null,\"yAxisOpposite\":false,\"yAxisReversed\":false,\"yAxisAllowDecimals\":true,\"yAxisOffset\":0,\"yTickInterval\":null,\"yTickLength\":10,\"yTickPositions\":null,\"yTickAmount\":null,\"ttHeaderFormat\":\"<span style='font-size: 10px'>{point.key}</span><br/>\",\"ttBodyFormat\":\"{series.name}: <b>{point.y}</b><br/>\",\"ttFooterFormat\":\"\",\"txtNoDataText\":\"No data to display.\",\"showCredits\":false,\"stacking\":null}],\"transientCfg\":{}}"],
				["b11a25f9-7c87-4c7e-937e-5fcd922584e6", "Dashboard 1", "{\"name\":\"Dashboard 1\",\"description\":\"First testing dashboard.\",\"guid\":\"b11a25f9-7c87-4c7e-937e-5fcd922584e6\",\"user\":null,\"active\":1,\"creationDate\":\"2015-09-22T17:23:17.110Z\",\"modificationDate\":\"2015-09-22T17:23:17.110Z\",\"datasources\":[],\"widgets\":[{\"add\":{\"title\":\"Line Graph 1\",\"position\":0,\"panelStyle\":{},\"width\":50},\"series\":[{\"metric\":{\"application\":\"27b2afe3-462d-4939-986b-6cc9e86d32f8\",\"collection\":\"a2272483-cef3-4ca2-9e2e-837ff560294a\",\"document\":\"test1\",\"field\":\"value\",\"attribute\":\"average\"},\"metric2\":{},\"metric2Enabled\":false,\"metric3\":{},\"metric3Enabled\":false,\"data\":[],\"guid\":\"8c2994c2-b4f6-47d5-c58d-7e3e2ed81043\",\"type\":\"inherit\",\"name\":\"average\",\"color\":null,\"zIndex\":1},{\"metric\":{\"application\":\"27b2afe3-462d-4939-986b-6cc9e86d32f8\",\"collection\":\"a2272483-cef3-4ca2-9e2e-837ff560294a\",\"document\":\"test1\",\"field\":\"value\",\"attribute\":\"min\"},\"metric2\":{},\"metric2Enabled\":false,\"metric3\":{},\"metric3Enabled\":false,\"data\":[],\"guid\":\"9c8f7ec0-90c5-4053-9a70-c70742d7104a\",\"type\":\"inherit\",\"name\":\"minimum\",\"color\":null,\"zIndex\":1},{\"metric\":{\"application\":\"27b2afe3-462d-4939-986b-6cc9e86d32f8\",\"collection\":\"a2272483-cef3-4ca2-9e2e-837ff560294a\",\"document\":\"test1\",\"field\":\"value\",\"attribute\":\"max\"},\"metric2\":{},\"metric2Enabled\":false,\"metric3\":{},\"metric3Enabled\":false,\"data\":[],\"guid\":\"600a422c-9804-4d65-b16f-0bc086a4f5ed\",\"type\":\"inherit\",\"name\":\"maximum\",\"color\":null,\"zIndex\":1}],\"guid\":\"b1de17e7-b35a-40a7-8519-d2493f1f31ac\",\"type\":\"line\",\"active\":1,\"title\":null,\"subtitle\":null,\"zoom\":\"x\",\"showLegend\":true,\"cssHeight\":\"inherit\",\"xAxisType\":\"datetime\",\"xAxisTitle\":\"Time\",\"xAxisCategories\":null,\"xAxisMin\":null,\"xAxisMax\":null,\"xAxisOpposite\":false,\"xAxisReversed\":false,\"xAxisAllowDecimals\":true,\"xAxisOffset\":0,\"xTickInterval\":null,\"xTickLength\":10,\"xTickPositions\":null,\"xTickAmount\":null,\"yAxisType\":\"linear\",\"yAxisTitle\":\"Value\",\"yAxisCategories\":null,\"yAxisMin\":0,\"yAxisMax\":50,\"yAxisOpposite\":false,\"yAxisReversed\":false,\"yAxisAllowDecimals\":true,\"yAxisOffset\":0,\"yTickInterval\":null,\"yTickLength\":10,\"yTickPositions\":null,\"yTickAmount\":null,\"ttHeaderFormat\":\"<span style='font-size: 10px'>{point.key}</span><br/>\",\"ttBodyFormat\":\"{series.name}: <b>{point.y}</b><br/>\",\"ttFooterFormat\":\"\",\"txtNoDataText\":\"No data to display.\",\"showCredits\":false,\"lineWidth\":1}],\"transientCfg\":{}}"]
			]
		},
		"update": {
			"status": "OK",
			"dashboardId": "214d7a50-4645-4478-ad12-6068ceff5bc2",
			"response": "214d7a50-4645-4478-ad12-6068ceff5bc2"
		}
	},
	"DataService": {
		"listApplications": [
			["27b2afe3-462d-4939-986b-6cc9e86d32f8", "campaigns"]
		],
		"getDataAggregate": [{
			"name": "status info",
			"values": [
				[1448278140000, 5],
				[1448278155000, 5],
				[1448278170000, 5],
				[1448278185000, 1],
				[1448278200000, 5],
				[1448278215000, 3],
				[1448278230000, 2],
				[1448278245000, 5],
				[1448278260000, 6],
				[1448278275000, 5],
				[1448278290000, 5],
				[1448278305000, 6],
				[1448278320000, 3],
				[1448278335000, 4],
				[1448278350000, 4],
				[1448278365000, 2],
				[1448278380000, 4],
				[1448278395000, 5],
				[1448278410000, 2],
				[1448278425000, 9]
			],
			"id": "info"
		}, {
			"name": "status warning",
			"values": [
				[1448278140000, 5],
				[1448278155000, 4],
				[1448278170000, 5],
				[1448278185000, 8],
				[1448278200000, 6],
				[1448278215000, 4],
				[1448278230000, 6],
				[1448278245000, 6],
				[1448278260000, 5],
				[1448278275000, 6],
				[1448278290000, 7],
				[1448278305000, 4],
				[1448278320000, 11],
				[1448278335000, 3],
				[1448278350000, 6],
				[1448278365000, 7],
				[1448278380000, 6],
				[1448278395000, 6],
				[1448278410000, 10],
				[1448278425000, 3]
			],
			"id": "warning"
		}, {
			"name": "status error",
			"values": [
				[1448278140000, 5],
				[1448278155000, 6],
				[1448278170000, 5],
				[1448278185000, 6],
				[1448278200000, 4],
				[1448278215000, 7],
				[1448278230000, 7],
				[1448278245000, 4],
				[1448278260000, 4],
				[1448278275000, 4],
				[1448278290000, 3],
				[1448278305000, 4],
				[1448278320000, 1],
				[1448278335000, 8],
				[1448278350000, 5],
				[1448278365000, 6],
				[1448278380000, 5],
				[1448278395000, 3],
				[1448278410000, 3],
				[1448278425000, 1]
			],
			"id": "error"
		}],
		"getApplicationFields": {
			"27b2afe3-462d-4939-986b-6cc9e86d32f8": {
				"name": "campaigns",
				"collections": {
					"bf785777-27a9-4c19-b653-d52453d8c0f0": {
						"name": "website",
						"documents": {
							"test1": {
								"fields": {
									"status": {
										"type": "string",
										"attributes": ["count"]
									},
									"@timestamp": {
										"type": "date",
										"format": "dateOptionalTime",
										"attributes": ["count"]
									},
									"@type": {
										"type": "string",
										"attributes": ["count"]
									},
									"value": {
										"type": "long",
										"attributes": ["min", "max", "average"]
									},
									"docType": {
										"type": "string",
										"attributes": ["count"]
									}
								}
							}
						}
					}
				}
			}
		},
		"getData": [{
			"name": "info",
			"value": [1448278417016, 6]
		}, {
			"name": "warning",
			"value": [1448278417016, 7]
		}, {
			"name": "error",
			"value": [1448278417016, 3]
		}]
	},
	"User": {
		"getAll": [{
			"guid": "41cd9619-18b4-401f-9588-968a16f9a2e2",
			"name": "Test User 02",
			"email": "user02@test.com",
			"tenantGuid": "8c2c0f14-c8ae-418e-bae7-e5beda66d49f",
			"role": {
				"bitMask": 1,
				"title": "user"
			},
			"source": ["41cd9619-18b4-401f-9588-968a16f9a2e2", "Test User 02", "user02@test.com", "8c2c0f14-c8ae-418e-bae7-e5beda66d49f", 1]
		}, {
			"guid": "8c23be0b-7ff4-41c7-81ed-48fd8300a28e",
			"name": "Test User 01",
			"email": "user01@test.com",
			"tenantGuid": "8c2c0f14-c8ae-418e-bae7-e5beda66d49f",
			"role": {
				"bitMask": 1,
				"title": "user"
			},
			"source": ["8c23be0b-7ff4-41c7-81ed-48fd8300a28e", "Test User 01", "user01@test.com", "8c2c0f14-c8ae-418e-bae7-e5beda66d49f", 1]
		}, {
			"guid": "e4158785-0598-4d08-9c60-06a950225cfe",
			"name": "tenant1-admin",
			"email": "tenant1@t1.com",
			"tenantGuid": "8c2c0f14-c8ae-418e-bae7-e5beda66d49f",
			"role": {
				"bitMask": 2,
				"title": "tenant"
			},
			"source": ["e4158785-0598-4d08-9c60-06a950225cfe", "tenant1-admin", "tenant1@t1.com", "8c2c0f14-c8ae-418e-bae7-e5beda66d49f", 2]
		}],
		"add": {
			"status": "OK",
			"userId": "41cd9619-18b4-401f-9588-968a16f9a2e2"
		}
	},
	"Tenant": {},
	"Plugin": {
		"list": {
			"status": "OK",
			"plugins": []
		}
	},
	"Facet": {
		"list": {
			"status": "OK",
			"facets": [{
				"field": "status",
				"display_label": "Status Facet",
				"name": "test1_status_agg",
				"type": "terms"
			}]
		},
		"add": {
			"status": "OK"
		}
	}
});
