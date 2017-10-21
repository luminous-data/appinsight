#/*************************************************************************
# *
# Copyright 2016 Insightal Inc.

# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
# */

# These functions are imported by TenantServer.py.  They talk to
# ElasticSearch.

import datetime
import time

try:
    from bottle import request, response, route, get, post, abort, run, static_file, hook
    import simplejson
    import six, pyelasticsearch
    from pyelasticsearch import ElasticSearch
    import requests
    import TenantUtil
    from TenantServerCommon import *
    from alertConstants import * 
    import ConfigDb
except ImportError, ex:
    print 'TenantServerES.py: import error:', ex
    sys.exit(1)

esConn = None     # connection to elasticsearch

######################################################################
# Connects to ElasticSearch.
######################################################################
def initializeES():
    '''Connects to ElasticSearch.'''
    # Try server several times in case it's still starting up.
    connectionTryLimit = 60
    for count in range(connectionTryLimit):
        if count != 0: time.sleep(2)
        if connectToElasticSearch():
            print 'Connected to ElasticSearch'
            print 'esConn =', esConn
            return True
    print 'Giving up connecting to ElasticSearch'
    return False

######################################################################
#
# Connects to a ElasticSearch.
# return: True on success, False on failure
#
######################################################################
def connectToElasticSearch():
    global esConn
    esHost = ConfigDb.getStringValue('ElasticSearch', 'host', 'localhost', logger=getLogger())
    esPort = ConfigDb.getIntValue('ElasticSearch', 'port', 9200, logger=getLogger())
    esUrl = 'http://%s:%d/' % (esHost, esPort)
    getLogger().info("Connecting to ElasticSearch at %s" % esUrl)
    esConn = ElasticSearch(esUrl)

    # See if the connection worked.
    try:
        esConn.aliases()
        print 'Connected to ElasticSearch'
    except requests.exceptions.ConnectionError, ex:
        print "Can't connect to ElasticSearch:", ex
        return False

    # Check the ElasticSearch version number.
    try:
        result = esConn.send_request("GET",())
        esVersion = result['version']['number']
        esMajorVersion = int(esVersion.split('.')[0])
        if esMajorVersion < 1:
            print "*** Warning: ElasticSearch version number is %s: some features may not work" % esVersion
            # TODO: decide whether this should return False
    except Exception, ex:
        print "Warning: can't get the ElasticSearch version number", ex
        # TODO: decide whether this should return False
    return True

######################################################################
#
# Creates an ElasticSearch index.
#  esIndexName: the name of the ElasticSearch index to create
#  return: None on success, error message on error
#
######################################################################
def createElasticSearchIndex(esIndexName):
    try:
        esConn.create_index(esIndexName)
        getLogger().info('Created ElasticSearch index "%s"' % esIndexName)
    except pyelasticsearch.exceptions.IndexAlreadyExistsError:
        message = 'Tried to create ElasticSearch index "%s" that already exists' % esIndexName
        getLogger().error(message)
        return message
    except pyelasticsearch.exceptions.ElasticHttpError, ex:
        message = 'Error creating ElasticSearch index "%s": %s' % (esIndexName, ex)
        getLogger().error(message)
        return message
    return None

######################################################################
#
# Deletes an ElasticSearch index.  Not an error if the indes
# does not exist.
#  esIndexName: the name of the ElasticSearch index to delete
#
######################################################################
def deleteElasticSearchIndex(esIndexName):
    try:
        esConn.delete_index(esIndexName)
        getLogger().info('Deleted ElasticSearch index "%s"' % esIndexName)
    except pyelasticsearch.exceptions.ElasticHttpNotFoundError:
        getLogger().warning('Tried to delete ElasticSearch index "%s" that does not exist' % \
                            esIndexName)
    except pyelasticsearch.exceptions.ElasticHttpError, ex:
        getLogger().error('Error deleting ElasticSearch index "%s": %s' % (esIndexName, ex))

######################################################################
#
# Creates an ElasticSearch alias for an ElasticSearch index.
#  esAliasName: the name of the ElasticSearch alias to create
#  esIndexName: the name of the ElasticSearch index that
#    esAliasName is an alias for
#  return: None on success, error message on error
#
######################################################################
def createElasticSearchAlias(esAliasName, esIndexName):
    action = {'add' : {'alias': esAliasName, 'index': esIndexName} }
    try:
        esConn.update_aliases({"actions":[action]})
        getLogger().info('Created ElasticSearch alias "%s" for ElasticSearch index "%s"' % \
                         (esAliasName, esIndexName))
    except pyelasticsearch.exceptions.ElasticHttpNotFoundError:
        message = 'Tried to create ElasticSearch alias "%s" for non-existent ElasticSearch index "%s"' % \
                          (esAliasName, esIndexName)
        getLogger().error(message)
        return message
    return None


######################################################################
#
# Deletes an ElasticSearch alias.  Not an error if the alias does not
# exist.
#  esAliasName: the name of the ElasticSearch alias to delete
#  esIndexName: the name of the ElasticSearch index that
#    esAliasName is an alias for
#
######################################################################
def deleteElasticSearchAlias(esAliasName, esIndexName):
    action = {'remove' : {'alias': esAliasName, 'index': esIndexName} }
    try:
        esConn.update_aliases({"actions":[action]})
        getLogger().info('Deleted ElasticSearch alias "%s" for index "%s"' % \
                         (esIndexName, esIndexName))
    except pyelasticsearch.exceptions.ElasticHttpNotFoundError:
        getLogger().error('Tried to delete non-existent ElasticSearch alias "%s" for index "%s"' % \
                         (esIndexName, esIndexName))

