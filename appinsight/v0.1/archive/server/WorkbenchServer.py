#/*************************************************************************
# *
# * INSIGHTAL CONFIDENTIAL
# * __________________
# *
# *  [2016] - [2017] Insightal Inc
# *  All Rights Reserved.
# *
# * NOTICE:  All information contained herein is, and remains
# * the property of Insightal Incorporated.  The intellectual and technical concepts contained
# * herein are proprietary to Insightal Incorporated
# * and its suppliers and may be covered by U.S. and Foreign Patents,
# * patents in process, and are protected by trade secret or copyright law.
# * Dissemination of this information or reproduction of this material
# * is strictly forbidden unless prior written permission is obtained
# * from Insightal Incorporated.
# */

from bottle import request, response, route, get, post, abort, run, static_file, hook
import json, redis
import sys, traceback
import datetime
#from pywebhdfs.webhdfs import PyWebHdfsClient
import logging, os
from logging.handlers import TimedRotatingFileHandler
import uuid
import pickle
import requests
import string

BASE_DIR='/home/appinsight/insightal/'
ORIGINAL_DIR = BASE_DIR + 'original/'
DERIVED_DIR=BASE_DIR + 'derived/'


SPARK_SERVER_HOST = 'http://localhost'
SPARK_SERVER_PORT = 6950

fileSystem = {}
derivedFileSystem = {}
pathMap = {}

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
    global fileSystem, pathMap
    if request.method == 'OPTIONS':
        return {}
    try:
        req = request.json
        tenantId = req['tenantId']
        folderPath = req.get('folderName')
        folderId = pathMap[folderPath]
        
        if folderId is not None and fileSystem.get(folderId) is not None:
            return json.dumps(fileSystem[folderId])
        else:
            return json.dumps(fileSystem[tenantId])
    except Exception, ex:
        logger.error('invalid JSON input: ' + str(ex))
        return {'result' : 'error, invalid JSON input: ' + str(ex)}
    '''
    hdfs = PyWebHdfsClient(host='gmulchan-HP-ENVY-17-Notebook-PC', port='50070', user_name='hdfs', timeout=None)
    hdfs.get_file_dir_status('/')
    '''

@route('/query',method=['OPTIONS','POST'])
def query():
    global fileSystem, pathMap
    
    if request.method == 'OPTIONS':
        return {}
    try:
        req = request.json
        tenantId = req.get('tenantId')
        queryDetails = req.get('queryDetails')
        isFolder = queryDetails['isFolder']
        fields = queryDetails['fields']
        tableLogicalPath = queryDetails['tablePath']
        tableName = queryDetails['tableName']
        fileId = pathMap[tableLogicalPath]
        tablePhysicalPath = ORIGINAL_DIR + fileSystem[fileId]['physicalPath']
        payload = { 'tenantId' : tenantId, 'physicalLocation' : tablePhysicalPath, 'isFolder' : isFolder, \
                    'fields' : fields , 'tableName' : tableName }
        
        headers = {'Content-type':'application/json'}
        sparkServerResp = requests.post(SPARK_SERVER_HOST + ':' + str(SPARK_SERVER_PORT) + '/query', data=json.dumps(payload), headers=headers)
        respJson = sparkServerResp.json()
        print 'The resp is  ' + str(respJson) + str(sparkServerResp.headers)
    except Exception, ex:
        logger.exception('error in transform: ' + str(ex))
        return {'result' : 'error, : ' + str(ex)}

        

