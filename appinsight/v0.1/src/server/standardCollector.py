#!/usr/bin/env python

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

_logger = LogUtil.getLogger('standardCollector')

@route('/',method=['OPTIONS','POST'])
def root():
    global counter
    try:
        record = request.json
    except Exception, ex:
        _logger.error('invalid JSON input: ' + str(ex))
        return {'result' : 'error, invalid JSON input: ' + str(ex)}
    if not record:
        _logger.error('invalid input, check content-type')
        return {'result' : 'invalid input, check content-type'}
    channel = request.query.channel
    if not channel:
        _logger.error('missing "channel" query parameter')
        return {'result' : 'error, missing "channel" query parameter'}
    _logger.info('The channel is ' + channel)

    global redisConn
    
    _logger.info('record = ' + str(record))
    eventType = record.get('docType')
    if not eventType:
        _logger.error('missing "docType" input parameter')
        return {'result' : 'error, missing "docType" input parameter'}
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
    record['@type'] = eventType
    _logger.info('eventType = ' + str(eventType))
    _logger.info('record = ' + str(record))
    try:
        numSubscribers = redisConn.publish(channel, json.dumps(record))
    except:
        _logger.error('exception')
        _logger.error(traceback.format_exc())
        _logger.error('The request is ' + str(request))
    #counter = counter + 1
    return {"result": "ok"}
    
def connectToRedis():
    global redisConn
    # Get the redis host and port from the database.
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
    port = ConfigDb.getIntValue('StandardCollector', 'port', 9501, logger=_logger)
    _logger.info("Listening on port %d" % port)
    run(host='0.0.0.0', port=port, debug=True, reloader=True)

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
    sys.exit(1)
