#!/bin/bash

# This is called when the docker container starts.  It should not be
# called from anywhere else.

fullpgm="$0"
pgm="$(basename $0)"
# The Docker container should be started with /mnt/host/logs mounted on
# a directory where the container can write log files.
logdir=/mnt/host/logs
inner=''

# Look for the -inner option.
for arg in $*; do
  case "$arg" in
    -inner) inner=1;;
  esac
done

# If this is the outer instance, run this program again with the output redirected
# to a log file.
if [ -z "$inner" ]; then
  if [ ! -w "$logdir" ]; then
    echo "*** $pgm: $logdir is not writable"
    exit 1
  fi
  echo "$pgm: writing output to $logdir/initialization.txt"
#  "$fullpgm" -inner "$@" > $logdir/initialization.txt 2>&1
  "$fullpgm" -inner "$@" 2>&1 | tee $logdir/initialization.txt
  echo "$pgm: starting interactive shell"
  IGNOREEOF=5 /bin/bash -i
  echo "$pgm: docker container is exiting"
  exit
fi

# This is the inner instance.  Its output goes to a log file.
echo "Initializing docker container in directory $PWD"

export "PATH=/usr/local/mysql/bin:/usr/local/bin:$PATH"
export "LD_LIBRARY_PATH=/usr/local/mysql/lib:$LD_LIBRARY_PATH"
export JAVA_HOME=/opt/jre1.8.0_60

declare -a services
services=(
 mysql 
 redis
 elasticsearch
 configserver
 tenantserver
 plugincollector
 logindexer
 kafka
 mongo
 cassandra
 sensormeasurementcollector
 haproxy
 hdfsname
 hdfsdata
 workbenchserver
 workbenchsparkserver
 metadatamanager
 workflowrunner
 sensorserver
)

# Returns true if $1 has the form -run-<service> for a recognized service.
find_run_service_arg()
{
  local service
  for service in "${services[@]}"; do [ "$1" = "-run-$service" ] && return 0; done
  return 1
}

# Initialize run_$service to 1 for each service.
for service in "${services[@]}"; do eval "run_$service=1"; done

# If any services are specified, run only those services.
# Otherwise run all services.
for arg in $*; do
  if find_run_service_arg "$arg"; then
    echo "$pgm: setting all services to 0" ### TESTING
    for service in "${services[@]}"; do
      echo "$pgm: setting run_$service=0"
      eval "run_$service=0"
    done
  fi
done

mysql_host=''
redis_host=''
plugincollector_host=''
elasticsearch_host=''
hdfs_host=''
cassandra_host=''
cassandra_port=''
config_args=''

for arg in $*; do
  # For each specified service, set run_$service to 1.
  if find_run_service_arg "$arg"; then
# The service name is the part after "-run-".
    service="${arg:5}"
    echo "$pgm: setting run_$service=1" ### TESTING
    eval "run_$service=1"
  else
    case "$arg" in
# The part after the first '=' is the host name.
      -mysql-host=*) mysql_host="${arg#*=}";;
# Other host arguments are passed to set_default_config_properties.py, which stores them
# in the database.
      -redis-host=*) config_args="$config_args $arg"; redis_host="${arg#*=}";;
      -plugincollector-host=*) config_args="$config_args $arg"; plugincollector_host="${arg#*=}";;
      -elasticsearch-host=*) config_args="$config_args $arg"; elasticsearch_host="${arg#*=}";;
      -hdfs-host=*) config_args="$config_args $arg"; hdfs_host="${arg#*=}";;
      -cassandra-host=*) config_args="$config_args $arg"; cassandra_host="${arg#*=}";;
      -cassandra-port=*) config_args="$config_args $arg"; cassandra_port="${arg#*=}";;
      -inner) ;;
    *)  
      echo "$pgm: error: unknown argument $arg"
      exit 2;;
    esac
  fi
done

### TESTING:
for service in "${services[@]}"; do eval "value=\$run_$service"; echo "$pgm: run_$service=$value"; done

