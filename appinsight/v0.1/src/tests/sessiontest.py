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

import requests
import json
from config import *

headersToSend = HEADERS
tenantId = ''
groups = []
apps = []
collections = []

#
def login():
    global tenantId
    r = requests.post(HOST + '/login', data=json.dumps(DEFAULT_TENANT), headers=headersToSend)
    print 'The response status of login is ' + str(r)
    print r.text
    loginResponse = json.loads(r.text)

    print 'The username is ' + loginResponse['username']
    print 'The role is ' + str(loginResponse['role'])
    print 'The userId is ' + loginResponse['userId']
    print 'The tenantId is ' + loginResponse['tenantIds'][0]
    tenantId = loginResponse['tenantIds'][0]
    headers = r.headers

    sessionId = headers['X-Auth-Header']
    #add session id to the headers to send in subsequent calls
    headersToSend['X-Auth-Header'] = sessionId

def addTenant():
    global tenantId
    '''
    r = requests.post(HOST + '/login', data= json.dumps(SITEADMIN_LOGIN), headers=headersToSend)
    print r.text
    loginResponse = json.loads(r.text)
    siteAdminTenantId = loginResponse['tenantIds'][0]
    headers = r.headers
    sessionId = headers['X-Auth-Header']

    headersToUse = HEADERS
    headersToUse['X-Auth-Header'] = sessionId
    '''
    payload = { 'name':'tenantnew', 'password':'tenantnew', \
                'email':'tenantnew@tenant' }
    resp = requests.post(HOST + '/tenant/new', data=json.dumps(payload), headers=headersToSend)
    print resp.text
    createTenantResp = json.loads(resp.text)
    tenantId = createTenantResp['tenantId']
    print 'The tenant Id of the newly created tenant is ' + tenantId

def addUser():
    payload = { 'name':'testuser6', 'password':'welcome6', \
                'email':'testuser6@tenant', 'tenantId' : tenantId, 'role':2 }
    
    resp = requests.post(HOST + '/user/new', data=json.dumps(payload), headers=headersToSend)

    print 'The response code of adding user is ' + str(resp)
    print 'The response headers are ' + str(resp.headers)

def addGroup():
    payload = { 'tenantId' : tenantId, 'name':'marketing3' }
    resp = requests.post(HOST + '/group/new', data=json.dumps(payload), headers=headersToSend)

    print 'The response code of adding group is ' + str(resp)
    print 'The response headers are ' + str(resp.headers)


def getGroups():
    global groups
    payload = { 'tenantId' : tenantId }
    resp = requests.post(HOST + '/group/list', data=json.dumps(payload), headers=headersToSend)

    print 'The response of listing group is ' + str(resp.text)
    print 'The response headers are ' + str(resp.headers)
    
    groupsResponse = json.loads(resp.text)
    groups = groupsResponse['groups']

def addApplication():
    groupId = groups[0][0]
    payload = { 'groupId' : groupId, 'name':'My App 2' }
    resp = requests.post(HOST + '/application/new', data=json.dumps(payload), headers=headersToSend)

    print 'The response code of adding application is ' + str(resp)
    print 'The response headers are ' + str(resp.headers)

def getApplications():
    global apps
    groupId = groups[0][0]
    payload = { 'groupId' : groupId }
    resp = requests.post(HOST + '/application/list', data=json.dumps(payload), headers=headersToSend)
    appsResp = json.loads(resp.text)
    print 'The response of getting application is ' + str(resp.text)
    print 'The response headers are ' + str(resp.headers)
    apps = appsResp['applications']


def addCollection():
    appId = apps[0][0]
    payload = { 'applicationId' : appId, 'name':'My Collection 2' }
    resp = requests.post(HOST + '/collection/new', data=json.dumps(payload), headers=headersToSend)

    print 'The response code of adding collection is ' + str(resp)
    print 'The response headers are ' + str(resp.headers)
    

