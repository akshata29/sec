import os
import logging


try:
    OpenAiKey = os.environ['OpenAiKey']
    OpenAiVersion = os.environ['OpenAiVersion']
    OpenAiChat = os.environ['OpenAiChat']
    OpenAiEndPoint = os.environ['OpenAiEndPoint']
    OpenAiDocStorName = os.environ['OpenAiDocStorName']
    OpenAiDocStorKey = os.environ['OpenAiDocStorKey']
    OpenAiDocConnStr = f"DefaultEndpointsProtocol=https;AccountName={OpenAiDocStorName};AccountKey={OpenAiDocStorKey};EndpointSuffix=core.windows.net"
    OpenAiDocContainer = os.environ['OpenAiDocContainer']

    if "TenantId" in os.environ: 
        TenantId = os.environ['TenantId']
    else:
        TenantId = ""

    if "ClientId" in os.environ: 
        ClientId = os.environ['ClientId']
    else:
        ClientId = ""

    if "MI_CLIENTID" in os.environ: 
        ManagedIdentityClientId = os.environ['MI_CLIENTID']
    else:
        ManagedIdentityClientId = ""

    if "ClientSecret" in os.environ: 
        ClientSecret = os.environ['ClientSecret']
    else:
        ClientSecret = ""

    if "BLOB_ACCOUNT_NAME" in os.environ: 
        BlobAccountName = os.environ['BLOB_ACCOUNT_NAME']
    else:
        BlobAccountName = ""


    if "KbIndexName" in os.environ: 
        KbIndexName = os.environ['KbIndexName']
    else:
        KbIndexName = "aoaikb"

    if "OpenAiEvaluatorContainer" in os.environ: 
        OpenAiEvaluatorContainer = os.environ['OpenAiEvaluatorContainer']
    else:
        OpenAiEvaluatorContainer = "evaluator"

    if "OpenAiSummaryContainer" in os.environ: 
        OpenAiSummaryContainer = os.environ['OpenAiSummaryContainer']
    else:
        OpenAiSummaryContainer = "summary"

    if "FmpKey" in os.environ: 
        FmpKey = os.environ('FmpKey')
    else:
        FmpKey = ""
    
    if "SecExtractionUrl" in os.environ: 
        SecExtractionUrl = os.environ('SecExtractionUrl')
    else:
        SecExtractionUrl = ""

    if "SecDocPersistUrl" in os.environ: 
        SecDocPersistUrl = os.environ('SecDocPersistUrl')
    else:
        SecDocPersistUrl = ""
    
    if "SecDocContainer" in os.environ: 
        SecDocContainer = os.environ['SecDocContainer']
    else:
        SecDocContainer = ""

    if "PineconeEnv" in os.environ: 
        PineconeEnv = os.environ['PineconeEnv']
    else:
        PineconeEnv = ""

    if "PineconeKey" in os.environ: 
        PineconeKey = os.environ['PineconeKey']
    else:
        PineconeKey = ""

    if "VsIndexName" in os.environ: 
        VsIndexName = os.environ['VsIndexName']
    else:
        VsIndexName = ""
        
    if "RedisAddress" in os.environ: 
        RedisAddress = os.environ['RedisAddress']
    else:
        RedisAddress = ""

    if "RedisPassword" in os.environ: 
        RedisPassword = os.environ['RedisPassword']
    else:
        RedisPassword = ""

    if "RedisPort" in os.environ: 
        RedisPort = os.environ['RedisPort']
    else:
        RedisPort = ""

    if "SearchKey" in os.environ: 
        SearchKey = os.environ['SearchKey']
    else:
        SearchKey = ""

    if "SearchService" in os.environ: 
        SearchService = os.environ['SearchService']
    else:
        SearchService = ""

    if "BingUrl" in os.environ: 
        BingUrl = os.environ['BingUrl']
    else:
        BingUrl = ""

    if "BingKey" in os.environ: 
        BingKey = os.environ['BingKey']
    else:
        BingKey = ""

    if "CosmosEndpoint" in os.environ: 
        CosmosEndpoint = os.environ['CosmosEndpoint']
    else:
        CosmosEndpoint = ""

    if "CosmosKey" in os.environ: 
        CosmosKey = os.environ['CosmosKey']
    else:
        CosmosKey = ""
    
    if "CosmosDatabase" in os.environ: 
        CosmosDatabase = os.environ['CosmosDatabase']
    else:
        CosmosDatabase = ""

    if "CosmosContainer" in os.environ: 
        CosmosContainer = os.environ['CosmosContainer']
    else:
        CosmosContainer = ""

    if "OpenAiEmbedding" in os.environ: 
        OpenAiEmbedding = os.environ['OpenAiEmbedding']
    else:
        OpenAiEmbedding = "embedding"

    if "OpenAiApiKey" in os.environ: 
        OpenAiApiKey = os.environ['OpenAiApiKey']
    else:
        OpenAiApiKey = ""

except Exception as e:
    logging.info("Error reading environment variables: %s",e)
