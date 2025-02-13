from flask import Flask, request, jsonify, make_response, Response
import requests
import json
from dotenv import load_dotenv
import os
import logging
from Utilities.fmp import *
from azure.cosmos import CosmosClient, PartitionKey
from azure.search.documents.indexes import SearchIndexClient
from azure.search.documents.indexes.models import *
from azure.search.documents import SearchClient
from azure.core.credentials import AzureKeyCredential
from azure.storage.blob import BlobServiceClient, ContentSettings
from azure.identity import ClientSecretCredential, DefaultAzureCredential

load_dotenv()
app = Flask(__name__)

@app.route("/", defaults={"path": "index.html"})
@app.route("/<path:path>")
def static_file(path):
    return app.send_static_file(path)

@app.route("/getSec", methods=["POST"])
def getSec():
    step=request.json["step"]
    reProcess=request.json["reProcess"]
    postBody=request.json["postBody"]
 
    try:
        headers = {'content-type': 'application/json'}
        url = os.environ.get("SEC_URL")

        data = postBody
        params = {'step': step, 'reProcess': reProcess }
        resp = requests.post(url, params=params, data=json.dumps(data), headers=headers)
        jsonDict = json.loads(resp.text)
        return jsonify(jsonDict)
    except Exception as e:
        logging.exception("Exception in /getSec")
        return jsonify({"error": str(e)}), 500
    
@app.route("/secChat", methods=["POST"])
def secChat():
    symbol=request.json["symbol"]
    year=request.json["year"]
    reportType=request.json["reportType"]
    indexName=request.json["indexName"]
    postBody=request.json["postBody"]
 
    logging.info(f"symbol: {symbol}")
    
    try:
        headers = {'content-type': 'application/json'}
        url = os.environ.get("SECCHAT_URL")

        data = postBody
        params = {'symbol': symbol, 'year':year, 'reportType': reportType, 'indexName': indexName }
        resp = requests.post(url, params=params, data=json.dumps(data), headers=headers)
        jsonDict = json.loads(resp.text)
        #return json.dumps(jsonDict)
        return jsonify(jsonDict)
    except Exception as e:
        logging.exception("Exception in /pibChat")
        return jsonify({"error": str(e)}), 500

@app.route("/getNews", methods=["POST"])
def getNews():
    symbol=request.json["symbol"]
    logging.info(f"symbol: {symbol}")
    try:
        FmpKey = os.environ.get("FMPKEY")

        newsResp = stockNews(apikey=FmpKey, tickers=[symbol], limit=10)
        return jsonify(newsResp)
    except Exception as e:
        logging.exception("Exception in /getNews")
        return jsonify({"error": str(e)}), 500

@app.route("/getSocialSentiment", methods=["POST"])
def getSocialSentiment():
    symbol=request.json["symbol"]
    logging.info(f"symbol: {symbol}")
    try:
        FmpKey = os.environ.get("FMPKEY")

        sSentiment = socialSentiments(apikey=FmpKey, symbol=symbol)
        return jsonify(sSentiment)
    except Exception as e:
        logging.exception("Exception in /getSocialSentiment")
        return jsonify({"error": str(e)}), 500

@app.route("/getIncomeStatement", methods=["POST"])
def getIncomeStatement():
    symbol=request.json["symbol"]
    logging.info(f"symbol: {symbol}")
    try:
        FmpKey = os.environ.get("FMPKEY")

        sSentiment = incomeStatement(apikey=FmpKey, symbol=symbol, limit=5)
        return jsonify(sSentiment)
    except Exception as e:
        logging.exception("Exception in /getIncomeStatement")
        return jsonify({"error": str(e)}), 500
    
@app.route("/getCashFlow", methods=["POST"])
def getCashFlow():
    symbol=request.json["symbol"]
    logging.info(f"symbol: {symbol}")
    try:
        FmpKey = os.environ.get("FMPKEY")

        sSentiment = cashFlowStatement(apikey=FmpKey, symbol=symbol, limit=5)
        return jsonify(sSentiment)
    except Exception as e:
        logging.exception("Exception in /getCashFlow")
        return jsonify({"error": str(e)}), 500