def getCollections():
    global collections
    #appId = apps[0][0]
    #payload = { 'applicationId' : appId }
    payload = { 'applicationId' : 'b2653a86-b04d-421b-bd54-ed2b67bf7a2f', 'name' :'marketing'}

    resp = requests.post(HOST + '/collection/list', data=json.dumps(payload), headers=headersToSend)

    print 'The response of getting collection is ' + str(resp.text)
    print 'The response headers are ' + str(resp.headers)
    collsResp = json.loads(resp.text)
    collections = collsResp['collections']

def addIndex():
    collectionId = collections[0][0]
    payload = { 'collectionId' : collectionId, 'name':'apache 2' }
    resp = requests.post(HOST + '/searchIndex/new', data=json.dumps(payload), headers=headersToSend)

    print 'The response code of adding index is ' + str(resp)
    print 'The response headers are ' + str(resp.headers)

def getIndexes():
    collectionId = collections[0][0]
    payload = { 'collectionId' : collectionId}
    resp = requests.post(HOST + '/searchIndex/list', data=json.dumps(payload), headers=headersToSend)

    print 'The response code of getting index is ' + str(resp.text)
    print 'The response headers are ' + str(resp.headers)

def getApplicationFields():
    appId = apps[0][0]
    payload = { 'applicationId' : appId}
    resp = requests.post(HOST + '/getApplicationFields', data=json.dumps(payload), headers=headersToSend)

    print 'The response code of getting application fields is ' + str(resp.text)
    print 'The response headers are ' + str(resp.headers)


def getQueryStats():
    payload = {'queryType':'statistical', 'metric': 'bytes' , 'tstampField':'@timestamp', 'collection': '1272da7f-787e-452f-ad18-b93c17891f2b'}
    resp = requests.post(HOST + '/queryStats', data=json.dumps(payload), headers=headersToSend)
    print 'The response code of getting query stats is ' + str(resp.text)
    print 'The response headers are ' + str(resp.headers)


def getQueryHistogram():
    payload = {'queryType':'histogram', 'metric': 'bytes' , 'tstampField':'@timestamp', 'collection': '1272da7f-787e-452f-ad18-b93c17891f2b'}
    resp = requests.post(HOST + '/queryStats', data=json.dumps(payload), headers=headersToSend)
    print 'The response code of getting query histogram is ' + str(resp.text)
    print 'The response headers are ' + str(resp.headers)


def addDashboard():
    payload = { 'name' : 'test dashboard', 'dashboard' : '{ "widget" : " text3" }' }
    resp = requests.post(HOST + '/dashboard/new', data=json.dumps(payload), headers=headersToSend)
    print 'The response code of creating dashboard is ' + str(resp.text)
    print 'The response headers are ' + str(resp.headers)


def updateDashboard():
    payload = { 'id' : '72631a6c-c0e9-4a8e-88fc-c1e58cf7b05d', 'dashboard' : '{ "widget" : " text 2" }' }
    resp = requests.post(HOST + '/dashboard/update', data=json.dumps(payload), headers=headersToSend)
    print 'The response code of updating dashboard is ' + str(resp.text)
    print 'The response headers are ' + str(resp.headers)

def getDashboards():
    payload = {}
    resp = requests.post(HOST + '/dashboard/list', data=json.dumps(payload), headers=headersToSend)
    print 'The response code of getting dashboard is ' + str(resp.text)
    print 'The response headers are ' + str(resp.headers)

def getTermCounts():
    payload = {'collectionId' : '0352a682-887c-4e98-b2b5-d55246cdab4c', 'field' : 'response'}
    resp = requests.post(HOST + '/termCounts', data=json.dumps(payload), headers=headersToSend)
    print 'The response code of getting dashboard is ' + str(resp.text)
    print 'The response headers are ' + str(resp.headers)


def search():
    #payload = {'collections' : ['65863dbc-be77-4137-8c0c-eb030e72c791'], 'match' : '200',  "tstampField":"@timestamp", "startTime":"2014-06-03T19:39:30Z","endTime":"2014-06-20T19:39:45Z", "from" : 11}
    payload = {'collectionId' : '0352a682-887c-4e98-b2b5-d55246cdab4c', 'match' : '200',  "tstampField":"@timestamp", "startTime":"2014-07-03T19:39:30Z","endTime":"2014-07-20T19:39:45Z", "from" : 11}

    resp = requests.post(HOST + '/search', data=json.dumps(payload), headers=headersToSend)
    print 'The response code of search is ' + str(resp.text)
    print 'The response headers are ' + str(resp.headers)


