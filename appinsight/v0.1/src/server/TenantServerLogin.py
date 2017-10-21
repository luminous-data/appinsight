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

# This is imported by TenantServer.py.  It handles logins and logouts.

try:
    from bottle import request, response, route, get, post, abort, run, static_file, hook
    import simplejson
    import TenantUtil
    from TenantServerCommon import *
    import random
except ImportError, ex:
    print 'TenantServerLogin.py: import error:', ex
    sys.exit(1)

######################################################################
# Handle a login request.
######################################################################
@route('/login',method=['OPTIONS','POST'])
def login():
    '''
Handle a login request.

The request data is a JSON object of the form:
 {'username':USERNAME,'password':PASSWORD, 'rememberme':REMEMBERME}
 where:
 USERNAME is the user name
 PASSWORD is the plain-text password
 REMEMBERME is not currently used

Response body on success:
 {'status':'OK',
  "role": ROLE,
  "userId" : USERID,
  "username": USERNAME,
  "tenantIds: TENANTIDS}
where:
 ROLE is 1 for a site administrator; 2 for a tenant administrator;
   or 3 for a regular user (see the definitions in TenantUtil.py)
 USERID is the unique id for this user
 USERNAME is the same as the input parameter
 TENANTIDS is a list of tenant ids.  Normally there should be
  exactly one, but this handles the case where the database gets
  out of sync and there are no entries or multiple entries.

On success, a session id is set in both an X-AUTH-HEADER response header
and as a "sessionId" cookie.  The client should pass back SESSION in
an X-AUTH-HEADER request header.

Response body on error:
 {'status':'ERROR','message':MESSAGE}
   where MESSAGE explains the error
   and other fields may contain additional information

Sample command to test this URL, assuming a user FOO with password BAR:
  curl --data-binary '{"username":"FOO","password":"BAR"}' -i -H 'Content-Type: application/json' http://localhost:8080/login
'''
    # TODO: look for the 'rememberme' parameter and find out what to do
    # with it.
    if request.method == 'OPTIONS':
        return {}
    (status, obj, values) = getRequestParamsNoLogin(request, response,
                                                    ('username','password'))
    if not status:
        # response.status = 400
        return values
    
    # username, password, rememberme = values
    username, password = values
    kwargs = {'logger':getLogger()}
    (status, message) = TenantUtil.validateUserPassword(username, password, **kwargs)
    if not status:
        response.status = 400
        reply = {'status':'ERROR','message':message}
        return simplejson.dumps(reply)

    (userId, role) = message

    roleValue = 'public'
    if role == 1:
        roleValue = 'user'
    elif role == 2:
        roleValue = 'tenant'
    elif role == 4:
        roleValue = 'admin'

    # Get a random number for the session id
    sessionId = '%x' % random.getrandbits(200)
    # Map the session id to the user id, user name, and role.
    # TODO: store it in the database in case this server restarts.
    setLoginSession(sessionId, userId, username, role)

    # Send the sesion both in an X-AUTH-HEADER response header and
    # also as a cookie.
    response.set_header('X-AUTH-HEADER', sessionId)
    response.set_cookie('sessionId', sessionId)
    
    # Previously returned 'role': {'bitMask':4, 'title':'admin'}
    # to handle the UI mockup.  Now returns the role from the database.

    tenantIds = TenantUtil.listTenantsByUserId(userId)

    reply = {'status':'OK',
             'role': roleValue,
             'userId': userId,
             'username':username,
             'tenantIds':tenantIds}
    return simplejson.dumps(reply)

######################################################################
# Handle a logout request.
######################################################################
@route('/logout',method=['OPTIONS','POST'])
def logout():
    '''
Handle a logout request.
Deletes the login session id.
This request always succeeds, even if the user was not
logged in or the login expired.
Input parameters are ignored, but only POST is supported.
The request data is a JSON object of the form:
 {}
The response data is:
 {'status':'OK'}
'''
    if request.method == 'OPTIONS':
        return {}
    
    sessionId = request.headers.get('X-AUTH-HEADER')
    deleteLoginSession(sessionId)

    response.set_header('X-AUTH-HEADER', '')
    params = {'expires': 0}
    response.set_cookie('sessionId', '', **params)

    reply = {'status':'OK'}
    return simplejson.dumps(reply)
