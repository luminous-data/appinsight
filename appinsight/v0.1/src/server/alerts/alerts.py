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

import json, requests, datetime
import pyelasticsearch
from pyelasticsearch import ElasticSearch
import sys, traceback
from alertConstants import *
import simplejson

import logging

class Rule:

    def __init__(self):
        pass

    def getQuery(self, startTimeISOStr,endTimeISOStr, field, tsField ):
        numericQuery, mustCondition, timeRange = getNumericQueryComponenents()
        numericQuery['aggregations']['inrange']['filter']['bool']['must'] = []
        timeRange['range'][tsField] = {'from' : startTimeISOStr, 'to' : endTimeISOStr }
        mustCondition.append(timeRange)
        numericQuery['aggregations']['inrange']['aggs']['size_stats']['extended_stats']['field'] = field
        numericQuery['aggregations']['inrange']['filter']['bool']['must'] = mustCondition
        print str(numericQuery)
        searchTermQueryJson = simplejson.dumps(numericQuery, sort_keys=True, indent=4, separators=(',', ': '))
        print str(searchTermQueryJson)
        return numericQuery

    def trigger( self, startTimeISOStr, endTimeISOStr, searchIndex, docType, \
                 field, statistic, threshold, tsField):
        global logger
        numericQuery = self.getQuery(startTimeISOStr, endTimeISOStr, field, tsField)
        
        try:
            kwargs ={}
            kwargs['doc_type'] = docType
            esConn = ElasticSearch(ES_Host)
            result = esConn.search(numericQuery, index=searchIndex, **kwargs)
            print result
            sizeStats = result['aggregations']['inrange']['size_stats']
            if sizeStats[statistic] > threshold:
                print 'Threshold exceeded: ' + str(sizeStats[statistic])
                
        except Exception, ex:
            exc_type, exc_value, exc_traceback = sys.exc_info()
            traceback.print_tb(exc_traceback, limit=1, file=sys.stdout)
            print "*** print_exception:"
            traceback.print_exception(exc_type, exc_value, exc_traceback,
                                      limit=2, file=sys.stdout)
            logger.exception('Exception in alerts numeric')


def main(numericAlertsCondition, headersToSend):
    global logger
    logger = logging.getLogger('AlertDriver')
    (startTimeISOStr, endTimeISOStr) = getTimeRange()
    collection = numericAlertsCondition['searchCollection']
    req = requests.post(TENANT_SERVER_HOST + '/searchIndex/list', \
                        data = json.dumps({'collectionId' : collection}), \
                        headers=headersToSend)
    resp = json.loads(req.text)
    print 'Got the search indices' + str(resp)
    searchIndices = resp['searchIndices']
    searchIndex = ''
    for index in searchIndices[0]:
        if index != 'default':
            searchIndex = index
    
    print 'Will use search index ' + str(searchIndex)                   
    #searchIndex = '9d506341-7c3e-484d-83e0-732ed7046aa2'
    docType = numericAlertsCondition['docType']
    tsField = numericAlertsCondition['tsField']
    field = numericAlertsCondition['field']
    statistic = numericAlertsCondition['statistic']
    threshold = numericAlertsCondition['threshold']
    
    aRule = Rule()
    logger.info('Checking rule for Numeric Alert')
    aRule.trigger( startTimeISOStr, endTimeISOStr, searchIndex, \
                   docType, field, statistic, threshold, tsField )

def test():
    (startTimeISOStr, endTimeISOStr) = getTimeRange()
    searchIndex = 'af3c439b-4692-49d3-87e5-8f4bfa90be15'
    docType = 'apache-access'
    tsField = '@timestamp'
    field = 'bytes'
    statistic = 'doc_count'
    fieldKey = 'max'
    threshold = 0
    esHost = 'http://67.169.7.230:9200/'
    aRule = Rule()
    aRule.trigger( startTimeISOStr, endTimeISOStr, searchIndex, \
                   docType, field, fieldKey, statistic, threshold, tsField )
    
if __name__=='__main__':
    test()