@app.route("/getAllSessions", methods=["POST"])
def getAllSessions():
    indexType=request.json["indexType"]
    feature=request.json["feature"]
    type=request.json["type"]
    
    try:
        CosmosEndPoint = os.environ.get("CosmosEndPoint")
        CosmosDb = os.environ.get("CosmosDatabase")
        CosmosContainer = os.environ.get("CosmosContainer")

        credentials = ClientSecretCredential(os.environ.get("TENANTID"), os.environ.get("CLIENTID"), os.environ.get("CLIENTSECRET"))
        cosmosClient = CosmosClient(url=CosmosEndPoint, credential=credentials)
        cosmosDb = cosmosClient.create_database_if_not_exists(id=CosmosDb)
        cosmosKey = PartitionKey(path="/sessionId")
        cosmosContainer = cosmosDb.create_container_if_not_exists(id=CosmosContainer, partition_key=cosmosKey, offer_throughput=400)

        cosmosQuery = "SELECT c.sessionId, c.name, c.indexId FROM c WHERE c.type = @type and c.feature = @feature and c.indexType = @indexType"
        params = [dict(name="@type", value=type), 
                  dict(name="@feature", value=feature), 
                  dict(name="@indexType", value=indexType)]
        results = cosmosContainer.query_items(query=cosmosQuery, parameters=params, enable_cross_partition_query=True)
        items = [item for item in results]
        #output = json.dumps(items, indent=True)
        return jsonify(items)
    except Exception as e:
        logging.exception("Exception in /getAllSessions")
        return jsonify({"error": str(e)}), 500
        
@app.route("/getAllIndexSessions", methods=["POST"])
def getAllIndexSessions():
    indexType=request.json["indexType"]
    indexNs=request.json["indexNs"]
    feature=request.json["feature"]
    type=request.json["type"]
    
    try:
        CosmosEndPoint = os.environ.get("CosmosEndPoint")
        CosmosDb = os.environ.get("CosmosDatabase")
        CosmosContainer = os.environ.get("CosmosContainer")

        credentials = ClientSecretCredential(os.environ.get("TENANTID"), os.environ.get("CLIENTID"), os.environ.get("CLIENTSECRET"))
        cosmosClient = CosmosClient(url=CosmosEndPoint, credential=credentials)
        cosmosDb = cosmosClient.create_database_if_not_exists(id=CosmosDb)
        cosmosKey = PartitionKey(path="/sessionId")
        cosmosContainer = cosmosDb.create_container_if_not_exists(id=CosmosContainer, partition_key=cosmosKey, offer_throughput=400)

        cosmosQuery = "SELECT c.sessionId, c.name FROM c WHERE c.type = @type and c.feature = @feature and c.indexType = @indexType and c.indexId = @indexNs"
        params = [dict(name="@type", value=type), 
                  dict(name="@feature", value=feature), 
                  dict(name="@indexType", value=indexType), 
                  dict(name="@indexNs", value=indexNs)]
        results = cosmosContainer.query_items(query=cosmosQuery, parameters=params, enable_cross_partition_query=True)
        items = [item for item in results]
        #output = json.dumps(items, indent=True)
        return jsonify(items)
    except Exception as e:
        logging.exception("Exception in /getAllIndexSessions")
        return jsonify({"error": str(e)}), 500
    
@app.route("/getIndexSession", methods=["POST"])
def getIndexSession():
    indexType=request.json["indexType"]
    indexNs=request.json["indexNs"]
    sessionName=request.json["sessionName"]
    
    try:
        CosmosEndPoint = os.environ.get("CosmosEndPoint")
        CosmosDb = os.environ.get("CosmosDatabase")
        CosmosContainer = os.environ.get("CosmosContainer")

        credentials = ClientSecretCredential(os.environ.get("TENANTID"), os.environ.get("CLIENTID"), os.environ.get("CLIENTSECRET"))
        cosmosClient = CosmosClient(url=CosmosEndPoint, credential=credentials)
        cosmosDb = cosmosClient.create_database_if_not_exists(id=CosmosDb)
        cosmosKey = PartitionKey(path="/sessionId")
        cosmosContainer = cosmosDb.create_container_if_not_exists(id=CosmosContainer, partition_key=cosmosKey, offer_throughput=400)

        cosmosQuery = "SELECT c.id, c.type, c.sessionId, c.name, c.chainType, \
         c.feature, c.indexId, c.IndexType, c.IndexName, c.llmModel, \
          c.timestamp, c.tokenUsed, c.embeddingModelType FROM c WHERE c.name = @sessionName and c.indexType = @indexType and c.indexId = @indexNs"
        params = [dict(name="@sessionName", value=sessionName), 
                  dict(name="@indexType", value=indexType), 
                  dict(name="@indexNs", value=indexNs)]
        results = cosmosContainer.query_items(query=cosmosQuery, parameters=params, enable_cross_partition_query=True,
                                              max_item_count=1)
        sessions = [item for item in results]
        return jsonify(sessions)
    except Exception as e:
        logging.exception("Exception in /getIndexSession")
        return jsonify({"error": str(e)}), 500
    
