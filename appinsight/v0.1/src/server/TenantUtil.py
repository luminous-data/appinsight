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

# AppInsight database interface.

import sys
import hashlib
import os
import re
import uuid
import traceback
import json
import datetime

######################################################################
#
# Class used for database exceptions.  This insulates applications
# from DBMS-specific classes.
#
######################################################################
class DatabaseError(StandardError):
    def __init__(self, message):
        super(DatabaseError, self).__init__(message)

######################################################################
#
# Class used for database integrity exceptions, such as a duplicate
# value for a column that is UNIQUE or PRIMARY KEY.  This insulates
# applications from DBMS-specific classes.
#
######################################################################
class DatabaseIntegrityError(DatabaseError):
    def __init__(self, message):
        super(DatabaseIntegrityError, self).__init__(message)

# Read the configuration file.
if '../common' not in sys.path:
    sys.path.insert(0, '../common')

import ConfigFile
_Config = ConfigFile.readConfigFile()

# Database driver name.
_DbDriverName = None

# Database top-level exception class.
_DbExceptionClass = None

# Database integrity error -- used when trying to assign a duplicate value
# for a column that is UNIQUE or PRIMARY KEY.
_DbIntegrityExceptionClass = None

# The Python database access module.  Used for attributes that are
# common across different modules, such as paramstyle.
_DbDriverModule = None

# SQL statement parameter replacement type.  See:
# http://www.python.org/dev/peps/pep-0249/
_ParamStyle = None

# Parameters for connecting to a database.  The type depends on the DBMS.
_DbParams = None

######################################################################
#
# Gets database parameters from the configuration files.
# Sets the following globals:
#   _DbDriverName: the name of the driver class
#   _DbDriverModule: the Python module corresponding to _DbDriverName
#   _DbExceptionClass: the _DbDriverModule module's top-level exception class
#   _DbParams: parameters for connecting to the databawse
#   _ParamStyle: _DbDriverModule.paramstyle (see pep-0249)
# Defines a function connectToDb() that connects to the
# appropriate database.
#
######################################################################
def _getDb():
    global _DbDriverName, _DbDriverModule, _DbExceptionClass
    global _DbParams, _ParamStyle
    global _Config
    global connectToDb

    # Define a default function that raises an exception.
    # It will be redefined if the database parameters are correctly
    # specified in the configuration file.
    def connectToDb():
        'Default connectToDb()'
        raise DatabaseError('"driver" is undefined the [db] section of the configuration file or is invalid')

    # Define a default function that commits the current transacion
    # for a database connection.
    global commitDb
    def commitDb(dbConn):
        'Default commitDb()'
        dbConn.commit()

    # Find out what dbms to use.
    _DbDriverName = ConfigFile.getStringValue(_Config, 'db', 'driver', '')

    knownDbDriverNames = ('apsw', 'mysql.connector')

    # sqlite3 (interface to sqlite) -- no longer supported.
    if _DbDriverName == 'sqlite3':
        raise DatabaseError('The sqlite3 Python module is no longer supported.  Use apsw isntead.')

    # apsw (interface to sqlite) -- replacement for sqlite3.
    elif _DbDriverName == 'apsw':
        try:
            import apsw
            global apsw
        except ImportError:
            raise DatabaseError('Cannot find the apsw module.  Please get it from https://github.com/rogerbinns/apsw and install it.')
        _DbDriverModule = apsw
        _DbExceptionClass = apsw.Error
        _DbIntegrityExceptionClass = apsw.ConstraintError
        # Database file.
        # TODO: decide where it should go.  For now, use the user's
        # home directory.
        try:
            homeDir = os.environ['HOME']
        except KeyError:
            homeDir = '.'
        _DatabasePath = os.path.join(homeDir, 'AppSenseDB.sqlite')
        _DbParams = _DatabasePath
        # The apsw module does not define paramstyle, but it supports
        # qmark among others.
        _ParamStyle = 'qmark'

        def connectToDb():
            'Connect to a sqlite file.  Converts database exceptions to TenantUtil.DatabaseError exceptions.'
            try:
                return apsw.Connection(_DatabasePath)
            except _DbExceptionClass, ex:
                raise DatabaseError("sqlite error: %s" % ex)

        # Redefine commitDb to do nothing.  Apparently apsw does not
        # implement or require calling commit().
        def commitDb(dbConn):
            'Dummy commitDb() for apsw'
            pass

        # See if this is an old database.  The previous schema was designed
        # for an older version of sqlite that didn't implement cascading
        # delete, so is used triggers for that purpose, but they were not
        # compatible with MySql.
        dbConn = connectToDb()
        try:
            cursor = dbConn.cursor()
            cursor.execute("select count(*) from sqlite_master where type = 'trigger' and name='tenants_constraint'")
            rows = cursor.fetchall()
        except _DbExceptionClass, ex:
            raise DatabaseError(ex)
        finally:
            dbConn.close()
        if not rows or rows[0][0] != 0:
            raise DatabaseError('Your database is out of data and needs to be re-created.')

    # MySql.
    elif _DbDriverName == 'mysql.connector':
        try:
            import mysql.connector
        except ImportError:
            raise DatabaseError('Cannot find the mysql.connector module.  Please get it from http://dev.mysql.com/doc/connector-python/en/index.html and install it.')
        _DbDriverModule = mysql.connector
        _DbExceptionClass = mysql.connector.errors.Error
        _DbIntegrityExceptionClass = mysql.connector.errors.IntegrityError
        _DbParams = {}
        _ParamStyle = _DbDriverModule.paramstyle
        # Get the user, password, database, and host for MySql.
        for name in ('user', 'password', 'database', 'host'):
            value = ConfigFile.getStringValue(_Config, 'db', name, '')
            if not value:
                raise DatabaseError('"%s" is undefined in the [db] section of the configuration file' % name) 
            _DbParams[name] = value

        def connectToDb():
            'Connecto to a MySql server.  Converts database exceptions to TenantUtil.DatabaseError exceptions.'
            try:
                return _DbDriverModule.connect(**_DbParams)
            except _DbExceptionClass, ex:
                raise DatabaseError("mysql.connector error: %s" % ex)

    # Unknown value specified for database driver.
    elif _DbDriverName:
        raise DatabaseError('"driver" value "%s" is unknown in the [db] section of the configuration file; recognized values are: %s' % \
                           (_DbDriverName, ' '.join(knownDbDriverNames)))

    # Undefined value for database driver.
    else:
        raise DatabaseError('"driver" is undefined in the [db] section of the configuration file')

    # Make sure we recognize the database driver's parameter style.
    # See http://www.python.org/dev/peps/pep-0249/
    knownParamStyles = ('pyformat', 'qmark')
    if _ParamStyle not in knownParamStyles:
        raise DatabaseError('Unknown paramstyle "%s" in database driver %s: recognized values are: %s' % \
                           (_ParamStyle, _DbDriverModule.__package__,
                            ' ',join(knownParamStyles)))

    # print 'DB driver module:', _DbDriverModule.__package__ # for testing
    # print '_ParamStyle:', _ParamStyle # for testing

######################################################################
#
# Creates a unique 36-byte ASCII string to use as a database id.
#
######################################################################
def newId():
    return str(uuid.uuid4())

######################################################################
#
# This database uses the following schema:
#
######################################################################

_Utf8Stmt = '''PRAGMA encoding = "UTF-8"'''

_ForeignKeysOnStmt = '''PRAGMA foreign_keys = ON'''

# Create a table for miscellaneous configuration information.
# Currently the only entry is the database schema version.
# This can be used later for updating the database when the
# schema changes.
_CreateUtilTableStmt = '''CREATE TABLE util(name VARCHAR(36) PRIMARY KEY, value VARCHAR(255))'''
_DatabaseSchemaVersion = 3
_AddDatabaseSchemaVersionStmt = '''INSERT INTO util(name, value) VALUES('dbschema', '%s')''' % _DatabaseSchemaVersion

# Create a table for configuration entries.  The configuration properties themselves
# are in a separate table; this table groups sets of properties so that there can be
# more than one entry for the same component.
_CreateConfigsTableStmt = '''CREATE TABLE configs(componentName VARCHAR(255) NOT NULL, instanceName VARCHAR(255) NOT NULL, PRIMARY KEY(componentName, instanceName))'''

# Create a table for configuation properties.  No properties are predefined; each component
# can have any name/value pairs.
_CreateConfigPropertiesTableStmt = '''CREATE TABLE config_properties(componentName VARCHAR(255) NOT NULL, instanceName VARCHAR(255) NOT NULL, propName VARCHAR(255) NOT NULL, propValue VARCHAR(255) NOT NULL, FOREIGN KEY(componentName, instanceName) REFERENCES configs(componentName, instanceName) ON DELETE CASCADE)'''

# Create the tenants table.  The name has type VARCHAR because MySql doesn't
# allow TEXT with UNIQUE.
_CreateTenantsTableStmt = '''CREATE TABLE tenants(id CHAR(36) PRIMARY KEY, name VARCHAR(255) UNIQUE, email TEXT, passwordHash TEXT NOT NULL)'''

# Create the users table.
_CreateUsersTableStmt = '''CREATE TABLE users(id CHAR(36) PRIMARY KEY, name VARCHAR(255) UNIQUE NOT NULL, email TEXT, passwordHash TEXT NOT NULL, tenantId CHAR(36) NOT NULL, role INTEGER NOT NULL, FOREIGN KEY(tenantId) REFERENCES tenants(id) ON DELETE CASCADE)'''

# Values for the role column in the users table:
_ROLE_USER = 1
_ROLE_TENANT_ADMIN = 2
_ROLE_SITE_ADMIN = 4

# Create the groups table.
_CreateGroupsTableStmt = '''CREATE TABLE groups(id CHAR(36) PRIMARY KEY, tenantId CHAR(36) NOT NULL, name TEXT NOT NULL, FOREIGN KEY(tenantId) REFERENCES tenants(id) ON DELETE CASCADE)'''

