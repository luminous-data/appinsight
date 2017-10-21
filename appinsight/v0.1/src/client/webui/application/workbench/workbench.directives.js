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
	.directive("jsTree", [
		"$http", function(
		 $http) {

	var treeDir = {
		restrict: "EA",
//		template: "<script src='vendor/jsTree/jstree.min.js'></script>",
		getValueByLocation: function(obj, path) { // the path is in dot notation, e.g. foo.field
			var current = obj,
				loc = path.split(".");
			for (var i=0; i<loc.length; i++)
				current = current[ loc[i] ];
			return current;
		},
//		fetchNode: function(nodeToLoad, nodeFetchedCallback) {
//			nodeFetchedCallback.call(this, nodeChildren);
//		},
		fetchResource: function(url, callback) {
			return $http.get(url).then(function(data) {
				if (callback)
					callback(data.data);
			});
		},
		managePlugins: function(scope, elem, attr, config) {
			if (attr.treePlugins) {
				config.plugins = attr.treePlugins.split(",");
				config.core = config.core || {};
				config.core.check_callback = config.core.check_callback || true;
				
				if (config.plugins.indexOf("state") >= 0) {
					config.state = config.state || {};
//					config.state.key = attr.treeStateKey;
					config.state.key = treeDir.getValueByLocation(scope, attr.treeStateKey);
				}
				
				if (config.plugins.indexOf("search") >= 0) {
					var to = false;
					if (elem.next().attr("class") !== "ng-tree-search") {
						elem.after("<input type='text' placeholder='Search Tree' class='ng-tree-search'/>")
							.next()
							.on("keyup", function(event) {
								if (to) {
									clearTimeout(to);
								}
								to = setTimeout(function() {
									$(elem).jstree(true).search(event.target.value);
								}, 250);
							});
					}
				}
				
				if (config.plugins.indexOf("checkbox") >= 0) {
					config.checkbox = config.checkbox || {};
					config.checkbox.keep_selected_style = false;
				}
				
				if (config.plugins.indexOf("contextmenu") >= 0) {
					if (attr.treeContextmenu) {
						// contextmenu can be either a function, that returns menu items specific for a given node
						// or a static object, that holds identical menu items for all nodes
//						config.contextmenu = scope[attr.treeContextmenu];
						var contextmenu = treeDir.getValueByLocation(scope, attr.treeContextmenu);
						if ( angular.isFunction( contextmenu["items"] ) ) {
							// don't ask how the following block works... it just works
							contextmenu["items"] = (function(getItems) {
								return function(node, callback) {
									var items = getItems(node, callback);
									for (var fnName in items) {
										items[fnName]["action"] = (function(fn) {
											return function(data) {
												var inst = $.jstree.reference(data.reference),
												nodeJson = inst.get_node(data.reference);
												fn(nodeJson);
											};
										})( items[fnName]["action"] ); 
									}
									return items;
								};
							})(contextmenu["items"]);
						}
						else {
							for (var fnName in contextmenu["items"]) {
								contextmenu["items"][fnName]["action"] = (function(fn) {
									return function(data) {
										var inst = $.jstree.reference(data.reference),
										nodeJson = inst.get_node(data.reference);
										fn(nodeJson);
									};
								})( contextmenu["items"][fnName]["action"] ); 
							}
						}
						config.contextmenu = contextmenu;
					}
				}
				
				if (config.plugins.indexOf("types") >= 0) {
					if (attr.treeTypes) {
//						config.types = scope[attr.treeTypes];
						config.types = treeDir.getValueByLocation(scope, attr.treeTypes);
					}
				}
				
				if (config.plugins.indexOf("dnd") >= 0) {
					if (attr.treeDnd) {
//						config.dnd = scope[attr.treeDnd];
						config.dnd = treeDir.getValueByLocation(scope, attr.treeDnd);
					}
				}
			}
			return config;
		},
		manageEvents: function(scope, elem, attr) {
			if (attr.treeEvents) {
				var eventMap = attr.treeEvents.split(";");
				for (var i = 0; i < eventMap.length; i++) {
					if (eventMap[i].length > 0) {
						// plugins could have events with suffixes other than ".jstree"
						var evt = eventMap[i].split(":")[0];
						if (evt.indexOf(".") < 0) {
							evt = evt + ".jstree";
						}
						var cb = eventMap[i].split(":")[1];
						treeDir.tree.on(evt, treeDir.getValueByLocation(scope, cb));
					}
				}
			}
		},
		link: function(scope, elem, attr) {
			$(function() {
				var config = {};
				
				// users can define "core"
				config.core = {};
				if (attr.treeCore) {
					var treeCoreEvaluated = scope.$eval(attr.treeCore);
					config.core = $.extend(config.core, treeCoreEvaluated);
				}
				
				// clean Case
				attr.treeData = attr.treeData ? attr.treeData.toLowerCase() : "";
				attr.treeSrc = attr.treeSrc ? attr.treeSrc.toLowerCase() : "";
				
				if (attr.treeData == "html") {
					treeDir.fetchResource(attr.treeSrc, function(data) {
						elem.html(data);
						treeDir.init(scope, elem, attr, config);
					});
				}
				else if (attr.treeData == "json") {
					treeDir.fetchResource(attr.treeSrc, function(data) {
						config.core.data = data;
						treeDir.init(scope, elem, attr, config);
					});
				}
				else if (attr.treeData == "scope") {
//					scope.$watch(
//						function(scopeWatched) {
//							return treeDir.getValueByLocation(scopeWatched, attr.treeModel);
//						},
//						function(newVal, oldVal) {
//							if (newVal) {
//	//							config.core.data = scope[attr.treeModel];
//								config.core.data = treeDir.getValueByLocation(scope, attr.treeModel);
//								$(elem).jstree("destroy");
//								treeDir.init(scope, elem, attr, config);
//							}
//						},
//						true
//					);
					
					// if treeModel is a function, it takes args: nodeToLoad, callback
					// and is expected to call the callback with children of the nodeToLoad as an only argument
					// e.g.: callback.call(this, childrenNodes);
					config.core.data = treeDir.getValueByLocation(scope, attr.treeModel);
					treeDir.init(scope, elem, attr, config);
				}
				else if (attr.treeAjax) {
					config.core.data = {
						"url": attr.treeAjax,
						"data": function(node) {
							return {
								"id": node.id != "#" ? node.id : 1
							};
						}
					};
					treeDir.init(scope, elem, attr, config);
				}
			});
			
			if (attr.treeNodesToLoad) {
				scope.$watch(
					function(scopeWatched) {
						return treeDir.getValueByLocation(scopeWatched, attr.treeNodesToLoad);
					},
					function(newVal, oldVal) {
//						console.debug("treeNodesToLOAD changed, newVal/oldVal:");
//						console.debug(newVal);
//						console.debug(oldVal);
						var jstree = $(elem).jstree(true);
						if ( angular.isArray( newVal ) ) {
							for (var i=0; i<newVal.length; i++)
								jstree.load_node(newVal[i]);
						}
					}
				);
			}
			
			if (attr.treeNodesToOpen) {
				scope.$watch(
					function(scopeWatched) {
						return treeDir.getValueByLocation(scopeWatched, attr.treeNodesToOpen);
					},
					function(newVal, oldVal) {
						var jstree = $(elem).jstree(true);
						if ( angular.isArray( newVal ) ) {
							for (var i=0; i<newVal.length; i++)
								jstree.open_node(newVal[i]);
						}
					},
					true // use angular.equals instead of regular javascript ==
				);
			}
		},
		init: function(scope, elem, attr, config) {
			treeDir.managePlugins(scope, elem, attr, config);
			treeDir.tree = $(elem).jstree(config);
			treeDir.manageEvents(scope, elem, attr);
		}
	};
	
	return treeDir;
	
}]);
