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
import httplib as http_client
import logging

http_client.HTTPConnection.debuglevel = 1

# You must initialize logging, otherwise you'll not see debug output.
logging.basicConfig()
logging.getLogger().setLevel(logging.DEBUG)
requests_log = logging.getLogger("requests.packages.urllib3")
requests_log.setLevel(logging.DEBUG)
requests_log.propagate = True


HOST='http://45.79.102.84:9506'
#HOST='http://localhost:9506'
HEADERS = {'Content-type':'application/json'}

SPARK_SERVER_HOST = 'http://45.79.102.84'
#SPARK_SERVER_HOST = 'http://localhost'
SPARK_SERVER_PORT = 6950
METADATA_HOST='http://localhost:9503'

#tenantId = 'testTenantTest1'
#tenantId = '25474fa7-7cfe-40bb-9a62-49b88789b3cb'
tenantId = 'test123'
testFolder = 'test1'

def addTenant(tenantId):
    payload = { 'tenantId' : tenantId }
    resp = requests.post(HOST + '/createTenantFolder', data=json.dumps(payload), headers=HEADERS)
    print 'The response code of createTenantFolder ' + str(resp)
    print 'The response headers are ' + str(resp.headers)
    print 'The response body is ' + str(resp.text)


def createFolder(tenantId, baseName, folderName):
    payload = ''
    if baseName is not None and baseName != '':
        payload = { 'tenantId' : tenantId, 'folderName' : folderName, 'baseName': baseName}
    else:
        payload = { 'tenantId' : tenantId, 'folderName' : folderName }
    #payload = { 'tenantId' : tenantId, 'folderName' : 'scripts'}
    #payload = { 'tenantId' : tenantId, 'folderName' : 'emps', 'baseName': testFolder}
    #payload = { 'tenantId' : tenantId, 'folderName' : 'dept', 'baseName': testFolder}
    #payload = { 'tenantId' : tenantId, 'folderName' : 'emp_dept', 'baseName': testFolder}
    #payload = { 'tenantId' : tenantId, 'folderName' : 'testTenantTest1_folder1'}
    #payload = { 'tenantId' : tenantId, 'folderName' : 'inputStatsData1'}
    #payload = { 'tenantId' : tenantId, 'folderName' : 'inputCollabFilterData1'}
    #payload = { 'tenantId' : tenantId, 'folderName' : 'stats1'}
    resp = requests.post(HOST + '/createFolder', data=json.dumps(payload), headers=HEADERS)
    print 'The response code of createFolder ' + str(resp)
    print 'The response headers are ' + str(resp.headers)
    print 'The response body is ' + str(resp.text)


def listFolder(tenantId, folderName):
    #payload = { 'tenantId' : tenantId, 'folderName' : 'testTenantTest1_folder1' }
    payload = { 'tenantId' : tenantId, 'folderName' : folderName}
    resp = requests.post(HOST + '/listFolder', data=json.dumps(payload), headers=HEADERS)
    print 'The response code of listFolder  ' + str(resp)
    print 'The response headers are ' + str(resp.headers)
    print 'The response body is ' + str(resp.text)
    
