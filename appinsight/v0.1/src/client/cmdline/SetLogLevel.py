#!/usr/bin/env python

# Sets the log level of programs that support such a service.

import sys
import os
import glob

srcDir = os.path.join(os.path.dirname(sys.argv[0]), '..', '..')
vendorDir = os.path.join(srcDir, '..', 'vendor')
# Look for non-standard Python packages in either the vendor directory or the standard
# Python library location.
for pattern in (vendorDir + '/*-requests-*/requests',):
    pkgDirs = glob.glob(pattern)
    if pkgDirs:
        sys.path.insert(0, os.path.dirname(pkgDirs[0]))

sys.path.insert(0, srcDir + '/common')

try:
    import json
    import ConfigDb
    import requests
except ImportError, ex:
    print >> sys.stderr, 'import error:', ex
    sys.exit(1)

class App:
    def __init__(self):
        '''Constructor.'''
        self.debug = False
        self.knownServices = ('PluginCollector', 'TenantServer', 'LogIndexer')
        self.knownLogLevels = ('debug',
                               'info',
                               'warning',
                               'error',
                               'critical')

        self.service = None # the service whose log level is to be changed
        self.logLevel = None # log level

    def usage(self):
        '''Displays the valid command-line arguments.'''
        print >> sys.stderr,  'usage: %s [-debug] %s %s' % \
              (self.pgm,
               '|'.join(self.knownServices),
               '|'.join(self.knownLogLevels))

    def parseArgs(self, argv):
        '''Parses command-line arguments and sets instance variables.'''
        self.pgm = argv[0]
        args = argv[1:]
        while args:
            arg = args[0]
            if arg == '-debug':
                self.debug = True
            elif arg[0:1] == '-':
                print >> sys.stderr, '%s: unknown flag "%s"' % (self.pgm, arg)
                return False
            elif not self.service:
                self.service = arg
                if self.service not in self.knownServices:
                    print >> sys.stderr,  '%s: unknown service "%s"' % (self.pgm, self.service)
                    return False
            elif not self.logLevel:
                self.logLevel = arg
                if self.logLevel not in self.knownLogLevels:
                    print >> sys.stderr,  '%s: unknown log level "%s"' % \
                          (self.pgm, self.logLevel)
                    return False
            else:
                print >> sys.stderr,  '%s: invalid argument "%s"' % (self.pgm, arg)
                return False
            args = args[1:]

        if not self.service:
            print >> sys.stderr,  '%s: missing service' % self.pgm
            return False
            
        if not self.logLevel:
            print >> sys.stderr,  '%s: missing log level' % self.pgm
            return False
            
        return True

    def main(self):
        '''Main method.  Before calling this, call parseArgs() or set the relevant
        instance variables.'''

        # Get the service's host and port.
        host = ConfigDb.getStringValue(self.service, 'host', 'localhost')
        port = ConfigDb.getIntValue(self.service, 'port', -1)
        if port < 0:
            print >> sys.stderr,  '%s: cannot determine TCP port for service %s' % \
                  (self.pgm, self.service)
            return False
            
        url = 'http://%s:%d/log/setLevel' % (host, port)
        requestBody = '{"level":"%s"}' % self.logLevel
        headers = {'content-type':'application/json'}
        if self.debug:
            print >> sys.stderr, 'Sending %s to %s' % (requestBody, url)

        # Send the request to the service.
        try:
            resp = requests.post(url, headers=headers, data=requestBody, timeout=3.0)
        except requests.exceptions.ConnectionError, ex:
            print >> sys.stderr, '%s: POST %s: ERROR: %s' % (self.pgm, url, ex)
            return False
        except requests.exceptions.RequestException, ex:
            print >> sys.stderr, '%s: POST %s: ERROR: %s' % (self.pgm, url, ex)
            return False
        except requests.exceptions.Timeout, ex:
            print >> sys.stderr, '%s: POST %s: ERROR: timeout' % (self.pgm, url)
            return False

        if self.debug:
            print >> sys.stderr, 'Response HTTP status: %d' % resp.status_code

        # Check the HTTP response status.
        if resp.status_code != 200:
            print >> sys.stderr, '%s: error %d from server: %s' % \
                  (self.pgm, resp.status_code, resp.text)
            return False
           
        if self.debug:
            print >> sys.stderr, 'response:', resp.text

        # Interpret the response body as JSON.
        try:
            data = json.loads(resp.text)
        except Exception, ex:
            print >> sys.stderr, '%s: response error from %s: %s' % \
                  (self.pgm, url, ex)
            return False

        # Make sure the response is a JSON object.
        if type(data) != dict:
            print >> sys.stderr, '%s: unexpected response from %s: %s' % \
                  (self.pgm, url, resp.text)
            return False

        # Get the 'status' value from the JSON object.
        status = data.get('status')
        if not status:
            print >> sys.stderr, '%s: missing status in response from %s: %s' % \
                  (self.pgm, url, resp.text)
            return False

        # Make sure 'status' is 'OK'.
        if status != 'OK':
            print >> sys.stderr, '%s: error reported from %s: %s' % \
                  (self.pgm, url, resp.text)
            return False
        
        print '%s: log level successfully set' % self.pgm
        return True


# Main-line code starts here.
app = App()
if not app.parseArgs(sys.argv):
    app.usage()
    sys.exit(2)
if not app.main():
    sys.exit(1)
sys.exit(0)
