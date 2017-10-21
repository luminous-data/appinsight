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

from bottle import request, response, route, get, post, abort, run, static_file, hook
import datetime, threading, time
import alerts, alertsSearchTerms
import LogUtil
#from alertConditions import *
from alertConstants import *
import pickle
import requests
import json
next_call = time.time()

now = datetime.datetime.utcnow()
currTime = datetime.datetime.utcnow().replace(microsecond=0)

NUMERIC_CONDITIONS = ''
TERM_CONDITIONS = ''

headersToSend = HEADERS

def getNextEndTime(currTime):
    return currTime + datetime.timedelta(seconds=15)


def foo(modules):
    global next_call
    print datetime.datetime.now()
    next_call = next_call+15
    print 'Before threading.Timer call'
    threading.Timer( next_call - time.time(), foo, [modules] ).start()
    for module in modules:
        threading.Thread(target=module.main).start()



def handleNumericConditions(numericAlertsConditions, headersToSend):
    if logger:
        logger.info('handleNumericConditions Called')
    global next_call
    print datetime.datetime.now()
    next_call = next_call+15
    threading.Timer( next_call - time.time(), handleNumericConditions, [numericAlertsConditions, headersToSend] ).start()
    for numericAlertsCondition in numericAlertsConditions:
        threading.Thread(target=alerts.main, args=[numericAlertsCondition, headersToSend]).start()
        

def handleTermConditions(termAlertsConditions, headersToSend):
    global next_call
    print datetime.datetime.now()
    next_call = next_call+15
    threading.Timer( next_call - time.time(), handleTermConditions, [termAlertsConditions, headersToSend] ).start()
    for termAlertsCondition in termAlertsConditions:
        threading.Thread(target=alertsSearchTerms.main, args=[termAlertsCondition, headersToSend]).start()

@route('/',method=['OPTIONS','GET'])
def printHello():
    return {'result' : 'ok'}

@route('/alert/add',method=['OPTIONS','POST'])
def addAlertCondition():
    if logger:
        logger.info('Adding Alert Condition' + str(request.json))
        
    global NUMERIC_CONDITIONS, TERM_CONDITIONS
    jsonreq = request.json
    alertType = jsonreq['alertType']
    if alertType == 'NUMERIC':
        alertCondition = {}
        alertCondition['alertName'] = jsonreq['name']
        alertCondition['description'] = jsonreq['desc']
        alertCondition['searchCollection'] =   jsonreq['collection']
        alertCondition['docType'] = jsonreq['docType']
        alertCondition['tsField'] =   jsonreq['tsField']
        alertCondition['field'] =     jsonreq['field']
        alertCondition['statistic'] = jsonreq['statistic']
        alertCondition['threshold'] = jsonreq['threshold']
        alertCondition['condition'] = jsonreq['condition']
        alertCondition['id'] = str(uuid.uuid4())
        NUMERIC_CONDITIONS['id'] = alertCondition
        pickle.dump({'numeric' : NUMERIC_CONDITIONS, \
                     'term' : TERM_CONDITIONS}, open('alerts.p', 'wb'))
        return {'status':'OK', 'result':{'numeric' : NUMERIC_CONDITIONS , 'term' : TERM_CONDITIONS }}
    elif alertType == 'TERM':
        alertCondition = {}
        alertName = jsonreq['name']
        alertDesc = jsonreq['desc']
        collection =   jsonreq['collection']
        docType = jsonreq['docType']
        tsField =   jsonreq['tsField']
        field =     jsonreq['field']
        searchTerm = jsonreq['searchTerm']
        statistic = jsonreq['statistic']
        threshold = jsonreq['threshold']
        condition = jsonreq['condition']
        alertCondition['id'] = str(uuid.uuid4())
        TERM_CONDITIONS['id'] = alertCondition
        pickle.dump({'numeric' : NUMERIC_CONDITIONS, \
                     'term' : TERM_CONDITIONS}, open('alerts.p', 'wb'))
        return {'status':'OK', 'result':{'numeric' : NUMERIC_CONDITIONS , 'term' : TERM_CONDITIONS }}
    else:
        pass
    

@route('/alert/list',method=['OPTIONS', 'GET', 'POST'])
def listAlertConditions():
    global NUMERIC_CONDITIONS, TERM_CONDITIONS
    return {'numeric' : NUMERIC_CONDITIONS , 'term' : TERM_CONDITIONS } 

@route('/alert/delete',method=['OPTIONS','POST'])
def deleteAlertCondition():
    jsonreq = request.json
    idToDelete = jsonreq['id']
    if TERM_CONDITIONS.has_key(idToDelete):
        del TERM_CONDITIONS[idToDelete]
    if NUMERIC_CONDITIONS.has_key(idToDelete):
        del NUMERIC_CONDITIONS[idToDelete]
    pickle.dump({'numeric' : NUMERIC_CONDITIONS, \
                 'term' : TERM_CONDITIONS}, open('alerts.p', 'wb'))
    print NUMERIC_CONDITIONS
    return {'status':'OK', 'result':{'numeric' : NUMERIC_CONDITIONS , 'term' : TERM_CONDITIONS }}

def getAlertConditions():
    global NUMERIC_CONDITIONS, TERM_CONDITIONS
    allAlertConditions = pickle.load(open('alerts.p', 'rb'))
    NUMERIC_CONDITIONS = allAlertConditions['numeric']
    print NUMERIC_CONDITIONS
    TERM_CONDITIONS = allAlertConditions['term']
    print TERM_CONDITIONS
    
    


def  main():
    
    global NUMERIC_CONDITIONS, TERM_CONDITIONS, headersToSend
    
    DEFAULT_TENANT = {'username':'appinsight', 'password':'appinsight'}
    r = requests.post(TENANT_SERVER_HOST + '/login', data=json.dumps(DEFAULT_TENANT), headers=headersToSend)
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
    print 'The session id is ' + sessionId
    
    getAlertConditions()
    
    handleNumericConditions(NUMERIC_CONDITIONS.values(), headers)
    handleTermConditions(TERM_CONDITIONS.values(), headers)
    
    run(host='0.0.0.0', port=9503, debug=True, reloader=True)
    print 'end of main'
    

if __name__=='__main__':
    global logger
    logger = LogUtil.getLogger('AlertDriver')
    logger.info('Starting')
    moduleNames = ['alerts', 'alertsTerms', 'alertsRelative'] 
    modules = map(__import__, moduleNames)
    #foo(modules)
    main()

'''
if __name__=='__main__':
    run_event = threading.Event()
    run_event.set()
    foo(run_event)
    try:
        while 1:
            time.sleep(1)
    except KeyboardInterrupt:
        print "attempting to close threads. Max wait =",max(d1,d2)
        run_event.clear()
'''

            
            