def uploadFile(tenantId, folderPath , fileName):
    
    #payload = '{"tenantId":"testTenantTest1","folderPath":"testTenantTest1_folder1/emps","fileName":"allEmps.csv" }'
    #payload = '{"tenantId":"testTenantTest1","folderPath":"testTenantTest1_folder1/dept","fileName":"dept.csv" }'
    #payload = '{"tenantId":"testTenantTest1","folderPath":"testTenantTest1_folder1/emp_dept","fileName":"emp_dept.csv" }'
    #payload = '{"tenantId":"testTenantTest1","folderPath":"scripts","fileName":"mllibtestscript1.py" }'
    #payload = '{"tenantId":"testTenantTest1","folderPath":"inputStatsData1","fileName":"inputDataForStats.txt" }'
    #payload = '{"tenantId":"testTenantTest1","folderPath": "test/emps","fileName":"allEmps.csv" }'
    #payload = '{"tenantId":"testTenantTest1","folderPath": "test/dept","fileName":"dept.csv" }'
    #payload = '{"tenantId":"testTenantTest1","folderPath": "test/emp_dept","fileName":"emp_dept.csv" }'
    #fileToUpload = (( "file" , open('allEmps.csv', 'rb')), ("json", payload))
    #fileToUpload = (( "file" , open('dept.csv', 'rb')), ("json", payload))
    #fileToUpload = (( "file" , open('emp_dept.csv', 'rb')), ("json", payload))
    #fileToUpload = (( "file" , open('mllibtestscript1.py', 'rb')), ("json", payload))
    #fileToUpload = (( "file" , open('inputDataForStats.txt', 'rb')), ("json", payload))
    #fileToUpload = (( "file" , open('inputDataForCollabFilter.txt', 'rb')), ("json", payload))
    payload = '{"tenantId": "' + tenantId + '","folderPath": "' + folderPath + '","fileName": "' + fileName + '"}'
    fileToUpload = (( "file" , open(fileName, 'rb')), ("json", payload))
    headersToSend = {}
    headersToSend['Content-type'] = 'multipart/form-data'
    del headersToSend['Content-type']
    resp = requests.post(HOST + '/uploadFile', headers=headersToSend, files=fileToUpload)
    print 'The response code of uploadFile ' + str(resp)
    print 'The response headers are ' + str(resp.headers)
    print 'The response body is ' + str(resp.text)

def createDataset(tenantId, folders, files, datasetName):
    files = [] if files is None else files
    folders = [] if folders is None else folders
    payload = { 'tenantId' : tenantId, 'name' : datasetName, 'folders' : folders, 'files' : files }
    resp = requests.post(METADATA_HOST + '/createDataset', data=json.dumps(payload), headers=HEADERS)
    print 'The response code of createDataset  ' + str(resp)
    print 'The response headers are ' + str(resp.headers)
    print 'The response body is ' + str(resp.text)


def createDirsForTransformJoin():
    tenantId = '25474fa7-7cfe-40bb-9a62-49b88789b3cb'
    testFolder = 'test1'
    #addTenant(tenantId)
    createFolder(tenantId, None, testFolder)
    createFolder(tenantId, testFolder, 'emps')
    createFolder(tenantId, testFolder, 'dept')
    createFolder(tenantId, testFolder, 'emp_dept')
    uploadFile(tenantId, testFolder + '/emps' , 'allEmps.csv')
    uploadFile(tenantId, testFolder + '/dept' , 'dept.csv')
    uploadFile(tenantId, testFolder + '/emp_dept' , 'emp_dept.csv')

def createOutputFolder():
    tenantId = 'newtenant1'
    createFolder(tenantId, testFolder, 'outputs')
    
def testCreateDataset():
    tenantId = '25474fa7-7cfe-40bb-9a62-49b88789b3cb'
    createDataset(tenantId, ['test1/emps'],[], 'emps')
    createDataset(tenantId, ['test1/dept'],[], 'dept')
    createDataset(tenantId, ['test1/emp_dept'],[], 'emp_dept')
    
def uploadFileExample():
    uploadFile('t8', 'test/scripts' , 'testSparkScript1.py')


def uploadScriptsFiles():
    tenantId = '25474fa7-7cfe-40bb-9a62-49b88789b3cb'
    testFolder = 'myscripts4'
    scriptsFolder = 'scripts'
    #createFolder(tenantId, testFolder, scriptsFolder)
    #uploadFile(tenantId, testFolder + '/' + scriptsFolder , 'mllibtestscript1.py')
    uploadFile(tenantId, testFolder + '/' + scriptsFolder , 'testSparkScript4.py')
    
    
def copyFile():
    tenantId = 't8'
    src = 'test33/src/allEmps.csv'
    dest = 'test33/dest/emps.csv'
    payload = { 'tenantId' : tenantId, 'sourceLocation' : src, 'destinationLocation' : dest}
    resp = requests.post(HOST + '/copyFile', data=json.dumps(payload), headers=HEADERS)
    print 'The response code of copyFolder  ' + str(resp)
    print 'The response headers are ' + str(resp.headers)
    print 'The response body is ' + str(resp.text)


def testListFolder():
    listFolder(tenantId, testFolder)
    
