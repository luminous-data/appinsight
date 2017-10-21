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

import requests
import json
import httplib, mimetypes
import sys
import datetime
HOST='http://45.79.102.84:9505'
#HOST='http://localhost:9502'
METADATA_HOST='http://localhost:9503'
WORKFLOW_RUNNER_HOST = 'http://localhost:9507'
SENSOR_HOST = 'http://localhost:9504'

HEADERS = {'Content-type':'application/json'}

def addSensor():
    payload = {'collectionIds' : ['10773be7-487c-4b1c-82a1-df5c108e3572'], \
               'sensorName' : 'marketingwebapp3', 'description':'marketingwebapp',\
               'containerId' : '', 'sensorClass' : 'marketingwebapp' , \
               'measurement' : 'responseTime', 'measurementType' : 'raw', 'unit' : 'second' }

    resp = requests.post(METADATA_HOST + '/addSensor', data=json.dumps(payload), headers=HEADERS)
    print 'The response of addSensor is ' + str(resp)
    print 'The response headers are ' + str(resp.headers)
    print 'The response body is ' + str(resp.text)

def getSensors():
    payload = {}
    resp = requests.post(METADATA_HOST + '/getSensors', data=json.dumps(payload), headers=HEADERS)
    print 'The response of getSensors is ' + str(resp)
    print 'The response headers are ' + str(resp.headers)
    print 'The response body is ' + str(resp.text)

def getSensorData():
    endDateTime = datetime.datetime.utcnow()
    endDateTime = endDateTime.replace(microsecond=0)
    startDateTime = endDateTime - datetime.timedelta(seconds=30)
    endDateTimeStr = endDateTime.isoformat() + 'Z'
    startDateTimeStr = startDateTime.isoformat() + 'Z'
    sensorId = 'a7888e75-458d-4c18-b29e-c0a40c852b48'
    payload = {'sensorId' : sensorId , 'startDateTime' : startDateTimeStr , 'endDateTime' : endDateTimeStr}
    resp = requests.post(SENSOR_HOST + '/getSensorData', data=json.dumps(payload), headers=HEADERS)
    print 'The response of getSensors is ' + str(resp)
    print 'The response headers are ' + str(resp.headers)
    print 'The response body is ' + str(resp.text)

def getAggregatedSensorData():
    endDateTime = datetime.datetime.utcnow()
    endDateTime = endDateTime.replace(microsecond=0)
    startDateTime = endDateTime - datetime.timedelta(seconds=45)
    endDateTimeStr = endDateTime.isoformat() + 'Z'
    startDateTimeStr = startDateTime.isoformat() + 'Z'
    sensorId = 'a7888e75-458d-4c18-b29e-c0a40c852b48'
    payload = {'sensorId' : sensorId , 'startDateTime' : startDateTimeStr , 'endDateTime' : endDateTimeStr}
    resp = requests.post(SENSOR_HOST + '/getAggregatedSensorData', data=json.dumps(payload), headers=HEADERS)
    print 'The response of getSensors is ' + str(resp)
    print 'The response headers are ' + str(resp.headers)
    print 'The response body is ' + str(resp.text)


