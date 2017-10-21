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


# Utility functions that are used by TenantServer.py.

import types
import datetime
import os
import errno
import threading
import time

try:
    from bottle import request, response, route, get, post, abort, run, static_file, hook
    import simplejson
    import redis
    import TenantUtil
    import ConfigDb
    import LogUtil
    import logging
except ImportError, ex:
    print 'TenantServerCommon.py: import error:', ex
    sys.exit(1)

# The HTTP Content-Type value to use for JSON responses.
_JSON_ContentType = 'application/json'

_tenantServerLogger = None # logger

# Age out session ids that haven't been used for _maxSessionIdSeconds seconds.
# TODO: make this configurable.
_maxSessionIdSeconds = 43200

_redisConn = None
_redisLock = threading.Lock()

######################################################################
# Background thread to age out old login sessions.
######################################################################
class LoginSessionAgeOutThread(threading.Thread):
    def run(self):
        if _tenantServerLogger:
            _tenantServerLogger.info('Starting thread to age out old session ids')
        while True:
            time.sleep(300)
            self.ageOutLoginSessions()


    ##################################################################
    # Delete login sessions that haven't been used recently.
    ##################################################################
    def ageOutLoginSessions(self):
        global _tenantServerLogger, _redisConn, _redisLock
        global _maxSessionIdSeconds
        if _tenantServerLogger:
            _tenantServerLogger.info('Aging out old session ids')

        # Get the login sessions.
        _redisLock.acquire()
        try:
            keys = _redisConn.keys(_getRedisLoginKey('*'))
        except redis.exceptions.RedisError, ex:
            if _tenantServerLogger:
                _tenantServerLogger.error("Error getting redis keys: " + str(ex))
        finally:
            _redisLock.release()
        
        # Check each login session's access time.
        for key in keys:
            # Get the lock separately for each key to avoid holding it
            # for too long.
            _redisLock.acquire()
            try:
                userStr = _redisConn.get(key)
                userDct = simplejson.loads(userStr)
                accessTime = int(userDct['accesstime'])
                if int(time.time()) - accessTime > _maxSessionIdSeconds:
                    if _tenantServerLogger:
                        _tenantServerLogger.info('Aging out session id %s'
                                                 % key)
                    _redisConn.delete(key)
            except Exception, ex:
                if _tenantServerLogger:
                    _tenantServerLogger.info('Error aging out session key "%s": %s' %
                                             (key, ex))
            finally:
                _redisLock.release()

        if _tenantServerLogger:
            _tenantServerLogger.info('Finished aging out old session ids')


def _getRedisLoginKey(sessionId):
    return 'insightal.tenantserver.logins.' + sessionId

######################################################################
# Initializes the logger.
######################################################################
def initializeCommon():
    '''Creates a logger.'''
    global _tenantServerLogger, _redisConn
    _tenantServerLogger = LogUtil.getLogger('TenantServer')
    _tenantServerLogger.setLevel(logging.INFO)

    # Get the redis host and port from the config file.
    redisHost = ConfigDb.getStringValue('redis', 'host', 'localhost',
                                        logger=_tenantServerLogger)
    redisPort = ConfigDb.getIntValue('redis', 'port', 6379,
                                     logger=_tenantServerLogger)
    if _tenantServerLogger:
        _tenantServerLogger.info("Connecting to redis at %s:%d" % (redisHost, redisPort))

    try:
        _redisConn = redis.StrictRedis(host=redisHost, port=redisPort, db=0)
    except redis.exceptions.RedisError, ex:
        if _tenantServerLogger:
            _tenantServerLogger.error("Can't connect to redis: " + str(ex))
        return False

    thr = LoginSessionAgeOutThread()
    thr.setDaemon(True)
    thr.start()

    return True

######################################################################
# Returns the logger.
######################################################################
def getLogger():
    return _tenantServerLogger

######################################################################
# Look up a login session id.  This is called to check whether the
# user is logged in.
######################################################################
def _getLoginSession(sessionId):
    '''Returns a login session dictionary if sessionId is valid,
otherwise returns None.'''
    global _tenantServerLogger, _redisConn, _redisLock
    key = _getRedisLoginKey(sessionId)
    _redisLock.acquire()
    try:
        value = _redisConn.get(key)
    except redis.exceptions.RedisError, ex:
        if _tenantServerLogger:
            _tenantServerLogger.error('error reading login session "%s" from redis: %s' % \
                                      (key, ex))
        value = None
    finally:
        _redisLock.release()
    return value

