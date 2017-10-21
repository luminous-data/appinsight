from pywebhdfs.webhdfs import PyWebHdfsClient
import mongoDBConn
import os, subprocess
import ConfigDb

defaultUsername='appinsight'

hdfsConnection = None
logger = None

BASE_DIR='/insightal/tenants/' # used to form a URL path
DEFAULT_HDFS_HOST = '127.0.0.1'
DEFAULT_HDFS_PORT = '8020'

def getHDFSConnection(srcLogger):
    global hdfsConnection, logger
    try:
        logger = srcLogger
        hdfsHost = ConfigDb.getStringValue('HdfsNameNode', 'host', 'localhost', logger=logger)
        hdfsPort = ConfigDb.getStringValue('HdfsNameNode', 'dfs.namenode.http-address', '50070', logger=logger)
        hdfsUsername = ConfigDb.getStringValue('HdfsNameNode', 'username', defaultUsername, logger=logger)
        hdfsConnection = PyWebHdfsClient(host=hdfsHost, port=hdfsPort, user_name=hdfsUsername, timeout=None)
        hdfsConnection.get_file_dir_status('/')
        return hdfsConnection
    except Exception, ex:
        print 'Exception in getting connection to HDFS'
        logger.exception('Exception: ' + str(ex))

def hdfs_rmdir(req):
    try:
        filePath = req.get('filePath')
        
        tenantId = req.get('tenantId')
        fullFileName = BASE_DIR + tenantId + '/' + filePath
        parentFolder = os.path.dirname(fullFileName)
        fileToDelete = mongoDBConn.find_one('fileSystem', {'path' : fullFileName } )
        parentToUpdate = [{'path': parentFolder}, { "$pop" : { 'files' : filePath } }]
        if fileToDelete['type'] == 'folder':
            parentToUpdate = [{'path': parentFolder}, { "$pop" : { 'folders' : filePath } }]
        mongoDBConn.delete_many( 'fileSystem', {'path' : {'$regex' :'^' + fullFileName}} )
        mongoDBConn.update_many( 'fileSystem', parentToUpdate)       
        hdfsConnection.delete_file_dir(fullFileName, recursive='true')
        return {'deleted' : filePath }
    except Exception, ex:
        logger.exception('Exception in removing folder: ' + str(ex))
        raise

def hdfs_copyFile(req):
    try:
        sourceFile = req.get('sourceLocation')
        destinationFile = req.get('destinationLocation')
        tenantId = req.get('tenantId')
        fullSourceName = BASE_DIR + tenantId + '/' + sourceFile
        fullDestName = BASE_DIR + tenantId + '/' + destinationFile
        sourceParentFolder = os.path.dirname(fullSourceName)
        destParentFolder = os.path.dirname(fullDestName)
        sp = subprocess.Popen(['./hdfsCopy.sh' ,fullSourceName, fullDestName ])
        sp.wait()
        sourceFileRecord = mongoDBConn.find_one('fileSystem', {'path' : fullSourceName })
        destFileRecord = sourceFileRecord
        destFileRecord['path'] = fullDestName
        destFileRecord['parentFolder'] = destParentFolder
        del destFileRecord['_id']
        
        mongoDBConn.insert_one( 'fileSystem', destFileRecord )
        #mongoDBConn.delete_many( 'fileSystem', {'path' : fullSourceName } )
        #srcParentToUpdate = [{'path': sourceParentFolder}, { "$pop" : { 'files' : sourceFile } }]
        #mongoDBConn.update_many( 'fileSystem', srcParentToUpdate)
        destParentToUpdate = [{'path': sourceParentFolder}, { "$push" : { 'files' : destinationFile } }]
        mongoDBConn.update_many( 'fileSystem', destParentToUpdate)
        
        retValue = {'copied' : True}
        return retValue
    except Exception, ex:
        logger.exception('exception in copying file: ' + str(ex))
        raise


def hdfs_makedir(req):
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
            
        hdfsConnection.make_dir(fullFolderName)                                     
        folderRecord = { 'folderName' : folderName, 'files' : [], 'folders' : [], 'path' : fullFolderName, 'type' : 'folder',
                         'logicalPath' : logicalPath}
        mongoDBConn.insert_one('fileSystem', folderRecord)
        recordToUpdate = [{'path': baseFolderName}, {"$push" : { 'folders' : logicalPath } }]
        mongoDBConn.update_many('fileSystem', recordToUpdate)
        return {'created' : folderName }
    except Exception, ex:
        logger.exception('exception in creating folder: ' + str(ex))
        raise

def saveDataFrameFromSpark(outputFolder, dataFrame, tenantId):
    global logger
    outDirName = os.path.basename(outputFolder)
    outDirFullPath = BASE_DIR + tenantId + '/' + outputFolder
    hdfsHost = ConfigDb.getStringValue('HdfsNameNode', 'host', DEFAULT_HDFS_HOST, logger=logger)
    hdfsPort = ConfigDb.getStringValue('HdfsNameNode', 'fs.defaultFS', DEFAULT_HDFS_PORT, logger=logger)
    hdfsUrl = 'hdfs://%s:%s' % (hdfsHost, hdfsPort)
    outDirFullPathHDFS = hdfsUrl + outDirFullPath
    dataFrame.repartition(1).save( outDirFullPathHDFS ,'com.databricks.spark.csv', header='true')
    schema = dataFrame.schema
    fields = schema.fields
    fieldsInfo = [[field.name, str(field.dataType), field.nullable] for field in fields]
    
    folderRecord = { 'folderName' : outDirName, 'files' : [], 'folders' : [], 'metadata' : 'spark_generated',
                     'path' : outDirFullPath, 'type' : 'folder' , 'fields' : fieldsInfo , 'logicalPath' : outputFolder}
    mongoDBConn.insert_one('fileSystem', folderRecord)