# Create the applications table.
_CreateApplicationsTableStmt = '''CREATE TABLE applications(id CHAR(36) PRIMARY KEY, groupId CHAR(36) NOT NULL, name TEXT NOT NULL, FOREIGN KEY(groupId) REFERENCES groups(id) ON DELETE CASCADE)'''

# Create the collections table.
_CreateCollectionsTableStmt = '''CREATE TABLE collections(id CHAR(36) PRIMARY KEY, applicationId CHAR(36) NOT NULL, name TEXT NOT NULL, FOREIGN KEY(applicationId) REFERENCES applications(id) ON DELETE CASCADE)'''

# Create the search_indices table.  Each row corresponds to an ElasticSearch
# index.  The name column is the ElasticSearch index name.
_CreateSearchIndicesTableStmt = '''CREATE TABLE search_indices(id CHAR(36) PRIMARY KEY, collectionId CHAR(36) NOT NULL, name TEXT NOT NULL, FOREIGN KEY(collectionId) REFERENCES collections(id) ON DELETE CASCADE)'''

# Create the logfiles table.  It tells logStash what log files to read.
_CreateLogFileTableStmt = '''CREATE TABLE logfiles(id CHAR(36) PRIMARY KEY, collectionId CHAR(36) NOT NULL, path TEXT NOT NULL, logfileType TEXT NOT NULL, FOREIGN KEY(collectionId) REFERENCES collections(id) ON DELETE CASCADE)'''

# Create the dashboards table.
_CreateDashboardsTableStmt = '''CREATE TABLE dashboards(id CHAR(36) PRIMARY KEY, userId CHAR(36) NOT NULL, name TEXT NOT NULL, dashboard TEXT NOT NULL, FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE)'''

# Create the plugins table.
# If you change this, check the 'ALTER TABLE plugins' statement also.
# There is no default because some versions of MySql don't allow a default with LONGTEXT.
_CreatePluginsTableStmt = '''CREATE TABLE plugins(id CHAR(36) PRIMARY KEY, name TEXT NOT NULL, tenantId CHAR(36) NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, code LONGTEXT)'''

# Create a table that shows what doctypes apply to a plugin.
_CreatePluginDoctypesTableStmt = '''CREATE TABLE plugindoctypes(pluginId CHAR(36) NOT NULL, doctype TEXT NOT NULL, FOREIGN KEY(pluginId) REFERENCES plugins(id) ON DELETE CASCADE)'''

# Create a table that shows what collections apply to a plugin.
# It doesn't need an id column.
_CreatePluginCollectionsTableStmt = '''CREATE TABLE plugincollections(pluginId CHAR(36) NOT NULL, collectionId CHAR(36) NOT NULL, FOREIGN KEY(pluginId) REFERENCES plugins(id) ON DELETE CASCADE, FOREIGN KEY(collectionId) REFERENCES collections(id) ON DELETE CASCADE)'''

# Create a table that shows what applications apply to a plugin.
# It doesn't need an id column.
_CreatePluginApplicationsTableStmt = '''CREATE TABLE pluginapplications(pluginId CHAR(36) NOT NULL, applicationId CHAR(36) NOT NULL, FOREIGN KEY(pluginId) REFERENCES plugins(id) ON DELETE CASCADE, FOREIGN KEY(applicationId) REFERENCES applications(id) ON DELETE CASCADE)'''

# Create a table that shows what groups apply to a plugin.
# It doesn't need an id column.
_CreatePluginGroupsTableStmt = '''CREATE TABLE plugingroups(pluginId CHAR(36) NOT NULL, groupId CHAR(36) NOT NULL, FOREIGN KEY(pluginId) REFERENCES plugins(id) ON DELETE CASCADE, FOREIGN KEY(groupId) REFERENCES groups(id) ON DELETE CASCADE)'''

# Create a table that shows what tenants apply to a plugin.
# It doesn't need an id column.
_CreatePluginTenantsTableStmt = '''CREATE TABLE plugintenants(pluginId CHAR(36) NOT NULL, tenantId CHAR(36) NOT NULL, FOREIGN KEY(pluginId) REFERENCES plugins(id) ON DELETE CASCADE, FOREIGN KEY(tenantId) REFERENCES tenants(id) ON DELETE CASCADE)'''

# The tenantaggregationcriteria table is used in searching.
# The expr column has a string representing a JSON array of objects
# (corresponding to a Python list of dictionaries).
# The enabled column is 1 for enabled and 0 for disabled.
# Each doctype/tenantId pair should have exactly one row for
# every doctype used by the tenant.
_CreateTenantAggregationCriteriaTableStmt = '''CREATE TABLE tenantaggregationcriteria(doctype VARCHAR(255) NOT NULL, tenantId CHAR(36) NOT NULL, expr TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, PRIMARY KEY (doctype, tenantId), FOREIGN KEY(tenantId) REFERENCES tenants(id) ON DELETE CASCADE)'''

# Entries from the allaggregationcriteria table are included in addition to
# entries for each tenant's id in tenantaggregationcriteria.
_CreateAllAggregationCriteriaTableStmt = '''CREATE TABLE allaggregationcriteria(doctype VARCHAR(255) PRIMARY KEY, expr TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1)'''

# Entries from the defaultaggregationcriteria table are used to initialize
# new entries in the tenantaggregationcriteria table when a new tenant is
# created.
_CreateDefaultAggregationCriteriaTableStmt = '''CREATE TABLE defaultaggregationcriteria(doctype VARCHAR(255) PRIMARY KEY, expr TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1)'''

# The following statements are used to initialize the allaggregationcriteria
# table.
_AddAggregationCriteriaAllForApacheAccessStmt = '''INSERT INTO allaggregationcriteria(doctype, expr, enabled) VALUES('apacheAccess', '[{"field": "http_status", "type": "terms", "name": "apacheAccess_http_status_agg"}]', 1)'''

_AddAggregationCriteriaAllForCpuStmt = '''INSERT INTO allaggregationcriteria(doctype, expr, enabled) VALUES('cpu', '[]', 1)'''

_AddAggregationCriteriaAllForNoneStmt = '''INSERT INTO allaggregationcriteria(doctype, expr, enabled) VALUES('none', '[{"field": "_type", "type": "terms", "name": "none_doctype_agg"}, {"field": "@timestamp", "type": "range", "name": "none_date_range_agg"}]', 1)'''

_AddAggregationCriteriaAllForJavaStmt = '''INSERT INTO allaggregationcriteria(doctype, expr, enabled) VALUES('Java', '[{"field": "level", "type": "terms", "name": "Java_msg_level_agg"}]', 1)'''

# TODO: add constraints to disallow adding two entries with the same
# name and parent, e.g. two groups with the same name in the same tenant,
# but two groups with the same name in different tenants are OK.

# TODO: create indexes for performance improvement

# List of SQL statements to run to create database tables and constraints
# for sqlite.
_CreateSqliteTableStmts = [
    _Utf8Stmt,
    _ForeignKeysOnStmt,
    _CreateUtilTableStmt,

    _CreateConfigsTableStmt,
    _CreateConfigPropertiesTableStmt,

    _CreateTenantsTableStmt,
    _CreateUsersTableStmt,
    _CreateGroupsTableStmt,
    _CreateApplicationsTableStmt,
    _CreateCollectionsTableStmt,
    _CreateSearchIndicesTableStmt,
    _CreateLogFileTableStmt,
    _CreateDashboardsTableStmt,

    _CreatePluginsTableStmt,
    _CreatePluginDoctypesTableStmt,
    _CreatePluginCollectionsTableStmt,
    _CreatePluginApplicationsTableStmt,
    _CreatePluginGroupsTableStmt,
    _CreatePluginTenantsTableStmt,

    _CreateTenantAggregationCriteriaTableStmt,
    _CreateAllAggregationCriteriaTableStmt,
    _CreateDefaultAggregationCriteriaTableStmt,
]

# List of SQL statements to run to create database tables and constraints
# for MySql.
_CreateMySqlTableStmts = [
    _CreateUtilTableStmt,

    _CreateConfigsTableStmt,
    _CreateConfigPropertiesTableStmt,

    _CreateTenantsTableStmt,
    _CreateUsersTableStmt,
    _CreateGroupsTableStmt,
    _CreateApplicationsTableStmt,
    _CreateCollectionsTableStmt,
    _CreateSearchIndicesTableStmt,
    _CreateLogFileTableStmt,
    _CreateDashboardsTableStmt,

    _CreatePluginsTableStmt,
    _CreatePluginDoctypesTableStmt,
    _CreatePluginCollectionsTableStmt,
    _CreatePluginApplicationsTableStmt,
    _CreatePluginGroupsTableStmt,
    _CreatePluginTenantsTableStmt,

    _CreateTenantAggregationCriteriaTableStmt,
    _CreateAllAggregationCriteriaTableStmt,
    _CreateDefaultAggregationCriteriaTableStmt,
]

# List of SQL statements to create initial values in tables.
_InitializeTableStmts = [
    _AddDatabaseSchemaVersionStmt,

    _AddAggregationCriteriaAllForApacheAccessStmt,
    _AddAggregationCriteriaAllForCpuStmt,
    _AddAggregationCriteriaAllForNoneStmt,
    _AddAggregationCriteriaAllForJavaStmt,
]