def addWorkflow():
    payload = {'tenantId' : '25474fa7-7cfe-40bb-9a62-49b88789b3cb', 'name' : 'testworkflow2', 'enabled' : True}
    step1 = {'name' : 'delete file', 'actionType' : 'deleteFile', 'filePath' : 'abc/def' }
    step2 = { 'name' : 'transform the data', 'actionType' : 'transformJoin', \
              'saveOutput' : True, 'outputFolderPath' :'outputs', \
              'outputFolderName' : 'joinEmpDept7', 'tableName' : 'empDeptJoin2' }
    step2['transforms'] = { 'type' : 'JOIN' ,  \
                              'tables' : [\
                                  {'name' : 'emp' , 'filePath' : 'testworkflow/emp.csv' },
                                  {'name': 'dept', 'filePath' : 'testworkflow/dept.csv' },
                                  {'name' : 'emp_dept', 'filePath' : 'testworkflow/emp_dept.csv' } ], 
                              'joinConditions' : [ [ { 'tableName' : 'emp', 'columnName' : 'id'}, {'tableName': 'emp_dept', 'columnName' : 'emp_id' } ],
                                                  [ {'tableName' : 'emp_dept', 'columnName' : 'dept_id'}, {'tableName': 'dept', 'columnName': 'id' } ] ],
                                  'whereConditions' : 'emp.fname = "JAMES" AND emp.lname = "MYERS" ',
                                  'selectColumns' : [{'fieldNames':['emp.id'], 'newFieldName' : 'emp_id', 'function' : 'upper'},
                                                     {'fieldNames':['emp.fname', 'emp.lname'], 'newFieldName' : 'emp_fullName', 'function' : 'concat'},
                                                     {'fieldNames':['dept.name'], 'newFieldName' : 'dept_name'}] }
    payload['steps'] = [step1]
    #payload['steps'] = [step1, step2]
    '''
    payload = {'tenantId' : 'testTenantTest1', 'name' : 'testworkflow1'}
    step1 = { 'name' : 'transform the data', 'actionType' : 'transformJoin', \
              'saveOutput' : True, 'outputFolderPath' :'outputs', \
              'outputFolderName' : 'joinEmpDept6', 'tableName' : 'empDeptJoin2' }
    step1['transforms'] = { 'type' : 'JOIN' ,  \
                              'tables' : [\
                                  {'name' : 'emp' , 'filePath' : 'testworkflow/emp.csv' },
                                  {'name': 'dept', 'filePath' : 'testworkflow/dept.csv' },
                                  {'name' : 'emp_dept', 'filePath' : 'testworkflow/emp_dept.csv' } ], 
                              'joinConditions' : [ [ { 'tableName' : 'emp', 'columnName' : 'id'}, {'tableName': 'emp_dept', 'columnName' : 'emp_id' } ],
                                                  [ {'tableName' : 'emp_dept', 'columnName' : 'dept_id'}, {'tableName': 'dept', 'columnName': 'id' } ] ],
                                  'whereConditions' : 'emp.fname = "JAMES" AND emp.lname = "MYERS" ',
                                  'selectColumns' : [{'fieldNames':['emp.id'], 'newFieldName' : 'emp_id', 'function' : 'upper'},
                                                     {'fieldNames':['emp.fname', 'emp.lname'], 'newFieldName' : 'emp_fullName', 'function' : 'concat'},
                                                     {'fieldNames':['dept.name'], 'newFieldName' : 'dept_name'}] }
    payload['steps'] = [step1]
    '''
    resp = requests.post(METADATA_HOST + '/addWorkflow', data=json.dumps(payload), headers=HEADERS)
    print 'The response of addWorkload is ' + str(resp)
    print 'The response headers are ' + str(resp.headers)
    print 'The response body is ' + str(resp.text)

def addWorkflow2():
    tenantId = '25474fa7-7cfe-40bb-9a62-49b88789b3cb'
    payload = {'tenantId' : tenantId, 'name' : 'testworkflowmultistep1', 'enabled' : True}
    folderName = 'test2'
    sourceLocation = 'test1/scripts/mllibtestscript1.py'
    
    step1 = {'name' : 'add Folder', 'actionType' : 'createFolder', 'folderName' : folderName }
    step2 = {'name' : 'copy file', 'actionType' : 'copyFile', 'sourceLocation' : sourceLocation, 'destinationLocation': folderName + '/mllibtestscript1.py' }
    step3 = {'name' : 'executeScript', 'actionType' : 'executeScript', 'scriptParams' : {}, 'scriptPath' : folderName + '/mllibtestscript1.py'  }
    step4 = { 'name' : 'delete Folder', 'actionType' : 'deleteFolder', 'filePath' : folderName }
    payload['steps'] = [step1, step2, step3, step4 ]
    resp = requests.post(METADATA_HOST + '/addWorkflow', data=json.dumps(payload), headers=HEADERS)
    print 'The response of addWorkload is ' + str(resp)
    print 'The response headers are ' + str(resp.headers)
    print 'The response body is ' + str(resp.text)