# If the HDFS datanode service is to run in this container and the HDFS
# namenode service is not, need to specify where to find the namenode service.
if [ $run_hdfsdata -gt 0 -a -z "$hdfs_host" ]; then
  if [ $run_hdfsname -gt 0 ]
    # If the HDFS datanode and namenode service are both to be run,
    # use localhost as the default namenode host but let the user
    # override it.
    then [ -z "$hdfs_host" ] && hdfs_host=localhost
    else echo "$pgm: error: -hdfs-host=HOST must be specified"; exit 2
  fi
fi

# TODO: see which of the hdfs config files are needed for which services and
# only generate theones that are needed.  In the meanwhile, make sure hdfs_host
# is defined.
[ -z "$hdfs_host" ] && hdfs_host=localhost

# Initialize HDFS.
# See http://www.cloudera.com/documentation/enterprise/5-5-x/topics/cdh_ig_hdfs_cluster_deploy.html

cp -r /etc/hadoop/conf.empty /etc/hadoop/conf.appinsight
update-alternatives --install /etc/hadoop/conf hadoop-conf /etc/hadoop/conf.appinsight 50
update-alternatives --set hadoop-conf /etc/hadoop/conf.appinsight
cp -p /etc/hadoop/conf.appinsight/core-site.xml /etc/hadoop/conf.appinsight/core-site.xml.orig
cp -p /etc/hadoop/conf.appinsight/hdfs-site.xml /etc/hadoop/conf.appinsight/hdfs-site.xml.orig

# HDFS data files will be stored here.
hdfsdir=/usr/local/hdfs/data/1/dfs/nn
mkdir -p $hdfsdir
chown -R hdfs.hdfs $hdfsdir
chmod 700 $hdfsdir

echo "$pgm: creating /etc/hadoop/conf.appinsight/core-site.xml"
cat > /etc/hadoop/conf.appinsight/core-site.xml << EOF
<?xml version="1.0"?>
<?xml-stylesheet type="text/xsl" href="configuration.xsl"?>

<!-- see http://www.cloudera.com/documentation/enterprise/5-5-x/topics/cdh_ig_hdfs_cluster_deploy.html  -->

<configuration>

  <property>
    <name>fs.defaultFS</name>
    <value>hdfs://$hdfs_host:8020</value>
    <description>Specifies the NameNode and the default file system.</description>
  </property>

</configuration>
EOF

echo "$pgm: creating /etc/hadoop/conf.appinsight/hdfs-site.xml"
cat > /etc/hadoop/conf.appinsight/hdfs-site.xml << EOF
<?xml version="1.0"?>
<?xml-stylesheet type="text/xsl" href="configuration.xsl"?>

<!-- see http://www.cloudera.com/documentation/enterprise/5-5-x/topics/cdh_ig_hdfs_cluster_deploy.html  -->

<configuration>

  <property>
    <name>dfs.permissions.superusergroup</name>
    <value>hadoop</value>
    <description>Specifies the group containing users that will be treated as superusers by HDFS.</description>
  </property>


  <property>
    <name>dfs.namenode.name.dir</name>
    <value>file://$hdfsdir</value>
    <description>This property specifies the URIs of the directories where the NameNode stores its metadata and edit logs.</description>
  </property>

</configuration>
EOF

echo "$pgm: initializing HDFS namenode; log is $logdir/hdfs-namenode.txt"
sudo -u hdfs hdfs namenode -format > $logdir/hdfs-namenode.txt 2>&1

if [ $run_hdfsname -gt 0 ]; then
  echo "$pgm: starting hadoop-hdfs-namenode"
  sudo service hadoop-hdfs-namenode start
  echo "$pgm: starting hadoop-hdfs-secondarynamenode"
  sudo service hadoop-hdfs-secondarynamenode start
fi

if [ $run_hdfsdata -gt 0 ]; then
  echo "$pgm: starting hadoop-hdfs-datanode"
  sudo service hadoop-hdfs-datanode start
fi

# If mysql is not to run in this container but is used by a service that is
# to be run in this container, must specify where to find it.
if [ $run_mysql -eq 0 -a -z "$mysql_host" -a \( \
       $run_configserver -gt 0 -o \
       $run_tenantserver -gt 0 -o \
       $run_plugincollector -gt 0 -o \
       $run_logindexer -gt 0 -o \
       $run_sensormeasurementcollector -gt 0 \
 \) ]; then
  echo "$pgm:  error: -mysql-host=HOST must be specified"
  exit 2
