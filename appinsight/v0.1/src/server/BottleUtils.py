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

# Utility functions that are used by various servers based on bottle.py.

# TODO: change the code in TenantServer, from which this code was extracted,
# to use it instead of having its own copy.

import sys
import types

try:
    import json
    from bottle import request, response
except ImportError, ex:
    print '%s: import error:' % sys.argv[0], ex
    sys.exit(1)

######################################################################
class RequestError(Exception):
    '''Exception in getting parameters from a bottle request.
Has the following attributes:
  msg: an error message as a string
  dct: a dictionary with {'status':'ERROR', 'message':msg} and possibly
       other entries with details about the error
  serializedDct: dct as a JSON string, suitable in a response to a bottle request
  '''

    def __init__(self, msg, inputDct={}):
        '''Constructor.
  msg: an error message (a string)
  inputDct: an optional dictionary containing other information about the error
  '''
        self.msg = msg
        self.dct = {'status':'ERROR', 'message':msg}
        # Add any entries from inputDct to self.dct.
        for key in inputDct.keys():
            self.dct[key] = inputDct[key]
        # Serialize the dictionary as a JSON string.
        self.serializedDct = json.dumps(self.dct)
    def __str__(self):
        return repr(self.msg)

######################################################################
def getJsonRequestObj(request):
    '''Checks that an HTTP request body is a JSON object.
  request: bottle request object
  Returns the JSON object in the request body.
  On failure, raises a RequestError exception.
  '''
    try:
        obj = request.json
    except Exception, ex:  # input is not JSON (may have wrong content-type header)
        raise RequestError(str(ex), {'input':str(request.body.getvalue())})

    # Make sure it's a JSON object (and not a JSON number, string, etc.)
    if type(obj) != types.DictType:
        raise RequestError('input is not a JSON object', \
                           {'input':str(request.body.getvalue())})

    return obj

######################################################################
def checkType(obj, expectedType):
    '''Checks the type of an object.
  obj: the value to check
  expectedType: the expected type, except that:
    str means either str or unicode
    int means either int or long
Returns True if obj has the expected type, otherwise False.
'''
    # Treat str as either str or unicode.
    if expectedType == str:
        return isinstance(obj, basestring)
    
    # Treat int as either int or long.
    if expectedType == int:
        return isinstance(obj, (int, long))

    # Otherwise use the expected type as specified.
    return isinstance(obj, expectedType)

######################################################################
def extractParams(obj, paramNames):
    '''Extracts the named parameters from the JSON object.
  obj: a JSON object (e.g. from an HTTP request body)
  paramNames: a sequence of parameter names to look for in obj, or (name, type) tuples.
Raises a RequestError exception if any parameter is missing or if the expected type does
not match the actual type.  See checkType() for details.
On success, returns is a list of the values.
On failure, raises a RequestError exception.
'''
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
            raise RequestError('missing input parameter', {'missing-parameter':ex.message})

        # If a type was specified, check it.
        if type(param) == tuple and len(param) > 1:
            expectedType = param[1]
            if not checkType(value, expectedType):
                raise RequestError('wrong type for input parameter',
                                 {'parameter':paramName,
                                  'expected-type':str(expectedType),
                                  'actual-type':str(type(value))})

        # Add the value to the list of values.
        values.append(value)

    return values

######################################################################
def extractOptionalParams(obj, paramNames):
    '''Extracts the optional named parameters from the JSON object,
Returns a list of the values, using None for ones that do not exist.

  obj: the JSON object representing the request
  paramNames: a sequence of parameter names to look for in obj
'''
    return [obj.get(name) for name in paramNames]

######################################################################
def getRequestParams(request, params):
    '''Interprets the request body as a JSON object and extracts the
specified parameters.
  request: the bottle request object
  params: a sequence of parameter names or (name, type) tuples.
    Raises a RequestError exception if a parameter is not found
    of has the wrong type.  See checkType() for details.
On success, returns (obj, v)
  where obj is the JSON object and v is a list of the parameter
  values corresponding to the names in params.
On failure, raises a RequestError exception.
'''
    obj = getJsonRequestObj(request) # JSON request object
    values = extractParams(obj, params) # list of parameter values
    return (obj, values)

def importBottleWebServer(logger):
    '''Tries to load a multi-threading web server for bottle.  If that fails,
    tries the default server (wsgiref).
    Use "from BottleUtils import importBottleWebServer" so that the web server module
    is imported into the calling module.
    logger: if not None, used for logging messages
    return: the server name, or None if no server was found'''
    for server in ('paste', 'wsgiref'):
        try:
            __import__(server)
            if logger:
                logger.info('using web server server "%s"' % server)
            return server # this server succeeded, don't try any more servers
        except ImportError, ex:
            if logger:
                logger.error('error importing web server "%s": %s' % (server, ex))
    if logger:
        logger.error('no web servers found')
    return None