@route('/mappings/list',method=['OPTIONS','POST'])
def listMappings():
    '''
Show the mappings (data types) for an ElasticSearch index.

The request data is a JSON object of the form:
 {'collectionId':COLLECTIONID}
 where:
 COLLECTIONID is the collection id

Response body on success:
 {'status':'OK','result':RESULT}
   where RESULT is the result from ElasticSearch

Response body on error:
 {'status':'ERROR','message':MESSAGE}
   where MESSAGE explains the error
   and other fields may contain additional information

If the request data JSON object contains "dryrun":1, then no query is issued
and the response body has the form:
 {'status':'DRYRUN','index':SEARCHINDICES}
where SEARCHINDICES is the list of ElasticSearch indices passed to
get_mapping()

Sample command to test this URL:
  curl -H "X-AUTH-HEADER: $s" --data-binary '{"collectionId":"cfebbd3e-0070-4d92-a6e4-952f464435a4"}' -H 'Content-Type: application/json' http://localhost:8080/mappings/list
'''
    if request.method == 'OPTIONS':
        return{}
    (status, obj, values, user) = getRequestParams(request, response,
                                                   ('collectionId',))
    # Make sure the required parameters are present.
    if not status:
        return values

    (dryrun,) = extractOptionalParams(obj, ['dryrun'])

    (collectionId,) = values
    try:
        searchIndexIdNameTuples = TenantUtil.listSearchIndices(collectionId)
    except Exception, ex:
        return simplejson.dumps({'status':'ERROR','message':str(ex)})
    searchIndices = [id for (id, name) in searchIndexIdNameTuples]

    if dryrun:
        reply = {'status':'DRYRUN','index':searchIndices}
    else:
        if getLogger():
            getLogger().debug('ES: ' +
                              str({'request':obj,
                                   'ESmethod':'get_mapping',
                                   'ESindex':searchIndices}))
        try:
            result = esConn.get_mapping(index=searchIndices)
            reply = {'status':'OK','result':result}
            if getLogger():
                getLogger().debug('ES: ' + str(reply))
        except Exception, ex:
            if getLogger():
                getLogger().error('ESerror: ' + str(ex))
            # TODO: provide better error messages
            reply = {'status':'ERROR','message':str(ex)}
    return simplejson.dumps(reply)        

######################################################################
# Show the fields for an ElasticSearch mapping (data type).
######################################################################
@route('/fields/list',method=['OPTIONS','POST'])
def listFields():
    '''
Show the fields for an ElasticSearch mapping (data type).

The request data is a JSON object of the form:
 {'collectionId':COLLECTIONID, 'mapping':MAPPING]
 where:
 COLLECTIONID is the collection id
 MAPPING is an ElasticSearch mapping (data type)

Response body on success:
 {'status':'OK','result':RESULT}
   where RESULT is the result from ElasticSearch

Response body on error:
 {'status':'ERROR','message':MESSAGE}
   where MESSAGE explains the error
   and other fields may contain additional information

If the request data JSON object contains "dryrun":1, then no query is issued
and the response body has the form:
 {'status':'DRYRUN','index':SEARCHINDICES}
where SEARCHINDICES is the list of ElasticSearch indices passed to
get_mapping()

Sample command to test this URL:
  curl -H "X-AUTH-HEADER: $s" --data-binary '{"collectionId":"cfebbd3e-0070-4d92-a6e4-952f464435a4","mapping":"apache-access"}' -H 'Content-Type: application/json' http://localhost:8080/fields/list
'''
    if request.method == 'OPTIONS':
        return{}
    (status, obj, values, user) = getRequestParams(request, response,
                                                   ('collectionId','mapping'))
    # Make sure the required parameters are present.
    if not status:
        return values

    (dryrun,) = extractOptionalParams(obj, ['dryrun'])

    (collectionId, mapping) = values
    try:
        searchIndexIdNameTuples = TenantUtil.listSearchIndices(collectionId)
    except Exception, ex:
        return simplejson.dumps({'status':'ERROR','message':str(ex)})
    searchIndices = [id for (id, name) in searchIndexIdNameTuples]

    if dryrun:
        reply = {'status':'DRYRUN','index':searchIndices}
    else:
        if getLogger():
            getLogger().debug('ES: ' +
                              str({'request':obj,
                                   'ESmethod':'get_mapping',
                                   'ESdoc_type':mapping,
                                   'ESindex':searchIndices}))
        try:
            result = esConn.get_mapping(index=searchIndices, doc_type=mapping)
            # There should be exactly one entry, since we asked about one mapping.
            # In that case, show just that entry.  # If for some reason the
            # number of entries is not 1, show the raw output.
            if len(result) == 1:
                reply = {'status':'OK','result':result[result.keys()[0]]}
            else:
                reply = {'status':'OK','result':result}
            if getLogger():
                getLogger().debug('ES: ' + str(reply))
        except Exception, ex:
            if getLogger():
                getLogger().error('ESerror: ' + str(ex))
            # TODO: provide better error messages
            reply = {'status':'ERROR','message':str(ex)}

    return simplejson.dumps(reply)        

