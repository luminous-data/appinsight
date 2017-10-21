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


# This reads data from redis and writes it to elasticsearch.

import sys
import glob
import os.path
import LogUtil
import TenantUtil
import string
import datetime
import threading

logger = None

# Look for non-standard Python packages in either ../../vendor or the standard
# Python library location.
for pattern in ('../../vendor/redis-py-master*/redis',
                '../../vendor/bottle*/bottle.py',
                '../../vendor/six-*/six.py',
                '../../vendor/*-requests-*/requests',
                '../../vendor/simplejson-*/simplejson',
                '../../vendor/pyelasticsearch-*/pyelasticsearch'):
    pkgDirs = glob.glob(pattern)
    if pkgDirs:
        sys.path.insert(0, os.path.dirname(pkgDirs[0]))

sys.path.insert(0, '../common')

try:
    from bottle import request, response, route, get, post, abort, run, static_file, hook
    import redis, six, requests, simplejson, pyelasticsearch
    from pyelasticsearch import ElasticSearch
    import ConfigDb
    import BottleUtils
    import logging
    import json
except ImportError, ex:
    print "Can't find module:", ex
    print "Search path:", sys.path
    sys.exit(1)

redisConn = None  # connection to redis
esConn = None     # connection to elasticsearch
webServerPort = -1   # port for HTTP server

# Connects to a redis database.
# return: True on success
def connectToRedis():
    global redisConn
    # Get the redis host and port from the config file.
    redisHost = ConfigDb.getStringValue('redis', 'host', 'localhost', logger=logger)
    redisPort = ConfigDb.getIntValue('redis', 'port', 6379, logger=logger)
    logger.info("Connecting to redis at %s:%d" % (redisHost, redisPort))
    try:
        redisConn = redis.StrictRedis(host=redisHost, port=redisPort, db=0)
    except Exception, ex:
        logger.error("Can't connect to redis: %s" % ex)
        return False
    # TODO: see if this really means that the connection worked.
    logger.info('Connected to redis')
    return True

# Connects to a ElasticSearch.
# return: True on success
def connectToElasticSearch():
    global esConn
    esHost = ConfigDb.getStringValue('ElasticSearch', 'host', 'localhost', logger=logger)
    esPort = ConfigDb.getIntValue('ElasticSearch', 'port', '9200', logger=logger)
    esUrl = 'http://%s:%s/' % (esHost, esPort)
    logger.info("Connecting to ElasticSearch at %s" % esUrl)
    esConn = ElasticSearch(esUrl )

    # See if the connection worked.
    try:
        esConn.aliases()
        logger.info('Connected to ElasticSearch')
    except requests.exceptions.ConnectionError, ex:
        logger.error("Can't connect to ElasticSearch: %s" % ex)
        return False
    return True


# Indexes an item in ElasticSearch.
def indexItem(channel, data):
    try:
        dct = simplejson.loads(data)
    except simplejson.scanner.JSONDecodeError, ex:
        logger.info("bad JSON data: %s" % ex.message)
        return

    # Get the document type.
    docType = dct.get('docType')
    if docType:
        dct['@type'] = docType
    else:
        # If "docType" isn't present, try "@type".
        docType = dct.get('@type')
        if not docType:
            logger.info("can't find docType in data")
            return

    if '@timestamp' not in dct:
        dct['@timestamp'] = datetime.datetime.utcnow().replace(microsecond=0).isoformat() + 'Z'
    # Use the channel as the collection id, which is also the ElasticSearch alias name.
    esAliasName = channel
    # Add the data to the alias.
    try:
        esConn.index(esAliasName, docType, dct)
        logger.info('added data to alias "%s"' % esAliasName)
    except Exception, ex:
        logger.error('Error adding data to alias "%s": %s' % (esAliasName, ex))

def startWebServer():
    '''Starts a new thread running a web server using bottle.'''
    thr = WebServerThread()
    thr.setDaemon(True)
    thr.start()

class WebServerThread(threading.Thread):
    '''Runs a web server using bottle.'''
    def run(this):
        logger.info("Listening on port %d" % webServerPort)
        run(host='0.0.0.0', port=webServerPort, debug=True, reloader=True)

@route('/log/setLevel',method=['POST'])
def setLogLevel():
    '''Set the log level.  This runs in the web server thread.

The request data is a JSON object of the form:
 {'level':LEVEL}
 where:
 LEVEL is is one of: debug info warning error critical
e.g.:  {'level':'debug'}

Response body on success:
 {'status':'OK'}
Response body on error:
 {'status':'ERROR','message':MESSAGE}
   where MESSAGE explains the error
Sample command to test this URL:
  curl --data-binary '{"level":"debug"}' -i -H 'Content-Type: application/json' http://localhost:9502/log/setLevel
'''
    # TODO: maybe combine this with similar code in PluginCollector.py
    if not logger:
        reply = {'status':'ERROR', 'message':'no log file'}
        return json.dumps(reply);

    try:
        (obj, values) = BottleUtils.getRequestParams(request, ('level',))
    except BottleUtils.RequestError, ex:
        return ex.serializedDct

    (levelName,) = values

    # Turn the log level name into a value recognized by the logging module.
    lvl = {'debug':logging.DEBUG,
           'info':logging.INFO,
           'warning':logging.WARNING,
           'error':logging.ERROR,
           'critical':logging.CRITICAL}.get(levelName)

    # Make sure the log level name is valid.
    if lvl is None:
        logger.error('bad log level: ' + str(levelName))
        reply = {'status':'ERROR', 'message':'bad log level: ' + str(levelName)}
        return json.dumps(reply);

    # Temporarily set the level to info so that the next message will appear.
    logger.setLevel(logging.INFO)
    logger.info('setting log level to ' + levelName)

    # Set the log level to the specified value.
    logger.setLevel(lvl)
    reply = {'status':'OK'}
    return json.dumps(reply);

# Top-level routine.
def main():
    global logger, webServerPort
    logger = LogUtil.getLogger('LogIndexer')
    logger.info('Starting')

    if not connectToElasticSearch() or not connectToRedis():
        sys.exit(1)

    webServerPort = ConfigDb.getIntValue('LogIndexer', 'port', -1, logger=logger)
    if webServerPort < 0:
        logger.info('Not running a web server because the server port number is not defined')
    else:
        startWebServer()

    channelPrefix = ConfigDb.getStringValue('redis',
                                            'channelPrefix',
                                            'insightal.inputevents.', logger=logger)
    channelPrefixLen = len(channelPrefix)
    channelSpec = channelPrefix + '*'

    # Subscribe to all redis channels that start with our prefix.
    logger.info('Subscribing to redis channels %s' % channelSpec)
    pubSub = redisConn.pubsub()
    pubSub.psubscribe(channelSpec)

    # Read from redis and add to ElasticSearch.
    for item in pubSub.listen():
        try:
            if item['type'] == 'pmessage':
                redisChannel = item['channel']
                if redisChannel[:channelPrefixLen] == channelPrefix:
                    esIndex = redisChannel[channelPrefixLen:]
                    print 'LogIndexer: The channel is ' + redisChannel
                    print 'LogIndexer: The ElasticSearch index or alias is ' + esIndex
                    indexItem(esIndex, item['data'])
        except KeyError:
            pass

# Main-line code starts here.
if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
    sys.exit(1)
