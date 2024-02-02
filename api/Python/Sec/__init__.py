from Utilities.envVars import *
from langchain.chains.qa_with_sources import load_qa_with_sources_chain
from langchain.docstore.document import Document
from langchain.prompts import PromptTemplate
from langchain.utilities import BingSearchAPIWrapper
from langchain.chains.summarize import load_summarize_chain
from langchain.docstore.document import Document
from langchain.text_splitter import RecursiveCharacterTextSplitter
import pandas as pd
from langchain.prompts import PromptTemplate
from datetime import datetime
from pytz import timezone
from dateutil.relativedelta import relativedelta
from Utilities.secCopilot import mergeDocs, createSecCachedDataIndex, findSecCachedData, deletePibData
from Utilities.secCopilot import deleteSecFilings, createSecSummaries
from Utilities.secCopilot import findSecVectorFilingsContent, createSecFilingIndex, findSecFiling
from Utilities.secCopilot import findSecVectorFilings, indexSecFilingsSections, createSecFilingsVectorIndex, findTopicSummaryInIndex
from Utilities.secCopilot import deleteSecSummaries, createSecFilingProcessedIndex, createSecFilingsVectorLlamaIndex, indexSecFilingsSectionsLlama
from Utilities.fmp import *
from langchain.chat_models import AzureChatOpenAI, ChatOpenAI
import logging, json, os
import uuid
import azure.functions as func
import time
from langchain.chains import LLMChain
from Utilities.secExtraction import EdgarIngestion
from Utilities.secDocPersist import PersistSecDocs
from Utilities.azureBlob import getBlob
from langchain.embeddings.azure_openai import AzureOpenAIEmbeddings
from langchain.embeddings.openai import OpenAIEmbeddings
from llama_index.llms import AzureOpenAI
from llama_index.embeddings import AzureOpenAIEmbedding
from llama_index.response_synthesizers import TreeSummarize
from llama_index.text_splitter import SentenceSplitter
from llama_index import VectorStoreIndex, ServiceContext, StorageContext, Document, SimpleDirectoryReader
from llama_index.vector_stores.types import ExactMatchFilter, MetadataFilters
from llama_index.query_engine import SubQuestionQueryEngine
from llama_index.tools import QueryEngineTool, ToolMetadata
import asyncio
import tempfile

OpenAiEndPoint = os.environ['OpenAiEndPoint']
OpenAiChat = os.environ['OpenAiChat']
OpenAiChat16k = os.environ['OpenAiChat16k']
OpenAiKey = os.environ['OpenAiKey']
OpenAiApiKey = os.environ['OpenAiApiKey']
OpenAiEmbedding = os.environ['OpenAiEmbedding']
OpenAiDocStorName = os.environ['OpenAiDocStorName']
OpenAiDocStorKey = os.environ['OpenAiDocStorKey']
BlobPdfContainer = os.environ['BlobPdfContainer']
FmpKey = os.environ['FmpKey']
BingUrl = os.environ['BingUrl']
BingKey = os.environ['BingKey']
SearchService = os.environ['SearchService']
SearchKey = os.environ['SearchKey']
PibEarningsCallIndex = os.environ['PibEarningsCallIndex']
PibPressReleaseIndex = os.environ['PibPressReleaseIndex']
PibEarningsCallVectorIndex = os.environ['PibEarningsCallVectorIndex']
SecSummariesIndex = os.environ['SecSummariesIndex']
SecDataIndex = os.environ['SecDataIndex']
SecDataVectorIndex = os.environ['SecDataVectorIndex']
SecProcessedIndex = os.environ['SecProcessedIndex']
SecCachedDataIndex = os.environ['SecCachedDataIndex']
SecPdfVectorIndex = os.environ['SecPdfVectorIndex']
OpenAiDocConnStr = f"DefaultEndpointsProtocol=https;AccountName={OpenAiDocStorName};AccountKey={OpenAiDocStorKey};EndpointSuffix=core.windows.net"

# Helper function to find the answer to a question
def summarizeTopic(llm, query, embeddingModelType, secFilingsVectorIndexName, symbol, filingYear, filingType):

    promptTemplate = """You are an AI assistant tasked with summarizing documents from 
        earning call transcripts, annual reports, SEC filings and financial statements like income statement, cashflow and 
        balance sheets. Additionally you may also be asked to answer questions about financial ratios and other financial metrics.
        Your summary should accurately capture the key information in the document while avoiding the omission of any domain-specific words. 
        Please generate a concise and comprehensive summary that includes details. 
        Ensure that the summary is easy to understand and provides an accurate representation. 
        Begin the summary with a brief introduction, followed by the main points.
        Generate the summary with minimum of 7 paragraphs and maximum of 10 paragraphs.
        Please remember to use clear language and maintain the integrity of the original information without missing any important details:
        {text}

        """    
    r = findSecVectorFilingsContent(OpenAiEndPoint, OpenAiKey, OpenAiVersion, OpenAiApiKey, SearchService, SearchKey, 
                         embeddingModelType, OpenAiEmbedding, query, secFilingsVectorIndexName, 3, symbol, filingYear, filingType, returnFields=['id', 'content'])
    if r == None:
        resultsDoc = [Document(page_content="No results found")]
    else :
        resultsDoc = [
                Document(page_content=doc['content'], metadata={"id": doc['id'], "source": ''})
                for doc in r
                ]
    logging.info(f"Found {len(resultsDoc)} Cog Search results")
    
    if len(resultsDoc) == 0:
        return "I don't know"
    else:
        customPrompt = PromptTemplate(template=promptTemplate, input_variables=["text"])
        chainType = "map_reduce"
        summaryChain = load_summarize_chain(llm, chain_type=chainType, return_intermediate_steps=True, 
                                            map_prompt=customPrompt, combine_prompt=customPrompt)
        summary = summaryChain({"input_documents": resultsDoc}, return_only_outputs=True)
        outputAnswer = summary['output_text']
        return outputAnswer
