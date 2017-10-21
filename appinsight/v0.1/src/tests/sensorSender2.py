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

import requests
import json
import string
import datetime
from random import randint
import time
import os

sensorReceiverURL = 'http://localhost:9502/?channel=d9517f41-6a07-4583-8dda-bc1107412287'

sensors = {\
           's1' : { 'range' : [1,10] },
           's2' : { 'range' : [1,10] }
           }

relations = {\
             's2' : { 's1' : 0.4, 's2' : 0.6 }
             }

while 1:
    sensorValues = {}

    newSensorValues = {}
    for sensorName, sensorRange in sensors.items():
        sensorValues[sensorName] = randint(sensorRange['range'][0], sensorRange['range'][1])
        
    for sensorName, relation in relations.items():
        sensorValue = sensorValues[sensorName]
        multiplier = 0
        print 'The sensorName is ' + sensorName
        print 'The relation is ' + str(relation)
        for factor, weight in relation.items():
            print sensorValues[factor]
            multiplier = multiplier + float(sensorValues[factor])/5*weight
            print 'The multiplier is ' + str(multiplier)
        
        newSensorValue = float(sensors[sensorName]['range'][0] + 
                              sensors[sensorName]['range'][1])/2 * multiplier
        
        print 'The new sensor value is ' + str(newSensorValue)
        newSensorValues[sensorName] = float("{0:.2f}".format(newSensorValue) )
    
    
    print sensorValues
    print newSensorValues
    sensorValues.update(newSensorValues)
    
    epoch = datetime.datetime.utcfromtimestamp(0)
    currDateTime = datetime.datetime.utcnow()
    delta = currDateTime - epoch
    timeOfMeasurement = delta.total_seconds()
    
    sensorData = {}
    sensorData['sensorId'] = '440cafeb-e0ee-44b2-a7a9-4412dfc06b85'
    sensorData['timeOfMeasurement'] = timeOfMeasurement
    sensorData['measurementValue'] = sensorValues['s1']
    headers = {'content-type' : 'application/json' }
    r = requests.post(sensorReceiverURL, data= json.dumps(sensorData), headers=headers)

    sensorData = {}
    sensorData['sensorId'] = '440cafeb-e0ee-44b2-a7a9-4412dfc06b85'
    sensorData['timeOfMeasurement'] = timeOfMeasurement
    sensorData['measurementValue'] = sensorValues['s2']
    headers = {'content-type' : 'application/json' }
    r = requests.post(sensorReceiverURL, data= json.dumps(sensorData), headers=headers)
    time.sleep(3)
