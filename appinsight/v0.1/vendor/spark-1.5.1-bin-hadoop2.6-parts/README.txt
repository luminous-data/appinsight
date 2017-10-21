spark-1.5.1-bin-hadoop2.6.tgz is broken up into pieces
(using split --bytes=50m) because of a GitHub limit
on the size of each file.  To get the original file, run:
cat x* > spark-1.5.1-bin-hadoop2.6.tgz