def summarizeTopicLlama(serviceContext, query, engine):

    summarizeTopicPrompt = """You are an AI assistant tasked with summarizing documents from 
        earning call transcripts, annual reports, SEC filings and financial statements like income statement, cashflow and 
        balance sheets. Additionally you may also be asked to answer questions about financial ratios and other financial metrics.
        Your summary should accurately capture the key information in the document while avoiding the omission of any domain-specific words. 
        Please generate a concise and comprehensive summary that includes details. 
        Ensure that the summary is easy to understand and provides an accurate representation. 
        Begin the summary with a brief introduction, followed by the main points.
        Generate the summary with minimum of 7 paragraphs and maximum of 10 paragraphs.
        Please remember to use clear language and maintain the integrity of the original information without missing any important details:

        """    
    nodes = engine.retrieve(query)
    textChunks = []
    for node in nodes:
        textChunks.append(node.text)
    
    if len(textChunks) == 0:
        return "I don't know"
    else:
        summarizer = TreeSummarize(use_async=True, service_context=serviceContext)
        summary = summarizer.get_response(summarizeTopicPrompt, textChunks)
        return summary
def processSecTopicSummary(llm, symbol, cik, step, filingYear, filingType, secSummaryIndex, embeddingModelType, selectedTopics,
                        secFilingsVectorIndexName, docType, secFilingList):
    topicSummary = []
    
    for topic in selectedTopics:
        r = findTopicSummaryInIndex(SearchService, SearchKey, secSummaryIndex, symbol, cik, filingYear, filingType, step, docType, topic)
        if r.get_count() == 0:
            logging.info(f"Summarize on Topic: {topic}")
            if topic == "item1" or topic == "item1A" or topic == "item1B" or topic == "item2" or topic == "item3" or \
            topic == "item4" or topic == "item5" or topic == "item6" or topic == "item7" or topic == "item7A" or \
            topic == "item8" or topic == "item9" or topic == "item9A" or topic == "item9B" or topic == "item10" or \
            topic == "item11" or topic == "item12" or topic == "item13" or topic == "item14" or topic == "item15" :
                rawItemDocs = [Document(page_content=secFilingList[0][topic])]
                splitter = RecursiveCharacterTextSplitter(chunk_size=8000, chunk_overlap=1000)
                itemDocs = splitter.split_documents(rawItemDocs)
                logging.info("Number of documents chunks generated : " + str(len(itemDocs)))
                itemSummary = generateSummaries(llm, itemDocs)
                answer = itemSummary['output_text']
                if "I don't know" not in answer:
                    topicSummary.append({
                        'id' : str(uuid.uuid4()),
                        'symbol': symbol,
                        'cik': cik,
                        'step': step,
                        'filingYear': filingYear,
                        'filingType': filingType,
                        'docType': docType,
                        'topic': topic,
                        'summary': answer
                })
            else:
                answer = summarizeTopic(llm, topic, embeddingModelType, secFilingsVectorIndexName, symbol, filingYear, filingType)
                if "I don't know" not in answer:
                    topicSummary.append({
                        'id' : str(uuid.uuid4()),
                        'symbol': symbol,
                        'cik': cik,
                        'step': step,
                        'filingYear': filingYear,
                        'filingType': filingType,
                        'docType': docType,
                        'topic': topic,
                        'summary': answer
                })
        else:
            for s in r:
                topicSummary.append(
                    {
                        'id' : s['id'],
                        'symbol': s['symbol'],
                        'cik': s['cik'],
                        'step': s['step'],
                        'filingYear': s['filingYear'],
                        'filingType': s['filingType'],
                        'docType': s['docType'],
                        'topic': s['topic'],
                        'summary': s['summary']
                    })
    mergeDocs(SearchService, SearchKey, secSummaryIndex, topicSummary)
    return topicSummary
