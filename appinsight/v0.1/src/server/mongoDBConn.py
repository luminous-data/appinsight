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

import pymongo
from insightal_constants import *

mongoDBConn = None

def getMongoDBConnection(logger):
    global mongoDBConn
    try:
        mongoDBConn = pymongo.MongoClient(j=True)
    except Exception, ex:
        print 'Exception in getting connection to mongo'
        logger.exception('Exception: ' + str(ex))


def find_one(schema, query):
    schemaPtr = getSchemaPtr(schema)
    results = schemaPtr.find_one(query)
    return results

def find(schema, query):
    schemaPtr = getSchemaPtr(schema)
    results = None
    if query is not None:
        results = schemaPtr.find(query)
    else:
        results = schemaPtr.find()
    return results


def insert_one(schema, record):
    schemaPtr = getSchemaPtr(schema)
    schemaPtr.insert_one(record)

    
def update_many(schema, record):
    schemaPtr = getSchemaPtr(schema)
    schemaPtr.update_many(record[0], record[1])

def update_one(schema, record):
    schemaPtr = getSchemaPtr(schema)
    schemaPtr.update_one(record[0], record[1])
    
def delete_many(schema, record):
    schemaPtr = getSchemaPtr(schema)
    schemaPtr.delete_many(record)

def deleteAll(schema):
    schemaPtr = getSchemaPtr(schema)
    schemaPtr.remove( { } )
    
def getSchemaPtr(schema):
    global mongoDBConn
    appinsightDB = mongoDBConn.appinsight
    schemaPtr = None
    if schema == FILE_SYSTEM:
        schemaPtr = appinsightDB.fileSystem
    elif schema == SENSORS:
        schemaPtr = appinsightDB.sensors
    elif schema == WORKFLOWS:
        schemaPtr = appinsightDB.workflows
    elif schema == WORKFLOW_INSTANCES:
        schemaPtr = appinsightDB.workflowInstances
    elif schema == DATASETS:
        schemaPtr = appinsightDB.datasets
    
        
    return schemaPtr
