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
import aniso8601
import schemaObjects
import CassandraConnector

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

@route('/getSensorData',method=['OPTIONS','POST'])
def getSensorData():
    if request.method == 'OPTIONS':
        return {}
    try:
        req = request.json
        result = CassandraConnector.getSensorData(req)
        return json.dumps(result)
    except Exception, ex:
        logger.exception('error in processing' +  str(ex))
        return json.dumps({'result': 'error, in getting sensor data: ' + str(ex) })

@route('/getAggregatedSensorData',method=['OPTIONS','POST'])
def getAggregatedSensorData():
    if request.method == 'OPTIONS':
        return {}
    try:
        req = request.json
        result = CassandraConnector.getAggregatedSensorData(req)
        return json.dumps(result)
    except Exception, ex:
        logger.exception('error in processing' +  str(ex))
        return json.dumps({'result': 'error, : ' + str(ex) })
  
def main():
    CassandraConnector.getCassandraConn(logger)
    port = ConfigDb.getIntValue(_programName, 'port', 9504, logger=logger)
    logger.info("Listening on port %d" % port)
    server = importBottleWebServer(logger)
    run(host='0.0.0.0', port=port, debug=True, reloader=True, server=server)

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
    sys.exit(1)
