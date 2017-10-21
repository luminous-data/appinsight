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

# This lets the user edit configuration parameters in the database.

import sys, glob, os, os.path

for pattern in ('../../vendor/bottle*/bottle.py',
                '../../vendor/six-*/six.py',
                '../../vendor/Paste*/paste'):
    pkgDirs = glob.glob(pattern)
    if pkgDirs:
        sys.path.insert(0, os.path.dirname(pkgDirs[0]))

sys.path.insert(0, '../common')

try:
    from bottle import request, response, route, get, post, abort, run, static_file, hook
    from BottleUtils import importBottleWebServer
    import six
    import sys
    import urllib
    import cgi
    import ConfigDb
    import TenantUtil
    import LogUtil
    import BottleUtils
    import logging
except ImportError, ex:
    print 'import error:', ex
    sys.exit(1)

counter=0

# Get the program name without the directory or extension.
_programName = os.path.splitext(os.path.basename(sys.argv[0]))[0]

# Base the logger name on the program name.
_logger = LogUtil.getLogger(_programName)

def _addResponseHeaders():
    response.set_header('Cache-Control', 'no-cache')
    response.set_header('Pragma', 'no-cache')

_htmlProlog = '<HTML>\n<HEAD><TITLE>Configuration editor</TITLE></HEAD>\n<BODY>\n'
_htmlEpilog = '</BODY></HTML>\n'

@route('/',method=['OPTIONS','GET'])
def root():
    '''Displays the component/instance pairs.'''
    _logger.info('request: ' + str(request))
    _addResponseHeaders()
    output = _htmlProlog
    output += '<H3>Configuration components</H3>\n'
    output += "<P>Click on a component or instance name to edit that instance's parameters.\n"
    output += '<TABLE BORDER=1>\n'
    output += ' <TR>\n'
    output += '  <TH>Component</TH>\n'
    output += '  <TH>Instance</TH>\n'
    output += ' </TR>\n'
    configs = TenantUtil.listConfigComponents(logger=_logger)
    configs.sort()
    for (componentName, instanceName) in configs:
        href1 = '<A HREF="/editComponent?%s">' % \
                urllib.urlencode({'componentName' : componentName,
                                  'instanceName' : instanceName})
        href2 = '</A>'
        output += ' <TR>\n'
        output += '  <TD>%s%s%s</TD>\n' % (href1, cgi.escape(componentName), href2)
        output += '  <TD>%s%s%s</TD>\n' % (href1, cgi.escape(instanceName), href2)
        output += ' </TR>\n'

    output += '</TABLE>\n'

    output += '<HR>\n'

    # Display a form to add a new component/instance pair.
    output += '<H3>Add a new component or instance</H3>\n'
    output += '<FORM METHOD="GET" ACTION="addComponent">\n'
    output += '<TABLE BORDER=1>\n'

    output += ' <TR>\n'
    output += '  <TD>Component name:\n</TD>'
    output += '  <TD><INPUT TYPE="TEXT" NAME="componentName"></TD>\n'
    output += ' </TR>\n'

    output += ' <TR>\n'
    output += '  <TD>Instance name:\n</TD>'
    output += '  <TD><INPUT TYPE="TEXT" NAME="instanceName"></TD>\n'
    output += ' </TR>\n'

    output += '</TABLE>\n'
    output += '<INPUT TYPE="SUBMIT" VALUE="Add">\n'
    output += '</FORM>\n'

    output += _htmlEpilog
    return output
    
