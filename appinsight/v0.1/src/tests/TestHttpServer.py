import sys
import sqlite3
import glob
import os.path
import string
import requests
from bottle import request, response, route, get, post, abort, run, static_file, hook
import json, redis
import sys, traceback
import datetime



@route('/postevents',method=['OPTIONS','POST'])
def root():
    try:
        record = request.json
        print record
    except Exception, ex:
        print 'Exception'

def main():
    run(host='0.0.0.0', port=9123, debug=True, reloader=True)

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
    sys.exit(1)
