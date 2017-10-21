import json, requests, datetime
import pyelasticsearch
from pyelasticsearch import ElasticSearch
import sys, traceback
from alertConstants import *



class Rule:

    def __init__(self):
        pass

    def getQuery(self, startTimeISOStr,endTimeISOStr, field, tsField ):
        termQuery,  mustCondition, timeRange = getTermQueryComponents()
        termQuery['aggregations']['inrange']['filter']['bool']['must'] = []
        timeRange['range'][tsField] = {'from' : startTimeISOStr, 'to' : endTimeISOStr }
        mustCondition.append(timeRange)
        termQuery['aggregations']['inrange']['aggs']['terms_stats']['terms']['field'] = field
        termQuery['aggregations']['inrange']['filter']['bool']['must'] = mustCondition
        print str(termQuery)
        return termQuery

    def trigger(self, startTimeISOStr, endTimeISOStr, searchIndex, docType, field, fieldKey, statistic, threshold, tsField):
        global logger
        termQuery = self.getQuery(startTimeISOStr, endTimeISOStr, field, tsField)
        
        try:
            kwargs ={}
            kwargs['doc_type'] = docType
            esConn = ElasticSearch(ES_Host)
            result = esConn.search(termQuery, index=searchIndex, **kwargs)
            print result
            
            buckets = result['aggregations']['inrange']['terms_stats']['buckets']
            print str(buckets)
            for bucket in buckets:
                if bucket['key'] == fieldKey:
                    if bucket[statistic] > threshold:
                        print 'Have non zero error responses'
        except Exception, ex:
            exc_type, exc_value, exc_traceback = sys.exc_info()
            traceback.print_tb(exc_traceback, limit=1, file=sys.stdout)
            print "*** print_exception:"
            traceback.print_exception(exc_type, exc_value, exc_traceback,
                                      limit=2, file=sys.stdout)
            logger.exception('Exception in alerts terms')
            return

def main():
    global logger
    logger = logging.getLogger('AlertDriver')
    (startTimeISOStr, endTimeISOStr) = getTimeRange()
    searchIndex = 'af3c439b-4692-49d3-87e5-8f4bfa90be15'
    docType = 'apache-access'
    tsField = '@timestamp'
    field = 'response'
    statistic = 'doc_count'
    fieldKey = '404'
    threshold = 0
    esHost = 'http://67.169.7.230:9200/'

    aRule = Rule()
    logger.info('Checking rule for Terms Alert')
    aRule.trigger(  startTimeISOStr, endTimeISOStr, searchIndex, \
                    docType, field, fieldKey, statistic, threshold, tsField )
    
if __name__=='__main__':
    main()