@route('/getApplicationFields',method=['OPTIONS','POST'])
def getApplicationFields():
    '''
Show the ElasticSearch field definitions for all search indices
in an applications.

The request data is a JSON object of the form:
 {'applicationId':APPLICATIONID}
 where:
 APPLICATIONID is the id of the application whose search indices
   are to be returned

Response body on success:
 {'status':'OK','result':RESULTS}
   where RESULTS is a JSON list of JSON objects having one of the
   following two forms, depending on whether there is an error
   looking up the fields of an index
   {'collectionId':COLLECTIONID,'collectionName':COLLECTIONNAME',searchIndexId':SEARCHINDEXID,'searchIndexName':SEARCHINDEXNAME,'status':'OK','result':RESULT}
   {'collectionId':COLLECTIONID,'collectionName':COLLECTIONNAME',searchIndexId':SEARCHINDEXID,'searchIndexName':SEARCHINDEXNAME,'status':'ERROR','message':MESSAGE}
where:
  RESULT is the result from ElasticSearch
  MESSAGE is an error message

Response body if there is a database error:
 {'status':'ERROR','message':MESSAGE}
   where MESSAGE explains the error
   and other fields may contain additional information

Sample command to test this URL:
  curl -H "X-AUTH-HEADER: $s" --data-binary '{"applicationId":"64a5a1f8-4b96-4c39-b615-5b9a0b066152"}' -H 'Content-Type: application/json' http://localhost:8080/getApplicationFields
'''
    if request.method == 'OPTIONS':
        return{}
    (status, obj, values, user) = getRequestParams(request, response,
                                                   ('applicationId',))
    if not status:
        return values # error message

    applicationId, = values

    # Get a list of
    # collectionId/collectionName/searchIndexId/searchIndexName tuples
    # for this application.
    try:
        entries = TenantUtil.listCollectionSearchIndexPairsByApplication(applicationId)
    except Exception, ex:
        reply = {'status':'ERROR','message':str(ex)}
        return simplejson.dumps(reply)        

    results = [] # list of results for each collection/searchIndex pair
    for entry in entries:
        (collectionId, collectionName, searchIndexId, searchIndexName) = entry
        item = {'collectionId' : collectionId,
                'collectionName' : collectionName,
                'searchIndexId' : searchIndexId,
                'searchIndexName' : searchIndexName}
        # Each searchIndexId should be the name of an ElasticSearch index.
        # Look up the fields.
        if getLogger():
            getLogger().debug('ES: ' +
                              str({'request':obj,
                                   'ESmethod':'get_mapping',
                                   'ESdoc_type':'_all',
                                   'ESindex':searchIndexName}))
        try:
            result = esConn.get_mapping(index=searchIndexName, doc_type='_all')
            item['status'] = 'OK'
            item['result'] = result
        except  Exception, ex:
            if getLogger():
                getLogger().error('ESerror: ' + str(ex))
            item['status'] = 'ERROR'
            item['message'] = str(ex)
        results.append(item)

    reply = {'status':'OK', 'result':results}
    if getLogger():
        getLogger().debug('ES: ' + str(reply))
    return simplejson.dumps(reply)        

