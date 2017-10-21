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
from BottleUtils import importBottleWebServer
import json, redis
import sys, traceback
import datetime
import logging, os
from logging.handlers import TimedRotatingFileHandler
import uuid
import pickle
import requests
import string
import pymongo
sys.path.insert(0, '../common')
import LogUtil
import ConfigDb
import schemaObjects

BASE_DIR='/insightal/tenants/'

SPARK_SERVER_HOST = 'http://localhost' # TODO: will the server always run on localhost?
SPARK_SERVER_PORT = None # set in main()


@hook('after_request')
def enable_cors():
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'OPTIONS, GET, POST'  
    response.headers['Access-Control-Allow-Headers'] = 'Origin, Accept, Content-Type, X-Requested-With, X-CSRF-Token,X-Auth-Header'
    response.headers['Access-Control-Expose-Headers'] = 'X-Auth-Header'

'''
Get the list of files/directories under a particular folder.
If no folder provided, return contents of root folder from the tenantId
'''
@route('/listFolder',method=['OPTIONS','POST'])
def listFolder():
    if request.method == 'OPTIONS':
        return {}
    try:
        req = request.json
        folderToList = schemaObjects.getFolder(req)
        return json.dumps(folderToList)
    except Exception, ex:
        logger.exception('invalid JSON input: ' + str(ex))
        return {'result' : 'error, invalid JSON input: ' + str(ex)}

        
@route('/transform/join', method=['OPTIONS','POST'])
def transformJoin():
    if request.method == 'OPTIONS':
        return {}
    try:
        req = request.json
        tenantId = req.get('tenantId')
        transforms = req.get('transforms')
        tables = transforms['tables']
        selectColumns = transforms['selectColumns']
        returnResults = req.get('returnResults')
        outDirPath = req.get('outputFolderPath')
        outDirName = req.get('outputFolderName')
        saveOutput = req.get('saveOutput')
        outputTableName = req.get('outputTableName')
        physicalTables = []

        saveOutput = req.get('saveOutput')

        transforms['tables'] = physicalTables
        payload = {'tenantId' : tenantId, 'transforms': transforms,'returnResults' : returnResults, 'tables' : tables,
                   'selectColumns' : selectColumns,  'outputFolderPath' : outDirPath, 'outputFolderName' : outDirName,
                   'saveOutput'  : saveOutput, 'outputTableName' : outputTableName}

        headers = {'Content-type':'application/json'}
        sparkServerResp = requests.post(SPARK_SERVER_HOST + ':' + str(SPARK_SERVER_PORT) + '/transform/join', data=json.dumps(payload), headers=headers)
        respJson = sparkServerResp.json()
        print 'The resp is  ' + str(respJson) + str(sparkServerResp.headers)

        return json.dumps({'result' : 'success', 'data' : respJson['data']})
    except  Exception, ex:
        print 'There is exception'
        print ex
        logger.exception('Exception: ' + str(ex))


@route('/createTenantFolder', method=['OPTIONS', 'POST'])
def createTenantFolder():
    global hdfsConn
    if request.method == 'OPTIONS':
        return {}
    try:
        req = request.json
        schemaObjects.createTenantFolder(req)
        return {'result' : 'success' }
    except Exception, ex:
        logger.exception('invalid JSON input: ' + str(ex))
        return {'result' : 'error, : ' + str(ex)}
                                      

@route('/createFolder',method=['OPTIONS','POST'])
def createFolder():
    if request.method == 'OPTIONS':
        return {}
    try:
        req = request.json
        schemaObjects.createFolder(req)
        return {'result' : 'success' }
    except Exception, ex:
        logger.exception('exception in creating folder: ' + str(ex))
        return {'result' : 'error, exception in creating folder: ' + str(ex)}