@route('/transformWithProjections', method=['OPTIONS','POST'])
def transformWithProjections():
    global fileSystem, pathMap
    if request.method == 'OPTIONS':
        return {}
    try:
        req = request.json
        tenantId = req.get('tenantId')
        transforms = req.get('transforms')

        outDirPath = req.get('outputFolderPath')
        outDirName = req.get('outputFolderName')
        outDirPhysicalName =outDirName  + '-' + str(uuid.uuid4())

        tablesWithLogicalPaths = transforms['tables']
        #dfTables = []
        tablesWithPhysicalPaths = {}
        for tableLogicalPath, tableName in tablesWithLogicalPaths.items():
            tablePhysicalPath = ORIGINAL_DIR + fileSystem[pathMap[tableLogicalPath]]['physicalPath']
            print 'The physical path is ' + tablePhysicalPath
            tablesWithPhysicalPaths[tablePhysicalPath] = tableName

        transforms['physicalPathTables'] = tablesWithPhysicalPaths
        payload = { 'tenantId' : tenantId, 'transforms' : transforms, 'outDirPhysicalPath' : DERIVED_DIR + outDirPhysicalName}

        headers = {'Content-type':'application/json'}
        sparkServerResp = requests.post(SPARK_SERVER_HOST + ':' + str(SPARK_SERVER_PORT) + '/transformWithProjections', data=json.dumps(payload), headers=headers)
        respJson = sparkServerResp.json()
        print 'The resp is  ' + str(respJson) + str(sparkServerResp.headers)
    except Exception, ex:
        logger.exception('error in transform: ' + str(ex))
        return {'result' : 'error, : ' + str(ex)}

@route('/transform', method=['OPTIONS','POST'])
def transform():
    global fileSystem, pathMap
    try:
        req = request.json
        tenantId = req.get('tenantId')
        transforms = req.get('transforms')
        inFileLogicalPath = req.get('inputFilePath')
        #tableName = os.path.basename(inFileLogicalPath)
        tableName = req.get('tableName')
        outDirPath = req.get('outputFolderPath')
        outDirName = req.get('outputFolderName')
        outDirPhysicalName =outDirName  + '-' + str(uuid.uuid4())
        
        inFileId = pathMap[inFileLogicalPath]
        inFilePhysicalPath = fileSystem[inFileId]['physicalPath']
        
        payload = {'tenantId' : tenantId, 'transforms' : transforms,  'tableName' : tableName, \
                   'outDirPhysicalPath' : DERIVED_DIR + outDirPhysicalName, 'inFileInfo' : fileSystem[inFileId], \
                   'inFilePhysicalPath' :ORIGINAL_DIR + inFilePhysicalPath }
        headers = {'Content-type':'application/json'}
        sparkServerResp = requests.post(SPARK_SERVER_HOST + ':' + str(SPARK_SERVER_PORT) + '/transform', data=json.dumps(payload), headers=headers)
        respJson = sparkServerResp.json()
        print 'The resp is  ' + str(respJson) + str(sparkServerResp.headers)
        
        if respJson['result'] == 'success':
            print 'Successful'
            newFields = []
            for transform in transforms:
                newFields.append(transform['newFieldName'])
            print 'The new fields are' + str(newFields)
            print 'Existing fields are ' + str(list(fileSystem[inFileId]['fields']))
            fieldsInDerivedTable = list(fileSystem[inFileId]['fields'])
            fieldsInDerivedTable.extend(newFields)
            print 'The fields in derived table are ' + str(fieldsInDerivedTable)
            pathMap[outDirPath + '/' +outDirName ] = outDirPhysicalName
            fileSystem[outDirPhysicalName] =  {'fields': fieldsInDerivedTable, 'name' : outDirName, \
                                               'parent' : outDirPath, 'path': outDirPath + '/' +outDirName , \
                                               'physicalPath' : outDirPhysicalName, 'derivedFrom' : inFileLogicalPath}
            fileSystem[inFileId]['derived'].append(outDirPhysicalName)
            saveFS()
            savePathMap()
        
    except Exception, ex:
        logger.exception('error in transform: ' + str(ex))
        return {'result' : 'error, : ' + str(ex)}
        