fi

# If redis is not to run in this container but is used by a service that is
# to be run in this container, must specify where to find it.
if [ $run_redis -eq 0 -a -z "$redis_host" -a \
     \( $run_plugincollector -gt 0 -o $run_logindexer -gt 0 \) ]; then
  echo "$pgm: error: -redis-host=HOST must be specified"
  exit 2
fi

# If ElasticSearch is not to run in this container but is used by a service that is
# to be run in this container, must specify where to find it.
if [ $run_elasticsearch -eq 0 -a -z "$elasticsearch_host" -a \
     \( $run_tenantserver -gt 0 -o $run_logindexer -gt 0 \) ]; then
  echo "$pgm: error: -elasticsearch-host=HOST must be specified"
  exit 2
fi

# If cassandra is not to run in this container but is used by a service that is
# to be run in this container, must specify where to find it.
if [ $run_cassandra -eq 0 -a -z "$cassandra_host" -a \
     $run_sensorserver -gt 0 ]; then
  echo "$pgm: error: -cassandra-host=HOST must be specified"
  exit 2
fi

# If -mysql-host isn't specified, use localhost.
[ -n "$mysql_host" ] || mysql_host=127.0.0.1

mkdir -p ~/AppInsight
if [ ! -r ~/AppInsight/AppInsight.conf ]; then
  echo "$pgm: creating ~/AppInsight/AppInsight.conf"
  cat > ~/AppInsight/AppInsight.conf <<EOF
[db]
# MySql using the mysql.connector Python module
driver = mysql.connector
user = appinsightuser
password = appinsightpass
database = appinsightdb
host = $mysql_host
EOF
else
  echo "$pgm: not creating ~/AppInsight/AppInsight.conf because it already exists"
fi

if [ $run_mysql -gt 0 ]; then
  if ! ps -C mysqld > /dev/null; then
    echo "$pgm: starting mysql server; log is $logdir/mysql.server.txt"
    su mysql -c '/usr/local/mysql/support-files/mysql.server start' > $logdir/mysql.server.txt 2>&1 &

    echo "$pgm: waiting for mysql server to start"
    sleep 5

    echo "$pgm: setting mysql password"
    echo "SET PASSWORD FOR 'root'@'localhost' = PASSWORD('appinsight');" | mysql -u root
  fi

  echo "Creating the appinsightuser user in mysql"
  mysql -u root --password=appinsight --batch <<EOF
create user 'appinsightuser'@'localhost' identified by 'appinsightpass';
create user 'appinsightuser'@'%' identified by 'appinsightpass';
create database appinsightdb;
grant all on appinsightdb.* to 'appinsightuser'@'localhost';
grant all on appinsightdb.* to 'appinsightuser'@'%';
EOF

  pushd /opt/appinsight/server

  echo "$pgm: initializing the appinsightdb database; log is $logdir/createdb.txt"
  ./TenantUtil.py -createdb 2>&1 >  $logdir/createdb.txt 2>&1

  echo "$pgm: setting default config properties; log is $logdir/set_default_config_properties.txt"
  echo "$pgm: ./set_default_config_properties.py $config_args"
  ./set_default_config_properties.py $config_args > $logdir/set_default_config_properties.txt 2>&1
  popd
fi

if [ $run_redis -gt 0 ]; then
  # Run redis if it isn't already running.
  if ! ps -C redis-server > /dev/null; then
    echo "$pgm: starting redis; log is $logdir/redis-server-log.txt"
    /usr/local/bin/redis-server > $logdir/redis-server-log.txt 2>&1 &
  fi
fi