@route('/uploadFile',method=['OPTIONS','POST'])
def uploadFile():
    if request.method == 'OPTIONS':
        return {}
    try:
        payload = request.files.get('json')
        rawPayload = payload.file.read()
        jsonPayload = json.loads(rawPayload)
        dataFile = request.files.get('file')
        jsonPayload['dataFile'] = dataFile
        schemaObjects.createFile(jsonPayload)
    except Exception, ex:
        logger.exception('Exception: ' + str(ex))
        return {'result' : 'error, exception: ' + str(ex)}

@route('/deleteFile',method=['OPTIONS','POST'])
def deleteFile():
    if request.method == 'OPTIONS':
        return {}
    try:
        req = request.json
        schemaObjects.deleteFile(req)
        return json.dumps({'result' : 'success'})
    except Exception, ex:
        logger.exception('Exception: ' + str(ex))
        return {'result' : 'error, exception: ' + str(ex)}

@route('/copyFile',method=['OPTIONS','POST'])
def copyFile():
    if request.method == 'OPTIONS':
        return {}
    try:
        req = request.json       
        schemaObjects.copyFile(req)
        return json.dumps({'result' : 'success'})
    except Exception, ex:
        logger.exception('Exception: ' + str(ex))
        return {'result' : 'error, exception: ' + str(ex)}

'''
Also need to delete all files in hdfs
'''
@route('/deleteFileSystem', method=['OPTIONS','POST'])
def deleteFileSystem():
    if request.method == 'OPTIONS':
        return {}
    try:
        schemaObjects.deleteFileSystem()
        return json.dumps({'result' : 'success'})
    except Exception, ex:
        logger.exception('Exception in deleting filesystem: ' + str(ex))
        return json.dumps({'result' : 'error, exception: ' + str(ex)})
    
@route('/moveFile',method=['OPTIONS','POST'])
def moveFile():
    pass

@route('/getFile', method=['OPTIONS','POST'])
def getFile():
    if request.method == 'OPTIONS':
        return {}
    try:
        req = request.json
        fileContents = schemaObjects.getFile(req)
        return json.dumps({'result' : 'success', 'data' : fileContents })
    except Exception, ex:
        logger.exception('Exception: ' + str(ex))
        return json.dumps({'result' : 'error, exception: ' + str(ex)})


@route('/getDatasetsForFolder', method=['OPTIONS','POST'])
def getDatasetsForFolder():
    if request.method == 'OPTIONS':
        return {}
    try:
        req = request.json
        datasets = schemaObjects.getDatasetsForFolder(req)
        return json.dumps({'result' : 'success', 'data' : datasets })
    except Exception, ex:
        logger.exception('Exception: ' + str(ex))
        return json.dumps({'result' : 'error, exception: ' + str(ex)})

@route('/getDatasetContents', method=['OPTIONS','POST'])
def getDatasetContents():
    if request.method == 'OPTIONS':
        return {}
    try:
        req = request.json
        headers = {'Content-type':'application/json'}
        sparkServerResp = requests.post(SPARK_SERVER_HOST + ':' + str(SPARK_SERVER_PORT) + '/getDatasetContents', data=json.dumps(req), headers=headers)
        respJson = sparkServerResp.json()
        print 'The resp is  ' + str(respJson) + str(sparkServerResp.headers)
        return json.dumps({'result' : 'success', 'data' : respJson['data']})
    except Exception, ex:
        logger.exception('Exception: ' + str(ex))
        return json.dumps({'result' : 'error, exception: ' + str(ex)})


@route('/getFields',method=['OPTIONS','POST'])
def getFields():
    if request.method == 'OPTIONS':
        return {}
    try:
        req = request.json
        fileDetails = schemaObjects.getFields(req)
        return json.dumps(fileDetails)
    except Exception, ex:
        logger.exception('Exception: ' + str(ex))
        return {'result' : 'error, exception: ' + str(ex)}


