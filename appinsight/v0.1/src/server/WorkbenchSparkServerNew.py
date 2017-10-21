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


from pyspark import  SparkContext
from pyspark import SparkConf
from pyspark.sql import SQLContext
from pyspark.sql.functions import upper, initcap
import json
import pandas as pd
import os
from bottle import request, response, route, get, post, abort, run, static_file, hook
from BottleUtils import importBottleWebServer
import sys, traceback
import datetime
import string
import logging
from logging.handlers import TimedRotatingFileHandler
import workbenchML
import pymongo
sys.path.insert(0, '../common')
import LogUtil
import ConfigDb

import commonSQL
import schemaObjects

BASE_DIR='/insightal/tenants/'
DEFAULT_HDFS_HOST = '127.0.0.1'
DEFAULT_HDFS_PORT = 8020
HDFS_URL = None # set in main()

MASTER='local'
APPNAME='workbench'

sc = None
sqlContext = None

@hook('after_request')
def enable_cors():
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'OPTIONS, GET, POST'  
    response.headers['Access-Control-Allow-Headers'] = 'Origin, Accept, Content-Type, X-Requested-With, X-CSRF-Token,X-Auth-Header'    
    response.headers['Access-Control-Expose-Headers'] = 'X-Auth-Header'

def initialize():
    global sc, sqlContext
    try:
        conf = SparkConf().setAppName(APPNAME)
        sc = SparkContext(MASTER, APPNAME)
        sqlContext = SQLContext(sc)
        sqlContext.registerFunction('strip', commonSQL.strip)
        sqlContext.registerFunction("toLowerCase", commonSQL.toLowerCase)
        sqlContext.registerFunction("concat", commonSQL.concat)
        schemaObjects.init(logger)
    except Exception, ex:
        logger.exception('Exception: ' + str(ex))


@route('/transform/join', method=['OPTIONS','POST'])
def transformJoin():
    global sc, sqlContext
    try:
        logger.info('In transformJoin')
        req = request.json
        tenantId = req.get('tenantId')
        transforms = req.get('transforms')
        returnResults = req.get('returnResults')
        outDirPath = req.get('outputFolderPath')
        outDirName = req.get('outputFolderName')
        outputTableName = req.get('outputTableName')
        saveOutput = req.get('saveOutput')
        tableNames = req.get('tables')
        sql = req.get('sql')
        dataFrames = {}

        dataFrames = schemaObjects.getDataFramesFromSpark(sc, sqlContext, tenantId, tableNames )

        sqlString = ''
        if sql is not None and string.strip(sql) != '':
            sqlString = sql
        else:
            selectColumns = transforms.get('selectColumns')
            sqlString = commonSQL.getSelectClause(selectColumns)
            
            sqlString = sqlString + '  FROM '
            joinConditions = transforms.get('joinConditions')
            sqlString = commonSQL.appendJoinConditions( sqlString, joinConditions, tableNames )

            whereClause = transforms.get('whereConditions')
            sqlString = commonSQL.appendWhereClause(sqlString, whereClause)
            
            groupByClause = transforms.get('groupBy')
            sqlString = commonSQL.appendGroupByClause(sqlString, groupByClause)

            limitByClause = ' LIMIT 100 '
            sqlString = commonSQL.appendLimitByClause(sqlString, limitByClause)

            logger.info('The generated SQL is: ' + sqlString)
            
        newDF = sqlContext.sql(sqlString)
        newDF.show()
        logger.info('Save to output table: ' + outputTableName)
        if (saveOutput is True or saveOutput == 'True') and outDirPath is not None and outDirName is not None:
            schemaObjects.saveDataFrameFromSpark(outDirPath+ '/' + outDirName, newDF, tenantId, outputTableName)
            
        resp = {'result' : 'success' }
        if returnResults is not None and (returnResults is True or returnResults == 'True'):
            results = newDF.toJSON().collect()
            resp['data'] = results
        return json.dumps(resp)

    except  Exception, ex:
        print 'There is exception'
        print ex
        logger.exception('Exception: ' + str(ex))


@route('/getDatasetContents', method=['OPTIONS','POST'])
def getDatasetContents():
    global sc, sqlContext
    if request.method == 'OPTIONS':
        return {}
    try:
        req = request.json
        tableName = req.get('table')
        dataFrames = {}

        dataFrames = schemaObjects.getDataFramesFromSpark(sc, sqlContext, tenantId, [tableName] )
        sqlString = 'SELECT * FROM ' + tableName
        newDF = sqlContext.sql(sqlString)
        newDF.show()
        resp = {'result' : 'success' }
        results = newDF.toJSON().collect()
        resp['data'] = results
        return json.dumps(resp)
    except  Exception, ex:
        print 'There is exception'
        print ex
        logger.exception('Exception: ' + str(ex))
        


