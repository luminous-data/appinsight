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
import time
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
from kafka.common import KafkaError
from logging.handlers import TimedRotatingFileHandler
import uuid
import schemaObjects
from insightal_constants import *

# Get the program name without the directory or extension.
_programName = os.path.splitext(os.path.basename(sys.argv[0]))[0]

# Base the logger name on the program name.
logger = LogUtil.getLogger(_programName)

KAFKA_TOPIC = 'test'
kafkaHost = ConfigDb.getStringValue('kafka', 'host', 'localhost', logger=logger)
kafkaPort = ConfigDb.getStringValue('kafka', 'port', '9092', logger=logger)
KAFKA_URL = '%s:%s' % (kafkaHost, kafkaPort)
SENSOR_MEASUREMENT_PORT=9502

# Try the Kafka server several times in case it's still starting up.
connectionTryLimit = 60
for count in range(connectionTryLimit):
    try:
        if count != 0: time.sleep(2)
        kafkaClient = SimpleClient(KAFKA_URL)
        print 'Connected to Kafka'
        break
    except KafkaError, ex:
        print 'Cannot connect to kafka:', ex
        if count == connectionTryLimit - 1:
            raise # give up

kafkaProducer = SimpleProducer(kafkaClient, async=False)


# Base the logger name on the program name.
logger = LogUtil.getLogger(_programName)

sensors = {}

@hook('after_request')
def enable_cors():
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'OPTIONS, GET, POST'  
    response.headers['Access-Control-Allow-Headers'] = 'Origin, Accept, Content-Type, X-Requested-With, X-CSRF-Token,X-Auth-Header'    
    response.headers['Access-Control-Expose-Headers'] = 'X-Auth-Header'

'''
Gets the sensor data and puts it on kafka.
Params include channel which is the collectionId and sensorId apart from sensor attributes
and measurement.
'''
@route('/',method=['OPTIONS','POST'])
def root():
    try:
        record = request.json
    except Exception, ex:
        logger.error('invalid JSON input: ' + str(ex))
        return {'result' : 'error, invalid JSON input: ' + str(ex)}
    if not record:
        logger.error('invalid input, check content-type')
        return {'result' : 'invalid input, check content-type'}

    # Get the channel from the "channel" query parameter.
    channel = request.query.channel
    if not channel:
        channel = record.get('channel')
        # If there's no "channel" query parameter, look for the channel in the data.
        if not channel:
            channel = fields.get('channel')
            if not channel:
                _logger.error('cannot find "channel" in query parameters or request body')
                return {'result' : 'error, missing "channel" query parameter'}
    logger.info('The channel is ' + channel)

    sensorId = record.get('sensorId')
    if not sensorId:
        logger.error('missing "sensorId" parameter')
        return {'result' : 'error, missing "sensorId" parameter'}

    try:
        query = {SENSOR_ID: sensorId}
        sensorDetailsCursor = schemaObjects.getSensors(query)
        sensorDetails = None
        for sensor in sensorDetailsCursor:
            sensorDetails = sensor
        
        sensorName = sensorDetails[SENSOR_NAME]
        measurementAttribute = sensorDetails[MEASUREMENT]
        
        timeOfMeasurement = record['timeOfMeasurement']
        dateTimeOfMeasurement = datetime.utcfromtimestamp(timeOfMeasurement)
        dateTimeOfMeasurement = dateTimeOfMeasurement.replace(microsecond=0)
        dateOfMeasurement = dateTimeOfMeasurement.date()
        measurementValue = record['measurementValue']
        data = {'sensor_name' : sensorName + '--|--' + measurementAttribute , 'id' : sensorId , 'date' : str(dateOfMeasurement), \
                'measurement_time' : str(dateTimeOfMeasurement), 'measurement_value' : measurementValue }
        logger.info('Inserting into Kafka ' + json.dumps(data))
        kafkaProducer.send_messages(KAFKA_TOPIC, json.dumps(data))
    except Exception, ex:
        logger.exception('error in processing' +  str(ex))
        return {'result': 'error, : ' + str(ex) }


def main():
    # Use the program name as the section name in the config file.
    schemaObjects.init(logger)
    # Use the program name as the component name in the config database.
    port = ConfigDb.getIntValue(_programName, 'port', SENSOR_MEASUREMENT_PORT, logger=logger)
    logger.info("Listening on port %d" % port)
    server = importBottleWebServer(logger)

    run(host='0.0.0.0', port=port, debug=True, reloader=True, server=server)


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
    sys.exit(1)