######################################################################
#
# Creates the database.  May throw database exceptions.
#
######################################################################
def createDb(initialize):
    # TODO: add logging
    #
    if _DbDriverName == 'apsw':
        stmts = _CreateSqliteTableStmts
        version = apsw.sqlitelibversion()   # sqlite version, e.g. '3.8.9'
        vf = version.split('.')  # version fields, e.g. ['3','8','9']
        try:
            vf = [int(x) for x in vf] # interpret as integers, e.g. [3,8,9]
        except ValueError:
            vf = []
        if len(vf) < 2:
            raise DatabaseError('Cannot determine sqlite version number: %s' % version)
        # Check for version 3.6.19 or higher.
        if vf[0] < 3 or \
           (vf[0] == 3 and vf[1] < 6) or \
           (len(vf) >= 3 and vf[0] == 3 and vf[1] == 6 and vf[2] < 19):
                raise DatabaseError('You must install sqlite version 3.6.19 or later')

    elif _DbDriverName == 'mysql.connector':
        stmts = _CreateMySqlTableStmts
    else:
        raise DatabaseError('unknown DBMS "%s"' % _DbDriverName)
    if initialize:
        stmts += _InitializeTableStmts
    _runSimpleSqlStmts(stmts)

    if initialize:
        # Create the SiteAdmin tenant.
        tenantId = addTenant('SiteAdmin', None, 'root@localhost', passwordHash='3517e8db172e8d0db2ab5fa0db6d47ef85e58e128f099bc02a987598')

        # Create the SiteAdmin user.
        userId = newId()
        addUser('SiteAdmin', 'root@localhost', None, tenantId, _ROLE_SITE_ADMIN, passwordHash='3517e8db172e8d0db2ab5fa0db6d47ef85e58e128f099bc02a987598')


######################################################################
#
# Gets the number of rows changed by the most recent SQL
# INSERT, UPDATE, or DELETE statement
#
######################################################################
def getChangedRows(dbConn, cursor):
    if _DbDriverName == 'apsw':
        # apsw does not define rowcount.
        return dbConn.changes()

    return cursor.rowcount  # defined in pep-0249

######################################################################
#
# Converts occurrences of "??" to the value for the specified DBMS:
# "?" for sqlite and "%s" for MySql.  We use "??" internally because
# it is very unlikely to be part of a valid SQL statement.
#
######################################################################
def _convertParams(stmt):
    # The value of _ParamStyle has already been checked.
    if _ParamStyle == 'qmark':
        return stmt.replace("??","?")
    elif _ParamStyle == 'pyformat':
        return stmt.replace("??","%s")
    return stmt

######################################################################
#
# Runs SQL statements with no variables, ignoring errors about tables
# or triggers that already exist.
#
#  stmts: a sequence of SQL statements
#
######################################################################
def _runSimpleSqlStmts(stmts):
    # TODO: add logging

    # Compile regular expressions that look for error messages of the
    # form "table NAME already exists" and "trigger NAME already exists".
    tableExistsRe=re.compile(r'table ([^ ]*) already exists', re.I)
    triggerExistsRe=re.compile(r'trigger ([^ ]*) already exists', re.I)

    dbConn = connectToDb()
    try:
        cursor = dbConn.cursor()
        for stmt in stmts:
            try:
                print "executing: ", stmt
                cursor.execute(stmt)
            except Exception, ex:
                # Not an error if a table or trigger  already exists.  (If a
                # table's columns change, you need to manually alter the table
                # or delete it so that it will be re-created.)
                if tableExistsRe.match(ex.message) or \
                       triggerExistsRe.match(ex.message):
                    print ex.message, '(not an error)'
                else:
                    print '*** ERROR:', ex
        commitDb(dbConn)
    finally:
        dbConn.close()
    return True

######################################################################
# Updates table definitions if necessary.
# Returns true on success.
######################################################################
def updateTables(logger=None):
    if not logger: ### TESTING
        import logging
        logger = logging.getLogger('TenantUtil')
        logger.addHandler(logging.StreamHandler())

    # Keep updating the database schema until it has the right version.
    while True:
        currentDbSchemaVersion = getDbSchemaVersion(logger)
        if not currentDbSchemaVersion:
            return False
        if currentDbSchemaVersion == _DatabaseSchemaVersion:
            print 'Database schema is up to date'
            break
        nextDbSchemaVersion = currentDbSchemaVersion + 1
        print 'Updating from database schema %d to %d' % \
              (currentDbSchemaVersion, nextDbSchemaVersion)
        # Look for a function named updateDbSchema_X_to_Y_ where X is the current schema
        # version and Y is the current schema version plus 1.
        # Each update function is responsible for updating the 'dbschema' entry in the
        # util table.
        try:
            func = eval('updateDbSchema_%d_to_%d_' % \
                        (currentDbSchemaVersion, nextDbSchemaVersion))
    
        except NameError:
            print 'Cannot find a function to update database schema from version %s to version %s' % \
                      (currentDbSchemaVersion, nextDbSchemaVersion)
            if logger:
                logger.error('Cannot find a function to update database schema from version %s to version %s' % \
                      (currentDbSchemaVersion, nextDbSchemaVersion))
            return False

        print 'Calling %s to update the database schema from version %d to version %d' % \
              (func.__name__, currentDbSchemaVersion, nextDbSchemaVersion)
        if not func(logger):
            print 'Error updating database schema from version %d to version %d' % \
                  (currentDbSchemaVersion, nextDbSchemaVersion)
            return False

######################################################################
# Updates database schema version 1 to 2, and copies the configuration
# (except for the database) from the local file to the database.
######################################################################
def updateDbSchema_1_to_2_(logger=None):
    dbConn = connectToDb()
    try:
        cursor = dbConn.cursor()

        print 'Creating the configs table'
        _runDbStmtAndLog(cursor, logger, _CreateConfigsTableStmt, None)

        print 'Creating the config_properties table'
        _runDbStmtAndLog(cursor, logger, _CreateConfigPropertiesTableStmt, None)

        print 'Copying the configuration from the local file to the database'
        copyConfigParamsFromFileToDb(cursor, logger)

        print 'Updating the database schema version to 2'
        _runDbStmtAndLog(cursor, logger,
                         'UPDATE util SET value = "2" WHERE name = "dbschema"', None)
        commitDb(dbConn)
    finally:
        dbConn.close()
    return True

######################################################################
# Copies configuration data (except for the database entries) from the
# local config file to the database.  This does not remove the entries
# from the config file, but they will no longer be used.
######################################################################
def copyConfigParamsFromFileToDb(cursor, logger):
    sections = _Config.sections()
    for section in sections:
        # Ignore the 'db' section; it stays in the local config file.
        if section == 'db':
            continue
        copyConfigParamsFromFileToDbForSection(cursor, logger, section)

######################################################################
# Copies configuration data for the named section from the local
# config file to the database.  This does not remove the entries
# from the config file, but they will no longer be used.
######################################################################
def copyConfigParamsFromFileToDbForSection(cursor, logger, section):
    items = _Config.items(section)
    # Add an entry to the configs table, using the section name as the component name
    # and 'default' as the instance name.
    componentName = section
    instanceName = 'default'
    print 'Adding %s/%s to the configs table' % (componentName, instanceName)
    _runDbStmtAndLog(cursor, logger,
                     'INSERT INTO configs(componentName, instanceName) VALUES(??,??)',
                     (componentName, instanceName))

    # For each item in the named section, add an entry to the config_properties table,
    # using the section name as the component name, 'default' as the instance name,
    # and the name and value in the config file as the property name and value.
    for item in items:
        # Each item should be a name/value pair.
        if len(item) != 2:
            print 'Unknown item in section [%s] in config file: %s' % \
                  (section, item)
            if logger:
                logger.error('Unknown item in section [%s] in config file: %s' % \
                             (section, item))
        else:
            (propName, propValue) = item
            print '  Adding %s/%s to the config_properties table' % (propName, propName)
            _runDbStmtAndLog(cursor, logger,
                             'INSERT INTO config_properties(componentName, instanceName, propName, propValue) VALUES(??,??,??,??)',
                             (componentName, instanceName, propName, propValue))


######################################################################
# Updates database schema version 2 to 3, adds a "code" column to
# the "plugins" table, and copies each plugin from its file to this
# column.
######################################################################
def updateDbSchema_2_to_3_(logger=None):
    dbConn = connectToDb()
    try:
        cursor = dbConn.cursor()

        print 'Adding a "code" column to the plugins table'
        # If you change the following sql statement, check _CreatePluginsTableStmt also.
        _runDbStmtAndLog(cursor, logger,
                         'ALTER TABLE plugins ADD COLUMN code LONGTEXT',
                         None)

        # Copy the plugins to the database.
        copyPluginsFromFilesToDb(cursor, logger) 

        print 'Updating the database schema version to 3'
        _runDbStmtAndLog(cursor, logger,
                         'UPDATE util SET value = "3" WHERE name = "dbschema"', None)
        commitDb(dbConn)
    finally:
        dbConn.close()
    return True

######################################################################
# Copies each plugin from its file to the 'code' column in the
# plugins table.  Used when updating from database schema 2 to 3.
######################################################################
def copyPluginsFromFilesToDb(cursor, logger):
    print 'Copying the plugins to the database'

    # Get the directory where the plugin files are stored.
    try:
        homeDir = os.environ['HOME']
    except KeyError:
        homeDir = '.'
    pluginDir = os.path.join(homeDir, 'AppInsight', 'plugins')

    # Get a list of the plugins in the database.
    _runDbStmtAndLog(cursor, logger, 'SELECT id, name FROM plugins', None)
    plugins = []
    for row in cursor:
        pluginId = row[0] # get the plugin id
        pluginName = row[1] # get the plugin name
        plugins.append((pluginId, pluginName))

    # Copy each plugin file to the database.
    for (pluginId, pluginName) in plugins:
        copyPluginFromFileToDb(pluginId, pluginName, pluginDir, cursor, logger)

######################################################################
# Copies a plugin from its file to the 'code' column in the plugins
# table.  Used when updating from database schema from 2 to 3.
# Does not delete the plugin file; that needs to be done manually.
######################################################################
def copyPluginFromFileToDb(pluginId, pluginName, pluginDir, cursor, logger):
    print 'Copying plugin "%s" (id "%s") to the database' % (pluginName, pluginId)
    pluginFile = 'plugin' + pluginId.replace('-','_') + '.py'
    pluginPath = os.path.join(pluginDir, pluginFile)
    print 'Reading file %s' % pluginPath
    try:
        stream = open(pluginPath, 'r')
        code = stream.read()
        stream.close()
    except Exception, ex:
        logger.error('Error reading plugin file "%s": %s' % \
                     (pluginPath, ex))
        return

    _runDbStmtAndLog(cursor, logger,
                             'UPDATE plugins SET code=?? WHERE id=??',
                     (code, pluginId))
    

