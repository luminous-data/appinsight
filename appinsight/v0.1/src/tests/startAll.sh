#Start ElasticSearch
#nohup /home/appinsight/elasticsearch/202/elasticsearch-0.20.2/bin/elasticsearch -f > myes.log &
#Start Redis
#nohup /home/gmulchan/redis/26/redis-2.6.9/src/redis-server > myred.log &
#set redis channel
#src/redis-cli
#subscribe chan1

#start logstash
#cd /home/gmulchan/logstash

nohup java -jar /home/appinsight/work/appinsight/appinsight/v0.1/src/agent/logstash-1.1.9-monolithic.jar agent -f /home/appin
sight/work/appinsight/appinsight/v0.1/src/agent/logStashToLogCollectorService.conf > myagent.log &

# Start Log Writer /tmp/access.log
nohup python /home/appinsight/work/appinsight/appinsight/v0.1/src/agent/ApacheLogWriter.py > myapache.log &

#Start Log Collector
nohup python /home/appinsight/work/appinsight/appinsight/v0.1/src/server/LogCollectorService.py > mylogcollector.log &

#Start Log Indexer
nohup python /home/appinsight/work/appinsight/appinsight/v0.1/src/server/LogIndexer.py > myindexer.log &

# Start UI Server cd to the dir
cd /home/appinsight/work/appinsight/appinsight/v0.1/src/server
nohup ./TenantServer.py  > mytenantserver.log &

nohup /usr/local/bin/python2.7 standardCollector.py  > mystdcollector.log &

nohup /usr/local/bin/python2.7 collectdserver.py  > mycollectd.log &
#/SampleTenantUI.py
# Reset DB
#./TenantUtil.py -createdb

