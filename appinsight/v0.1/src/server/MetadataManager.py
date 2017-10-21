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
from logging.handlers import TimedRotatingFileHandler
import uuid
import pymongo
import string
import schemaObjects

HDFS_BASE_DIR='/insightal/tenants/'

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

@route('/addSensor',method=['OPTIONS','POST'])
def addSensor():
    if request.method == 'OPTIONS':
        return {}
    try:
        req = request.json
        result = schemaObjects.createSensor(req)
        return json.dumps(result)
    except Exception, ex:
        logger.exception('Exception in creating sensor: ' + str(ex))
        return json.dumps({'status' : 'error'})

@route('/getSensors',method=['OPTIONS','POST'])
def getSensors():
    if request.method == 'OPTIONS':
        return {}
    try:
        req = request.json
        result = schemaObjects.getSensors(req)
        return json.dumps({'status' : 'success' , 'results' : results })
    except Exception, ex:
        logger.exception('Exception in getting sensors: ' + str(ex))
        return json.dumps({'status' : 'error'})
                          
@route('/addWorkflow',method=['OPTIONS','POST'])
def addWorkflow():
    if request.method == 'OPTIONS':
        return {}
    try:
        workflowDef = request.json
        workflowDef = schemaObjects.createWorkflow(workflowDef)
        return json.dumps(workflowDef)
    except Exception, ex:
        logger.exception('Exception in adding workflow: ' + str(ex))
        return json.dumps({'result': 'Error in adding workflow' })

@route('/updateWorkflow',method=['OPTIONS','POST'])
def updateWorkflow():
    if request.method == 'OPTIONS':
        return {}
    try:
        workflowDef = request.json
        workflowDef = schemaObjects.updateWorkflow(workflowDef)
        return json.dumps(workflowDef)
    except Exception, ex:
        logger.exception('Exception in updating workflow: ' + str(ex))
        return json.dumps({'result': 'Error in updating workflow' })

@route('/getWorkflows',method=['OPTIONS','POST'])
def getWorkflows():
    if request.method == 'OPTIONS':
        return {}
    try:
        req = request.json
        workflows = schemaObjects.getWorkflows(req)
        return json.dumps(workflows)
    except Exception, ex:
        logger.exception('Exception in getting workflows: ' + str(ex))
        return json.dumps({'result': 'Error in getting workflow' })

@route('/getWorkflowInstancesForWorkflow',method=['OPTIONS','POST'])
def getWorkflowInstancesForWorkflow():
    if request.method == 'OPTIONS':
        return {}
    try:
        req = request.json
        workflows = schemaObjects.getWorkflowInstancesForWorkflow(req)
        return json.dumps(workflows)
    except Exception, ex:
        logger.exception('Exception in getting workflows: ' + str(ex))
        return json.dumps({'result': 'Error in getting workflow' })

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
    
@route('/createDataset',method=['OPTIONS','POST'])
def createDataset():
    if request.method == 'OPTIONS':
        return {}
    try:
        datasetDef = request.json
        datasetDef = schemaObjects.createDataset(datasetDef)
        return json.dumps(datasetDef)
    except Exception, ex:
        logger.exception('Exception in creating dataset: ' + str(ex))
        return json.dumps({'result': 'Error in adding datasetDef' })
        
@route('/updateDataset',method=['OPTIONS','POST'])
def updateDataset():
    if request.method == 'OPTIONS':
        return {}
    try:
        datasetDef = request.json
        datasetDef = schemaObjects.updateDataset(datasetDef)
        return json.dumps({'result' : 'success', 'dataset' : datasetDef })
    except Exception, ex:
        logger.exception('Exception in updating dataset: ' + str(ex))
        return json.dumps({'result': 'Error in updating datasetDef' })

@route('/addToDataset',method=['OPTIONS','POST'])
def addToDataset():
    if request.method == 'OPTIONS':
        return {}
    try:
        datasetDef = request.json
        datasetDef = schemaObjects.addToDataset(datasetDef)
        return json.dumps({'result' : 'success', 'dataset' : datasetDef })
    except Exception, ex:
        logger.exception('Exception in adding to dataset: ' + str(ex))
        return json.dumps({'result': 'Error in adding to datasetDef' })


@route('/getDatasets',method=['OPTIONS','POST'])
def getDatasets():
    if request.method == 'OPTIONS':
        return {}
    try:
        datasetReq = request.json
        results = schemaObjects.getDataSets(datasetReq)
        return json.dumps({'status' : 'success' , 'results' : results })
    except Exception, ex:
        logger.exception('Exception in getting datasets: ' + str(ex))
        return json.dumps({'result': 'Error in getting datasetDef' })




@route('/deleteSchema',method=['OPTIONS','POST'])
def deleteSchema():
    if request.method == 'OPTIONS':
        return {}
    try:
        req = request.json
        results = schemaObjects.deleteSchema(req)
        return json.dumps({'status' : 'success' , 'results' : results })
    except Exception, ex:
        logger.exception('Exception in deleting schema: ' + str(ex))
        return json.dumps({'result': 'Error in deleting schema' })

        
def main():
    # Use the program name as the section name in the config file.
    port = ConfigDb.getIntValue(_programName, 'port', 9503, logger=logger)
    logger.info("MetadataManager Listening on port %d" % port)
    print 'calling schemaObjects'
    schemaObjects.init(logger)
    server = importBottleWebServer(logger)
    run(host='0.0.0.0', port=port, debug=True, reloader=False, server=server)

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
    sys.exit(1)
