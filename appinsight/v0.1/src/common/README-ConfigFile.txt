ConfigFile.py reads $HOME/AppInsight/AppInsight.conf

Note: except for the [db] section, the config parameters are now stored in the
database, and any values in the file are ignored.

Here is a sample file:

[StandardCollector]
port = 9501

[PluginCollector]
port = 9501

[LogIndexer]
port = 9502

[TenantServer]
port = 8080

[redis]
host = localhost
port = 6379
# channelPrefix is prefixed to the redis channel.
channelPrefix = insightal.inputevents.

[collectdserver]
port = 9500

# for sqlite:
# Install the Python apsw module from http://rogerbinns.github.io/apsw/
[db]
driver = apsw

# for MySql:
#   Install the MySql server and the Python MySql ODBC connector.  See:
#   http://dev.mysql.com/doc/connector-python/en/index.html
#   Once it's installed, run the mysql command-line program and create
#   a mysql user and database, using commands similar to the following:
#   To create a user and assign a password:
#     create user 'appinsightuser'@'localhost' identified by 'appinsightpass';
#   To create a database:
#     create database appinsightdb;
#   To give the user access to the database:
#     grant all on appinsightdb.* to 'appinsightuser'@'localhost';
#  Then define the following entries in your config file, using the
#  user name, password, and database name that you used in the mysql commands:
[db]
driver = mysql.connector
user = appinsightuser
password = appinsightpass
database = appinsightdb
host = 127.0.0.1

##################################################

Clients of collectdserver should use a URL path of the form:
/?channel=COLLECTION-ID
where COLLECTION-ID is the collection id where the data should be indexed.
