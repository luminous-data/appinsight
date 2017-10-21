#!/usr/bin/env python

import sys, glob, os.path, traceback

for pattern in ('../../vendor/redis-py-master*/redis',
                '../../vendor/bottle*/bottle.py'):
    pkgDirs = glob.glob(pattern)
    if pkgDirs:
        sys.path.insert(0, os.path.dirname(pkgDirs[0]))

sys.path.insert(0, '../common')

try:
    from bottle import request, response, route, get, post, abort, run, static_file, hook
    import json, redis
    import sys, traceback
    import datetime
    import ConfigDb
    import LogUtil
except ImportError, ex:
    print 'import error:', ex
    sys.exit(1)

counter=0

redisConn = None

_logger = LogUtil.getLogger('collectdserver')

@route('/',method=['OPTIONS','POST'])
def root():
    global counter
    try:
        req = request.json
    except Exception, ex:
        _logger.error('invalid JSON input: ' + str(ex))
        return 'error, invalid JSON input: ' + str(ex)

    channel = request.query.channel
    if not channel:
        _logger.error('missing "channel" query parameter')
        return 'error, missing "channel" query parameter'
    _logger.info('The channel is ' + channel)
    global redisConn
    for record in req:
        _logger.info('record = ' + str(record))
        eventType = record.get('plugin')
        if not eventType:
            _logger.error('missing "plugin" input parameter')
            return 'error, missing "plugin" input parameter'
        timestamp = record.get('time')
        if not timestamp:
            _logger.error('missing "time" input parameter')
            return 'error, missing "time" input parameter'
        try:
            utcTimestamp = datetime.datetime.utcfromtimestamp(timestamp)
        except Exception, ex:
            _logger.error('invalid "time" input parameter; ' + str(ex))
            return 'error, invalid "time" input parameter; ' + str(ex)
        isoTimestamp = utcTimestamp.isoformat() + 'Z'
        record['@timestamp'] = isoTimestamp
        record['@type'] = eventType
        _logger.info('eventType = ' + str(eventType))
        _logger.info('record = ' + str(record))
        dsTypes = record.get('dstypes', [])
        _logger.info('The dsTypes are: ' + str(dsTypes))
        dsNames = record.get('dsnames', [])
        _logger.info('The dsNames are: ' + str(dsNames))
        dsValues = record.get('values', [])
        _logger.info('The dsValues are: ' + str(dsValues))
        dsFieldNames = ["{}-{}".format(i, j) for i,j in zip(dsNames,dsTypes)]
        dsFieldNameValues = dict(zip(dsFieldNames, dsValues))
        record.update(dsFieldNameValues)
        try:
            numSubscribers = redisConn.publish(channel, json.dumps(record))
            _logger.info('Published to redis')
            '''
            counter = counter + 1
            a = open('aa' + str(counter) + '.json','w')
            a.write(str(json.dumps(record, sort_keys=True, indent=4, separators=(',', ': '))))
            a.close()
            '''
        except Exception, ex:
            _logger.error('error talking to redis: ' + str(ex))
            _logger.error('The request is ' + str(req))
    #counter = counter + 1
    return "got it"
    
def connectToRedis():
    global redisConn
    # Get the redis host and port from the config file.
    redisHost = ConfigDb.getStringValue('redis', 'host', 'localhost', logger=_logger)
    redisPort = ConfigDb.getIntValue('redis', 'port', 6379, logger=_logger)
    _logger.info("Connecting to redis at %s:%d" % (redisHost, redisPort))
    try:
        redisConn = redis.StrictRedis(host=redisHost, port=redisPort, db=0)
    except Exception, ex:
        _logger.error("Can't connect to redis: " + str(ex))
        return False
    return True


def main():
    connectToRedis()
    # Get the listen port from the config file.
    port = ConfigDb.getIntValue('collectdserver', 'port', 9500, logger=_logger)
    run(host='0.0.0.0', port=port, debug=True, reloader=True)

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
    sys.exit(1)