def createDirsForCopyFile():
    tenantId = 't8'
    testFolder = 'test33'
    createFolder(tenantId, None, testFolder)
    createFolder(tenantId, testFolder, 'src')
    createFolder(tenantId, testFolder, 'dest')
    uploadFile(tenantId, testFolder + '/src' , 'allEmps.csv')
    

def createDirsForExecuteCustomScript():
    tenantId = 't8'
    testFolder = 'test'
    #createFolder(tenantId, None, testFolder)
    #createFolder(tenantId, testFolder, 'scripts')
    uploadFile(tenantId, testFolder, 'kmeansdata.txt')
    #uploadFile(tenantId, testFolder + '/scripts', 'kmeanstest.py')
    
def getFields():
    tenantId = 't8'
    payload = { 'tenantId' : tenantId, 'filePath' : 'test22/emps/allEmps.csv' }
    resp = requests.post(HOST + '/getFields', data=json.dumps(payload), headers=HEADERS)
    print 'The response code of createFolder ' + str(resp)
    print 'The response headers are ' + str(resp.headers)
    print 'The response body is ' + str(resp.text)



def connectToSparkServer(name):
    payload = {"name":name}
    resp = requests.post(SPARK_SERVER_HOST +':' + str(SPARK_SERVER_PORT) + '/init', data=json.dumps(payload), headers=HEADERS)

def transform():
    payload = {"tenantId":'testTenant' ,'inputFilePath': 'testTenant/testFolder/test2.csv', \
               'outputFolderPath' :'testTenant/testFolder', 'outputFolderName' : 'spark_op2' , 'tableName' : 'test2'}
    payload['transforms'] = [ {'type' : 'singleField', 'field': 'charge', 'function': 'sqrt', 'newFieldName' : 'sqrt_vertex'} ,  \
			      {'type' : 'singleField', 'field': 'tracks', 'function': 'sin', 'newFieldName' : 'sin_tracks'} ,  \
			      {'type' : 'singleField', 'field': 'status', 'function': 'upper', 'newFieldName' : 'cap_tracks'} ,  \
                              {'type' : 'multiField', 'fields' : ['tracks', 'zdc'], 'function': 'concat' , 'newFieldName' : 'concated'} ]
    resp = requests.post(HOST + '/transform', data=json.dumps(payload), headers=HEADERS)
    print 'The response code of createFolder ' + str(resp)
    print 'The response headers are ' + str(resp.headers)
    print 'The response body is ' + str(resp.text)

'''
def transformJoin():
    payload = {'tenantId':'8c2c0f14-c8ae-418e-bae7-e5beda66d49f' , 'saveOutput' : False,
               'outputFolderPath' :'8c2c0f14-c8ae-418e-bae7-e5beda66d49f/test_folder1',
               'outputFolderName' : 'tempFolder', 'tableName' : 'tempTable' }
    payload['transforms'] = { 'type' : 'JOIN' ,  \
                              'tables' : [\
                                  {'name' : 'sourceTable' , 'filePath' : '8c2c0f14-c8ae-418e-bae7-e5beda66d49f/test_folder1/allEmps.csv' }], 
                                  'selectColumns' : [{"fieldNames":["sourceTable.id"],        "newFieldName":"__id"},
                                                     {"fieldNames":["sourceTable.fname"],    "newFieldName":"__fname"}]
                          #'selectColumns' : ['emp.id', 'emp.fname' , 'emp.lname', 'dept.description', 'dept.name' ]
                          }
    payload['returnResults'] = True
    resp = requests.post(HOST + '/transform/join', data=json.dumps(payload), headers=HEADERS)

    print 'The response code of transformJoin ' + str(resp)
    print 'The response headers are ' + str(resp.headers)
    print 'The response body is ' + str(resp.text)
    print 'The json is ' + str(resp.json())
'''

