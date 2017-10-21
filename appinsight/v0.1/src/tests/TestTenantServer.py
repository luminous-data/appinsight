#!/usr/bin/env python

# Functional tests for TenantServer.

import sys, glob, os, traceback, errno

# Make sure we can find the required modules.
# Look in either ../../vendor or the standard Python library location.
for pattern in ('../../vendor/*-requests-*/requests',):
    pkgDirs = glob.glob(pattern)
    if pkgDirs:
        sys.path.insert(0, os.path.dirname(pkgDirs[0]))
try:
    sys.path.insert(0, '../server') # for TenantUtil
    import json
    import requests
    import random
    from TenantUtil import _ROLE_USER, _ROLE_TENANT_ADMIN, _ROLE_SITE_ADMIN

except ImportError, ex:
    print 'import error:', ex
    sys.exit(1)

def getRandomNumber():
    return random.randrange(10000000,100000000)

def checkHttpStatus(resp, operation):
    '''If code is not 200, prints operation and returns False.  Otherwise returns True.
    resp: requests response object
    operation: text description of the operation'''
    if resp.status_code != 200:
        print '*** Error: %s: response code is %d' % (operation, resp.status_code)
        print '*** HTTP response body:', resp.content
        return False
    return True

def getJsonResponse(resp, operation):
    '''Returns a JSON object from the response body, or None if the HTTP response code is not 200 or the response body is not JSON.
    resp: requests response object
    operation: text description of the operation'''
    if not checkHttpStatus(resp, operation):
        return None
    try:
        jsonData = resp.json()
    except ValueError:
        print '*** Error: %s: response body is not JSON' % operation
        return None
    return jsonData

def getValue(obj, name, operation):
    '''Returns a value from a dictionary representing a JSON object returned by the tenant server.  If it does not exist, prints a message and returns None.
    obj: the dictionary object
    name: the key to look up in obj
    operation: text description of the operation to the server'''
    value = obj.get(name)
    if value is None:
        print '*** Error: %s: missing "%s" in response: "%s"' % (operation, name, obj)
        return None
    return value

def getValues(obj, names, operation):
    '''Returns a list of values from a dictionary representing a JSON object returned by the tenant server.  If any value does not exist, prints a message and returns None for that element of the list.
    obj: the dictionary object
    names: a sequence of keys to look up in obj
    operation: text description of the operation to the server'''
    values = []
    for name in names:
        value = obj.get(name)
        if not value:
            print '*** Error: %s: missing "%s" in response: "%s"' % (operation, name)
        values.append(value)
    return values

def checkJsonResponse(resp, operation, expectedError):
    '''If expectedError is None (meaning the operation is expected to succeed), returns the response body of a tenant server request as a dictionary if the status is "OK", otherwise prints a message and returns None.
    If expectedError is not None (meaning the operation is expected to fail), returns True if the status is "ERROR" (meaning the operation failed as expected), otherwise prints a message including expectedError and returns None, but does not check that expectedError is the actual error returned from TenantServer.
    resp: requests response object
    operation: text description of the operation
    expectedError: see description above'''
    data = getJsonResponse(resp, operation)
    if not data:
        return None
    status = getValue(data, 'status', operation)
    if not status:
        return None
    if expectedError:
        if status == 'ERROR':
            return True
        print '*** Error: %s: expected to fail because: %s: actual result: %s' % \
              (operation, expectedError, data)
        return None
    else:
        if status == 'OK':
            return data
        print '*** Error: %s: "status" in not OK: "%s"' % (operation, data)
        return None

