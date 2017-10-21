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


import os, subprocess, string, json
import HDFSConnection, mongoDBConn
import uuid
from insightal_constants import *

BASE_DIR='/insightal/tenants/'
HDFS_URL = 'hdfs://127.0.0.1:8020'

logger=None

def init(loggerParam):
    global logger
    logger=loggerParam
    mongoDBConn.getMongoDBConnection(logger)
    HDFSConnection.getHDFSConnection(logger)
    
'''
Files
'''
def createFile(req):
    try:
        folderPath = req.get('folderPath')        
        tenantId = req.get('tenantId')
        fileName = req.get('fileName')
        dataFile = req.get('dataFile')
        if not dataFile:
            reply = {'status':'ERROR','message':'missing "dataFile" data in input'}
            return json.dumps(reply);
        fileContents = dataFile.file.read()
        fullFileName = BASE_DIR + tenantId + '/' + folderPath + '/' + fileName
        parentFolder = BASE_DIR + tenantId + '/' + folderPath
        logicalFilePath = folderPath + '/' + fileName

        firstLine = fileContents.splitlines()[0]
        fields = string.split(firstLine, ',')
        fileRecord = {FILE_NAME : fileName, PATH : fullFileName, FIELDS : fields, TYPE : FILE, PARENT : parentFolder,
                      LOGICAL_PATH : logicalFilePath}
        recordToUpdate = [{PATH: parentFolder}, { "$push" : { FILES : logicalFilePath } }]
        
        HDFSConnection.createFile(fullFileName, fileContents)

        mongoDBConn.insert_one(FILE_SYSTEM, fileRecord)        
        mongoDBConn.update_many(FILE_SYSTEM, recordToUpdate)
    except Exception, ex:
        logger.exception('Exception in createFile: ' + str(ex))
        raise

def getFile(req):
    try:
        filePath = req.get('filePath')
        tenantId = req.get('tenantId')
        fullFileName = BASE_DIR + tenantId + '/' + filePath
        fileContents = HDFSConnection.getFile(fullFileName)
        return fileContents
    except Exception, ex:
        logger.exception('Exception: ' + str(ex))
        return json.dumps({'result' : 'error, exception: ' + str(ex)})

def deleteFile(req):
    return deleteFolder(req)

def updateFile():
    pass

def copyFile(req):
    try:
        sourceFile = req.get('sourceLocation')
        destinationFile = req.get('destinationLocation')
        tenantId = req.get('tenantId')
        fullSourceName = BASE_DIR + tenantId + '/' + sourceFile
        fullDestName = BASE_DIR + tenantId + '/' + destinationFile
        sourceParentFolder = os.path.dirname(fullSourceName)
        destParentFolder = os.path.dirname(fullDestName)
        sp = subprocess.Popen(['./hdfsCopy.sh' ,fullSourceName, fullDestName ],
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE )
        out, err = sp.communicate()
        logger.info('Output of running hdfsCopy: ' + str(out) )
        logger.info('Error of running hdfsCopy: ' + str(err))
        if err is not None and string.strip(err) != '':
            logger.error('Error in copying file in HDFS: ' + str(err))
            raise Exception('Could not copy file in HDFS',fullSourceName, fullDestName)
        sourceFileRecord = mongoDBConn.find_one(FILE_SYSTEM, {PATH : fullSourceName })
        logger.info('Source file: ' + str(sourceFileRecord))
        destFileRecord = sourceFileRecord
        destFileRecord[PATH] = fullDestName
        destFileRecord[PARENT] = destParentFolder
        del destFileRecord['_id']
        logger.info('Inserting file: ' + str(destFileRecord))
        
        mongoDBConn.insert_one( FILE_SYSTEM, destFileRecord )
        destParentToUpdate = [{PATH: destParentFolder}, { "$push" : { FILES : destinationFile } }]
        mongoDBConn.update_many( FILE_SYSTEM, destParentToUpdate)
        
        retValue = {'copied' : True}
        return retValue
    except Exception, ex:
        logger.exception('exception in copying file: ' + str(ex))
        raise

def getFields(req):
    try:
        filePath = req.get('filePath')
        tenantId = req.get('tenantId')
        fullFileName = BASE_DIR + tenantId + '/' + filePath
        query = {PATH : fullFileName }
        fileDetails = mongoDBConn.find_one(FILE_SYSTEM, query)
        fileDetails['_id'] = str(fileDetails['_id'])
        return fileDetails
    except Exception, ex:
        logger.exception('Exception: ' + str(ex))
        raise