def processSecTopicSummaryLlama(engine, serviceContext, symbol, cik, step, filingYear, filingType, secSummaryIndex, selectedTopics,
                        docType, secFilingList):
    topicSummary = []
    for topic in selectedTopics:
        r = findTopicSummaryInIndex(SearchService, SearchKey, secSummaryIndex, symbol, cik, filingYear, filingType, step, docType, topic)
        if r.get_count() == 0:
            logging.info(f"Summarize on Topic: {topic}")
            if topic == "item1" or topic == "item1A" or topic == "item1B" or topic == "item2" or topic == "item3" or \
            topic == "item4" or topic == "item5" or topic == "item6" or topic == "item7" or topic == "item7A" or \
            topic == "item8" or topic == "item9" or topic == "item9A" or topic == "item9B" or topic == "item10" or \
            topic == "item11" or topic == "item12" or topic == "item13" or topic == "item14" or topic == "item15" :
                try:
                    answer = generateSummariesLlama(serviceContext, secFilingList[0][topic])
                    if "I don't know" not in answer:
                        topicSummary.append({
                            'id' : str(uuid.uuid4()),
                            'symbol': symbol,
                            'cik': cik,
                            'step': step,
                            'filingYear': filingYear,
                            'filingType': filingType,
                            'docType': docType,
                            'topic': topic,
                            'summary': answer
                    })
                except Exception as e:
                    logging.info(f"Error in generating summary for {topic} - {e}")
            else:
                try:
                    answer = summarizeTopicLlama(serviceContext, topic, engine)
                    if "I don't know" not in answer:
                        topicSummary.append({
                            'id' : str(uuid.uuid4()),
                            'symbol': symbol,
                            'cik': cik,
                            'step': step,
                            'filingYear': filingYear,
                            'filingType': filingType,
                            'docType': docType,
                            'topic': topic,
                            'summary': answer
                    })
                except Exception as e:
                    logging.info(f"Error in generating summary for {topic} - {e}")
        else:
            for s in r:
                topicSummary.append(
                    {
                        'id' : s['id'],
                        'symbol': s['symbol'],
                        'cik': s['cik'],
                        'step': s['step'],
                        'filingYear': s['filingYear'],
                        'filingType': s['filingType'],
                        'docType': s['docType'],
                        'topic': s['topic'],
                        'summary': s['summary']
                    })
    mergeDocs(SearchService, SearchKey, secSummaryIndex, topicSummary)
    return topicSummary
def generateSummaries(llm, docs):
    # With the data indexed, let's summarize the information
    promptTemplate = """You are an AI assistant tasked with summarizing sections from the financial document like 10-K and 10-Q report. 
            Your summary should accurately capture the key information in the document while avoiding the omission of any domain-specific words. 
            Please remember to use clear language and maintain the integrity of the original information without missing any important details.
            Please generate a concise and comprehensive 3 paragraphs summary of the following document. 
            Ensure that the summary is generated for each of the following sections:
            {text}
            """
    customPrompt = PromptTemplate(template=promptTemplate, input_variables=["text"])
    chainType = "map_reduce"
    #summaryChain = load_summarize_chain(llm, chain_type=chainType, return_intermediate_steps=False, 
    #                                    map_prompt=customPrompt, combine_prompt=customPrompt)
    summaryChain = load_summarize_chain(llm, chain_type=chainType)
    summary = summaryChain({"input_documents": docs}, return_only_outputs=True)
    return summary
def generateSummariesLlama(serviceContext, docs):
    # With the data indexed, let's summarize the information
    sectionTopicPrompt = """You are an AI assistant tasked with summarizing sections from the financial document like 10-K and 10-Q report. 
            Your summary should accurately capture the key information in the document while avoiding the omission of any domain-specific words. 
            Please remember to use clear language and maintain the integrity of the original information without missing any important details.
            Please generate a concise and comprehensive 3 paragraphs summary of the following document. 
            Ensure that the summary is generated for each of the following sections:
            """
    
    textChunks = []
    textChunks.append(docs)
    summarizer = TreeSummarize(use_async=True, service_context=serviceContext)
    summary = summarizer.get_response(sectionTopicPrompt, textChunks)
    return summary
async def subQueryEngineExecute(query, subQueryEngine):
    response = await subQueryEngine.aquery(query)
    return response.response
def processStep4(selectedCompanies, selectedYears, selectedReportType, llamaLlm, llamaEmbeddings, question):
    # Filing Type hardcoded for now, eventually need to read "Report Type"
    filingType = "10-K"

    secFilingsVectorIndexName = SecPdfVectorIndex #SecDataVectorIndex
    vectorStore = createSecFilingsVectorLlamaIndex(SearchService, SearchKey, secFilingsVectorIndexName)
    storageContext = StorageContext.from_defaults(vector_store=vectorStore)
    sentenceSplitter = SentenceSplitter(chunk_size=4000, chunk_overlap=1000)
    serviceContext = ServiceContext.from_defaults(
            llm=llamaLlm,
            embed_model=llamaEmbeddings,
            node_parser=None,
            text_splitter=sentenceSplitter,
    )
    queryEngineTools = []
    for company in selectedCompanies:
        for filingYear in selectedYears:
            try:
                # Create the filter to be used for the Query Engine
                llamaIndex = VectorStoreIndex.from_documents([], storage_context=storageContext, service_context=serviceContext)
                vectorFilters = MetadataFilters(
                    filters=[ExactMatchFilter(key="symbol", value=company), 
                            ExactMatchFilter(key="filingYear", value=filingYear), 
                            ExactMatchFilter(key="filingType", value=filingType)]
                )
                engine = llamaIndex.as_query_engine(filters=vectorFilters, similarity_top_k=3)
                queryEngineTools.append(
                    QueryEngineTool(query_engine=engine, 
                                    metadata=ToolMetadata(
                                        name=f'{filingYear}{company}_{filingType}', 
                                        description=f'Provides information from financial document like 10-K and 10-Q on {company} for {filingYear}') 
                    )
                )
            except Exception as e:
                logging.info("Error in processing Step 3 : " + str(e))
                return "Error in processing Step 3 : " + str(e)

    subQueryEngine = SubQuestionQueryEngine.from_defaults(
        query_engine_tools=queryEngineTools,
        service_context=serviceContext,
        )
    response = asyncio.run(subQueryEngineExecute(question, subQueryEngine))

    return response
