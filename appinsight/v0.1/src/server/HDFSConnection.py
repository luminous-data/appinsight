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

from pywebhdfs.webhdfs import PyWebHdfsClient
import os, subprocess

username='appinsight'

hdfsConnection = None
logger = None

BASE_DIR='/insightal/tenants/'
HDFS_URL = 'hdfs://127.0.0.1:8020'


def getHDFSConnection(srcLogger):
    global hdfsConnection, logger
    try:
        logger = srcLogger
        hdfsConnection = PyWebHdfsClient(host='localhost', port='50070', user_name=username, timeout=None)
        hdfsConnection.get_file_dir_status('/')
    except Exception, ex:
        print 'Exception in getting connection to HDFS'
        logger.exception('Exception: ' + str(ex))
        raise

def createFolder(fullFolderName):
    global hdfsConnection, logger
    hdfsConnection.make_dir(fullFolderName)
    

def deleteFolder(fullFileName):
    global hdfsConnection, logger
    hdfsConnection.delete_file_dir(fullFileName, recursive=True)

def createFile(fullFileName, fileContents):
    global hdfsConnection, logger
    hdfsConnection.create_file(fullFileName, fileContents)

def getFile(fullFileName):
    global hdfsConnection, logger
    fileContents = hdfsConnection.read_file(fullFileName)
    return fileContents

def listFolder(fullFolderName):
    global hdfsConnection, logger
    dirListing = hdfsConnection.list_dir(fullFolderName)
    return dirListing

def saveDataFrameFromSpark(outputFolder, dataFrame, tenantId):
    outDirName = os.path.basename(outputFolder)
    outDirFullPath = BASE_DIR + tenantId + '/' + outputFolder
    outDirFullPathHDFS = HDFS_URL + outDirFullPath
    dataFrame.repartition(1).save( outDirFullPathHDFS ,'com.databricks.spark.csv', header='true')
    