'''
Folders
'''
def createFolder(req):
    try:
        folderName = req.get('folderName')
        baseName = req.get('baseName')
        tenantId = req.get('tenantId')
        fullFolderName = BASE_DIR + tenantId + '/'
        baseFolderName = BASE_DIR + tenantId
        logicalPath = ''
        if   baseName is None:    
            fullFolderName += folderName
            logicalPath = folderName
        else:
            fullFolderName += baseName + '/' + folderName
            baseFolderName += '/' + baseName
            logicalPath = baseName + '/' + folderName

        HDFSConnection.createFolder(fullFolderName)
        folderRecord = { FOLDER_NAME : folderName, FILES : [], FOLDERS : [], PATH : fullFolderName, TYPE : FOLDER,
                         LOGICAL_PATH : logicalPath}
        mongoDBConn.insert_one(FILE_SYSTEM, folderRecord)
        recordToUpdate = [{PATH: baseFolderName}, {"$push" : { FOLDERS : logicalPath } }]
        mongoDBConn.update_many(FILE_SYSTEM, recordToUpdate)
        return {'created' : folderName }
    except Exception, ex:
        logger.exception('Exception in createFolder: ' + str(ex))
        raise

def getFolder(req):
    try:
        tenantId = req['tenantId']
        folderName = req.get('folderName')
        isGenerated = req.get('isGenerated')
        
        folderPath = BASE_DIR + tenantId
        if folderName is not None and string.strip(folderName) != '':
            folderPath += '/' + folderName
        logger.info('Searching for path ' + folderPath )
        if isGenerated is not None and (isGenerated is True or isGenerated == 'True'):
            folderToList = HDFSConnection.listFolder(folderPath)
            return folderToList
        else:
            query = {PATH : folderPath }
            folderToList = mongoDBConn.find_one(FILE_SYSTEM, query)
            folderToList['_id'] = str(folderToList['_id'])
            return folderToList
    except Exception, ex:
        logger.exception('Exception in getFolder: ' + str(ex))
        raise

def getDatasetsForFolder():
    try:
        tenantId = req['tenantId']
        folderName = req.get('folderName')
        folderPath = BASE_DIR + tenantId + '/' + folderName
        query = { FOLDERS : folderPath }
        matchingDatasets = mongoDBConn.find(DATASETS, query)
        results = {}
        for currDataset in matchingDatasets:
            results[currDataset['id']] = currDataset
            currDataset['_id'] = str(currDataset['_id'])
        return results
    except Exception, ex:
        logger.exception('Exception in getDatasetsForFolder: ' + str(ex))
        raise


def deleteFolder(req):
    logger.info('In deleteFolder with req: ' + str(req))
    try:
        filePath = req.get('filePath')        
        tenantId = req.get('tenantId')
        fullFileName = BASE_DIR + tenantId + '/' + filePath
        parentFolder = os.path.dirname(fullFileName)
        fileToDelete = mongoDBConn.find_one(FILE_SYSTEM, {PATH : fullFileName } )
        parentToUpdate = [{PATH: parentFolder}, { "$pop" : { FILES : filePath } }]
        if fileToDelete[TYPE] == FOLDER:
            parentToUpdate = [{PATH: parentFolder}, { "$pop" : { FOLDERS : filePath } }]
        mongoDBConn.delete_many( FILE_SYSTEM, {PATH : {'$regex' :'^' + fullFileName}} )
        mongoDBConn.update_many( FILE_SYSTEM, parentToUpdate)       
        HDFSConnection.deleteFolder(fullFileName)
        return {'deleted' : filePath }
    except Exception, ex:
        logger.exception('Exception in removing folder/file: ' + str(ex))
        raise

def updateFolder():
    pass


def createTenantFolder(req):
    try:                                      
        tenantId = req['tenantId']
        tenantFolder = BASE_DIR + tenantId
        HDFSConnection.createFolder(tenantFolder)
        tenantRecord = {TENANT_ID : tenantId, FOLDERS : [], FILES : [] , PATH : tenantFolder, TYPE : FOLDER, LOGICAL_PATH : ''}
        mongoDBConn.insert_one(FILE_SYSTEM, tenantRecord)
        return {'result' : 'success' }
    except Exception, ex:
        logger.exception('invalid JSON input: ' + str(ex))
        return {'result' : 'error, : ' + str(ex)}