######################################################################
# Add or update a login session id.  This is called when the user
# logs in.  It is also called to update the access time when the user
# uses an existing login session.
######################################################################
def setLoginSession(sessionId, userId, username, role):
    '''Sets the login session to the (userId, username, role) tuple.'''
    global _tenantServerLogger, _redisConn, _redisLock
    key = _getRedisLoginKey(sessionId)
    dct ={'userid':userId, 'username':username, 'role':role,
          'accesstime':int(time.time())}
    value = simplejson.dumps(dct)
    _redisLock.acquire()
    try:
        value = _redisConn.set(key, value)
    except redis.exceptions.RedisError, ex:
        if _tenantServerLogger:
            _tenantServerLogger.error('error writing login session "%s" to redis: %s' % \
                                      (key, ex))
    finally:
        _redisLock.release()

######################################################################
# Delete a login session id.  This is called when the user logs out.
######################################################################
def deleteLoginSession(sessionId):
    '''Undefines the login session.'''
    global _tenantServerLogger, _redisConn, _redisLock
    key = _getRedisLoginKey(sessionId)
    _redisLock.acquire()
    try:
        _redisConn.delete(key)
    except redis.exceptions.RedisError, ex:
        if _tenantServerLogger:
            _tenantServerLogger.error('error deleting login session "%s" from redis: %s' % \
                                      (key, ex))
    finally:
        _redisLock.release()

######################################################################
#
# Checks the login sesion id.
# On success, returns (True, user)
#  where user is a userid/username/role tuple.
# On failure, sets the HTTP status to 400 and returns (False, message)
#  where message is JSON object serialized as a string that can be
#  returned as the response to an HTTP request.
#
#  response: the response object
#
######################################################################
def checkLogin(response):
    # Make sure the session id is present.
    sessionId = request.headers.get('X-AUTH-HEADER')
    if not sessionId:
        response.status = 400
        reply = {'status':'ERROR',
                 'message':'you must log in'}
        return (False, simplejson.dumps(reply))

    # Read the user session from redis and return an error if the
    # session does not exist.
    userStr = _getLoginSession(sessionId)
    if userStr is None:
        response.status = 400
        reply = {'status':'ERROR',
                 'message':'your login has expired'}
        return (False, simplejson.dumps(reply))

    # Interpret the value as a JSON object (Python dictionary).
    user = None
    try:
        userDct = simplejson.loads(userStr)
        # Return a userid/username/role tuple.
        # Other fields are used for housekeeping.
        userId = userDct['userid']
        userName = userDct['username']
        role = userDct['role']
        user = (userId, userName, role)
    except ValueError, ex: # not a valid JSON object.
        if _tenantServerLogger:
            _tenantServerLogger.error('bad login session value "%s" for session id "%s": %s' % (userStr, sessionId, ex))
    except KeyError, ex:
        response.status = 400
        if _tenantServerLogger:
            _tenantServerLogger.error('incomplete login session value "%s" for session id "%s": %s' % (userStr, sessionId, ex))

    # Return an error if the login session does not exist or the data is bad.
    if not user:
        reply = {'status':'ERROR',
                 'message':'login database is corrupt; you must log in again'}
        return (False, simplejson.dumps(reply))

    # This updates the access time, to keep the session from being
    # aged out.
    setLoginSession(sessionId, userId, userName, role)

    # print '**** user:', user # TESTING
    return (True, user)

######################################################################
#
# Gets the (first) tenant id associated with a user id.
# On success, returns (True, tenantId)
#  where tenantId is the id of the first tenant (if there is more
#  than one) associated with the user.
# On failure, returns (False, response)
#  where response is JSON object serialized as a string that can be
#  returned as the response to an HTTP request.
#
#  userId: the user id
#
######################################################################
def getTenantIdFromUserId(userId):
    # Make sure a tenantId is defined for this user.
    tenantIds = TenantUtil.listTenantsByUserId(userId)
    if not tenantIds:
        reply = {'status':'ERROR','message':'no tenant defined for this user'}
        return (False, simplejson.dumps(reply))
    # If there's more than one (see the comment in TenantServerLogin.py),
    # use the first one.
    tenantId = tenantIds[0]
    return (True, tenantId)