@app.route("/deleteIndexSession", methods=["POST"])
def deleteIndexSession():
    indexType=request.json["indexType"]
    indexNs=request.json["indexNs"]
    sessionName=request.json["sessionName"]
    
    try:
        CosmosEndPoint = os.environ.get("CosmosEndPoint")
        CosmosDb = os.environ.get("CosmosDatabase")
        CosmosContainer = os.environ.get("CosmosContainer")

        credentials = ClientSecretCredential(os.environ.get("TENANTID"), os.environ.get("CLIENTID"), os.environ.get("CLIENTSECRET"))
        cosmosClient = CosmosClient(url=CosmosEndPoint, credential=credentials)
        cosmosDb = cosmosClient.create_database_if_not_exists(id=CosmosDb)
        cosmosKey = PartitionKey(path="/sessionId")
        cosmosContainer = cosmosDb.create_container_if_not_exists(id=CosmosContainer, partition_key=cosmosKey, offer_throughput=400)

        cosmosQuery = "SELECT c.sessionId FROM c WHERE c.name = @sessionName and c.indexType = @indexType and c.indexId = @indexNs"
        params = [dict(name="@sessionName", value=sessionName), 
                  dict(name="@indexType", value=indexType), 
                  dict(name="@indexNs", value=indexNs)]
        results = cosmosContainer.query_items(query=cosmosQuery, parameters=params, enable_cross_partition_query=True,
                                              max_item_count=1)
        sessions = [item for item in results]
        sessionData = json.loads(json.dumps(sessions))[0]
        cosmosAllDocQuery = "SELECT * FROM c WHERE c.sessionId = @sessionId"
        params = [dict(name="@sessionId", value=sessionData['sessionId'])]
        allDocs = CosmosContainer.query_items(query=cosmosAllDocQuery, parameters=params, enable_cross_partition_query=True)
        for i in allDocs:
            cosmosContainer.delete_item(i, partition_key=i["sessionId"])
        
        #deleteQuery = "SELECT c._self FROM c WHERE c.sessionId = '" + sessionData['sessionId'] + "'"
        #result = CosmosContainer.scripts.execute_stored_procedure(sproc="bulkDeleteSproc",params=[deleteQuery], partition_key=CosmosKey)
        #print(result)
        
        #CosmosContainer.delete_all_items_by_partition_key(sessionData['sessionId'])
        return jsonify(sessions)
    except Exception as e:
        logging.exception("Exception in /deleteIndexSession")
        return jsonify({"error": str(e)}), 500
    
@app.route("/renameIndexSession", methods=["POST"])
def renameIndexSession():
    oldSessionName=request.json["oldSessionName"]
    newSessionName=request.json["newSessionName"]
    
    try:
        CosmosEndPoint = os.environ.get("CosmosEndPoint")
        CosmosDb = os.environ.get("CosmosDatabase")
        CosmosContainer = os.environ.get("CosmosContainer")

        credentials = ClientSecretCredential(os.environ.get("TENANTID"), os.environ.get("CLIENTID"), os.environ.get("CLIENTSECRET"))
        cosmosClient = CosmosClient(url=CosmosEndPoint, credential=credentials)
        cosmosDb = cosmosClient.create_database_if_not_exists(id=CosmosDb)
        cosmosKey = PartitionKey(path="/sessionId")
        cosmosContainer = cosmosDb.create_container_if_not_exists(id=CosmosContainer, partition_key=cosmosKey, offer_throughput=400)

        cosmosQuery = "SELECT * FROM c WHERE c.name = @sessionName and c.type = 'Session'"
        params = [dict(name="@sessionName", value=oldSessionName)]
        results = cosmosContainer.query_items(query=cosmosQuery, parameters=params, enable_cross_partition_query=True,
                                              max_item_count=1)
        sessions = [item for item in results]
        sessionData = json.loads(json.dumps(sessions))[0]
        #selfId = sessionData['_self']
        sessionData['name'] = newSessionName
        cosmosContainer.replace_item(item=sessionData, body=sessionData)
        return jsonify(sessions)
    except Exception as e:
        logging.exception("Exception in /renameIndexSession")
        return jsonify({"error": str(e)}), 500

