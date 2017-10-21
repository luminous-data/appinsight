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
sys.path.insert(0, '../common')
import LogUtil
import ConfigDb
from kafka import SimpleProducer
from kafka.client import KafkaClient as SimpleClient
import commonSQL
import schemaObjects

BASE_DIR = '/home/appinsight/AppInsight/'
HDFS_BASE_DIR='/insightal/tenants/'
HDFS_URL = None # set in main()

MASTER='local'
APPNAME='workflowTransformJoinStepExecutor'

# Get the program name without the directory or extension.
_programName = 'WorkflowTransformJoinStepExecutor'

# Base the logger name on the program name.
logger = LogUtil.getLogger(_programName)

sc = None
sqlContext = None

def strip(field):
    return string.strip(field)

def toLowerCase(field):
    return field.lower()

def concat(f1, f2):
    return f1+f2

def setup():
    global sc, sqlContext
    try:
        conf = SparkConf().setAppName(APPNAME)
        sc = SparkContext(MASTER, APPNAME)
        sqlContext = SQLContext(sc)
        sqlContext.registerFunction('strip', strip)
        sqlContext.registerFunction("toLowerCase", toLowerCase)
        sqlContext.registerFunction("concat", concat)
        schemaObjects.init(logger)
    except Exception, ex:
        logger.exception('Exception in setup: ' + str(ex))

def runTransformJoin(req):
    global sc, sqlContext
    try:
        tenantId = req.get('tenantId')
        transforms = req.get('transforms')
        returnResults = req.get('returnResults')
        outDirPath = req.get('outputFolderPath')
        outDirName = req.get('outputFolderName')
        outputTableName = req.get('outputTableName')
        saveOutput = req.get('saveOutput')
        tableNames = transforms.get('tables')
        sql = transforms.get('sql')
        dataFrames = {}
	logger.info('The tables are: ' + str(tableNames))
	logger.info('The sql is: ' + sql)
        dataFrames = schemaObjects.getDataFramesFromSpark(sc, sqlContext, tenantId, tableNames )
        sqlString = ''
        if sql is not None and string.strip(sql) != '':
            sqlString = sql
        else:
            selectColumns = transforms['selectColumns']
            sqlString = commonSQL.getSelectClause(selectColumns)
            
            sqlString = sqlString + '  FROM '
            joinConditions = transforms.get('joinConditions')
            sqlString = commonSQL.appendJoinConditions( sqlString, joinConditions, tableNames )

            whereClause = transforms.get('whereConditions')
            sqlString = commonSQL.appendWhereClause(sqlString, whereClause)
            
            groupByClause = transforms.get('groupBy')
            sqlString = commonSQL.appendGroupByClause(sqlString, groupByClause)

            logger.info('The generated SQL is: ' + sqlString)
            
        newDF = sqlContext.sql(sqlString)
        newDF.show()
        logger.info('Save to output table: ' + str(outputTableName))
        if (saveOutput is True or saveOutput == 'True') and outDirPath is not None and outDirName is not None:
            schemaObjects.saveDataFrameFromSpark(outDirPath+ '/' + outDirName, newDF, tenantId, outputTableName)
            
        resp = {'result' : 'success' }
        if returnResults is not None and (returnResults is True or returnResults == 'True'):
            results = newDF.toJSON().collect()
            resp['data'] = results
        return resp
        

    except  Exception, ex:
        logger.exception('Exception: ' + str(ex))
        return {'status': 'failure'}
        
def teardown():
    pass

def main(args):
    global HDFS_URL
    hdfsPort = ConfigDb.getIntValue('HdfsNameNode', 'fs.defaultFS', 8020, logger=logger)
    HDFS_URL = 'hdfs://127.0.0.1:%d' % hdfsPort
    print 'Talking to HDFS on', HDFS_URL
    kafkaPort = ConfigDb.getIntValue('kafka', 'port', 9092, logger=logger)
    kafkaHostPort = 'localhost:%d' % kafkaPort
    print 'Talking to kafka on', kafkaHostPort
    kafkaClient = SimpleClient(kafkaHostPort)
    kafkaProducer = SimpleProducer(kafkaClient, async=False)
    jsonString = args[1]
    logger.info('The workflow step is ' + jsonString)
    workflowStep = json.loads(jsonString)
    workflowInstanceId = workflowStep['workflowInstanceId']
    print 'The workflow step is ' + str(workflowStep)
    try:
        setup()
        resp = runTransformJoin(workflowStep)
        teardown()
        resp['workflowInstanceId']  = workflowInstanceId
        kafkaProducer.send_messages('workflow', json.dumps(resp))
        logger.info('Completed')
    except  Exception, ex:
        print 'There is exception'
        print ex
        logger.exception('Exception: ' + str(ex))
        resp = {'status': 'failure', 'workflowInstanceId' :workflowInstanceId}
        kafkaProducer.send_messages('workflow', json.dumps(resp))


if __name__ == '__main__':
    try:
        main(sys.argv)
    except KeyboardInterrupt:
        sys.exit(0)
    sys.exit(1)
