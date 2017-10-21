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

# AppInsight back end web server.
# Accepts JSON requests from the front end, and sends JSON responses.

# TODO: maybe define error codes for the possible errors instead of
# depending on a plain-text message


import sys, glob, os, traceback, errno

sys.path.insert(0, '../common')
import ConfigDb

from alertConstants import * 

# Make sure we can find the required modules.
# Look in either ../../vendor or the standard Python library location.
# pyelasticsearch needs six and requests.
for pattern in ('../../vendor/bottle*/bottle.py',
                '../../vendor/simplejson-*/simplejson',
                '../../vendor/six-*/six.py',
                '../../vendor/*-requests-*/requests',
                '../../vendor/Paste*/paste',
                '../../vendor/pyelasticsearch-*/pyelasticsearch'):
    pkgDirs = glob.glob(pattern)
    if pkgDirs:
        sys.path.insert(0, os.path.dirname(pkgDirs[0]))
try:
    from bottle import request, response, route, get, post, abort, run, static_file, hook
    from BottleUtils import importBottleWebServer
    import simplejson
    import json
    import six, pyelasticsearch
    from pyelasticsearch import ElasticSearch
    import requests
    import TenantUtil
    from TenantServerCommon import *
    from TenantServerLogin import *
    from TenantServerES import *
    import LogUtil
    import logging
except ImportError, ex:
    print 'import error:', ex
    sys.exit(1)

import types
import datetime
import collections

HOST='http://localhost:9506'


######################################################################
#
# Calls a TenantUtil database function.
#  request: bottle request object
#  response: bottle response object
#  func: the function to call
#  params: a sequence of parameter names or (name, type) tuples.
#    If a type is specified, an error is returned if the parameter
#    is found but has a different type.  See checkType for details.
#  resultName: if a string, the returned JSON object contains an
#   entry with resultName as the key and the return value of
#   func as the value.  If a tuple, func is expected to return a
#   sequence with at least as many elements as resultName, and
#   for each element of resultName, the returned JSON object
#   contains an entry with that element as the key and the
#   corresponding element of the return value of func as the value;
#   any extra elements in the return value of func are ignored.
#   For example, if resultName is ('A', 'B', 'C'), func returns
#   (11, 22, 33, 44), and there are no errors, the return value is:
#     {'status':'OK', 'A':11, 'B':22, 'C':33}
#  return: on success, a string representing a dictionary containing
#  {'status':'OK'} plus any values added for resultName;
#  on failure, {'status':'ERROR', 'message':MESSAGE} where MESSAGE
#  indicates the error
#
######################################################################
def callDbFunc(func, params, resultName):
    (status, obj, values, user) = getRequestParams(request, response,
                                                   params)
    if not status:
        return values # error message

    # TODO: more fine-grained errors.
    result = ''
    kwargs = {'logger':getLogger()}
    try:
        result = func(*values, **kwargs)
    except Exception, ex:
        reply = {'status':'ERROR',
                 'message':str(ex)}
        return simplejson.dumps(reply)

    # Success
    reply = {'status':'OK'}
    if resultName:
        # For multiple result names, assign the corresponding elements
        # of result.
        if type(resultName) == types.TupleType:
            for idx in range(len(resultName)):
                reply[resultName[idx]] = result[idx]
        # For a single result name, assign result.
        else:
            reply[resultName] = result
    return simplejson.dumps(reply)


######################################################################
#
# Calls a TenantUtil database function.
# This is the same as callDbFunc() except that the user id from the
# login session is passed as the first argument to func.
#
######################################################################
def callDbFuncWithUserId(func, params, resultName):
    (status, obj, values, user) = getRequestParams(request, response,
                                                   params)
    if not status:
        return values

    # TODO: more fine-grained errors.
    result = None
    kwargs = {'logger':getLogger()}
    print str(values)
    print str(kwargs)
    try:
        result = func(user[0], *values, **kwargs)
    except Exception, ex:
        exc_type, exc_value, exc_traceback = sys.exc_info()
        traceback.print_tb(exc_traceback, limit=1, file=sys.stdout)
        reply = {'status':'ERROR',
                 'message':str(ex)}
        return simplejson.dumps(reply)

    # Success
    reply = {'status':'OK', 'response': str(result)}
    if resultName:
        reply[resultName] = result
    print str(reply)
    return simplejson.dumps(reply)


@hook('after_request')
def enable_cors():
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'OPTIONS, GET, POST'  
    response.headers['Access-Control-Allow-Headers'] = 'Origin, Accept, Content-Type, X-Requested-With, X-CSRF-Token,X-Auth-Header'
    
    response.headers['Access-Control-Expose-Headers'] = 'X-Auth-Header'

'''
@route('/')
def root():
    response = static_file("index.html", root='../client/webui')
    #response.set_cookie("user", "%7B%22username%22%3A%22%22%2C%22role%22%3A%7B%22bitMask%22%3A1%2C%22title%22%3A%22public%22%7D%7D")
    return response

@route('/<filename>')
def serverHTML(filename):
    return static_file(filename, root='../client/webui')

@route('/js/<filename>')
def server_static(filename):
    return static_file(filename, root='../client/webui/js')

@route('/font/<filename>')
def server_static(filename):
    return static_file(filename, root='../client/webui/font')

@route('/css/<filename>')
def serverCSS(filename):
    return static_file(filename, root='../client/webui/css')

@route('/img/<filename>')
def serverImg(filename):
    return static_file(filename, root='../client/webui/img')

######################################################################
#
# TODO Added Routing Hacks need to find better way.
#
######################################################################

@route('/partials/<filename>')
def serverPartials(filename):
    return static_file(filename, root='../client/webui/partials')

@route('/templates/<filename>')
def serverPartials(filename):
    return static_file(filename, root='../client/webui/templates')

@route('/templates/tenantadmin/<filename>')
def serverGroups(filename):
    return static_file(filename, root='../client/webui/templates/tenantadmin')

@route('/templates/section1/<filename>')
def serverPartials(filename):
    return static_file(filename, root='../client/webui/templates/section1')

@route('/templates/section1/tabs/<filename>')
def serverPartials(filename):
    return static_file(filename, root='../client/webui/templates/section1/tabs')

@route('/templates/section2/<filename>')
def serverPartials(filename):
    return static_file(filename, root='../client/webui/templates/section2')

@route('/widgets/<filename>')
def serverWidget(filename):
    return static_file(filename, root='../client/webui/widgets')

@route('/widgets/partials/<filename>')
def serverWidget(filename):
    return static_file(filename, root='../client/webui/widgets/partials')

@route('/assets/jquery/js/<filename>')
def serverWidget(filename):
    return static_file(filename, root='../client/webui/assets/jquery/js/')

@route('/assets/highcharts/js/<filename>')
def serverWidget(filename):
    return static_file(filename, root='../client/webui/assets/highcharts/js/')

@route('/assets/bootstrap/css/<filename>')
def serverWidget(filename):
    return static_file(filename, root='../client/webui/assets/bootstrap/css/')

@route('/assets/bootstrap/css/<filename>')
def serverWidget(filename):
    return static_file(filename, root='../client/webui/assets/bootstrap/css/')

@route('/assets/datepicker/js/<filename>')
def serverWidget(filename):
    return static_file(filename, root='../client/webui/assets/datepicker/js/')

@route('/assets/bootstrap-wysihtml5/js/<filename>')
def serverWidget(filename):
    return static_file(filename, root='../client/webui/assets/bootstrap-wysihtml5/js/')

@route('/vendor/bootstrap/css/<filename>')
def serverWidget(filename):
    return static_file(filename, root='../client/webui/vendor/bootstrap/css/')

@route('/vendor/d3/css/<filename>')
def serverWidget(filename):
    return static_file(filename, root='../client/webui/vendor/d3/css/')

@route('/vendor/bootstrap/js/<filename>')
def serverWidget(filename):
    return static_file(filename, root='../client/webui/vendor/bootstrap/js/')

@route('/vendor/d3/js/<filename>')
def serverWidget(filename):
    return static_file(filename, root='../client/webui/vendor/d3/js/')

@route('/vendor/angular-ui/js/<filename>')
def serverWidget(filename):
    return static_file(filename, root='../client/webui/vendor/angular-ui/js/')

@route('/vendor/bootstrap/fonts/<filename>')
def serverWidget(filename):
    return static_file(filename, root='../client/webui/vendor/bootstrap/fonts/')
'''

@route('/')
def root():
    response = static_file("index.html", root='../client/webui')
    #response.set_cookie("user", "%7B%22username%22%3A%22%22%2C%22role%22%3A%7B%22bitMask%22%3A1%2C%22title%22%3A%22public%22%7D%7D")
    return response

@route('/<filename>')
def serverHTML(filename):
    return static_file(filename, root='../client/webui')

@route('/js/<filename>')
def server_static(filename):
    return static_file(filename, root='../client/webui/js')

@route('/font/<filename>')
def server_static(filename):
    return static_file(filename, root='../client/webui/font')

@route('/css/<filename>')
def serverCSS(filename):
    return static_file(filename, root='../client/webui/css')

@route('/img/<filename>')
def serverImg(filename):
    return static_file(filename, root='../client/webui/img')

######################################################################
#
# TODO Added Routing Hacks need to find better way.
#
######################################################################

@route('/charts/<filename>')
def serverPartials(filename):
    return static_file(filename, root='../client/webui/charts')

@route('/charts/templates/<filename>')
def serverPartials(filename):
    return static_file(filename, root='../client/webui/charts/templates')

@route('/application/common/<filename>')
def serverPartials(filename):
    return static_file(filename, root='../client/webui/application/common')

@route('/application/dashboard/<filename>')
def serverPartials(filename):
    return static_file(filename, root='../client/webui/application/dashboard')