######################################################################
# Returns the database schema version (an integer), or None if it
# isn't defined.
######################################################################
def getDbSchemaVersion(logger=None):
    dbConn = connectToDb()
    try:
        cursor = dbConn.cursor()

        # Read the db schema version versions as strings.
        dbSchemaVersionStrs = []
        _runDbStmtAndLog(cursor, logger,
                         'SELECT value FROM util WHERE name="dbschema"',
                         None)
        for row in cursor:
            dbSchemaVersionStrs.append(row[0])

        # There should be exactly one version.
        if not dbSchemaVersionStrs:
            print "Error: no database schema version is defined"
            if logger:
                logger.warning("No database schema version is defined")
            return None

        # If more than one is defined (shouldn't happen), pick one.
        dbSchemaVersionStr = dbSchemaVersionStrs[0]
        if len(dbSchemaVersionStrs) > 1:
            print "Error: multiple database schema versions are defined, using ", \
                  dbSchemaVersionStr
            if logger:
                logger.warning("Multiple database schema versions are defined, using " + dbSchemaVersionStr)

        # Interpret as an integer, to provide a simple way to upgrade from
        # version N to version N+1.
        try:
            dbSchemaVersion = int(dbSchemaVersionStr)
        except ValueError:
            print "Error: database schema version '%s' is not an integer" % dbSchemaVersionStr
            if logger:
                logger.warning("database schema version '%s' is not an integer" % dbSchemaVersionStr)
            return None
        return dbSchemaVersion # return the version as an integer
    finally:
        dbConn.close()

######################################################################
# Returns a list of column names for a table.
#  tableName: the table to query -- must be validiated to avoid
#   injection attacks
######################################################################
def getColumnNames(tableName):
    if _DbDriverName == 'sqlite3':
        return getSqliteColumnNames(tableName)
    elif _DbDriverName == 'mysql.connector':
        return getMysqlConnectorColumnNames(tableName)
    raise DatabaseError('unknown DBMS "%s"' % _DbDriverName)

######################################################################
# Returns a list of column names for a sqlite3 table.
#  tableName: the table to query -- must be validiated to avoid
#   injection attacks
######################################################################
def getSqliteColumnNames(tableName):
    dbConn = connectToDb()
    try:
        cursor = dbConn.cursor()
        # Using ?1 with PRAGMA doesn't seem to work:
        # cursor.execute('PRAGMA table_info(?1)', (tableName,))
        cursor.execute('PRAGMA table_info(%s)' % tableName)
        return [column[1] for column in cursor.fetchall()]
    except:
        # sqlite currently returns an empty list for a tables that doesn't
        # exist.  This is in case it is later changed to throw an exception.
        return []
    finally:
        dbConn.close()

######################################################################
# Returns a list of column names for a MySql table.
#  tableName: the table to query -- must be validiated to avoid
#   injection attacks
######################################################################
def getMysqlConnectorColumnNames(tableName):
    dbConn = connectToDb()
    try:
        cursor = dbConn.cursor()
        cursor.execute('SHOW COLUMNS FROM %s' % tableName)
        return [col[0] for col in cursor.fetchall()]
    except:
        # sqlite currently returns an empty list for a tables that doesn't
        # exist.  This is in case it is later changed to throw an exception.
        return []
    finally:
        dbConn.close()


######################################################################
#
# Adds a default tenant, tenant admin user, plain user, group,
# application, and collection to the database.  Can be used for
# automated testing.  Assumes the database and tables have been created.
#  return: a dictionary of the form:
#       {'tenantId':tenantId,
#        'tenantAdminUserId':tenantAdminUserId,
#        'plainUserId':plainUserId,
#        'groupId':groupId,
#        'applicationId':applicationId,
#        'collectionId':collectionId}
#
######################################################################
def seedDb():
    tenantId = addTenant("tenant0", "tenant0", "tenant0@localhost")
    tenantAdminUserId = addUser("tenant-admin-user0",
                                "tenant-admin-user0@localhost",
                                "tenant-admin-user0-password",
                                tenantId, _ROLE_TENANT_ADMIN)
    plainUserId = addUser("user0", "user0@localhost", "user0",
                          tenantId, _ROLE_USER)
    groupId = addGroup(tenantId, "group0")
    applicationId = addApplication(groupId, "application0")
    (collectionId, searchIndexId, esIndexName) = \
                   addCollection(applicationId, "collection0")

    # Return the ids in a dictionary.
    return {'tenantId':tenantId,
            'tenantAdminUserId':tenantAdminUserId,
            'plainUserId':plainUserId,
            'groupId':groupId,
            'applicationId':applicationId,
            'collectionId':collectionId}

######################################################################
#
# Executes a sqlite database statement and logs the statement and
# its values.
#   cursor: the database cursor
#   logger: the logging object, or None
#   stmt: the SQL statement to execute (a string).  Use "??" for
#     parameters that will be replaced by values; each "??" will be
#     converted to the right form for the DBMS.
#   values: the values for any "??" operands to the SQL statement (a sequence
#     or None)
#   logValues: optional sequence of values to use for logging; can be
#     used to hide sensitive values such as passwords
#
######################################################################
def _runDbStmtAndLog(cursor, logger, stmt, values, logValues=None):
    print 'Inside _runDbStmtAndLog'
    stmt = _convertParams(stmt)
    if logger:
        try:
            if logValues is None:
                logValues = values
            msg = "DB: stmt='%s'" % stmt
            if logValues:
                msg += ", values=%s" % (logValues,)
            logger.info(msg)
        except Exception, ex:
            print 'Log error:', ex

    print 'After logging inside _runDbStmtAndLog'
    # Execute the database statement.
    try:
        if values:
            cursor.execute(stmt, values)
        else:
            print 'The statement is ' + stmt
            cursor.execute(stmt)
        print 'After executing the sql statement'
    except _DbIntegrityExceptionClass, ex:
        if logger:
            logger.error("DB: integrity exception: %s" % ex)
        # Convert a DBMS-specific integrity exception to our class.
        raise DatabaseIntegrityError(str(ex))
    except _DbExceptionClass, ex:
        if logger:
            logger.error("DB: exception: %s" % ex)
        # Convert a DBMS-specific database exception to our class.
        raise DatabaseError(str(ex))
    except Exception, ex:
        if logger:
            logger.error("DB: exception: %s" % ex)
        exc_type, exc_value, exc_traceback = sys.exc_info()
        
        traceback.print_tb(exc_traceback, file=sys.stdout)
        print 'DB error running "%s"(%s): %s' % (stmt, values, ex)
        raise

######################################################################
#
# Lists config components, regardless of whether or not they have any
# parameters defined.
#  return: a list of (componentName, instanceName) tuples
#
######################################################################
def listConfigComponents(logger=None):
    dbConn = connectToDb()
    try:
        cursor = dbConn.cursor()
        _runDbStmtAndLog(cursor, logger,
                         'SELECT componentName, instanceName FROM configs',
                         None)
        configs = []
        for row in cursor:
            componentName = row[0]
            instanceName = row[1]
            configs.append((componentName, instanceName))
        return configs
    finally:
        dbConn.close()

######################################################################
#
# Adds a new config component/instance pair.
#
######################################################################
def addConfigComponent(componentName, instanceName, logger=None):
    dbConn = connectToDb()
    try:
        cursor = dbConn.cursor()
        _runDbStmtAndLog(cursor, logger,
                         'INSERT INTO configs(componentName, instanceName) VALUES(??,??)',
                         (componentName, instanceName))
        commitDb(dbConn)
    finally:
        dbConn.close()

######################################################################
#
# Deletes a config component/instance pair and all the parameters
# for that pair.
#
######################################################################
def deleteConfigComponent(componentName, instanceName, logger=None):
    dbConn = connectToDb()
    try:
        cursor = dbConn.cursor()
        _runDbStmtAndLog(cursor, logger,
                         'DELETE FROM configs WHERE componentName=?? AND instanceName=??',
                         (componentName, instanceName))
        commitDb(dbConn)
    finally:
        dbConn.close()


######################################################################
#
# Lists config parameters for the specified component and instance.
#  return: a list of (propName, propValue) tuples
#
######################################################################
def listConfigParameters(componentName, instanceName, logger=None):
    dbConn = connectToDb()
    try:
        cursor = dbConn.cursor()
        _runDbStmtAndLog(cursor, logger,
                         'SELECT propName, propValue FROM config_properties WHERE componentName=?? AND instanceName=??',
                         (componentName, instanceName))
        params = []
        for row in cursor:
            propName = row[0]
            propValue = row[1]
            params.append((propName, propValue))
        return params
    finally:
        dbConn.close()

######################################################################
#
# Deletes a config parameter.
#  componentName: the component name
#  instanceName: the instance name
#  propName: the name of the parameter to delete
#
######################################################################
def deleteConfigParameter(componentName, instanceName, propName, logger=None):
    dbConn = connectToDb()
    try:
        cursor = dbConn.cursor()
        _runDbStmtAndLog(cursor, logger,
                         'DELETE FROM config_properties WHERE componentName=?? AND instanceName=?? AND propName=??',
                         (componentName, instanceName, propName))
        commitDb(dbConn)
    finally:
        dbConn.close()

