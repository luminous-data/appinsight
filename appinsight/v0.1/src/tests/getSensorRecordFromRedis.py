import uuid, json
import redis
redisConn = redis.StrictRedis(host='localhost', port=6379, db=0)
record = redisConn.get('sensors.' + '66c03b27-1044-4ca7-bd70-de5c23381b95' )

print record