@route('/application/charts/<filename>')
def serverPartials(filename):
    return static_file(filename, root='../client/webui/application/charts')

@route('/vendor/highcharts/js/<filename>')
def serverPartials(filename):
    return static_file(filename, root='../client/webui/vendor/highcharts/js')

@route('/vendor/jsTree/themes/default/<filename>')
def serverPartials(filename):
    return static_file(filename, root='../client/webui/vendor/jsTree/themes/default')

@route('/vendor/angular-other/<filename>')
def serverPartials(filename):
    return static_file(filename, root='../client/webui/vendor/angular-other')

@route('/vendor/jquery/js/<filename>')
def serverPartials(filename):
    return static_file(filename, root='../client/webui/vendor/jquery/js')

@route('/vendor/clipboard/<filename>')
def serverPartials(filename):
    return static_file(filename, root='../client/webui/vendor/clipboard')

@route('/application/users/<filename>')
def serverPartials(filename):
    return static_file(filename, root='../client/webui/application/users')

@route('/application/workbench/<filename>')
def serverPartials(filename):
    return static_file(filename, root='../client/webui/application/workbench')

@route('/application/search/<filename>')
def serverPartials(filename):
    return static_file(filename, root='../client/webui/application/search')

@route('/application/<filename>')
def serverPartials(filename):
    return static_file(filename, root='../client/webui/application')

@route('/partials/<filename>')
def serverPartials(filename):
    return static_file(filename, root='../client/webui/partials')

@route('/templates/<filename>')
def serverPartials(filename):
    return static_file(filename, root='../client/webui/templates')

@route('/templates/tenantadmin/<filename>')
def serverGroups(filename):
    return static_file(filename, root='../client/webui/templates/tenantadmin')

@route('/templates/section1/<filename>')
def serverPartials(filename):
    return static_file(filename, root='../client/webui/templates/section1')

@route('/templates/section1/tabs/<filename>')
def serverPartials(filename):
    return static_file(filename, root='../client/webui/templates/section1/tabs')

@route('/templates/section2/<filename>')
def serverPartials(filename):
    return static_file(filename, root='../client/webui/templates/section2')

@route('/widgets/<filename>')
def serverWidget(filename):
    return static_file(filename, root='../client/webui/widgets')

@route('/images/<filename>')
def serverWidget(filename):
    return static_file(filename, root='../client/webui/images')

@route('/fonts/<filename>')
def serverWidget(filename):
    return static_file(filename, root='../client/webui/fonts')

@route('/widgets/partials/<filename>')
def serverWidget(filename):
    return static_file(filename, root='../client/webui/widgets/partials')

@route('/assets/jquery/js/<filename>')
def serverWidget(filename):
    return static_file(filename, root='../client/webui/assets/jquery/js/')

@route('/assets/highcharts/js/<filename>')
def serverWidget(filename):
    return static_file(filename, root='../client/webui/assets/highcharts/js/')

@route('/assets/bootstrap/css/<filename>')
def serverWidget(filename):
    return static_file(filename, root='../client/webui/assets/bootstrap/css/')

@route('/assets/bootstrap/css/<filename>')
def serverWidget(filename):
    return static_file(filename, root='../client/webui/assets/bootstrap/css/')

@route('/assets/datepicker/js/<filename>')
def serverWidget(filename):
    return static_file(filename, root='../client/webui/assets/datepicker/js/')

@route('/assets/bootstrap-wysihtml5/js/<filename>')
def serverWidget(filename):
    return static_file(filename, root='../client/webui/assets/bootstrap-wysihtml5/js/')

@route('/vendor/bootstrap/css/<filename>')
def serverWidget(filename):
    return static_file(filename, root='../client/webui/vendor/bootstrap/css/')

@route('/vendor/d3/css/<filename>')
def serverWidget(filename):
    return static_file(filename, root='../client/webui/vendor/d3/css/')

@route('/vendor/bootstrap/js/<filename>')
def serverWidget(filename):
    return static_file(filename, root='../client/webui/vendor/bootstrap/js/')

@route('/vendor/d3/js/<filename>')
def serverWidget(filename):
    return static_file(filename, root='../client/webui/vendor/d3/js/')

@route('/vendor/angular-ui/js/<filename>')
def serverWidget(filename):
    return static_file(filename, root='../client/webui/vendor/angular-ui/js/')

@route('/vendor/angular/js/<filename>')
def serverWidget(filename):
    return static_file(filename, root='../client/webui/vendor/angular/js/')

@route('/vendor/bootstrap/fonts/<filename>')
def serverWidget(filename):
    return static_file(filename, root='../client/webui/vendor/bootstrap/fonts/')

@route('/inCharts/<filename>')
def serverImg(filename):
    return static_file(filename, root='../client/webui/inCharts')

@route('/vendor/jsTree/<filename>')
def serverWidget(filename):
    return static_file(filename, root='../client/webui/vendor/jsTree/')

@route('/vendor/jsTree/themes/default/<filename>')
def serverWidget(filename):
    return static_file(filename, root='../client/webui/vendor/jsTree/themes/default/')

@route('/vendor/angular-other/<filename>')
def serverWidget(filename):
    return static_file(filename, root='../client/webui/vendor/angular-other/')

@route('/vendor/jsPlumb/<filename>')
def serverWidget(filename):
    return static_file(filename, root='../client/webui/vendor/jsPlumb/')

@route('/jsPlumbAngular/<filename>')
def serverWidget(filename):
    return static_file(filename, root='../client/webui/jsPlumbAngular/')

@route('/templates/workbench/catalog/<filename>')
def serverWidget(filename):
    return static_file(filename, root='../client/webui/templates/workbench/catalog/')

@route('/templates/workbench/<filename>')
def serverWidget(filename):
    return static_file(filename, root='../client/webui/templates/workbench/')

@route('/templates/workbench/catalog/datasetWizard/<filename>')
def serverWidget(filename):
    return static_file(filename, root='../client/webui/templates/workbench/catalog/datasetWizard/')

@route('/partials/workbench/<filename>')
def serverWidget(filename):
    return static_file(filename, root='../client/webui/partials/workbench/')

@route('/partials/tenantAdmin/<filename>')
def serverWidget(filename):
    return static_file(filename, root='../client/webui/partials/tenantAdmin/')

@route('/application/users/<filename>')
def serverWidget(filename):
    return static_file(filename, root='../client/webui/application/users/')

@route('/inJsonTree/<filename>')
def serverWidget(filename):
    return static_file(filename, root='../client/webui/inJsonTree/')

@route('/inJsonTree/css/<filename>')
def serverWidget(filename):
    return static_file(filename, root='../client/webui/inJsonTree/css/')

@route('/inJsonTree/css/assets/<filename>')
def serverWidget(filename):
    return static_file(filename, root='../client/webui/inJsonTree/css/assets/')

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
  curl -H "X-AUTH-HEADER: $s" --data-binary '{"level":"debug"}' -i -H 'Content-Type: application/json' http://localhost:8080/log/setLevel
'''
    # Temporarily allow this service with logging in.
    #    (status, obj, values, user) = getRequestParams(request, response,
    #                                                   ('level',))
    (status, obj, values) = getRequestParamsNoLogin(request, response,
                                                    ('level',))
    # Make sure the required parameters are present.
    if not status:
        return values

    if not getLogger():
        reply = {'status':'ERROR', 'message':'no log file'}
        return simplejson.dumps(reply);

    # Get the 'level' parameter.
    (levelName,) = values
    # Turn the log level name into a value recognized by the logging module.
    lvl = {'debug':logging.DEBUG,
           'info':logging.INFO,
           'warning':logging.WARNING,
           'error':logging.ERROR,
           'critical':logging.CRITICAL}.get(levelName)
    # Make sure the log level name is valid.
    if lvl is None:
        getLogger().error('bad log level: ' + levelName)
        reply = {'status':'ERROR', 'message':'bad log level: ' + levelName}
        return simplejson.dumps(reply);
    # Temporarily set the level to info so that the next message will appear.
    getLogger().setLevel(logging.INFO)
    getLogger().info('setting log level to ' + levelName)
    getLogger().setLevel(lvl)
    reply = {'status':'OK'}
    return simplejson.dumps(reply);

######################################################################
# Create a tenant.
######################################################################
@route('/tenant/new',method=['OPTIONS','POST'])
def newTenant():
    '''
Create a tenant.

The request data is a JSON object of the form:
 {'name':NAME, 'password':PASSWORD, 'email':EMAIL}
 where:
 NAME is the name of the tenant to be created,
 PASSWORD is the password (in plain text), and
 EMAIL is the tenant email address of the administrator

Response body on success:
 {'status':'OK'}
Response body on error:
 {'status':'ERROR','message':MESSAGE}
   where MESSAGE explains the error
   and other fields may contain additional information

Sample command to test this URL:
  curl -H "X-AUTH-HEADER: $s" --data-binary '{"name":"foo","password":"bar","email":"me@here"}' -i -H 'Content-Type: application/json' http://localhost:8080/tenant/new
'''
    if request.method == 'OPTIONS':
        return {}
    return callDbFunc(TenantUtil.addTenant,
                      (('name',str),
                       ('password',str),
                       ('email',str)),
                      'tenantId')


######################################################################
# Create a tenant and a user.
######################################################################
@route('/tenant/newWithUser',method=['OPTIONS','POST'])
def newTenantWithUser():
    '''
Create a tenant and a user.  The user name is <tenant-name>-admin
unless that user name is already in use; if so, a suffix is added
to make the user name unique.

The request data is a JSON object of the form:
 {'tenantName':TENANTNAME, 'password':PASSWORD, 'email':EMAIL}
 where:
 TENANTNAME is the name of the tenant to be created,
 PASSWORD is the password (in plain text), and
 EMAIL is the tenant email address of the administrator