echo "$pgm: linking /opt/Anaconda-2.3.0/lib/lib*, /opt/Anaconda-2.3.0/lib/*.sh, and /opt/Anaconda-2.3.0/lib/{python2.7,tcl8,tcl8.5,tclConfig.sh,tk8.5} to /usr/local/lib/"
ln -s -f /opt/Anaconda-2.3.0/lib/lib* /opt/Anaconda-2.3.0/lib/*.sh /opt/Anaconda-2.3.0/lib/{python2.7,tcl8,tcl8.5,tclConfig.sh,tk8.5} /usr/local/lib/

echo "$pgm: linking /opt/Anaconda-2.3.0/lib/pkgconfig/* to /usr/share/pkgconfig"
ln -s -f /opt/Anaconda-2.3.0/lib/pkgconfig/* /usr/share/pkgconfig/

for dir in man1; do
  echo "$pgm: linking /opt/Anaconda-2.3.0/share/man/$dir/* to /usr/local/share/man/$dir/"
  ln -s -f /opt/Anaconda-2.3.0/share/man/$dir/* /usr/local/share/man/$dir/
done

for file in elasticsearch plugin; do
  echo "$pgm: linking /opt/elasticsearch-1.7.3/bin/$file to /usr/local/bin/$file"
  ln -s -f /opt/elasticsearch-1.7.3/bin/$file /usr/local/bin/$file
done

if [ $run_elasticsearch -gt 0 ]; then
  # Run elasticsearch if it isn't alreaddy running.
  if [ -z "$(ps ww -C java | fgrep -e -Delasticsearch)" ]; then
    echo "$pgm: starting elasticsearch; log is $logdir/redis-server-log.txt"
    /opt/elasticsearch-1.7.3/bin/elasticsearch > $logdir/elasticsearch-runlog.txt 2>&1 &
  fi
fi

if [ $run_kafka -gt 0 ]; then
# See http://kafka.apache.org/documentation.html#quickstart
  if pushd /opt/kafka_2.11-0.9.0.0 > /dev/null; then
    echo "$pgm: starting Apache zookeeper; log is $logdir/zookeeper-runlog.txt"
    bin/zookeeper-server-start.sh config/zookeeper.properties > $logdir/zookeeper-runlog.txt 2>&1 &
    echo "$pgm: starting Apache kafka; log is $logdir/kafka-runlog.txt"
    bin/kafka-server-start.sh config/server.properties > $logdir/kafka-runlog.txt 2>&1 &
    popd > /dev/null
  else
    echo "***** $pgm: error changing directory to /opt/kafka_2.11-0.9.0.0"
  fi
fi

# Install pymongo regardless of whether the mongo server is to be started.
if pushd /opt/pymongo-3.2.2 > /dev/null; then
  echo "$pgm: installing pymongo, log is $logdir/pymongo-install-log.txt"
  # The output of "python setup.py install" is long, so write it to a
  # log file instead of stdout.
  python setup.py install > $logdir/pymongo-install-log.txt 2>&1
  popd > /dev/null
else
  echo "***** $pgm: error changing directory to /opt/pymongo-3.2.2"
fi

if [ $run_mongo -gt 0 ]; then
# See https://docs.mongodb.org/manual/tutorial/install-mongodb-on-linux/
  if pushd /opt/mongodb-linux-x86_64-3.2.4 > /dev/null; then
    # Add the mongodb bin directory to the search path.
    export PATH="$PWD/bin:$PATH"
    echo "$pgm: creating /data/db for mongo database"
    mkdir -p /data/db
    echo "$pgm: starting mongo; log is $logdir/mongod-runlog.txt"
    $PWD/bin/mongod > $logdir/mongod-runlog.txt 2>&1 &
    popd > /dev/null
  else
    echo "***** $pgm: error changing directory to /opt/mongodb-linux-x86_64-3.2.4"
  fi
fi

if [ $run_cassandra -gt 0 ]; then
# See https://wiki.apache.org/cassandra/RunningCassandra
  if pushd /opt/datastax-ddc-3.4.0 > /dev/null; then
    echo "$pgm: starting cassandra; log is $logdir/cassandra-runlog.txt"
    $PWD/bin/cassandra -R > $logdir/cassandra-runlog.txt 2>&1 &
    popd > /dev/null
  else
    echo "***** $pgm: error changing directory to /opt/datastax-ddc-3.4.0"
  fi
fi

# Start the servers in the background.

pushd /opt/appinsight/server

if [ $run_configserver -gt 0 ]; then
  echo "$pgm: starting ConfigServer; log is $logdir/ConfigServer-runlog.txt"
  ./ConfigServer.py > $logdir/ConfigServer-runlog.txt 2>&1 &
fi

if [ $run_tenantserver -gt 0 ]; then
  echo "$pgm: starting TenantServer; log is $logdir/TenantServer-runlog.tx"
  ./TenantServer.py > $logdir/TenantServer-runlog.txt  2>&1 &
fi

if [ $run_plugincollector -gt 0 ]; then
  echo "$pgm: starting PluginCollector; log is $logdir/PluginCollector-runlog.txt"
  ./PluginCollector.py > $logdir/PluginCollector-runlog.txt 2>&1 &
fi

if [ $run_logindexer -gt 0 ]; then
  echo "$pgm: starting LogIndexer; log is $logdir/LogIndexer-runlog.txt"
  ./LogIndexer.py > $logdir/LogIndexer-runlog.txt 2>&1 &
fi

if [ $run_sensormeasurementcollector -gt 0 ]; then
  echo "$pgm: starting SensorMeasurementCollector; log is $logdir/SensorMeasurementCollector-runlog.txt"
  python -u ./SensorMeasurementCollector.py > $logdir/SensorMeasurementCollector-runlog.txt 2>&1 &
fi

if [ $run_workbenchserver -gt 0 ]; then
  echo "$pgm: starting WorkbenchServerNew; log is $logdir/WorkbenchServerNew-runlog.txt"
  python -u WorkbenchServerNew.py > $logdir/WorkbenchServerNew-runlog.txt 2>&1 &
fi

if [ $run_workbenchsparkserver -gt 0 ]; then
  echo "$pgm: starting WorkbenchSparkServerNew; log is $logdir/WorkbenchSparkServerNew-runlog.txt"
  ./WorkbenchSparkServerNew.sh > $logdir/WorkbenchSparkServerNew-runlog.txt 2>&1 &
fi

if [ $run_metadatamanager -gt 0 ]; then
  echo "$pgm: starting MetadataManager; log is $logdir/MetadataManager-runlog.txt"
  python -u MetadataManager.py > $logdir/MetadataManager-runlog.txt 2>&1 &
fi

if [ $run_workflowrunner -gt 0 ]; then
  echo "$pgm: starting WorkflowRunner; log is $logdir/WorkflowRunner-runlog.txt"
  python -u WorkflowRunner.py > $logdir/WorkflowRunner-runlog.txt 2>&1 &
fi

if [ $run_sensorserver -gt 0 ]; then
  echo "$pgm: starting SensorServer; log is $logdir/SensorServer-runlog.txt"
  python -u SensorServer.py > $logdir/SensorServer-runlog.txt 2>&1 &
fi

echo "$pgm: starting sparkStreamingFromKafka; log is $logdir/sparkStreamingFromKafka-runlog.txt"
PYTHONPATH=/opt/appinsight/common spark-submit --jars /opt/spark-streaming-kafka-assembly_2.10-1.5.1.jar,/opt/spark-cassandra-connector-java_2.10-1.5.0-RC1.jar sparkStreamingFromKafka.py > $logdir/sparkStreamingFromKafka-runlog.txt 2>&1 &

echo "$pgm: starting sparkStreamingAggsFromKafka; log is $logdir/sparkStreamingAggsFromKafka-runlog.txt"
PYTHONPATH=/opt/appinsight/common spark-submit --jars /opt/spark-streaming-kafka-assembly_2.10-1.5.1.jar,/opt/spark-cassandra-connector-java_2.10-1.5.0-RC1.jar sparkStreamingAggsFromKafka.py > $logdir/sparkStreamingAggsFromKafka-runlog.txt 2>&1 &

popd

if [ $run_haproxy -gt 0 ]; then
  echo "$pgm: starting haproxy; log is $logdir/haproxy-runlog.txt"
  /usr/local/bin/haproxy -f /opt/appinsight/haproxy.conf > $logdir/haproxy-runlog.txt 2>&1 &
fi