'''
def transformJoin():
    payload = {'tenantId':'testTenantTest1' , 'saveOutput' : True, 'outputFolderPath' :'testTenant/testFolder',
               'outputFolderName' : 'joinEmpDept2', 'tableName' : 'empDeptJoin2' }
    payload['transforms'] = { 'type' : 'JOIN' ,  \
                              'tables' : [\
                                  {'name' : 'emp' , 'filePath' : 'testTenantTest1/testTenantTest1_folder1/emps' },
                                  {'name': 'dept', 'filePath' : 'testTenantTest1/testTenantTest1_folder1/dept' },
                                  {'name' : 'emp_dept', 'filePath' : 'testTenantTest1/testTenantTest1_folder1/emp_dept' } ], 
                              'joinConditions' : [ [ { 'tableName' : 'emp', 'columnName' : 'id'}, {'tableName': 'emp_dept', 'columnName' : 'emp_id' } ],
                                                  [ {'tableName' : 'emp_dept', 'columnName' : 'dept_id'}, {'tableName': 'dept', 'columnName': 'id' } ] ],
                                  'whereConditions' : 'emp.fname = "JAMES" AND emp.lname = "MYERS" ',
                                  'selectColumns' : [{'fieldNames':['emp.id'], 'newFieldName' : 'emp_id', 'function' : 'upper'},
                                                     {'fieldNames':['emp.fname', 'emp.lname'], 'newFieldName' : 'emp_fullName', 'function' : 'concat'},
                                                     {'fieldNames':['dept.name'], 'newFieldName' : 'dept_name'}]                                              
                          #'selectColumns' : ['emp.id', 'emp.fname' , 'emp.lname', 'dept.description', 'dept.name' ]
                          }
    payload['returnResults'] = True
    resp = requests.post(HOST + '/transform/join', data=json.dumps(payload), headers=HEADERS)

    print 'The response code of transformJoin ' + str(resp)
    print 'The response headers are ' + str(resp.headers)
    print 'The response body is ' + str(resp.text)
    print 'The json is ' + str(resp.json())
'''

def transformJoin():
    #tenantId = 'newtenant1'
    tenantId = '25474fa7-7cfe-40bb-9a62-49b88789b3cb'
    payload = {'tenantId': tenantId , 'saveOutput' : True, 'outputFolderPath' :'outputs',
               'outputFolderName' : 'op6', 'outputTableName' : 'empdeptOp6' }
    
    
    payload['transforms'] = { 'type' : 'JOIN' ,  \
                              'tables' : [ 'emps' , 'dept', 'emp_dept'],
                              'joinConditions' : [ [ { 'tableName' : 'emps', 'columnName' : 'id'}, {'tableName': 'emp_dept', 'columnName' : 'emp_id' } ],
                                                  [ {'tableName' : 'emp_dept', 'columnName' : 'dept_id'}, {'tableName': 'dept', 'columnName': 'id' } ] ],
                              'whereConditions' : 'emps.fname = "JAMES" AND emps.lname = "MYERS" ',
                              #'groupBy' : 'dept.id',
                                  'selectColumns' : [{'fieldNames':['emps.id'], 'newFieldName' : 'emp_id', 'function' : 'upper'},
                                                     {'fieldNames':['emps.fname', 'emps.lname'], 'newFieldName' : 'emp_fullName', 'function' : 'concat'},
                                                     {'fieldNames':['dept.name'], 'newFieldName' : 'dept_name'}]                                              
                          #'selectColumns' : ['emp.id', 'emp.fname' , 'emp.lname', 'dept.description', 'dept.name' ]
                          }
    
    payload['returnResults'] = True
    resp = requests.post(HOST + '/transform/join', data=json.dumps(payload), headers=HEADERS)

    print 'The response code of transformJoin ' + str(resp)
    print 'The response headers are ' + str(resp.headers)
    print 'The response body is ' + str(resp.text)
    print 'The json is ' + str(resp.json())



'''
                                  {'name' : 'emp' , 'filePath' : 'testTenant/testFolder/emp.csv' },
                                  {'name': 'dept', 'filePath' : 'testTenant/testFolder/dept.csv' },
                                  {'name' : 'emp_dept', 'filePath' : 'testTenant/testFolder/emp_dept.csv' } ], '''

