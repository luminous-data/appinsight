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

import json, redis
import sys, traceback
import datetime
import logging, os
from logging.handlers import TimedRotatingFileHandler
import uuid
import pickle
import requests
import string
import LogUtil
from kafka import SimpleProducer
from kafka.client import KafkaClient as SimpleClient
sys.path.insert(0, '../common')
import ConfigDb

logger = None # set in main()
kafkaProducer = None # set in main()

redisConn = None  # connection to redis

# Connects to a redis database.
# return: True on success
def connectToRedis():
    global redisConn
    # Get the redis host and port from the config file.
    redisHost = ConfigDb.getStringValue('redis', 'host', 'localhost', logger=logger)
    redisPort = ConfigDb.getIntValue('redis', 'port', 6379, logger=logger)
    logger.info("Connecting to redis at %s:%d" % (redisHost, redisPort))
    try:
        redisConn = redis.StrictRedis(host=redisHost, port=redisPort, db=0)
    except Exception, ex:
        logger.error("Can't connect to redis: %s" % ex)
        return False
    # TODO: see if this really means that the connection worked.
    logger.info('Connected to redis')
    return True

def sendToKafka():
    global logger, kafkaProducer

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
               
                kafkaProducer.send_messages('test', json.dumps(item))
                '''
                HTTPItem = {'headers' : {}, 'body' : str(item)}
                resp = requests.post(HTTP_SERVER + '/postevents', data=json.dumps([HTTPItem]), headers = HEADERS )
                '''
        except KeyError:
            pass


def main():
    global logger, kafkaUrl, kafkaProducer
    logger = LogUtil.getLogger('RedisToKafkaBridge')
    logger.info('Starting')

    kafkaHost = ConfigDb.getStringValue('kafka', 'host', 'localhost', logger=logger)
    kafkaPort = ConfigDb.getStringValue('kafka', 'port', '9092', logger=logger)
    kafkaUrl = '%s:%s' % (kafkaHost, kafkaPort)
    kafkaClient = SimpleClient(kafkaUrl)
    kafkaProducer = SimpleProducer(kafkaClient, async=False)

    sendToKafka()

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
    sys.exit(1)