@route('/editComponent',method=['OPTIONS','GET'])
def editComponent():
    '''Displays the configuration parameters for a component/instance pair with links to edit them.'''
    _logger.info('request: ' + str(request))
    _addResponseHeaders()
    output = _htmlProlog
    componentName = request.query.get('componentName')
    instanceName = request.query.get('instanceName')
    if not componentName or not instanceName:
        output += '<P>Error: missing component or instance name query parameter\n'
    else:
        output += '<H2>Configuration for component <TT>%s</TT> instance <TT>%s</TT></H2>\n' % \
                  (cgi.escape(componentName), cgi.escape(instanceName))

        output += '<HR>\n'

        output += '<H3>Click on a parameter name to delete that parameter or change its value</H3>\n'
        output += '<TABLE BORDER=1>\n'
        output += ' <TR>\n'
        output += '  <TH>Name</TH>\n'
        output += '  <TH>Value</TH>\n'
        output += ' </TR>\n'
        params = TenantUtil.listConfigParameters(componentName, instanceName, logger=_logger)
        params.sort()
        for (propName, propValue) in params:
            href1 = '<A HREF="/editParam?%s">' % \
                    urllib.urlencode({'componentName' : componentName,
                                      'instanceName' : instanceName,
                                      'propName' : propName,
                                      'propValue' : propValue})
            href2 = '</A>'
            output += ' <TR>\n'
            output += '  <TD>%s%s%s</TD>\n' % (href1, cgi.escape(propName), href2)
            output += '  <TD>%s</TD>\n' % cgi.escape(propValue)
            output += ' </TR>\n'

        output += '</TABLE>\n'

        output += '<HR>\n'

        # Display a form to add a new parameter to this component/instance pair.
        output += '<H3>Add a new configuration parameter</H3>\n'
        output += '<P>This will replace any value with the same name\n'
        output += '<FORM METHOD="GET" ACTION="updateParam">\n'
        output += '<INPUT TYPE="HIDDEN" NAME="componentName" VALUE="%s">\n' % \
                  cgi.escape(componentName)
        output += '<INPUT TYPE="HIDDEN" NAME="instanceName" VALUE="%s">\n' % \
                  cgi.escape(instanceName)
        output += '<INPUT TYPE="HIDDEN" NAME="newParam" VALUE="1">\n'
        output += 'New name:&nbsp\n'
        output += '<INPUT TYPE="TEXT" NAME="propName">\n'
        output += 'New value:&nbsp\n'
        output += '<INPUT TYPE="TEXT" NAME="propValue">\n'
        output += '<INPUT TYPE="SUBMIT" VALUE="Add">\n'
        output += '</FORM>\n'


        output += '<HR>\n'

        # Display a form to delete this component/instance pair.
        output += '<FORM METHOD="GET" ACTION="deleteComponent">\n'
        output += '<INPUT TYPE="HIDDEN" NAME="componentName" VALUE="%s">\n' % \
                  cgi.escape(componentName)
        output += '<INPUT TYPE="HIDDEN" NAME="instanceName" VALUE="%s">\n' % \
                  cgi.escape(instanceName)
        output += 'Click to delete all configuration for this component and instance:&nbsp\n'
        output += '<INPUT TYPE="SUBMIT" VALUE="Delete">\n'
        output += '</FORM>\n'

    output += '<HR>\n'
    output += '<A HREF="/">Continue without making any changes</A>'

    output += _htmlEpilog
    return output

@route('/addComponent',method=['OPTIONS','GET'])
def addComponent():
    '''Adds a new component/instance pair.'''
    _logger.info('request: ' + str(request))
    _addResponseHeaders()
    output = _htmlProlog
    componentName = request.query.get('componentName')
    instanceName = request.query.get('instanceName')
    if not componentName or not instanceName:
        output += '<P>Error: missing component or instance name query parameter\n'
    else:
        try:
            TenantUtil.addConfigComponent(componentName, instanceName, logger=_logger)
            output += '<P>Added\n'
        except TenantUtil.DatabaseError, ex:
            output += '<P>Error: ' + str(ex)

    output += '<P><A HREF="/">Continue</A>'
    output += _htmlEpilog
    return output

@route('/deleteComponent',method=['OPTIONS','GET'])
def deleteComponent():
    '''Deletes a new component/instance pair.'''
    _logger.info('request: ' + str(request))
    _addResponseHeaders()
    output = _htmlProlog
    componentName = request.query.get('componentName')
    instanceName = request.query.get('instanceName')
    if not componentName or not instanceName:
        output += '<P>Error: missing component or instance name query parameter\n'
    else:
        try:
            TenantUtil.deleteConfigComponent(componentName, instanceName, logger=_logger)
            output += '<P>Deleted\n'
        except TenantUtil.DatabaseError, ex:
            output += '<P>Error: ' + str(ex)

    output += '<P><A HREF="/">Continue</A>'
    output += _htmlEpilog
    return output

