#!/bin/bash

# This is called as part of building the docker image.  It should not be
# called from anywhere else.

pgm="$(basename $0)"

echo "$pgm: initializing docker image in directory $PWD"

echo "$pgm: installing debian packages"
dpkg -i /opt/vendor/*/*.deb

mkdir -p /usr/local/bin /usr/local/lib /usr/local/include /usr/local/share/man/man1

for dir in bin include; do
  echo "$pgm: linking /opt/Anaconda-2.3.0/$dir/* to /usr/local/$dir"
  ln -s -f /opt/Anaconda-2.3.0/$dir/* /usr/local/$dir/
done
# Don't link the Anaconda version of readline into /usr/local/lib because
# it breaks some things.
rm -f /usr/local/lib/libreadline.so*

echo "$pgm: linking /opt/aniso8601-0.90/python2/aniso8601 to /opt/Anaconda-2.3.0/lib/python2.7/site-packages/aniso8601"
ln -s -f /opt/aniso8601-0.90/python2/aniso8601 /opt/Anaconda-2.3.0/lib/python2.7/site-packages/aniso8601

echo "$pgm: linking /opt/simplejson-3.3.0/simplejson to /opt/Anaconda-2.3.0/lib/python2.7/site-packages/simplejson"
ln -s -f /opt/simplejson-3.3.0/simplejson /opt/Anaconda-2.3.0/lib/python2.7/site-packages/simplejson

echo "$pgm: linking /opt/mysql-connector-python-2.0.3/lib/mysq /opt/Anaconda-2.3.0/lib/python2.7/site-packages/mysql"
ln -s -f /opt/mysql-connector-python-2.0.3/lib/mysql /opt/Anaconda-2.3.0/lib/python2.7/site-packages/mysql

echo "$pgm: linking /opt/bottle-0.11.6/bottle.py to /opt/Anaconda-2.3.0/lib/python2.7/site-packages/bottle.py"
ln -s -f /opt/bottle-0.11.6/bottle.py /opt/Anaconda-2.3.0/lib/python2.7/site-packages/bottle.py

echo "$pgm: linking /opt/Paste-2.0.2/paste to /opt/Anaconda-2.3.0/lib/python2.7/site-packages/paste"
ln -s -f /opt/Paste-2.0.2/paste /opt/Anaconda-2.3.0/lib/python2.7/site-packages/paste

echo "$pgm: linking /opt/pyelasticsearch-master/pyelasticsearch to /opt/Anaconda-2.3.0/lib/python2.7/site-packages/pyelasticsearch"
ln -s -f /opt/pyelasticsearch-master/pyelasticsearch /opt/Anaconda-2.3.0/lib/python2.7/site-packages/pyelasticsearch

echo "$pgm: linking /opt/kafka-python-0.9/kafka to /opt/Anaconda-2.3.0/lib/python2.7/site-packages/kafka"
ln -s -f /opt/kafka-python-0.9/kafka /opt/Anaconda-2.3.0/lib/python2.7/site-packages/kafka

echo "$pgm: linking /opt/cassandra-driver-3.2.0a1/python2.7/site-packages/cassandra to /opt/Anaconda-2.3.0/lib/python2.7/site-packages/cassandra"
ln -s -f /opt/cassandra-driver-3.2.0a1/python2.7/site-packages/cassandra  /opt/Anaconda-2.3.0/lib/python2.7/site-packages/cassandra

echo "$pgm: linking /opt/pywebhdfs-0.4.1/pywebhdfs to /opt/Anaconda-2.3.0/lib/python2.7/site-packages/pywebhdfs"
ln -s -f /opt/pywebhdfs-0.4.1/pywebhdfs /opt/Anaconda-2.3.0/lib/python2.7/site-packages/pywebhdfs

echo "$pgm: linking /opt/futures-3.0.5/concurrent /opt/Anaconda-2.3.0/lib/python2.7/site-packages/concurrent"
ln -s -f /opt/futures-3.0.5/concurrent /opt/Anaconda-2.3.0/lib/python2.7/site-packages/concurrent

echo "$pgm: linking /opt/jre1.8.0_60/bin/* to /usr/local/bin/"
ln -s -f /opt/jre1.8.0_60/bin/* /usr/local/bin/

echo "$pgm: linking /opt/jre1.8.0_60/lib/amd64/lib* to /usr/local/lib/"
ln -s -f /opt/jre1.8.0_60/lib/amd64/lib* /usr/local/lib/

echo "$pgm: linking /opt/haproxy-1.6.1/usr/local/sbin/haproxy to /usr/local/bin/haproxy"
ln -s -f /opt/haproxy-1.6.1/usr/local/sbin/haproxy /usr/local/bin/haproxy

echo "$pgm: linking /opt/haproxy-1.6.1/usr/local/share/man/man1/haproxy.1 to /usr/local/share/man/man1/haproxy.1"
ln -s -f /opt/haproxy-1.6.1/usr/local/share/man/man1/haproxy.1 /usr/local/share/man/man1/haproxy.1

# Symbolic links don't work because these programs get the spark directory from the path.
for f in pyspark spark-class spark-shell spark-sql spark-submit sparkR; do
  echo "$pgm: creating /usr/local/bin/$f"
  { echo '#!/bin/bash'; echo "exec /opt/spark-1.5.1-bin-hadoop2.6/bin/$f \"\$@\""; } > /usr/local/bin/$f
  chmod 755 /usr/local/bin/$f
done

echo "$pgm: creating /opt/appinsight/server/WorkbenchSparkServerNew.sh"
{ echo '#!/bin/bash'; echo "PYTHONPATH=/opt/appinsight/common /opt/spark-1.5.1-bin-hadoop2.6/bin/spark-submit --jars /opt/commons-csv-1.4/commons-csv-1.4.jar,/opt/spark-csv_2.11-1.4.0.jar /opt/appinsight/server/WorkbenchSparkServerNew.py"; } > /opt/appinsight/server/WorkbenchSparkServerNew.sh
chmod 755 /opt/appinsight/server/WorkbenchSparkServerNew.sh

mkdir -p /usr/local/doc
echo "$pgm: linking /opt/haproxy-1.6.1/usr/local/doc/haproxy to /usr/local/doc/haproxy"
ln -s -f /opt/haproxy-1.6.1/usr/local/doc/haproxy /usr/local/doc/haproxy

if [ -e /etc/default/bigtop-utils ]; then
  # Make a backup copy.
  if [ '!' -e /etc/default/bigtop-utils.orig ]; then
    echo "$pgm: copying /etc/default/bigtop-utils to /etc/default/bigtop-utils.orig"
    cp -p /etc/default/bigtop-utils /etc/default/bigtop-utils.orig
  fi
  # Tell it where to find Java.
  if grep --silent '^# export JAVA_NATIVE_PATH' /etc/default/bigtop-utils; then
    echo "$pgm: updating /etc/default/bigtop-utils"
    sed -i 's+^# *export JAVA_HOME.*$+export JAVA_HOME=/opt/jre1.8.0_60+' /etc/default/bigtop-utils
  fi
fi

# The mysql distribution contains the version number.
if [ -d /usr/local/mysql-5.6.27-linux-glibc2.5-x86_64 -a ! -d /usr/local/mysql ]; then
  echo "$pgm: linking /usr/local/mysql-5.6.27-linux-glibc2.5-x86_64 to /usr/local/mysql"
  ln -s -f /usr/local/mysql-5.6.27-linux-glibc2.5-x86_64 /usr/local/mysql
fi

# Create the mysql group if it doesn't exist.
if ! awk -F: 'BEGIN {rc=1} $1=="mysql" {rc=0} END {exit rc}' /etc/group; then
  echo "$pgm: creating group mysql"
  groupadd --system mysql
fi

# Create the mysql user if it doesn't exist.
if ! awk -F: 'BEGIN {rc=1} $1=="mysql" {rc=0} END {exit rc}' /etc/passwd; then
  echo "$pgm: creating user mysql"
  useradd --system -g mysql mysql
fi

# Set the owner and group of the mysql data directory.
if ! ls -ld /usr/local/mysql/data | awk 'BEGIN {rc=1} $3=="mysql" && $4=="mysql" {rc=0} END {exit rc}'; then
  echo "$pgm: changing user/group of /usr/local/mysql/data to mysql"
  chown -R mysql.mysql /usr/local/mysql/data

  if pushd /usr/local/mysql > /dev/null; then
    echo "$pgm: running mysql_install_db; log is /var/log/mysql_install_db.txt"
    scripts/mysql_install_db --force --user=mysql > /var/log/mysql_install_db.txt 2>&1
    popd > /dev/null
  else
    echo "***** $pgm: error changing directory to /usr/local/mysql"
  fi
fi

# Tell mysqld to listen on all IP addresses so that clients on other machines
# can talk to it.
sed -i -e '/^bind-address *=/d' -e '$a\
bind-address = 0.0.0.0' /usr/local/mysql/my.cnf

echo "$pgm: finished initializing docker image"