@route('/searchNew',method=['OPTIONS','POST'])
def searchNew():
    
    if request.method == 'OPTIONS':
        return {} 


    [searchTermQuery, mustCondition, timeRange, aggs] = \
                      getSearchTermQueryComponentsWithAggregations()
    searchTermQuery['size'] = 10
    (stat, obj, values, user) = getRequestParams(request, response,
                                                 ('collectionId','match'))
    (userId, userName, role) = user

    # Make sure the required parameters are present.
    if not stat:
        return values
    (collectionId, match) = values
    (doc_type, startTimeStr, endTimeStr, tstampField, resultSetFrom,
     aggregations, searchField, filters, dryrun) = \
               extractOptionalParams(obj, [''' 'doc_type' ''' '_type',
                                           'startTime',
                                           'endTime',
                                           'tstampField',
                                           'from',
                                           'aggregations',
                                           'searchField',
                                           'filters',
                                           'dryrun'])


    #getLogger().debug('Params for search request ' + ' doc_type: ' + doc_type)
    getLogger().debug(' filters: ' + str(filters) )
    getLogger().debug(' searchField: ' + str(searchField))
    (status, ranges) = getTimeRanges(startTimeStr, endTimeStr)
    (startTime, endTime) = status
    startTimeISOStr = startTime.isoformat() + 'Z'
    endTimeISOStr = endTime.isoformat() + 'Z'

    timeRange['range'][tstampField] = { 'from' : startTimeISOStr, \
                                        'to' : endTimeISOStr }
    if not searchField:
        searchField = '_all'

    mustCondition.append(timeRange)

    if filters and len(filters) > 0:
        for currFilter in filters:
            filterToAdd = {}
            if currFilter['type'] == 'term':
                filterToAdd['term'] = {}
                filterToAdd['term'][currFilter['field']] = currFilter['value']
            mustCondition.append(filterToAdd)
            if currFilter['type'] == 'term' and currFilter['field'] == '_type':
                doc_type = currFilter['value']


    '''
    For now, using the _type field in the filters as the doc_type. Need a proper way
    to figure out how to specify criteria and facets in search UI
    '''

    if doc_type:
        getLogger().debug(' doc_type: ' + doc_type)
    else:
        getLogger().debug(' doc_type is empty')

    searchTermQuery['query']['match'][searchField] = match

    searchTermQuery['filter']['bool']['must'] = mustCondition

    aggCriteria = None
    if aggregations:

        # TODO: combine with similar code in TenantServer.py
        userTenantIds = TenantUtil.listTenantsByUserId(userId,
                                                       logger=getLogger())
        # Find the user's tenant id in the database.
        if not userTenantIds:
            reply = {'status':'ERROR','message':"can't find tenant id for user id %s" % userId}
            return simplejson.dumps(reply);
        tenantId = userTenantIds[0]

        aggs['aggs']['inrange']['filter']['bool']['must'] = mustCondition

        if doc_type:
            getLogger().debug('Getting aggCriteria based on doc_type ' + str(doc_type))
            (ok, aggCriteria) = TenantUtil.getAggregationCriteria(doc_type, tenantId, True, False, getLogger())

            if not ok:
                aggCriteria = aggregationCriteria[doc_type]

        else:
            getLogger().debug('Getting aggCriteria when doc_type is not present ' + str(doc_type))
            (ok, aggCriteria) = TenantUtil.getAggregationCriteria('none', tenantId, True, False, getLogger())
            if not ok:
                aggCriteria = aggregationCriteria['none']
            #doc_type = 'none'



        getLogger().debug("aggregation criteria: %s" % aggCriteria)
        aggCriteriaByName = {}
        if aggCriteria:
            for criterion in aggCriteria:
                aggCriteriaByName[criterion['name']] = criterion

        getLogger().debug("Aggregation criteria by name : %s" % aggCriteriaByName)
        for criterion in aggCriteria:
            if criterion['type'] == 'terms':
                aggs['aggs']['inrange']['aggs'][criterion['name']] = {}
                aggs['aggs']['inrange']['aggs'][criterion['name']][criterion['type']] = {}
                aggs['aggs']['inrange']['aggs'][criterion['name']][criterion['type']]['field'] = criterion['field']
            if criterion['type'] == 'range':
                aggs['aggs']['inrange']['aggs'][criterion['name']] = {}
                aggs['aggs']['inrange']['aggs'][criterion['name']][criterion['type']] = {}
                aggs['aggs']['inrange']['aggs'][criterion['name']][criterion['type']]['field'] = criterion['field']
                aggs['aggs']['inrange']['aggs'][criterion['name']][criterion['type']]['ranges'] = ranges
        
        searchTermQuery.update(aggs)

    if resultSetFrom:
        print 'Adding the resultSetFrom '
        searchTermQuery["from"] = resultSetFrom

    kwargs = {}    
    if doc_type is not None:
        kwargs['doc_type'] = doc_type
        
    # For the /count service, ask ElasticSearch for just the
    # number of matching results, not the results themselves.
    '''
    if count:
        searchTermQuery["size"] = 0
    '''

    if not match:
        del searchTermQuery['query']
        
    try:
        searchIndexIdNameTuples = TenantUtil.listSearchIndices(collectionId)
    except Exception, ex:
        return simplejson.dumps({'status':'ERROR','message':str(ex)})
    searchIndices = [name for (id, name) in searchIndexIdNameTuples]

    searchTermQueryJson = simplejson.dumps(searchTermQuery, sort_keys=True, indent=4, separators=(',', ': '))
    getLogger().debug('Printing the search query')
    getLogger().debug(searchTermQueryJson)

    # If dryrun is specified, instead of running the query and returning
    # the result, return the query itself.
    if dryrun:
        reply = {'status':'DRYRUN','query':searchTermQuery,'kwargs':kwargs,'index':searchIndices}
    else:
        # Log the request and the ElasticSearch query.
        if getLogger():
            getLogger().debug('ES: ' +
                              str({'request':obj,
                                   'ESmethod':'search',
                                   'ESquery':searchTermQueryJson,
                                   'ESkwargs':kwargs,
                                   'ESindex':searchIndices}))
        try:
            result = esConn.search(searchTermQuery, index=searchIndices, **kwargs)
            # TODO: may want to extract fields from the ElasticSearch result
            # to provide a more useful result.
            reply = {'status':'OK', 'result':result}
            getLogger().debug('ES: ' + str(reply))
        except Exception, ex:
            # TODO: provide better error messages
            if getLogger():
                getLogger().error('ESerror: ' + str(ex))
            reply = {'status':'ERROR','message':str(ex)}

    if aggregations and reply['status'] == 'OK':
        aggs = reply['result']['aggregations']['inrange']
        resultAggs = {}
        
        for aggName, aggValue in aggs.items():
            getLogger().debug('AggName and value: ' + str(aggName) + ' ' + str(aggValue))
            if aggCriteriaByName.has_key(aggName):
                getLogger().debug('The aggCriteriaByName is ' + str(aggCriteriaByName[aggName]))
                aggProps = aggCriteriaByName[aggName]
                
                aggType = aggProps['type']
                aggField = aggProps['field']
                #aggDocType = aggCriteriaByName[aggName]
                aggDocType = doc_type
                if not aggDocType:
                    aggDocType = 'none'
                #print 'The doctype is ' + aggDocType
                if aggType == 'range':
                    dataPoints = []
                    for bucket in aggValue['buckets']:
                        print bucket
                        timeStamp = bucket['from_as_string']
                        count = bucket['doc_count']
                        dataPoints.append([timeStamp, count])
                    reply[aggName] = {'aggType' : aggType, 'aggField' : aggField, 'aggDocType' : aggDocType, 'data' : dataPoints}
                elif aggType == 'terms':
                    dataPoints = {}
                    for bucket in aggValue['buckets']:
                        key = bucket['key']
                        count = bucket['doc_count']
                        dataPoints[key] = count
                    reply[aggName] = {'aggType' : aggType, 'aggField' : aggField, 'aggDocType' : aggDocType, 'data' : dataPoints}


    '''
        Now modify the response to make it easier to consume
    '''
    try:
        hits = reply['result']['hits']['hits']
        new_hits = []

        status = reply['status']
        if status == 'OK':
            for hit in hits:
                source = hit['_source']
                new_hit = source.copy()
                new_hit.update(hit)
                del new_hit['_source']
                new_hits.append(new_hit)
        reply['searchResults'] = new_hits

        reply['searchResultsCount'] = reply['result']['hits']['total']
    except:
        getLogger().debug('No hits in search results: ' )


    try:
        aggs = reply['result']['aggregations']['inrange']

        dateRangeChartData = {}
        aggsForClient = []
        for aggName, aggValue in aggs.items():
            # Get the JSON representing the agg definition and figure out the type (range or term).
            # if range use 'from' and 'doc_count' field. If term use 'key' and 'doc_count' fields.
            #facetName = {'name' : aggName}
            #if facetName contains range then range type
            if aggCriteriaByName.has_key(aggName):
                aggType = aggCriteriaByName[aggName]['type']
                aggField = aggCriteriaByName[aggName]['field']
                aggDocType = doc_type
                if not aggDocType:
                    aggDocType = 'none'
                if aggType == 'terms':
                    aggBuckets = aggValue['buckets']
                    aggBucketKeys = [bucket['key'] for bucket in aggBuckets]
                    aggBucketValues = [bucket['doc_count'] for bucket in aggBuckets]
                    aggsForClient.append( { aggName : {'data' : zip(aggBucketKeys, aggBucketValues) ,\
                                                       'aggregationType' :  aggType,\
                                                       'aggregationField' : aggField,\
                                                       'docType' : aggDocType} })
                elif aggType == 'range':
                    aggBuckets = aggValue['buckets']
                    aggBucketKeys = [bucket['from'] for bucket in aggBuckets]
                    aggBucketValues = [bucket['doc_count'] for bucket in aggBuckets]

                    aggsForClient.append( { aggName : {'data' : zip(aggBucketKeys, aggBucketValues) ,\
                                                       'aggregationType' :  aggType,\
                                                       'aggregationField' : aggField,\
                                                       'docType' : aggDocType} })
                    if 'date_range_agg' in aggName:
                        dateRangeChartData = { aggName : {'data' : zip(aggBucketKeys, aggBucketValues) ,\
                                                       'aggregationType' :  aggType,\
                                                       'aggregationField' : aggField,\
                                                       'docType' : aggDocType} }
        getLogger().debug('Processed the aggs')
        reply['aggregations'] = aggsForClient
        reply['chartData'] = dateRangeChartData

    except Exception, ex:
        getLogger().debug('Exception in Processing the aggs')
        getLogger().exception('No aggs in search results: ')

    return simplejson.dumps(reply)


