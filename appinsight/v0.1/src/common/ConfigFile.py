# Reads the AppInsight config file.
# The file is $HOME/AppInsight/AppInsight.conf

import sys, os
import ConfigParser

def readConfigFile():
    '''Returns the parsed contents of the AppInsight config file.
Returns None if the file does not exist or cannot be read.'''
    try:
        homeDir = os.environ['HOME']
    except KeyError:
        print '$HOME is not set, looking for config file in .'
        homeDir = '.'
    path = os.path.join(homeDir, 'AppInsight', 'AppInsight.conf')
    if not os.path.exists(path):
        print '%s does not exist' % path
        return None
    try:
        config = ConfigParser.SafeConfigParser()
        config.read(path)
        if not config.sections():
            print 'Warning: config file %s is empty' % path
        return config
    except Exception, ex:
        print 'Error reading config file %s: %s' % (path, ex)
        return None

def getTypedValue(config, section, key, func, typeName, default):
    '''If default is not None, returns the value from the configuration file with the specified section and key if it is defined, otherwise returns the default value.
If default is None, returns (True, value) if the specified key is found in the specified section, otherwise returns (False, message) where message describes the error.
config: a parsed configuration file
section: the section name
key: the key name
func: one of: Config.get Config.getint Config.getboolean
typeName: a string to use in an error message describing the expected type
default: an optional default value to use instead of returning an error
'''
    try:
        if default is not None:
            return func(section, key)
        return (True, func(section, key))
    except ConfigParser.NoSectionError:
        if default is not None: return default
        return (False, 'section "%s" is not found in config file' % (section))
    except ConfigParser.NoOptionError:
        if default is not None: return default
        return (False,
                'key "%s" is not found in the "%s" section of the config file' % (key, section))
    except ValueError:
        if default is not None: return default
        return (False, '"%s" in section %s does not have type %s' % \
                (key, section, typeName))
    except Exception, ex:
        if default is not None: return default
        return (False, 'error getting key "%s" from the "%s" section of the config file: %s' % (key, section, ex))

def getStringValue(config, section, key, default=None):
    '''If default is not None, returns the value from the configuration file with the specified section and key if it is defined, otherwise returns the default value.
If default is None, returns (True, value) if the specified key is found in the specified section, otherwise returns (False, message) where message describes the error.
config: a parsed configuration file
section: the section name
key: the key name
default: an optional default value to use on error
'''
    return getTypedValue(config, section, key, config.get, 'string', default)

def getIntValue(config, section, key, default=None):
    '''If default is not None, returns the value from the configuration file with the specified section and key if it is defined and the value is an integer, otherwise returns the default value.
If default is None, returns (True, value) if the specified key is found in the specified section, otherwise returns (False, message) where message describes the error.
config: a parsed configuration file
section: the section name
key: the key name
default: an optional default value to use on error
'''
    return getTypedValue(config, section, key, config.getint, 'int', default)

def getBoolValue(config, section, key, default=None):
    '''If default is not None, returns the value from the configuration file with the specified section and key if it is defined and the value has a boolean value, otherwise returns the default value.
If default is None, returns (True, value) if the specified key is found in the specified section, otherwise returns (False, message) where message describes the error.
config: a parsed configuration file
section: the section name
key: the key name
default: an optional default value to use on error
'''
    return getTypedValue(config, section, key, config.getboolean, 'bool', default)