Response body on success:
 {'status':'OK','tenantId',TENANTID,'userName':USERNAME,'userId':USERID}
 where:
 TENANTID is the id of the newly created tenant
 USERNAME is the name of the newly created
 USERID is the id of the newly created user
Response body on error:
 {'status':'ERROR','message':MESSAGE}
   where MESSAGE explains the error
   and other fields may contain additional information

Sample command to test this URL:
  curl -H "X-AUTH-HEADER: $s" --data-binary '{"tenantName":"foo","password":"bar","email":"me@here"}' -i -H 'Content-Type: application/json' http://localhost:8080/tenant/newWithUser
'''
    if request.method == 'OPTIONS':
        return {}

    (status, obj, values) = getRequestParamsNoLogin(request, response,
                                                    ('tenantName', 'password', 'email'))
    if not status:
        return values # error message
    (tenantName, password, email) = values

    try:
        tenantId = TenantUtil.addTenant(tenantName, password, email, logger=getLogger())
        '''
        Create the tenant in the HDFS filesystem also
        '''
        payload = { 'tenantId' : tenantId }
        resp = requests.post(HOST + '/createTenantFolder', data=json.dumps(payload), headers={'Content-type':'application/json'})
        logger = getLogger()
        logger.info('Created Tenant in HDFS ' + tenantId)
    except Exception, ex:
        reply = {'status':'ERROR',
                 'message':str(ex)}
        return simplejson.dumps(reply)

    # Try creating a user named <tenant-name>-admin.  If that fails,
    # try <tenant-name>-admin1, <tenant-name>-admin2, etc.
    userNameIter = 0
    while userNameIter < 100: # arbitrary number of times to try
        if userNameIter == 0: # 0 means no suffix
            userName = tenantName + '-admin'
        else:                 # otherwise use userNameIter in decimal
            userName = tenantName + '-admin%d' % userNameIter
        try:
            userId = TenantUtil.addUser(userName, email, password, tenantId,
                                        TenantUtil._ROLE_TENANT_ADMIN,
                                        logger=None)
            reply = {'status':'OK',
                     'tenantId':tenantId,
                     'userName':userName,
                     'userId':userId}
            return simplejson.dumps(reply);
        except TenantUtil.DatabaseIntegrityError: # user already exists
            userNameIter = userNameIter + 1 # try another name

    reply = {'status':'ERROR', 'message':'Cannot create new user',
             'tenantId':tenantId}
    return simplejson.dumps(reply);

######################################################################
# Delete a tenant by name.
######################################################################
@route('/tenant/deleteByName',method=['OPTIONS','POST'])
def deleteTenant():
    '''
Delete a tenant by name.

The request data is a JSON object of the form:
 {'name':NAME}
 where:
 NAME is the name of the tenant to be deleted.

Response body on success:
 {'status':'OK'}
Response body on error:
 {'status':'ERROR','message':MESSAGE}
   where MESSAGE explains the error
   and other fields may contain additional information

Sample command to test this URL:
  curl -H "X-AUTH-HEADER: $s" --data-binary '{"name":"foo"}' -i -H 'Content-Type: application/json' http://localhost:8080/tenant/deleteByName
    '''
# TODO: is this needed?  will normally delete by id
#
    if request.method == 'OPTIONS':
        return {}
    return callDbFunc(TenantUtil.deleteTenantByName,
                      (('name',str),),
                      None)

######################################################################
# Delete a tenant by id.
######################################################################
@route('/tenant/deleteById',method=['OPTIONS','POST'])
def deleteTenantById():
    '''
Delete a tenant by id

The request data is a JSON object of the form:
 {'id':ID}
 where:
 ID is the tenant id

Response body on success:
 {'status':'OK'}
Response body on error:
 {'status':'ERROR','message':MESSAGE}
   where MESSAGE explains the error
   and other fields may contain additional information

Sample command to test this URL:
  curl -H "X-AUTH-HEADER: $s" --data-binary '{"id":"123"}' -i -H 'Content-Type: application/json' http://localhost:8080/tenant/deleteById
'''
    if request.method == 'OPTIONS':
        return{}
    return callDbFunc(TenantUtil.deleteTenantById,
                      (('id',str),),
                      None)

######################################################################
# Return a list of tenants.
######################################################################
@route('/tenant/list',method=['OPTIONS','POST'])
def listTenants():
    '''
Return a list of tenants.

The request data is currnetly not used but eventually will include
a password or other authentication token.

Response body on success:
 {'status':'OK','tenants':TENANT-LIST}
   where TENANT-LIST is a list of tenant id/name/email lists
   (id is an integer)
Response body on error:
 {'status':'ERROR','message':MESSAGE}
   where MESSAGE explains the error
   and other fields may contain additional information

Sample command to test this URL:
  curl -H "X-AUTH-HEADER: $s" --data-binary '{}' -i -H 'Content-Type: application/json' http://localhost:8080/tenant/list
'''
    if request.method == 'OPTIONS':
        return{}
    return callDbFunc(TenantUtil.listTenants, (), 'tenants')

######################################################################
# Create a user.
######################################################################
@route('/user/new',method=['OPTIONS','POST'])
def newUser():
    '''
Create a user.