def processStep3(selectedCompanies, selectedYears, selectedReportType, llamaLlm, llamaEmbeddings, question):
    s3Data = []
    # Filing Type hardcoded for now, eventually need to read "Report Type"
    filingType = "10-K"

    secFilingsVectorIndexName = SecDataVectorIndex
    vectorStore = createSecFilingsVectorLlamaIndex(SearchService, SearchKey, secFilingsVectorIndexName)
    storageContext = StorageContext.from_defaults(vector_store=vectorStore)
    sentenceSplitter = SentenceSplitter(chunk_size=4000, chunk_overlap=1000)
    serviceContext = ServiceContext.from_defaults(
            llm=llamaLlm,
            embed_model=llamaEmbeddings,
            node_parser=None,
            text_splitter=sentenceSplitter,
    )
    for company in selectedCompanies:
        for filingYear in selectedYears:
            try:
                logging.info("Find out the CIK for the Symbol")
                cik = str(int(searchCik(apikey=FmpKey, ticker=company)[0]["companyCik"]))
                # Create the filter to be used for the Query Engine
                vectorFilters = MetadataFilters(
                    filters=[ExactMatchFilter(key="symbol", value=company), 
                            ExactMatchFilter(key="filingYear", value=filingYear), 
                            ExactMatchFilter(key="filingType", value=filingType)])
                llamaIndex = VectorStoreIndex.from_documents([], storage_context=storageContext, service_context=serviceContext)
                llamaEngine = llamaIndex.as_query_engine(filters=vectorFilters, similarity_top_k=3)
                response = llamaEngine.query(question)
                answer = response.response
                s3Data.append(
                        {
                            'company' : company,
                            'content': '',
                            'cik': cik,
                            'contentSummary': answer,
                            'filingYear': filingYear,
                            'filingType': filingType
                        })
            except Exception as e:
                logging.info("Error in processing Step 3 : " + str(e))
                s3Data.append(
                        {
                            'company' : company,
                            'content': '',
                            'cik': cik,
                            'contentSummary': str(e),
                            'filingYear': filingYear,
                            'filingType': filingType
                        })

    return s3Data
