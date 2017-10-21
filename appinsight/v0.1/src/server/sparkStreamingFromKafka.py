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
from datetime import datetime
import sys

INTERVAL_IN_SECONDS=3

CASSANDRA_KEYSPACE="training"
CASSANDRA_TABLE = "metric_test2"
CASSANDRA_SAVE_MODE = "append"

KAFKA_TOPIC = 'test'
KAFKA_URL = "127.0.0.1:2181"
KAFKA_CONSUMER_GROUP_ID = "raw_events"

sc = SparkContext('local[2]', 'jointest')
ssc = StreamingContext(sc, INTERVAL_IN_SECONDS)


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
        df.write.format("org.apache.spark.sql.cassandra")\
                                                          .options(keyspace=CASSANDRA_KEYSPACE, table=CASSANDRA_TABLE)\
                                                          .save(mode=CASSANDRA_SAVE_MODE)
    
kafkaStream = KafkaUtils.createStream(ssc, KAFKA_URL, KAFKA_CONSUMER_GROUP_ID, {KAFKA_TOPIC: 1})

raw = kafkaStream.flatMap(lambda kafkaS: [kafkaS])
raw.pprint()

clean = raw.map(lambda line: line[1])
clean.pprint()
clean.foreachRDD(process)

ssc.start()             # Start the computation
ssc.awaitTermination()  # Wait for the computation to terminate

                   
