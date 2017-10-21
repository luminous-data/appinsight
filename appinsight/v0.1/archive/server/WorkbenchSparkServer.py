#/*************************************************************************
# *
# * INSIGHTAL CONFIDENTIAL
# * __________________
# *
# *  [2016] - [2017] Insightal Inc
# *  All Rights Reserved.
# *
# * NOTICE:  All information contained herein is, and remains
# * the property of Insightal Incorporated.  The intellectual and technical concepts contained
# * herein are proprietary to Insightal Incorporated
# * and its suppliers and may be covered by U.S. and Foreign Patents,
# * patents in process, and are protected by trade secret or copyright law.
# * Dissemination of this information or reproduction of this material
# * is strictly forbidden unless prior written permission is obtained
# * from Insightal Incorporated.
# */

from pyspark import  SparkContext
from pyspark import SparkConf
from pyspark.sql import SQLContext
from pyspark.sql.functions import upper, initcap
import json
import pandas as pd
import os
from bottle import request, response, route, get, post, abort, run, static_file, hook
import sys, traceback
import datetime
import string
import logging
from logging.handlers import TimedRotatingFileHandler

import workbenchML

'''
from pyspark.mllib.stat import Statistics 
from math import sqrt
import numpy as np
'''

BASE_DIR='/home/gmulchan/insightal/'
ORIGINAL_DIR = BASE_DIR + 'original/'
DERIVED_DIR=BASE_DIR + 'derived/'

MASTER='local'
APPNAME='workbench'

sc = None
sqlContext = None

derivedFileSystem = {}

def strip(field):
    return string.strip(field)

def toLowerCase(field):
    return field.lower()

def concat(f1, f2):
    return f1+f2

@hook('after_request')
def enable_cors():
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'OPTIONS, GET, POST'  
    response.headers['Access-Control-Allow-Headers'] = 'Origin, Accept, Content-Type, X-Requested-With, X-CSRF-Token,X-Auth-Header'    
    response.headers['Access-Control-Expose-Headers'] = 'X-Auth-Header'


@route('/init',method=['OPTIONS','POST'])
def initialize():
    global sc, sqlContext
    try:
        req = request.json
        appName = ''
        if req is not None:
            appName = req.get('name')
            if appName  is None or appName == '':
                appName = 'WorkBenchSparkServer'
        else:
            appName = 'WorkBenchSparkServer'
        conf = SparkConf().setAppName(APPNAME)
        sc = SparkContext('local', appName)
        sqlContext = SQLContext(sc)
        sqlContext.registerFunction('strip', strip)
        sqlContext.registerFunction("toLowerCase", toLowerCase)
        sqlContext.registerFunction("concat", concat)
        print sc
    except Exception, ex:
        print 'There is exception'
        print ex
        logger.exception('Exception: ' + str(ex))