@route('/getAggregateStatsNew',method=['OPTIONS','POST'])
def getAggregateStatsNew():
    if request.method == 'OPTIONS':
        return {}

    (status, obj, values, user) = getRequestParams(request, response,
                                                   ('queryType',
                                                    'tstampField'))
    # Make sure the required parameters are present.
    if not status:
        return values

    (queryType, tstampField) = values

    # Get the optional parameters.
    (collectionId, field, startTimeStr, endTimeStr, match, statistic, dryrun) = \
                   extractOptionalParams(obj, ['collectionId', 'field',
                                               'startTime', 'endTime', 'match', 'statistic', 'dryrun'])

    # Get a list of time ranges.
    (status, ranges) = getTimeRanges(startTimeStr, endTimeStr)
    if not status:
        return ranges # error message serialized as a JSON object

    (startTime, endTime) = status
    startTimeISOStr = startTime.isoformat() + 'Z'
    endTimeISOStr = endTime.isoformat() + 'Z'

    finalQuery = None
    if queryType == 'numeric_stats':
        [numericQuery, mustCondition, timeRange] = getNumericQueryComponenentsWithAggs()
        numericQuery['aggs']['inrange']['aggs']['range'] = {}
        numericQuery['aggs']['inrange']['aggs']['range']['date_range'] = {}
        numericQuery['aggs']['inrange']['aggs']['range']['date_range']['field'] = tstampField
        numericQuery['aggs']['inrange']['aggs']['range']['date_range']['ranges'] = ranges
        numericQuery['aggs']['inrange']['aggs']['range']['aggs'] = {}
        numericQuery['aggs']['inrange']['aggs']['range']['aggs']['numeric_stats'] = {}
        numericQuery['aggs']['inrange']['aggs']['range']['aggs']['numeric_stats']['extended_stats'] = {}
        numericQuery['aggs']['inrange']['aggs']['range']['aggs']['numeric_stats']['extended_stats']['field'] = field
        timeRange['range'][tstampField] = { 'from' : startTimeISOStr, \
                                        'to' : endTimeISOStr }
        mustCondition.append(timeRange)
        numericQuery['aggs']['inrange']['filter']['bool']['must'] = mustCondition
        finalQuery = numericQuery
    elif queryType == 'term_query_stats':
        [searchTermQuery, mustCondition, timeRange, aggs] = \
                      getSearchTermQueryComponentsWithAggregations()
        searchTermQuery['size'] = 0
        searchTermQuery['query']['match'][field] = match
        searchTermQuery['filter']['bool']['must'] = mustCondition
        timeRange['range'][tstampField] = { 'from' : startTimeISOStr, \
                                        'to' : endTimeISOStr }
        mustCondition.append(timeRange)
        aggs['aggs']['inrange']['filter']['bool']['must'] = mustCondition
        aggs['aggs']['inrange']['aggs']['range'] = {}
        aggs['aggs']['inrange']['aggs']['range']['date_range'] = {}
        aggs['aggs']['inrange']['aggs']['range']['date_range']['field'] = tstampField
        aggs['aggs']['inrange']['aggs']['range']['date_range']['ranges'] = ranges
        searchTermQuery.update(aggs)
        finalQuery = searchTermQuery
    elif queryType == 'field_term_stats':
        [termQuery, mustCondition, timeRange] = getTermQueryComponents()
        timeRange['range'][tstampField] = { 'from' : startTimeISOStr, \
                                        'to' : endTimeISOStr }
        mustCondition.append(timeRange)
        termQuery['aggs']['inrange']['filter']['bool']['must'] = []
        termQuery['aggs']['inrange']['aggs']['terms_stats']['terms']['field'] = field
        termQuery['aggs']['inrange']['filter']['bool']['must'] = mustCondition
        termQuery['aggs']['inrange']['aggs']['range'] = {}
        termQuery['aggs']['inrange']['aggs']['range']['date_range'] = {}
        termQuery['aggs']['inrange']['aggs']['range']['date_range']['field'] = tstampField
        termQuery['aggs']['inrange']['aggs']['range']['date_range']['ranges'] = ranges
        termQuery['aggs']['inrange']['aggs']['range']['aggs'] = {}
        termQuery['aggs']['inrange']['aggs']['range']['aggs']['field_term_stats'] = {}
        termQuery['aggs']['inrange']['aggs']['range']['aggs']['field_term_stats']['terms'] = {}
        termQuery['aggs']['inrange']['aggs']['range']['aggs']['field_term_stats']['terms']['field'] = field
        finalQuery = termQuery

    searchIndices = ['_all']
    if collectionId:
        try:
            searchIndexIdNameTuples = TenantUtil.listSearchIndices(collectionId)
        except Exception, ex:
            # TODO: provide better error messages
            return simplejson.dumps({'status':'ERROR','message':str(ex)})
        searchIndices = [name for (id, name) in searchIndexIdNameTuples]
        if not searchIndices:
            msg = 'No search indices for collection %s' % collectionId
            return simplejson.dumps({'status':'ERROR','message':msg})

    # Comma-separated list of ElasticSearch index names.
    path = [','.join(searchIndices)]

    searchTermQueryJson = simplejson.dumps(finalQuery, sort_keys=True, indent=4, separators=(',', ': '))
    getLogger().debug('Printing the aggregation query')
    getLogger().debug(searchTermQueryJson)
    
    if dryrun:
        reply = {'status':'DRYRUN','query':finalQuery,'path':path}
    else:
        if getLogger():
            
            getLogger().debug('ES: ' +
                              str({'request':obj,
                                   'ESmethod':'getAggregateStatsNew',
                                   'ESquery':finalQuery,
                                   'ESindex':path}))
        try:
            result = esConn.search(finalQuery, index=path)
            
            reply = {'status':'OK', 'result':result}
            if getLogger():
                getLogger().debug('ES: ' + str(result))
        except Exception, ex:
            if getLogger():
                getLogger().error('ESerror: ' + str(ex))
            reply = {'status':'ERROR','message':str(ex)}

    if reply['status'] == 'OK':
        if queryType == 'numeric_stats':
            
            buckets = reply['result']['aggregations']['inrange']['range']['buckets']
            dataPoints = {}
            for bucket in buckets:
                timeStamp = bucket['from_as_string']
                numericStats = bucket['numeric_stats']
                for stat, value in numericStats.items():
                    if dataPoints.has_key(stat):
                        dataPoints[stat].append([timeStamp, value])
                    else:
                        dataPoints[stat] = []
                        dataPoints[stat].append([timeStamp, value])
            reply['aggs'] = { 'data' : dataPoints }
        elif queryType == 'term_query_stats':
            
            buckets = reply['result']['aggregations']['inrange']['range']['buckets']
            dataPoints = []
            for bucket in buckets:
                docCount = bucket['doc_count']
                timeStamp = bucket['from_as_string']
                dataPoints.append([timeStamp,docCount])
            
            reply['aggs'] = { 'data' : dataPoints }
        elif queryType == 'field_term_stats':
            
            buckets = reply['result']['aggregations']['inrange']['range']['buckets']
            dataPoints = {}
            for bucket in buckets:
                timeStamp = bucket['from_as_string']
                fieldValueBuckets = bucket['field_term_stats']['buckets']
                for val in fieldValueBuckets:
                    key = val['key']
                    count = val['doc_count']
                    if dataPoints.has_key(key):
                        dataPoints[key].append([timeStamp, count])
                    else:
                        dataPoints[key] = []
                        dataPoints[key].append([timeStamp, count])
            
            reply['aggs'] = { 'data' : dataPoints }

    if statistic is None or statistic == '':
        statistic = 'avg'
    aggsForClient = []
    dashboardAggs = reply['result']['aggregations']['inrange']['range']
    if queryType == 'numeric_stats':
        aggBuckets = dashboardAggs['buckets']
        aggBucketKeys = [bucket['from'] for bucket in aggBuckets]

        aggBucketValues = [bucket['numeric_stats'][statistic] for bucket in aggBuckets]
        aggsForClient.append( { 'data' : zip(aggBucketKeys, aggBucketValues) })
    elif queryType == 'term_query_stats':
        aggBuckets = dashboardAggs['buckets']
        aggBucketKeys = [bucket['from'] for bucket in aggBuckets]
        aggBucketValues = [bucket['doc_count'] for bucket in aggBuckets]
        aggsForClient.append( { 'data' : zip(aggBucketKeys, aggBucketValues) })
    elif queryType == 'field_term_stats':
        buckets = dashboardAggs['buckets']
        dataPoints = {}
        for bucket in buckets:
            timeStamp = bucket['from']
            fieldValueBuckets = bucket['field_term_stats']['buckets']
            for val in fieldValueBuckets:
                key = val['key']
                count = val['doc_count']
                if dataPoints.has_key(key):
                    dataPoints[key].append([timeStamp, count])
                else:
                    dataPoints[key] = []
                    dataPoints[key].append([timeStamp, count])
        aggsForClient = dataPoints


    reply['aggregations'] = aggsForClient


    resp = simplejson.dumps(reply, sort_keys=True, indent=4, separators=(',', ': '))
    getLogger().debug('Printing the aggregation response')
    getLogger().debug(resp)
    return simplejson.dumps(reply)




