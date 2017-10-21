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