def addSparkScriptWorkflow():
    payload = {'tenantId' : 'newtenant1', 'name' : 'sparkScript1', 'enabled' : True}
    step1 = {'name' : 'executeKmeansScript', 'actionType' : 'executeSparkScript', 'scriptParams' : {}, 'scriptPath' : 'test/scripts/kmeanstest.py'  }
    payload['steps'] = [step1]
    resp = requests.post(METADATA_HOST + '/addWorkflow', data=json.dumps(payload), headers=HEADERS)
    print 'The response of addWorkload is ' + str(resp)
    print 'The response headers are ' + str(resp.headers)
    print 'The response body is ' + str(resp.text)

def addSparkSqlScriptWorkflow():
    tenantId = '25474fa7-7cfe-40bb-9a62-49b88789b3cb'
    folderName = 'test7'
    sourceLocation = 'test1/scripts/testSparkScript1.py'
    payload = {'tenantId' : tenantId, 'name' : 'sparkScriptSqltest4', 'enabled' : True}
    step1 = {'name' : 'copy file', 'actionType' : 'copyFile', 'sourceLocation' : sourceLocation, 'destinationLocation': folderName + '/testSparkScript1.py' }
    step2 = {'name' : 'executeSelectScript', 'actionType' : 'executeSparkScript', 'scriptParams' : {}, 'scriptPath' : 'test7/testSparkScript1.py'  }
    payload['steps'] = [step1, step2]
    resp = requests.post(METADATA_HOST + '/addWorkflow', data=json.dumps(payload), headers=HEADERS)
    print 'The response of addWorkload is ' + str(resp)
    print 'The response headers are ' + str(resp.headers)
    print 'The response body is ' + str(resp.text)

def addSparkSqlWf():
    tenantId = '25474fa7-7cfe-40bb-9a62-49b88789b3cb'
    sourceLocation = 'myscripts4/scripts/testSparkScript3.py'
    payload = {'tenantId' : tenantId, 'name' : 'sparkScriptSqltest6', 'enabled' : True}
    step1 = {'name' : 'executeSelectScript', 'actionType' : 'executeSparkScript', 'scriptParams' : {}, 'scriptPath' : sourceLocation }
    payload['steps'] = [step1]
    resp = requests.post(METADATA_HOST + '/addWorkflow', data=json.dumps(payload), headers=HEADERS)
    print 'The response of addWorkload is ' + str(resp)
    print 'The response headers are ' + str(resp.headers)
    print 'The response body is ' + str(resp.text)

def executeSparkScriptNewWorkflowWithParams():
    outputFolder = 'outputs/jtest6'
    workflowId = '0058377f-2070-4f76-9191-cb88f42f5ecb'
    tenantId = '25474fa7-7cfe-40bb-9a62-49b88789b3cb'
    params = { 'tables' : ['emps','dept', 'emp_dept'],  'sql' : 'select emps.id as emp_id, dept.name as dept_name from emps, dept, emp_dept where emps.id = emp_dept.emp_id and emp_dept.dept_id = dept.id', 'outputFolder' : outputFolder, 'outputTableName' : 'join5', 'saveOutput' : 'True', 'returnResults' : 'True'  }
    stepParams = [params]
    payload = {'workflowId' : workflowId, 'params' : stepParams}
    resp = requests.post(WORKFLOW_RUNNER_HOST + '/executeWorkflow', data=json.dumps(payload), headers=HEADERS)
    print 'The response of addWorkload is ' + str(resp)
    print 'The response headers are ' + str(resp.headers)
    print 'The response body is ' + str(resp.text)


def addKmeansWorkflow():
    payload = {'tenantId' : 't8', 'name' : 'testworkflowmultistep1', 'enabled' : True}
    step1 = {'name' : 'executeKmeansScript', 'actionType' : 'executeScript', 'scriptParams' : {}, 'scriptPath' : 'test/scripts/kmeanstest.py'  }
    payload['steps'] = [step1]
    resp = requests.post(METADATA_HOST + '/addWorkflow', data=json.dumps(payload), headers=HEADERS)
    print 'The response of addWorkload is ' + str(resp)
    print 'The response headers are ' + str(resp.headers)
    print 'The response body is ' + str(resp.text)
    