######################################################################
#
# Checks that an HTTP request body is a JSON object.
# On success, returns (True, obj)
#  where obj is a dictionary representing the JSON object in the
#  request body
# On failure, returns (False, response)
#  where response is JSON object serialized as a string that can be
#  returned as the response to an HTTP request.
#
#  request: bottle request object
#
######################################################################
def getJsonObj(request):
    try:
        req = request.json
    except Exception, ex:
        reply = {'status':'ERROR',
                 'message':str(ex),
                 'input':str(request.body.getvalue())}
        return (False, simplejson.dumps(reply))

    # Make sure it's a JSON object (and not a number, string, etc.)
    if type(req) != types.DictType:
        reply = {'status':'ERROR',
                 'message':'input is not a JSON object',
                 'input':str(request.body.getvalue())}
        return (False, simplejson.dumps(reply))
    return (True, req)

######################################################################
#
# Checks the type of an object.
#  obj: the value to check
#  expectedType: the expected type, except that:
#    str means either str or unicode
#    int means either int or long
# Returns True if obj has the expected type, otherwise False.
#
######################################################################
def checkType(obj, expectedType):
    # Treat str as either str or unicode.
    if expectedType == str:
        return isinstance(obj, basestring)
    
    # Treat int as either int or long.
    if expectedType == int:
        return isinstance(obj, (int, long))

    # Otherwise use the expected type as specified.
    return isinstance(obj, expectedType)

######################################################################
#
# Extracts the named parameters from the JSON object.
#  obj: the JSON object from the request body
#  params: a sequence of parameter names or (name, type) tuples.
#    If a type is specified, an error is returned if the parameter
#    is found but has a different type.  See checkType for details.
# On success, returns (True, v)
#  where v is a list of the values.
# On failure, returns (False, message)
#  where message is a JSON object serialized as a string that can be
#  returned as the response to an HTTP request.
#
# obj: the JSON object representing the request
# paramNames: a sequence of parameter names to look for in obj
######################################################################
def extractParams(obj, paramNames):
    values = []
    for param in paramNames:
        # If param is a tuple, it contains the name and expected type(s).
        if type(param) == tuple:
            paramName = param[0]
        else:
            paramName = param
        try:
            value = obj[paramName]
        except KeyError, ex:
            reply = {'status':'ERROR',
                     'message':'missing input parameter',
                     'missing-parameter':ex.message}
            return (False, simplejson.dumps(reply))

        # If a type was specified, check it.
        if type(param) == tuple and len(param) > 1:
            expectedType = param[1]
            if not checkType(value, expectedType):
                reply = {'status':'ERROR',
                         'message':'wrong type for input parameter',
                         'parameter':paramName,
                         'expected-type':str(expectedType),
                         'actual-type':str(type(value))}
                return (False, simplejson.dumps(reply))

        # Add the value to the list of values.
        values.append(value)

    return (True, values)

######################################################################
#
# Extracts the optional named parameters from the JSON object,
# using None for ones that don't exist.
# Returns a list of the values.
#
# obj: the JSON object representing the request
# paramNames: a sequence of parameter names to look for in obj
######################################################################
def extractOptionalParams(obj, paramNames):
    return [obj.get(name) for name in paramNames]

######################################################################
#
# Interprets the request body as a JSON object and extracts the
# specified parameters.  Also checks that the user is logged in.
#  request: the bottle request object
#  response: the bottle response object
#  params: a sequence of parameter names or (name, type) tuples.
#    If a type is specified, an error is returned if the parameter
#    is found but has a different type.  See checkType for details.
# On success, sets the response status to 200 and returns
#  (True, obj, v, user)
#  where:
#    obj is the JSON object
#    v is a list of the parameter values
#    user is a userid/username/role tuple
# On failure, sets the response status to 400 and returns
#  (False, obj, message, None) where
#  obj is the JSON request object if it is valid, otherwise None
#  message is a JSON object serialized as a string that can be
#    returned as the response to an HTTP request.
#
######################################################################
def getRequestParams(request, response, params):
    # Get the required parameters.
    (status, obj, values) = getRequestParamsNoLogin(request, response,
                                                    params)
    # Make sure the required parameters are present.
    if not status:
        return (status, obj, values, None)

    # Check the session id.
    (status, message) = checkLogin(response)
    if not status:
        return (status, obj, message, None)

    user = message
    return (status, obj, values, user)

