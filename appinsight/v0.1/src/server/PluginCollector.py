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


# This is based on standardCollector.py.  It calls plugins to modify
# input requests.

import sys, glob, os, os.path, traceback, imp
import threading

gLock = threading.Lock()
gPluginModules = {} # maps a plugin module name to the loaded plugin

for pattern in ('../../vendor/redis-py-master*/redis',
                '../../vendor/six-*/six.py',
                '../../vendor/Paste*/paste',
                '../../vendor/bottle*/bottle.py',
                '../../vendor/simplejson-*/simplejson'):
    pkgDirs = glob.glob(pattern)
    if pkgDirs:
        sys.path.insert(0, os.path.dirname(pkgDirs[0]))

sys.path.insert(0, '../common')

try:
    from bottle import request, response, route, get, post, abort, run, static_file, hook
    from BottleUtils import importBottleWebServer
    import json, redis
    import sys, traceback
    import datetime
    import importlib
    import ConfigDb
    import TenantUtil
    import LogUtil
    import BottleUtils
    import logging
except ImportError, ex:
    print 'import error:', ex
    sys.exit(1)

counter=0

redisConn = None
redisLock = threading.Lock()

# Get the program name without the directory or extension.
_programName = os.path.splitext(os.path.basename(sys.argv[0]))[0]

# Base the logger name on the program name.
_logger = LogUtil.getLogger(_programName)

channelPrefix = ConfigDb.getStringValue('redis',
                                        'channelPrefix',
                                        'insightal.inputevents.',
                                        logger=_logger)

@route('/',method=['OPTIONS','POST'])
def root():
    global counter
    global channelPrefix
    global gLock, gPluginModules
    #_logger.info('The request  is ' + str(request))
    # Get the JSON input.
    try:
        record = request.json
    except Exception, ex:
        _logger.error('invalid JSON input: ' + str(ex))
        return {'result' : 'error, invalid JSON input: ' + str(ex)}
    if not record:
        _logger.error('invalid input, check content-type')
        return {'result' : 'invalid input, check content-type'}

    # Get the channel from the "channel" query parameter.
    channel = request.query.channel
    if not channel:
        channel = record.get('channel')
        # If there's no "channel" query parameter, look for the channel in the data.
        if not channel:
            fields = record.get('@fields')
            channel = fields.get('channel')
            # If channel is a non-empty sequence, use the first element.
            # TODO: might need to handle each element if there's more than one.
            if channel and type(channel) in (list, tuple):
                channel = channel[0]
            if not channel:
                _logger.error('cannot find "channel" in query parameters or request body')
                return {'result' : 'error, missing "channel" query parameter'}
    _logger.info('The channel is ' + channel)

    global redisConn, redisLock
    

    docType = request.query.docType
    if not docType:
        docType = record.get('docType')
        if not docType:
            docType = record.get('@type')
            if not docType:
                _logger.error('missing "docType" or "@type" input parameter')
                return {'result' : 'error, missing "docType" or "@type" input parameter'}
    _logger.info('docType = %s' % docType)


    # Get a list of plugins that handle this docType and collection id.
    # The channel is used as the collection id.
    try:
        plugins = TenantUtil.listEnabledPluginsByDocTypeAndCollectionId(docType, channel, _logger)
    except Exception, ex:
        msg = 'error getting plugins for doctype "%s" and collection id "%s": %s' % \
              (docType, channel, ex)
        _logger.error(msg)
        return {'result' : msg}
    if plugins:
        _logger.info('plugins for docType "%s" and collection "%s": %s' % \
                     (docType, channel, plugins))
    else:
        _logger.info('no plugins for docType "%s" and collection "%s"' % \
                     (docType, channel))

    # Run each plugin.  Its input is the output of the previous plugin.
    # The input to the first plugin is the request input.
    for (pluginId, pluginName) in plugins:
        moduleName = 'plugin_' + pluginId.replace('-','_')

        # Load the module if it is not already loaded.
        gLock.acquire() # protect gPluginModules against other threads
        try:
            pluginModule = gPluginModules.get(pluginName)
            if pluginModule:
                _logger.info('Plugin "%s" id "%s" is already loaded' % \
                             (pluginName, pluginId))
            else:
                try:
                    # Get the plugin's source code from the database.
                    _logger.info('Retrieving code for plugin "%s" id "%s"' % \
                                 (pluginName, pluginId))
                    pluginCode = TenantUtil.getPluginCodeById(pluginId, logger=_logger)
                    if not pluginCode:
                        _logger.warning('Plugin "%s" id "%s" has no source code' % \
                                        (pluginName, pluginId))
                    else:
                        _logger.info('Loading plugin "%s" id "%s" as module "%s"' % \
                                        (pluginName, pluginId, moduleName))
                        pluginModule = imp.new_module(moduleName)
                        exec pluginCode in pluginModule.__dict__
                        # Save the loaded module so that it's only loaded once.
                        gPluginModules[pluginName] = pluginModule
                except Exception, ex:
                    _logger.error('Error loading plugin "%s" id "%s" as module "%s": %s' % \
                                  (pluginName, pluginId, moduleName, ex))
        finally:
            gLock.release()

        # Call the plugin if it was loaded successfully.
        # TODO: should plugins have a way to return an error to the client?
        if pluginModule:
            try:
                _logger.info('Calling customizeEvent() in plugin "%s" id "%s"' % \
                             (pluginName, pluginId))
                record = pluginModule.customizeEvent(record, logger=_logger)
                _logger.info('Result after calling plugin "%s" id "%s": %s' % \
                             (pluginName, pluginId, record))
            except Exception, ex:
                _logger.error('Error calling plugin "%s" id "%s": %s' % \
                              (pluginName, pluginId, ex))

    _logger.info('docType = ' + str(docType))

    redisLock.acquire()
    try:
        if isinstance(record, list):
            for rec in record:
                _logger.info('Inserting into redis: ' + str(rec))
                numSubscribers = redisConn.publish(channelPrefix + channel,
                                           json.dumps(rec))
        else:
            _logger.info('Inserting into redis: ' + str(record))
            numSubscribers = redisConn.publish(channelPrefix + channel,
                                           json.dumps(record))
    except:
        _logger.error('exception')
        _logger.error(traceback.format_exc())
        _logger.error('The request is ' + str(request))
    finally:
        redisLock.release()
    #counter = counter + 1
    return {"result": "ok"}
    