class TestServer:
    def __init__(self):
        self.reqContentType = 'application/json'
        self.serverHost = 'localhost'
        self.serverPort = 8080
        #self.serverPort = 8010
        self.serverUrlBase = 'http://%s:%d' % (self.serverHost, self.serverPort)
        self.adminUsername = 'SiteAdmin'
        self.adminPassword = 'SiteAdmin'
        # self.dbObjPrefix is used as the first part of database object names (e.g. users,
        # tenants) to distinguish them.
        self.dbObjPrefix = 'test_' 

    def genReqHeaders(self, loginSessionId):
        '''Generates headers for an HTTP request to the tenant server.
        loginSessionId: login session id, or None for a login'''
        # Always want the request content type.
        reqHeaders = {'content-type' : self.reqContentType}
        if loginSessionId:
            reqHeaders['X-Auth-Header'] = loginSessionId
        return reqHeaders

    def login(self, username, password):
        '''Logs in to the tenant server using the specified name and password.
        return: login sesion id, or None on failure'''
        url = self.serverUrlBase + '/login'
        reqParams = {"username":username,"password":password}
        resp = requests.post(url, data=json.dumps(reqParams), headers=self.genReqHeaders(None))
        if not checkHttpStatus(resp, 'login(username=%s, password=%s)' % (username, password)):
            return None
        # On success, the server puts the login session id in the response header.
        return resp.headers.get('X-Auth-Header')

    def loginAsSiteAdmin(self):
        '''Logs in to the tenant server as the site administrator and saves the
        login session id in self.adminLoginSessionId.'''
        self.adminLoginSessionId = self.login(self.adminUsername, self.adminPassword)
        if not self.adminLoginSessionId:
            print '*** Error: admin login: missing login session id in response'
            return False
        return True

    def deleteTenantById(self, tenantId):
        '''Deletes a tenant.
        tenantId: the id of the tenant to delete'''
        url = self.serverUrlBase + '/tenant/deleteById'
        reqParams = {'id' : tenantId,}
        operation = 'delete tenant id %s' % tenantId
        resp = requests.post(url, data=json.dumps(reqParams),
                             headers=self.genReqHeaders(self.adminLoginSessionId))
        checkJsonResponse(resp, operation, None)

    def newTenantWithUser(self, tenantName, password, email):
        '''Creates a new tenant and user.
        tenantName: the name of the tenant to create
        password: the password for the new tenant
        email: the email address for the new tenant
        return: a [tenantId, userName, userId] sequence'''
        url = self.serverUrlBase + '/tenant/newWithUser'
        reqParams = {'tenantName' : tenantName, 'password' : password, 'email' : email}
        resp = requests.post(url, data=json.dumps(reqParams),
                             headers=self.genReqHeaders(self.adminLoginSessionId))
        operation = 'new tenant with user'
        data = checkJsonResponse(resp, operation, None)
        if not data:
            return None
        return getValues(data, ('tenantId', 'userName', 'userId'), operation)

    def listTenants(self):
        '''Gets the tenants from the server.
        return: a list of id/name/email tuples on success, or None on failure.'''
        url = self.serverUrlBase + '/tenant/list'
        resp = requests.post(url, data=json.dumps({}),
                             headers=self.genReqHeaders(self.adminLoginSessionId))
        data = checkJsonResponse(resp, "list tenants", None)
        if not data:
            return None
        return getValue(data, 'tenants', 'list tenants')

    def listGroups(self, loginSessionId, tenantId):
        '''Gets the groups for the specified tenant from the server.
        return: a list of group id/name pairs on success, or None on failure.'''
        url = self.serverUrlBase + '/group/list'
        reqParams = {'tenantId' : tenantId}
        resp = requests.post(url, data=json.dumps(reqParams),
                             headers=self.genReqHeaders(loginSessionId))
        operation = 'list groups'
        data = checkJsonResponse(resp, operation, None)
        if not data:
            return None
        return getValue(data, 'groups', operation)

    def sendNewGroupRequest(self, loginSessionId, tenantId, groupName):
        '''Sends TenantServer a request to create a group.
        return: requests module response object'''
        url = self.serverUrlBase + '/group/new'
        reqParams = {'tenantId' : tenantId, 'name' : groupName}
        return requests.post(url, data=json.dumps(reqParams),
                             headers=self.genReqHeaders(loginSessionId))

    def newGroupExpectOk(self, loginSessionId, tenantId, groupName):
        '''Creates a new group.
        return: group id, or None on error'''
        resp = self.sendNewGroupRequest(loginSessionId, tenantId, groupName)
        operation = 'create group'
        data = checkJsonResponse(resp, operation, None)
        if not data:
            return None
        return getValue(data, 'groupId', operation)

    def newGroupExpectError(self, loginSessionId, tenantId, groupName, expectedError):
        '''Tries to create a new group, but operation is expected to fail.
        expectedError: description of why the operation is expected to fail 
        return: true if the operation failed as expected'''
        resp = self.sendNewGroupRequest(loginSessionId, tenantId, groupName)
        operation = 'create group'
        return checkJsonResponse(resp, operation, expectedError)

    def deleteGroupById(self, loginSessionId, groupId):
        '''Deletes a group.
        groupId: group id
        return: True on success'''
        url = self.serverUrlBase + '/group/deleteById'
        reqParams = {'id' : groupId}
        resp = requests.post(url, data=json.dumps(reqParams),
                             headers=self.genReqHeaders(loginSessionId))
        operation = 'delete group'
        data = checkJsonResponse(resp, operation, None)
        if not data:
            return None
        return True

    def createGroup(self, loginSessionId, tenantId):
        '''Creates a new group, using a name based on a random number.
        return: (groupName, groupId)'''
        groupName = '%sgroup%d' % (self.dbObjPrefix, getRandomNumber())
        print 'Creating group', groupName
        groupId = self.newGroupExpectOk(loginSessionId, tenantId, groupName)
        return (groupName, groupId)

    def createGroupAndVerify(self, loginSessionId, tenantId):
        '''Creates a group and verifies that it exists.
        loginSessionId: used to log in
        tenantId: tenant id
        '''
        # Create a new group.
        (groupName, groupId) = self.createGroup(loginSessionId, tenantId)

        # Check that the new group exists.
        if [groupId, groupName] in self.listGroups(self.adminLoginSessionId, tenantId):
            print 'Verified that group', groupName, 'id', groupId, 'exists'
            return (groupName, groupId)
        print '*** Error: group name', groupName, 'id', groupId, 'not found in groups'
        return (None, None)

    def deleteGroupAndVerify(self, loginSessionId, tenantId, groupName, groupId):
        '''Deletes a group and verifies that it no longer exists.
        loginSessionId: used to log in
        tenantId: tenant id, used to list the groups
        groupName: group name
        groupId: group id
        '''
        print 'Deleting group', groupName, 'id', groupId

        # Delete the group.
        if not self.deleteGroupById(loginSessionId, groupId):
            print '*** Error: failed to delete group', groupName, 'id', groupId

        # Make sure the group was really deleted.
        if [groupId, groupName] in self.listGroups(self.adminLoginSessionId, tenantId):
            print '*** Error: group name', groupName, 'id', groupId, 'still exists after being deleted'
        else:
            print 'Verified that group name', groupName, 'id', groupId, 'does not exist'

    def testNewTenantWithUser(self):
        '''Calls self.newTenantWithUser() to create a new tenant and user and verifies that they are created. '''
        tenantName = '%stenant%d' % (self.dbObjPrefix, getRandomNumber())
        password = '%d' % getRandomNumber()
        email = '%s_user@localhost' % tenantName
        print 'Creating tenant', tenantName, 'and user'
        data = self.newTenantWithUser(tenantName, password, email)
        if not data:
            return False
        (tenantId, userName, userId) = data
        print 'Created tenant', tenantName, 'and user', userName

        # Check that the new tenant exists.
        if [tenantId, tenantName, email] in self.listTenants():
            print 'Verified that tenant name', tenantName, 'id', tenantId, 'email', email, \
                  'exists'
        else:
            print '*** Error: tenant name', tenantName, 'id', tenantId, 'email', email, \
                  'not found in tenants'
        
        # Check that the new user exists.
        role = _ROLE_TENANT_ADMIN
        if [userId, userName, email, tenantId, role] in self.listUsers():
            print 'Verified that user name', userName, 'id', userId, 'email', email, \
                  'role', role, 'exists'
        else:
            print '*** Error: user name', userName, 'id', userId, 'email', email, \
                  'role', role, 'not found in users'

        # Log in as the new user.
        userLoginSessionId = self.login(userName, password)
        if not userLoginSessionId:
            print '*** Error: logging in with username', userName, 'password', password, \
                  'failed'
            return False

        # While logged in as the new user, create a group.
        (groupName, groupId) = self.createGroupAndVerify(userLoginSessionId, tenantId)

        # Try creating another group with the same name in the same tenant and make sure
        # it fails.
        print 'Creating duplicate group', groupName
        if not self.newGroupExpectError(userLoginSessionId, tenantId, groupName,
                                        'duplicate group name'):
            print '***  Groups in tenant %s %s:' % (tenantId, tenantName)
            for (id, name) in self.listGroups(userLoginSessionId, tenantId):
                print '***   ', id, name

        if groupName and groupId:
            self.deleteGroupAndVerify(userLoginSessionId, tenantId, groupName, groupId)

        # TODO: try creating a group with the same name but in a different tenant, and
        # make sure it succeeds and the two groups are distinct.

    def listUsers(self):
        '''Gets the users from the server.
        return: a list of id/name/email/tenantId/role tuples on success, or None on failure.'''
        url = self.serverUrlBase + '/user/list'
        resp = requests.post(url, data=json.dumps({}),
                             headers=self.genReqHeaders(self.adminLoginSessionId))
        operation = 'list users'
        data = checkJsonResponse(resp, operation, None)
        if not data:
            return None
        return getValue(data, 'users', operation)

    def deleteUserById(self, userId):
        '''Deletess a user.
        userId: the id of the user to delete'''
        url = self.serverUrlBase + '/user/deleteById'
        reqParams = {'id' : tenantId,}
        operation = 'delete user id %s' % tenantId
        resp = requests.post(url, data=json.dumps(reqParams),
                             headers=self.genReqHeaders(self.adminLoginSessionId))
        checkJsonResponse(resp, operation, None)

    def cleanupTestObjects(self):
        '''Deletes users, tenants, etc. that were created by this program '''
        print 'Cleaning up test objects'
        tenants = self.listTenants()
        for tenant in tenants:
            (tenantId, tenantName, email) = tenant
            if tenantName[:len(self.dbObjPrefix)] == self.dbObjPrefix:
                print 'Deleting tenant', tenantName, 'id', tenantId
                self.deleteTenantById(tenantId)

        # TODO: the following code can probably be removed.
        # It should not be necessary to delete other objects associated with a tenant,
        # because cascading deletes should delete them when the tenant is deleted.
        users = self.listUsers()
        for user in users:
            (userId, userName, email, tenantId, role) = user
            if userName[:len(self.dbObjPrefix)] == self.dbObjPrefix:
                print 'Deleting user', userName, 'id', userId
                #self.deleteUserById(tenantId)
    
    def main(self):
        if not self.loginAsSiteAdmin():
            return False # can't do anything without logging in
        self.cleanupTestObjects() # delete any objects left over from previous runs
        self.testNewTenantWithUser()
        self.cleanupTestObjects() # delete any objects created in this run

def main():
    testServer = TestServer()
    testServer.main()

if __name__ == '__main__':
    main()
    