@route('/getAggregateStatsNextDatapointNew',method=['OPTIONS','POST'])
def getAggregateStatsNextDatapointNew():
    if request.method == 'OPTIONS':
        return {}

    (status, obj, values, user) = getRequestParams(request, response,
                                                   ('queryType',
                                                    'tstampField'))
    # Make sure the required parameters are present.
    if not status:
        return values

    (queryType, tstampField) = values

    # Get the optional parameters.
    (collectionId, field, startTimeStr, endTimeStr, match, statistic, dryrun) = \
                   extractOptionalParams(obj, ['collectionId', 'field',
                                               'startTime', 'endTime', 'match', 'statistic', 'dryrun'])

    startTimeISOStr = datetime.datetime.fromtimestamp(startTimeStr).isoformat() + 'Z'
    endTimeISOStr = datetime.datetime.fromtimestamp(endTimeStr).isoformat() + 'Z'


    finalQuery = None
    if queryType == 'numeric_stats':
        [numericQuery, mustCondition, timeRange] = getNumericQueryComponenentsWithAggs()

        numericQuery['aggs']['inrange']['aggs']['numeric_stats'] = {}
        numericQuery['aggs']['inrange']['aggs']['numeric_stats']['extended_stats'] = {}
        numericQuery['aggs']['inrange']['aggs']['numeric_stats']['extended_stats']['field'] = field
        timeRange['range'][tstampField] = { 'from' : startTimeISOStr, \
                                        'to' : endTimeISOStr }
        mustCondition.append(timeRange)
        numericQuery['aggs']['inrange']['filter']['bool']['must'] = mustCondition
        finalQuery = numericQuery
    elif queryType == 'term_query_stats':
        [searchTermQuery, mustCondition, timeRange, aggs] = \
                      getSearchTermQueryComponentsWithAggregations()
        searchTermQuery['size'] = 0
        searchTermQuery['query']['match'][field] = match
        searchTermQuery['filter']['bool']['must'] = mustCondition
        timeRange['range'][tstampField] = { 'from' : startTimeISOStr, \
                                        'to' : endTimeISOStr }
        mustCondition.append(timeRange)
        aggs['aggs']['inrange']['filter']['bool']['must'] = mustCondition

        searchTermQuery.update(aggs)
        finalQuery = searchTermQuery
    elif queryType == 'field_term_stats':
        [termQuery, mustCondition, timeRange] = getTermQueryComponents()
        timeRange['range'][tstampField] = { 'from' : startTimeISOStr, \
                                        'to' : endTimeISOStr }
        mustCondition.append(timeRange)
        termQuery['aggs']['inrange']['filter']['bool']['must'] = []
        termQuery['aggs']['inrange']['aggs']['terms_stats']['terms']['field'] = field
        termQuery['aggs']['inrange']['filter']['bool']['must'] = mustCondition

        finalQuery = termQuery

    searchIndices = ['_all']
    if collectionId:
        try:
            searchIndexIdNameTuples = TenantUtil.listSearchIndices(collectionId)
        except Exception, ex:
            # TODO: provide better error messages
            return simplejson.dumps({'status':'ERROR','message':str(ex)})
        searchIndices = [name for (id, name) in searchIndexIdNameTuples]
        if not searchIndices:
            msg = 'No search indices for collection %s' % collectionId
            return simplejson.dumps({'status':'ERROR','message':msg})

    # Comma-separated list of ElasticSearch index names.
    path = [','.join(searchIndices)]

    searchTermQueryJson = simplejson.dumps(finalQuery, sort_keys=True, indent=4, separators=(',', ': '))
    getLogger().debug('Printing the aggregation query')
    getLogger().debug(searchTermQueryJson)

    if dryrun:
        reply = {'status':'DRYRUN','query':finalQuery,'path':path}
    else:
        if getLogger():

            getLogger().debug('ES: ' +
                              str({'request':obj,
                                   'ESmethod':'getAggregateStatsNew',
                                   'ESquery':finalQuery,
                                   'ESindex':path}))
        try:
            result = esConn.search(finalQuery, index=path)

            reply = {'status':'OK', 'result':result}
            if getLogger():
                getLogger().debug('ES: ' + str(result))
        except Exception, ex:
            if getLogger():
                getLogger().error('ESerror: ' + str(ex))
            reply = {'status':'ERROR','message':str(ex)}
    '''
    if reply['status'] == 'OK':
        if queryType == 'numeric_stats':

            buckets = reply['result']['aggregations']['inrange']['range']['buckets']['']
            dataPoints = {}
            for bucket in buckets:
                timeStamp = bucket['from_as_string']
                numericStats = bucket['numeric_stats']
                for stat, value in numericStats.items():
                    if dataPoints.has_key(stat):
                        dataPoints[stat].append([timeStamp, value])
                    else:
                        dataPoints[stat] = []
                        dataPoints[stat].append([timeStamp, value])
            reply['aggs'] = { 'data' : dataPoints }
        elif queryType == 'term_query_stats':

            buckets = reply['result']['aggregations']['inrange']['range']['buckets']
            dataPoints = []
            for bucket in buckets:
                docCount = bucket['doc_count']
                timeStamp = bucket['from_as_string']
                dataPoints.append([timeStamp,docCount])

            reply['aggs'] = { 'data' : dataPoints }
        elif queryType == 'field_term_stats':

            buckets = reply['result']['aggregations']['inrange']['range']['buckets']
            dataPoints = {}
            for bucket in buckets:
                timeStamp = bucket['from_as_string']
                fieldValueBuckets = bucket['field_term_stats']['buckets']
                for val in fieldValueBuckets:
                    key = val['key']
                    count = val['doc_count']
                    if dataPoints.has_key(key):
                        dataPoints[key].append([timeStamp, count])
                    else:
                        dataPoints[key] = []
                        dataPoints[key].append([timeStamp, count])

            reply['aggs'] = { 'data' : dataPoints }
    '''
    if statistic is None or statistic == '':
        statistic = 'avg'
    aggsForClient = []
    dashboardAggs = reply['result']['aggregations']['inrange']
    if queryType == 'numeric_stats':
        aggValue = dashboardAggs['numeric_stats'][statistic]
        aggsForClient.append( { 'data' : aggValue })
    elif queryType == 'term_query_stats':
        aggValue = dashboardAggs['doc_count']
        aggsForClient.append( { 'data' : aggValue })
    elif queryType == 'field_term_stats':
        buckets = dashboardAggs['terms_stats']['buckets']
        dataPoints = {}
        for bucket in buckets:
            key = bucket['key']
            count = bucket['doc_count']
            dataPoints[key] = count
        aggsForClient = dataPoints


    reply['aggregations'] = aggsForClient


    resp = simplejson.dumps(reply, sort_keys=True, indent=4, separators=(',', ': '))
    getLogger().debug('Printing the aggregation response')
    getLogger().debug(resp)
    return simplejson.dumps(reply)