@app.route("/getIndexSessionDetail", methods=["POST"])
def getIndexSessionDetail():
    sessionId=request.json["sessionId"]
    
    try:
        CosmosEndPoint = os.environ.get("CosmosEndPoint")
        CosmosDb = os.environ.get("CosmosDatabase")
        CosmosContainer = os.environ.get("CosmosContainer")

        credentials = ClientSecretCredential(os.environ.get("TENANTID"), os.environ.get("CLIENTID"), os.environ.get("CLIENTSECRET"))
        cosmosClient = CosmosClient(url=CosmosEndPoint, credential=credentials)
        cosmosDb = cosmosClient.create_database_if_not_exists(id=CosmosDb)
        cosmosKey = PartitionKey(path="/sessionId")
        cosmosContainer = cosmosDb.create_container_if_not_exists(id=CosmosContainer, partition_key=cosmosKey, offer_throughput=400)

        cosmosQuery = "SELECT c.role, c.content FROM c WHERE c.sessionId = @sessionId and c.type = 'Message' ORDER by c._ts ASC"
        params = [dict(name="@sessionId", value=sessionId)]
        results = cosmosContainer.query_items(query=cosmosQuery, parameters=params, enable_cross_partition_query=True)
        items = [item for item in results]
        #output = json.dumps(items, indent=True)
        return jsonify(items)
    except Exception as e:
        logging.exception("Exception in /getIndexSessionDetail")
        return jsonify({"error": str(e)}), 500

@app.route("/getSecFilingProcessedData", methods=["GET"])
def getSecFilingProcessedData():
    SearchService = os.environ['SearchService']
    SearchKey = os.environ['SearchKey']
    indexName = os.environ['SecPdfVectorIndex']

    searchClient = SearchClient(endpoint=f"https://{SearchService}.search.windows.net",
        index_name=indexName,
        credential=AzureKeyCredential(SearchKey))
    
    try:
        r = searchClient.search(  
            search_text="",
            #select=["sector", "industry", "symbol", "filingYear", "filingType"],
            select=["symbol", "filingYear", "filingType"],
            semantic_configuration_name="semanticConfig",
            include_total_count=True
        )
        documentList = []
        for document in r:
            try:
                #documentList.append({'sector': document['sector'],
                #                        'industry': document['industry'],
                #                        'symbol': document['symbol'],
                #                        'year': document['year'],
                #                        'filingType': document['filingType']})
                value = {'symbol': document['symbol'],
                                            'year': document['filingYear'],
                                            'filingType': document['filingType']}
                if value not in documentList:
                    documentList.append(value)                
            except Exception as e:
                pass

        return jsonify({"values" : documentList})
    except Exception as e:
        logging.exception("Exception in /getSecFilingProcessedData")
        return jsonify({"error": str(e)}), 500

@app.route("/getSecFilingVectoredData", methods=["GET"])
def getSecFilingVectoredData():
    SearchService = os.environ['SearchService']
    SearchKey = os.environ['SearchKey']
    indexName = os.environ['SecPdfVectorIndex']

    searchClient = SearchClient(endpoint=f"https://{SearchService}.search.windows.net",
        index_name=indexName,
        credential=AzureKeyCredential(SearchKey))
    
    try:
        r = searchClient.search(  
            search_text="",
            select=["symbol", "cik", "filingYear", "filingType"],
            semantic_configuration_name="semanticConfig",
            include_total_count=True
        )
        documentList = []
        for document in r:
            try:
                documentList.append({'symbol': document['symbol'],
                                        'cik': document['cik'],
                                        'filingYear': document['filingYear'],
                                        'filingType': document['filingType']})
            except Exception as e:
                pass
        return jsonify({"values" : documentList})
    except Exception as e:
        logging.exception("Exception in /getSecFilingVectoredData")
        return jsonify({"error": str(e)}), 500