def deleteSchema(req):
    try:
        schema = req['schema']
        mongoDBConn.deleteAll(schema)
    except Exception, ex:
        logger.exception('Exception in deleting filesystem: ' + str(ex))
        raise
    
'''
Save a dataframe which results in a folder in HDFS
'''
def saveDataFrameFromSpark(outputFolder, dataFrame, tenantId, tableName):
    outDirName = os.path.basename(outputFolder)
    outDirFullPath = BASE_DIR + tenantId + '/' + outputFolder
    outDirParentPath = os.path.dirname(outDirFullPath)
    outDirFullPathHDFS = HDFS_URL + outDirFullPath
    
    dataFrame.repartition(1).save( outDirFullPathHDFS ,'com.databricks.spark.csv', header='true')
    schema = dataFrame.schema
    fields = schema.fields
    fieldsInfo = [[field.name, str(field.dataType), field.nullable] for field in fields]
    
    folderRecord = { FOLDER_NAME : outDirName, FILES : [], FOLDERS : [], 'metadata' : 'spark_generated',
                     PATH : outDirFullPath, TYPE : FOLDER , FIELDS : fieldsInfo , LOGICAL_PATH : outputFolder}
    
    mongoDBConn.insert_one(FILE_SYSTEM, folderRecord)
    
    recordToUpdate = [{PATH: outDirParentPath}, {"$push" : { FOLDERS : outputFolder } }]
    mongoDBConn.update_many(FILE_SYSTEM, recordToUpdate)
    logger.info('The tableName is: ' + tableName)
    #Create or update the dataset
    if tableName is not None and tableName != '':
        dataset = mongoDBConn.find_one(DATASETS, {DATASET_NAME: tableName, TENANT_ID : tenantId})
        if dataset is None:
            logger.info('Inserting dataset into mongodb')
            datasetDef = { TENANT_ID : tenantId, DATASET_NAME : tableName,  FOLDERS : [outDirFullPath], FILES : [], FIELDS : fieldsInfo }
            createDataset(datasetDef)
        else:
            logger.info('updating dataset into mongodb')
            req = { 'id' : dataset['id'], 'folders' : outputFolder }
            addToDataset(req)
            

'''
Get dataframes from Spark
'''
def getDataFramesFromSpark(sc, sqlContext, tenantId, tableNames):
    logger.info('The tableNames are: ' + str(tableNames))
    dataFrames = {}
    for tableName in tableNames:
        query = {DATASET_NAME : tableName }
        query['tenantId'] = tenantId
        dataset = mongoDBConn.find_one(DATASETS, query)
        folders = dataset[DATASET_FOLDERS]
        logger.info('The folders for ' + tableName + ' are: ' + str(folders))
        folderPaths = [HDFS_URL + BASE_DIR + tenantId + '/' + folder + '/*' for folder in folders]
        logger.info('The folder paths are: ' + str(folderPaths))
        files = dataset[DATASET_FILES]
        logger.info('The files are: ' + str(files))
        filePaths = [HDFS_URL + BASE_DIR + tenantId + '/' +  filePath for filePath in files]
        logger.info('The file paths are: ' + str(filePaths))
        folderPaths.extend(filePaths)
        combined = ','.join([str(path) for path in folderPaths])
        logger.info('The combined folder list is: ' + str(combined))
        df = sqlContext.load(source="com.databricks.spark.csv", path = combined, header="true")
        dataFrames[tableName] = df
        df.registerTempTable(tableName)
    return dataFrames


'''
Datasets
'''
def createDataset(datasetDef):
    tenantId = datasetDef.get('tenantId')
    folders = datasetDef.get('folders')
    files = datasetDef.get('files')
    datasetName = datasetDef['name']
    datasetId = str(uuid.uuid4())
    datasetDef[DATASET_ID] = datasetId
    
    #datasetDef = assignMetadataToDataset(datasetDef)
    mongoDBConn.insert_one(DATASETS, datasetDef)
    datasetDef['_id'] = str(datasetDef['_id'])
    return datasetDef

