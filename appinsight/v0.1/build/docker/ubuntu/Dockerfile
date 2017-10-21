# This is used to build a docker image of appinsight
# Do not run docker directly on this file; run ./build.sh instead.

FROM ubuntu:14.04
MAINTAINER appinsight

# mysql needs libaio.  Copy it to the container and install it in the container.
COPY libaio1_0.3.109-4_amd64-ubuntu-14.04.deb /tmp/libaio1_0.3.109-4_amd64.deb
RUN dpkg -i /tmp/libaio1_0.3.109-4_amd64.deb

RUN mkdir -p /usr/local/bin; rm -rf /usr/local/mysql-5.6.27-linux-glibc2.5-x86_64

# The following COPY statements copy the whole trees.
COPY pyelasticsearch-tmp /opt/
COPY mysql-tmp /opt/
COPY kafka-python-tmp /opt/

# The following ADD statements automatically unpack the tar files and compressed tar files.
ADD aniso8601-0.90.tar.gz /opt
ADD simplejson-3.3.0.tar.gz /opt
ADD bottle-0.11.6.tgz /opt
ADD Paste-2.0.2.tar.gz /opt
ADD jre-8u60-linux-x64.tar.gz /opt
ADD mysql-5.6.27-linux-glibc2.5-x86_64.tar.gz /usr/local/
ADD redis-2.6.14-ubuntu-14.04-x86_64.tar /usr/local/bin/
ADD Anaconda-2.3.0-ubuntu-14.04-x86_64.tgz /opt
ADD elasticsearch-1.7.3.tar.gz /opt
ADD kafka_2.11-0.9.0.0.tgz /opt
ADD mongodb-linux-x86_64-3.2.4.tgz /opt
ADD pymongo-3.2.2.tgz /opt
ADD datastax-ddc-3.4.0-bin.tar.gz /opt
ADD cassandra-driver-3.2.0a1.tgz /opt
ADD futures-3.0.5.tar.gz /opt
ADD spark-1.5.1-bin-hadoop2.6.tgz /opt
ADD commons-csv-1.4-bin.tar.gz /opt
ADD spark-csv_2.11-1.4.0.jar /opt
ADD spark-streaming-kafka-assembly_2.10-1.5.1.jar /opt
ADD spark-cassandra-connector-java_2.10-1.5.0-RC1.jar /opt
ADD haproxy-1.6.1-centos-7.1-x86_64.tgz /opt
ADD pywebhdfs-0.4.1.tar.gz /opt
ADD pkgs.tar /opt
ADD AppInsight.tar /opt

RUN /opt/appinsight/initialize-image.sh

# See http://www.cloudera.com/documentation/enterprise/latest/topics/cdh_ig_ports_cdh5.html
# for a list of HDFS port numbers.
EXPOSE 8082 8084 9501 9502 14501 3306 9200 9092 27017 28017 7000 7001 9160 9042 7199 9084 50010 1004 50075 50475 1006 50020 8020 8022 50070 50470

ENTRYPOINT ["/opt/appinsight/initialize-container.sh"]
