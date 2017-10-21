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


# coding: utf-8

# In[ ]:

import requests, logging, datetime, time, json, string, random

url = 'http://localhost:9501/?channel=bf785777-27a9-4c19-b653-d52453d8c0f0'
headers = {'content-type' : 'application/json' }

while 1:
    statuses = ['INFO' , 'ERROR' , 'WARNING']
    status = random.choice(statuses)
    logRecord = { 'docType' : 'test1', 'status' : status, 'value': 20}
    logRecordJSON = json.dumps(logRecord)

    r = requests.post(url, data=logRecordJSON, headers=headers)
    time.sleep(1)

