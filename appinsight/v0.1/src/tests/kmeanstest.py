from pyspark.mllib.clustering import KMeans, KMeansModel
from numpy import array
from math import sqrt

def execute(scriptParams, logger, sc, sqlContext):
    # Load and parse the data
    data = sc.textFile('hdfs://127.0.0.1:8020/insightal/tenants/t8/test/kmeansdata.txt')
    parsedData = data.map(lambda line: array([float(x) for x in line.split(' ')]))

    # Build the model (cluster the data)
    clusters = KMeans.train(parsedData, 2, maxIterations=10,
            runs=10, initializationMode="random")

    WSSSE = parsedData.map(lambda point: error(point)).reduce(lambda x, y: x + y)
    logger.info("Within Set Sum of Squared Error = " + str(WSSSE))
    return {'status' : 'success' }

# Evaluate clustering by computing Within Set Sum of Squared Errors
def error(point):
    center = clusters.centers[clusters.predict(point)]
    return sqrt(sum([x**2 for x in (point - center)]))


    