@app.route("/verifyPassword", methods=["POST"])
def verifyPassword():
    try:
        passType=request.json["passType"]
        password=request.json["password"]
        UploadPassword = os.environ.get("UploadPassword")
        AdminPassword = os.environ.get("AdminPassword")

        results = {}
        results["values"] = []

        if (passType == 'upload'):
            if (UploadPassword.strip() == ''):
                results["values"].append(
                    {
                    "recordId": 1,
                        "data": {
                            "error": "Upload Password is not set"
                        }
                    })
            elif (password.strip() != UploadPassword.strip()):
                results["values"].append(
                    {
                    "recordId": 1,
                        "data": {
                            "error": "Upload Password is incorrect"
                        }
                    })
            else:
                results["values"].append(
                    (
                    {
                    "recordId": 1,
                     "data": {
                            "error": "Success"
                        }
                    }))
        elif (passType == 'admin'):
            if (AdminPassword.strip() == ''): 
                results["values"].append(
                    {
                    "recordId": 1,
                        "data": {
                            "error": "Admin Password is not set"
                        }
                    })
            elif (password.strip() != AdminPassword.strip()):
                results["values"].append(
                    {
                    "recordId": 1,
                        "data": {
                            "error": "Admin Password is incorrect"
                        }
                    })
            else:
                results["values"].append(
                    (
                    {
                    "recordId": 1,
                     "data": {
                            "error": "Success"
                        }
                    }))
         
        resp = json.dumps(results)
        logging.info(f"resp: {resp}")
        jsonDict = json.loads(resp)
        return jsonify(jsonDict)
    except Exception as e:
        logging.exception("Exception in /verifyPassword")
        return jsonify({"error": str(e)}), 500

@app.route("/uploadBinaryFile", methods=["POST"])
def uploadBinaryFile():
   
    # try:
    #     if 'file' not in request.files:
    #         return jsonify({'message': 'No file in request'}), 400
        
    #     file = request.files['file']
    #     fileName = file.filename
    #     blobName = os.path.basename(fileName)

    #     url = os.environ.get("BlobConnectionString")
    #     containerName = os.environ.get("BlobPdfContainer")
    #     blobServiceClient = BlobServiceClient.from_connection_string(url)
    #     containerClient = blobServiceClient.get_container_client(containerName)
    #     blobClient = containerClient.get_blob_client(blobName)
    #     blobClient.upload_blob(file.read(), overwrite=True)
    #     blobClient.set_blob_metadata(metadata={"embedded": "false", 
    #                                     "indexType": "cogsearchvs"})
    #     return jsonify({'message': 'File uploaded successfully'}), 200
    # except Exception as e:
    #     logging.exception("Exception in /uploadBinaryFile")
    #     return jsonify({"error": str(e)}), 500

    try:
        if 'file' not in request.files:
            return jsonify({'message': 'No file in request'}), 400
        
        file = request.files['file']
        fileName = file.filename
        blobName = os.path.basename(fileName)
        credentials = ClientSecretCredential(os.environ.get("TENANTID"), os.environ.get("CLIENTID"), os.environ.get("CLIENTSECRET"))
        blobService = BlobServiceClient(
                "https://{}.blob.core.windows.net".format(os.environ.get("BLOB_ACCOUNT_NAME")), credential=credentials)
        containerClient = blobService.get_container_client(os.environ.get("BlobPdfContainer"))
        blobClient = containerClient.get_blob_client(blobName)

        blobClient.upload_blob(file.read(), overwrite=True)
        blobClient.set_blob_metadata(metadata={"embedded": "false", 
                                        "indexName": "",
                                        "namespace": "", 
                                        "qa": "No Qa Generated",
                                        "summary": "No Summary Created", 
                                        "indexType": "cogsearchvs"})
        #jsonDict = json.dumps(blobJson)
        return jsonify({'message': 'File uploaded successfully'}), 200
    except Exception as e:
        logging.exception("Exception in /uploadBinaryFile")
        return jsonify({"error": str(e)}), 500
    
if __name__ == "__main__":
    app.run(port=5004)