'''
ignoreColumns is to ignore columns in the data that are textual. Only stats on numerical data
is calculated.
'''
@route('/getStatistics', method=['OPTIONS','POST'])
def getStats():
    global sc, sqlContext, hdfsConn
    try:
        req = request.json
        tenantId = req.get('tenantId')
        inputDataLocation = req.get('inputDataLocation')
        fullTablePath = BASE_DIR + tenantId + '/' + inputDataLocation
        fullTablePathHDFS = HDFS_URL + fullTablePath
        ignoreColumns = req.get('ignoreColumns', [])
        returnResults = req.get('returnResults', False)
        storeResults = req.get('storeResults', False)
        outDirPhysicalPath = req.get('outputLocation', None)
        outDirPhysicalPathHDFS = HDFS_URL + BASE_DIR + tenantId + '/' + outDirPhysicalPath
        return workbenchML.getStatistics(fullTablePathHDFS, ignoreColumns, storeResults,
                                         outDirPhysicalPathHDFS, returnResults, logger, sc, hdfsConn)
    except  Exception, ex:
        print 'There is exception'
        print ex
        logger.exception('Exception: ' + str(ex))

@route('/createRecommendationModel', method=['OPTIONS','POST'])
def createRecommendationModel():
    global sc, sqlContext, hdfsConn
    try:
        req = request.json
        tenantId = req.get('tenantId')
        inputDataLocation = req.get('inputDataLocation')
        fullTablePathHDFS = HDFS_URL + BASE_DIR + tenantId + '/' + inputDataLocation
        rank = req.get('rank')
        numIterations = req.get('numIterations')
        modelOutputDir = req.get('modelOutputDir')
        outDirPhysicalPathHDFS = HDFS_URL + BASE_DIR + tenantId + '/' + modelOutputDir
        return workbenchML.createRecommendationModel(fullTablePathHDFS, rank, numIterations,
                                                     outDirPhysicalPathHDFS, logger, sc, sqlContext, hdfsConn)
    except  Exception, ex:
        print 'There is exception'
        print ex
        logger.exception('Exception: ' + str(ex))
    


@route('/executeCustomScript', method=['OPTIONS','POST'])
def executeCustomScript():
    global sc, sqlContext
    try:
        req = request.json
        response = workbenchML.executeCustomScript(req, logger, sc, sqlContext)
        json.dumps({'result' : 'success' , 'data': str(response) })
        return response                                        
    except  Exception, ex:
        print 'There is exception'
        print ex                                        
        logger.exception('Exception: ' + str(ex))       
      

def testGetCovariance():
    workbenchML.getCovariance('/home/gmulchan/d',0,1, logger, sc,sqlContext)

def testCreateRecommendationModel():
    result = workbenchML.createRecommendationModel('/home/gmulchan/spark151/spark-1.5.1-bin-hadoop2.6/data/mllib/als/test.data',
                        10, 10, '/home/gmulchan/testCollaborativeFilter', logger, sc,sqlContext)
    
def testMLLibScript():
    result = workbenchML.executeCustomScript({},
                                             '/home/gmulchan/work/appinsight/appinsight/v0.1/src/tests/mllibtestscript1.py',
                                             logger, sc, sqlContext)

_programName = os.path.splitext(os.path.basename(sys.argv[0]))[0]
   
# Base the logger name on the program name.
logger = LogUtil.getLogger(_programName)


def main():
    global HDFS_URL
    hdfsHost = ConfigDb.getStringValue('HdfsNameNode', 'host', DEFAULT_HDFS_HOST, logger=logger)
    hdfsPort = ConfigDb.getIntValue('HdfsNameNode', 'fs.defaultFS', DEFAULT_HDFS_PORT, logger=logger)
    HDFS_URL = 'hdfs://%s:%d' % (hdfsHost, hdfsPort)
    logger.info("WorkbenchServerNew talking to HDFS at %s" % HDFS_URL)
    port = ConfigDb.getIntValue(_programName, 'port', 6951, logger=logger)
    logger.info("WorkbenchServerNew Listening on port %d" % port)
    server = importBottleWebServer(logger)
    run(host='0.0.0.0', port=port, debug=True, reloader=False, server=server)
    
        
def main2():
    initialize()
    main()
    #testGetStats()
    #testGetCovariance()
    #testCreateRecommendationModel()
    #testMLLibScript()

    
if __name__ == '__main__':
    try:
        main2()
    except KeyboardInterrupt:
        sys.exit(0)
    sys.exit(1)
