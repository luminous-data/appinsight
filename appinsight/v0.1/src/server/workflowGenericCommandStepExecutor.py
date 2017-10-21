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


import os
import sys, traceback
import datetime, time
import string
import logging
from logging.handlers import TimedRotatingFileHandler
sys.path.insert(0, '../common')
import LogUtil
import ConfigDb
import json
from kafka import SimpleProducer
from kafka.client import KafkaClient as SimpleClient

import schemaObjects
import commonSQL
import imp, os
from importlib import import_module
import subprocess

# Get the program name without the directory or extension.
_programName = 'workflowGenericCommandStepExecutor'

# Base the logger name on the program name.
logger = LogUtil.getLogger(_programName)


BASE_DIR='/insightal/tenants/'
    
def setup():
    schemaObjects.init(logger)

def run(req):
    try:
        retValue = {}
        command = req.get('actionType')
        if command == 'createFolder':
            retValue = schemaObjects.createFolder(req)
        elif command == 'copyFile':
            retValue = schemaObjects.copyFile(req)
        elif command == 'deleteFolder':
            retValue = schemaObjects.deleteFolder(req)
        elif command == 'deleteFile':
            retValue = schemaObjects.deleteFile(req)
        elif command == 'executeScript':
            retValue = executeScript(req)
        logger.info('Returning from run in workflowGenericCommandStepExecutor: ' + str(retValue))
        return retValue
    except Exception, ex:
        logger.exception('exception in running command folder: ' + str(ex))
        raise

        
def executeScript(req):
    try:
        req['filePath'] = req['scriptPath']
        fileContents = schemaObjects.getFile(req)
        params = req.get('params')
        moduleName = os.path.basename(os.path.splitext(req['scriptPath'])[0])
        pluginModule = imp.new_module(moduleName)
        exec fileContents in pluginModule.__dict__
        response = pluginModule.execute(params, logger, None, None)
        if response is None:
            return {}
        return response
    except Exception, ex:
        print 'There is exception'
        print ex
        logger.exception('Exception in executing script ' + str(ex))
        raise

def teardown():
    pass

def main(args):
    kafkaHost = ConfigDb.getStringValue('kafka', 'host', 'localhost', logger=logger)
    kafkaPort = ConfigDb.getStringValue('kafka', 'port', '9092', logger=logger)
    kafkaUrl = '%s:%s' % (kafkaHost, kafkaPort)
    kafkaClient = SimpleClient(kafkaUrl)
    kafkaProducer = SimpleProducer(kafkaClient, async=False)
    jsonString = args[1]
    logger.info('Running workflowGenericCommandStepExecutor main')
    logger.info('The workflow step is ' + jsonString)
    workflowStep = json.loads(jsonString)
    workflowInstanceId = workflowStep['workflowInstanceId']
    
    try:
        setup()
        resp = run(workflowStep)
        teardown()
        resp['status'] = 'success' 
        resp['workflowInstanceId']  = workflowInstanceId
        kafkaProducer.send_messages('workflow', json.dumps(resp))
        logger.info('workflowGenericCommandStepExecutor successful' + json.dumps(resp))
    except  Exception, ex:
        logger.exception('Exception: ' + str(ex))
        resp = {'status': 'failure', 'workflowInstanceId' :workflowInstanceId}
        kafkaProducer.send_messages('workflow', json.dumps(resp))
        logger.info('workflowGenericCommandStepExecutor failure' + json.dumps(resp))

        
if __name__ == '__main__':
    try:
        main(sys.argv)
    except KeyboardInterrupt:
        sys.exit(0)
    sys.exit(1)