@route('/transform', method=['OPTIONS','POST'])
def transform():
    global sc, sqlContext
    try:
        req = request.json
        tenantId = req.get('tenantId')
        transforms = req.get('transforms')
        inFileInfo = req.get('inFileInfo')
        
        inFilePhysicalPath = req.get('inFilePhysicalPath')
        tableName = req.get('tableName')
        print '######## Table Name is ' + tableName

        outDirPhysicalPath = req.get('outDirPhysicalPath')
        fileFields = inFileInfo['fields']
        
        queryStr = ''
        grpByStr = ''
        filterByStr = ''
        joinStr = ''

        for transform in transforms:
            transformType = transform['type']
            if transformType == 'singleField':
                newFieldName = transform['newFieldName']
                field = transform['field']
                function = transform['function']
		if queryStr == '':
                    queryStr =  function + '(' + field + ')' + ' as ' + newFieldName
		else:
                    queryStr = queryStr + ', ' + function + '(' + field + ')' + ' as ' + newFieldName
            elif transformType == 'multiField':
                newFieldName = transform['newFieldName']
                fields = transform['fields']
                function = transform['function']
                queryStr = queryStr + ', ' + function + '('
                firstField = True
                for field in fields:
                    if firstField:
                        queryStr = queryStr + field
                        firstField = False
                    else:
                        queryStr = queryStr + ',' + field
                queryStr = queryStr + ')' + 'as ' + newFieldName
            elif transformType == 'aggregateBy':
                fields = transform['fields']
                firstField = True
                for field in fields:
                    if firstField:
                        grpByStr = grpByStr + field
                        firstField = False
                    else:
                        grpByStr = grpByStr + ',' + field
            elif transformType == 'filterBy':
                field = transform['field']
                whrc = transform['condition']
		if filterByStr == '':
                    filterByStr =   ' WHERE ' + field  + ' ' + whrc
		else:
                    filterByStr = filterByStr + ' AND ' + field + ' ' + whrc
            elif transformType == 'join':
		ctr = 0
		sets = transform['set']
		#print ' Sets are ' + str(sets)
		for set in sets:
		    print ' Sets are ' + str(set)
		    print ' Table Name is ' + set['tableName'] 
                    joinTable = set['tableName']
                    jTablePath = set['filePath']
                    joinKeys = set['joinKeys']
                    dispFields = set['displayFields']
                    joinType = set['joinType']
                    firstField = True
        	    mydf = sqlContext.load(source="com.databricks.spark.csv", path=str(jTablePath) , header='true' ,inferSchema='true')
        	    mydf.registerTempTable(joinTable)
                    for joinKey in joinKeys:
                        if firstField:
                            joinStr = joinType + ' JOIN ' + joinTable + ' ON ' +  joinKey
                            firstField = False
                        else:
                            joinStr = joinStr + ' AND ' + joinKey
                
                    for dfield in dispFields:
		        queryStr = queryStr + ',' + dfield
		        grpByStr = grpByStr + ',' + dfield
		    ctr = ctr + 1

        print queryStr
        print grpByStr
        print filterByStr

        selectStr = ' SELECT '
        #firstField = True
        #for field in fileFields:
        #    if firstField:
        #        selectStr = selectStr + string.strip(field)
        #        firstField = False
        #    else:
        #        selectStr = selectStr + ',' + string.strip(field)

        print selectStr

        df = sqlContext.load(source="com.databricks.spark.csv", path=inFilePhysicalPath , header='true' ,inferSchema='true')
        df.show()
        df.registerTempTable(tableName)

        if grpByStr == '': 
            selectStr = selectStr + queryStr + ' from `' + tableName + '`' + ' ' + joinStr + ' ' + filterByStr 
	else:
            selectStr = selectStr + queryStr + ',' + grpByStr + ' from `' + tableName + '`' + ' ' + joinStr + ' ' + filterByStr + ' GROUP BY ' + grpByStr
        print selectStr
        newDF = sqlContext.sql(selectStr)
        print outDirPhysicalPath
        newDF.repartition(1).save( outDirPhysicalPath ,'com.databricks.spark.csv', header='true')
        newDF.show()
        resp = json.dumps({'result' : 'success' })
        return resp
    except  Exception, ex:
        print 'There is exception'
        print ex
        logger.exception('Exception: ' + str(ex))


@route('/transform/join', method=['OPTIONS','POST'])
def transformJoin():
    global sc, sqlContext
    try:
        req = request.json
        tenantId = req.get('tenantId')
        transforms = req.get('transforms')
        returnResults = req.get('returnResults')
        outDirPhysicalPath = req.get('outDirPhysicalPath')
        tables = transforms['tables']
        dataFrames = {}

        for table in tables:
            df = sqlContext.load(source="com.databricks.spark.csv", path = table['physicalLoc'], header="true")
            dataFrames[table['name']] = df
            df.registerTempTable(table['name'])

        sqlString = 'SELECT '
        selectColumns = transforms['selectColumns']

        firstColumn  = True
        for columnObj in selectColumns:
            origColumnList = ','.join(columnObj['fieldNames'])
            newColumnName = columnObj['newFieldName']
            function = columnObj.get('function')
            if firstColumn:
                if function != None:
                    sqlString = sqlString + '  ' + function + '(' + origColumnList + ') as ' + newColumnName
                else:
                    sqlString = sqlString + '  ' + origColumnList + ' as ' + newColumnName
                firstColumn = False
            else:
                if function != None:
                    sqlString = sqlString + ' , ' + function + '(' + origColumnList + ') as ' + newColumnName
                else:
                    sqlString = sqlString + ' , ' + origColumnList + ' as ' + newColumnName

        print sqlString
        
        sqlString = sqlString + '  FROM '
        joinConditions = transforms.get('joinConditions')
        if joinConditions != None:
            firstJoin = True
            for joinCondition in joinConditions: 
                leftSideFactor = joinCondition[0]
                rightSideFactor = joinCondition[1]
                leftSideFactorString = leftSideFactor['tableName'] + '.' + leftSideFactor['columnName']
                rightSideFactorString = rightSideFactor['tableName'] + '.' + rightSideFactor['columnName']
                if firstJoin:
                    sqlString = sqlString + leftSideFactor['tableName'] + ' JOIN ' + \
                                rightSideFactor['tableName'] + ' ON ' +  leftSideFactorString + ' = ' + rightSideFactorString
                    firstJoin = False
                else:
                    sqlString = sqlString + '  JOIN ' + rightSideFactor['tableName'] + ' ON ' +  leftSideFactorString + ' = ' + rightSideFactorString
        else:
            # Assume just 1 table
            sqlString = sqlString + '  ' + tables[0]['name'] + ' '

        whereClause = transforms.get('whereConditions')
        if whereClause != None:
            sqlString = sqlString + '  WHERE  ' + whereClause
        print sqlString    
        newDF = sqlContext.sql(sqlString)
        newDF.show()

        if outDirPhysicalPath is not None:
            newDF.repartition(1).save( outDirPhysicalPath ,'com.databricks.spark.csv', header='true')

        resp = {'result' : 'success' }
        if returnResults:
            results = newDF.toJSON().collect()
            resp['data'] = results
        return json.dumps(resp)

    except  Exception, ex:
        print 'There is exception'
        print ex
        logger.exception('Exception: ' + str(ex))


