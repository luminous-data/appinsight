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
import random
import time

sensorReceiverURL = 'http://localhost:9502/?channel=10773be7-487c-4b1c-82a1-df5c108e3572'

while 1:
    epoch = datetime.datetime.utcfromtimestamp(0)
    currDateTime = datetime.datetime.utcnow()
    delta = currDateTime - epoch
    timeOfMeasurement = delta.total_seconds()
    sensorData = {}
    sensorData['sensorId'] = 'a7888e75-458d-4c18-b29e-c0a40c852b48'
    sensorData['timeOfMeasurement'] = timeOfMeasurement
    sensorData['measurementValue'] = random.randint(1,20)
    headers = {'content-type' : 'application/json' }
    r = requests.post(sensorReceiverURL, data= json.dumps(sensorData), headers=headers)
    time.sleep(3)