def searchWithAggregations():
    #payload = {'collections' : ['65863dbc-be77-4137-8c0c-eb030e72c791'], 'match' : '200',  "tstampField":"@timestamp", "startTime":"2014-06-03T19:39:30Z","endTime":"2014-06-20T19:39:45Z", "from" : 11}
    payload = {'collectionId' : '0352a682-887c-4e98-b2b5-d55246cdab4c', 'match' : '200',  "tstampField":"@timestamp", "aggregations" : 1}
    #payload = {'collectionId' : '73e82fdf-87e7-45e4-96a0-866cbc94e85e',  'match' : '200',  "tstampField":"@timestamp", "aggregations" : 1}

    resp = requests.post(HOST + '/search', data=json.dumps(payload), headers=headersToSend)
    print 'The response code of search is ' + str(json.dumps(json.loads(resp.text), sort_keys=True, indent=4, separators=(',', ': ')))
    print 'The response headers are ' + str(resp.headers)


def searchWithAggregationsNew():
    filters = [{'type' : 'term', 'field' : '_all', 'value' : 'http'}]
    '''
    payload = {'collectionId' : '8961ff9f-452e-4511-a022-c15878321499', \
               'match' : 'Selected option 2', \
               "tstampField":"@timestamp", \
               "aggregations" : 1, \
               "endTime": "2014-11-03T13:55:40Z", \
               "startTime": "2014-10-31T13:55:40Z"}
    '''
    payload = {'collectionId' : '8961ff9f-452e-4511-a022-c15878321499', \
               'match' : '200', \
               "tstampField":"@timestamp", \
               "aggregations" : 1, 'filters' : filters }
    resp = requests.post(HOST + '/searchNew', data=json.dumps(payload), headers=headersToSend)
    print resp.text
    print 'The response of searchWithAggregationsNew is \n' + str(json.dumps(json.loads(resp.text), sort_keys=True, indent=4, separators=(',', ': ')))
    #print 'The response code of search is ' + str(json.dumps(json.loads(resp), sort_keys=True, indent=4, separators=(',', ': ')))
    print 'The response headers are ' + str(resp.headers)
    '''
    jsonResp = json.loads(resp.text)
    aggs = jsonResp['result']['aggregations']['inrange']
    resultAggs = {}
    
    for aggName, aggValue in aggs.items():
        print aggValue
        print aggName
        if aggCriteriaByName.has_key(aggName):
            print 'The aggCriteriaByName is ' + str(aggCriteriaByName[aggName])
            aggProps = aggCriteriaByName[aggName][0]
            
            aggType = aggProps['type']
            aggField = aggProps['field']
            aggDocType = aggCriteriaByName[aggName][1]
            print 'The doctype is ' + aggDocType
            if aggType == 'range':
                dataPoints = []
                for bucket in aggValue['buckets']:
                    print bucket
                    timeStamp = bucket['from_as_string']
                    count = bucket['doc_count']
                    dataPoints.append([timeStamp, count])
                resultAggs[aggName] = {'aggType' : aggType, 'aggField' : aggField, 'aggDocType' : aggDocType, 'data' : dataPoints}
            elif aggType == 'terms':
                dataPoints = {}
                for bucket in aggValue['buckets']:
                    key = bucket['key']
                    count = bucket['doc_count']
                    dataPoints[key] = count
                resultAggs[aggName] = {'aggType' : aggType, 'aggField' : aggField, 'aggDocType' : aggDocType, 'data' : dataPoints}
    print 'Printing the results of search with aggregations\n'
    print resultAggs
    '''            
        