######################################################################
#
# Adds a config parameter.  Does not check to see whether a parameter
# already exists with that name.  If there is any doubt, call
# deleteConfigParameter() first.
#  componentName: the component name
#  instanceName: the instance name
#  propName: the name of the parameter to add
#  propValue: the value of the new parameter
#
######################################################################
def addConfigParameter(componentName, instanceName, propName, propValue, logger=None):
    dbConn = connectToDb()
    try:
        cursor = dbConn.cursor()
        _runDbStmtAndLog(cursor, logger,
                         'INSERT INTO config_properties(componentName, instanceName, propName, propValue) VALUES(??,??,??,??)',
                         (componentName, instanceName, propName, propValue))
        commitDb(dbConn)
    finally:
        dbConn.close()

######################################################################
#
# Adds a tenant.  May throw database exceptions.
#  name: the tenant name
#  password: plain-text password (will be stored as a hash)
#  email: the email address
#  passwordHath: if not None, it is used and the password argument
#    is ignored
#  return: the id of the new tenant.
#
######################################################################
def addTenant(name, password, email, passwordHash=None, logger=None):
    # Store a hash value instead of the plain-text password, unless
    # the hash value was provided.
    if not passwordHash:
        passwordHash = hashlib.sha224(password).hexdigest()
    tenantId = newId()
    dbConn = connectToDb()
    try:
        cursor = dbConn.cursor()

        # Read the default aggregation criteria.
        _runDbStmtAndLog(cursor, logger,
                         'SELECT doctype, expr, enabled FROM defaultaggregationcriteria',
                         None)
        defaultAggregationCriteria = []
        for row in cursor:
            docType = row[0]
            expr = row[1]
            enabled = row[2]             
            defaultAggregationCriteria.append((docType, expr, enabled))

        _runDbStmtAndLog(cursor, logger,
                         'INSERT INTO tenants(id, name, email, passwordHash) VALUES(??,??,??,??)',
                         (tenantId, name, email, passwordHash),
                         logValues=(id, name, email, "***"))

        # Copy the default aggregation criteria to this tenant.
        for (docType, expr, enabled) in defaultAggregationCriteria:
            _runDbStmtAndLog(cursor, logger,
                            'INSERT INTO tenantaggregationcriteria(doctype, tenantId, expr, enabled) VALUES(??,??,??,??)',
                            (docType, tenantId, expr, enabled))

        commitDb(dbConn)
        return tenantId
    finally:
        dbConn.close()

######################################################################
#
# Adds a user.  May throw database exceptions.
#  name: user name
#  email: email address
#  password: plain-text password (will be stored as a hash)
#  tenantId: the id of the tenant
#  role: _ROLE_USER,_ROLE_TENANT_ADMIN, or _ROLE_SITE_ADMIN
#  passwordHath: if not None, it is used and the password argument
#    is ignored
#  return: the id of the new user.
#
######################################################################
def addUser(name, email, password, tenantId, role, passwordHash=None, logger=None):
    if role not in (_ROLE_USER, _ROLE_TENANT_ADMIN, _ROLE_SITE_ADMIN):
        raise DatabaseError('Invalid role')

    # Store a hash value instead of the plain-text password, unless
    # the hash value was provided.
    if not passwordHash:
        passwordHash = hashlib.sha224(password).hexdigest()
    id = newId()
    dbConn = connectToDb()
    try:
        cursor = dbConn.cursor()
        _runDbStmtAndLog(cursor, logger,
                         'INSERT INTO users(id, name, email, passwordHash, tenantId, role) VALUES(??,??,??,??,??,??)',
                         (id, name, email, passwordHash, tenantId, role),
                         logValues=(id, name, email, "***", tenantId, role))
        commitDb(dbConn)
        return id
    finally:
        dbConn.close()

######################################################################
#
# Deletes a user by id.  May throw database exceptions.
#
######################################################################
def deleteUserById(id, logger=None):
    return _deleteEntryById('users', id, logger=logger)

######################################################################
#
# Returns a list of user id/name/email/tenantId/role tuples.
# May throw database exceptions.
#
######################################################################
def listUsers(logger=None):
    dbConn = connectToDb()
    try:
        cursor = dbConn.cursor()
        _runDbStmtAndLog(cursor, logger,
                         'SELECT id, name, email, tenantId, role FROM users', None)
        users = []
        for row in cursor:
            id = row[0] # get the database id
            name = row[1] # get the user name
            email = row[2] # get the user email address
            tenantId = row[3] # get the tenand id
            role = row[4] # get the role
            users.append((id, name, email, tenantId, role))
        commitDb(dbConn)
        return users
    finally:
        dbConn.close()

######################################################################
#
# Returns a list of user id/name/email/role tuples for users in
# the specified tenant.
# May throw database exceptions.
#
######################################################################
def listUsersByTenant(tenantId, logger=None):
    dbConn = connectToDb()
    try:
        cursor = dbConn.cursor()
        _runDbStmtAndLog(cursor, logger,
                         'SELECT id, name, email, role FROM users WHERE tenantId = ??',
                       (tenantId,))
        users = []
        for row in cursor:
            id = row[0] # get the database id
            name = row[1] # get the user name
            email = row[2] # get the user email address
            role = row[3] # get the role
            users.append((id, name, email, role))
        commitDb(dbConn)
        return users
    finally:
        dbConn.close()
        
######################################################################
#
# Returns a list of tenant ids for a user id.  Normally there should be
# at most one entry.  If the user id doesn't exist, the result is
# empty.
# May throw database exceptions.
#
######################################################################
def listTenantsByUserId(userId, logger=None):
    dbConn = connectToDb()
    try:
        cursor = dbConn.cursor()
        _runDbStmtAndLog(cursor, logger,
                         'SELECT tenantId FROM users WHERE id = ??',
                         (userId,))
        tenants = []
        for row in cursor:
            tenantId = row[0] # get the tenant id
            tenants.append(tenantId)
        commitDb(dbConn)
        return tenants
    finally:
        dbConn.close()

######################################################################
#
# Returns a list of tenant ids for a tenant name.  Normally there should
# be at most one entry.  If no tenant with the specified name exists,
# the result is empty.
# May throw database exceptions.
#
######################################################################
def listTenantsByName(tenantName, logger=None):
    dbConn = connectToDb()
    try:
        cursor = dbConn.cursor()
        _runDbStmtAndLog(cursor, logger,
                         'SELECT id FROM tenants WHERE name = ??',
                         (tenantName,))
        tenantIds = []
        for row in cursor:
            tenantId = row[0] # get the tenant id
            tenantIds.append(tenantId)
        commitDb(dbConn)
        return tenantIds
    finally:
        dbConn.close()

######################################################################
#
# Deletes a tenant by name.  May throw database exceptions.
# TODO: is this needed?  Normally will delete by id.
#
######################################################################
def deleteTenantByName(name, logger=None):
    dbConn = connectToDb()
    try:
        cursor = dbConn.cursor()
        _runDbStmtAndLog(cursor, logger,
                         'DELETE FROM tenants WHERE name = ??',
                         (name,))
        commitDb(dbConn)

        if getChangedRows(dbConn, cursor) == 0:
            # TODO: decide whether there's a better way to return an error
            raise DatabaseError('No such tenant')
        return True
    finally:
        dbConn.close()
        
######################################################################
#
# Deletes a tenant by id.  May throw database exceptions.
#
######################################################################
def deleteTenantById(id, logger=None):
    dbConn = connectToDb()
    try:
        cursor = dbConn.cursor()
        _runDbStmtAndLog(cursor, logger,
                         'DELETE FROM tenants WHERE id = ??',
                         (id,))
        commitDb(dbConn)
        if getChangedRows(dbConn, cursor) == 0:
            # TODO: decide whether there's a better way to return an error
            raise DatabaseError('No such tenant')
        return True
    finally:
        dbConn.close()

######################################################################
#
# Returns a list of tenant id/name/email tuples.
# May throw database exceptions.
#
######################################################################
def listTenants(logger=None):
    dbConn = connectToDb()
    try:
        cursor = dbConn.cursor()
        _runDbStmtAndLog(cursor, logger,
                         'SELECT id, name, email FROM tenants', None)
        tenants = []
        for row in cursor:
            id = row[0] # get the database id
            name = row[1] # get the tenant name
            email = row[2] # get the tenant email address
            tenants.append((id, name, email))
        commitDb(dbConn)
        return tenants
    finally:
        dbConn.close()

######################################################################
#
# Returns a tenant's name and email as a tuple, or None if no
# tenant with the specified id exists.
# May throw database exceptions.
#
######################################################################
def getTenantFields(tenantId, logger=None):
    dbConn = connectToDb()
    try:
        cursor = dbConn.cursor()
        _runDbStmtAndLog(cursor, logger,
                         'SELECT name, email FROM tenants WHERE id = ??',
                         (tenantId,))
        fields = None
        for row in cursor:
            name = row[0] # get the tenant name
            email = row[1] # get the tenant email address
            fields = (name, email)
            break
        commitDb(dbConn)
        return fields
    finally:
        dbConn.close()

######################################################################
#
# Validates a password hash.
# Looks for a "passwordHash" column and checks that it matches the
# hashed value of the specified password.
#  table: the table to search (must be a constant to avoid a SQL
#    injection attack)
#  tableType: name to use in an error message if there is no such entry,
#    e.g. "tenant" for the tenants table or "user" for the users table
#  nameColumn: the column to look for the id in, e.g. "name" (must
#    be a constant to avoid a SQL injection attack)
#  name: the value to look for in the column specified by nameColumn
#  password: the expected password
#  return on success:
#    (True, (guid, role)) on success for the 'users' table
#    (True, guid) on success for other tables
#    where guid is the unique id of the matching row and role is
#      the user role
#  return on failure:
#    (False, message) on failure
#
######################################################################
def _validatePassword(table, tableType, nameColumn, name, password, logger=None):
    try:
        dbConn = connectToDb()
        # TODO: make sure dbConn is closed even if an exception is raised
        cursor = dbConn.cursor()
        rowCount = 0
        columns = 'id, passwordHash'
        if table == 'users':
            columns += ', role'

        _runDbStmtAndLog(cursor, logger,
                         'SELECT ' + columns + ' FROM ' + table + ' WHERE ' + nameColumn + ' = ??',
                         (name,))
        for row in cursor:
            rowCount = rowCount + 1 # keep track of the number of entries
            guid = row[0] # unique id
            passwordHash = row[1] # get the stored password hash
            if table == 'users':
                role = row[2] # user role
            # print 'ROW:', row # TESTING
        # cursor.rowcount is supposed to return the number of rows returned
        # but doesn't seem to work.
    except Exception, ex:
        return (False, str(ex))
    finally:
        dbConn.close()
    if rowCount == 0:
        return (False, 'no such ' + tableType)
    if passwordHash != hashlib.sha224(password).hexdigest():
        return (False, 'bad password')
    if table == 'users':
        return (True, (guid, role))
    return (True, guid)