def addWorkflow3():
    payload = {'tenantId' : 't8', 'name' : 'testworkflow8', 'enabled' : True}
    folderPath = 'test6'
    
    step1 = { 'name' : 'delete Folder', 'actionType' : 'deleteFolder', 'folderPath' : folderPath }
    payload['steps'] = [step1 ]
    resp = requests.post(METADATA_HOST + '/addWorkflow', data=json.dumps(payload), headers=HEADERS)
    print 'The response of addWorkload is ' + str(resp)
    print 'The response headers are ' + str(resp.headers)
    print 'The response body is ' + str(resp.text)

def addWorkflowAddFolder():
    payload = {'tenantId' : 't8', 'name' : 'testworkflow9', 'enabled' : True}
    folderPath = 'test8'
    
    step1 = { 'name' : 'create Folder', 'actionType' : 'createFolder', 'folderPath' : folderPath }
    payload['steps'] = [step1 ]
    resp = requests.post(METADATA_HOST + '/addWorkflow', data=json.dumps(payload), headers=HEADERS)
    print 'The response of addWorkload is ' + str(resp)
    print 'The response headers are ' + str(resp.headers)
    print 'The response body is ' + str(resp.text)

def testGetWorkflows():
    tenantId = '25474fa7-7cfe-40bb-9a62-49b88789b3cb'
    workflowId = '328077d9-9727-4219-83a4-a837d9a0b6ff'
    workflowInstanceId = 'ca334f58-ed95-466c-88f1-656e1b39af2b'
    getWorkflows(tenantId, None)
    getWorkflowInstancesForWorkflow(workflowId)
    getWorkflowInstanceStatus(workflowInstanceId)
    
def getWorkflows(tenantId, workflowId):
    payload = {}
    if tenantId:
        payload['tenantId'] = tenantId
    if workflowId:
        payload['workflowId'] = workflowId
    
    resp = requests.post(METADATA_HOST + '/getWorkflows', data=json.dumps(payload), headers=HEADERS)
    print 'The response of getWorkflows is ' + str(resp)
    print 'The response headers are ' + str(resp.headers)
    print 'The response body is ' + str(resp.text)

def getWorkflowInstancesForWorkflow(workflowId):
    payload = {'workflowId' : workflowId}
    resp = requests.post(METADATA_HOST + '/getWorkflowInstancesForWorkflow', data=json.dumps(payload), headers=HEADERS)
    print 'The response of getWorkflowInstancesForWorkflow is ' + str(resp)
    print 'The response headers are ' + str(resp.headers)
    print 'The response body is ' + str(resp.text)

def getWorkflowInstanceStatus(workflowInstanceId):
    payload = {'instanceId' : workflowInstanceId}
    resp = requests.post(METADATA_HOST + '/getWorkflowInstanceStatus', data=json.dumps(payload), headers=HEADERS)
    print 'The response of getWorkflowInstanceStatus is ' + str(resp)
    print 'The response headers are ' + str(resp.headers)
    print 'The response body is ' + str(resp.text)


def executeWorkflowAddFolder():
    tenantId = 't8'
    folderName = 'test12'
    params = [{'folderName' : folderName}]
    payload = {'workflowId' : '2c4a7a4e-b465-4601-9329-b1af07d580b6', 'tenantId' : tenantId, 'params' : params}
    
    resp = requests.post(WORKFLOW_RUNNER_HOST + '/executeWorkflow', data=json.dumps(payload), headers=HEADERS)
    print 'The response of addWorkload is ' + str(resp)
    print 'The response headers are ' + str(resp.headers)
    print 'The response body is ' + str(resp.text)


def executeWorkflowDeleteFolder():
    tenantId = 't8'
    filePath = 'test14'
    params = [{'filePath' : filePath}]
    payload = {'workflowId' : '2e61f112-5b4f-4847-8e7a-786a77aabf3f', 'tenantId' : tenantId, 'params' : params}
    
    resp = requests.post(WORKFLOW_RUNNER_HOST + '/executeWorkflow', data=json.dumps(payload), headers=HEADERS)
    print 'The response of addWorkload is ' + str(resp)
    print 'The response headers are ' + str(resp.headers)
    print 'The response body is ' + str(resp.text)
    