'''
    getAggregateStats calls /getAggregateStats for a numeric field. In this case the field is "bytes" so we will get statistics for numbers - average, min, max etc. 
'''
def getAggregateStats():
    payload = {'collections' : '9ffc4297-28d6-4946-98f1-a68d26cf1a61', 'queryType' : 'size_stats', 'metric' : 'bytes', "tstampField":"@timestamp", "dryrun" : 1}

    resp = requests.post(HOST + '/getAggregateStats', data=json.dumps(payload), headers=headersToSend)
    print '\n\n\n'
    print 'The response code of getAggregateStats is ' + str(resp.text)
    print 'The response is \n' + str(json.dumps(json.loads(resp.text), sort_keys=True, indent=4, separators=(',', ': ')))
    
    print 'The response headers are ' + str(resp.headers)


def getAggregateStatsNew():
    payload = {'collections' : '8961ff9f-452e-4511-a022-c15878321499', 'queryType' : 'numeric_stats', 'field' : 'bytes', "tstampField":"@timestamp", "dryrun" : 0}
    
    resp = requests.post(HOST + '/getAggregateStatsNew', data=json.dumps(payload), headers=headersToSend)
    print '\n\n\n'    
    print 'The response of getAggregateStatsNew is \n' + str(json.dumps(json.loads(resp.text), sort_keys=True, indent=4, separators=(',', ': ')))
    
    print 'The response headers are ' + str(resp.headers)
    '''
    jsonResp = json.loads(resp.text)
    buckets = jsonResp['result']['aggregations']['inrange']['range']['buckets']
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
    aggs = {'aggs' : { 'data' : dataPoints } }
    print 'Printing the results of aggregate stats new'    
    print '\n' + str(aggs)
    '''

def getAggregateStatsNextDatapointNewNumeric():

    startTime = 1441405000
    endTime = 1441405060

    payload = {'collections' : '8961ff9f-452e-4511-a022-c15878321499', 'startTime' : startTime, \
               'endTime' : endTime, 'queryType' : 'numeric_stats', 'field' : 'bytes', \
               "tstampField":"@timestamp", "dryrun" : 0}

    resp = requests.post(HOST + '/getAggregateStatsNextDatapointNew', data=json.dumps(payload), headers=headersToSend)
    print '\n\n\n'
    print 'The response of getAggregateStatsNextDatapointNew is \n' + str(json.dumps(json.loads(resp.text), sort_keys=True, indent=4, separators=(',', ': ')))

    print 'The response headers are ' + str(resp.headers)


def getAggregateStatsNextDatapointNewQueryTerms():

    startTime = 1441405000
    endTime = 1441405060

    payload = {'collections' : '8961ff9f-452e-4511-a022-c15878321499', 'startTime' : startTime, \
               'endTime' : endTime, 'queryType' : 'term_query_stats', 'field' : 'http_status', \
               'match' : '200', "tstampField":"@timestamp", "dryrun" : 0}

    resp = requests.post(HOST + '/getAggregateStatsNextDatapointNew', data=json.dumps(payload), headers=headersToSend)
    print '\n\n\n'
    print 'The response of getAggregateStatsNextDatapointNew is \n' + str(json.dumps(json.loads(resp.text), sort_keys=True, indent=4, separators=(',', ': ')))
    print 'The response headers are ' + str(resp.headers)

def getAggregateStatsNextDatapointNewFieldTerms():

    startTime = 1441405000
    endTime = 1441405060

    payload = {'collections' : '8961ff9f-452e-4511-a022-c15878321499', 'startTime' : startTime, \
               'endTime' : endTime, 'queryType' : 'field_term_stats', 'field' : 'http_status', \
               "tstampField":"@timestamp", "dryrun" : 0}

    resp = requests.post(HOST + '/getAggregateStatsNextDatapointNew', data=json.dumps(payload), headers=headersToSend)
    print '\n\n\n'
    print 'The response of getAggregateStatsNextDatapointNew is \n' + str(json.dumps(json.loads(resp.text), sort_keys=True, indent=4, separators=(',', ': ')))
    print 'The response headers are ' + str(resp.headers)