@route('/getStatistics', method=['OPTIONS','POST'])
def getStatistics():
    if request.method == 'OPTIONS':
        return {}
    try:
        req = request.json
        tenantId = req.get('tenantId')
        inputDataLocation = req.get('inputData')
        ignoreColumns = req.get('ignoreColumns')
        storeResults = req.get('storeResults')
        outputLocation = req.get('outputLocation')
        returnResults = req.get('returnResults')
        
        payload = {'tenantId' : tenantId, 'inputDataLocation': inputDataLocation, 'ignoreColumns' : ignoreColumns,
                   'returnResults' : returnResults, 'storeResults' : storeResults, 'outputLocation' : outputLocation}

        headers = {'Content-type':'application/json'}
        sparkServerResp = requests.post(SPARK_SERVER_HOST + ':' + str(SPARK_SERVER_PORT) + '/getStatistics',
                                        data=json.dumps(payload),
                                        headers=headers)
        respJson = sparkServerResp.json()
        print 'The resp is  ' + str(respJson) + str(sparkServerResp.headers)
        return sparkServerResp
    except Exception, ex :
        logger.exception('Exception: ' + str(ex))
        return {'result' : 'error, exception: ' + str(ex)}
        
@route('/createRecommendationModel', method=['OPTIONS','POST'])
def createRecommendationModel():       
    if request.method == 'OPTIONS':
        return {}
    try:
        req = request.json
        tenantId = req.get('tenantId')
        inputDataLocation = req.get('inputData')
        
        rank = req.get('rank')
        numIterations = req.get('numIterations')
        modelOutputDir = req.get('modelOutputDir')
        modelDirName = req.get('modelFolderName')
        modelDirFullPath = modelOutputDir + '/' + modelDirName
        
        payload = {'tenantId' : tenantId, 'inputDataLocation': inputDataLocation, 'rank' : rank,
                  'numIterations' : numIterations }
        payload['modelOutputDir'] = modelDirFullPath
        
        headers = {'Content-type':'application/json'}
        sparkServerResp = requests.post(SPARK_SERVER_HOST + ':' + str(SPARK_SERVER_PORT) + '/createRecommendationModel',
                                        data=json.dumps(payload),
                                        headers=headers)
        respJson = sparkServerResp.json()       
        print 'The resp is  ' + str(respJson) + str(sparkServerResp.headers)
        return sparkServerResp
    except Exception, ex:
        logger.exception('Exception: ' + str(ex))
        return {'result' : 'error, exception: ' + str(ex)}


@route('/executeCustomScript', method=['OPTIONS','POST'])
def executeCustomScript():
    if request.method == 'OPTIONS':
        return {}
    try:
        req = request.json
        tenantId = req.get('tenantId')
        scriptParams = req.get('scriptParams')
        scriptLocation = req.get('scriptLocation')
        payload = {'tenantId' : tenantId, 'scriptParams': scriptParams, 'scriptLocation' : scriptLocation }
        headers = {'Content-type':'application/json'}
        sparkServerResp = requests.post(SPARK_SERVER_HOST + ':' + str(SPARK_SERVER_PORT) + '/executeCustomScript',
                                        data=json.dumps(payload),
                                        headers=headers)
        respJson = sparkServerResp.json()       
        print 'The resp is  ' + str(respJson) + str(sparkServerResp.headers)
        return respJson
    except Exception, ex:
        logger.exception('Exception: ' + str(ex))
        return {'result' : 'error, exception: ' + str(ex)}    


_programName = os.path.splitext(os.path.basename(sys.argv[0]))[0]

# Base the logger name on the program name.
logger = LogUtil.getLogger(_programName)

def main():
    global SPARK_SERVER_PORT
    SPARK_SERVER_PORT = ConfigDb.getIntValue('WorkbenchSparkServerNew', 'port', 6951, logger=logger)
    # Use the program name as the section name in the config file.
    port = ConfigDb.getIntValue(_programName, 'port', 9506, logger=logger)
    logger.info("WorkbenchServerNew Listening on port %d" % port)
    schemaObjects.init(logger)
    server = importBottleWebServer(logger)
    run(host='0.0.0.0', port=port, debug=True, reloader=True, server=server)
        
if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
    sys.exit(1)
