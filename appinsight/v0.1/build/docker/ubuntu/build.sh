#!/bin/bash

# Builds a docker image.

incremental=0
saveflag=1

usage()
{
  echo "usage: $0 [-inc -nosave]"
  echo " -inc: incremental build (not for production use)"
  echo " -nosave: don't save the image to a file (not for production use)"
}

# Check command-line arguments.
while [ $# -gt 0 ]; do
  case "$1" in
    -inc) incremental=1;;
    -nosave) saveflag=0;;
    *) echo "$0: unknown argument '$1'"; usage; exit 2;;
  esac
  shift
done

# Docker image name.
name=appinsight

# Docker doesn't expand .zip files the way it does .tar files, and we
# can't easily expand a .zip file in the container because the base
# ubuntu image doesn't include the unzip program.  So we expand .zip
# files here and tell docker to copy the expanded tree.
rm -rf pyelasticsearch-tmp mysql-tmp kafka-python-tmp
mkdir pyelasticsearch-tmp mysql-tmp kafka-python-tmp
unzip -q -d pyelasticsearch-tmp ../../../vendor/pyelasticsearch-master-2013-09-16.zip
unzip -q -d mysql-tmp ../../../vendor/mysql-connector-python-2.0.3.zip
unzip -q -d kafka-python-tmp ../../../vendor/kafka-python-0.9.zip

# Files that are copied to the image with an ADD command must come from the
# current directory, so make temporary links.  The trap statement below
# deletes the links when the program exits.
VENDOR_FILES="\
aniso8601-0.90.tar.gz \
simplejson-3.3.0.tar.gz \
bottle-0.11.6.tgz \
Paste-2.0.2.tar.gz \
jre-8u60-linux-x64.tar.gz \
mysql-5.6.27-linux-glibc2.5-x86_64.tar.gz \
redis-2.6.14-ubuntu-14.04-x86_64.tar \
Anaconda-2.3.0-ubuntu-14.04-x86_64.tgz \
elasticsearch-1.7.3.tar.gz \
libaio1_0.3.109-4_amd64-ubuntu-14.04.deb \
kafka_2.11-0.9.0.0.tgz \
mongodb-linux-x86_64-3.2.4.tgz \
pymongo-3.2.2.tgz \
datastax-ddc-3.4.0-bin.tar.gz \
cassandra-driver-3.2.0a1.tgz \
futures-3.0.5.tar.gz \
spark-1.5.1-bin-hadoop2.6.tgz \
commons-csv-1.4-bin.tar.gz \
spark-csv_2.11-1.4.0.jar \
spark-streaming-kafka-assembly_2.10-1.5.1.jar \
spark-cassandra-connector-java_2.10-1.5.0-RC1.jar \
haproxy-1.6.1-centos-7.1-x86_64.tgz \
pywebhdfs-0.4.1.tar.gz"
trap 'echo Deleting temporary files; rm -rf $VENDOR_FILES AppInsight.tar pkgs.tar pyelasticsearch-tmp mysql-tmp kafka-python-tmp' 0 1 2 15

tmpdir=../../../tmp/appinsight
rm -rf $tmpdir
mkdir -p $tmpdir
# Get the absolute path to the tmp directory.
if ! abstmpdir=$(pushd $tmpdir > /dev/null && echo $PWD && popd > /dev/null); then
  echo "***** error: can't determine absolute path to temporary directory"
  exit 1
fi
# echo tmpdir=$abstmpdir ### TESTING

# Link the files to $abstmpdir.
if ! pushd ../../../src; then
  echo "***** error: cannot change directory to ../../../src"
  exit 1
fi

if ! cp -rlp common client server $abstmpdir; then
  echo "***** error: cannot copy files from $PWD to $abstmpdir"
  exit 1
fi

popd

ln $PWD/initialize-container.sh $tmpdir/initialize-container.sh
ln $PWD/initialize-image.sh $tmpdir/initialize-image.sh
ln $PWD/haproxy.conf $tmpdir/haproxy.conf
ln $(dirname $(dirname $PWD))/set_default_config_properties.py $tmpdir/server/set_default_config_properties.py
# Combine the sources files into a tar file.
tar cf AppInsight.tar -C $(dirname $tmpdir) $(basename $tmpdir) | exit 1

# Combine the ubuntu packages into a tar file.
echo "making $PWD/pkgs.tar"
tar cf pkgs.tar --exclude 'README*' -C ../../.. vendor/cloudera vendor/ubuntu | exit 1

##### TESTING:
#echo "$abstmpdir:"; find $abstmpdir -type f
#echo "tar file:"; tar xf AppInsight.tar

for f in $VENDOR_FILES; do
# Special cases for files that are too big for GitHub.
  case "$f" in
    Anaconda-2.3.0-ubuntu-14.04-x86_64.tgz)
      if ! cat ../../../vendor/Anaconda-2.3.0-ubuntu-14.04-x86_64-parts/x* > $f; then
        echo "***** error: cannot reconstruct $f from vendor/Anaconda-2.3.0-ubuntu-14.04-x86_64-parts/x*"
        echo "***** PWD: $PWD"
        exit 1
      fi;;
    mysql-5.6.27-linux-glibc2.5-x86_64.tar.gz)
      if ! cat ../../../vendor/mysql-5.6.27-linux-glibc2.5-x86_64-parts/x* > $f; then
        echo "***** error: cannot reconstruct $f from vendor/mysql-5.6.27-linux-glibc2.5-x86_64-parts/x*"
        exit 1
      fi;;
    spark-1.5.1-bin-hadoop2.6.tgz)
      if ! cat ../../../vendor/spark-1.5.1-bin-hadoop2.6-parts/x* > $f; then
        echo "***** error: cannot reconstruct $f from vendor/spark-1.5.1-bin-hadoop2.6-parts/x*"
        exit 1
      fi;;
    *)
      if ! ln ../../../vendor/$f $f; then
        echo "***** error: cannot link  ../../../vendor/$f to $PWD/$f"
        exit 1
      fi
  esac
done

##### TESTING: echo 'after copying vendor files:'; ls -ld $VENDOR_FILES pyelasticsearch-tmp; echo "pyelasticsearch-tmp:"; ls -l pyelasticsearch-tmp

if [ $incremental -eq 0 ]; then
  # Delete a docker image with this name if it already exists.
  if [ -n "$(docker images | awk -v name=$name '$1==name')" ]; then
    echo "deleting existing docker image named $name"
    docker rmi -f "$name"
  fi
fi

# The Dockerfile in this directory describes how to build the image.
echo "docker build -t $name ."
if ! docker build -t "$name" .; then
  echo "$0: error: building the docker image failed"
  exit 1
fi

# Save the image for use on another machine.
output_dir=../../../tmp/appinsight/build/docker/ubuntu
echo "mkdir -p $output_dir"
mkdir -p "$output_dir"
output_file=$output_dir/appinsight-docker-image-ubuntu:14.04.tar
if [ $saveflag -gt 0 ]; then
  echo "docker save appinsight:latest > $output_file"
  docker save appinsight:latest > $output_file
fi
exit 0
