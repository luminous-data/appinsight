#!/usr/bin/env python

# Initializes configuration parameters in the database.
# initialize-container.sh calls this when the docker container is initialized.

import sys

def usage():
    print 'usage: %s [-redis-host=HOST] [-plugincollector-host=HOST] [-elasticsearch-host=HOST] [-hdfs-host=HOST] [-kafka-host=HOST] [-cassandra-host=HOST] [-cassandra-port=PORT]'  % \
        sys.argv[0]

config = {'dryrun' : 0,
          'redis_host' : 'localhost',
          'plugincollector_host' : 'localhost',
          'elasticsearch_host' : 'localhost',
          'hdfs_host' : 'localhost',
          'kafka_host' : 'localhost',
          'cassandra_host' : 'localhost',
          'cassandra_port' : '9042'}

def parseConfigArg(arg):
    '''Sets entries in config based on the command-line argument arg.
Returns True if arg is of the form -xxx-host=HOST for a recognized value
of xxx.'''
    # config is a dictionary of configuration values corresponding
    # to the command-line arguments.
    global config
    for (argPrefix, configKey) in \
        (('-redis-host=', 'redis_host'),
         ('-plugincollector-host=', 'plugincollector_host'),
         ('-elasticsearch-host=', 'elasticsearch_host'),
         ('-hdfs-host=', 'hdfs_host'),
         ('-cassandra-host=', 'cassandra_host'),
         ('-cassandra-port=', 'cassandra_port')):
        # If the argument starts with argPrefix (which must end with '='),
        # set the config item config[configKey] to the part of arg after the '='.
        # For example, for "-redis-host=xyz", set config['redis_host'] to 'xyz'.
        if arg[:len(argPrefix)] == argPrefix:
            # Get the part after the '='.
            config[configKey] = arg.split('=', 1)[1]
            return True
    return False

def parseArgs(args):
    '''Parses the command-line arguments and sets corresponding variables.'''
    global config
    for arg in args:
        if parseConfigArg(arg):
            pass
        elif arg == '-dryrun':
            config['dryrun'] = 1
        # Can handle other arguments here.
        else:
            print '%s: unknown argument "%s"' % (sys.argv[0], arg)
            return False
    return True

def addConfigComponent(componentName, instanceName):
    '''Adds a component to the configuration table in the database.'''
    print 'Adding config component name="%s" instance="%s"' % (componentName, instanceName)
    if not config['dryrun']:
        TenantUtil.addConfigComponent(componentName, instanceName)

def addConfigParameter(componentName, instanceName, propName, propValue):
    '''Adds or replaces a value in the configuration table in the database.'''
    print 'Setting component="%s" instance="%s" name="%s" value="%s"' % \
        (componentName, instanceName, propName, propValue)
    if not config['dryrun']:
        TenantUtil.addConfigParameter(componentName, instanceName, propName, propValue)

def main():
    addConfigComponent('PluginCollector', 'default')
    addConfigComponent('LogIndexer', 'default')
    addConfigComponent('TenantServer', 'default')
    addConfigComponent('redis', 'default')
    addConfigComponent('elasticsearch', 'default')
    addConfigComponent('CassandraConnector', 'default')
    addConfigComponent('ConfigServer', 'default')
    addConfigComponent('kafka', 'default')
    addConfigComponent('zookeeper', 'default')
    addConfigComponent('HdfsDataNode', 'default')
    addConfigComponent('HdfsNameNode', 'default')
    addConfigComponent('WorkbenchSparkServerNew', 'default')
    addConfigComponent('SensorMeasurementCollector', 'default')

    addConfigParameter('PluginCollector', 'default', 'port', '9501')
    addConfigParameter('PluginCollector', 'default', 'host', config['plugincollector_host'])
    addConfigParameter('LogIndexer', 'default', 'port', '9502')
    addConfigParameter('TenantServer', 'default', 'port', '8084')
    addConfigParameter('redis', 'default', 'host', config['redis_host'])
    addConfigParameter('redis', 'default', 'port', '6379')
    addConfigParameter('redis', 'default', 'channelprefix', 'insightal.inputevents.')
    addConfigParameter('elasticsearch', 'default', 'host', config['elasticsearch_host'])
    addConfigParameter('elasticsearch', 'default', 'port', '9200')
    addConfigParameter('CassandraConnector', 'default', 'host', config['cassandra_host'])
    addConfigParameter('CassandraConnector', 'default', 'port', config['cassandra_port'])
    addConfigParameter('ConfigServer', 'default', 'port', '8082')
    addConfigParameter('kafka', 'default', 'host', config['kafka_host'])
    addConfigParameter('kafka', 'default', 'port', '9092')
    # For now zookeeper always runs on the same host as kafka.
    addConfigParameter('zookeeper', 'default', 'host', config['kafka_host'])
    addConfigParameter('zookeeper', 'default', 'port', '2181')
    addConfigParameter('WorkbenchSparkServerNew', 'default', 'port', '6951')
    addConfigParameter('SensorMeasurementCollector', 'default', 'port', '9502')

# See  http://www.cloudera.com/documentation/enterprise/latest/topics/cdh_ig_ports_cdh5.html
# for a description of the HDFS ports.  Only the ones marked "External" are defined here.
    addConfigParameter('HdfsDataNode', 'default', 'dfs.datanode.address', '50010')
    addConfigParameter('HdfsDataNode', 'default', 'secure-dfs.datanode.address', '1004')
    addConfigParameter('HdfsDataNode', 'default', 'dfs.datanode.http.address', '50075')
    addConfigParameter('HdfsDataNode', 'default', 'dfs.datanode.https.address', '50475')
    addConfigParameter('HdfsDataNode', 'default', 'secure-dfs.datanode.http.address', '1006')
    addConfigParameter('HdfsDataNode', 'default', 'dfs.datanode.ipc.address', '50020')

    # The user name is used in HDFSConn.py
    addConfigParameter('HdfsNameNode', 'default', 'username', 'gmulchan')
    # The host name is also stored in /etc/hadoop/conf.appinsight/core-site.xml
    addConfigParameter('HdfsNameNode', 'default', 'host', config['hdfs_host'])
    addConfigParameter('HdfsNameNode', 'default', 'fs.defaultFS', '8020')
    addConfigParameter('HdfsNameNode', 'default', 'dfs.namenode.servicerpc-address', '8022')
    addConfigParameter('HdfsNameNode', 'default', 'dfs.namenode.http-address', '50070')
    addConfigParameter('HdfsNameNode', 'default', 'dfs.namenode.https-address', '50470')

if __name__ == '__main__':
    if not parseArgs(sys.argv[1:]):
        usage()
        sys.exit(2)
    if not config['dryrun']:
        import TenantUtil
    main()
    sys.exit(0)