@route('/getStatistics', method=['OPTIONS','POST'])
def getStats():
    global sc, sqlContext
    try:
        req = request.json
        inputDataLocation = req.get('inputDataLocation')
        ignoreColumns = req.get('ignoreColumns', [])
        returnResults = req.get('returnResults', False)
        storeResults = req.get('storeResults', False)
        outDirPhysicalPath = req.get('outDirPhysicalPath', None)
        return workbenchML.getStatistics(inputDataLocation, ignoreColumns, storeResults,
                                         outDirPhysicalPath, returnResults, logger, sc)
    except  Exception, ex:
        print 'There is exception'
        print ex
        logger.exception('Exception: ' + str(ex))

@route('/createRecommendationModel', method=['OPTIONS','POST'])
def createRecommendationModel():
    global sc, sqlContext
    try:
        req = request.json
        inputDataLocation = req.get('inputDataLocation')
        rank = req.get('rank')
        numIterations = req.get('numIterations')
        modelOutputDir = req.get('modelOutputDir')
        return workbenchML.createRecommendationModel(inputDataLocation, rank, numIterations, modelOutputDir, logger, sc, sqlContext)
    except  Exception, ex:
        print 'There is exception'
        print ex
        logger.exception('Exception: ' + str(ex))
    
@route('/transformWithProjections', method=['OPTIONS','POST'])
def transformWithProjections():
    global sc, sqlContext
    try:
        req = request.json
        tenantId = req.get('tenantId')
        transforms = req.get('transforms')

        outDirPhysicalPath = req.get('outDirPhysicalPath')
        tables = transforms['physicalPathTables']
        dfTables = []
        for tablePhysicalPath, tableName in tables.items():
            df = sqlContext.load(source="com.databricks.spark.csv", path=tablePhysicalPath , header='true')
            df.show()
            df.registerTempTable(tableName)
            dfTables.append(df)

        queryStr = ''
        
        for transform in transforms['transforms']:
            transformType = transform['type']
            newFieldName = transform['newFieldName']
            if transformType == 'singleField':
                table = transform['table']
                field = transform['field']
                function = transform['function']
                queryStr = queryStr + ', ' + function + '(' + field + ')' + ' as ' + newFieldName
            elif transformType == 'multiField':
                fields = transform['fields']
                function = transform['function']
                queryStr = queryStr + ', ' + function + '('
                firstField = True
                for field in fields:
                    if firstField:
                        queryStr = queryStr + field
                        firstField = False
                    else:
                        queryStr = queryStr + ',' + field
                queryStr = queryStr + ')' + ' as ' + newFieldName
        
        print queryStr

        selectStr = ' SELECT '
        firstField = True
        for fieldname, display_name in transforms['projections'].items():
            if firstField:
                selectStr = selectStr + string.strip(fieldname) + ' as ' + display_name
                firstField = False
            else:
                selectStr = selectStr + ',' + string.strip(fieldname) + ' as ' + display_name

        print selectStr

        tableString = ''
        isFirstTable = True
        for tablePhysicalPath, tableName in tables.items():
            if isFirstTable:
                tableString = tableName
                isFirstTable = False
            else:
                tableString = tableString + ' , ' + tableName
        
        selectStr = selectStr + queryStr + ' from ' + tableString

        print selectStr
        
        newDF = sqlContext.sql(selectStr)
        print outDirPhysicalPath
        #newDF.save( outDirPhysicalPath ,'com.databricks.spark.csv', header='true')
        results = newDF.toJSON().collect()
        resp = json.dumps({'result' : 'success' , 'data': str(results)})
        return resp
    except  Exception, ex:
        print 'There is exception'
        print ex
        logger.exception('Exception: ' + str(ex))

