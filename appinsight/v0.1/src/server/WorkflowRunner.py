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
from datetime import datetime
import importlib
sys.path.insert(0, '../common')
import ConfigDb
import TenantUtil
import LogUtil
import BottleUtils
import logging
import sys, glob, os, os.path, traceback, imp
import threading
from kafka import SimpleProducer
from kafka.client import KafkaClient as SimpleClient
from kafka import SimpleConsumer
from logging.handlers import TimedRotatingFileHandler
import uuid
import time
import subprocess
import schemaObjects
from insightal_constants import *

kafkaUrl = None # set in main()
workflows = {}
runningWorkflowInstances = {}

BASE_DIR = '/home/appinsight/AppInsight/'

# Get the program name without the directory or extension.
_programName = os.path.splitext(os.path.basename(sys.argv[0]))[0]

# Base the logger name on the program name.
logger = LogUtil.getLogger(_programName)

@hook('after_request')
def enable_cors():
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'OPTIONS, GET, POST'  
    response.headers['Access-Control-Allow-Headers'] = 'Origin, Accept, Content-Type, X-Requested-With, X-CSRF-Token,X-Auth-Header'    
    response.headers['Access-Control-Expose-Headers'] = 'X-Auth-Header'


def runWorkflow(workflowInstanceId):
    try:
        workflowInstance = runningWorkflowInstances[workflowInstanceId]
        workflow = workflowInstance['workflow']
        logger.info('Running a step from workflow: ' + str(workflow))
        workflowSteps = workflow['steps']
        nextStepNumber = workflowInstance['nextStep']
        if len(workflowSteps) > nextStepNumber:
            nextStep = workflowSteps[workflowInstance['nextStep']]
            nextStep['tenantId'] = workflow['tenantId']
            nextStep['workflowName'] = workflow['name']
            nextStep['workflowInstanceId'] = workflowInstanceId
            params = workflowInstance.get('params')
            logger.info('The instance params are ' + str(params))
            nextStepCombined = nextStep.copy()
            if params is not None:
                stepParams = params[nextStepNumber]
                logger.info('The step params are: ' + str(stepParams))
                if stepParams is not None:
                    nextStepCombined.update(stepParams)
            logger.info('The next step is ' + json.dumps(nextStepCombined))
            if nextStep['actionType'] == 'transformJoin':
                subprocess.Popen(['./workflowTransformJoinStepExecutor.sh' , json.dumps(nextStepCombined)])
            elif nextStep['actionType'] == 'deleteFile':
                subprocess.Popen(['python', 'workflowGenericCommandStepExecutor.py', json.dumps(nextStepCombined)])
            elif nextStep['actionType'] == 'createFolder':
                subprocess.Popen(['python', 'workflowGenericCommandStepExecutor.py', json.dumps(nextStepCombined)])
            elif nextStep['actionType'] == 'deleteFolder':
                subprocess.Popen(['python', 'workflowGenericCommandStepExecutor.py', json.dumps(nextStepCombined)])
            elif nextStep['actionType'] == 'executeScript':
                subprocess.Popen(['python', 'workflowGenericCommandStepExecutor.py', json.dumps(nextStepCombined)])
            elif nextStep['actionType'] == 'copyFile':
                subprocess.Popen(['python', 'workflowGenericCommandStepExecutor.py', json.dumps(nextStepCombined)])
            elif nextStep['actionType'] == 'executeSparkScript':
                subprocess.Popen(['./workflowGenericSparkScriptStepExecutor.sh', json.dumps(nextStepCombined)])
        else:
            workflowId = workflow['id']
            schemaObjects.addStateToWorkflowInstance({'workflowId' : workflowId,
                                                         'instanceId' : workflowInstanceId , 'state' : 'complete'})
            del runningWorkflowInstances[workflowInstanceId]
            logger.info('End of workflow instance: ' + workflowInstanceId)
    except Exception, ex:
        logger.exception('Exception while running workflow: ' + str(ex))

        