def executeWorkflow():        
    #payload = {'workflowId' : 'b66e2b6f-843d-4f01-8105-0593eb61e5c5'}
    workflowId = '0058377f-2070-4f76-9191-cb88f42f5ecb'
    payload = {'workflowId' : workflowId}
    resp = requests.post(WORKFLOW_RUNNER_HOST + '/executeWorkflow', data=json.dumps(payload), headers=HEADERS)
    print 'The response of addWorkload is ' + str(resp)
    print 'The response headers are ' + str(resp.headers)
    print 'The response body is ' + str(resp.text)


def executeWorkflowWithParams():
    folderName = 'test4'
    outputFolder = 'outputs/join1'
    paramsForSparkStep = {'tables' : ['emps','dept', 'emp_dept'],  'sql' : 'select emps.id as emp_id, dept.name as dept_name from emps, dept, emp_dept where emps.id = emp_dept.emp_id and emp_dept.dept_id = dept.id' , 'outputFolder' : outputFolder, 'saveOutput' : True, 'returnResults' : 'True'  , 'outputTableName' : 'join1', 'scriptPath' : folderName + '/testSparkScript1.py'}
    params = [{'destinationLocation': folderName + '/testSparkScript1.py' }, paramsForSparkStep , { 'filePath' : folderName + '/testSparkScript1.py' }]
    
    payload = {'workflowId' : '5cc4bf9c-798b-4f71-b1ee-fb8087b4ee4f', 'params' : params}
    resp = requests.post(WORKFLOW_RUNNER_HOST + '/executeWorkflow', data=json.dumps(payload), headers=HEADERS)
    print 'The response of addWorkload is ' + str(resp)
    print 'The response headers are ' + str(resp.headers)
    print 'The response body is ' + str(resp.text)

'''
def getWorkflowInstanceStatus():
    workflowInstanceId  = 'd637f56a-044c-4f56-bf4b-190e581adf6d'
    payload = {'instanceId' : workflowInstanceId}
    resp = requests.post(WORKFLOW_RUNNER_HOST + '/getWorkflowInstanceStatus', data=json.dumps(payload), headers=HEADERS)
    print 'The response of addWorkload is ' + str(resp)
    print 'The response headers are ' + str(resp.headers)
    print 'The response body is ' + str(resp.text)
'''

def createDataset():
    payload = { 'tenantId' : '25474fa7-7cfe-40bb-9a62-49b88789b3cb' ,'name' : 'new25474fa7', 'folders' : ['testTenantTest1_folder1/emps'] }
    resp = requests.post(METADATA_HOST + '/createDataset', data=json.dumps(payload), headers=HEADERS)
    print 'The response of createDataset is ' + str(resp)
    print 'The response headers are ' + str(resp.headers)
    print 'The response body is ' + str(resp.text)

def getDatasets():
    tenantId = '25474fa7-7cfe-40bb-9a62-49b88789b3cb'
    payload = { 'tenantId' : tenantId }
    resp = requests.post(METADATA_HOST + '/getDatasets', data=json.dumps(payload), headers=HEADERS)
    print 'The response of getDatasets is ' + str(resp)
    print 'The response headers are ' + str(resp.headers)
    print 'The response body is ' + str(resp.text)

def deleteSchema():
    payload = { 'schema' : 'workflows' }
    resp = requests.post(METADATA_HOST + '/deleteSchema', data=json.dumps(payload), headers=HEADERS)
    print 'The response of getDatasets is ' + str(resp)
    print 'The response headers are ' + str(resp.headers)
    print 'The response body is ' + str(resp.text)
   
def main():
    #addSensor()
    #getSensors()
    #getSensorData()
    #getAggregatedSensorData()
    #addWorkflow2()
    #addWorkflow3()
    #addWorkflow()
    #addKmeansWorkflow()
    #addSparkScriptWorkflow()
    #addSparkScriptNewWorkflow()
    #addSparkSqlScriptWorkflow()
    #addSparkSqlWf()
    #executeSparkScriptNewWorkflowWithParams()
    #deleteSchema()
    #executeWorkflow()
    executeWorkflowWithParams()
    #getWorkflowInstanceStatus()
    #createDataset()
    #getDatasets()
    #addWorkflowAddFolder()
    #executeWorkflowAddFolder()
    #executeWorkflowDeleteFolder()
    #testGetWorkflows()
    
if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
    sys.exit(1)