@route('/executeCustomScript', method=['OPTIONS','POST'])
def executeCustomScript():
    global sc, sqlContext
    try:
        req = request.json
        tenantId = req.get('tenantId')
        scriptLocation = req.get('scriptLocation')
        scriptParams = req.get('scriptParams')
        response = workbenchML.executeCustomScript(scriptParams, scriptLocation, logger, sc, sqlContext)
        json.dumps({'result' : 'success' , 'data': str(response) })
        return response                                        
    except  Exception, ex:
        print 'There is exception'
        print ex                                        
        logger.exception('Exception: ' + str(ex))       
      
@route('/query', method=['OPTIONS','POST'])
def query():
    global sc, sqlContext
    try:
        req = request.json
        tenantId = req.get('tenantId')
        
        tableName = req['tableName']
        tablePhysicalPath = req['physicalLocation']
        isFolder = req['isFolder']
        fields = req['fields']
        
        selectStr = ' SELECT '
        firstField = True
        for fieldname in fields:
            if firstField:
                selectStr = selectStr + string.strip(fieldname)
                firstField = False
            else:
                selectStr = selectStr + ',' + string.strip(fieldname)

        print selectStr

        df = sqlContext.load(source="com.databricks.spark.csv", path=tablePhysicalPath , header='true',inferSchema='true')
        df.show()
        df.registerTempTable(tableName)
        
        selectStr = selectStr + ' from ' + tableName
        newDF = sqlContext.sql(selectStr)
        #print outDirPhysicalPath
        #newDF.save( outDirPhysicalPath ,'com.databricks.spark.csv', header='true')
        results = newDF.toJSON().collect()
        resp = json.dumps({'result' : 'success' , 'data': json.dumps(results)})
        return resp
    except  Exception, ex:
        print 'There is exception'
        print ex
        logger.exception('Exception: ' + str(ex))
        
        #get column list
        #get table name
        #get physical location
        #get where clause
        #construct sql
        #execute sql
        #return result as JSON
        #
    except  Exception, ex:
        print 'There is exception'
        print ex
        logger.exception('Exception: ' + str(ex))
     
def initDerivedDataSets():
    global derivedFileSystem
    try:
        dataSetsFile = open(BASE_DIR + '/deriveddatasets.json', 'r')
        derivedFileSystem = json.load(dataSetsFile)
        dataSetsFile.close()
    except Exception, ex:
        logger.exception('Exception: ' + str(ex))
        derivedFileSystem = {}

def getOriginalDataSets():
    try:
        dataSetsFile = open(BASE_DIR + '/datasets.json', 'r')
        originalFileSystem = json.load(dataSetsFile)
        dataSetsFile.close()
        return originalFileSystem
    except Exception, ex:
        logger.exception('Exception: ' + str(ex))
        


def saveDerivedDataSets():
    global fileSystem
    dataSetsFile = open(BASE_DIR + 'deriveddatasets.json', 'w')
    print str(json.dumpsderivedFileSystem())
    dataSetsFile.write(json.dumps(derivedFileSystem))
    dataSetsFile.close()


logger = logging.getLogger('WorkbenchSparkServer')
logHandler = TimedRotatingFileHandler( BASE_DIR + '/sparkWorkbenchServer.log', when='D', interval=1, backupCount=10)
logFormatter = logging.Formatter('%(asctime)s %(levelname)s %(message)s')
logHandler.setFormatter(logFormatter)
consoleHandler = logging.StreamHandler()
consoleHandler.setFormatter(logFormatter)
logger.addHandler(consoleHandler)
logger.addHandler(logHandler)
logger.setLevel(logging.DEBUG)


'''   
def testGetStats():
    global sc, sqlContext
    print getStatistics('/home/gmulchan/insightal/original/inputStatsData1-67d2a3c1-a316-4dec-a69f-602bda7d518f/inputDataForStats.txt-683543e0-14b4-4614-bae4-c38f50ba49da',
                              [1,2,3,41], False, None, True, logger)
'''

def testGetCovariance():
    workbenchML.getCovariance('/home/gmulchan/d',0,1, logger, sc,sqlContext)

def testCreateRecommendationModel():
    result = workbenchML.createRecommendationModel('/home/gmulchan/spark151/spark-1.5.1-bin-hadoop2.6/data/mllib/als/test.data',
                        10, 10, '/home/gmulchan/testCollaborativeFilter', logger, sc,sqlContext)
    
def testMLLibScript():
    result = workbenchML.executeCustomScript({},
                                             '/home/gmulchan/work/appinsight/appinsight/v0.1/src/tests/mllibtestscript1.py',
                                             logger, sc, sqlContext)
    

def main():
    run(host='0.0.0.0', port=6950, debug=True, reloader=False)

def main2():
    initialize()
    main()
    #testGetStats()
    #testGetCovariance()
    #testCreateRecommendationModel()
    #testMLLibScript()

    
if __name__ == '__main__':
    try:
        main2()
    except KeyboardInterrupt:
        sys.exit(0)
    sys.exit(1)