def processStep2(selectedSector, selectedIndustry, selectedCompanies, selectedYears,
                                  selectedReportType, llm, llamaLlm, llamaEmbeddings, secCachedDataIndex, selectedTopics, reProcess):
    s2Data = []
    toProcessYears = []
    toProcessSymbol = []
    secFilingList = []
    central = timezone('US/Central')
    today = datetime.now(central)

    # Filing Type hardcoded for now, eventually need to read "Report Type"    
    filingType = "10-K"
    secFilingIndexName = SecDataIndex

    sentenceSplitter = SentenceSplitter(chunk_size=4000, chunk_overlap=1000)
    serviceContext = ServiceContext.from_defaults(
            llm=llamaLlm,
            embed_model=llamaEmbeddings,
            node_parser=None,
            text_splitter=sentenceSplitter,
    )

    createSecCachedDataIndex(SearchService, SearchKey, secCachedDataIndex)
    for company in selectedCompanies:
        for filingYear in selectedYears:
            r = findSecCachedData(SearchService, SearchKey, secCachedDataIndex, company, "2", filingYear, filingType)
            if r.get_count() == 0:
                toProcessYears.append(filingYear)
                toProcessSymbol.append(company)
            else:
                logging.info(f"Found existing SEC Filing data for {company} and {filingYear}")
                for record in r:
                    s2Data.append(
                        {
                            'id' : record['id'],
                            'symbol': record['symbol'],
                            'step': record['step'],
                            'filingYear': record['filingYear'],
                            'filingType': record['filingType'],
                            'insertedDate': record['insertedDate'],
                            'secData' : record['secData']
                        })
    
    toProcessSymbolSet = set(toProcessSymbol)
    uniqSymbol = (list(toProcessSymbolSet))
    toProcessYearsSet = set(toProcessYears)
    uniqYears = (list(toProcessYearsSet))
    logging.info("To Process Symbol : " + str(uniqSymbol))
    logging.info("To Process Years : " + str(uniqYears))

    # Process each Companies
    for symbol in uniqSymbol:
        logging.info("Find out the CIK for the Symbol")
        cik = str(int(searchCik(apikey=FmpKey, ticker=symbol)[0]["companyCik"]))
        # Process each years
        for filingYear in uniqYears:
            # Create the filter to be used for the Query Engine
            vectorFilters = MetadataFilters(
                filters=[ExactMatchFilter(key="symbol", value=symbol), 
                        ExactMatchFilter(key="filingYear", value=filingYear), 
                        ExactMatchFilter(key="filingType", value=filingType)])

            # For each year, retrieve the filing data
            r = findSecFiling(SearchService, SearchKey, secFilingIndexName, cik, filingType, filingYear, returnFields=['id', 'cik', 'company', 'filingType', 'filingDate',
                                                                                                            'periodOfReport', 'sic', 'stateOfInc', 'fiscalYearEnd',
                                                                                                            'filingHtmlIndex', 'htmFilingLink', 'completeTextFilingLink',
                                                                                                            'item1', 'item1A', 'item1B', 'item2', 'item3', 'item4', 'item5',
                                                                                                            'item6', 'item7', 'item7A', 'item8', 'item9', 'item9A', 'item9B',
                                                                                                            'item10', 'item11', 'item12', 'item13', 'item14', 'item15',
                                                                                                            'sourcefile'])
            for filing in r:
                lastSecData = filing['item1'] + '\n' + filing['item1A'] + '\n' + filing['item1B'] + '\n' + filing['item2'] + '\n' + filing['item3'] + '\n' + filing['item4'] + '\n' + \
                    filing['item5'] + '\n' + filing['item6'] + '\n' + filing['item7'] + '\n' + filing['item7A'] + '\n' + filing['item8'] + '\n' + \
                    filing['item9'] + '\n' + filing['item9A'] + '\n' + filing['item9B'] + '\n' + filing['item10'] + '\n' + filing['item11'] + '\n' + filing['item12'] + '\n' + \
                    filing['item13'] + '\n' + filing['item14'] + '\n' + filing['item15']
                secFilingList.append({
                    "id": filing['id'],
                    "cik": filing['cik'],
                    "company": filing['company'],
                    "filingType": filing['filingType'],
                    "filingDate": filing['filingDate'],
                    "periodOfReport": filing['periodOfReport'],
                    "sic": filing['sic'],
                    "stateOfInc": filing['stateOfInc'],
                    "fiscalYearEnd": filing['fiscalYearEnd'],
                    "filingHtmlIndex": filing['filingHtmlIndex'],
                    "completeTextFilingLink": filing['completeTextFilingLink'],
                    "item1": filing['item1'],
                    "item1A": filing['item1A'],
                    "item1B": filing['item1B'],
                    "item2": filing['item2'],
                    "item3": filing['item3'],
                    "item4": filing['item4'],
                    "item5": filing['item5'],
                    "item6": filing['item6'],
                    "item7": filing['item7'],
                    "item7A": filing['item7A'],
                    "item8": filing['item8'],
                    "item9": filing['item9'],
                    "item9A": filing['item9A'],
                    "item9B": filing['item9B'],
                    "item10": filing['item10'],
                    "item11": filing['item11'],
                    "item12": filing['item12'],
                    "item13": filing['item13'],
                    "item14": filing['item14'],
                    "item15": filing['item15'],
                    "sourcefile": filing['sourcefile']
                })

                # Check if we have already processed the latest filing, if yes then skip
                secFilingsVectorIndexName = SecDataVectorIndex
                #createSecFilingsVectorIndex(SearchService, SearchKey, secFilingsVectorIndexName)
                vectorStore = createSecFilingsVectorLlamaIndex(SearchService, SearchKey, secFilingsVectorIndexName)
                # Now that we got the vectorStore, let's create the index from the documents
                storageContext = StorageContext.from_defaults(vector_store=vectorStore)
                r = findSecVectorFilings(SearchService, SearchKey, secFilingsVectorIndexName, cik, symbol, filingYear, filingType, returnFields=['id', 'cik', 'symbol', 'filingYear', 'filingType',
                                                                                                                                'content'])
                if r.get_count() == 0:
                    logging.info("Processing SEC Filings for CIK : " + str(cik) + " and Symbol : " + str(symbol) + " and Year : " + str(filingYear) + " and Filing Type : " + str(filingType))
                    # splitter = RecursiveCharacterTextSplitter(chunk_size=8000, chunk_overlap=1000)
                    # rawDocs = splitter.create_documents([lastSecData])
                    # docs = splitter.split_documents(rawDocs)
                    # logging.info("Number of documents chunks generated from Last SEC Filings : " + str(len(docs)))

                    # # Store the index of the sec filing in vector Index
                    # indexSecFilingsSections(OpenAiEndPoint, OpenAiKey, OpenAiVersion, OpenAiApiKey, SearchService, SearchKey,
                    #                     "azureopenai", OpenAiEmbedding, secFilingsVectorIndexName, docs, cik,
                    #                     symbol, filingYear, filingType)
                    indexSecFilingsSectionsLlama(vectorStore, serviceContext, lastSecData, cik, symbol, filingYear, filingType)

                llamaIndex = VectorStoreIndex.from_documents([], storage_context=storageContext, service_context=serviceContext)
                llamaEngine = llamaIndex.as_query_engine(filters=vectorFilters, similarity_top_k=3)
                logging.info('Process summaries for ' + symbol)

                secFilingsQa = []
                secSummaryIndex = SecSummariesIndex
                createSecSummaries(SearchService, SearchKey, secSummaryIndex)
                # if reProcess == "Yes":
                #     deleteSecSummaries(SearchService, SearchKey, secSummaryIndex, symbol, cik, '2', filingYear, filingType, "secfilings")
                #     logging.info(f"Deleted existing topic summaries  data for {symbol}")
                #     logging.info("Reprocessing the topic summaries calls data")
                # else:
                #     logging.info(f"Process missing topics summary for {symbol}")

                # summaryTopicData = processSecTopicSummary(llm, symbol, cik, '2', filingYear, filingType, secSummaryIndex, "azureopenai", 
                #     selectedTopics, secFilingsVectorIndexName, "secfilings", secFilingList)
                summaryTopicData = processSecTopicSummaryLlama(llamaEngine, serviceContext, symbol, cik, '2', filingYear, filingType, secSummaryIndex, 
                    selectedTopics, "secfilings", secFilingList)
                for summaryTopic in summaryTopicData:
                    secFilingsQa.append({"question": summaryTopic['topic'], "answer": summaryTopic['summary']})
                
                s2Data.append(
                        {
                            'id' : str(uuid.uuid4()),
                            'symbol': symbol,
                            'step': '2',
                            'filingYear': filingYear,
                            'filingType': filingType,
                            'insertedDate': today.strftime("%Y-%m-%d"),
                            'secData' : str(secFilingsQa)
                        })

    mergeDocs(SearchService, SearchKey, secCachedDataIndex, s2Data)
    return s2Data