def getDataSets(datasetReq):
    tenantId = datasetReq.get('tenantId')
    datasetName = datasetReq.get('name')
    datasetId = datasetReq.get('id')
    query = {}
    if tenantId is not None and tenantId != '':
        query[TENANT_ID] = tenantId
    if datasetName is not None:
        query[DATASET_NAME] = datasetName
    if datasetId is not None:
        query[DATASET_ID] = datasetId
        
    matchingDatasets = mongoDBConn.find(DATASETS, query)
    results = {}
    for currDataset in matchingDatasets:
        results[currDataset['id']] = currDataset
        currDataset['_id'] = str(currDataset['_id'])
    return results

def updateDataset(datasetDef):
    tenantId = datasetDef.get('tenantId')
    folders = datasetDef.get('folders')
    files = datasetDef.get('files')
    datasetName = datasetDef.get('name')
    datasetId = datasetDef.get('id')
    schema = datasetDef.get('schema')
    
    mongoDBConn.update_one(DATASETS, {DATASET_ID :datasetId}, {"$set" : datasetDef  } )
    return datasetDef

def addToDataset(req):
    datasetId = req.get('id')
    folders = req.get('folders')
    files = req.get('files')
    updateItems = {}
    if files is not None:
        updateItems[FILES] = files
    if folders is not None:
        updateItems[FOLDERS] = folders
    recordToUpdate = [{DATASET_ID :datasetId}, { "$push" : updateItems }]
    mongoDBConn.update_one(DATASETS, recordToUpdate )
    return recordToUpdate
    
def deleteDataset():
    try:
        datasetId = req.get('id')
        query = {}
        if datasetId is not None:
            query[DATASET_ID] = datasetId
            mongoDBConn.delete_many( DATASETS, query )
        else:
            raise Exception('Could not copy file in HDFS',fullSourceName, fullDestName)
    except Exception, ex:
        logger.exception('Exception in deleting dataset: ' + str(ex))
        raise

'''
Workflows
'''
def createWorkflow(workflowDef):
    workflowId = str(uuid.uuid4())
    workflowDef[WORKFLOW_ID] = workflowId
    mongoDBConn.insert_one(WORKFLOWS, workflowDef)
    workflowDef['_id'] = str(workflowDef['_id'])
    return workflowDef

def generateWorkflowQuery(req):
    tenantId = req.get('tenantId')
    workflowId = req.get('workflowId')
    query = {}
    if tenantId is not None and tenantId != '':
        query[WORKFLOW_TENANT_ID] = tenantId
    if workflowId is not None:
        query[WORKFLOW_ID] = workflowId
    return query

def getWorkflows(req):
    query = generateWorkflowQuery(req)
    matchingWorkflows = mongoDBConn.find(WORKFLOWS, query)
    results = {}
    for currWorkflow in matchingWorkflows:
        results[currWorkflow[WORKFLOW_ID]] = currWorkflow
        currWorkflow['_id'] = str(currWorkflow['_id'])
    return results

def getWorkflow(req):
    query = generateWorkflowQuery(req)
    matchingWorkflows = mongoDBConn.find_one(WORKFLOWS, query)
    return matchingWorkflows

def updateWorkflow(workflowDef):
    steps = workflowDef.get('steps')
    active = workflowDef.get('active')
    workflowUpdate = {}
    if steps is not None:
        workflowUpdate[STEPS] = steps
    if active is not None:
        workflowUpdate[ACTIVE] = active
    
    workflowId = workflowDef[WORKFLOW_ID]
    mongoDBConn.update_one(WORKFLOWS, {WORKFLOW_ID :workflowId}, {"$set" : workflowUpdate  } )
    return json.dumps(workflowDef)

def deleteWorkflow():
    pass


'''
Sensors
'''
def createSensor(req):
    sensorRecord = {}
    collectionIds = req['collectionIds']
    description = req['description']
    sensorClass = req['sensorClass']
    sensorName = req['sensorName']
    unit = req['unit']
    containerId = req['containerId']
    
    measurementType = req['measurementType']
    measurementName =  req['measurement']
    
    sensorId = str(uuid.uuid4())
    sensorRecord = {  COLLECTION_IDS : collectionIds , SENSOR_NAME : sensorName, DESCRIPTION :description, \
                      SENSOR_CLASS : sensorClass, UNIT : unit, \
                      CONTAINER_ID : '', MEASUREMENT : measurementName, \
                      MEASUREMENT_TYPE : measurementType, SENSOR_ID : sensorId }
    mongoDBConn.insert_one(SENSORS, sensorRecord)
    sensorRecord['_id'] = str(sensorRecord['_id'])
    return json.dumps(sensorRecord)