def getAggregateStatsNewForFieldTerms():
    payload = {'collections' : '8961ff9f-452e-4511-a022-c15878321499', 'queryType' : 'field_term_stats', 'field' : 'http_status', "tstampField":"@timestamp", "dryrun" : 0}

    resp = requests.post(HOST + '/getAggregateStatsNew', data=json.dumps(payload), headers=headersToSend)
    print '\n\n\n'
    #print 'The response code of getAggregateStatsNewForFieldTerms is ' + str(resp.text)
    print 'The response of getAggregateStatsNewForFieldTerms is \n' + str(json.dumps(json.loads(resp.text), sort_keys=True, indent=4, separators=(',', ': ')))
    
    print 'The response headers are ' + str(resp.headers)
    '''
    jsonResp = json.loads(resp.text)
    buckets = jsonResp['result']['aggregations']['inrange']['range']['buckets']
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
    aggs = { 'aggs' : { 'data' : dataPoints } }
    print 'Printing the result of aggregatestatsu for field terms\n'
    print '\n' + str(aggs)
    '''

def getAggregateStatsNewForQueryTerms():
    payload = {'collections' : '8acece86-4354-49ce-b268-b966dcf27083', 'queryType' : 'term_query_stats', 'match' : '200', 'field' : 'http_status', "tstampField":"@timestamp", "dryrun" : 0}

    resp = requests.post(HOST + '/getAggregateStatsNew', data=json.dumps(payload), headers=headersToSend)
    print '\n\n\n'    
    print 'The response of getAggregateStatsNewForQueryTerms is \n' + str(json.dumps(json.loads(resp.text), sort_keys=True, indent=4, separators=(',', ': ')))
    
    print 'The response headers are ' + str(resp.headers)
    '''
    jsonResp = json.loads(resp.text)
    buckets = jsonResp['result']['aggregations']['inrange']['range']['buckets']
    dataPoints = []
    for bucket in buckets:
        docCount = bucket['doc_count']
        timeStamp = bucket['from_as_string']
        dataPoints.append([timeStamp,docCount])
    aggs = { 'aggs' : { 'data' : dataPoints } }
    print 'Printing the results of aggregation for query terms\n'
    print aggs
    '''    
        
    
    
    
'''
    /getAggregateStats for terms gets statistics for a field whose value is a string. So the return value is a count of the # of times each value of the term has been seen
    in each time period. For example, the field is "response" whose value can be 200, 300, 404, 500, and a finite set of values. 

'''
def getAggregateStatsForTerms():
    payload = {'collections' : '8961ff9f-452e-4511-a022-c15878321499', 'queryType' : 'status_counts', 'metric' : 'response', "tstampField":"@timestamp"}
    resp = requests.post(HOST + '/getAggregateStats', data=json.dumps(payload), headers=headersToSend)
    print '\n\n\n'
    print 'The response code of getAggregateStatsForTermssearch is ' + str(resp.text)
    print 'The response headers are ' + str(resp.headers)

def getMappings():
    payload = {'collectionId' : '0352a682-887c-4e98-b2b5-d55246cdab4c'}
    resp = requests.post(HOST + '/mappings/list', data=json.dumps(payload), headers=headersToSend)
    print '\n\n\n'
    print 'The response code of getMappings is ' + str(resp.text)
    print 'The response headers are ' + str(resp.headers)
    jsonResp = json.loads(resp.text)
    result = jsonResp['result']
    print '\n'
    for indexName, indexData in result.items():
        print 'The index is ' + indexName + '\n'
        mappings = indexData['mappings']
        for mappingName, mappingFields in mappings.items():
            print '\n Mapping ' + mappingName
            fieldProps = mappingFields['properties']
            print '\n Mapping Fields ' + str(mappingFields)
            for fieldName, fieldType in fieldProps.items():
                print 'The field name is ' + fieldName
                print 'The fieldType is ' + str(fieldType)
                #if fieldType.has_key('type') and type(fieldType['type']) is str:
                if fieldType.has_key('type'):
                    print 'The field type is ' + fieldType['type']
                
                    
            
    return result
    '''
    respBody = resp.json
    respJson = json.loads(respBody)
    mappings = respJson['result']['mappings']
    
    for mapping in mappings:
        print mapping
    '''