######################################################################
#
# Validates a tenant's password.
#  name: the name to look for in the "name" column
#  password: the expected password
#  return: (True, guid) on success
#          (False, message) on failure
#
######################################################################
def validateTenantPassword(name, password, logger=None):
    return _validatePassword('tenants', 'tenant', 'name', name, password, logger=logger)

######################################################################
#
# Validates a user's password.
#  name: the name to look for in the "name" column
#  password: the expected password
#  return: (True, (guid, role)) on success
#          (False, message) on failure
#
######################################################################
def validateUserPassword(name, password, logger=None):
    return _validatePassword('users', 'user', 'name', name, password, logger=logger)

######################################################################
#
# Adds an entry a database table.  This is used for tables that
# have just two columns besides the id:
#    a name
#    an id in the parent table
# May throw database exceptions.
#  table: the name of the database table to be modified, e.g.
#    'groups' - must be a constant string to avoid SQL injection attachs
#  parentIdColumn: the name of the column that refers to the
#    parent table, e.g. 'tenantId' - must be a constant string to
#    avoid SQL injection attachs
#  parentId: the id in the parent table
#  name: the entry name
#  return: the id of the new entry
#
######################################################################
def _addEntry(table, parentIdColumn, parentId, name, logger=None):
    id = newId()
    dbConn = connectToDb()
    try:
        cursor = dbConn.cursor()
        _runDbStmtAndLog(cursor, logger,
                         'INSERT INTO ' + table + '(id,' + parentIdColumn + \
                         ',name) VALUES(??,??,??)', (id, parentId, name))
        commitDb(dbConn)
        return id
    finally:
        dbConn.close()

######################################################################
#
# Deletes an entry by id.  May throw database exceptions.
#  table: the name of the database table to be modified, e.g.
#    'groups' - must be a constant string to avoid SQL injection attacks
#  id: the entry to be deleted
#
######################################################################
def _deleteEntryById(table, id, logger=None):
    dbConn = connectToDb()
    try:
        cursor = dbConn.cursor()
        _runDbStmtAndLog(cursor, logger,
                         'DELETE FROM ' + table + ' WHERE id = ??',
                         (id,))
        commitDb(dbConn)
        if getChangedRows(dbConn, cursor) == 0:
            # TODO: decide whether there's a better way to return an error
            raise DatabaseError('No such entry')
        return True
    finally:
        dbConn.close()

######################################################################
#
# Returns a list of entry id/name tuples for entries with the
# specified parent id.
# May throw database exceptions.
#
#  table: the name of the database table to be listed, e.g.
#    'groups' - must be a constant string to avoid SQL injection attachs
#  parentIdColumn: the name of the column that refers to the
#    parent table, e.g. 'tenantId' - must be a constant string to
#    avoid SQL injection attachs
#  parentId: the id in the parent table
#
######################################################################
def _listEntries(table, parentIdColumn, parentId, logger=None):
    dbConn = connectToDb()
    try:
        cursor = dbConn.cursor()
        _runDbStmtAndLog(cursor, logger,
                         'SELECT id, name FROM ' + table + ' WHERE ' +
                         parentIdColumn + ' = ??', (parentId,))
        entries = []
        for row in cursor:
            id = row[0] # get the database id
            name = row[1] # get the name
            entries.append((id, name))
        commitDb(dbConn)
        return entries
    finally:
        dbConn.close()

######################################################################
#
# Adds a group.  May throw database exceptions.
#  tenantId: the id of the tenant
#  name: the group name
#
######################################################################
def addGroup(tenantId, name, logger=None):
    return _addEntry('groups', 'tenantId', tenantId, name, logger=logger)

######################################################################
#
# Deletes a group by id.  May throw database exceptions.
#
######################################################################
def deleteGroupById(id, logger=None):
    return _deleteEntryById('groups', id, logger=logger)

######################################################################
#
# Returns a list of group id/name tuples for a tenant.
# May throw database exceptions.
#
#  tenantId: the id of the tenant whose groups are to be listed
#
######################################################################
def listGroups(tenantId, logger=None):
    return _listEntries('groups', 'tenantId', tenantId, logger=logger)

######################################################################
#
# Adds an application.  May throw database exceptions.
#  groupId: the id of the group
#  name: the group name
#
######################################################################
def addApplication(groupId, name, logger=None):
    return _addEntry('applications', 'groupId', groupId, name, logger=logger)

######################################################################
#
# Deletes an application by id.  May throw database exceptions.
#
######################################################################
def deleteApplicationById(id, logger=None):
    return _deleteEntryById('applications', id, logger=logger)

######################################################################
#
# Returns a list of application id/name tuples for a group.
# May throw database exceptions.
#
#  groupId: the id of the group whose applications are to be listed
#
######################################################################
def listApplications(groupId, logger=None):
    return _listEntries('applications', 'groupId', groupId, logger=logger)

######################################################################
#
# Adds a collection to the specified application, and adds a search index
# called 'default' to that collection.
# May throw database exceptions.
#  applicationId: the id of the application
#  collectionName: the collection name
#  searchIndexName: the ElasticSearch index name
#  return: a tuple (collectionId, searchIndexId, esIndexName)
#    where esIndexName is the ElasticSearch index name, which is the
#    collectionId plus '-' plus the date and time
#
######################################################################
def addCollection(applicationId, collectionName, logger=None):
    collectionId = _addEntry('collections', 'applicationId', applicationId,
                             collectionName, logger=logger)
    # Add the date and time to the collection id to get the ElasticSearch index name.
    dateAndTime = datetime.datetime.isoformat(datetime.datetime.utcnow()) + 'Z'
    # ElasticSearch index names cannot have upper-case letters.
    # datetime.datetime.isoformat() precedes the time with 'T', so convert to lower case.
    esIndexName = collectionId + '-' + dateAndTime.lower()
    searchIndexId = _addEntry('search_indices', 'collectionId', collectionId,
                              esIndexName, logger=logger)
    return (collectionId, searchIndexId, esIndexName)

######################################################################
#
# Deletes a collection by id.  May throw database exceptions.
#
######################################################################
def deleteCollectionById(id, logger=None):
    return _deleteEntryById('collections', id, logger=logger)

######################################################################
#
# Returns a list of collection id/name tuples for an application.
# May throw database exceptions.
#
#  applicationId: the id of the application whose collections
#    are to be listed
#
######################################################################
def listCollections(applicationId, logger=None):
    return _listEntries('collections', 'applicationId', applicationId, logger=logger)

######################################################################
#
# Adds a search index.  May throw database exceptions.
#  collectionId: the id of the collection
#  name: the search index name
#
######################################################################
def addSearchIndex(collectionId, name, logger=None):
    return _addEntry('search_indices', 'collectionId', collectionId, name, logger=logger)

######################################################################
#
# Deletes a search index by id.  May throw database exceptions.
#
######################################################################
def deleteSearchIndexById(id, logger=None):
    return _deleteEntryById('search_indices', id, logger=logger)

######################################################################
#
# Returns a list of sesarch index id/name tuples for a collection.
# May throw database exceptions.
#
#  collectionId: the id of the collection whose search indices
#    are to be listed
#
######################################################################
def listSearchIndices(collectionId, logger=None):
    return _listEntries('search_indices', 'collectionId', collectionId, logger=logger)

######################################################################
#
# Adds a logfile.  May throw database exceptions.
#  collectionId: the id of the collection
#  path: the full path to the log file
#  logfileType: the log file type as defined by logStash, e.g.
#    'apache-access'
#
######################################################################
def addLogfile(collectionId, path, logfileType):
    id = newId()
    dbConn = connectToDb()
    try:
        cursor = dbConn.cursor()
        _runDbStmtAndLog(cursor, logger,
                         'INSERT INTO logfiles(id,collectionId,path,logfileType) VALUES(??,??,??,??)',
                         (id, collectionId, path, logfileType))
        commitDb(dbConn)
        return id
    finally:
        dbConn.close()

######################################################################
#
# Returns a list of logfile id/path/logfileType tuples.
# May throw database exceptions.
#
######################################################################
def listLogfiles(collectionId):
    dbConn = connectToDb()
    try:
        cursor = dbConn.cursor()
        _runDbStmtAndLog(cursor, logger,
                         'SELECT id, path, logfileType FROM logfiles WHERE collectionId = ??',
                         (collectionId,))
        logfiles = []
        for row in cursor:
            id = row[0] # get the database id
            path = row[1] # get the logfile path
            logfileType = row[2] # get the logStash logfile type
            logfiles.append((id, path, logfileType))
        commitDb(dbConn)
        return logfiles
    finally:
        dbConn.close()

######################################################################
#
# Deletes a logfile by id.  May throw database exceptions.
#
######################################################################
def deleteLogfileById(id, logger=None):
    return _deleteEntryById('logfiles', id, logger=logger)

