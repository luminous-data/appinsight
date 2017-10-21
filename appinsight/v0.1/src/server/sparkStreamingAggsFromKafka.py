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

'''
~/spark151/spark-1.5.1-bin-hadoop2.6/bin/spark-submit --packages org.apache.spark:spark-streaming-kafka_2.10:1.5.0,com.datastax.spark:spark-cassandra-connector_2.10:1.5.0-M3 --conf spark.cassandra.connection.host=127.0.0.1 sparkStreamingFromKafka.py
'''
from pyspark.sql import *
from pyspark.sql.types import *

from pyspark import  SparkContext
from pyspark import SparkConf
from pyspark.streaming import StreamingContext
from pyspark.streaming.kafka import KafkaUtils
import ConfigDb
from datetime import datetime
import sys

INTERVAL_IN_SECONDS=15
SPARK_TEMP_TABLE_SENSOR_DATA = 'sensorData'
CASSANDRA_KEYSPACE="training"
CASSANDRA_TABLE = "metric_test2agg15secs"
CASSANDRA_SAVE_MODE = "append"

KAFKA_TOPIC = 'test'
DEFAULT_ZOOKEEPER_HOST="127.0.0.1"
DEFAULT_ZOOKEEPER_PORT="2181"
sc = SparkContext('local[2]', 'jointest')
ssc = StreamingContext(sc, INTERVAL_IN_SECONDS)

KAFKA_CONSUMER_GROUP_ID = 'aggs_15_secs'

sqlString = 'SELECT sensor_name, id, date, min(measurement_value) as min, ' + \
            ' max(measurement_value) as max,' + \
            ' avg(measurement_value) as avg, max(measurement_time) as measurement_time ' +\
            ' FROM sensorData ' + \
            ' GROUP BY sensor_name, id, date'

def getSqlContextInstance(sparkContext):
    if ('sqlContextSingletonInstance' not in globals()):
        globals()['sqlContextSingletonInstance'] = SQLContext(sparkContext)
    return globals()['sqlContextSingletonInstance']

def process(time, rdd):
    if rdd.isEmpty():
        pass
    else:
        sqlContext = getSqlContextInstance(rdd.context)        
        df = sqlContext.jsonRDD(rdd)
        df.show()
        df.registerTempTable(SPARK_TEMP_TABLE_SENSOR_DATA)
        aggregatedDF = sqlContext.sql(sqlString)
        aggregatedDF.show()
        aggregatedDF.write.format("org.apache.spark.sql.cassandra").options(keyspace=CASSANDRA_KEYSPACE, \
                                                                  table=CASSANDRA_TABLE).save(mode=CASSANDRA_SAVE_MODE)
        
kafkaHost = ConfigDb.getStringValue('zookeeper', 'host', DEFAULT_ZOOKEEPER_HOST)
kafkaPort = ConfigDb.getStringValue('zookeeper', 'port', DEFAULT_ZOOKEEPER_PORT)
kafkaUrl = "%s:%s" % (kafkaHost, kafkaPort)
kafkaStream = KafkaUtils.createStream(ssc, kafkaUrl, KAFKA_CONSUMER_GROUP_ID, {KAFKA_TOPIC: 1})

raw = kafkaStream.flatMap(lambda kafkaS: [kafkaS])
raw.pprint()

clean = raw.map(lambda line: line[1])
clean.pprint()
clean.foreachRDD(process)

ssc.start() 
ssc.awaitTermination()