def getApplicationFields():
    payload = {'applicationId' : 'd1ad7b19-be07-409a-ba3b-c9cc0df2f958'}
    resp = requests.post(HOST + '/getApplicationFields', data=json.dumps(payload), headers=headersToSend)
    print '\n\n\n'
    print 'The response code of getApplicationFields is ' + str(resp.text)
    print 'The response headers are ' + str(resp.headers)
    jsonResp = json.loads(resp.text)
    return jsonResp
    

def listAlerts():
    resp = requests.post(HOST + '/alert/list', \
                         headers=headersToSend)
    print 'The response code of listAlerts is ' + str(resp.text)

def addAlert():
    payload = { 'alertType': 'NUMERIC', \
                'name' : 'numbytes GT 100',
                       'desc' : '',
                       'collection' : '8961ff9f-452e-4511-a022-c15878321499', 
                       'docType' : 'apacheAccess', 
                       'tsField' : '@timestamp',
                       'field' : 'bytes',
                       'statistic' : 'max',
                       'threshold' : 100,
                       'condition' : ''}
    resp = requests.post(HOST + '/alert/add', data=json.dumps(payload), headers=headersToSend)
    print '\n\n\n'
    print 'The response code of getApplicationFields is ' + str(resp.text)
    print 'The response headers are ' + str(resp.headers)
    jsonResp = json.loads(resp.text)
    return jsonResp
    

def deleteAlert():
    payload = { 'id' : '9e29dbca-e149-4454-afed-2f59961effe7'}
    resp = requests.post(HOST + '/alert/delete', data=json.dumps(payload), headers=headersToSend)
    print '\n\n\n'
    print 'The response code of deleteAlert is ' + str(resp.text)
    print 'The response headers are ' + str(resp.headers)
    jsonResp = json.loads(resp.text)
    return jsonResp
    
def getAggregationCriteria():
    payload = { 'docType' : 'test1'}
    resp = requests.post(HOST + '/aggregationCriteria/list', data=json.dumps(payload), headers=headersToSend)
    print '\n\n\n'
    print 'The response code of getAggregationCriteria  is ' + str(resp.text)
    print 'The response headers are ' + str(resp.headers)
    jsonResp = json.loads(resp.text)
    return jsonResp

def main():
    #addTenant()
    login()
    #getAggregateStatsNextDatapointNewNumeric()
    #getAggregateStatsNextDatapointNewQueryTerms()
    #getAggregateStatsNextDatapointNewFieldTerms()
    #addTenant()
    #getAggregationCriteria()
    #addTenant()
    #addUser()
    #addGroup()
    #getGroups()
    #print '\n Got Groups'
    #addApplication()
    #getApplications()
    #addCollection()
    getCollections()
    #addIndex()
    #getIndexes()
    #getApplicationFields()
    #getQueryStats()
    #getQueryHistogram()
    #addDashboard()
    #updateDashboard()
    #getDashboards()
    #getTermCounts()
    #search()
    #getAggregateStats()
    #getAggregateStatsNew()
    #getAggregateStatsNewForFieldTerms()
    #getAggregateStatsNewForQueryTerms()
    #getAggregateStatsForTerms()
    #searchWithAggregations()
    #getMappings()
    #getApplicationFields()
    #getQuery()
    #searchWithAggregationsNew()
    #listAlerts()
    #addAlert()
    #deleteAlert()

if __name__=='__main__':
    main()

#aggregationCriteria = { 'apacheAccess' : [{'name' : 'apacheAccess_http_status_agg', 'field' : 'http_status', 'type' : 'terms'}], \
#                        'cpu' : [], \
#                        'none' : [{'name' : 'none_doctype_agg', 'field': '_type', 'type' : 'terms'}, \
#                                  {'name' : 'none_date_range_agg', 'field' : '@timestamp', 'type' : 'range' }], \
#                        'Java' : [ {'name' : 'Java_msg_level_agg' , 'field' : 'level' , 'type' : 'terms' } ] \
#                        }
#
#aggCriteriaByName = {}
#for docType, criteria in aggregationCriteria.items():
#    print 'The docType in aggCriteria by name is ' + docType
#    for criterion in criteria:
#        aggCriteriaByName[criterion['name']] = [criterion, docType]
#
#    