######################################################################
#
# Adds a dashboard.  May throw database exceptions.
#  userId: the user id of the owner
#  name: a name for the dashboard
#  dashboard: the dashboard, as a string
#  return: the id of the new dashboard
#
######################################################################
def addDashboard(userId, name, dashboard, logger=None):
    id = newId()
    dbConn = connectToDb()
    try:
        cursor = dbConn.cursor()
        _runDbStmtAndLog(cursor, logger,
                         'INSERT INTO dashboards(id,userId,name,dashboard) VALUES(??,??,??,??)',
                         (id, userId, name, dashboard))
        commitDb(dbConn)
        return id
    finally:
        dbConn.close()


def updateDashboard(userId, dashboardId, dashboard, logger=None):
    dbConn = connectToDb()
    try:
        cursor = dbConn.cursor()
        print 'Calling _runDbStmtAndLog from updateDashboard'
        _runDbStmtAndLog(cursor, logger,
                         'UPDATE dashboards SET dashboard=?? WHERE id=??',
                         (dashboard, dashboardId ))
        commitDb(dbConn)
        print 'Returning from updateDashboard'
        return dashboardId
    finally:
        dbConn.close()

######################################################################
#
# Returns a list of id/name/dashboard tuples listing dashboards for
# the specified user.  The dashboards are strings.
# May throw database exceptions.
#
######################################################################
def listDashboardsByUser(userId, logger=None):
    dbConn = connectToDb()
    try:
        cursor = dbConn.cursor()
        _runDbStmtAndLog(cursor, logger,
                         'SELECT id, name, dashboard FROM dashboards WHERE userId = ??',
                         (userId,))
        entries = []
        for row in cursor:
            id = row[0] # get the database id
            name = row[1] # get the dashboard name
            dashboard = row[2] # get the dashboard contents
            entries.append((id, name, dashboard))
        commitDb(dbConn)
        return entries
    finally:
        dbConn.close()

######################################################################
#
# Returns the specified dashboard as a string, or None if it doesn't
# exist.  May throw database exceptions.
#
######################################################################
def getDashboardById(dashboardId, logger=None):
    dbConn = connectToDb()
    try:
        cursor = dbConn.cursor()
        _runDbStmtAndLog(cursor, logger,
                         'SELECT dashboard FROM dashboards WHERE id = ??',
                         (dashboardId,))
        dashboard = None
        for row in cursor:
            dashboard = row[0] # get the dashboard contents
        commitDb(dbConn)
        if dashboard is None:
            raise DatabaseError('No such dashboard')
        return dashboard
    finally:
        dbConn.close()

######################################################################
#
# Deletes a dashboard by id  May throw database exceptions.
#
######################################################################
def deleteDashboardById(id, logger=None):
    return _deleteEntryById('dashboards', id, logger=logger)

######################################################################
#
# Adds a plugin entry.  May throw database exceptions.
# The plugin itself (Python code) is stored in a file, not in the
# database.
#  name: a name for the plugin
#  tenantId: the tenant that owns this plugin
#  enabled: 1 for enabled, 0 for disabled
#  pluginCode: the plugin Python source code
#  return: the id of the new plugin
#
######################################################################
def addPlugin(name, tenantId, enabled, pluginCode, logger=None):
    id = newId()
    dbConn = connectToDb()
    try:
        cursor = dbConn.cursor()
        _runDbStmtAndLog(cursor, logger,
                         'INSERT INTO plugins(id,name,tenantId,enabled, code) VALUES(??,??,??,??,??)',
                         (id, name, tenantId, enabled, pluginCode))
        commitDb(dbConn)
        return id
    finally:
        dbConn.close()

######################################################################
#
# Sets a plugin's enabled flag.
#  pluginId: the plugin's id
#  enabled: 1 or 0 (an integer, not a string)
#
######################################################################
def pluginSetEnabled(pluginId, enabled, logger=None):
    dbConn = connectToDb()
    try:
        cursor = dbConn.cursor()
        _runDbStmtAndLog(cursor, logger,
                         'UPDATE plugins SET enabled=?? WHERE id=??',
                         (enabled, pluginId))
        commitDb(dbConn)
    finally:
        dbConn.close()

######################################################################
#
# Returns a list of plugin id/name/enabled tuples for a tenant.
# May throw database exceptions.
#
######################################################################
def listPluginsByTenant(tenantId, logger=None):
    dbConn = connectToDb()
    try:
        cursor = dbConn.cursor()
        _runDbStmtAndLog(cursor, logger,
                         'SELECT id, name, enabled FROM plugins WHERE tenantId = ??',
                         (tenantId,))
        plugins = []
        for row in cursor:
            id = row[0] # get the plugin id
            name = row[1] # get the plugin name
            enabled = row[2] # get the enabled flag
            plugins.append((id, name, enabled))
        commitDb(dbConn)
        return plugins
    finally:
        dbConn.close()

######################################################################
#
# Returns a plugin's code, or None if the plugin does not exist or
# does not have any code.
# May throw database exceptions.
#   pluginId: the plugin id
#
######################################################################
def getPluginCodeById(pluginId, logger=None):
    dbConn = connectToDb()
    try:
        code = None
        cursor = dbConn.cursor()
        _runDbStmtAndLog(cursor, logger,
                         'SELECT code FROM plugins WHERE id = ??',
                         (pluginId,))
        for row in cursor:
            code = row[0] # get the plugin's code
            break
        commitDb(dbConn)
        return code
    finally:
        dbConn.close()

######################################################################
#
# Deletes a plugin by id.  May throw database exceptions.
#
######################################################################
def deletePluginById(id, logger=None):
    return _deleteEntryById('plugins', id, logger=logger)

######################################################################
#
# Returns a list of plugin id/name tuples for a doctype and collection id.
# Includes only enabled plugins.
# May throw database exceptions.
#
######################################################################
def listEnabledPluginsByDocTypeAndCollectionId(docType, collectionId, logger=None):
    dbConn = connectToDb()
    try:
        cursor = dbConn.cursor()

        # Defined collections.
        pluginCollectionStmt = 'SELECT DISTINCT plugins.id, plugins.name FROM plugins, plugindoctypes, plugincollections, collections WHERE plugins.enabled=1 AND plugindoctypes.doctype=?? AND collections.id=?? AND plugindoctypes.pluginId=plugins.id'

        # Collections in defined applications.
        pluginApplicationStmt = 'SELECT DISTINCT plugins.id, plugins.name FROM plugins, plugindoctypes, pluginapplications, applications, collections WHERE plugins.enabled=1 AND plugindoctypes.doctype=?? AND collections.id=?? AND plugindoctypes.pluginId=plugins.id AND collections.applicationId=applications.id AND applications.id=pluginapplications.applicationId AND pluginapplications.pluginId=plugins.id'

        # Collections in applications in defined groups.
        pluginGroupStmt = 'SELECT DISTINCT plugins.id, plugins.name FROM plugins, plugindoctypes, plugingroups, groups, applications, collections WHERE plugins.enabled=1 AND plugindoctypes.doctype=?? AND collections.id=?? AND plugindoctypes.pluginId=plugins.id AND collections.applicationId=applications.id AND applications.groupId=groups.id AND groups.id=plugingroups.groupId AND plugingroups.pluginId=plugins.id'

        # Collections in applications in groups in defined tenants.
        pluginTenantStmt = 'SELECT DISTINCT plugins.id, plugins.name FROM plugins, plugindoctypes, plugintenants, tenants, groups, applications, collections WHERE plugins.enabled=1 AND plugindoctypes.doctype=?? AND collections.id=?? AND plugindoctypes.pluginId=plugins.id AND collections.applicationId=applications.id AND applications.groupId=groups.id AND groups.tenantId=tenants.id AND tenants.id=plugintenants.tenantId AND plugintenants.pluginId=plugins.id;'

        # Combination of all of the above.
        stmt = ' UNION '.join([pluginCollectionStmt,
                               pluginApplicationStmt,
                               pluginGroupStmt,
                               pluginTenantStmt])

        _runDbStmtAndLog(cursor, logger, stmt,
                         (docType, collectionId,
                          docType, collectionId,
                          docType, collectionId,
                          docType, collectionId))
        plugins = []
        for row in cursor:
            id = row[0] # get the plugin id
            name = row[1] # get the plugin name
            plugins.append((id, name))
        commitDb(dbConn)
        return plugins
    finally:
        dbConn.close()

######################################################################
#
# Adds a plugin doctype entry.  May throw database exceptions.
#  pluginId: the id of the plugin (must exist in the plugins table)
#  docType: a doctype that this plugin applies to
#
######################################################################
def addPluginDocType(pluginId, docType, logger=None):
    addPluginAuxEntry('plugindoctypes', 'doctype',
                      pluginId, docType, logger=logger)

######################################################################
#
# Adds a plugin collection id entry.  May throw database exceptions.
#  pluginId: the id of the plugin (must exist in the plugins table)
#  collectionId: the id of the collection to be associated with the plugin
#
######################################################################
def addPluginCollection(pluginId, collectionId, logger=None):
    addPluginAuxEntry('plugincollections', 'collectionId',
                      pluginId, collectionId, logger=logger)

######################################################################
#
# Adds a plugin application id entry.  May throw database exceptions.
#  pluginId: the id of the plugin (must exist in the plugins table)
#  applicationId: the id of the application to be associated with the plugin
#
######################################################################
def addPluginApplication(pluginId, applicationId, logger=None):
    addPluginAuxEntry('pluginapplications', 'applicationId',
                      pluginId, applicationId, logger=logger)

######################################################################
#
# Adds a plugin group id entry.  May throw database exceptions.
#  pluginId: the id of the plugin (must exist in the plugins table)
#  groupId: the id of the group to be associated with the plugin
#
######################################################################
def addPluginGroup(pluginId, groupId, logger=None):
    addPluginAuxEntry('plugingroups', 'groupId',
                      pluginId, groupId, logger=logger)

######################################################################
#
# Adds a plugin tenant id entry.  May throw database exceptions.
#  pluginId: the id of the plugin (must exist in the plugins table)
#  tenantId: the id of the tenant to be associated with the plugin
#
######################################################################
def addPluginTenant(pluginId, tenantId, logger=None):
    addPluginAuxEntry('plugintenants', 'tenantId',
                      pluginId, tenantId, logger=logger)

