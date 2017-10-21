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

def strip(field):
    return string.strip(field)

def toLowerCase(field):
    return field.lower()

def concat(f1, f2):
    return f1+f2

def getSelectClause(selectColumns):
    sqlString = 'SELECT '

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

    return sqlString


def appendJoinConditions( sqlString, joinConditions, tableNames ):
    if joinConditions is not None:
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
        sqlString = sqlString + '  ' + tableNames[0] + ' '

    return sqlString

def appendWhereClause(sqlString, whereClause):
    if whereClause != None:
        sqlString = sqlString + '  WHERE  ' + whereClause

    return sqlString

def appendGroupByClause(sqlString, groupByClause):
    if groupByClause is not None:
        sqlString += groupByClause
    return sqlString

def appendLimitByClause(sqlString, limitByClause):
    if limitByClause is not None:
        sqlString += limitByClause
    return sqlString

