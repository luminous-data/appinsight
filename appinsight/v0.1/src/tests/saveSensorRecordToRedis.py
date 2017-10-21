import uuid, json
import redis

sensorId = str(uuid.uuid4())
sensorRecord = { sensorId : sensorId, 'collectionIds' : ['10773be7-487c-4b1c-82a1-df5c108e3572'],\
                             'sensorName' : 'cpu-10', 'desc':'a cpu',\
                             'containerId' : '', 'sensorClass' : 'cpu' , \
                             'measurement' : 'idle time', 'measurementType' : 'raw', 
                             'unit' : 'percentage' }

redisConn = redis.StrictRedis(host='localhost', port=6379, db=0)

redisConn.set('sensors.' + sensorId, json.dumps(sensorRecord ) )

print sensorId