def getSensors(req):
    collectionId = req.get('collectionId')
    sensorClass = req.get('sensorClass')
    sensorId = req.get('sensorId')
    query = {}
    if collectionId != None:
        query[COLLECTION_IDS] = { '$in' : [collectionId] }
    if sensorId != None:
        query[SENSOR_ID] = sensorId

    matchingSensors = mongoDBConn.find(SENSORS, query)
    results = {}
    for currSensor in matchingSensors:
        results[currSensor[SENSOR_ID]] = currSensor
        currSensor['_id'] = str(currSensor['_id'])
    return results


'''
Workflow instances
'''
def createWorkflowInstance(req):
    workflowId = req.get('workflowId')
    params = req.get('params')
    workflowInstanceId = str(uuid.uuid4())
    workflowInstanceRecord = { INSTANCE_WORKFLOW_ID : workflowId, NEXT_STEP : 0,
                               WORKFLOW_INSTANCE_ID : workflowInstanceId,
                               WORKFLOW_INSTANCE_PARAMS : params }
    mongoDBConn.insert_one(WORKFLOW_INSTANCES, workflowInstanceRecord)
    workflowInstanceRecord['_id'] = str(workflowInstanceRecord['_id'])
    return workflowInstanceRecord

def addStateToWorkflowInstance(req):
    workflowId = req['workflowId']
    instanceId = req['instanceId']
    state = req['state']
    nextStep = req.get('nextStep')
    workflowInstanceRecord = { INSTANCE_WORKFLOW_ID : workflowId, 
                               WORKFLOW_INSTANCE_ID : instanceId,
                               WORKFLOW_STATE : state }
    
    if nextStep is not None:
        workflowInstanceRecord[NEXT_STEP] = nextStep
    mongoDBConn.insert_one(WORKFLOW_INSTANCES, workflowInstanceRecord)
    
def getWorkflowInstance(req):
    workflowInstanceId = req['instanceId']
    workflowInstanceRecs = mongoDBConn.find(WORKFLOW_INSTANCES, {WORKFLOW_INSTANCE_ID : workflowInstanceId})
    results = []
    for instance in workflowInstanceRecs:
        results.append(instance)
        instance['_id'] = str(instance['_id'])
    return results
    
def getWorkflowInstancesForWorkflow(req):
    workflowId = req['workflowId']
    workflowInstanceRecs = mongoDBConn.find(WORKFLOW_INSTANCES, {INSTANCE_WORKFLOW_ID : workflowId})
    results = []
    for instance in workflowInstanceRecs:
        results.append(instance)
        instance['_id'] = str(instance['_id'])
    return results

'''
def assignMetadataToDataset(datasetDef):
    global hdfsConn
    try:
        tenantId = datasetDef['tenantId']
        files = datasetDef.get('files')
        if files is None or len(files) == 0:
            folders = datasetDef.get('folders')
            firstFolder = folders[0]
            logger.info('The file to read is: ' + firstFolder)
            query = {'path' : HDFS_BASE_DIR + tenantId + '/' +firstFolder }
            mongoDBConn.find_one('fileSystem', query)
            files = folderDetails.get('files')
            
        firstFile = files[0]
        logger.info('The file to read is: ' + firstFile)
        fileContents = hdfsConn.read_file(firstFile, length=1000)
        fileLines = string.split(fileContents, '\n')
        fileColumns = fileLines[0]
        fileColumnNames = string.split(fileColumns, ',')
        firstRowData = fileLines[1]
        columnData = string.split(firstRowData, ',')
        columnTypes = []
        constructors = [int, float, str]
        for columnValue in columnData:
            if columnValue == '':
                columnTypes.append('str')
            else:
                for c in constructors:
                    try:
                        newColumnValue = c(columnValue)
                        if c is int:
                            columnTypes.append('int')
                        elif c is float:
                            columnTypes.append('float')
                        elif c is str:
                            columnTypes.append('str')
                        break
                    except ValueError:
                        pass
        datasetDef['schema'] = [fileColumnNames,columnTypes]
        return datasetDef
    except Exception, ex:
        print 'Exception in assigning metadata to dataset'
        logger.exception('Exception: ' + str(ex))
        raise
'''