@route('/transform/join', method=['OPTIONS','POST'])
def transformJoin():
    global fileSystem, pathMap
    try:
        req = request.json
        tenantId = req.get('tenantId')
        transforms = req.get('transforms')
        tables = transforms['tables']
        selectColumns = transforms['selectColumns']
        returnResults = req.get('returnResults')
        physicalTables = []

        saveOutput = req.get('saveOutput')
        
        for table in tables:
            name=table['name']
            location = table['filePath']
            fileId = pathMap[location]
            physicalPath =ORIGINAL_DIR + fileSystem[fileId]['physicalPath']
            isDir = fileSystem[fileId].get('files')
            if isDir is not None:
                physicalPath = physicalPath + '/*'
            physicalTable = {'name' : name, 'physicalLoc' : physicalPath }
            physicalTables.append(physicalTable)

        transforms['tables'] = physicalTables
        payload = {'tenantId' : tenantId, 'transforms': transforms,'returnResults' : returnResults }

        outDirFullPath = None
        outDirPhysicalName = None
        if saveOutput:
            outDirPath = req.get('outputFolderPath')
            outDirName = req.get('outputFolderName')
            outDirFullPath = outDirPath + '/' + outDirName
            outDirPhysicalName =outDirName  + '-' + str(uuid.uuid4())
            payload['outDirPhysicalPath'] = DERIVED_DIR +  outDirPhysicalName
            

        headers = {'Content-type':'application/json'}
        sparkServerResp = requests.post(SPARK_SERVER_HOST + ':' + str(SPARK_SERVER_PORT) + '/transform/join', data=json.dumps(payload), headers=headers)
        respJson = sparkServerResp.json()
        print 'The resp is  ' + str(respJson) + str(sparkServerResp.headers)

        
        if respJson['result'] == 'success':
            newFields = []
            for columnObj in selectColumns:
                newFields.append(columnObj['newFieldName'])
            if saveOutput:
                pathMap[outDirFullPath] = outDirPhysicalName
                fileSystem[outDirPhysicalName] =  {'fields': newFields, 'name' : outDirName, \
                                                   'parent' : outDirPath, 'path': outDirFullPath , \
                                                   'physicalPath' : outDirPhysicalName, 'derivedFrom' : tables}
                #fileSystem[inFileId]['derived'].append(outDirFullPath)
                saveFS()
                savePathMap()

        return json.dumps({'result' : 'success', 'data' : respJson['data']})
    except  Exception, ex:
        print 'There is exception'
        print ex
        logger.exception('Exception: ' + str(ex))

@route('/createTenantFolder', method=['OPTIONS', 'POST'])
def createTenantFolder():
    global fileSystem, pathMap
    if request.method == 'OPTIONS':
        return {}
    try:
        req = request.json
        tenantId = req['tenantId']
        os.mkdir(ORIGINAL_DIR + tenantId, 0755)
        landingZoneId = str(uuid.uuid4())
        landingZoneFolderName = 'landingZone-' + landingZoneId
        os.mkdir(ORIGINAL_DIR + landingZoneFolderName , 0755)
        fileSystem[tenantId] = {'folders' : ['landingZone'], 'path': tenantId, 'physicalPath' : tenantId}
        fileSystem[landingZoneFolderName] = {'name' : 'landingZone', \
                                     'files' : [], 'folders' : [], 'files' : [], \
                                     'parent' : tenantId, 'path' : tenantId + '/landingZone', 'physicalPath' : landingZoneFolderName}
        pathMap[tenantId] = tenantId
        pathMap[fileSystem[landingZoneFolderName] ['path']] = landingZoneFolderName
        saveFS()
        savePathMap()
    except Exception, ex:
        logger.exception('invalid JSON input: ' + str(ex))
        return {'result' : 'error, : ' + str(ex)}



