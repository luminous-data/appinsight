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


from pyspark.mllib.stat import Statistics 
from math import sqrt
import numpy as np
import json
import schemaObjects
from pyspark.mllib.recommendation import ALS, MatrixFactorizationModel, Rating
import imp, os
from importlib import import_module

def getVectorData(line, ignoreColumns = []):
    line_split = line.split(",")
    # keep just numeric and logical values
    clean_line_split = [item for i,item in enumerate(line_split) if i not in ignoreColumns]
    return np.array([float(x) for x in clean_line_split])

def getStatistics( inputDataPhysicalLoc, ignoreColumns, storeOutput, \
                   outputLocation, returnResults, logger, sc, hdfsConn):
    try:
        logger.info('The input data location is ' + inputDataPhysicalLoc)
        inputData = sc.textFile(inputDataPhysicalLoc)
        logger.info('The input data is '  + str(inputData) )
        vectorData = inputData.map(lambda j: getVectorData(j, ignoreColumns))
        summaryStats = Statistics.colStats(vectorData)
        mean = summaryStats.mean()
        variance = summaryStats.variance()
        numNonZeros = summaryStats.numNonzeros()
        results = [mean.tolist(),variance.tolist(), numNonZeros.tolist()]
        if storeOutput:
            pass
        resp = {'result' : 'success' }
        if returnResults is not None and (returnResults is True or returnResults == 'True'):
            resp['data'] = results
        logger.info('Returning data ' + json.dumps(resp))
        return json.dumps(resp)
    except Exception, ex:
        print 'There is exception'
        print ex
        logger.exception('Exception in getStatistics: ' + str(ex))
        return json.dumps({'result': 'failure' , 'exception' : str(ex) })

def rddTranspose(rdd):
    rddT1 = rdd.zipWithIndex().flatMap(lambda (x,i): [(i,j,e) for (j,e) in enumerate(x)])
    rddT2 = rddT1.map(lambda (i,j,e): (j, (i,e))).groupByKey().sortByKey()
    rddT3 = rddT2.map(lambda (i, x): sorted(list(x), cmp=lambda (i1,e1),(i2,e2) : cmp(i1, i2)))
    rddT4 = rddT3.map(lambda x: map(lambda (i, y): y , x))
    return rddT4.map(lambda x: np.asarray(x))

def getCovariance(inputDataPhysicalLoc, columnX, columnY , logger, sc, sqlContext):
    try:
        df = sqlContext.load(source="com.databricks.spark.csv", path = inputDataPhysicalLoc, header='true', inferSchema='true')
        df.registerTempTable('test')
        covariance = df.stat.cov('vmem', 'pmem')
        correlation = df.stat.corr('vmem', 'pmem')

        #correlation = Statistics.corr(seriesX, seriesY, method="pearson")
        print 'The covariance is ' + str(covariance)
        print 'The correlation is ' + str(correlation)
        return { 'covariance' : covariance , 'correlation' : correlation }
    except Exception, ex:
        print 'There is exception'
        print ex
        logger.exception('Exception: ' + str(ex))
        return json.dumps({'result': 'failure' , 'exception' : str(ex) })
        
def createRecommendationModel(  inputDataPhysicalLoc , rank, numIterations, modelOutputLocation,
                                logger, sc, sqlContext, hdfsConn):
    try:
        data = sc.textFile( inputDataPhysicalLoc )
        ratings = data.map(lambda l: l.split(',')).map(lambda l: Rating(int(l[0]), int(l[1]), float(l[2])))
        model = ALS.train(ratings, rank, numIterations)
        model.save(sc, modelOutputLocation)
        resp = {'result' : 'success' }
        return json.dumps(resp)
    except Exception, ex:
        print 'There is exception'
        print ex
        logger.exception('Exception: ' + str(ex))
        return json.dumps({'result': 'failure' , 'exception' : str(ex) })
    

def executeCustomScript(req, logger, sc, sqlContext):
    try:
        logger.info('Calling script ' + scriptPath)
        fileContents = schemaObjects.getFile(req)
        params = req.get('params')
        moduleName = os.path.basename(os.path.splitext(scriptPath)[0])
        pluginModule = imp.new_module(moduleName)
        exec fileContents in pluginModule.__dict__
        response = pluginModule.execute(params, logger, sc, sqlContext)
        return response
    except Exception, ex:
        print 'There is exception'
        print ex
        logger.exception('Exception: ' + str(ex))
        return json.dumps({'result': 'failure' , 'exception' : str(ex) })
        
        	    
    
