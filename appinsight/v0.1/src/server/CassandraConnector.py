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
from cassandra.cluster import Cluster
import schemaObjects
from insightal_constants import *

cassandraSession = None

def getCassandraConn(logger):
    global cassandraSession
    try:
        cassandraHost = ConfigDb.getStringValue('cassandra', 'host', 'localhost', logger=logger)
        cassandraPort = ConfigDb.getIntValue('cassandra', 'port', 9042, logger=logger)
        # See https://datastax.github.io/python-driver/api/cassandra/cluster.html
        cluster = Cluster([cassandraHost], port=cassandraPort)
        cassandraSession = cluster.connect('training')
    except Exception, ex:
        logger.exception('Exception in getting cassandra connection: ' + str(ex))

def getSensorData(req):
    global cassandraSession
    CASSANDRA_QUERY = "SELECT sensor_name, date, id, measurement_time, " + \
                      "measurement_value FROM metric_test2 where "
    req = request.json
    sensorId = req.get('sensorId')
    startDateTimeStr = req.get('startDateTime')
    endDateTimeStr = req.get('endDateTime')
    startDateTime = aniso8601.parse_datetime(startDateTimeStr)
    startDate = startDateTime.strftime('%Y-%m-%d')
    startDateTime = startDateTime.strftime('%Y-%m-%d %H:%M:%S')
    endDateTime = aniso8601.parse_datetime(endDateTimeStr)
    endDateTime = endDateTime.strftime('%Y-%m-%d %H:%M:%S')
    query = {SENSOR_ID: sensorId}
    sensors = schemaObjects.getSensors(query)
    sensorDetails = None
    for sensor in sensors:
        sensorDetails = sensor
    
    sensorName = sensorDetails['sensorName']
    measurement = sensorDetails['measurement']
    CASSANDRA_QUERY += " sensor_name = '" + sensorName + "--|--" + measurement + "'"
    CASSANDRA_QUERY += " AND date = '" + startDate + "'"
    CASSANDRA_QUERY += " AND id = '" + sensorId + "'"
    CASSANDRA_QUERY += " AND measurement_time > '" + str(startDateTime) + "'"
    CASSANDRA_QUERY += " AND measurement_time < '" + str(endDateTime) + "'"
    print CASSANDRA_QUERY
    
    resultSet = cassandraSession.execute(CASSANDRA_QUERY)
    datapoints = []
    
    for datapoint in resultSet:
        sensorName = datapoint.sensor_name
        sensorId = datapoint.id
        sensorDate = datapoint.date
        sensorMeasurementTime = datapoint.measurement_time
        sensorMeasurementTime = sensorMeasurementTime.isoformat()
        sensorValue = datapoint.measurement_value
        datapoints.append([sensorMeasurementTime, sensorValue])
    sensorData = { 'sensorId' : sensorId, 'sensorName' : sensorName, 'datapoints' : datapoints }
    result = { 'status' : 'success', 'sensorData' : sensorData }
    return result


def getAggregatedSensorData(req):
    global cassandraSession
    
    CASSANDRA_QUERY = "SELECT sensor_name, date, id, measurement_time, " + \
                      "min, max, avg FROM metric_test2Agg15Secs where "
    req = request.json
    sensorId = req.get('sensorId')
    startDateTimeStr = req.get('startDateTime')
    endDateTimeStr = req.get('endDateTime')
    startDateTime = aniso8601.parse_datetime(startDateTimeStr)
    startDate = startDateTime.strftime('%Y-%m-%d')
    startDateTime = startDateTime.strftime('%Y-%m-%d %H:%M:%S')
    endDateTime = aniso8601.parse_datetime(endDateTimeStr)
    endDateTime = endDateTime.strftime('%Y-%m-%d %H:%M:%S')
    query = {SENSOR_ID: sensorId}
    sensors = schemaObjects.getSensors(query)
    sensorDetails = None
    for sensor in sensors:
        sensorDetails = sensor
    
    sensorName = sensorDetails['sensorName']
    measurement = sensorDetails['measurement']
    CASSANDRA_QUERY += " sensor_name = '" + sensorName + "--|--" + measurement + "'"
    CASSANDRA_QUERY += " AND date = '" + startDate + "'"
    CASSANDRA_QUERY += " AND id = '" + sensorId + "'"
    CASSANDRA_QUERY += " AND measurement_time > '" + str(startDateTime) + "'"
    CASSANDRA_QUERY += " AND measurement_time < '" + str(endDateTime) + "'"
    print CASSANDRA_QUERY
    
    resultSet = cassandraSession.execute(CASSANDRA_QUERY)
    datapoints = []
    
    for datapoint in resultSet:
        sensorName = datapoint.sensor_name
        sensorId = datapoint.id
        sensorDate = datapoint.date
        sensorMeasurementTime = datapoint.measurement_time
        sensorMeasurementTime = sensorMeasurementTime.isoformat()
        minValue = datapoint.min
        maxValue = datapoint.max
        avgValue = datapoint.avg
        datapoints.append([sensorMeasurementTime, minValue, maxValue, avgValue])
    sensorData = { 'sensorId' : sensorId, 'sensorName' : sensorName, 'datapoints' : datapoints }
    result = { 'status' : 'success', 'sensorData' : sensorData }
    return result

