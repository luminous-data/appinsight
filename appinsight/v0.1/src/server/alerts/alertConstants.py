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

import datetime, threading, time
import aniso8601

def getTermQueryComponents():
    termQuery = {   'size': 0 , 'aggregations' : { 'inrange' : \
                                               { 'filter' : { 'bool' : { }}, \
                'aggs' : { 'terms_stats' : { 'terms' : {}}}}}}
    mustCondition = []
    timeRange = { 'range' : { } }

    return [termQuery, mustCondition, timeRange]

def getNumericQueryComponenents():
    numericQuery = {   'size': 0 , 'aggregations' : { 'inrange' : \
                                                   { 'filter' : { 'bool' : { }}, \
                    'aggs' : { 'size_stats' : { 'extended_stats' : {}}}}}}
                
    mustCondition = []
    timeRange = { 'range' : { } }

    return [numericQuery, mustCondition, timeRange]

def getSearchTermQueryComponents():
    searchTermQuery = { 'size': 0, \
                        'query' : { 'match' : { } }, \
                        'filter' : { 'bool' : { } } }
    mustCondition = []
    timeRange = { 'range' : { } }
    return [searchTermQuery, mustCondition, timeRange]

def getSearchTermQueryComponentsWithAggregations():
    [searchTermQuery, mustCondition, timeRange] = getSearchTermQueryComponents()
    aggs = { 'aggregations' : { 'inrange' : \
                                { 'filter' : { 'bool' : { }}, \
                                  'aggs' : { }}}}
    return [searchTermQuery, mustCondition, timeRange, aggs]


aggregationCriteria = { 'apache-access' : [], \
                        'cpu' : [], \
                        'none' : [{'name' : 'doctype_agg', 'field': '_type', 'type' : 'terms'}, \
                                  {'name' : 'date_range_agg', 'field' : '@timestamp', 'type' : 'range' }] }
    
ES_Host = 'http://192.168.2.30:9200/'
TENANT_SERVER_HOST = 'http://localhost:8080'
HEADERS = {'Content-type':'application/json'}


def getTimeRange(endTimeStr = None):
    if endTimeStr != None:
        print endTimeStr
        endTime = aniso8601.parse_datetime(endTimeStr)
        endTime = endTime.replace(tzinfo=None)
        startTime = endTime - datetime.timedelta(seconds=15)
        startTimeISOStr = startTime.isoformat() + 'Z'
        endTimeISOStr = endTime.isoformat() + 'Z'
        return (startTimeISOStr, endTimeISOStr)
    
    now = datetime.datetime.utcnow()
    endTime = None
    currTime = datetime.datetime.utcnow().replace(microsecond=0)
    seconds = currTime.second
    if seconds > 45:
        endTime = currTime - datetime.timedelta(seconds=currTime.second-45)
    elif seconds > 30:
        endTime = currTime - datetime.timedelta(seconds=currTime.second-30)
    elif seconds > 15:
        endTime = currTime - datetime.timedelta(seconds=currTime.second-15)
    else:
        endTime = currTime.replace(second=0)

    startTime = endTime - datetime.timedelta(seconds=15)
    startTimeISOStr = startTime.isoformat() + 'Z'
    endTimeISOStr = endTime.isoformat() + 'Z'
    return (startTimeISOStr, endTimeISOStr)

