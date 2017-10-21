import datetime

'''
def customizeEvent(record, logger):

    timestamp = record.get('time')
    if not timestamp:
        _logger.error('missing "time" input parameter')
        return {'result' : 'error, missing "time" input parameter'}
    try:
        utcTimestamp = datetime.datetime.utcfromtimestamp(timestamp)
    except Exception, ex:
        _logger.error('invalid "time" input parameter; ' + str(ex))
        return {'result' : 'error, invalid "time" input parameter; ' + str(ex)}
    isoTimestamp = utcTimestamp.isoformat() + 'Z'
    record['@timestamp'] = isoTimestamp
    docType = record.get('docType')
    record['@type'] = docType
    logger.info('eventType = ' + str(eventType))
    logger.info('record = ' + str(record))
    return record
'''

'''
For processing collectd events sent from write_http
'''
def customizeEvent(req, logger):
    returnRecs = []
    for record in req:
        logger.info('record = ' + str(record))
        plugin = record.get('plugin')
        if not plugin:
            logger.error('missing "plugin" input parameter')
            return 'error, missing "plugin" input parameter'

        pluginInstance = record.get('plugin_instance')
        if not pluginInstance:
            logger.error('missing "plugin_instance" input parameter')
            return 'error, missing "plugin_instance" input parameter'

        eventType = record.get('type')
        if not eventType:
            logger.error('missing "type" input parameter')
            return 'error, missing "type" input parameter'

        eventTypeInstance = record.get('type_instance')
        if not eventTypeInstance:
            logger.error('missing "type_instance" input parameter')
            return 'error, missing "type_instance" input parameter'

        timestamp = record.get('time')
        if not timestamp:
            logger.error('missing "time" input parameter')
            return 'error, missing "time" input parameter'
        try:
            utcTimestamp = datetime.datetime.utcfromtimestamp(timestamp)
        except Exception, ex:
            logger.error('invalid "time" input parameter; ' + str(ex))
            return 'error, invalid "time" input parameter; ' + str(ex)
        isoTimestamp = utcTimestamp.isoformat() + 'Z'
        record['@timestamp'] = isoTimestamp


        record['@type'] = plugin + '.' + eventType + '.' + eventTypeInstance + '.' + pluginInstance
        record['docType'] = record['@type']
        logger.info('@type = ' + str(record['@type']))
        logger.info('record = ' + str(record))
        dsTypes = record.get('dstypes', [])
        logger.info('The dsTypes are: ' + str(dsTypes))
        dsNames = record.get('dsnames', [])
        logger.info('The dsNames are: ' + str(dsNames))
        dsValues = record.get('values', [])
        logger.info('The dsValues are: ' + str(dsValues))
        dsFieldNames = ["{}-{}".format(i, j) for i,j in zip(dsNames,dsTypes)]
        dsFieldNameValues = dict(zip(dsFieldNames, dsValues))
        record.update(dsFieldNameValues)
        returnRecs.append(record)


    return returnRecs

if __name__ == '__main__':
    import json
    import logging
    import datetime
    logger = logging.getLogger('collectd_test.log')
    a = open('collectd_output.json')
    b = a.read()
    c = json.loads(b)
    '''
    d = json.dumps(c, sort_keys=True, indent=4, separators=(',', ': '))
    e = open('collectd_pretty_op.json','w')
    e.write(d)
    e.close()
    '''
    events = customizeEvent(c,logger)
    prettyEvents = json.dumps(events, sort_keys=True, indent=4, separators=(',', ': '))
    print 'The events are ' + prettyEvents
