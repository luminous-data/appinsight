#!/usr/bin/env python

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

# This reads HTTP POST requests from logstash and writes each
# request body to redis as a separate entry using the publish/subscribe
# interface.  The collection id comes from the "add_field" entry
# in the "input" section of the logStash configuration:
#
# input {
#   file { 
#     path => "/tmp/access.log" 
#     type => "apache-access"
#     add_field => ["channel", "12345"]
#   }
# }
# output {
#   http { 
#     format => "json" http_method => "post" url => "http://127.0.0.1:14501/sendToRedis"
#  }
# }
#
# where "12345" is the collection id.

import sys
import urlparse
import glob
import os.path
import BaseHTTPServer

# Look for redis-py and simplejson in either ../../vendor or the
# standard Python library location.

sys.path.insert(0, '../common')

for pattern in ('../../vendor/redis-py-master*/redis',
                '../../vendor/simplejson-*/simplejson'):
    pkgDirs = glob.glob(pattern)
    if pkgDirs:
        sys.path.insert(0, os.path.dirname(pkgDirs[0]))
try:
    import redis, simplejson
    import ConfigDb
except ImportError, ex:
    print "Can't find module:", ex
    print "Search path:", sys.path
    sys.exit(1)

REDIS_HOST = None # set in main()
REDIS_HOST = None # set in main()

channelPrefix = ConfigDb.getStringValue('redis',
                                        'channelPrefix',
                                        'insightal.inputevents.')

redisConn = None  # connection to redis

# Parse JSON data.
# return: (False, message) on error, or (True, value) on success
def parseJsonData(jsonstr):
    print 'The string sent by logstash is ' + str(jsonstr)
    try:
        dct = simplejson.loads(jsonstr)
    except simplejson.scanner.JSONDecodeError, ex:
        return (False, "bad JSON data: " + ex.message)
    return (True, dct)

# Look for the channel in a JSON message from logStash.
def getChannel(dct):
    try:
        return dct["@fields"]["channel"][0]
    except:
        return None

# Connects to a redis database.
# return: True on success
def connectToRedis():
    global redisConn
    try:
        redisConn = redis.StrictRedis(host=REDIS_HOST, port=REDIS_HOST, db=0)
    except Exception, ex:
        print "Can't connect to redis:", ex
        return False
    return True

class FilterHTTPRequestHandler(BaseHTTPServer.BaseHTTPRequestHandler):

    protocol_version = 'HTTP/1.1'

    # Handler for the POST command.
    def do_POST(self):
        self.readRequestBody()
        (scheme, host, path, params, query, fragment) = \
                 urlparse.urlparse(self.path)
        if path == '/sendToRedis':   # this is the only valid URL path
            self.handleSendToRedis()
        else:
            bodyText = 'Unknown URL path %s\r\n' % path
            self.send_response(404)
            self.send_header('Content-Length', len(bodyText))
            self.send_header('Content-Type', 'text/plain')
            self.send_header('Cache-Control', 'no-cache')
            self.end_headers()
            self.wfile.write(bodyText)

    # Reads the requst body of a POST and saves it in self.requestBody.
    def readRequestBody(self):
        self.requestBody = ''
        # Get the content-length header.
        try:
            resid = int(self.headers['content-length'])
            haveResid = True
        except:
            resid = -1
            haveResid = False
        # Read until the expected number of bytes has been read, or
        # EOF if the expected number of bytes is unknown because there
        # is no request content-length header.
        while not haveResid or resid > 0:
            bytes = self.rfile.read(resid)
            if not bytes: break
            resid -= len(bytes)
            self.requestBody += bytes

    # Sends the request body to redis and sends an HTTP response.
    def handleSendToRedis(self):
        (statusCode, msg) = self.sendToRedis(self.requestBody)
        bodyText = msg + '\r\n'
        self.send_response(statusCode)
        self.send_header('Content-Length', len(bodyText))
        self.send_header('Content-Type', 'text/plain')
        self.send_header('Cache-Control', 'no-cache')
        self.end_headers()
        self.wfile.write(bodyText)

    # Sends data to redis.
    # return: (statusCode, message) where statusCode is an HTTP status code
    #  (200 for success, 4xx or 5xx for failure - see RFC 2616) and message
    #  is returned in the response body
    def sendToRedis(self, value):
        (status, dct) = parseJsonData(value)
        if not status:
            return (400, dct) # can't parse JSON
        channel = getChannel(dct)
        if not channel:
            return (400, "Can't find channel in input")
        global redisConn
        if not redisConn and not connectToRedis():
            # TODO: maybe queue the data and try later
            return (503, "Cannot connect to redis")
        try:
            redisChannel = channelPrefix + channel
            print 'LogCollectorService: publishing to channel', redisChannel ### TESTING
            numSubscribers = redisConn.publish(redisChannel, value)
            # TODO: if it fails because redis went down, try re-connecting
            # some number of times
            return (200, "Sending to channel %s" % redisChannel)
        except Exception, ex:
            return (503, str(ex))

# Top-level routine.
def main():
    REDIS_HOST = ConfigDb.getStringValue('redis', 'host', 'localhost')
    REDIS_HOST = ConfigDb.getIntValue('redis', 'port', 6379)
    port = 14501 # HTTP listen port
    server_address = ('', port) # listen on any IP address
    try:
        httpd = BaseHTTPServer.HTTPServer(server_address, FilterHTTPRequestHandler)
    except Exception, ex:
        print >> sys.stderr, 'Error:', ex
        return
    httpd.serve_forever()

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
    sys.exit(1)