@route('/editParam',method=['OPTIONS','GET'])
def editParam():
    '''Lets the user delete a parameter or changes its value.'''
    _logger.info('request: ' + str(request))
    _addResponseHeaders()
    output = _htmlProlog
    componentName = request.query.get('componentName')
    instanceName = request.query.get('instanceName')
    propName = request.query.get('propName')
    propValue = request.query.get('propValue')
    if not componentName or not instanceName or not propName or propValue is None:
        output += '<P>Error: missing query parameter\n'
    else:
        # Display a form to change the value.
        output += '<H3>Configuration for component <TT>%s</TT> instance <TT>%s</TT> parameter <TT>%s</TT></H3>\n' % \
                  (cgi.escape(componentName), cgi.escape(instanceName),
                   cgi.escape(propName))
        output += '<FORM METHOD="GET" ACTION="updateParam">\n'
        output += '<INPUT TYPE="HIDDEN" NAME="componentName" VALUE="%s">\n' % \
                  cgi.escape(componentName)
        output += '<INPUT TYPE="HIDDEN" NAME="instanceName" VALUE="%s">\n' % \
                  cgi.escape(instanceName)
        output += '<INPUT TYPE="HIDDEN" NAME="propName" VALUE="%s">\n' % \
                  cgi.escape(propName)
        output += 'New value:&nbsp\n'
        output += '<INPUT TYPE="TEXT" NAME="propValue">\n'
        output += '<INPUT TYPE="SUBMIT" VALUE="Update">\n'
        output += '</FORM>\n'

        # Separate the two forms with a line.
        output += '<HR>\n'

        # Display a form to delete the parameter.
        output += '<FORM METHOD="GET" ACTION="deleteParam">\n'
        output += '<INPUT TYPE="HIDDEN" NAME="componentName" VALUE="%s">\n' % \
                  cgi.escape(componentName)
        output += '<INPUT TYPE="HIDDEN" NAME="instanceName" VALUE="%s">\n' % \
                  cgi.escape(instanceName)
        output += '<INPUT TYPE="HIDDEN" NAME="propName" VALUE="%s">\n' % \
                  cgi.escape(propName)
        output += 'Click to delete this parameter:&nbsp\n'
        output += '<INPUT TYPE="SUBMIT" VALUE="Delete">\n'
        output += '</FORM>\n'

        output += '<HR>\n'
        output += '<P><A HREF="/component?%s">Continue without making any changes</A>' % \
                  urllib.urlencode({'componentName' : componentName,
                                    'instanceName' : instanceName})

    output += _htmlEpilog
    return output

@route('/deleteParam',method=['OPTIONS','GET'])
def deleteParam():
    '''Deletes a parameter if it exists.'''
    _logger.info('request: ' + str(request))
    _addResponseHeaders()
    output = _htmlProlog
    componentName = request.query.get('componentName')
    instanceName = request.query.get('instanceName')
    propName = request.query.get('propName')
    if not componentName or not instanceName or not propName:
        output += '<P>Error: missing query parameter\n'
    else:
        TenantUtil.deleteConfigParameter(componentName, instanceName, propName, logger=_logger)
        output += '<P>Parameter has been deleted'
        output += '<P><A HREF="/editComponent?%s">Continue</A>' % \
                  urllib.urlencode({'componentName' : componentName,
                                    'instanceName' : instanceName})
    output += _htmlEpilog
    return output

@route('/updateParam',method=['OPTIONS','GET'])
def updateParam():
    '''Adds a parameter, first deleting any parameter with the same component, instance, and name.
    This can be used either for updating an existing parameter or for adding a new one.'''
    _logger.info('request: ' + str(request))
    _addResponseHeaders()
    output = _htmlProlog
    componentName = request.query.get('componentName')
    instanceName = request.query.get('instanceName')
    propName = request.query.get('propName')
    propValue = request.query.get('propValue')
    newParam = request.query.get('newParam') # present when adding a new parameter
    if not componentName or not instanceName or not propName or propValue is None:
        output += '<P>Error: missing query parameter\n'
    else:
        try:
            TenantUtil.deleteConfigParameter(componentName, instanceName, propName,
                                             logger=_logger)
            TenantUtil.addConfigParameter(componentName, instanceName, propName, propValue,
                                          logger=_logger)
            if newParam:
                output += '<P>Parameter has been added'
            else:
                output += '<P>Parameter has been udpated'
        except TenantUtil.DatabaseError, ex:
            output += '<P>Error: ' + str(ex)

    output += '<P><A HREF="/editComponent?%s">Continue</A>' % \
              urllib.urlencode({'componentName' : componentName,
                                'instanceName' : instanceName})
    output += _htmlEpilog
    return output

@route('/sleep',method=['GET'])
def sleep():
    '''Sleep for a few seconds.  Used only for testing.
    Sample command:
    curl "http://localhost:8082/sleep?delay=10"
'''
    import time
    response.content_type = 'text/plain'
    delay = 5
    delayStr = request.query.get('delay')
    if delayStr:
        try:
            delay = int(delayStr)
        except ValueError, ex:
            return 'Bad delay value "%s", must be a positive integer\r\n' % delayStr
        if delay <= 0:
            return "Delay must be > 0\r\n"
    time.sleep(delay)
    return 'OK\r\n'

def main():
    # Use the program name as the section name in the config file.
    port = ConfigDb.getIntValue(_programName, 'port', 8082, logger=_logger)
    _logger.info("Listening on port %d" % port)
    server = importBottleWebServer(_logger)
    run(host='0.0.0.0', port=port, debug=True, reloader=True, server=server)

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
    sys.exit(1)