######################################################################
#
# Interprets the request body as a JSON object and extracts the
# specified parameters.  Similar to getRequestParams() but does
# not check that the user is logged in.
#  request: the bottle request object
#  response: the bottle response object
#  params: a sequence of parameter names or (name, type) tuples.
#    If a type is specified, an error is returned if the parameter
#    is found but has a different type.  See checkType for details.
# On success, sets the response status to 200 and returns
#  (True, obj, v)
#  where obj is the JSON object and v is a list of the parameter
#  values.
# On failure, sets the response status to 400 and returns
#  (False, obj, message) where
#  obj is the JSON request object if it is valid, otherwise None
#  message is a JSON object serialized as a string that can be
#    returned as the response to an HTTP request.
#
# request: the request object
# response: the response object
# paramNames: a sequence of parameter names to look for in the
#  request body
#
######################################################################
def getRequestParamsNoLogin(request, response, params):
    response.content_type = _JSON_ContentType
    response.status = 400 # will reset to 200 on success

    (status, obj) = getJsonObj(request)
    if not status:
        return (False, None, obj)

    (status, values) = extractParams(obj, params)
    if not status:
        return (False, obj, values)

    response.status = 200
    return (True, obj, values)

def getISOFormatTime(time, delta):
    timeToReturn = time - datetime.timedelta(seconds=delta)
    return timeToReturn.isoformat()

######################################################################
# Parses a timestamp.
#  tsStr: a GMT timestamp string in a form that can be parsed using
#   '%Y-%m-%dT%H:%M:%SZ' as the format string to the Python
#   datetime module, for example:
#     2014-04-21T02:59:00Z
#   which is 02:59:00 on April 21 GMT (7:59 PM April 20 in PDT)
# On success, returns: (True, ts) where ts is a timestamp as a Python
#  datetime.datetime object (the current time if tsStr is None)
# On failure, returns: (False, message) where message is an error message
######################################################################
def parseTimestamp(tsStr):
    formatStr = '%Y-%m-%dT%H:%M:%SZ'
    try:
        ts = datetime.datetime.strptime(tsStr, formatStr)
    except ValueError:
        return (False, 'invalid timestamp')
    return (True, ts)

######################################################################
# Handles the startTime and endTime parameters.
#  startTimeStr: the start time parameter from the request; if empty
#    (or otherwise false, e.g. None, False, 0, ""), 5 minutes ago
#    is used as the start time
#  endTimeStr: the end time parameter from the request; if empty
#    (or otherwise false), now is used as the end time
# On success, returns (None, startTimeISOStr, endTimeISOStr) where
#   startTimeISOStr and endTimeISOStr are the the values to pass to
#   ElasticSearch.
# On failure (parse error), returns (message, None, None) where message
#   is an error message that can be returned to the client.
# 
# See the comments to parseTimestamp() for a description of the format
# of startTimeStr and endTimeStr.
# 
######################################################################
def _handleTimeStampFields(startTimeStr, endTimeStr):
    now = datetime.datetime.utcnow()

    # Parse the start time.  If not provided, use 5 minutes ago.
    if startTimeStr:
        (ok, startTime) = parseTimestamp(startTimeStr)
        if not ok:
            msg = simplejson.dumps({'status':'ERROR',
                                    'message':'invalid startTime'})
            return (msg, None, None)
    else:
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
        
    # Parse the end time.  If not provided, use now.
    if endTimeStr:
        (ok, endTime) = parseTimestamp(endTimeStr)
        if not ok:
            msg = simplejson.dumps({'status':'ERROR',
                                    'message':'invalid endTime'})
            return (msg, None, None)
    else:
        endTime = now

    startTimeISOStr = startTime.isoformat() + 'Z'
    endTimeISOStr = endTime.isoformat() + 'Z'
    return (None, startTimeISOStr, endTimeISOStr)


######################################################################
# Returns the name of the AppInsight directory plus an optional
# sub-directory.  The base AppInsight directory is a subdirectory
# of $HOME.
######################################################################
def getAppInsightDir(subdir):
    try:
        homeDir = os.environ['HOME']
    except KeyError:
        homeDir = '.'
    if subdir:
        return os.path.join(homeDir, 'AppInsight', subdir)
    return os.path.join(homeDir, 'AppInsight')

######################################################################
# Creates a directory if it doesn't already exist.  On error,
# returns an error message string.  Returns None on success.
# This does not create parent directories; they must already exist.
######################################################################
def makeDirIfNeeded(dir):
    try:
        os.mkdir(dir, 0755)
    except Exception, ex:
        if ex.errno != errno.EEXIST:
            return ex.strerror 
    return None

