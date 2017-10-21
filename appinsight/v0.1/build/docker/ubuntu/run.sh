#!/bin/bash

# Runs a docker image.

# Make sure selinux isn't enabled.  The container initialization script
# fails with selinux enabled.
if [ -e /usr/sbin/selinuxenabled ] && /usr/sbin/selinuxenabled; then
  echo "$0: you must disable selinux"
  exit 1
fi

name=appinsight
docker_net_type='host'
docker_publish_arg=''

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
 hdfsname
 hdfsdata
 workbenchserver
 workbenchsparkserver
 metadatamanager
 workflowrunner
 sensorserver
)
logdir=''

usage()
{
  local msg=''
  local service
  for service in "${services[@]}"; do msg="$msg [-run-$service]"; done
  echo "usage: $0  -logdir=LOG-DIRECTORY $msg [-run-hdfs] [-dryrun] [-mysql-host=HOST] [-redis-host=HOST] [-plugincollector-host=HOST] [-elasticsearch-host=HOST] [-hdfs-host=HOST] [-kafka-host=HOST] [-cassandra-host=HOST [-cassandra-port=PORT]] [-net=bridge]"
  echo "-run-hdfsname says to run the HDFS namenode and secondary namenode services"
  echo "-run-hdfsdata says to run the HDFS datanode service; use -hdfs-host to specify where the HDFS namenode service runs"
  echo "-run-hdfs is the same as specifying both -run-hdfsname and -run-hdfsdata"
  echo "-run-kafka runs zookeeper as well as kafka"
  echo "-net=bridge tells Docker to use bridge networking instead of host networking"
  echo "Log files will be written in directory LOGDIR"
  echo "Default is to start all services"
  echo "-SERVICE-host=HOST (e.g. -mysql-host=HOST) means that HOST is the name or IP address of the machine where SERVICE is running"
  echo "-SERVICE-port=PORT (e.g. -cassandra-port=PORT) means that SERVICE is listening on port PORT on host HOST; it does *NOT* set the port to listen on when starting the service in this image"
}

# Returns true if $1 has the form -run-<service> where <service> is a recognized service.
find_run_service_arg()
{
  local service
  for service in "${services[@]}"; do [ "$1" = "-run-$service" ] && return 0; done
  return 1
}

# Adds a firewall rule to open a TCP port.
# $1: firewall type: none, iptables or firewalld
# $2: port number
open_port()
{
  case "$1" in
    none) ;;
    iptables) $dryrun /sbin/iptables -I INPUT -p tcp --dport "$1" -j ACCEPT > /dev/null;;
    firewalld) $dryrun firewall-cmd --add-port="$2"/tcp > /dev/null;;
    *) echo "$0: *** unknown firewall type $1";;
  esac
}

# Deletes a firewall rule to open a TCP port.
# $1: firewall type: none, iptables or firewalld
# $2: port number
close_port()
{
  case "$1" in
    none) ;;
    iptables) $dryrun /sbin/iptables -D INPUT -p tcp --dport "$1" -j ACCEPT > /dev/null;;
    firewalld) $dryrun firewall-cmd --remove-port="$2"/tcp > /dev/null;;
    *) echo "$0: *** unknown firewall type $1";;
  esac
}

# Adds firewall rules to open TCP ports.
# $1: firewall type: none, iptables or firewalld
# $2: list of port numbers as a space-separated string
open_ports()
{
  local port
  if [ -n "$2" ]; then
    echo "$0: opening firewall ports: $2"
    for port in $2; do
      open_port "$1" "$port"
    done
  fi
}

# Deletes firewall rules to close TCP ports.
# $1: firewall type: none, iptables or firewalld
# $2: list of port numbers as a space-separated string
close_ports()
{
  local port
  if [ -n "$2" ]; then
    echo "$0: closing firewall ports: $2"
    for port in $2; do
      close_port "$1" "$port"
    done
  fi
}

# TCP port numbers for the various services.
# For the HDFS ports numbers, see:
#   http://www.cloudera.com/documentation/enterprise/latest/topics/cdh_ig_ports_cdh5.html
mysql_ports="3306"
elasticsearch_ports="9200"
configserver_ports="8082"
tenantserver_ports="8084"
plugincollector_ports="9501"
kafka_ports="9092 2181" # 9092 is kafka, 2181 is zookeeper
mongo_ports="27017 28017"
cassandra_ports="7000 7001 9160 9042 7199"
sensormeasurementcollector_ports="9502"
haproxy_ports="9084"
hdfsname_ports="8020 8022 50070 50470"
hdfsdata_ports="50010 1004 50075 50475 1006 50020"
workbenchserver_ports="9506"
workbenchsparkserver_ports="6951"
metadatamanager_ports="9503"
workflowrunner_ports="9507"
sensorserver_ports="9504"

# If no services are specified, run all of them and open all of their ports
# in the firewall.
ports="$mysql_ports $elasticsearch_ports $configserver_ports $tenantserver_ports $plugincollector_ports $kafka_ports $sensormeasurementcollector_ports $haproxy_ports $hdfsname_ports $hdfsdata_ports $workbenchserver_ports $workbenchsparkserver_ports $metadatamanager_ports $workflowrunner_ports $sensorserver_ports"