@route('/createFolder',method=['OPTIONS','POST'])
def createFolder():
    global fileSystem, pathMap
    if request.method == 'OPTIONS':
        return {}
    try:
        req = request.json
        folderName = req.get('folderName')
        baseName = req.get('baseName')
        tenantId = req.get('tenantId')
        baseId = None
        if baseName is not None and string.strip(baseName) != '':
            baseId = pathMap.get(tenantId + '/' + baseName)
            logger.info('The base Id is ' + baseId)

        folderId = str(uuid.uuid4())
        dirName = folderName + '-' + folderId
        os.mkdir(ORIGINAL_DIR+ '/' + dirName , 0755)
        if baseId is None:
            fileSystem[tenantId]['folders'].append(dirName)
            fileSystem[dirName] = {'name' :folderName , 'folders' : [], 'parent' : tenantId, 'files' : [] , \
                                   'path' : tenantId + '/' + folderName, 'physicalPath' : dirName }
        else:
            fileSystem[baseId]['folders'].append(folderName)            
            fileSystem[dirName] = {'name' : folderName, 'folders' : [], 'parent': baseId, 'files' : [], \
                                   'path': tenantId + '/' +baseName + '/' + folderName, 'physicalPath' : dirName  }

        pathMap[fileSystem[dirName]['path']] = dirName
        saveFS()
        savePathMap()
        #hdfs = PyWebHdfsClient(host='gmulchan-HP-ENVY-17-Notebook-PC', port='50070', user_name='hdfs', timeout=None)
        #hdfs.make_dir('/user/TENANT-ID/baseDir/FOLDER-NAME')
        #hdfs.make_dir('/user/newtest')
    except Exception, ex:
        logger.exception('exception in creating folder: ' + str(ex))
        return {'result' : 'error, exception in creating folder: ' + str(ex)}

@route('/uploadFile',method=['OPTIONS','POST'])
def uploadFile():
    global fileSystem, pathMap
    if request.method == 'OPTIONS':
        return {}
    try:
        payload = request.files.get('json')
        rawPayload = payload.file.read()
        jsonPayload = json.loads(rawPayload)
        folderPath = jsonPayload.get('folderPath')
        folderId = pathMap[folderPath]
        tenantId = jsonPayload.get('tenantId')
        fileName = jsonPayload.get('fileName')
        
        fileId =fileName + '-' + str(uuid.uuid4())
        dataFile = request.files.get('file')
        if not dataFile:
            reply = {'status':'ERROR','message':'missing "dataFile" data in input'}
            return json.dumps(reply);

        fileContents = dataFile.file.read()

        fileLoc = ORIGINAL_DIR + folderId + '/' + fileId
        print fileLoc
        with open(fileLoc ,'w') as open_file:
            open_file.write(fileContents)

        firstLine = fileContents.splitlines()[0]
        fields = string.split(firstLine, ',')

        fileSystem[folderId]['files'].append(fileName)
        fileSystem[fileId] = {'fields': fields, 'name' : fileName, 'parent' : folderPath, 'path': folderPath + '/' + fileName, \
                              'physicalPath' : folderId + '/' + fileId , 'derived' : [] }
        pathMap[fileSystem[fileId]['path']] = fileId
        
        saveFS()
        savePathMap()
    except Exception, ex:
        logger.exception('Exception: ' + str(ex))
        return {'result' : 'error, exception: ' + str(ex)}

    '''
    hdfs = PyWebHdfsClient(host='gmulchan-HP-ENVY-17-Notebook-PC', port='50070', user_name='hdfs', timeout=None)
    hdfs.make_dir('/user/newtest')
    '''

@route('/deleteFile',method=['OPTIONS','POST'])
def deleteFile():
    pass


@route('/moveFile',method=['OPTIONS','POST'])
def moveFile():
    pass

@route('/addFields',method=['OPTIONS','POST'])
def addFields():
    if request.method == 'OPTIONS':
        return {}
    try:
        req = request.json
        fileId = req.get('fileId')
        newFileName = req.get('newFileName')
        tenantId = req.get('tenantId')
        
    except Exception, ex:
        logger.exception('Exception: ' + str(ex))
        return {'result' : 'error, exception: ' + str(ex)}



