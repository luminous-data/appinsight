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

# Reads configuration parameters from the database specified in the AppInsight config file.
# This is now used for most parameters other than ones for accessing the database itself.

######################################################################
#
# Class used for database exceptions.  This insulates applications
# from DBMS-specific classes.
#
######################################################################
class DatabaseError(StandardError):
    def __init__(self, message):
        super(DatabaseError, self).__init__(message)

try:
    import ConfigFile
except ImportError, ex:
    print 'import error:', ex
    raise DatabaseError('Error importing ConfigFile')

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
# Returns a config value with the specified section, instance,
# and name.  If more than one is defined, only one is returned.
# Returns None if no values are defined.
#
######################################################################
def getDbValue(section, instance, key, logger):
    values = getDbValues(section, instance, key, logger)
    if not values: # empty list
        return None
    return values[0]

######################################################################
#
# Returns a list of config values with the specified section, instance,
# and name.
#
######################################################################
def getDbValues(section, instance, name, logger=None):
    values = []
    dbConn = connectToDb()
    try:
        cursor = dbConn.cursor()
        stmt = 'SELECT propValue from config_properties WHERE componentName = ?? AND instanceName = ?? AND propName = ??'
        stmt = _convertParams(stmt)
        stmtValues = (section, instance, name)
        if logger:
            logger.info("DB: stmt='%s', values=%s" % (stmt, stmtValues))
        # print "DB: stmt='%s', values=%s" % (stmt, stmtValues) # TESTING
        cursor.execute(stmt, stmtValues)
        for row in cursor:
            values.append(row[0])
        if logger:
            logger.info("DB: result=%s" % values)
    finally:
        dbConn.close()
    return values

def convertBoolValue(s):
    '''Returns True for: "1", "yes", "true", and "on".
    Returns False for: "0", "no", "false", and "off".
    Raises a ValueError exception for any other value.'''
    if s.lower() in ("1", "yes", "true", "on"): return True
    if s.lower() in ("0", "no", "false", "off"): return False
    raise ValueError('"%s" is not a valid boolean value' % s)

def getTypedValue(section, instance, name, convFunc, default, logger):
    '''If default is not None, returns the value from the database with the specified section, instance, and name if it is defined, otherwise returns the default value.
If default is None, returns (True, value) if the specified name is found in the specified section and instance, otherwise returns (False, message) where message describes the error.
section: the section name
name: the key name
convFunc: a function that converts a string to the desired type, such as:
  str (for a string value)
  int (returns an integer)
  ConfigDb.convertBoolValue (returns a boolean)
  default: an optional default value to use instead of returning an error
'''
    if not logger: ### TESTING
        import logging
        logger = logging.getLogger('ConfigDb')
        logger.addHandler(logging.StreamHandler())

    strValue = getDbValue(section, instance, name, logger)
    if strValue is None:
        if default is not None:
            return default
        return (False, '"%s" is not defined in section "%s" instance "%s"' % \
                (name, section, instance))
    value = convFunc(strValue)
    if default is None:
        return (True, value)
    return value


def getStringValue(section, name, default=None, instance='default', logger=None):
    '''Retrieves a string value.  See getTypedValue().'''
    return getTypedValue(section, instance, name, str, default, logger)

def getIntValue(section, name, default=None, instance='default', logger=None):
    '''Retrieves a integer value.  See getTypedValue().'''
    return getTypedValue(section, instance, name, int, default, logger)

def getBoolValue(section, name, default=None, instance='default', logger=None):
    '''Retrieves a boolean value.  See getTypedValue().'''
    return getTypedValue(section, instance, name, convertBoolValue, default, logger)

_getDb()
