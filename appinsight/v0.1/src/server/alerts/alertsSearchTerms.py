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

    def getQuery(self, startTimeISOStr,endTimeISOStr, field, searchTerm, tsField ):
        searchTermQuery,  mustCondition, timeRange = getSearchTermQueryComponents()
        
        timeRange['range'][tsField] = {'from' : startTimeISOStr, 'to' : endTimeISOStr }
        mustCondition.append(timeRange)
        searchTermQuery['query']['match'][field] = searchTerm
        searchTermQuery['filter']['bool']['must'] = mustCondition
        print str(searchTermQuery)
        searchTermQueryJson = simplejson.dumps(searchTermQuery, sort_keys=True, indent=4, separators=(',', ': '))
        print str(searchTermQueryJson)
        return searchTermQuery

    def trigger(self, startTimeISOStr, endTimeISOStr, searchIndex, docType, field, searchTerm, statistic, threshold, tsField):
        termQuery = self.getQuery(startTimeISOStr, endTimeISOStr, field, searchTerm, tsField)
        
        try:
            kwargs ={}
            kwargs['doc_type'] = docType
            esConn = ElasticSearch(ES_Host)
            result = esConn.search(termQuery, index=searchIndex, **kwargs)
            print result
            
            count = result['hits']['total']
            if count > threshold:
                print 'Have count > threshold '
        except Exception, ex:
            exc_type, exc_value, exc_traceback = sys.exc_info()
            traceback.print_tb(exc_traceback, limit=1, file=sys.stdout)
            print "*** print_exception:"
            traceback.print_exception(exc_type, exc_value, exc_traceback,
                                      limit=2, file=sys.stdout)
            return

def main(fieldTermAlertsCondition, headersToSend):
    global logger
    logger = logging.getLogger('AlertDriver')
    (startTimeISOStr, endTimeISOStr) = getTimeRange()
    collection = fieldTermAlertsCondition['searchCollection']
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
    
    docType = fieldTermAlertsCondition['docType']
    tsField = fieldTermAlertsCondition['tsField']
    field = fieldTermAlertsCondition['field']
    searchTerm = fieldTermAlertsCondition['searchTerm']
    statistic = fieldTermAlertsCondition['statistic']
    threshold = fieldTermAlertsCondition['threshold']
    

    aRule = Rule()
    logger.info('Checking rule for String Alert')
    aRule.trigger(  startTimeISOStr, endTimeISOStr, searchIndex, \
                    docType, field, searchTerm, statistic, threshold, tsField )
    
if __name__=='__main__':
    main()
