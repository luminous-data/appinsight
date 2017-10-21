import datetime
import string

def customizeEvent(record, logger):

    message = record.get('message')

    if not message:
        logger.error('missing "time" input parameter')
    try:
        msgTokens = string.split(message)
        date = msgTokens[0]
        time = msgTokens[1]
        level = msgTokens[2]
        msg = msgTokens[3:]
        record['level'] = level
    except Exception, ex:
        logger.error('error in parsing message; ' + str(ex))

    return record


