Anaconda-2.3.0-ubuntu-14.04-x86_64.tgz (the compiled version of Anaconda)
is broken up into pieces (using split --bytes=50m) because of a GitHub limit
on the size of each file.  To get the original file, run:
cat x* > Anaconda-2.3.0-ubuntu-14.04-x86_64.tgz