######################################################################
# Set the log level.
######################################################################
@route('/log/setLevel',method=['POST'])
def setLogLevel():
    '''
Set the log level.

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
  curl --data-binary '{"level":"debug"}' -i -H 'Content-Type: application/json' http://localhost:9501/log/setLevel
'''
    if not _logger:
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
        _logger.error('bad log level: ' + str(levelName))
        reply = {'status':'ERROR', 'message':'bad log level: ' + str(levelName)}
        return json.dumps(reply);

    # Temporarily set the level to info so that the next message will appear.
    _logger.setLevel(logging.INFO)
    _logger.info('setting log level to ' + levelName)

    # Set the log level to the specified value.
    _logger.setLevel(lvl)
    reply = {'status':'OK'}
    return json.dumps(reply);

######################################################################
# Sleep.  Used for testing multi-threading.
######################################################################
@route('/sleep',method=['GET'])
def sleep():
    '''Sleep for a few seconds.  Used only for testing.
    Sample command:
    curl "http://localhost:9501/sleep?delay=10"
'''
    import time
    response.content_type = 'text/plain'
    delay = 5
    delayStr = request.query.get('delay')
    if delayStr:
        try:
            delay = int(delayStr)
        except ValueError, ex:
            return 'Bad delay value "%s", must be a positive integer\r\n' % delayStr
        if delay <= 0:
            return "Delay must be > 0\r\n"
    time.sleep(delay)
    return 'OK\r\n'

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
    # Use the program name as the section name in the config file.
    port = ConfigDb.getIntValue(_programName, 'port', 9501, logger=_logger)
    _logger.info("Listening on port %d" % port)
    server = importBottleWebServer(_logger)
    run(host='0.0.0.0', port=port, debug=True, reloader=True, server=server)

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
    sys.exit(1)