def processStep1A(llamaLlm, llamaEmbeddings, selectedCompanies, selectedYears,
                                  selectedReportType, fileName, reProcess):
        secFilingsVectorIndexName = SecPdfVectorIndex
        r = findSecVectorFilings(SearchService, SearchKey, secFilingsVectorIndexName, '', selectedCompanies[0], selectedYears[0], 
                                 selectedReportType[0], returnFields=['id', 'cik', 'symbol', 'filingYear', 'filingType','content'])
        if r.get_count() == 0:
            try:
                # Download the File from the Blob
                logging.info("Download the File from the Blob")
                readBytes  = getBlob(OpenAiDocConnStr, BlobPdfContainer, fileName)
                downloadPath = os.path.join(tempfile.gettempdir(), fileName)
                os.makedirs(os.path.dirname(tempfile.gettempdir()), exist_ok=True)
                try:
                    with open(downloadPath, "wb") as file:
                        file.write(readBytes)
                except Exception as e:
                    logging.error(e)

                logging.info("File created " + downloadPath)

                sentenceSplitter = SentenceSplitter(chunk_size=4000, chunk_overlap=1000)
                serviceContext = ServiceContext.from_defaults(
                            llm=llamaLlm,
                            embed_model=llamaEmbeddings,
                            node_parser=None,
                            text_splitter=sentenceSplitter,
                )
                # Check if we already have processed the filings, if so skip it
                pdfDocs = SimpleDirectoryReader(input_files=[f'{downloadPath}']).load_data()
                logging.info("Find out the CIK for the Symbol")
                cik = str(int(searchCik(apikey=FmpKey, ticker=selectedCompanies[0])[0]["companyCik"]))
                for doc in pdfDocs:
                    doc.metadata = {"symbol": selectedCompanies[0], "cik": cik, "filingYear": selectedYears[0], "filingType": selectedReportType[0]}

                vectorStore = createSecFilingsVectorLlamaIndex(SearchService, SearchKey, secFilingsVectorIndexName)
                storageContext = StorageContext.from_defaults(vector_store=vectorStore)
                VectorStoreIndex.from_documents(pdfDocs, storage_context=storageContext, service_context=serviceContext)
                return "Success"
            except Exception as e:
                logging.info("Error in processing Step 1A : " + str(e))
                return "Error in processing Step 1A : " + str(e)
        else:
            logging.info("Found existing SEC Filing data for " + str(r.get_count()))
            return "Found existing SEC Filing data for " + str(r.get_count())