######################################################################
#
# Adds an entry to one of the pluginX tables, e.g. plugincollections.
# May throw database exceptions.
#  tableName: name of the table to be modified, e.g. 'plugincollections';
#    must be validiated to avoid injection attacks
#  columnName: name of the colum to be modified, e.g. 'collectionId';
#    must be validiated to avoid injection attacks
#  pluginId: the id of the plugin (must exist in the plugins table)
#  value: the value to add to the columnName column in the tableName
#    table
#
######################################################################
def addPluginAuxEntry(tableName, columnName, pluginId, value, logger=None):
    dbConn = connectToDb()
    try:
        cursor = dbConn.cursor()
        _runDbStmtAndLog(cursor, logger,
                         'INSERT INTO ' + tableName + '(pluginId, ' + columnName + ') VALUES(??,??)',
                         (pluginId, value))
        commitDb(dbConn)
    finally:
        dbConn.close()

######################################################################
#
# Lists the doctypes for a plugin.  May throw database exceptions.
#  pluginId: the id of the plugin
#  return: a list of doctypes for the specified plugin
#
######################################################################
def listPluginDocTypes(pluginId, logger=None):
    return listPluginAuxEntries('plugindoctypes', 'doctype', pluginId,
                                logger=logger)

######################################################################
#
# Lists the collections defined for a plugin.  Does not include
# collections included indirectly through applications, groups,
# or tenants.
# May throw database exceptions.
#  pluginId: the id of the plugin
#  return: a list of collection ids for the specified plugin
#
######################################################################
def listPluginCollectionsByPluginId(pluginId, logger=None):
    return listPluginAuxEntries('plugincollections',
                                'collectionId', pluginId, logger=logger)

######################################################################
#
# Lists the applications defined for a plugin.
# May throw database exceptions.
#  pluginId: the id of the plugin
#  return: a list of application ids for the specified plugin
#
######################################################################
def listPluginApplicationsByPluginId(pluginId, logger=None):
    return listPluginAuxEntries('pluginapplications',
                                'applicationId', pluginId, logger=logger)

######################################################################
#
# Lists the groups defined for a plugin.
# May throw database exceptions.
#  pluginId: the id of the plugin
#  return: a list of group ids for the specified plugin
#
######################################################################
def listPluginGroupsByPluginId(pluginId, logger=None):
    return listPluginAuxEntries('plugingroups',
                                'groupId', pluginId, logger=logger)

######################################################################
#
# Lists the tenants defined for a plugin.
# May throw database exceptions.
#  pluginId: the id of the plugin
#  return: a list of tenant ids for the specified plugin
#
######################################################################
def listPluginTenantsByPluginId(pluginId, logger=None):
    return listPluginAuxEntries('plugintenants',
                                'tenantId', pluginId, logger=logger)

######################################################################
#
# Returns the values of one of the pluginX tables, e.g. plugincollections,
# for the specified plugin id.
# May throw database exceptions.
#  tableName: name of the table to be listed, e.g. 'plugincollections';
#    must be validiated to avoid injection attacks
#  columnName: name of the colum to be retrieved, e.g. 'collectionId';
#    must be validiated to avoid injection attacks
#  pluginId: the id of the plugin
#
######################################################################
def listPluginAuxEntries(tableName, columnName, pluginId, logger=None):
    dbConn = connectToDb()
    try:
        cursor = dbConn.cursor()
        _runDbStmtAndLog(cursor, logger,
                         'SELECT ' + columnName + ' FROM ' + tableName + ' WHERE pluginId=??',
                         (pluginId,))

        ids = []
        for row in cursor:
            id = row[0] # get the id, e.g. the collection id
            ids.append(id)
        commitDb(dbConn)
        return ids
    finally:
        dbConn.close()

######################################################################
#
# Returns a list of collectionId/collectionName/searchIndexId/searchIndexName
# tuples for an application.  The list includes all collection/searchIndex
# pairs.
# May throw database exceptions.
#
######################################################################
def listCollectionSearchIndexPairsByApplication(applicationId, logger=None):
    if logger:
        logger.info('SELECT c.id, c.name, si.id, si.name from applications a, collections c, search_indices si WHERE a.id=%s AND c.applicationId=a.id AND si.collectionId=c.id' % \
                    applicationId)
    dbConn = connectToDb()
    try:
        cursor = dbConn.cursor()
        _runDbStmtAndLog(cursor, logger,
                         'SELECT c.id, c.name, si.id, si.name from applications a, collections c, search_indices si WHERE a.id=?? AND c.applicationId=a.id AND si.collectionId=c.id',
                         (applicationId,))
        entries = []
        for row in cursor:
            entries.append(row)
        commitDb(dbConn)
        return entries
    finally:
        dbConn.close()

######################################################################
#
# Interprets each value from listAggregationCriteria() as a string
# representation of a Python list, and combines them into a single
# list.  This is used in searching.  See the comments to 
# listAggregationCriteria() for a description of the arguments.
#   return: (True, lst) on success or (False, message) on error,
#     where lst is a list of dictionaries
#
######################################################################
def getAggregationCriteria(docType, tenantId, all, default, logger=None):
    try:
        stringList = listAggregationCriteria(docType, tenantId, all, default,
                                             logger)
    except DatabaseError, ex:
        if logger:
            logger.error("DB: %s" % ex)
        return (False, str(ex))
    dictList = []
    for s in stringList:
        try:
            lst = eval(s)
        except SyntaxError, ex:
            if logger:
                logger.error("DB: syntax error in aggregation criteria table: %s" % ex)
            return (False, str(ex))
        if type(lst) != list:
            logger.error("DB: item in aggregation criteria table is not a list: %s" % lst)
            return (False, 'not a list: %s' % s)
        dictList += lst
    return (True, dictList)

######################################################################
#
# Returns a list of strings for a doctype/tenantId pair, or None
# if there are no entries.  Each string is expected to represent a
# Python list of dictionaries, but the value is not checked.
# May throw database exceptions.
#  docType: the doc type, e.g. apacheAccess
#  tenantId: a tenant id or None if the next two parameters are used
#  all: if true, the "all" are included
#  default: if true, the default values for new tenants are included
#  return: a list of values from the expr column of the
#    aggregation criteria tables
#
######################################################################
def listAggregationCriteria(docType, tenantId, all, default, logger=None):
    dbConn = connectToDb()
    try:
        cursor = dbConn.cursor()
        (stmt, values) = listAggregationCriteriaSearch(docType, tenantId,
                                                       all, default)
        entries = []
        if not stmt:
            return entries
        _runDbStmtAndLog(cursor, logger, stmt, values)
        for row in cursor:
            entries.append(row[0])
        commitDb(dbConn)
        return entries
    finally:
        dbConn.close()

######################################################################
#
# Returns a (stmt, values) tuple for use in listAggregationCriteria(),
# where stmt is the SQL statement and values is a tuple of values
# for the statement.
# See the comments in listAggregationCriteria() for more information.
#
######################################################################
def listAggregationCriteriaSearch(docType, tenantId, all, default):

    stmts = []  # SQL statements
    values = [] # parameters for SQL statements

    if tenantId:
        stmts.append('SELECT expr FROM tenantaggregationcriteria WHERE enabled=1 AND doctype=?? AND tenantId=??')
        values.append(docType)
        values.append(tenantId)

    if all:
        stmts.append('SELECT expr FROM allaggregationcriteria WHERE enabled=1 AND doctype=??')
        values.append(docType)

    if default:
        stmts.append('SELECT expr FROM defaultaggregationcriteria WHERE enabled=1 AND doctype=??')
        values.append(docType)

    # Combine multiple statmenets.
    stmt = ' UNION '.join(stmts)
    return (stmt, values)


######################################################################
#
# Sets or deletes the aggregation criteria for the specified doctype
# and tenant.  Deletes any existing values.
#
#  docType: the doc type, e.g. apacheAccess
#  tenantId: a tenant id, or "all", or "default"
#  expr: a string representing a Python expression (the value is not
#    checked), or None to delete the current value if there is one
# See the comments to _CreateAggregationCriteriaTableStmt for a
# description of the expr and tenantId columns.
#
######################################################################
def setAggregationCriteria(docType, tenantId, expr, logger=None):
    dbConn = connectToDb()
    try:
        cursor = dbConn.cursor()

        # Delete any existing rows.
        _runDbStmtAndLog(cursor, logger,
                         'DELETE FROM tenantaggregationcriteria WHERE doctype=?? AND tenantId=??',
                         (docType, tenantId))
        commitDb(dbConn)

        # Add a new row if expr is defined.
        if expr:
            _runDbStmtAndLog(cursor, logger,
                             'INSERT INTO tenantaggregationcriteria(doctype, tenantId, expr, enabled) VALUES(??,??,??,??)',
                             (docType, tenantId, expr, 1))
            commitDb(dbConn)
    finally:
        dbConn.close()

######################################################################
#
# Prints a usage message.
#
######################################################################
def usage():
    print 'To create the database the first time, run: %s -createdb | -createtables | -seeddb | -updatetables' % sys.argv[0]
    sys.exit(2)

######################################################################
#
# Used for creating the database manually or in an install script, or
# for adding entries for testing.
#
# Normally this is not run directly; it is imported from TenantServer.py.
#
######################################################################
def main():
    args = sys.argv[1:]
    if not args:
        usage()
    for arg in args:
        if arg == '-createdb':
            createDb(True)
        elif arg == '-createtables':
            createDb(False)
        elif arg == '-updatetables':
            updateTables()
        elif arg == '-seeddb':
            print seedDb()
        else:
            print '%s: unknown flag "%s"' % (sys.argv[0], arg)
            usage()
        args = args[1:]

# Set the global database variables.
_getDb()

if __name__ == '__main__':
    main()