for arg in $*; do
  # If -help is specified, show the usage message and exit.
  case "$arg" in
    -h|-help|--help) usage; exit 0;;
  esac

  # If any services are specified, open only those services' ports.
  if find_run_service_arg "$arg" || [ "$arg" == "-run-hdfs" ]; then
    ports=''
    break
  fi
done

if [ "$(id -u)" != 0 ]; then
  echo "*** $0: must be run as root"
  exit 1
fi

# If dryrun is true, show the actions without doing them.
dryrun=''

# run_args contains arguments that are passed to the container's entry point.
run_args=''

# Check command-line arguments.
for arg in $*; do
  if ! find_run_service_arg "$arg"; then
    case "$arg" in
# The part after the first '=' is the log directory.
      -logdir=*) logdir="${arg#*=}";;
      -dryrun) dryrun='echo';;
      -run-hdfs) ;;
# The -*-host=* and -*-port=* arguments are passed to the container's entry point.
      -mysql-host=*) ;;
      -redis-host=*) ;;
      -plugincollector-host=*) ;;
      -elasticsearch-host=*) ;;
      -hdfs-host=*) ;;
      -cassandra-host=*) ;;
      -cassandra-port=*) ;;
      -net=bridge|--net=bridge) docker_net_type='bridge';;
      *) echo "*** $0: unknown argument '$arg'"; usage; exit 2;;
    esac
  fi

  # If -run-hdfs is specified, pass -run-hdfsname and -run-hdfsdata to the
  # container's entry point.  Don't pass the -dryrun, -logdir, and
  # -net=host flags.  Pass all other other arguments to the container
  # without change.
  case "$arg" in
    -run-hdfs) run_args="$run_args -run-hdfsname -run-hdfsdata";;
    -dryrun|-logdir=*|-net=*|--net=*);;
    *) run_args="$run_args $arg";;
  esac

  # Ports for services that are to be run in the container.
  case "$arg" in
    -run-mysql) ports="$ports $mysql_ports";;
    -run-elasticsearch) ports="$ports $elasticsearch_ports";;
    -run-configserver) ports="$ports $configserver_ports";;
    -run-tenantserver) ports="$ports $tenantserver_ports";;
    -run-plugincollector) ports="$ports $plugincollector_ports";;
    -run-kafka) ports="$ports $kafka_ports";;
    -run-mongo) ports="$ports $mongo_ports";;
    -run-cassandra) ports="$ports $cassandra_ports";;
    -run-sensormeasurementcollector) ports="$ports $sensormeasurementcollector_ports";;
    -run-hdfsname) ports="$ports $hdfsname_ports";;
    -run-hdfsdata) ports="$ports $hdfsdata_ports";;
    -run-hdfs) ports="$ports $hdfsname_ports $hdfsdata_ports";;
    -run-workbenchserver) ports="$ports $workbenchserver_ports";;
    -run-workbenchsparkserver) ports="$ports $workbenchsparkserver_ports";;
    -run-metadatamanager) ports="$ports $metadatamanager_ports";;
    -run-workflowrunner) ports="$ports $workflowrunner_ports";;
    -run-sensorserver) ports="$ports $sensorserver_ports";;
  esac
done

# Make sure -logdir is specified.
if [ -z "$logdir" ]; then echo "*** $0: -logdir=LOG-DIRECTORY must be specified"; exit 2; fi

# If a relative path is given for $logdir, make it absolute.
case "$logdir" in
  /*) ;;
  *) logdir="$PWD/$logdir";;
esac

# Make sure $logdir is valid.
if [ ! -e "$logdir" ]; then echo "*** $0: $logdir does not exist"; exit 1; fi
if [ ! -d "$logdir" ]; then echo "*** $0: $logdir is not a directory"; exit 1; fi
if [ ! -w "$logdir" ]; then echo "*** $0: $logdir is not writable"; exit 1; fi

#echo ports="$ports" ### TESTING
#echo run_args="$run_args" ### TESTING

case "$docker_net_type" in
  host)
    # Open the servers' ports in the firewall.
    firewall_type=none
    if [ -n "$ports" ]; then
      # See what kind firewall is running.
      if /sbin/service firewalld status > /dev/null 2>&1
	then firewall_type=firewalld
      elif /sbin/service iptables status > /dev/null 2>&1
	then firewall_type=iptables
      fi
    fi

    if [ -n "$firewall_type" ]
      then echo "$0: firweall type is $firewall_type"
      else echo "$0: no firewall detected"
    fi

    open_ports "$firewall_type" "$ports"
    ;;

  bridge)
    # When docker uses bridge networking, we need to tell it which port
    # numbers to publish.
    for port in $ports; do
      docker_publish_arg="$docker_publish_arg -p $port:$port"
    done
    ;;
esac

# Start the docker container.
echo "$0: starting Docker container"
$dryrun docker run --net=$docker_net_type $docker_publish_arg -v "$logdir:/mnt/host/logs" -v /:/mnt/host/root:ro -it "$name" $run_args
rc=$?

case "$docker_net_type" in
  host)
    # Close any ports that we opened in the firewall.
    # TODO: may want to keep track of which ports were open before
    # this program started and not close them.
    close_ports "$firewall_type" "$ports"
    ;;
esac

exit $rc
