These files were retrieved on an ubuntu 14.04.4 machine from cloudera as follows.

----
If necessary, set up apt-get to use a proxy server:
1. Make sure the proxy server machine is in /etc/hosts
2. Create a file /etc/apt/apt.conf.d/80proxy with the following two lines
   replacing PROXY:NNN with the name and TCP port of the proxy server:
Acquire::http::Proxy "http://PROXY:NNN";
Acquire::http::No-Cache true;

For example:
Acquire::http::Proxy "http://gateway:3128";
Acquire::http::No-Cache true;
----

Retrieve cloudera.list and cdh5-repository_1.0_all.deb.  If necessary, use the
--proxy option to curl to specify the proxy server and TCP port.
curl -o /etc/apt/sources.list.d/cloudera.list https://archive.cloudera.com/gplextras5/ubuntu/precise/amd64/gplextras/cloudera.list
curl -o /tmp/cdh5-repository_1.0_all.deb https://archive.cloudera.com/cdh5/one-click-install/trusty/amd64/cdh5-repository_1.0_all.deb

Install the cdh5-repository_1.0_all.deb package:
dpkg -i /tmp/cdh5-repository_1.0_all.deb

If the dpkg command gets the following error:
gpg: symbol lookup error: /usr/local/lib/libreadline.so.6: undefined symbol: PC
then make sure the Anaconda version of readline.so isn't in the library path.

Update the list of available packages:
apt-get update

Change the URLs to use HTTP instead of HTTPS:
sed -i 's+https:+http:+g' /etc/apt/sources.list.d/cloudera-cdh5.list

Retrieve the HDFS packages:

cd /tmp
mkdir pkgs
cd pkgs
apt-get --allow-unauthenticated download avro-libs bigtop-jsvc bigtop-utils hadoop hadoop-client hadoop-hdfs hadoop-hdfs-secondarynamenode hadoop-hdfs-datanode hadoop-mapreduce hadoop-0.20-mapreduce hadoop-yarn parquet parquet-format zookeeper