The request data is a JSON object of the form:
 {'name':NAME, 'password':PASSWORD, 'email':EMAIL,
  'tenantId':TENANTID, 'role':ROLE'
 where:
 NAME is the name of the user to be created,
 PASSWORD is the new user's password (in plain text)
 EMAIL is the new user's email address.
 TENANTID is the id of the tenant to which the new user will belong
 ROLE is the new user's role, and is one of:
   1 for an ordinary user
   2 for a tenant administrator user

Response body on success:
 {'status':'OK','userId':USERID}
   where USERID is the id of the newly created user
Response body on error:
 {'status':'ERROR','message':MESSAGE}
   where MESSAGE explains the error
   and other fields may contain additional information

TODO: check that the logged-in user is allowed to create new users

TODO: only the site administrator should be able to create new users
belonging to another tenant

TODO: return the id of the new user

Sample command to test this URL:
  curl -H "X-AUTH-HEADER: $s" --data-binary '{"name":"foo","password":"bar","email":"me@here","tenantId":"xyz","role":2}' -i -H 'Content-Type: application/json' http://localhost:8080/user/new
'''
    if request.method == 'OPTIONS':
        return{}
    return callDbFunc(TenantUtil.addUser,
                      (('name',str),
                       ('email',str),
                       ('password',str),
                       ('tenantId',str),
                       ('role',int)),
                      'userId')


######################################################################
# Delete a user by id.
######################################################################
@route('/user/deleteById',method=['OPTIONS','POST'])
def deleteUserById():
    '''
Delete a user by id.

The request data is a JSON object of the form:
 {'id':ID}
 where:
 ID is the user id

Response body on success:
 {'status':'OK'}
Response body on error:
 {'status':'ERROR','message':MESSAGE}
   where MESSAGE explains the error
   and other fields may contain additional information

TODO: check that the logged-in user is allowed to delete users

TODO: only the site administrator should be able to delete users
belonging to another tenant

Sample command to test this URL:
  curl -H "X-AUTH-HEADER: $s" --data-binary '{"id":123}' -i -H 'Content-Type: application/json' http://localhost:8080/user/deleteById
'''
    if request.method == 'OPTIONS':
        return{}
    return callDbFunc(TenantUtil.deleteUserById,
                      (('id',str),),
                      None)


######################################################################
# Return a list of users.
######################################################################
@route('/user/list',method=['OPTIONS','POST'])
def listUsers():
    '''
For the site administrator, returns a list of all users.  For a
tenant administrator, returns a list of users in that tenant.
Returns an error for anyone else.

The request data is a JSON object of the form:
 {}

Response body on success:
 {'status':'OK','users':USER-LIST}
   where USER-LIST is a list of user id/name/email/tenantId/role lists
   (id, tenantId, and role are integers)
   If the current user is a tenant administrator, tenantId is always the
   same as the tenantId of the current user.
Response body on error:
 {'status':'ERROR','message':MESSAGE}
   where MESSAGE explains the error
   and other fields may contain additional information

Sample command to test this URL:
  curl -H "X-AUTH-HEADER: $s" --data-binary '{}' -i -H 'Content-Type: application/json' http://localhost:8080/user/list
'''
    if request.method == 'OPTIONS':
        return{}

    (status, obj, values, user) = getRequestParams(request, response, ())
    if not status:
        return values # error message

    (userId, userName, role) = user
    try:
        if role == TenantUtil._ROLE_SITE_ADMIN:
            # Get a list of id/name/email/tenantId/role tuples for all tenants.
            users = TenantUtil.listUsers(getLogger())
        elif role == TenantUtil._ROLE_TENANT_ADMIN:
            tenantIds = TenantUtil.listTenantsByUserId(userId, logger=None)
            # Find the user's tenant id in the database.  Normally there should be exactly 1.
            if not tenantIds:
                return simplejson.dumps({'status':'ERROR','message':"can't find tenant id for user id %s" % userId})
            tenantId = tenantIds[0] # use the first tenant id
            # Get a list of id/name/email/role tuples for this tenant.
            users = TenantUtil.listUsersByTenant(tenantId, getLogger())
            # Add the tenant id to each entry so that the format is the same whether
            # the user is the site admin or not.
            users = [(userId, name, email, tenantId, role) for \
                     (userId, name, email, role) in users]
        else: # don't let non-admins see users
            return simplejson.dumps({'status':'ERROR', 'message':'you do hot have permission to list users'})
    except Exception, ex:
        return simplejson.dumps({'status':'ERROR', 'message':str(ex)})

    # Success
    reply = {'status':'OK', 'users':users}
    return simplejson.dumps(reply)


######################################################################
# Return a list of users belonging to a tenant.
######################################################################
@route('/user/listByTenant',method=['OPTIONS','POST'])
def listUsersByTenant():
    '''
Return a list of users belonging to a tenant.

The request data is a JSON object of the form:
 {'tenantId':TENANTID}
 where:
 TENANTID is the id of the tenant whose users are to be listed

Response body on success:
 {'status':'OK','users':USER-LIST}
   where USER-LIST is a list of user id/name/email/role lists
   (id and role are integers)
Response body on error:
 {'status':'ERROR','message':MESSAGE}
   where MESSAGE explains the error
   and other fields may contain additional information

Sample command to test this URL:
  curl -H "X-AUTH-HEADER: $s" --data-binary '{"tenantId":"xyz"}' -i -H 'Content-Type: application/json' http://localhost:8080/user/listByTenant
'''
    if request.method == 'OPTIONS':
        return{}
    return callDbFunc(TenantUtil.listUsersByTenant,
                      (('tenantId',str),),
                      'users')

######################################################################
# Create a group.
######################################################################
@route('/group/new',method=['OPTIONS','POST'])
def newGroup():
    '''
Create a group.

The request data is a JSON object of the form:
 {'tenantId':TENANTID, 'name':NAME}
 where:
 TENANTID is the tenant id
 NAME is the name of the group to be created

Response body on success:
 {'status':'OK','groupId',GROUPID}
   where GROUPID is the id of the newly created group
Response body on error:
 {'status':'ERROR','message':MESSAGE}
   where MESSAGE explains the error
   and other fields may contain additional information

Sample command to test this URL, assuming a tenant with id 1 exists:
  curl -H "X-AUTH-HEADER: $s" --data-binary '{"tenantId":"xyz", "name":"sales"}' -i -H 'Content-Type: application/json' http://localhost:8080/group/new
'''
    if request.method == 'OPTIONS':
        return{}
    return callDbFunc(TenantUtil.addGroup,
                      (('tenantId',str),
                       ('name',str)),
                      'groupId')

######################################################################
# Delete a group by id.
######################################################################
@route('/group/deleteById',method=['OPTIONS','POST'])
def deleteGroupById():
    '''
Delete a group by id.

The request data is a JSON object of the form:
 {'id':ID}
 where:
 ID is the id of the group to be deleted.

Response body on success:
 {'status':'OK'}
Response body on error:
 {'status':'ERROR','message':MESSAGE}
   where MESSAGE explains the error
   and other fields may contain additional information

Sample command to test this URL:
  curl -H "X-AUTH-HEADER: $s" --data-binary '{"id":123}' -i -H 'Content-Type: application/json' http://localhost:8080/group/deleteById
'''
    if request.method == 'OPTIONS':
        return{}
    return callDbFunc(TenantUtil.deleteGroupById,
                      (('id',str),),
                      None)

######################################################################
# Return a list of groups in a tenant.
######################################################################
@route('/group/list',method=['OPTIONS','POST'])
def listGroups():
    '''
Return a list of groups in a tenant.

The request data is a JSON object of the form:
 {'tenantId':ID}
 where:
 ID is the id of the tenant whose groups are to be listed

Response body on success:
 {'status':'OK','groups':GROUP-LIST}
   where GROUP-LIST is a list of group id/name lists
Response body on error:
 {'status':'ERROR','message':MESSAGE}
   where MESSAGE explains the error
   and other fields may contain additional information

Sample command to test this URL, assuming a tenant with id 1 exists:
  curl -H "X-AUTH-HEADER: $s" --data-binary '{"tenantId":"xyz"}' -i -H 'Content-Type: application/json' http://localhost:8080/group/list
'''
    if request.method == 'OPTIONS':
        return{}
    return callDbFunc(TenantUtil.listGroups,
                      (('tenantId',str),),
                      'groups')


@route('/application/new',method=['OPTIONS','POST'])
def newApplication():
    '''
Create an application.

The request data is a JSON object of the form:
 {'groupId':GROUPID, 'name':NAME}
 where:
 GROUPID is the group id
 NAME is the name of the application to be created

Response body on success:
 {'status':'OK','applicationId',APPLICATIONID}
   where APPLICATIONID is the id of the newly created group
Response body on error:
 {'status':'ERROR','message':MESSAGE}
   where MESSAGE explains the error
   and other fields may contain additional information

Sample command to test this URL, assuming a group with id 1 exists:
  curl -H "X-AUTH-HEADER: $s" --data-binary '{"groupId":"xyz", "name":"prototype"}' -i -H 'Content-Type: application/json' http://localhost:8080/application/new
'''
    if request.method == 'OPTIONS':
        return{}
    return callDbFunc(TenantUtil.addApplication,
                      (('groupId',str),
                       ('name',str)),
                      'applicationId')


@route('/application/deleteById',method=['OPTIONS','POST'])
def deleteApplicationById():
    '''
Delete an application by id.

The request data is a JSON object of the form:
 {'id':ID}
 where:
 ID is the application id

Response body on success:
 {'status':'OK'}
Response body on error:
 {'status':'ERROR','message':MESSAGE}
   where MESSAGE explains the error
   and other fields may contain additional information

Sample command to test this URL:
  curl -H "X-AUTH-HEADER: $s" --data-binary '{"id":123}' -i -H 'Content-Type: application/json' http://localhost:8080/application/deleteById
'''
    if request.method == 'OPTIONS':
        return{}
    return callDbFunc(TenantUtil.deleteApplicationById,
                      (('id',str),),
                      None)


@route('/application/list',method=['OPTIONS','POST'])
def listApplications():
    '''
Return a list of applications in a group.

The request data is a JSON object of the form:
 {'groupId':ID}
 where:
 ID is the group id of the group whose applications
 are to be listed

Response body on success:
 {'status':'OK','applications':APPLICATION-LIST}
   where APPLICATION-LIST is a list of application id/name lists
Response body on error:
 {'status':'ERROR','message':MESSAGE}
   where MESSAGE explains the error
   and other fields may contain additional information

Sample command to test this URL, assuming a group with id 1 exists:
  curl -H "X-AUTH-HEADER: $s" --data-binary '{"groupId":"xyz"}' -i -H 'Content-Type: application/json' http://localhost:8080/application/list
'''
    if request.method == 'OPTIONS':
        return{}
    return callDbFunc(TenantUtil.listApplications,
                      (('groupId',str),),
                      'applications')


@route('/collection/new',method=['OPTIONS','POST'])
def newCollection():
    '''
Create a collection, an ElasticSearch index, and an ElasticSearch alias.

The request data is a JSON object of the form:
 {'applicationId':APPLICATIONID, 'name':NAME}
 where:
 APPLICATIONID is the application id
 NAME is the name of the collection to be created

Response body on success:
 {'status':'OK','collectionId',COLLECTIONID}
   where COLLECTIONID is the id of the newly created collection
Response body on error:
 {'status':'ERROR','message':MESSAGE}
   where MESSAGE explains the error
   and other fields may contain additional information


Sample command to test this URL, assuming an application with id 1 exists:
  curl -H "X-AUTH-HEADER: $s" --data-binary '{"applicationId":"xyz", "name":"apache logs"}' -i -H 'Content-Type: application/json' http://localhost:8080/collection/new

####################################################################
'''
    if request.method == 'OPTIONS':
        return{}
    (status, obj, values, user) = getRequestParams(request, response,
                                                   (('applicationId',str),
                                                    ('name',str)))
    if not status:
        return values # error message
    (applicationId, name) = values
    try:
        (collectionId, searchIndexId, esIndexName) = \
                       TenantUtil.addCollection(applicationId, name, logger=getLogger())
    except Exception, ex:
        reply = {'status':'ERROR',
                 'message':str(ex)}
        return simplejson.dumps(reply)
    esAliasName = collectionId

    # Create an ElasticSearch index.
    message = createElasticSearchIndex(esIndexName)
    if message:
        return simplejson.dumps({'status':'ERROR','message':message})

    # Create an ElasticSearch alias to the ElasticSearch index.
    message = createElasticSearchAlias(esAliasName, esIndexName)
    if message:
        return simplejson.dumps({'status':'ERROR','message':message})

    return simplejson.dumps({'status':'OK','collectionId':collectionId})

@route('/collection/deleteById',method=['OPTIONS','POST'])
def deleteCollectionById():
    '''
Delete a collection by id.

The request data is a JSON object of the form:
 {'id':ID}
 where:
 ID is the collection id

Response body on success:
 {'status':'OK'}
Response body on error:
 {'status':'ERROR','message':MESSAGE}
   where MESSAGE explains the error
   and other fields may contain additional information

Sample command to test this URL:
  curl -H "X-AUTH-HEADER: $s" --data-binary '{"id":123}' -i -H 'Content-Type: application/json' http://localhost:8080/collection/deleteById
'''
    if request.method == 'OPTIONS':
        return{}
    if request.method == 'OPTIONS':
        return{}
    (status, obj, values, user) = getRequestParams(request, response, (('id',str),))
    if not status:
        return values # error message
    (collectionId,) = values

    # Delete the ElasticSearch indexes.
    searchIndexEntries = TenantUtil.listSearchIndices(collectionId, logger=None)
    for (id, name) in searchIndexEntries:
        deleteElasticSearchAlias(name, collectionId)
        deleteElasticSearchIndex(name)

    try:
        rc = TenantUtil.deleteCollectionById(collectionId, logger=getLogger())
    except TenantUtil.DatabaseError, ex:
        reply = {'status':'ERROR','message':str(ex)}
        return simplejson.dumps(reply)
    # Cascading delete will cause the search_indices entries to be deleted.
    reply = {'status':'OK'}
    return simplejson.dumps(reply)

@route('/collection/list',method=['OPTIONS','POST'])
def listCollections():
    '''
Return a list of collections in an application.

The request data is a JSON object of the form:
 {'applicationId':APPLICATIONID}
 where:
 APPLICATIONID is the application id of the application whose
 collections are to be listed

Response body on success:
 {'status':'OK','collections':COLLECTION-LIST}
   where COLLECTION-LIST is a list of collection id/name lists
Response body on error:
 {'status':'ERROR','message':MESSAGE}
   where MESSAGE explains the error
   and other fields may contain additional information

Sample command to test this URL, assuming a group with id 1 exists:
  curl -H "X-AUTH-HEADER: $s" --data-binary '{"applicationId":"xyz"}' -i -H 'Content-Type: application/json' http://localhost:8080/collection/list
'''
    if request.method == 'OPTIONS':
        return{}
    return callDbFunc(TenantUtil.listCollections,
                      (('applicationId',str),),
                      'collections')

######################################################################
# Create a search index.
######################################################################
@route('/searchIndex/new',method=['OPTIONS','POST'])
def newSearchIndex():
    '''
Create a search index.

The request data is a JSON object of the form:
 {'collectionId':COLLECTIONID, 'name':NAME}
 where:
 COLLECTIONID is the collection id
 NAME is the name of the search index to be created

Response body on success:
 {'status':'OK','searchIndexId',SEARCHINDEXID}
   where SEARCHINDEXID is the id of the newly created search index
Response body on error:
 {'status':'ERROR','message':MESSAGE}
   where MESSAGE explains the error
   and other fields may contain additional information

Sample command to test this URL, assuming a collection with id "xyz" exists:
  curl -H "X-AUTH-HEADER: $s" --data-binary '{"collectionId":"xyz", "name":"index 2"}' -i -H 'Content-Type: application/json' http://localhost:8080/searchIndex/new
'''
    if request.method == 'OPTIONS':
        return{}
    return callDbFunc(TenantUtil.addSearchIndex,
                      (('collectionId',str),
                       ('name',str)),
                      'searchIndexId')

######################################################################
# Delete a search index by id.
######################################################################
@route('/searchIndex/deleteById',method=['OPTIONS','POST'])
def deleteSearchIndexById():
    '''
Delete a search index by id.

The request data is a JSON object of the form:
 {'id':ID}
 where:
 ID is the search index id

Response body on success:
 {'status':'OK'}
Response body on error:
 {'status':'ERROR','message':MESSAGE}
   where MESSAGE explains the error
   and other fields may contain additional information

Sample command to test this URL:
  curl -H "X-AUTH-HEADER: $s" --data-binary '{"id":"xyz"}' -i -H 'Content-Type: application/json' http://localhost:8080/searchIndex/deleteById
'''
    if request.method == 'OPTIONS':
        return{}
    return callDbFunc(TenantUtil.deleteSearchIndexById,
                      (('id',str),),
                      None)


@route('/searchIndex/list',method=['OPTIONS','POST'])
def listSearchIndices():
    '''
Return a list of search indices in a collection.

The request data is a JSON object of the form:
 {'collectionId':COLLECTIONID}
 where:
 COLLECTIONID is the id of the collection whose search indices
 are to be listed

Response body on success:
 {'status':'OK','searchIndices':SEARCH-INDEX-LIST}
   where SEARCH-INDEX-LIST is a list of search index id/name lists
Response body on error:
 {'status':'ERROR','message':MESSAGE}
   where MESSAGE explains the error
   and other fields may contain additional information

Sample command to test this URL, assuming a collection with id "xyz" exists:
  curl -H "X-AUTH-HEADER: $s" --data-binary '{"collectionId":"xyz"}' -i -H 'Content-Type: application/json' http://localhost:8080/searchIndex/list
 '''
    if request.method == 'OPTIONS':
        return{}
    return callDbFunc(TenantUtil.listSearchIndices,
                      (('collectionId',str),),
                      'searchIndices')




@route('/dashboard/new',method=['OPTIONS','POST'])
def addDashboard():
    '''
Add a dashboard for the current user.

The request data is a JSON object of the form:
 {'name':NAME,'dashboard':DASHBOARD}
 where:
 NAME is the name to be associated with the dashboard
 DASHBOARD is the dashboard as a string

Response body on success:
 {'status':'OK','dashboardId',DASHBOARDID}
   where DASHBOARDID is the id of the newly created dashboard
Response body on error:
 {'status':'ERROR','message':MESSAGE}
   where MESSAGE explains the error
   and other fields may contain additional information

Sample command to test this URL, assuming a user with id 1 exists:
  curl -H "X-AUTH-HEADER: $s" --data-binary '{"name":"db1","dashboard":"123"}' -i -H 'Content-Type: application/json' http://localhost:8080/dashboard/new
'''
    if request.method == 'OPTIONS':
        return{}
    return callDbFuncWithUserId(TenantUtil.addDashboard,
                                (('name',str),
                                 ('dashboard',str)),
                                'dashboardId')


@route('/dashboard/update',method=['OPTIONS','POST'])
def updateDashboard():
    if request.method == 'OPTIONS':
        return{}
    return callDbFuncWithUserId(TenantUtil.updateDashboard,
                                (('id',str),
                                 ('dashboard',str)), 'dashboardId')
                                

@route('/dashboard/deleteById',method=['OPTIONS','POST'])
def deleteDashboardById():
    '''
Delete a dashboard by id.

The request data is a JSON object of the form:
 {'id':ID}
 where:
 ID is the dashboard id

Response body on success:
 {'status':'OK'}
Response body on error:
 {'status':'ERROR','message':MESSAGE}
   where MESSAGE explains the error
   and other fields may contain additional information

Sample command to test this URL:
  curl -H "X-AUTH-HEADER: $s" --data-binary '{"id":123}' -i -H 'Content-Type: application/json' http://localhost:8080/dashboard/deleteById
'''
    if request.method == 'OPTIONS':
        return {}
    return callDbFunc(TenantUtil.deleteDashboardById,
                      (('id',str),),
                      None)


######################################################################
# Return a list of dashboards for the current user.
######################################################################
@route('/dashboard/list',method=['OPTIONS','POST'])
def listDashboards():
    '''
Return a list of dashboards for the current user.
The request data is currently not used.

Response body on success:
 {'status':'OK','dashboards':DASHBOARD-LIST}
   where DASHBOARD-LIST is a list of dashboard id/name/value lists
   (id is an integer)
Response body on error:
 {'status':'ERROR','message':MESSAGE}
   where MESSAGE explains the error
   and other fields may contain additional information

Sample command to test this URL:
  curl -H "X-AUTH-HEADER: $s" --data-binary '{}' -i -H 'Content-Type: application/json' http://localhost:8080/dashboard/list
'''
    if request.method == 'OPTIONS':
        return{}
    return callDbFuncWithUserId(TenantUtil.listDashboardsByUser, (),
                                'dashboards')

@route('/plugin/new',method=['OPTIONS','POST'])
def addPlugin():
    '''
Add a plugin.

The request has content-type multipart/form-data and contains two components,
called "json" and "plugin".  The "json" part is a JSON object of the form:
 {'name':NAME,'docTypes':DOCTYPES,'collectionIds':COLLECTIONIDS,
  'applicationIds':APPLICATIONIDS,'groupIds':GROUPIDS,
  'tenantIds':TENANTIDS}
 where:
 NAME is the name to be associated with the plugin
 DOCTYPES is a list of doctype that it applies to
 COLLECTIONIDS is an optional list of collection ids for this plugin
 APPLICATIONIDS is an optional list of application ids; the plugin
  will be called for any collection in any of these applications
 GROUPIDS is an optional list of group ids; the plugin will be called
  for any collection in any application in any of these groups
 TENANTIDS is (for consistency with the other values) an optional list of
  tenant ids, but only the tenant that the user belongs to can be specified;
  if it is, the plugin will be called for any collection in any application
  in any group in the tenant
For compatibility with earlier versions, the input can also contain:
 {'docType':DOCTYPE}
  where:
 DOCTYPE is a single doctype.  If this is present, the value will be added
 to the list in docTypes.
   
The "plugin" part is the plugin file contents (Python source code).

Response body on success:
 {'status':'OK','pluginId',PLUGINID}
   where PLUGINID is the id of the newly created plugin
Response body on error:
 {'status':'ERROR','message':MESSAGE}
   where MESSAGE explains the error
   and other fields may contain additional information

Sample commands to test this URL, assuming $s is a valid session id and
the plugin source is /my/plugin.py:
tmpfile=/tmp/$$.json
echo -n '{"name":"myplugin","docTypes":["apacheAccess"],"collectionIds":["111","222","333"]}' > $tmpfile
curl -H "X-AUTH-HEADER: $s" -F json=@$tmpfile  -F plugin=@/my/plugin.py "http://localhost:8080/plugin/new"
rm $tmpfile

Notes:
1. Do not specify a --content-type header; curl adds it automatically.
2. The --form-string option takes the data inline instead of referring to a file, but it does not add a filename attribute, which bottle seems to require.  Therefore these commands store the JSON data in a temporary file and use -F (instead of --form-string) with "@" to refer to the file.
'''
    if request.method == 'OPTIONS':
        return {}

    # Verify that the user is logged in.
    (status, user) = checkLogin(response)
    if not status:
        return user # error message
    # user is a userid/username/role tuple.

    # Make sure a tenantId is defined for this user.
    (userId, userName, role) = user
    (status, tenantId) = getTenantIdFromUserId(userId)
    if not status:
        return tenantId # error message

    # Check the content-type.  Ignore attributes.
    requestContenTypeFields = request.content_type.split(';')
    if not requestContenTypeFields:
        reply = {'status':'ERROR','message':'missing Content-Type header'}
        return simplejson.dumps(reply);
    requestContenType = requestContenTypeFields[0]
    if requestContenType != 'multipart/form-data':
        reply = {'status':'ERROR','message':'Content-Type is "%s", must be "multipart/form-data"' % requestContenType }
        return simplejson.dumps(reply);

    # Get the "json" input file.
    jsonInputFile = request.files.get('json')
    if not jsonInputFile:
        reply = {'status':'ERROR','message':'missing "json" data in input'}
        return simplejson.dumps(reply);
    # Read the contents of the "json" input file.
    rawJsonData = jsonInputFile.file.read()
    try:
        jsonData = simplejson.loads(rawJsonData)
    except:
        reply = {'status':'ERROR','message':'invalid json data in input',
                 'bad-json':rawJsonData}
        return simplejson.dumps(reply)

    # Get the name from the JSON data.
    pluginName = jsonData.get('name')
    if not pluginName:
        reply = {'status':'ERROR','message':'missing "name" parameter in json data'}
        return simplejson.dumps(reply)
    
    # Get the docTypes, collectionIds, applicationIds, groupIds, and tenantIds
    # from the JSON data.
    docTypes = jsonData.get('docTypes')
    collectionIds = jsonData.get('collectionIds')
    applicationIds = jsonData.get('applicationIds')
    groupIds = jsonData.get('groupIds')
    tenantIds = jsonData.get('tenantIds')

    if not collectionIds and not applicationIds and \
       not groupIds and not tenantIds:
        reply = {'status':'ERROR','message':'"collectionIds", "applicationIds", "groupIds", or "tenantIds"  parameter must be present in json data'}
        return simplejson.dumps(reply)

    # Make sure each one is None or a list.
    for (name, var) in \
            (('docTypes', docTypes),
             ('collectionIds', collectionIds),
             ('applicationIds', applicationIds),
             ('groupIds', groupIds),
             ('tenantIds', tenantIds)):
        if var is not None and type(var) != types.ListType:
            reply = {'status':'ERROR','message':'"%s" parameter in json data is not a list' % name}
            return simplejson.dumps(reply)

    # Get the docType value from the JSON data.
    # Multiple doctypes are now allowed; the docType value is for
    # compatibility with earlier versions, which required exactly one value.
    # If specified, add it to the list (if any) specified by docTypes.
    docType = jsonData.get('docType')
    if docType:
        if docTypes is None:
            docTypes = [docType]
        else:
            docTypes.append(docType)

    if not docTypes:
        reply = {'status':'ERROR','message':'a "docType" or "docTypes" parameter must be present in json data'}
        return simplejson.dumps(reply)

    # TODO: verify that the ids belong to this user's tenant.

    # Get the plugin data.
    pluginInputFile = request.files.get('plugin')
    if not pluginInputFile:
        reply = {'status':'ERROR','message':'missing "plugin" data in input'}
        return simplejson.dumps(reply);
    pluginCode = pluginInputFile.file.read()

    # Create a database entry for the plugin.
    pluginId = TenantUtil.addPlugin(pluginName, tenantId, 1, pluginCode,
                                    logger=getLogger())

    # Create a database entry for each doctype that the plugin applies to.
    if docTypes:
        for docType in docTypes:
            TenantUtil.addPluginDocType(pluginId, docType,
                                    logger=getLogger())

    # Create a database entry for each collection id, etc. that it applies to.
    if collectionIds:
        for id in collectionIds:
            TenantUtil.addPluginCollection(pluginId, id, logger=getLogger())

    if applicationIds:
        for id in applicationIds:
            TenantUtil.addPluginApplication(pluginId, id, logger=getLogger())

    if groupIds:
        for id in groupIds:
            TenantUtil.addPluginGroup(pluginId, id, logger=getLogger())

    if tenantIds:
        for id in tenantIds:
            TenantUtil.addPluginTenant(pluginId, id, logger=getLogger())

    reply = {'status':'OK', 'pluginId':pluginId}
    return simplejson.dumps(reply)

@route('/plugin/setEnabled',method=['OPTIONS','POST'])
def enableOrDisablePlugin():
    '''
Enable a plugin.  Has no effect if the plugin is already enabled.

The request data is a JSON object of the form:
 {'id':ID, enabled=ENABLED}
 where:
 ID is the plugin id
 ENABLED is 1 to enable the plugin or 0 to disable the plugin

Response body on success:
 {'status':'OK'}
Response body on error:
 {'status':'ERROR','message':MESSAGE}
   where MESSAGE explains the error
   and other fields may contain additional information

Sample command to test this URL:
curl -H "X-AUTH-HEADER: $s" --data-binary '{"id":"123","enabled":0}' -i -H 'Content-Type: application/json' http://localhost:8080/plugin/setEnabled
'''
    if request.method == 'OPTIONS':
        return {}
    (status, obj, values, user) = getRequestParams(request, response,
                                                   ('id', 'enabled'))
    if not status:
        return values # error message
    # Get the 'id' and 'enabled' parameters.
    (pluginId, enabled) = values
    # TODO: verify that the plugin exists and is owned by this user's tenant.
    if enabled not in (0, 1):
        reply = {'status':'ERROR', 'message':'"enabled" flag must be 0 or 1'}
        return simplejson.dumps(reply)
    TenantUtil.pluginSetEnabled(pluginId, enabled, logger=getLogger())
    reply = {'status':'OK'}
    return simplejson.dumps(reply)

@route('/plugin/deleteById',method=['OPTIONS','POST'])
def deletePluginById():
    '''
Delete a plugin by id.

The request data is a JSON object of the form:
 {'id':ID}
 where:
 ID is the plugin id

Response body on success:
 {'status':'OK'}
Response body on error:
 {'status':'ERROR','message':MESSAGE}
   where MESSAGE explains the error
   and other fields may contain additional information

Sample command to test this URL:
  curl -H "X-AUTH-HEADER: $s" --data-binary '{"id":"123"}' -i -H 'Content-Type: application/json' http://localhost:8080/plugin/deleteById
'''
    if request.method == 'OPTIONS':
        return {}
    (status, obj, values, user) = getRequestParams(request, response, ('id',))
    if not status:
        return values # error message
    # Get the 'id' parameter.
    (pluginId,) = values

    # TODO: verify that the plugin belongs to this user's tenant.

    # Delete the entry in the plugins table and the associated entries in the
    # plugincollections table.
    return callDbFunc(TenantUtil.deletePluginById,
                      (('id',str),),
                      None)

@route('/plugin/list',method=['OPTIONS','POST'])
def listPlugins():
    '''
Return a list of the plugins belonging to the tenant for this user.
The request data is currently not used.

Response body on success:
 {'status':'OK','plugins':PLUGIN-LIST}
   where PLUGIN-LIST is a list of JSON objects of the form:
   {'id':ID,'name':NAME,'enabled':ENABLED,'docTypes':DOCTYPES,
    'collectionIds':COLLECTIONIDS,'applicationIds'=APPLICATIONIDS,
    'groupIds':GROUPIDS,'tenantIds':TENANTIDS}
   where:
     ID is the id of the plugin
     NAME is the name of the plugin
     ENABLED is 1 if the plugin is enabled, otherwise 0
     COLLECTIONIDS is a list of collection ids defined for the plugin; it
       does not include collections called indirectly through the defined
       applications, groups, or tenants
     APPLICATIONIDS is a list of application ids defined for the plugin;
       the plugin is called for any collections in the applications
     GROUPIDS is a list of group ids defined for the plugin;
       the plugin is called for any collections in the groups
     TENANTIDS is a list of tenant ids defined for the plugin;
       the plugin is called for any group in the tenant

Response body on error:
 {'status':'ERROR','message':MESSAGE}
   where MESSAGE explains the error
   and other fields may contain additional information

Sample command to test this URL:
  curl -H "X-AUTH-HEADER: $s" --data-binary '{}' -i -H 'Content-Type: application/json' http://localhost:8080/plugin/list
'''
    if request.method == 'OPTIONS':
        return {}

    # Make sure the user is logged in.
    (status, user) = checkLogin(response)
    if not status:
        return user # error message

    # Make sure a tenantId is defined for this user.
    (userId, userName, role) = user
    (status, tenantId) = getTenantIdFromUserId(userId)
    if not status:
        return tenantId # error message

    # Get a list of id/name/enabled tuples for this tenant.
    plugins = TenantUtil.listPluginsByTenant(tenantId, logger=getLogger())
    # Add each plugin's collection ids.
    pluginList = []
    for plugin in plugins:
        pluginId = plugin[0]
        pluginObj = {'id':pluginId,
                     'name':plugin[1],
                     'enabled':plugin[2],
                     'collectionIds':TenantUtil.listPluginCollectionsByPluginId(pluginId),
                     'applicationIds':TenantUtil.listPluginApplicationsByPluginId(pluginId),
                     'groupIds':TenantUtil.listPluginGroupsByPluginId(pluginId),
                     'tenantIds':TenantUtil.listPluginTenantsByPluginId(pluginId),
                     'docTypes':TenantUtil.listPluginDocTypes(pluginId)}
        
        pluginList.append(pluginObj)
    reply = {'status':'OK', 'plugins':pluginList}
    return simplejson.dumps(reply)

@route('/aggregationCriteria/set',method=['OPTIONS','POST'])
def setAggregationCriteria():
    '''
Set or delete the aggregation criteria for the specified doctype.

The request data is a JSON object of the form:
 {'docType':DOCTYPE,'expr':EXPR,'tenantId':TENANTID}
 where:
 DOCTYPE is the doc type to which expr applies
 EXPR is null to delete any existing value for the doc type
   and tenant id, or an array objects (corresponding to a Python list
   of dictionaries), e.g.
   [{"name" : "none_doctype_agg", "field": "_type", "type" : "terms"}, {"name" : "none_date_range_agg", "field" : "@timestamp", "type" : "range" }]
 TENANTID is optional and is allowed only if the user has the right
   permission.  If it is not specified, the tenant id of the user is used.
   If it is specified, it is one of the following:
     - a tenant id
     - "all" for values that are to be used for all tenants in addition to ones
       defined for each tenant
     - "default" for items that are used to initialize new tenants

Response body on success:
 {'status':'OK'}
Response body on error:
 {'status':'ERROR','message':MESSAGE}
   where MESSAGE explains the error

Sample command to test this URL to set a value:
  curl -H "X-AUTH-HEADER: $s" --data-binary '{"docType":"apacheAccess","expr":[{"name" : "apacheAccess_http_status_agg", "field" : "http_status", "type" : "terms"}]}' -i -H 'Content-Type: application/json' http://localhost:8080/aggregationCriteria/set

Sample command to test this URL to remove a value:
  curl -H "X-AUTH-HEADER: $s" --data-binary '{"docType":"apacheAccess","expr":null}' -i -H 'Content-Type: application/json' http://localhost:8080/aggregationCriteria/set
'''
    if request.method == 'OPTIONS':
        return {}

    (status, obj, values, user) = getRequestParams(request, response,
                                                   ('docType', 'expr'))
    if not status:
        return values # error message

    (userId, userName, role) = user

    # Get the 'docType' and 'expr' parameters.
    (docType, expr) = values

    # Check that expr is either None (corresponding to JSON null) or
    # a list of dictionaries (corresponding to a JSON array of objects).
    if expr is None:
        dbExpr = None
    else:
        # Check that it's a list.
        if type(expr) != list:
            reply = {'status':'ERROR',
                     'message':"expr '%s' is not a JSON array" % \
                     simplejson.dumps(expr)}
            return simplejson.dumps(reply);
        # Check that every element is a dictionary.
        for field in expr:
            if type(field) != dict:
                reply = {'status':'ERROR',
                         'message':"'%s' is not a JSON object" % \
                         simplejson.dumps(field)}
                return simplejson.dumps(reply);
        dbExpr = simplejson.dumps(expr)

    userTenantIds = TenantUtil.listTenantsByUserId(userId,
                                                   logger=getLogger())
    # Find the user's tenant id in the database.
    if not userTenantIds:
        reply = {'status':'ERROR','message':"can't find tenant id for user id %s" % userId}
        return simplejson.dumps(reply);
    userTenantId = userTenantIds[0]

    # If the request includes a tenant id, check that either it's the
    # the same as the user's tenant id or the user is authorizied
    # to specify a different value.
    (tenantId,) = extractOptionalParams(obj, ['tenantId'])
    if tenantId:
        if role != TenantUtil._ROLE_SITE_ADMIN and tenantId != userTenantId:
            reply = {'status':'ERROR','message':'you must be a site administrator to specify a tenant id'}
            return simplejson.dumps(reply);
        # TODO: check that the value is "all", "default", or a valid tenant id
    else:
        tenantId = userTenantId
    TenantUtil.setAggregationCriteria(docType, tenantId,
                                      dbExpr, logger=getLogger())
    return simplejson.dumps({'status':'OK'})

@route('/aggregationCriteria/list',method=['OPTIONS','POST'])
def listAggregationCriteria():
    '''
List the aggregation criteria for the specified doctype.

The request data is a JSON object of the form:
 {'docType':DOCTYPE,'tenantId':TENANTID}
 where:
 DOCTYPE is the doc type to which expr applies
 TENANTID is optional.  If it is not specified, the tenant id of the user is used.
   If it is specified, it is one of the following:
     - a tenant id
     - "all" for values that are to be used for all tenants in addition to ones
       defined for each tenant
     - "default" for items that are used to initialize new tenants

Response body on success:
 {'status':'OK','expr':EXPR}
   where EXPR is the aggregation criteria or null
Response body on error:
 {'status':'ERROR','message':MESSAGE}
   where MESSAGE explains the error

Sample command to test this URL:
  curl -H "X-AUTH-HEADER: $s" --data-binary '{"docType":"apacheAccess"}' -i -H 'Content-Type: application/json' http://localhost:8080/aggregationCriteria/list
'''
    if request.method == 'OPTIONS':
        return {}

    (status, obj, values, user) = getRequestParams(request, response,
                                                   ('docType',))
    if not status:
        return values # error message

    (userId, userName, role) = user

    # Get the 'docType' parameter.
    (docType,) = values

    # TODO: make this common code that can also be called from
    # setAggregationCriteria().
    userTenantIds = TenantUtil.listTenantsByUserId(userId,
                                                   logger=getLogger())
    # Find the user's tenant id in the database.
    if not userTenantIds:
        reply = {'status':'ERROR','message':"can't find tenant id for user id %s" % userId}
        return simplejson.dumps(reply);
    userTenantId = userTenantIds[0]
    # TODO: check that the user has permission to specify a tenant id --
    # combine with the code in setAggregationCriteria().
    # It may be OK to let anyone get the 'default' and 'all' entries.
    (tenantId,) = extractOptionalParams(obj, ['tenantId'])
    if not tenantId:
        tenantId = userTenantId

    if tenantId == 'all':
        strList = TenantUtil.listAggregationCriteria(docType, None,
                                                     True, False,
                                                     logger=getLogger())
    elif tenantId == 'default':
        strList = TenantUtil.listAggregationCriteria(docType, None,
                                                     False, True,
                                                     logger=getLogger())
    else:
        strList = TenantUtil.listAggregationCriteria(docType, tenantId,
                                                     False, False,
                                                     logger=getLogger())

    if not strList:
        reply = {'status':'OK','expr':None}
        return simplejson.dumps(reply);

    dictList = []
    for entry in strList:
        # Try to interpret eac entry as a string representation of a
        # JSON value.
        try:
            value = simplejson.loads(entry)
        except Exception, ex:
            reply = {'status':'ERROR',
                     'message':"bad JSON value in database: '%s': %s" % \
                     (entry, ex)}
            return simplejson.dumps(reply);

        # Make sure it's a list (JSON array).
        if type(value) != list:
            reply = {'status':'ERROR',
                     'message':"value in database is not a JSON array: '%s'" % \
                     value}
            return simplejson.dumps(reply);

        # If there's more than one list, combine them.
        dictList += value

    return simplejson.dumps({'status':'OK','expr':dictList})

@route('/getTenantId',method=['OPTIONS','POST'])
def getTenantId():
    '''
Show the tenant id(s) of the current user.  Normally there should be
exactly one, but this handles the case where the database gets
out of sync and there are no entries or multiple entries.

The request data is a an empty JSON object.

Response body on success:
 {'status':'OK','result':TENANTIDS}
   where TENANTIDS is a list of tenant ids.

Response body on error:
 {'status':'ERROR','message':MESSAGE}
   where MESSAGE explains the error
   and other fields may contain additional information

Sample command to test this URL:
  curl -H "X-AUTH-HEADER: $s" --data-binary '{}' -H 'Content-Type: application/json' http://localhost:8080/getTenantId
'''
    if request.method == 'OPTIONS':
        return{}
    return callDbFuncWithUserId(TenantUtil.listTenantsByUserId, (),
                                'tenantIds')

@route('/getTenantIdByName',method=['OPTIONS','POST'])
def getTenantIdByName():
    '''
Look up a tenant by name and return the id(s).  Normally there should
be at most one, but this handles the case where the database gets
out of sync and there are multiple entries.

Only a user with _ROLE_SITE_ADMIN is allowed to use this call.

The request data is a JSON object of the form:
 {'tenantName':TENANTNAME}
 where:
 TENANTNAME is the name of the tenant to look up

Response body on success:
 {'status':'OK','result':TENANTIDS}
   where TENANTIDS is a list of tenant ids,  possibly empty.

Response body on error:
 {'status':'ERROR','message':MESSAGE}
   where MESSAGE explains the error
   and other fields may contain additional information

Sample command to test this URL:
  curl -H "X-AUTH-HEADER: $s" --data-binary '{"tenantName":"tenant0"}' -H 'Content-Type: application/json' http://localhost:8080/getTenantIdByName
'''
    if request.method == 'OPTIONS':
        return{}
    (status, message) = checkLogin(response)
    if not status:
        return message

    (userId, userName, role) = message
    print "***** ROLE =", role ### TESTING
    if role != TenantUtil._ROLE_SITE_ADMIN:
        reply = {'status':'ERROR','message':'you must be a site administrator to use this service'}
        return simplejson.dumps(reply);

    # TODO: maybe refactor callDbFunc.  It calls getRequestParams(), which
    # calls checkLogin(), which in this case has already been called.
    return callDbFunc(TenantUtil.listTenantsByName, (('tenantName',str),),
                      'tenantIds')


@route('/alert/add', method=['OPTIONS', 'POST'])
def addAlert():
    '''
Add an alert.  TODO: describe this in more detail.
'''
    if request.method == 'OPTIONS':
        return {}
    jsonreq = request.json
    try:
        req = requests.post(ALERT_SERVER_HOST + '/alert/add', \
                            data = simplejson.dumps(jsonreq), \
                            headers={'Content-type':'application/json'})
        text = req.text
    except requests.exceptions.RequestException, ex:
        if getLogger():
            getLogger().error('AlertServer: ' + str(ex))
        text = '"ERROR"' ### TODO: find out how to pass an error to the client
    print text
    resp = simplejson.loads(text)
    return resp
    

@route('/alert/list', method=['OPTIONS', 'POST'])
def listAlertConditions():
    '''
List alert conditions.  TODO: describe this in more detail.
'''
    if request.method == 'OPTIONS':
        return {}
    try:
        req = requests.post(ALERT_SERVER_HOST + '/alert/list', \
                            headers={'Content-type':'application/json'})
        text = req.text
    except requests.exceptions.RequestException, ex:
        if getLogger():
            getLogger().error('AlertServer: ' + str(ex))
        text = '"ERROR"' ### TODO: find out how to pass an error to the client
    print text
    resp = simplejson.loads(text)
    return resp

@route('/alert/delete', method=['OPTIONS', 'POST'])
def deleteAlertCondition():
    '''
Delete alert conditions.  TODO: describe this in more detail.
'''
    if request.method == 'OPTIONS':
        return {}
    jsonreq = request.json
    try:
        req = requests.post(ALERT_SERVER_HOST + '/alert/delete', \
                            data = simplejson.dumps(jsonreq), \
                            headers={'Content-type':'application/json'})
    except requests.exceptions.RequestException, ex:
        if getLogger():
            getLogger().error('AlertServer: ' + str(ex))
        text = '"ERROR"' ### TODO: find out how to pass an error to the client
    print text
    resp = simplejson.loads(text)
    return resp
    

@route('/getTenantHierarchy',method=['OPTIONS','POST'])
def getTenantHierarchy():
    '''
Look up the hierarchy of tenants, groups, applications, and
collections for the logged-in user.  Normally there should
be exactly one tenant, but this handles the case where the database
gets out of sync and there are multiple tenants or no tenants
for a user.

The request data is currently normally empty.  If the user is the
site administrator, the request data can be a JSON object of the form:
 {'tenantId':TENANTID}
 where:
 TENANTID is the tenant id to use instead of the logged-in user's tenant.
 Only the site administrator can specify the tenantId parameter.

Response body on success:
 {'status':'OK','result':TENANTS}
   where TENANTS is a dictionary where each entry's key is
   a tenant id and the value is a dictionary of the form:
   {'name':NAME,'groups':GROUPS}
   where GROUPS is a dictionary where each entry's key is
   a group id and the value is a dictionary of the form:
   {'name':NAME,'applications':APPLICATIONS}
   where APPLICATIONS is a dictionary where each entry's key is
   an application id and the value is a dictionary of the form:
   {'name':NAME,'collections':COLLECTIONS}
   where COLLECTIONS is a dictionary where each entry's key is
   a collection id and the value is a dictionary of the form:
   {'name':NAME}

For example:
 {'status':'OK','result':{'t1':{'name':'tenant 1','groups':{'t1g1':{'name':'tenant 1 group 1','applications':{'t1g1a1':{'name':'tenant 1 group 1 application 1','collections':{'t1g1a1c1':{'name':'tenant 1 group 1 application 1 collection 1'},'t1g1a1c2':{'name':'tenant 1 group 1 application 1 collection 2'}}},'t1g1a2':{'name':'tenant 1 group 1 application 2','collections':{'t1g1a2c1':{'name':'tenant 1 group 1 application 2 collection 1'},'t1g1a2c2':{'name':'tenant 1 group 1 application 2 collection 2'}}}}}}}}}

Response body on error:
 {'status':'ERROR','message':MESSAGE}
   where MESSAGE explains the error
   and other fields may contain additional information

'''
    if request.method == 'OPTIONS':
        return{}
    (status, obj, values, user) = getRequestParams(request, response, ())
    if not status:
        return values # error message

    (tenantId,) = extractOptionalParams(obj, ['tenantId'])

    (userId, userName, role) = user

    # The site administrator can specify what tenant id to look up.
    if tenantId:
        if role != TenantUtil._ROLE_SITE_ADMIN:
            reply = {'status':'ERROR',
                     'message':'you must be a site administrator to specify the tenantId parameter'}
            return simplejson.dumps(reply);
        tenantIds = [tenantId]
    else:
        # If the tenant id is not specified, use the current user's tenants.
        # Normally there should be exactly one, but handle other cases.
        tenantIds = TenantUtil.listTenantsByUserId(userId,
                                                   logger=getLogger())
    tenantDict = {}
    for tenantId in tenantIds:
        fields = TenantUtil.getTenantFields(tenantId,
                                            logger=getLogger())
        if not fields: # shouldn't happen
            continue
        (tenantName, tenantEmail) = fields
        groups = TenantUtil.listGroups(tenantId, logger=getLogger())
        groupDict = {}
        for group in groups:
            (groupId, groupName) = group
            applications = TenantUtil.listApplications(groupId,
                                                       logger=getLogger())
            appDict = {}
            for application in applications:
                (applicationId, applicationName) = application
                collections = TenantUtil.listCollections(applicationId,
                                                         logger=getLogger())
                collDict = {}
                for collection in collections:
                    (collectionId, collectionName) = collection
                    collDict[collectionId] = {'name':collectionName}
                appDict[applicationId] = {'name':applicationName, 'collections':collDict}
            groupDict[groupId] = {'name':groupName, 'applications':appDict}
        tenantDict[tenantId] = {'name':tenantName, 'groups':groupDict}
    return {'status':'OK', 'result':tenantDict}



######################################################################
# This is for testing multi-threading.  Unlike most functions in this
# file, this one is designed to be used interactively (e.g. with curl),
# so it uses an HTTP GET with the input passed as query parameters
# (instead of a POST with the input passed as a JSON request body), and
# returns a plain text response.  It does not require a login.
######################################################################

@route('/sleep',method=['GET'])
def sleep():
    '''Sleep for a few seconds.  Used only for testing.
    Sample command:
    curl "http://localhost:8080/sleep?delay=10"
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
        
######################################################################
# Online help.  Unlike most functions in this file, this one is
# designed to be used interactively (e.g. with curl), so it uses an
# HTTP GET with the input passed as query parameters (instead of a POST
# with the input passed as a JSON request body), and returns a plain text
# response.  It does not require a login.
######################################################################
@route('/help',method=['GET'])
def showHelp():
    '''
Online help.

Returns a list of URL paths or help information for a URL path.
Use /help?listPaths=1 for a list of URL paths.
Use /help?path=<PATH> for help on a specific URL path.
In URls that require a login, $s refers to the session id returned by /login.

Sample command to get a list of URL paths:
  curl "http://localhost:8080/help?listPaths=1"

Sample command to get help on a URL:
  curl "http://localhost:8080/help?path=/tenant/new"
'''
    response.content_type = 'text/plain'
    if request.query.get('listPaths'):
        paths = helpFuncs.keys()
        paths.sort()
        return 'URL paths:\n' + '\n'.join(paths) + '\n'
    path = request.query.get('path')
    if path:
        func = helpFuncs.get(path)
        if not func:
            return 'unknown URL path\n'
        docString = func.__doc__
        if not docString:    
            return 'No help available for %s\n' % path
        return func.__doc__
    return 'Use /help?listPaths=1 for a list of URL paths\n\
Use /help?path=<PATH> for help on a specific URL path\n'

# List of URL paths and functions for online help.
# TODO: find out how to get the URL paths ("routes" in bottle terminology)
# and their functions from bottle.
helpFuncs = {
    '/tenant/new':newTenant,
    '/tenant/newWithUser':newTenantWithUser,
    '/tenant/deleteByName':deleteTenant,
    '/tenant/deleteById':deleteTenantById,
    '/tenant/list':listTenants,
    '/user/new':newUser,
    '/user/deleteById':deleteUserById,
    '/user/list':listUsers,
    '/user/listByTenant':listUsersByTenant,
    '/group/new':newGroup,
    '/group/deleteById':deleteGroupById,
    '/group/list':listGroups,
    '/application/new':newApplication,
    '/application/deleteById':deleteApplicationById,
    '/application/list':listApplications,
    '/collection/new':newCollection,
    '/collection/deleteById':deleteCollectionById,
    '/collection/list':listCollections,
    '/searchIndex/new':newSearchIndex,
    '/searchIndex/deleteById':deleteSearchIndexById,
    '/searchIndex/list':listSearchIndices,
    '/dashboard/new':addDashboard,
    '/dashboard/deleteById':deleteDashboardById,
    '/plugin/new':addPlugin,
    '/plugin/setEnabled':enableOrDisablePlugin,
    '/plugin/deleteById':deletePluginById,
    '/plugin/list':listPlugins,
    '/aggregationCriteria/set':setAggregationCriteria,
    '/aggregationCriteria/list':listAggregationCriteria,
    '/login':login,
    '/logout':logout,
    '/search':searchNew,
    '/getAggregateStats':getAggregateStatsNew,
    '/mappings/list':listMappings,
    '/fields/list':listFields,
    '/getApplicationFields':getApplicationFields,
    '/getTenantId':getTenantId,
    '/getTenantIdByName':getTenantIdByName,
    '/getTenantHierarchy':getTenantHierarchy,
    '/alert/add':addAlert,
    '/alert/list':listAlertConditions,
    '/alert/delete':deleteAlertCondition,
    '/log/setLevel':setLogLevel,
    '/sleep':sleep,
    '/help':showHelp
}

######################################################################
# Top-level routine.
######################################################################
def main():
    # Initialize common routines and connect to ElasticSearch.
    if initializeCommon() and initializeES():
        if getLogger():
            getLogger().info('Starting')
        server = importBottleWebServer(getLogger())
        port = ConfigDb.getIntValue('TenantServer', 'port', 8084)
        run(host='0.0.0.0', port=port, debug=True, server=server)

######################################################################
#
# Main-line code starts here.
#
######################################################################
if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
    sys.exit(1)
