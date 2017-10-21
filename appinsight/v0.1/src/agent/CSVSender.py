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

import csv, sys, json, requests

docType = 'person'
url = 'http://192.168.2.31:9501/?channel=8961ff9f-452e-4511-a022-c15878321499'

#EDIT THIS LIST WITH YOUR REQUIRED JSON KEY NAMES
fieldnames=["firstname","lastname","age"]

def convert(filename):
    csv_filename = filename[0]
    print "Opening CSV file: ",csv_filename
    f=open(csv_filename, 'r')
    csv_reader = csv.DictReader(f,fieldnames)
    for r in csv_reader:
        r['docType'] = docType
        jsonRecord = json.dumps(r)
        print jsonRecord
        headers = {'content-type' : 'application/json' }
        req = requests.post(url, data=jsonRecord, headers=headers)

    f.close()


if __name__=="__main__":
    convert(sys.argv[1:])
