import requests
import json
from config import *
import httplib, mimetypes

headersToSend = HEADERS
tenantId = ''
groups = []
apps = []
collections = []

def login():
    global tenantId
    r = requests.post(HOST + '/login', data=json.dumps(DEFAULT_TENANT), headers=headersToSend)
    print 'The response status of login is ' + str(r)
    print r.text
    loginResponse = json.loads(r.text)

    print 'The username is ' + loginResponse['username']
    print 'The role is ' + str(loginResponse['role'])
    print 'The userId is ' + loginResponse['userId']
    print 'The tenantId is ' + loginResponse['tenantIds'][0]
    tenantId = loginResponse['tenantIds'][0]
    headers = r.headers

    sessionId = headers['X-Auth-Header']
    #add session id to the headers to send in subsequent calls
    headersToSend['X-Auth-Header'] = sessionId


'''
Sample command to test this URL, assuming a user with id $s exists:
curl -H "X-AUTH-HEADER: $s" -H 'Content-Type: multipart/form-data' --form-string 'json={"name":"myplugin","docType":"apacheAccess","collectionIds":["111","222","333"]}' -F plugin=@/my/plugin.py "http://localhost:8080/plugin/new"
where /my/plugin.py is the plugin file
'''



def addPlugin():
    '''
    payload = '{ "name" : "testapp1_java", \
                       "docType" : "testapp1-java", \
                       "collectionIds" : ["8961ff9f-452e-4511-a022-c15878321499"] }'
    '''
    #payload = '{ "name" : "testapp1_java", "docType" : "testapp1-java" , "collectionIds" : ["8961ff9f-452e-4511-a022-c15878321499"] }'
    #payload = "json="+payload
    payload = '{ "name" : "collectdPlugin", "docType" : "collectd" , "collectionIds" : ["8961ff9f-452e-4511-a022-c15878321499"] }'
    #plugInToSend = (( "plugin" , open('testapp1_java_plugin.py', 'rb')), ("json", payload))
    plugInToSend = (( "plugin" , open('collectdPlugin.py', 'rb')), ("json", payload))
    headersToSend['Content-type'] = 'multipart/form-data'
    del headersToSend['Content-type']
    resp = requests.post(HOST + '/plugin/new', headers=headersToSend, files=plugInToSend)


    print '\n\n\n'
    print 'The response code of addPlugin is ' + str(resp.text)
    print 'The response headers are ' + str(resp.headers)
    jsonResp = json.loads(resp.text)
    return jsonResp

def getPlugins():
    resp = requests.post(HOST + '/plugin/list', headers=headersToSend)
    print '\n\n\n'
    print 'The response code of getApplicationFields is ' + str(resp.text)
    print 'The response headers are ' + str(resp.headers)
    jsonResp = json.loads(resp.text)
    plugins = jsonResp['plugins']
    #print 'The plugin id is ' + pluginId
    return plugins


def deletePlugin(pluginId):
    print 'Deleting plugin ' + pluginId
    payload = {"id":pluginId}
    resp = requests.post(HOST + '/plugin/deleteById', data=json.dumps(payload), headers=headersToSend)
    print '\n\n\n'
    print 'The response code of getApplicationFields is ' + str(resp.text)
    print 'The response headers are ' + str(resp.headers)


def main():
    login()
    addPlugin()
    '''

    plugins =  getPlugins()
    print 'The plugins are ' + str(plugins)

    for i in plugins:
        deletePlugin(i['id'])
    '''
    '''
    '''
    #deletePlugin('be1189c2-e2c9-4b39-8c5f-29c91a6a0d29')

if __name__=='__main__':
    main()