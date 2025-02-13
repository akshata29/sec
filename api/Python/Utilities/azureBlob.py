from azure.storage.blob import BlobServiceClient, ContentSettings, generate_blob_sas
from datetime import datetime, timedelta
import logging
import tempfile, os
from azure.identity import ClientSecretCredential, DefaultAzureCredential

def upsertMetadata(tenantId, clientId, clientSecret, blobAccountName, container, fileName, metadata):
    try:
        credentials = ClientSecretCredential(tenantId, clientId, clientSecret)
        blobService = BlobServiceClient(
                "https://{}.blob.core.windows.net".format(blobAccountName), credential=credentials)
        containerClient = blobService.get_container_client(container)
        blobClient = containerClient.get_blob_client(fileName)
        blobMetadata = blobClient.get_blob_properties().metadata
        blobMetadata.update(metadata)
        logging.info("Upserting metadata for file: " + fileName + " Metadata: " + str(blobMetadata))
        blobClient.set_blob_metadata(metadata=blobMetadata)
    except Exception as e:
        logging.info("Error upserting metadata for file: " + fileName + " Error: " + str(e))
        pass

def getBlob(tenantId, clientId, clientSecret, blobAccountName, container, fileName):
    credentials = ClientSecretCredential(tenantId, clientId, clientSecret)
    blobService = BlobServiceClient(
            "https://{}.blob.core.windows.net".format(blobAccountName), credential=credentials)
    blobClient = blobService.get_blob_client(container, blob=fileName)
    readBytes = blobClient.download_blob().readall()

    return readBytes

def getAllBlobs(tenantId, clientId, clientSecret, blobAccountName, container):
    credentials = ClientSecretCredential(tenantId, clientId, clientSecret)
    blobServiceClient = BlobServiceClient(
            "https://{}.blob.core.windows.net".format(blobAccountName), credential=credentials)
    # Get files in the container
    containerClient = blobServiceClient.get_container_client(container)
    blobList = containerClient.list_blobs(include='metadata')

    return blobList

def getFullPath(tenantId, clientId, clientSecret, blobAccountName, container, fileName):
    credentials = ClientSecretCredential(tenantId, clientId, clientSecret)
    blobServiceClient = BlobServiceClient(
            "https://{}.blob.core.windows.net".format(blobAccountName), credential=credentials)
    blobClient = blobServiceClient.get_blob_client(container=container, blob=fileName)
    return blobClient.url

def copyS3Blob(tenantId, clientId, clientSecret, blobAccountName, downloadPath, blobName, openAiBlobContainer):
    with open(downloadPath, "wb") as file:
        readBytes = file.read()
    credentials = ClientSecretCredential(tenantId, clientId, clientSecret)
    blobService = BlobServiceClient(
            "https://{}.blob.core.windows.net".format(blobAccountName), credential=credentials)
    blobClient = blobService.get_blob_client(container=openAiBlobContainer, blob=blobName)
    blobClient.upload_blob(readBytes,overwrite=True)

def copyBlob(tenantId, clientId, clientSecret, blobAccountName, blobContainer, blobName, openAiBlobContainer):
    readBytes  = getBlob(tenantId, clientId, clientSecret, blobAccountName, blobContainer, blobName)
    credentials = ClientSecretCredential(tenantId, clientId, clientSecret)
    blobService = BlobServiceClient(
            "https://{}.blob.core.windows.net".format(blobAccountName), credential=credentials)
    blobClient = blobService.get_blob_client(openAiBlobContainer, blob=blobName)
    blobClient.upload_blob(readBytes,overwrite=True)

def uploadBlob(connectionString, container, fileName, fileContent, contentType):
    blobServiceClient = BlobServiceClient.from_connection_string(connectionString)
    blobClient = blobServiceClient.get_blob_client(container=container, blob=fileName)
    blobClient.upload_blob(fileContent,overwrite=True, content_settings=ContentSettings(content_type=contentType))