def processStep1(selectedSector, selectedIndustry, selectedCompanies, selectedYears,
                                  selectedReportType, reProcess):
    secFilingIndexName = SecDataIndex
    secProcessedIndexName = SecProcessedIndex
    toProcessYears = []
    toProcessCik = []
    processedSecData = []

    # Filing Type hardcoded for now, eventually need to read "Report Type"    
    filingType = "10-K"

    logging.info("Processing SEC Filings for Sector : " + selectedSector + " and Industry : " + selectedIndustry)
    logging.info("Processing SEC Filings for Companies : " + str(selectedCompanies) + " and Years : " + str(selectedYears))
    # Verify what CIK and years we already have it processed.
    for company in selectedCompanies:
        logging.info("Find out the CIK for the Symbol")
        cik = str(int(searchCik(apikey=FmpKey, ticker=company)[0]["companyCik"]))
        # Check if we have already processed the latest filing, if yes then skip
        createSecFilingIndex(SearchService, SearchKey, secFilingIndexName)
        for filingYear in selectedYears:
            processedSecData.append({
                    'id' : cik + "_" + company + "_" + filingYear + "_" + filingType,
                    "sector": selectedSector,
                    "industry": selectedIndustry,
                    "symbol": company,
                    "cik": cik,
                    "year": filingYear,
                    "filingType": filingType
            })
            r = findSecFiling(SearchService, SearchKey, secFilingIndexName, cik, filingType, filingYear, returnFields=['id', 'cik', 'company', 'filingType', 'filingDate',
                                                                                                                        'periodOfReport', 'sic', 'stateOfInc', 'fiscalYearEnd',
                                                                                                                        'filingHtmlIndex', 'htmFilingLink', 'completeTextFilingLink',
                                                                                                                        'item1', 'item1A', 'item1B', 'item2', 'item3', 'item4', 'item5',
                                                                                                                        'item6', 'item7', 'item7A', 'item8', 'item9', 'item9A', 'item9B',
                                                                                                                        'item10', 'item11', 'item12', 'item13', 'item14', 'item15',
                                                                                                                        'sourcefile'])
            if r.get_count() == 0:
                toProcessYears.append(filingYear)
                toProcessCik.append(cik)
            else:
                logging.info("Found existing SEC Filing data :" + str(r.get_count()))

    createSecFilingProcessedIndex(SearchService, SearchKey, secProcessedIndexName)
    mergeDocs(SearchService, SearchKey, secProcessedIndexName, processedSecData)

    toProcessCikSet = set(toProcessCik)
    uniqueCik = (list(toProcessCikSet))
    toProcessYearsSet = set(toProcessYears)
    uniqYears = (list(toProcessYearsSet))
    logging.info("To Process CIK : " + str(uniqueCik))
    logging.info("To Process Years : " + str(uniqYears))

    for cik in uniqueCik:
        for filingYear in uniqYears:
            logging.info("Processing SEC Filings for CIK : " + str(cik) + " and Year : " + str(filingYear))
            secExtractBody = {
                "values": [
                    {
                        "recordId": 0,
                        "data": {
                            "text": {
                                "edgar_crawler": {
                                    "start_year": int(filingYear),
                                    "end_year": int(filingYear),
                                    "quarters": [1, 2, 3, 4],
                                    "filing_types": [
                                        filingType
                                    ],
                                    "cik_tickers": [cik],
                                    "user_agent": "Your name (your email)",
                                    "raw_filings_folder": "RAW_FILINGS",
                                    "indices_folder": "INDICES",
                                    "filings_metadata_file": "FILINGS_METADATA.csv",
                                    "skip_present_indices": False
                                },
                                "extract_items": {
                                    "raw_filings_folder": "RAW_FILINGS",
                                    "extracted_filings_folder": "EXTRACTED_FILINGS",
                                    "filings_metadata_file": "FILINGS_METADATA.csv",
                                    "items_to_extract": ["1","1A","1B","2","3","4","5","6","7","7A","8","9","9A","9B","10","11","12","13","14","15"],
                                    "remove_tables": False,
                                    "skip_extracted_filings": True
                                }
                            }
                        }
                    }
                ]
            }

            # Call Azure Function to perform Web-scraping and store the JSON in our blob
            #secExtract = requests.post(SecExtractionUrl, json = secExtractBody)
            secExtract = EdgarIngestion(secExtractBody)
            time.sleep(1)

    if len(uniqueCik) > 0:
        # All the files are in the Blob Json, now we can process them
        time.sleep(10)
        emptyBody = {
                    "values": [
                        {
                            "recordId": 0,
                            "data": {
                                "text": ""
                            }
                        }
                    ]
        }
        logging.info("Processing the SEC Filing Data")
        # Once the JSON is created, call the function to process the JSON and store the data in our index
        secDocPersist = PersistSecDocs("azureopenai", "cogsearchvs", secFilingIndexName, emptyBody)
        logging.info("Processing the SEC Filing Data Completed")
        return "SEC Filings data processed successfully"
    else:
        return "No new SEC Filings found for the selected companies and years"