@route('/getFields',method=['OPTIONS','POST'])
def getFields():
    if request.method == 'OPTIONS':
        return {}
    try:
        req = request.json
        filePath = req.get('filePath')
        tenantId = req.get('tenantId')
        fileId = pathMap[filePath]
        fileData = fileSystem.get(fileId)
        return json.dumps(fileData)
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
        outDirId = pathMap[outputLocation]
        outDirPhysicalPath = fileSystem[outDirId]['physicalPath']
        fileId = pathMap[inputDataLocation]
        physicalPath =ORIGINAL_DIR + fileSystem[fileId]['physicalPath']
        payload = {'tenantId' : tenantId, 'inputDataLocation': physicalPath, 'ignoreColumns' : ignoreColumns,
                   'returnResults' : returnResults, 'storeResults' : storeResults, 'outDirPhysicalPath' : outDirPhysicalPath}

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
        fileId = pathMap[inputDataLocation]
        inputPhysicalPath =ORIGINAL_DIR + fileSystem[fileId]['physicalPath']
        rank = req.get('rank')
        numIterations = req.get('numIterations')
        modelOutputDir = req.get('modelOutputDir')
        
        modelDirName = req.get('modelFolderName')
        modelDirFullPath = modelOutputDir + '/' + modelDirName
        modelDirPhysicalName = modelDirName  + '-' + str(uuid.uuid4())
        
        payload = {'tenantId' : tenantId, 'inputDataLocation': inputPhysicalPath, 'rank' : rank,
                  'numIterations' : numIterations }
        payload['modelOutputDir'] = DERIVED_DIR +  modelDirPhysicalName
        
        headers = {'Content-type':'application/json'}
        sparkServerResp = requests.post(SPARK_SERVER_HOST + ':' + str(SPARK_SERVER_PORT) + '/createRecommendationModel',
                                        data=json.dumps(payload),
                                        headers=headers)
        respJson = sparkServerResp.json()       
        print 'The resp is  ' + str(respJson) + str(sparkServerResp.headers)
        
        if respJson['result'] == 'success':            
            pathMap[modelDirFullPath] = modelDirPhysicalName
            fileSystem[modelDirPhysicalName] =  {'name' : modelDirName, \
                                               'parent' : modelOutputDir, 'path': modelDirFullPath , \
                                               'physicalPath' : modelDirPhysicalName}
            
            saveFS()
            savePathMap()
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
        scriptLogicalLocation = req.get('scriptLocation')
        fileId = pathMap[scriptLogicalLocation]
        scriptLocation =ORIGINAL_DIR + fileSystem[fileId]['physicalPath']
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

def initDataSets():
    global fileSystem, pathMap
    try:
        if os.path.exists(BASE_DIR + 'datasets.json') and os.path.exists(BASE_DIR + 'pathMap.json') :
            dataSetsFile = open(BASE_DIR + 'datasets.json', 'r')
            fileSystem = json.load(dataSetsFile)
            dataSetsFile.close()
            pathMap = json.load(open(BASE_DIR + 'pathMap.json', 'r'))
            #pathMap = pickle.load(open(BASE_DIR + 'pathMap.p', 'rw' ) )
        else:
            pathMap = {}
            fileSystem = {}                           
    except Exception, ex:
        logger.exception('Exception: ' + str(ex))
        fileSystem = {}
        pathMap = {}




def saveFS():
    global fileSystem
    dataSetsFile = open(BASE_DIR + 'datasets.json', 'w')
    #print str(json.dumps(fileSystem))
    dataSetsFile.write(json.dumps(fileSystem))
    dataSetsFile.close()
                

def savePathMap():
    global pathMap
    dataSetsFile = open(BASE_DIR + 'pathMap.json', 'w')
    dataSetsFile.write(json.dumps(pathMap))
    dataSetsFile.close()
    #pickle.dump(pathMap, open(BASE_DIR + 'pathMap.p', 'wb' ) )
                
                
logger = logging.getLogger('Workbench')
logHandler = TimedRotatingFileHandler( BASE_DIR + '/workbench.log', when='D', interval=1, backupCount=10)
logFormatter = logging.Formatter('%(asctime)s %(levelname)s %(message)s')
logHandler.setFormatter(logFormatter)
logger.addHandler(logHandler)
logger.setLevel(logging.DEBUG)


def main():
    initDataSets()
    run(host='0.0.0.0', port=9505, debug=True, reloader=True)

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
    sys.exit(1)