def transformWithProjection():
    payload = {"tenantId":'testTenant' , \
               'outputFolderPath' :'testTenant/testFolder', 'outputFolderName' : 'spark_op3' }
    
    payload['transforms'] = { 'tables' : {'testTenant/testFolder/test.csv' : 'metric' }, \
                              'projections' : { 'metric.vertex' : 'VERTEX' }, \
                              'transforms' : [{'table' : 'metric' , 'type' : 'singleField', 'field': 'metric.vertex', 'function': 'upper', 'newFieldName' : 'cap_vertex'} ,  \
                                {'table' : 'metric', 'type' : 'multiField', 'fields' : ['metric.vertex', 'metric.zdc'], 'function': 'concat' , 'newFieldName' : 'concated' } ] }
    
    resp = requests.post(HOST + '/transformWithProjections', data=json.dumps(payload), headers=HEADERS)
    print 'The response code of createFolder ' + str(resp)
    print 'The response headers are ' + str(resp.headers)
    print 'The response body is ' + str(resp.text)
    print 'The json is ' + resp.json()


def query():
    queryDetails = {'fields' : ['charge', 'vertex'], 'isFolder' : False, \
                    'tablePath' : 'testTenant/testFolder/test.csv', 'tableName' : 'metrics' }
    payload = {"tenantId":'testTenant' , 'queryDetails' : queryDetails}
    resp = requests.post(HOST + '/query', data=json.dumps(payload), headers=HEADERS)
    print 'The response code of createFolder ' + str(resp)
    print 'The response headers are ' + str(resp.headers)
    print 'The response body is ' + str(resp.text)


def getStatistics():
    payload = {"tenantId":'testTenantTest1' ,          
               'storeResults' : True, 'outputLocation' : 'testTenantTest1/stats1' ,
               'inputData' : 'inputStatsData1/inputDataForStats.txt',
               'returnResults' : True,
               'ignoreColumns' : [1,2,3,41]
               }

    resp = requests.post(HOST + '/getStatistics', data=json.dumps(payload), headers=HEADERS)
    print 'The response code of getStatistics ' + str(resp)
    print 'The response headers are ' + str(resp.headers)
    print 'The response body is ' + str(resp.text)
    print 'The json is ' + str(resp.json())

def createRecommendationModel():
    payload = { 'tenantId':'testTenantTest1' ,     
               'modelOutputDir' : 'testTenantTest1',
               'modelFolderName' : 'collabmodel' ,
               'inputData' : 'inputCollabFilterData1/inputDataForCollabFilter.txt',
               'rank' : 10,
               'numIterations' : 10 }
    
    resp = requests.post(HOST + '/createRecommendationModel', data=json.dumps(payload), headers=HEADERS)
    print 'The response code of createRecommendationModel ' + str(resp)
    print 'The response headers are ' + str(resp.headers)
    print 'The response body is ' + str(resp.text)
    print 'The json is ' + str(resp.json())

def executeCustomScript():
    tenantId = 't8'
    testFolder = 'test'
    payload = { 'tenantId': tenantId,     
               'scriptParams' : {},
               'scriptLocation' : testFolder + '/scripts/mllibtestscript1.py' }
    
    resp = requests.post(HOST + '/executeCustomScript', data=json.dumps(payload), headers=HEADERS)
    print 'The response code of executeCustomScript ' + str(resp)
    print 'The response headers are ' + str(resp.headers)
    print 'The response body is ' + str(resp.text)
    print 'The json is ' + str(resp.json())


def deleteFile():
    tenantId = 'newtenant1'
    folderName='test4'
    payload = { 'tenantId': tenantId, 'filePath' : folderName + '/testSparkScript1.py' , 'tt' : True}
    resp = requests.post(HOST + '/deleteFile', data=json.dumps(payload), headers=HEADERS)
    print 'The response code of executeCustomScript ' + str(resp)
    print 'The response headers are ' + str(resp.headers)
    print 'The response body is ' + str(resp.text)
    print 'The json is ' + str(resp.json())

    
def main():
    #addTenant(tenantId)
    #createFolder()
    #uploadFile()
    #uploadFileExample()
    #getFields()
    #connectToSparkServer('hello')
    #listFolder(tenantId,testFolder)
    #createDirsForTransformJoin()
    #createOutputFolder()
    #testCreateDataset()
    #transformJoin()
    uploadScriptsFiles()
    #createDirsForExecuteCustomScript()
    #query()
    #getStatistics()
    #createRecommendationModel()
    #executeCustomScript()
    #createDirsForCopyFile()
    #copyFile()
    #testListFolder()
    #deleteFile()

if __name__=='__main__':
    main()