def  processMessagesFromWorkflowExecutors():
    global kafkaUrl
    try:
        client = SimpleClient(kafkaUrl)
        consumer = SimpleConsumer(client, "my-group", "workflow")
        for message in consumer:
            try:
                logger.info('Message from running workflow step: ' + str(message))
                result = message[1]
                resultJson = result[3]
                resultObj = json.loads(resultJson)
                status= resultObj['status']
                workflowInstanceId = resultObj['workflowInstanceId']
                workflowInstance = runningWorkflowInstances[workflowInstanceId]
                workflowId = workflowInstance['workflow']['id']
                if status == 'success':
                    workflowInstance['nextStep'] += 1
                    schemaObjects.addStateToWorkflowInstance({'workflowId' : workflowId,
                                                              'nextStep' : workflowInstance['nextStep'] ,
                                                              'instanceId' : workflowInstanceId , 'state' : 'process_step'})
                    runWorkflow(workflowInstanceId)
                else:
                    logger.info('Status is not success from running workflow step' + resultJson)
                    schemaObjects.addStateToWorkflowInstance({'workflowId' : workflowId,
                                                              'instanceId' : workflowInstanceId , 'state' : 'failed'})
                    del runningWorkflowInstances[workflowInstanceId]
            except Exception, ex:
                logger.exception('Exception in processing message from workflow executor: ' + str(ex))
                return json.dumps({'result': 'Error in processing message from workflow executors' })
    except Exception, ex:
        logger.exception('Exception in processing message from workflow executor: ' + str(ex))
        return json.dumps({'result': 'Error in processing message from workflow executors' })


@route('/executeWorkflow',method=['OPTIONS','POST'])
def executeWorkflow():
    if request.method == 'OPTIONS':
        return {}
    try:
        req = request.json
        workflowId = req.get('workflowId')
        params = req.get('params')        
        workflow = schemaObjects.getWorkflow({'workflowId' : workflowId })
        if workflow is not None:
            workflowInstance = schemaObjects.createWorkflowInstance({'workflowId' : workflowId, 'params' : params})
            instanceId = workflowInstance[WORKFLOW_INSTANCE_ID]
            runningWorkflowInstances[workflowInstance[WORKFLOW_INSTANCE_ID]] = {'workflow' : workflow, 'nextStep' : 0,
                                                            'instanceId' : instanceId , 'params' : params}
            runWorkflow(instanceId)
            return json.dumps({'result' : 'success', 'workflowInstanceId' : instanceId, 'params' : params })
        else:
            logger.info('No workflow found for workflow Id: ' + workflowId)
            return json.dumps({'result' : 'failure', 'reason' : 'No workflow found for id: ' + workflowId })
    except Exception, ex:
        logger.exception('Exception in executing workflow: ' + str(ex))
        return json.dumps({'result': 'Error in processing workflows' })   
                        
@route('/getWorkflowInstanceStatus',method=['OPTIONS','POST'])
def getWorkflowInstanceStatus():
    if request.method == 'OPTIONS':
        return {}
    try:
        req = request.json
        results = schemaObjects.getWorkflowInstance(req)
        return json.dumps({'status' : 'success' , 'results' : results })
    except Exception, ex:
        logger.exception('Exception in getting workflowinstance status: ' + str(ex))
        return json.dumps({'result': 'Error in getting workflow instance' })  

def main():
    global kafkaUrl
    kafkaHost = ConfigDb.getStringValue('kafka', 'host', 'localhost', logger=logger)
    kafkaPort = ConfigDb.getStringValue('kafka', 'port', '9092', logger=logger)
    kafkaUrl = '%s:%s' % (kafkaHost, kafkaPort)

    # Use the program name as the section name in the config file.
    port = ConfigDb.getIntValue(_programName, 'port', 9507, logger=logger)
    logger.info("WorkflowRunner Listening on port %d" % port)
    schemaObjects.init(logger)
    messageProcessorThread = threading.Thread(target=processMessagesFromWorkflowExecutors)
    messageProcessorThread.daemon=True
    messageProcessorThread.start()
    server = importBottleWebServer(logger)
    bottleThread = threading.Thread(target=run, kwargs=dict(host='0.0.0.0', port=port,debug=True, reloader=False, server=server))
    bottleThread.daemon=True
    bottleThread.start()  
    

if __name__ == '__main__':
    try:
        main()
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        sys.exit(0)
    sys.exit(1)