def SecSteps(step, reProcess, overrides):
    secCachedDataIndex = SecCachedDataIndex
    try:
        selectedSector = overrides.get("sector") or ''
        selectedIndustry = overrides.get("industry") or ''
        fileName = overrides.get("fileName") or ''
        question = overrides.get("promptTemplate") or ''
        selectedCompanies = overrides.get("companies") or []
        selectedYears = overrides.get("years") or []
        selectedReportType = overrides.get("reportType") or []
        selectedTopics = overrides.get("topics") or []
        central = timezone('US/Central')
        today = datetime.now(central)
        currentYear = today.year
        historicalDate = today - relativedelta(years=3)
        historicalYear = historicalDate.year
        historicalDate = historicalDate.strftime("%Y-%m-%d")
        totalYears = currentYear - historicalYear
        temperature = 0.3
        tokenLength = 1000
    except Exception as e:
        logging.info("Error in SecSteps Open AI : " + str(e))
        return {"data_points": "", "answer": "Exception during finding answers - Error : " + str(e), "thoughts": "", "sources": "", "nextQuestions": "", "error":  str(e)}

    try:
        llm = AzureChatOpenAI(
                    azure_endpoint=OpenAiEndPoint,
                    api_version=OpenAiVersion,
                    azure_deployment=OpenAiChat16k,
                    temperature=temperature,
                    api_key=OpenAiKey,
                    max_tokens=tokenLength)               
        logging.info("LLM Setup done")

        llamaLlm = AzureOpenAI(
                model="gpt-35-turbo-16k",
                deployment_name=OpenAiChat16k,
                api_key=OpenAiKey,
                azure_endpoint=OpenAiEndPoint,
                api_version=OpenAiVersion,
                )
        llamaEmbeddings = AzureOpenAIEmbedding(
                model="text-embedding-ada-002",
                deployment_name=OpenAiEmbedding,
                api_key=OpenAiKey,
                azure_endpoint=OpenAiEndPoint,
                api_version=OpenAiVersion,
                )
        
        if step == "1":
            logging.info("Calling Step 1")
            step1Response = processStep1(selectedSector, selectedIndustry, selectedCompanies, selectedYears,
                                  selectedReportType, reProcess)
            outputFinalAnswer = {"data_points": '', "answer": step1Response, 
                            "thoughts": '',
                                "sources": '', "nextQuestions": '', "error": ""}
            return outputFinalAnswer
        elif step == "1A":
            logging.info("Calling Step 1A")
            step1AResponse = processStep1A(llamaLlm, llamaEmbeddings, selectedCompanies, selectedYears,
                                  selectedReportType, fileName, reProcess)
            outputFinalAnswer = {"data_points": '', "answer": step1AResponse, 
                            "thoughts": '',
                                "sources": '', "nextQuestions": '', "error": ""}
            return outputFinalAnswer
        elif step == "2":
            logging.info("Calling Step 2")
            step2Response = processStep2(selectedSector, selectedIndustry, selectedCompanies, selectedYears,
                                  selectedReportType, llm, llamaLlm, llamaEmbeddings, secCachedDataIndex, selectedTopics, reProcess)
            outputFinalAnswer = {"data_points": '', "answer": step2Response, 
                            "thoughts": '',
                                "sources": '', "nextQuestions": '', "error": ""}
            return outputFinalAnswer
        elif step == "3":
            logging.info("Calling Step 3")
            step3Response = processStep3(selectedCompanies, selectedYears, selectedReportType, llamaLlm, llamaEmbeddings, question)
            outputFinalAnswer = {"data_points": '', "answer": step3Response, 
                            "thoughts": '',
                                "sources": '', "nextQuestions": '', "error": ""}
            return outputFinalAnswer
        elif step == "4":
            logging.info("Calling Step 4")
            step4Response = processStep4(selectedCompanies, selectedYears, selectedReportType, llamaLlm, llamaEmbeddings, question)
            outputFinalAnswer = {"data_points": '', "answer": step4Response, 
                            "thoughts": '',
                                "sources": '', "nextQuestions": '', "error": ""}
            return outputFinalAnswer
        # elif step == "3":
        #     s3Data = processStep3(symbol, cik, step, llm, pibIndexName, today, reProcess)

        #     outputFinalAnswer = {"data_points": '', "answer": s3Data, 
        #                     "thoughts": '',
        #                         "sources": '', "nextQuestions": '', "error": ""}
        #     return outputFinalAnswer
        # elif step == "4":
        #     s4Data = processStep4(symbol, cik, filingType, historicalYear, currentYear, embeddingModelType, llm, 
        #                           pibIndexName, step, today, reProcess, selectedTopics)
        #     outputFinalAnswer = {"data_points": '', "answer": s4Data, 
        #                     "thoughts": '',
        #                         "sources": '', "nextQuestions": '', "error": ""}
        #     return outputFinalAnswer
        # elif step == "5":
        #     s5Data = processStep5(pibIndexName, cik, step, symbol, today, reProcess)
        #     outputFinalAnswer = {"data_points": '', "answer": s5Data, 
        #                     "thoughts": '',
        #                         "sources": '', "nextQuestions": '', "error": ""}
        #     return outputFinalAnswer
    
    except Exception as e:
      logging.info("Error in PibData Open AI : " + str(e))
      return {"data_points": "", "answer": "Exception during finding answers - Error : " + str(e), "thoughts": "", "sources": "", "nextQuestions": "", "error":  str(e)}

    #return answer
def TransformValue(step, reProcess, record):
    logging.info("Calling Transform Value")
    try:
        recordId = record['recordId']
    except AssertionError  as error:
        return None

    # Validate the inputs
    try:
        assert ('data' in record), "'data' field is required."
        data = record['data']
        assert ('text' in data), "'text' field is required in 'data' object."

    except KeyError as error:
        return (
            {
            "recordId": recordId,
            "errors": [ { "message": "KeyError:" + error.args[0] }   ]
            })
    except AssertionError as error:
        return (
            {
            "recordId": recordId,
            "errors": [ { "message": "AssertionError:" + error.args[0] }   ]
            })
    except SystemError as error:
        return (
            {
            "recordId": recordId,
            "errors": [ { "message": "SystemError:" + error.args[0] }   ]
            })

    try:
        # Getting the items from the values/data/text
        value = data['text']
        overrides = data['overrides']
        answer = SecSteps(step, reProcess, overrides)
        return ({
            "recordId": recordId,
            "data": answer
            })

    except:
        return (
            {
            "recordId": recordId,
            "errors": [ { "message": "Could not complete operation for record." }   ]
            })
def ComposeResponse(step, reProcess, jsonData):
    values = json.loads(jsonData)['values']

    logging.info("Calling Compose Response")
    # Prepare the Output before the loop
    results = {}
    results["values"] = []

    for value in values:
        outputRecord = TransformValue(step, reProcess, value)
        if outputRecord != None:
            results["values"].append(outputRecord)
    return json.dumps(results, ensure_ascii=False)
def main(req: func.HttpRequest, context: func.Context) -> func.HttpResponse:
    logging.info(f'{context.function_name} HTTP trigger function processed a request.')
    if hasattr(context, 'retry_context'):
        logging.info(f'Current retry count: {context.retry_context.retry_count}')

        if context.retry_context.retry_count == context.retry_context.max_retry_count:
            logging.info(
                f"Max retries of {context.retry_context.max_retry_count} for "
                f"function {context.function_name} has been reached")

    try:
        step = req.params.get('step')
        reProcess= req.params.get('reProcess')
        logging.info("Input parameters : " + step + " " + reProcess)
        body = json.dumps(req.get_json())
    except ValueError:
        return func.HttpResponse(
             "Invalid body",
             status_code=400
        )

    if body:
        result = ComposeResponse(step, reProcess, body)
        return func.HttpResponse(result, mimetype="application/json")
    else:
        return func.HttpResponse(
             "Invalid body",
             status_code=400
        )