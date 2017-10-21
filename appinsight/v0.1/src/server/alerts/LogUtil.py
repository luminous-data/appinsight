#!/usr/bin/env python

#/*************************************************************************
# *
# Copyright 2016 Insightal Inc.

# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
# */

# AppInsight logging utilities.

import logging
import logging.handlers
import os
import errno

######################################################################
#
# Creates a directory and any necessary parent directories, like
# mkdir -p, without complaining if the directory already exists.
#
######################################################################
def mkdir_p(dir):
    try:
        os.makedirs(dir)
    except OSError, ex:
        if ex.errno != errno.EEXIST:
            print "Can't create directory %s: %s", (dir, ex)
            return False
    return True

######################################################################
#
# Creates and returns a logger in $HOME/AppInsight/Logs, creating the
# directory if necessary.
#
######################################################################
def getLogger(programName):
    try:
        homeDir = os.environ['HOME']
    except KeyError:
        homeDir = '.'
    logDir = os.path.join(homeDir, "AppInsight", "logs")
    mkdir_p(logDir)
    logFile = os.path.join(logDir, programName + "-log.txt")
    logger = logging.getLogger(programName)
    logHandler = \
               logging.handlers.TimedRotatingFileHandler(logFile,
                                              when='D',
                                              interval=1,
                                              backupCount=10)
    logFormatter = logging.Formatter('%(asctime)s %(levelname)s %(message)s')
    logHandler.setFormatter(logFormatter)
    logger.addHandler(logHandler)
    logger.setLevel(logging.INFO)
    return logger
