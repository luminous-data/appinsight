#!/usr/bin/env python

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

# This reads data from redis and writes it to an HTTP server

import sys
import sqlite3
import glob
import os.path
import LogUtil
import TenantUtil
import string
import requests
import json
import ConfigDb

logger = None

REDIS_HOST = None # set in main()
REDIS_HOST = None # set in main()

HTTP_SERVER = 'http://192.168.2.40:9999'
HEADERS = {'Content-type':'application/json'}
# Database file.
# TODO: make this definition common.
try:
    homeDir = os.environ['HOME']
except KeyError:
    homeDir = '.'
_DatabasePath = os.path.join(homeDir, 'AppSenseDB.sqlite')


# Look for non-standard Python packages in either ../../vendor or the standard
# Python library location.
for pattern in ('../../vendor/redis-py-master*/redis',
                '../../vendor/six-*/six.py',
                '../../vendor/*-requests-*/requests',
                '../../vendor/simplejson-*/simplejson'):
    pkgDirs = glob.glob(pattern)
    if pkgDirs:
        sys.path.insert(0, os.path.dirname(pkgDirs[0]))

try:
    import redis, six, requests, simplejson
except ImportError, ex:
    print "Can't find module:", ex
    print "Search path:", sys.path
    sys.exit(1)

redisConn = None  # connection to redis

# Connects to a redis database.
# return: True on success
def connectToRedis():
    global redisConn
    try:
        redisConn = redis.StrictRedis(host=REDIS_HOST, port=REDIS_PORT, db=0)
    except Exception, ex:
        logger.error("Can't connect to redis: %s" % ex)
        return False
    # TODO: see if this really means that the connection worked.
    logger.info('Connected to redis')
    return True


# Top-level routine.
def main():
    global logger, REDIS_HOST, REDIS_PORT
    logger = LogUtil.getLogger('LogIndexer')
    logger.info('Starting')
    REDIS_HOST = ConfigDb.getStringValue('redis', 'host', 'localhost', logger=logger)
    REDIS_HOST = ConfigDb.getIntValue('redis', 'port', 6379, logger=logger)
    if not connectToRedis():
        sys.exit(1)

    logger.info('Subscribing to redis channel ' + 'insightal.inputevents.*')

    # Subscribe to specific redis channels.
    pubSub = redisConn.pubsub()
    pubSub.psubscribe('insightal.inputevents.*')

    # Read from redis and send to HTTP.
    for item in pubSub.listen():
        try:
            if item['type'] == 'pmessage':
                print 'Sending item ' + str(item)
                HTTPItem = {'headers' : {}, 'body' : str(item)}
                resp = requests.post(HTTP_SERVER + '/postevents', data=json.dumps([HTTPItem]), headers = HEADERS )
        except KeyError:
            pass

# Main-line code starts here.
if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
    sys.exit(1)
