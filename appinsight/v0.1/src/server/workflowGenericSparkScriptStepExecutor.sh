#!/bin/sh

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

param="$1"

#~/spark151/spark-1.5.1-bin-hadoop2.6/bin/spark-submit --jars /home/gmulchan/spark151/commons-csv-1.2.jar,/home/gmulchan/spark151/spark-csv_2.10-1.2.0.jar workflowGenericSparkScriptStepExecutor.py "$param"
/opt/spark-1.5.1-bin-hadoop2.6/bin/spark-submit --jars /opt/commons-csv-1.4/commons-csv-1.4.jar,/opt/spark-csv_2.11-1.4.0.jar workflowGenericSparkScriptStepExecutor.py "$param"