######################################################################
# Calculates a list of 15-second begin/end time ranges for use in a
# "ranges" ElasticSearch query.
#  startTimeStr: the start time as a string, or None
#  endTimeStr: the end time as a string, or None
# Note: startTimeStr and endTimeStr must either both be present or
# both be absent (None).  In the latter case, the end time is the
# current time rounded up to the next multiple of 15 seconds, and
# the start time is 5 minutes before the end time.
#  return:
#    on success: ((startTime, endTime), ranges)
#      where startTime and endTime are datetime.datetime objects
#      corresponding to startTimeStr and endTimeStr if they are
#      provided, otherwise the values described above;
#      and ranges is a list of dictionaries of the form
#      {"from":beginPeriod, "to":endPeriod} where beginPeriod and
#      endPeriod are in ISO 8601 format
#    on failure: (False, message)
#      where message is a JSON object serialized as a string that can be
#      returned as the response to an HTTP request.
######################################################################
def getTimeRanges(startTimeStr, endTimeStr):
    numIntervals = 20
    if startTimeStr and endTimeStr:
        # Parse the start and end times and make sure they're valid.
        (startTimeStatus, startTime) = parseTimestamp(startTimeStr)
        (endTimeStatus, endTime) = parseTimestamp(endTimeStr)
        if not startTimeStatus or not endTimeStatus:
            return (False,
                    simplejson.dumps({'status':'ERROR','message':'invalid timestamp'}))

        # Make sure startTime is earlier than endTime.
        if not startTime < endTime:
            return (False,
                    simplejson.dumps({'status':'ERROR', 'message':'startTime >= endTime'}))
        # Make sure the difference is at least one microsecond per interval.
        if (endTime - startTime) < datetime.timedelta(microseconds=numIntervals):
            return (False,
                    simplejson.dumps({'status':'ERROR', 'message':'startTime and endTime are too close together'}))
    # If both startTimeStr and endTimeStr are not present, make sure they're
    # both absent.
    elif startTimeStr:
        return (False,
                simplejson.dumps({'status':'ERROR','message':'missing input parameter',
                                  'missing-parameter':'endTime'}))
    elif endTimeStr:
        return (False,
                simplejson.dumps({'status':'ERROR','message':'missing input parameter',
                                  'missing-parameter':'startTime'}))
    else:
        # The start and end times were not provided.  For the end time,
        # get the time interval that ends on a multiple of 15 seconds and
        # includes the current time.
        endTime = datetime.datetime.utcnow().replace(microsecond=0)
        # Current seconds modulo 15.
        rem = endTime.second % 15
        # If not a multiple of 15 seconds, get the end of the 15-second interval.
        if rem > 0:
            endTime += datetime.timedelta(seconds=15-rem)
        # Start 5 minutes before the end time when numIntervals is 20.
        startTime = endTime - datetime.timedelta(seconds=15*numIntervals)

    # Get equally spaced intervals between the start time and the end time.
    # Start with endTime and work back to startTime.
    ranges = []
    endPeriod = endTime
    timeDelta = (endTime - startTime) / numIntervals
    ranges = []
    for idx in range(numIntervals):
        beginPeriod = endPeriod - timeDelta
        ranges.append({"from":beginPeriod.isoformat()+'Z',
                       "to":endPeriod.isoformat()+'Z'})
        endPeriod = beginPeriod
    return ((startTime, endTime), ranges)
