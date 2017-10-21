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
import os, imp
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
import schemaObjects 
import commonSQL

BASE_DIR = '/home/appinsight/AppInsight/'

MASTER='local'
APPNAME='workflowStepExecutor'

# Get the program name without the directory or extension.
_programName = 'WorkflowGenericSparkStepExecutor'

# Base the logger name on the program name.
logger = LogUtil.getLogger(_programName)

sc = None
sqlContext = None

def setup():
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
        logger.exception('Exception in setup of workflowGenericSparkStepExecutor: ' + str(ex))


def getTempTables(sc, sqlContext, tenantId, tableNames):
    return schemaObjects.getDataFramesFromSpark(sc, sqlContext, tenantId, tableNames)


def executeScript(req):
    global sc, sqlContext
    try:
        req['filePath'] = req['scriptPath']
        fileContents = schemaObjects.getFile(req)
        moduleName = os.path.basename(os.path.splitext(req['scriptPath'])[0])
        pluginModule = imp.new_module(moduleName)
        exec fileContents in pluginModule.__dict__
        response = pluginModule.execute(req, logger, sc, sqlContext)
        if response is None:
            response = {}
        return response
    except  Exception, ex:
        logger.exception('Exception: ' + str(ex))
        return {'status': 'failure'}
        
def teardown():
    pass
    
def main(args):
    kafkaClient = SimpleClient('localhost:9092')
    kafkaProducer = SimpleProducer(kafkaClient, async=False)
    jsonString = args[1]
    logger.info('The workflow step is ' + jsonString)
    workflowStep = json.loads(jsonString)
    workflowInstanceId = workflowStep['workflowInstanceId']
    print 'The workflow step is ' + str(workflowStep)
    try:
        setup()
        resp = executeScript(workflowStep)
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
