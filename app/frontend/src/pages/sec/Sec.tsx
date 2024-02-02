import { useRef, useState, useEffect, useMemo } from "react";
import { Spinner, TextField, Stack, DefaultButton} from "@fluentui/react";
import { ShieldLockRegular } from "@fluentui/react-icons";
import { SparkleFilled } from "@fluentui/react-icons";
import github from "../../assets/github.svg"
import styles from "./Sec.module.css";
import { BarcodeScanner24Filled } from "@fluentui/react-icons";
import { Dropdown, IDropdownStyles, IDropdownOption } from '@fluentui/react/lib/Dropdown';
import { AskResponse, AskRequest, getSec, getPib, getUserInfo, Approaches, getNews, getSocialSentiment, getIncomeStatement, getCashFlow } from "../../api";
import { pibChatGptApi, ChatRequest, ChatTurn, getAllIndexSessions, getIndexSession, getIndexSessionDetail, deleteIndexSession, renameIndexSession } from "../../api";
import { getSecFilingProcessedData, getSecFilingVectoredData, verifyPassword, uploadBinaryFile } from "../../api";
import { Label } from '@fluentui/react/lib/Label';
import { Pivot, PivotItem } from '@fluentui/react';
import { IStackTokens, IStackItemStyles } from '@fluentui/react/lib/Stack';
import { DefaultPalette } from '@fluentui/react/lib/Styling';
import { Stocks } from "../../components/Symbols/Stocks";
import { PrimaryButton } from "@fluentui/react";
import { ClearChatButton } from "../../components/ClearChatButton";
import { ChatSession } from "../../api/models";
import { SessionButton } from "../../components/SessionButton";
import { RenameButton } from "../../components/RenameButton";
import { AnalysisPanel, AnalysisPanelTabs } from "../../components/AnalysisPanel";
import { QuestionInput } from "../../components/QuestionInput";
import { UserChatMessage } from "../../components/UserChatMessage";
import { Answer, AnswerError, AnswerLoading } from "../../components/Answer";
import { MarqueeSelection } from '@fluentui/react/lib/MarqueeSelection';
import { DetailsList, DetailsListLayoutMode, SelectionMode, Selection, IColumn} from '@fluentui/react/lib/DetailsList';
import { Link } from '@fluentui/react/lib/Link';
import { useDropzone } from 'react-dropzone';
import { Card, CardFooter } from "@fluentui/react-components";
import { ExampleList, ExampleModel } from "../../components/Example";

type SearchItem = {
    company:  { label: string; };
    cik:  { label: string; };
    contentSummary:  { label: string; };
    filingYear:  { label: string; };
    filingType:  { label: string; };
    content:  { label: string; };
};

const Sec = () => {

    const dropdownStyles: Partial<IDropdownStyles> = { dropdown: { width: 400 } };
    const dropdownShortStyles: Partial<IDropdownStyles> = { dropdown: { width: 150 } };

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<unknown>();
    const [selectedSummaryTopicItem, setSelectedSummaryTopicItem] = useState<string[]>([]);
    const [customTopic, setCustomTopic] = useState<string>("");

    const [symbol, setSymbol] = useState<string>('AAPL');
    const [selectedSector, setSelectedSector] = useState<IDropdownOption>();
    const [sectors, setSectors] = useState<{key: string, text: string;}[]>([]);
    const [industries, setIndustries] = useState<{key: string, text: string;}[]>([]);
    const [selectedIndustry, setSelectedIndustry] = useState<IDropdownOption>();
    const [companies, setCompanies] = useState<{key: string, text: string;}[]>([]);
    const [selectedCompany, setSelectedCompany] = useState<string[]>([]);
    const [selectedYears, setSelectedYears] = useState<string[]>([]);
    const [selectedReportType, setSelectedReportType] = useState<string[]>([]);
    const [secResponse, setSecResponse] =  useState<string>("");

    // 1A
    const [selectedPdfCompany, setSelectedPdfCompany] = useState<IDropdownOption>();
    const [selectedPdfYears, setSelectedPdfYears] = useState<IDropdownOption>();
    const [selectedPdfReportType, setSelectedPdfReportType] = useState<IDropdownOption>();
    const [uploadPassword, setUploadPassword] = useState('');
    const [missingUploadPassword, setMissingUploadPassword] = useState(false)
    const [uploadError, setUploadError] = useState(false)
    const [files, setFiles] = useState<any>([])
    const [uploadText, setUploadText] = useState('');

    const [selectedProcessedSector, setSelectedProcessedSector] = useState<IDropdownOption>();
    const [processedSectors, setProcessedSectors] = useState<{key: string, text: string;}[]>([]);
    const [processedIndustries, setProcessedIndustries] = useState<{key: string, text: string;}[]>([]);
    const [selectedProcessedIndustry, setSelectedProcessedIndustry] = useState<IDropdownOption>();
    const [processedCompanies, setProcessedCompanies] = useState<{key: string, text: string;}[]>([]);
    const [processedStocksList, setProcessedStocksList] = useState<{Symbol: string;Sector: string;Industry: string;Year: string;FilingType: string;}[]>([]);
    const [selectedProcessedCompany, setSelectedProcessedCompany] = useState<string[]>([]);
    const [selectedProcessedYears, setSelectedProcessedYears] = useState<string[]>([]);
    const [processedFilingYears, setProcessedFilingYears] = useState<any[]>([]);
    const [processedFilingTypes, setProcessedFilingTypes] = useState<any[]>([]);
    const [selectedProcessedReportType, setSelectedProcessedReportType] = useState<string[]>([]);
    const [selectedSecSummaryTopicItem, setSelectedSecSummaryTopicItem] = useState<string[]>([]);
    const [customSecTopic, setCustomSecTopic] = useState<string>("");
    const [secSummarization, setSecSummarization] = useState<any>();
    const [vectoredStocksList, setVectoredStocksList] = useState<{Symbol: string;Cik: string;FilingYear: string;FilingType: string;}[]>([]);
    const [vectoredFilingYears, setVectoredFilingYears] = useState<any[]>([]);
    const [vectoredFilingTypes, setVectoredFilingTypes] = useState<any[]>([]);
    const [vectoredCompanies, setVectoredCompanies] = useState<{key: string, text: string;}[]>([]);
    const [selectedVectoredCompany, setSelectedVectoredCompany] = useState<string[]>([]);
    const [selectedVectoredYears, setSelectedVectoredYears] = useState<string[]>([]);
    const [selectedVectoredReportType, setSelectedVectoredReportType] = useState<string[]>([]);
    const [searchItems, setSearchItems] = useState<SearchItem[]>([]);
    const [answer, setAnswer] = useState<AskResponse>();

    // Compare & Contrast
    const [compareAnswer, setCompareAnswer] = useState<string>();
    const [exampleList, setExampleList] = useState<ExampleModel[]>([{text:'', value: ''}]);
    const [exampleLoading, setExampleLoading] = useState(false)

    const [showAuthMessage, setShowAuthMessage] = useState<boolean>(false);
    const [missingSymbol, setMissingSymbol] = useState<boolean>(false);
    const [companyName, setCompanyName] = useState<string>();
    const [cik, setCik] = useState<string>();
    const [researchReport, setResearchReports] = useState<any>();

    const lastQuestionRef = useRef<string>("");
    const [activeCitation, setActiveCitation] = useState<string>();
    const [activeAnalysisPanelTab, setActiveAnalysisPanelTab] = useState<AnalysisPanelTabs | undefined>(undefined);
    const [selectedAnswer, setSelectedAnswer] = useState<number>(0);
    const [answers, setAnswers] = useState<[user: string, response: AskResponse, speechUrl: string | null][]>([]);
    const [runningIndex, setRunningIndex] = useState<number>(-1);
    const [chatSession, setChatSession] = useState<ChatSession | null>(null);
    const [selectedItems, setSelectedItems] = useState<any[]>([]);
    const [sessionName, setSessionName] = useState<string>('');
    const [sessionList, setSessionList] = useState<any[]>();
    const [oldSessionName, setOldSessionName] = useState<string>('');
    const [sessionId, setSessionId] = useState<string>();
    const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);
    const [selectedDoc, setSelectedDoc] = useState<IDropdownOption>();
    const [incomeStatement, setIncomeStatement] = useState<any>();
    const [cashFlow, setCashFlow] = useState<any>();

    const searchColumns: IColumn[] = [
        {
          key: 'symbol',
          name: 'Company',
          fieldName: 'company',
          minWidth: 150,
          isMultiline: true,
        },
        {
            key: 'filingYear',
            name: 'Filing Year',
            fieldName: 'filingYear',
            minWidth: 80
        },
        {
            key: 'filingType',
            name: 'Filing Type',
            fieldName: 'filingType',
            minWidth: 80
        },
        {
          key: 'summary',
          name: 'Summary',
          isMultiline: true,
          minWidth: 900,
          isResizable: true,
          fieldName: 'contentSummary',
        },
        // {
        //     key: 'content',
        //     name: 'Content',
        //     isMultiline: true,
        //     minWidth: 900,
        //     isResizable: true,
        //     fieldName: 'content',
        // },
    ];
    const { getRootProps, getInputProps } = useDropzone({
        multiple: false,
        maxSize: 5000000000,
        accept: {
          'application/pdf': ['.pdf'],
        },
        onDrop: acceptedFiles => {
          setFiles(acceptedFiles.map(file => Object.assign(file)))
        }
    })
    const fillingsYears = [
        {
          key: '2024',
          text: '2024'
        },
        {
          key: '2023',
          text: '2023'
        },
        {
          key: '2022',
          text: '2022'
        },
        {
          key: '2021',
          text: '2021'
        },
        {
            key: '2020',
            text: '2020'
        },
        {
            key: '2019',
            text: '2019'
        },
        {
            key: '2018',
            text: '2018'
        }
    ]
    const fillingReportType = [
        {
          key: '10-K',
          text: '10-K'
        }
    ]
    const secSummaryTopicOptions = [
        {
          key: 'Financial Results',
          text: 'Financial Results'
        },
        {
          key: 'Business Highlights',
          text: 'Business Highlights'
        },
        {
          key: 'Future Outlook',
          text: 'Future Outlook'
        },
        {
          key: 'Business Risks',
          text: 'Business Risks'
        },
        {
            key: 'Management Positive Sentiment',
            text: 'Management Positive Sentiment'
        },
        {
            key: 'Management Negative Sentiment',
            text: 'Management Negative Sentiment'
        },
        {
            key: 'Key Operating Metrics',
            text: 'Key Operating Metrics'
        },
        {
            key: 'Success Stories',
            text: 'Success Stories'
        },
        {
            key: 'item1',
            text: 'item1'
        },
        {
            key: 'item1A',
            text: 'item1A'
        },
        {
            key: 'item1B',
            text: 'item1B'
        },
        {
            key: 'item2',
            text: 'item2'
        },
        {
            key: 'item3',
            text: 'item3'
        },
        {
            key: 'item4',
            text: 'item4'
        },
        {
            key: 'item5',
            text: 'item5'
        },
        {
            key: 'item6',
            text: 'item6'
        },
        {
            key: 'item7',
            text: 'item7'
        },
        {
            key: 'item7A',
            text: 'item7A'
        },
        {
            key: 'item8',
            text: 'item8'
        },
        {
            key: 'item9',
            text: 'item9'
        },
        {
            key: 'item9A',
            text: 'item9A'
        },
        {
            key: 'item9B',
            text: 'item9B'
        },
        {
            key: 'item10',
            text: 'item10'
        },
        {
            key: 'item11',
            text: 'item11'
        },
        {
            key: 'item12',
            text: 'item12'
        },
        {
            key: 'item13',
            text: 'item13'
        },
        {
            key: 'item14',
            text: 'item14'
        },
        {
            key: 'item15',
            text: 'item15'
        }
    ]
    const docOptions = [
        {
            key: 'latestearningcalls',
            text: 'Earning Calls'
        },
        {
            key: 'latestsecfilings',
            text: 'SEC Filings'
        }
    ]
    const secSummarizationColumns = [
        {
          key: 'Symbol',
          name: 'Ticker',
          fieldName: 'symbol',
          minWidth: 100, maxWidth: 100, isResizable: false, isMultiline: true
        },
        {
            key: 'FilingYear',
            name: 'Filing Year',
            fieldName: 'filingYear',
            minWidth: 100, maxWidth: 100, isResizable: false, isMultiline: true
        },
        {
            key: 'ReportType',
            name: 'Report Type',
            fieldName: 'reportType',
            minWidth: 100, maxWidth: 100, isResizable: false, isMultiline: true
        },
        {
            key: 'Question',
            name: 'Question or Topic',
            fieldName: 'question',
            minWidth: 400, maxWidth: 400, isResizable: false, isMultiline: true
        },
        {
          key: 'Answer',
          name: 'Answer or Summarization',
          fieldName: 'answer',
          minWidth: 700, maxWidth: 900, isResizable: false, isMultiline: true
        }
    ]
    const pressReleasesColumns = [
        {
          key: 'releaseDate',
          name: 'Release Date',
          fieldName: 'releaseDate',
          minWidth: 100, maxWidth: 150, isResizable: false, isMultiline: true
        },
        {
          key: 'title',
          name: 'Press Release Title',
          fieldName: 'title',
          minWidth: 200, maxWidth: 300, isResizable: false, isMultiline: true
        },
        {
            key: 'summary',
            name: 'Press Release Summary',
            fieldName: 'summary',
            minWidth: 400, maxWidth: 500, isResizable: false, isMultiline: true
        },
        {
            key: 'sentiment',
            name: 'Sentiment',
            fieldName: 'sentiment',
            minWidth: 100, maxWidth: 150, isResizable: false, isMultiline: true
        },
        {
            key: 'sentimentScore',
            name: 'Sentiment Score',
            fieldName: 'sentimentScore',
            minWidth: 100, maxWidth: 150, isResizable: false, isMultiline: true
        }
    ]
    const stackItemStyles: IStackItemStyles = {
        root: {
            alignItems: 'left',
            // background: DefaultPalette.white,
            // color: DefaultPalette.white,
            display: 'flex',
            justifyContent: 'left',
        },
    };
    const stackItemCenterStyles: IStackItemStyles = {
        root: {
            alignItems: 'center',
            display: 'flex',
            justifyContent: 'left',
        },
    };
    const sessionListColumn = [
        {
          key: 'Session Name',
          name: 'Session Name',
          fieldName: 'Session Name',
          minWidth: 100,
          maxWidth: 200, 
          isResizable: false,
        }
    ]
    // Tokens definition
    const outerStackTokens: IStackTokens = { childrenGap: 5 };
    const innerStackTokens: IStackTokens = {
        childrenGap: 5,
        padding: 10,
    };
    const selection = useMemo(
        () =>
        new Selection({
            onSelectionChanged: () => {
            setSelectedItems(selection.getSelection());
        },
        selectionMode: SelectionMode.single,
        }),
    []);
    const detailsList = useMemo(
        () => (
            <MarqueeSelection selection={selection}>
                <DetailsList
                    className={styles.example}
                    items={sessionList || []}
                    columns={sessionListColumn}
                    selectionMode={SelectionMode.single}
                    //getKey={(item: any) => item.key}
                    setKey="single"
                    onActiveItemChanged={(item:any) => onSessionClicked(item)}
                    layoutMode={DetailsListLayoutMode.fixedColumns}
                    ariaLabelForSelectionColumn="Toggle selection"
                    checkButtonAriaLabel="select row"
                    selection={selection}
                    selectionPreservedOnEmptyClick={false}
                 />
             </MarqueeSelection>
         ),
         [selection, sessionListColumn, sessionList]
    );
    const handleRemoveFile = (file: File ) => {
        const uploadedFiles = files
        const filtered = uploadedFiles.filter((i: { name: string; }) => i.name !== file.name)
        setFiles([...filtered])
    }
    const handleRemoveAllFiles = () => {
        setFiles([])
    }
    const renderFilePreview = (file: File ) => {
        if (file.type.startsWith('image')) {
          return <img width={38} height={38} alt={file.name} src={URL.createObjectURL(file)} />
        } else {
          return <BarcodeScanner24Filled/>
        }
    }
    const fileList = files.map((file:File) => (
        <div>
          <div className='file-details'>
            <div className='file-preview'>{renderFilePreview(file)}</div>
            <div key={file.name}>
              {file.name}
              &nbsp;
                {Math.round(file.size / 100) / 10 > 1000
                  ? (Math.round(file.size / 100) / 10000).toFixed(1) + ' MB'
                  : (Math.round(file.size / 100) / 10).toFixed(1) + ' KB'}
            </div>
          </div>
          <DefaultButton onClick={() => handleRemoveFile(file)} disabled={isLoading ? true : false}>Remove File</DefaultButton>
        </div>
    ))
    const handleUploadFiles = async () => {
      if (uploadPassword == '') {
        setMissingUploadPassword(true)
        return
      }
      setIsLoading(true)
      await verifyPassword("upload", uploadPassword)
      .then(async (verifyResponse:string) => {
        if (verifyResponse == "Success") {
          setUploadText("Password verified")
          setUploadText('Uploading your document...')
          let count = 0
          await new Promise( (resolve) => {
          files.forEach(async (element: File) => {
            try {
              const formData = new FormData();
              formData.append('file', element);
    
              await uploadBinaryFile(formData)
            }
            finally
            {
              count += 1
              if (count == files.length) {
                resolve(element)
              }
            }
          })
          })
          setUploadText("File uploaded successfully.  Now indexing the document.")
          processSec("1A", "No", "")
        }
        else {
          setUploadText(verifyResponse)
        }
      })
      .catch((error : string) => {
        setUploadText(error)
        setFiles([])
        setIsLoading(false)
      })
      setIsLoading(false)
    }
    const onUploadPassword = (_ev?: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        setUploadPassword(newValue || "");
        if (newValue == '') {
          setMissingUploadPassword(true)
        }
        else {
          setMissingUploadPassword(false)
        }
    };
    const getSecFilingData = async () => {
        try {
            await getSecFilingProcessedData()
            .then(async (response:any) => {
                const stocksList = []
                for (const document of response.values)
                {
                    stocksList.push({
                        Symbol:document.symbol, 
                        Sector:document.sector,
                        Industry:document.industry,
                        Year:document.year,
                        FilingType:document.filingType,
                        });
                }
                setProcessedStocksList(stocksList)
                const uniqSector = [...new Set(stocksList.map(({Sector})=>Sector))]
                const sectors = uniqSector.map((sector) => {
                    return {key: sector, text: sector}
                })
                setProcessedSectors(sectors)
                setSelectedProcessedSector(sectors[0])
                const filteredIndustry = stocksList.filter(({Sector})=>Sector === String(sectors[0].key))
                const uniqIndustries = [...new Set(filteredIndustry.map(({Industry})=>Industry))]
                const industries = uniqIndustries.map((industry) => {
                    return {key: industry, text: industry}
                })
                setProcessedIndustries(industries)
                setSelectedProcessedIndustry(industries[0])
                const filteredCompanies = stocksList.filter(({Industry, Sector})=>Industry === String(industries[0].key) && 
                String(sectors[0]?.key) === Sector)
                const uniqCompanies = [...new Set(filteredCompanies.map(({Symbol})=>Symbol))]
                const companies = uniqCompanies.map((company) => {
                    return {key: company, text: company}
                })
                const uniqYears = [...new Set(stocksList.map(({Year})=>Year))]
                const years = uniqYears.map((year) => {
                    return {key: year, text: year}
                })
                setProcessedFilingYears(years)
                const uniqFilingType = [...new Set(filteredIndustry.map(({FilingType})=>FilingType))]
                const filingTypes = uniqFilingType.map((filingType) => {
                    return {key: filingType, text: filingType}
                })
                setProcessedFilingTypes(filingTypes)
                setProcessedIndustries(industries)
                setProcessedCompanies(companies)
            }
            )
        } catch (e) {
            setError(e);
        } finally {
            setIsLoading(false);
        }
    }
    const getSecFilingVectorData = async () => {
        try {
            await getSecFilingVectoredData()
            .then(async (response:any) => {
                const stocksList = []
                for (const document of response.values)
                {
                    stocksList.push({
                        Symbol:document.symbol, 
                        Cik:document.cik,
                        FilingYear:document.filingYear,
                        FilingType:document.filingType,
                        });
                }
                setVectoredStocksList(stocksList)
                const uniqCompanies = [...new Set(stocksList.map(({Symbol})=>Symbol))]
                const companies = uniqCompanies.map((company) => {
                    return {key: company, text: company}
                })
                setVectoredCompanies(companies)
                const uniqYears = [...new Set(stocksList.map(({FilingYear})=>FilingYear))]
                const years = uniqYears.map((year) => {
                    return {key: year, text: year}
                })
                setVectoredFilingYears(years)
                const uniqFilingType = [...new Set(stocksList.map(({FilingType})=>FilingType))]
                const filingTypes = uniqFilingType.map((filingType) => {
                    return {key: filingType, text: filingType}
                })
                setVectoredFilingTypes(filingTypes)

            }
            )
        } catch (e) {
            setError(e);
        } finally {
            setIsLoading(false);
        }
    }
    const onSectorChange = (event?: React.FormEvent<HTMLDivElement>, item?: IDropdownOption): void => {
        setSelectedSector(item);
        const filteredIndustry = Stocks.Tickers.filter(({Sector})=>Sector === String(item?.key))

        const uniqIndustries = [...new Set(filteredIndustry.map(({Industry})=>Industry))]
        const industries = uniqIndustries.map((industry) => {
            return {key: industry, text: industry}
        })

        setIndustries(industries)
        setSelectedIndustry(industries[0])

        const filteredCompanies = Stocks.Tickers.filter(({Industry, Sector})=>Industry === String(industries[0].key) && 
        String(item?.key) === Sector)
        const uniqCompanies = [...new Set(filteredCompanies.map(({Symbol})=>Symbol))]        
        const companies = uniqCompanies.map((company) => {
            return {key: company, text: company}
        })
        setCompanies(companies)
        setSelectedPdfCompany(companies[0]);
        setSelectedPdfYears(fillingsYears[0]);
        setSelectedPdfReportType(fillingReportType[0]);
    }
    const onProcessedSectorChange = (event?: React.FormEvent<HTMLDivElement>, item?: IDropdownOption): void => {
        setSelectedProcessedSector(item);
        const filteredIndustry = processedStocksList.filter(({Sector})=>Sector === String(item?.key))

        const uniqIndustries = [...new Set(filteredIndustry.map(({Industry})=>Industry))]
        const industries = uniqIndustries.map((industry) => {
            return {key: industry, text: industry}
        })

        setProcessedIndustries(industries)
        setSelectedProcessedIndustry(industries[0])

        const filteredCompanies = processedStocksList.filter(({Industry, Sector})=>Industry === String(industries[0].key) && 
        String(item?.key) === Sector)
        const uniqCompanies = [...new Set(filteredCompanies.map(({Symbol})=>Symbol))]        
        const companies = uniqCompanies.map((company) => {
            return {key: company, text: company}
        })
        setProcessedCompanies(companies)
    }
    const onIndustryChange = (event?: React.FormEvent<HTMLDivElement>, item?: IDropdownOption): void => {
        setSelectedIndustry(item);
        const filteredCompanies = Stocks.Tickers.filter(({Industry, Sector})=>Industry === String(item?.key) && 
        String(selectedSector?.key) === Sector)

        const uniqCompanies = [...new Set(filteredCompanies.map(({Symbol})=>Symbol))]
        const companies = uniqCompanies.map((company) => {
            return {key: company, text: company}
        })
        setCompanies(companies)
        setSelectedPdfCompany(companies[0]);
        setSelectedPdfYears(fillingsYears[0]);
        setSelectedPdfReportType(fillingReportType[0]);
    }
    const onProcessedIndustryChange = (event?: React.FormEvent<HTMLDivElement>, item?: IDropdownOption): void => {
        setSelectedProcessedIndustry(item);
        const filteredCompanies = processedStocksList.filter(({Industry, Sector})=>Industry === String(item?.key) && 
        String(selectedSector?.key) === Sector)

        const uniqCompanies = [...new Set(filteredCompanies.map(({Symbol})=>Symbol))]
        const companies = uniqCompanies.map((company) => {
            return {key: company, text: company}
        })
        setProcessedCompanies(companies)
    }
    const onCompanyChange = (event?: React.FormEvent<HTMLDivElement>, item?: IDropdownOption): void => {
        if (item) {
            setSelectedCompany(
                item.selected ? [...selectedCompany, item.key as string] : selectedCompany.filter(key => key !== item.key),
            );
        }
    }
    const onCompanyPdfChange = (event?: React.FormEvent<HTMLDivElement>, item?: IDropdownOption): void => {
        setSelectedPdfCompany(item)
    }
    const onProcessedCompanyChange = (event?: React.FormEvent<HTMLDivElement>, item?: IDropdownOption): void => {
        if (item) {
            setSelectedProcessedCompany(
                item.selected ? [...selectedProcessedCompany, item.key as string] : selectedProcessedCompany.filter(key => key !== item.key),
            );
        }
    }
    const onVectoredCompanyChange = (event?: React.FormEvent<HTMLDivElement>, item?: IDropdownOption): void => {
        if (item) {
            setSelectedVectoredCompany(
                item.selected ? [...selectedVectoredCompany, item.key as string] : selectedVectoredCompany.filter(key => key !== item.key),
            );
        }
    }
    const onYearChange = (event?: React.FormEvent<HTMLDivElement>, item?: IDropdownOption): void => {
        if (item) {
            setSelectedYears(
                item.selected ? [...selectedYears, item.key as string] : selectedYears.filter(key => key !== item.key),
            );
        }
    }
    const onYearPdfChange = (event?: React.FormEvent<HTMLDivElement>, item?: IDropdownOption): void => {
        setSelectedPdfYears(item)
    }
    const onProcessedYearChange = (event?: React.FormEvent<HTMLDivElement>, item?: IDropdownOption): void => {
        if (item) {
            setSelectedProcessedYears(
                item.selected ? [...selectedProcessedYears, item.key as string] : selectedProcessedYears.filter(key => key !== item.key),
            );
        }
    }
    const onVectoredYearChange = (event?: React.FormEvent<HTMLDivElement>, item?: IDropdownOption): void => {
        if (item) {
            setSelectedVectoredYears(
                item.selected ? [...selectedVectoredYears, item.key as string] : selectedVectoredYears.filter(key => key !== item.key),
            );
        }
    }
    const onReportTypeChange = (event?: React.FormEvent<HTMLDivElement>, item?: IDropdownOption): void => {
        if (item) {
            setSelectedReportType(
                item.selected ? [...selectedReportType, item.key as string] : selectedReportType.filter(key => key !== item.key),
            );
        }
    }
    const onReportTypePdfChange = (event?: React.FormEvent<HTMLDivElement>, item?: IDropdownOption): void => {
        setSelectedPdfReportType(item)
    }
    const onProcessedReportTypeChange = (event?: React.FormEvent<HTMLDivElement>, item?: IDropdownOption): void => {
        if (item) {
            setSelectedProcessedReportType(
                item.selected ? [...selectedProcessedReportType, item.key as string] : selectedProcessedReportType.filter(key => key !== item.key),
            );
        }
    }
    const compareContrastSampleQa = async () => {
        const sampleQuestion = []
        const  questionList = [] 
        questionList.push("What is the sales and trading revenue for equities for all year across all companies.  Display the output as Table with columns as company, year and revenue(figures in million)")
        questionList.push("How differently those banks are handling CCAR.  Give me the answer in bulleted format with breakdown by company and by each year")
        questionList.push("Compare and contrast the revenue between 2021 and 2022.  Display the output as JSON object with keys as company, year and revenue")
        questionList.push("What strategies each company is using to optimize cash management?. Give me the answer in bulleted format with breakdown by company")
        questionList.push("What is the status of LIBOR Transitions over the years for all companies. If there's no information for a specific year or company, just say 'No Information' for that specific year and company.  Breakdown the answer in bulleted list by company and year with minimum of 3 paragraphs to maximum of 7 paragraphs for each company and year")
        questionList.push("What is the status of LIBOR Transitions?  Provide the information with breakdown for year and company")
        questionList.push("Compare and contrast the cash flow between 2021 and 2022. Show me the information in Table format with columns as company, year, cash flow(figures in millions)")
        questionList.push("Which customer segments and geographies grew the fastest for JPMC")
        questionList.push("Can you compare and contrast the risk factors in 2021 vs. 2020 in bulleted list for each company?")
        questionList.push("What is the revenue from equity derivatives business for the companies over the years where the information is available.  The output should be in table format with columns as company, year and amount")
        questionList.push("Compare revenue growth of Morgan Stanley from 2020 to 2021.  Show the growth comparison in millions")
        questionList.push("Compare and contrast the cash flow between 2021 and 2022 across Bank of America, JP Morgan Chase  . Show me the information in Table format with columns as company, year, cash flow(figures in millions)")
        questionList.push("What is the status of LIBOR Transitions for the year 2022.  Display the information with breakdown across each company")

        const shuffled = questionList.sort(() => 0.5 - Math.random());
        const selectedQuestion = shuffled.slice(0, 5);

        for (const item of selectedQuestion) {
            if ((item != '')) {
                sampleQuestion.push({
                    text: item,
                    value: item,
                })
            } 
        }
        const generatedExamples: ExampleModel[] = sampleQuestion
        setExampleList(generatedExamples)
        setExampleLoading(false)
    }
    const onVectoredReportTypeChange = (event?: React.FormEvent<HTMLDivElement>, item?: IDropdownOption): void => {
        if (item) {
            setSelectedVectoredReportType(
                item.selected ? [...selectedVectoredReportType, item.key as string] : selectedVectoredReportType.filter(key => key !== item.key),
            );
        }
    }
    const onDocChange = (event?: React.FormEvent<HTMLDivElement>, item?: IDropdownOption): void => {
        setSelectedDoc(item);
        clearChat();
        getCosmosSession(String(item?.key), String(symbol))
    }
    const onSymbolChange = (_ev?: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        setSymbol(newValue || "");
        if (newValue == '') {
          setMissingSymbol(true)
        }
        else {
            setMissingSymbol(false)
        }
        getCosmosSession(String(selectedDoc?.key), String(newValue))
        clearChat();
    };
    const getUserInfoList = async () => {
        const userInfoList = await getUserInfo();
        if (userInfoList.length === 0 && window.location.hostname !== "localhost") {
            setShowAuthMessage(true);
        }
        else {
            setShowAuthMessage(false);
        }
    }
    const processSec = async (step:string, reProcess: string, question:string) => {
        try {
                let request: AskRequest
                setIsLoading(true);
                if (step == '1') {
                    request  = {
                            question : '',
                            approach: Approaches.ReadDecomposeAsk,
                            overrides: {
                                sector: selectedSector?.key as string,
                                industry: selectedIndustry?.key as string,
                                companies: [...new Set(selectedCompany)],
                                years: [...new Set(selectedYears)],
                                reportType: [...new Set(selectedReportType)]
                            }
                    }
                    await getSec(step, reProcess, request)
                    .then(async (response) => {
                            const secResponse = JSON.parse(JSON.stringify(response.answer));
                            setSecResponse(secResponse)
                        }
                    )
                    setIsLoading(false);
                    setSelectedCompany([])
                    setSelectedYears([])
                    setSelectedReportType([])
                } else if (step == '1A') {
                    request  = {
                            question : '',
                            approach: Approaches.ReadDecomposeAsk,
                            overrides: {
                                sector: selectedSector?.key as string,
                                industry: selectedIndustry?.key as string,
                                companies: [selectedPdfCompany?.key as string],
                                years: [selectedPdfYears?.key as string],
                                reportType: [selectedPdfReportType?.key as string],
                                fileName: files[0].name
                            }
                    }
                    await getSec(step, reProcess, request)
                    .then(async (response) => {
                            const secResponse = JSON.parse(JSON.stringify(response.answer));
                            setSecResponse(secResponse)
                        }
                    )
                    setIsLoading(false);
                    setFiles([]);
                    setUploadText('Document Uploaded and Indexed')
                } else if (step == '2')
                {
                    // Get all topic to summarize
                    if (customSecTopic != '') {
                        const addTopic = customSecTopic.split(",")
                        if (addTopic.length > 0) {
                        for (let i = 0; i < addTopic.length; i++) {
                            if (addTopic[i] != '') {
                                selectedSecSummaryTopicItem.push(addTopic[i])
                            }
                        }
                        } else {
                            selectedSecSummaryTopicItem.push(customSecTopic)
                        }
                    }
                    const uniqTopics = [...new Set(selectedSecSummaryTopicItem)]
                    setSelectedSecSummaryTopicItem(uniqTopics)
                    
                    request  = {
                        question : '',
                            approach: Approaches.ReadDecomposeAsk,
                            overrides: {
                                sector: selectedProcessedSector?.key as string,
                                industry: selectedProcessedIndustry?.key as string,
                                companies: [...new Set(selectedProcessedCompany)],
                                years: [...new Set(selectedProcessedYears)],
                                reportType: [...new Set(selectedProcessedReportType)],
                                topics: uniqTopics.length === 0 ? undefined : uniqTopics
                            }
                    };
                    await getSec(step, reProcess, request)
                        .then(async (response) => {
                                const result = JSON.parse(JSON.stringify(response.answer));
                                setSecSummarization(undefined);
                                const sFilings = []
                                for (let i = 0; i < result.length; i++) {
                                    const symbol = result[i].symbol
                                    const filingYear = result[i].filingYear
                                    const filingType = result[i].reportType
                                    const secData = eval(JSON.parse(JSON.stringify(result[i].secData)))
                                    for (let i = 0; i < secData.length; i++) 
                                    {
                                        sFilings.push({
                                            "symbol": symbol,
                                            "filingYear": filingYear,
                                            "filingType": filingType,
                                            "question": secData[i]['question'],
                                            "answer": secData[i]['answer'],
                                            });
                                    }
                                }
                                setSecSummarization(sFilings);
                        })
                } else if (step == '3') {
                    const itemsResponse: SearchItem[] = [];
                    request  = {
                        question : '',
                        approach: Approaches.ReadDecomposeAsk,
                        overrides: {
                            sector: "",
                            industry: "",
                            companies: [...new Set(selectedVectoredCompany)],
                            years: [...new Set(selectedVectoredYears)],
                            reportType: [...new Set(selectedVectoredReportType)],
                            promptTemplate:question
                        }
                    }
                    await getSec(step, reProcess, request)
                        .then(async (response) => {
                                const result = JSON.parse(JSON.stringify(response.answer));
                                for (let i = 0; i < result.length; i++) {
                                    itemsResponse.push({
                                        company: result[i].company,
                                        cik: result[i].cik,
                                        contentSummary: result[i].contentSummary,
                                        content: result[i].content,
                                        filingYear: result[i].filingYear,
                                        filingType: result[i].filingType,
                                    });
                                }
                                setSearchItems(itemsResponse);
                    })
                } else if (step == '4') {
                    lastQuestionRef.current = question;
                    request  = {
                        question : '',
                        approach: Approaches.ReadDecomposeAsk,
                        overrides: {
                            sector: "",
                            industry: "",
                            companies: [...new Set(selectedVectoredCompany)],
                            years: [...new Set(selectedVectoredYears)],
                            reportType: [...new Set(selectedVectoredReportType)],
                            promptTemplate:question
                        }
                    }
                    await getSec(step, reProcess, request)
                        .then(async (response) => {
                                const result = JSON.parse(JSON.stringify(response.answer));
                                setCompareAnswer(result);
                    })
                    setIsLoading(false);
                }

            } catch (e) {
                setError(e);
                setIsLoading(false);
        } finally {
                setIsLoading(false);
        }
    }
    const clearChat = () => {
        lastQuestionRef.current = "";
        error && setError(undefined);
        setActiveCitation(undefined);
        setActiveAnalysisPanelTab(undefined);
        setChatSession(null)
        setAnswers([]);
        setSelectedItems([])
        setSessionName('');
    };
    const getCosmosSession = async (indexNs : string, indexType: string) => {
        try {
            await getAllIndexSessions(indexNs, indexType, 'chat', 'Session')
            .then(async (response:any) => {
                const sessionLists = []
                if (response.length === 0) {
                    sessionLists.push({
                        "Session Name": "No Sessions found",
                    });    
                } else 
                {
                    for (const session of response) {
                        sessionLists.push({
                            "Session Name": session.name,
                        });    
                    }
                }
                setSessionList(sessionLists)
            })
        } catch (e) {
            setError(e);
        } finally {
            setIsLoading(false);
        }
    };
    const deleteSession = async () => {
        //const sessionName = String(selectedItems[0]?.['Session Name'])
        if (sessionName === 'No Sessions found' || sessionName === "" || sessionName === undefined) {
            alert("Select Session to delete")
        }
        await deleteIndexSession(String(selectedDoc?.key), String(symbol), sessionName)
            .then(async (sessionResponse:any) => {
                getCosmosSession(String(selectedDoc?.key), String(symbol))
                clearChat();
        })

    };
    const renameSession = async () => {
        if (oldSessionName === 'No Sessions found' || oldSessionName === undefined || sessionName === "" || sessionName === undefined
        || oldSessionName === "" || sessionName === 'No Sessions found') {
            alert("Select valid session to rename")
        }
        else {
            await renameIndexSession(oldSessionName, sessionName)
                .then(async (sessionResponse:any) => {
                    getCosmosSession(String(selectedDoc?.key), String(symbol))
                    clearChat();
            })
        }
    };
    const onSessionNameChange = (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string): void => {
        const oldSessionName = String(selectedItems[0]?.['Session Name'])
        if (newValue === undefined || newValue === "") {
            alert("Provide session name")
        }
        setSessionName(newValue || oldSessionName);
    };
    const onCustomTopicChange = (_ev?: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        setCustomTopic(newValue || "");
    };
    const onSecSummarizationTopicChanged = (event?: React.FormEvent<HTMLDivElement>, item?: IDropdownOption): void => {
        if (item) {
            setSelectedSecSummaryTopicItem(
              item.selected ? [...selectedSecSummaryTopicItem, item.key as string] : selectedSecSummaryTopicItem.filter(key => key !== item.key),
            );
        }
    };
    const onCustomSecTopicChange = (_ev?: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        setCustomSecTopic(newValue || "");
    };
    const onSessionClicked = async (sessionFromList: any) => {
        //makeApiRequest(sessionFromList.name);
        const sessionName = sessionFromList["Session Name"]
        setSessionName(sessionName)
        setOldSessionName(sessionName)
        if (sessionName != "No Session Found") {
            try {
                await getIndexSession(String(selectedDoc?.key), String(symbol), sessionName)
                .then(async (sessionResponse:any) => {
                    const sessionId = sessionResponse[0].sessionId
                    const newSession: ChatSession = {
                        id: sessionResponse[0].id,
                        type: sessionResponse[0].type,
                        sessionId: sessionResponse[0].sessionId,
                        name: sessionResponse[0].name,
                        chainType: sessionResponse[0].chainType,
                        feature: sessionResponse[0].feature,
                        indexId: sessionResponse[0].indexId,
                        indexType: sessionResponse[0].indexType,
                        indexName: sessionResponse[0].indexName,
                        llmModel: sessionResponse[0].llmModel,
                        timestamp: sessionResponse[0].timestamp,
                        tokenUsed: sessionResponse[0].tokenUsed,
                        embeddingModelType: sessionResponse[0].embeddingModelType
                      };
                    setChatSession(newSession);
                    await getIndexSessionDetail(sessionId)
                    .then(async (response:any) => {
                        const rows = response.reduce(function (rows: any[][], key: any, index: number) { 
                            return (index % 2 == 0 ? rows.push([key]) 
                            : rows[rows.length-1].push(key)) && rows;
                        }, []);
                        const sessionLists: [string, AskResponse, string | null][] = [];
                        for (const session of rows)
                        {
                            sessionLists.push([session[0].content, session[1].content, null]);
                        }
                        lastQuestionRef.current = sessionLists[sessionLists.length - 1][0];
                        setAnswers(sessionLists);
                    })
                })
            } catch (e) {
                setError(e);
            } finally {
                setIsLoading(false);
            }
        }
    }
    const onShowCitation = (citation: string, index: number) => {
        if (citation.indexOf('http') > -1 || citation.indexOf('https') > -1) {
            window.open(citation.replace('/content/', '').trim(), '_blank');
        } else {
            if (activeCitation === citation && activeAnalysisPanelTab === AnalysisPanelTabs.CitationTab && selectedAnswer === index) {
                setActiveAnalysisPanelTab(undefined);
            } else {
                setActiveCitation(citation);
                setActiveAnalysisPanelTab(AnalysisPanelTabs.CitationTab);
            }
        }
        setSelectedAnswer(index);
    };
    const generateQuickGuid = () => {
        return Math.random().toString(36).substring(2, 15) +
            Math.random().toString(36).substring(2, 15);
    }
    const handleNewConversation = () => {
        const sessId = generateQuickGuid(); //uuidv4();
        setSessionId(sessId);

        const newSession: ChatSession = {
          id: generateQuickGuid(),
          type: 'Session',
          sessionId: sessId,
          name: sessId,
          chainType: 'stuff',
          feature: 'chat',
          indexId: String(selectedDoc?.key),
          indexType: String(symbol),
          indexName: String(selectedDoc?.text),
          llmModel: 'gpt3.5',
          timestamp: String(new Date().getTime()),
          tokenUsed: 0,
          embeddingModelType: "azureopenai"
        };
        setChatSession(newSession);
        return newSession;
    };
    const onToggleTab = (tab: AnalysisPanelTabs, index: number) => {
        if (activeAnalysisPanelTab === tab && selectedAnswer === index) {
            setActiveAnalysisPanelTab(undefined);
        } else {
            setActiveAnalysisPanelTab(tab);
        }

        setSelectedAnswer(index);
    };
    const makeApiRequest = async (question: string) => {
        let  currentSession = chatSession;
        let firstSession = false;
        if (!lastQuestionRef.current || currentSession === null) {
            currentSession = handleNewConversation();
            firstSession = true;
            let sessionLists = sessionList;
            sessionLists?.unshift({
                "Session Name": currentSession.sessionId,
            });
            setSessionList(sessionLists)
        }
        lastQuestionRef.current = question;

        error && setError(undefined);
        setIsLoading(true);
        setActiveCitation(undefined);
        setActiveAnalysisPanelTab(undefined);

        try {
            const history: ChatTurn[] = answers.map(a => ({ user: a[0], bot: a[1].answer }));
            const request: ChatRequest = {
                history: [...history, { user: question, bot: undefined }],
                approach: Approaches.ReadRetrieveRead,
                overrides: {
                    promptTemplate: '',
                    top: 3,
                    temperature: 0,
                    suggestFollowupQuestions: true,
                    tokenLength: 1000,
                    autoSpeakAnswers: false,
                    embeddingModelType: "azureopenai",
                    firstSession: firstSession,
                    session: JSON.stringify(currentSession),
                    sessionId: currentSession.sessionId,
                    deploymentType: "gpt3516k",
                    chainType: "stuff",
                }
            };
            const result = await pibChatGptApi(request, symbol, String(selectedDoc?.key));
            setAnswers([...answers, [question, result, null]]);
        } catch (e) {
            setError(e);
        } finally {
            setIsLoading(false);
        }
    };
    const startOrStopSynthesis = async (answerType:string, url: string | null, index: number) => {
    };
    const onTabChange = (item?: PivotItem | undefined, ev?: React.MouseEvent<HTMLElement, MouseEvent> | undefined): void => {
        if (item?.props.headerText === "Chat Pib") {
            clearChat()
            setSelectedDoc(docOptions[0])
            getCosmosSession(docOptions[0]?.key, String(symbol))
        } 
        if (item?.props.headerText === "Chat Gpt") {
            getCosmosSession("chatgpt", "cogsearchvs")
        }
        if (item?.props.id === "summarization") {
            getSecFilingData()
        }
        if (item?.props.id === "search" || item?.props.id === "compare") {
            getSecFilingVectorData()
            setSelectedVectoredCompany([])
            setSelectedVectoredReportType([])
            setSelectedVectoredYears([])
        }
        if (item?.props.id === "compare") {
            setSelectedVectoredCompany(['BAC', 'JPM', 'GS', 'MS'])
            setSelectedVectoredYears(['2018', '2019', '2020', '2021', '2022'])
            setSelectedVectoredReportType(['10-K'])
        }
    };
    const onExampleClicked = (example: string) => {
        processSec("4", "No", example);
    };
    useEffect(() => {
        compareContrastSampleQa();
        if (window.location.hostname != "localhost") {
            getUserInfoList();
            setShowAuthMessage(true)
        } else
            setShowAuthMessage(false)

        const uniqSector = [...new Set(Stocks.Tickers.map(({Sector})=>Sector))]
        const sectors = uniqSector.map((sector) => {
            return {key: sector, text: sector}
        })
        setSectors(sectors)
        setSelectedSector(sectors[0])
        const filteredIndustry = Stocks.Tickers.filter(({Sector})=>Sector === String(sectors[0].key))
        const uniqIndustries = [...new Set(filteredIndustry.map(({Industry})=>Industry))]
        const industries = uniqIndustries.map((industry) => {
            return {key: industry, text: industry}
        })
        setIndustries(industries)
        setSelectedIndustry(industries[0])
        const filteredCompanies = Stocks.Tickers.filter(({Industry, Sector})=>Industry === String(industries[0].key) && 
        String(sectors[0]?.key) === Sector)
        const uniqCompanies = [...new Set(filteredCompanies.map(({Symbol})=>Symbol))]
        const companies = uniqCompanies.map((company) => {
            return {key: company, text: company}
        })
        setCompanies(companies)
        setSelectedDoc(docOptions[0]);
        setSelectedPdfCompany(companies[0]);
        setSelectedPdfYears(fillingsYears[0]);
        setSelectedPdfReportType(fillingReportType[0]);
        setSelectedSummaryTopicItem(['Financial Results', 'Business Highlights', 'Future Outlook', 'Business Risks', 'Management Positive Sentiment', 'Management Negative Sentiment'])
        setSelectedSecSummaryTopicItem(['item1', 'item1A', 'item3', 'item6', 'item7', 'item7A', 'item9', 'Management Positive Sentiment', 'Management Negative Sentiment'])
    }, [])

    return (
        <div className={styles.root}>
            <div className={styles.layout}>
            <header className={styles.header} role={"banner"}>
                <div className={styles.headerContainer}>
                    <Link to="https://dataaipdfchat.azurewebsites.net/" target={"_blank"} className={styles.headerTitleContainer}>
                        <h3 className={styles.headerTitle}>Edgar Analysis</h3>
                    </Link>
                    <nav>
                        <ul className={styles.headerNavList}>
                            <li className={styles.headerNavLeftMargin}>
                                <a href="https://github.com/akshata29/sec" target={"_blank"} title="Github repository link">
                                    <img
                                        src={github}
                                        alt="Github logo"
                                        aria-label="Link to github repository"
                                        width="20px"
                                        height="20px"
                                        className={styles.githubLogo}
                                    />
                                </a>
                            </li>
                        </ul>
                    </nav>
                    <h4 className={styles.headerRightText}>FSI Accelerator</h4>
                </div>
            </header>
            </div>
            {showAuthMessage ? (
                <Stack className={styles.chatEmptyState}>
                    <ShieldLockRegular className={styles.chatIcon} style={{color: 'darkorange', height: "200px", width: "200px"}}/>
                    <h1 className={styles.chatEmptyStateTitle}>Authentication Not Configured</h1>
                    <h2 className={styles.chatEmptyStateSubtitle}>
                        This app does not have authentication configured. Please add an identity provider by finding your app in the 
                        <a href="https://portal.azure.com/" target="_blank"> Azure Portal </a>
                        and following 
                         <a href="https://learn.microsoft.com/en-us/azure/app-service/scenario-secure-app-authentication-app-service#3-configure-authentication-and-authorization" target="_blank"> these instructions</a>.
                    </h2>
                    <h2 className={styles.chatEmptyStateSubtitle} style={{fontSize: "20px"}}><strong>Authentication configuration takes a few minutes to apply. </strong></h2>
                    <h2 className={styles.chatEmptyStateSubtitle} style={{fontSize: "20px"}}><strong>If you deployed in the last 10 minutes, please wait and reload the page after 10 minutes.</strong></h2>
                </Stack>
            ) : (
            <div className={styles.oneshotContainer}>
                <Pivot aria-label="Pib" onLinkClick={onTabChange}>
                    <PivotItem
                        headerText="Get Data"
                        headerButtonProps={{
                        'data-order': 1,
                        }}
                    >
                            <Stack enableScopedSelectors tokens={outerStackTokens}>
                                <Stack enableScopedSelectors styles={stackItemStyles} tokens={innerStackTokens}>
                                   <Stack.Item grow={2} styles={stackItemStyles}>
                                        <div className={styles.example}>
                                            <b>CoPilot</b> 
                                            <p>
                                            This use-case shows how to build your own CoPilot using the set of Cognitive Services on Microsoft Azure.  This use-case leverages the following services:
                                            <ul>
                                                <li>
                                                    <b>Bing Search</b> - This service is used to find the latest information on the company and the key executives.
                                                </li>
                                                <li>
                                                    <b>Azure OpenAI</b> - This service is used to generate content, summarize the content and answer questions.
                                                </li>
                                                <li>
                                                    <b>Speech Services</b> - This service is used to convert the speech to text.
                                                </li>
                                                <li>
                                                    <b>Cognitive Search</b> - This service is used as Vector store to persist the information.
                                                </li>
                                                <li>
                                                    <b>Azure Functions</b> - This service is to orchestrated the entire process.
                                                </li>
                                            </ul>
                                            </p>
                                        </div>
                                    </Stack.Item>
                                    <Stack.Item grow={2} styles={stackItemStyles}>
                                        <div className={styles.example}>
                                            <p><b>Step 1 : </b> 
                                              This step focuses on extracting the company profile and the biography of the key executives. For this step
                                              we will be using the <b>Paid</b> API data services to extract the company profile for the company based on CIK.
                                              It will also find the key executives of the company. For the latest information on the biography, we will perform
                                              <b> Public</b> Internet search to find the latest information on the key executives and use GPT to summarize that information.
                                            </p>
                                        </div>
                                    </Stack.Item>
                                    <Stack.Item grow={2} styles={stackItemStyles}>
                                        <Label>Sector :</Label>
                                        &nbsp;
                                        <Dropdown
                                            selectedKey={selectedSector?.key}
                                            onChange={onSectorChange}
                                            placeholder="Select Sector"
                                            options={sectors}
                                            disabled={false}
                                            styles={dropdownShortStyles}
                                            multiSelect={false}
                                        />&nbsp;
                                        <Label>Industry :</Label>
                                        &nbsp;
                                        <Dropdown
                                            selectedKey={selectedIndustry?.key}
                                            onChange={onIndustryChange}
                                            placeholder="Select Industry"
                                            options={industries}
                                            disabled={false}
                                            styles={dropdownShortStyles}
                                            multiSelect={false}
                                        />
                                        &nbsp;
                                        <Label>Symbol :</Label>
                                        &nbsp;
                                        <Dropdown
                                            selectedKeys={selectedCompany}
                                            onChange={onCompanyChange}
                                            placeholder="Select Company"
                                            options={companies}
                                            disabled={false}
                                            styles={dropdownShortStyles}
                                            multiSelect
                                        />
                                        &nbsp;
                                        <Label>Filling Year :</Label>
                                        &nbsp;
                                        <Dropdown
                                            selectedKeys={selectedYears}
                                            onChange={onYearChange}
                                            placeholder="Select Filing Year"
                                            options={fillingsYears}
                                            disabled={false}
                                            styles={dropdownShortStyles}
                                            multiSelect
                                        />
                                        &nbsp;
                                        <Label>Report Type :</Label>
                                        &nbsp;
                                        <Dropdown
                                            selectedKeys={selectedReportType}
                                            onChange={onReportTypeChange}
                                            placeholder="Select Report Type"
                                            options={fillingReportType}
                                            disabled={false}
                                            styles={dropdownShortStyles}
                                            multiSelect
                                        />
                                        &nbsp;
                                        <PrimaryButton text="Get Data" onClick={() => processSec("1", "No", "")} disabled={isLoading || selectedCompany.length == 0 || selectedYears.length == 0 || selectedReportType.length == 0} />&nbsp;
                                        <PrimaryButton text="Reprocess" onClick={() => processSec("1", "Yes", "")} disabled={true} />
                                    </Stack.Item>
                                    {isLoading ? (
                                        <Stack.Item grow={2} styles={stackItemStyles}>
                                            <Spinner label="Processing..." ariaLive="assertive" labelPosition="right" />
                                        </Stack.Item>
                                        ) : (
                                            <div>
                                                <br/>
                                                <Stack.Item grow={2} styles={stackItemStyles}>
                                                    {secResponse}
                                                </Stack.Item>
                                            </div>
                                        )
                                    }
                                    <Stack.Item grow={2} styles={stackItemStyles}>
                                        <div className={styles.example}>
                                            <b>Optionally</b> 
                                            <p>
                                            Optionally, you can upload the PDF (10-K) report for each selected company to ingest the data into the system.  There are few limitation currently with the Crawling SEC data and uploading the PDF report works best for Compare & Contrast use-case.
                                            </p>
                                        </div>
                                    </Stack.Item>
                                    <Stack.Item grow={2} styles={stackItemStyles}>
                                        <Label>Sector :</Label>
                                        &nbsp;
                                        <Dropdown
                                            selectedKey={selectedSector?.key}
                                            onChange={onSectorChange}
                                            placeholder="Select Sector"
                                            options={sectors}
                                            disabled={false}
                                            styles={dropdownShortStyles}
                                            multiSelect={false}
                                        />&nbsp;
                                        <Label>Industry :</Label>
                                        &nbsp;
                                        <Dropdown
                                            selectedKey={selectedIndustry?.key}
                                            onChange={onIndustryChange}
                                            placeholder="Select Industry"
                                            options={industries}
                                            disabled={false}
                                            styles={dropdownShortStyles}
                                            multiSelect={false}
                                        />
                                        &nbsp;
                                        <Label>Symbol :</Label>
                                        &nbsp;
                                        <Dropdown
                                            selectedKey={selectedPdfCompany?.key}
                                            onChange={onCompanyPdfChange}
                                            placeholder="Select Company"
                                            options={companies}
                                            disabled={false}
                                            styles={dropdownShortStyles}
                                        />
                                        &nbsp;
                                        <Label>Filling Year :</Label>
                                        &nbsp;
                                        <Dropdown
                                            selectedKey={selectedPdfYears?.key}
                                            onChange={onYearPdfChange}
                                            placeholder="Select Filing Year"
                                            options={fillingsYears}
                                            disabled={false}
                                            styles={dropdownShortStyles}
                                        />
                                        &nbsp;
                                        <Label>Report Type :</Label>
                                        &nbsp;
                                        <Dropdown
                                            selectedKey={selectedPdfReportType?.key}
                                            onChange={onReportTypePdfChange}
                                            placeholder="Select Report Type"
                                            options={fillingReportType}
                                            disabled={false}
                                            styles={dropdownShortStyles}
                                        />
                                        &nbsp;
                                        <Label>Upload Password:</Label>&nbsp;
                                        <TextField onChange={onUploadPassword}
                                            errorMessage={!missingUploadPassword ? '' : "Note - Upload Password is required for Upload Functionality"}/>
                                        &nbsp;
                                        {/* <PrimaryButton text="Upload Data" onClick={() => processSec("1a", "No", "")} disabled={isLoading || !missingUploadPassword} />&nbsp; */}
                                    </Stack.Item>
                                    <Stack enableScopedSelectors tokens={outerStackTokens}>
                                        <div>
                                            <h2 className={styles.chatEmptyStateSubtitle}>Upload your 10-K PDF</h2>
                                            <h2 {...getRootProps({ className: 'dropzone' })}>
                                                <input {...getInputProps()} />
                                                    Drop PDF Document file here or click to upload. (Max file size 100 MB)
                                            </h2>
                                            {files.length ? (
                                                <Card>
                                                    {fileList}
                                                    <br/>
                                                    <CardFooter>
                                                        <DefaultButton onClick={handleRemoveAllFiles} disabled={isLoading ? true : false}>Remove All</DefaultButton>
                                                        <DefaultButton onClick={handleUploadFiles} disabled={isLoading ? true : false}>
                                                            <span>Upload File</span>
                                                        </DefaultButton>
                                                    </CardFooter>
                                                </Card>
                                            ) : null}
                                            <br/>
                                            {isLoading ? <div><span>Please wait, Uploading and Processing your file</span><Spinner/></div> : null}
                                            <hr />
                                            <h2 className={styles.chatEmptyStateSubtitle}>
                                            <TextField disabled={true} label={uploadError ? '' : uploadText} errorMessage={!uploadError ? '' : uploadText} />
                                            </h2>
                                        </div>
                                    </Stack>
                                </Stack>
                            </Stack>
                    </PivotItem>
                    <PivotItem
                        headerText="Summarization"
                        id="summarization"
                        headerButtonProps={{
                        'data-order': 2,
                        }}
                    >
                            <Stack enableScopedSelectors tokens={outerStackTokens}>
                                <Stack enableScopedSelectors styles={stackItemStyles} tokens={innerStackTokens}>
                                    <Stack.Item grow={2} styles={stackItemStyles}>
                                        <div className={styles.example}>
                                            <p><b>Step 2 : </b> 
                                              This step focuses on extracting the earning call transcripts for the company for last 3 years. For this step
                                              we will be using the <b>Paid</b> API data services to extract the quarterly call transcripts.  There are options you can take to download the 
                                              transcript from the company's website as well.   Alternatively, you can take advantage of Cognitive Speech Service to generate transcript from
                                              the audio file that will be available <b>Publicly</b> on company's website.
                                              Once the transcript is acquired, we will use GPT to answer most common questions asked during the earning call as well as summarize
                                              the key information from the earning call.
                                              Following are the common questions asked during the earning call.
                                              </p>
                                              <ul>
                                              <li>What are some of the current and looming threats to the business?</li>
                                              <li>What is the debt level or debt ratio of the company right now?</li>
                                              <li>How do you feel about the upcoming product launches or new products?</li>
                                              <li>How are you managing or investing in your human capital?</li>
                                              <li>How do you track the trends in your industry?</li>
                                              <li>Are there major slowdowns in the production of goods?</li>
                                              <li>How will you maintain or surpass this performance in the next few quarters?</li>
                                              <li>What will your market look like in five years as a result of using your product or service?</li>
                                              <li>How are you going to address the risks that will affect the long-term growth of the company?</li>
                                              <li>How is the performance this quarter going to affect the long-term goals of the company?</li>
                                              <li>Provide key information about revenue for the quarter</li>
                                              <li>Provide key information about profits and losses (P&L) for the quarter</li>
                                              <li>Provide key information about industry trends for the quarter</li>
                                              <li>Provide key information about business trends discussed on the call</li>
                                              <li>Provide key information about risk discussed on the call</li>
                                              <li>Provide key information about AI discussed on the call</li>
                                              <li>Provide any information about mergers and acquisitions (M&A) discussed on the call.</li>
                                              <li>Provide key information about guidance discussed on the call</li>
                                              </ul>
                                              Following is the summary we will generate.
                                              <ul>
                                                <li>Financial Results</li>
                                                <li>Business Highlights</li>
                                                <li>Future Outlook</li>
                                                <li>Business Risks</li>
                                                <li>Management Positive Sentiment</li>
                                                <li>Management Negative Sentiment</li>
                                                <li>Future Growth Strategies"</li>
                                              </ul>
                                        </div>
                                    </Stack.Item>
                                    <Stack.Item grow={2} styles={stackItemStyles}>
                                        &nbsp;
                                        <Label>Sector :</Label>
                                        &nbsp;
                                        <Dropdown
                                            selectedKey={selectedProcessedSector?.key}
                                            onChange={onProcessedSectorChange}
                                            placeholder="Select Sector"
                                            options={processedSectors}
                                            disabled={false}
                                            styles={dropdownShortStyles}
                                            multiSelect={false}
                                        />&nbsp;
                                        <Label>Industry :</Label>
                                        &nbsp;
                                        <Dropdown
                                            selectedKey={selectedProcessedIndustry?.key}
                                            onChange={onProcessedIndustryChange}
                                            placeholder="Select Industry"
                                            options={processedIndustries}
                                            disabled={false}
                                            styles={dropdownShortStyles}
                                            multiSelect={false}
                                        />
                                        &nbsp;
                                        <Label>Symbol :</Label>
                                        &nbsp;
                                        <Dropdown
                                            selectedKeys={selectedProcessedCompany}
                                            onChange={onProcessedCompanyChange}
                                            placeholder="Select Company"
                                            options={processedCompanies}
                                            disabled={false}
                                            styles={dropdownShortStyles}
                                            multiSelect
                                        />
                                        &nbsp;
                                        <Label>Filling Year :</Label>
                                        &nbsp;
                                        <Dropdown
                                            selectedKeys={selectedProcessedYears}
                                            onChange={onProcessedYearChange}
                                            placeholder="Select Filing Year"
                                            options={processedFilingYears}
                                            disabled={false}
                                            styles={dropdownShortStyles}
                                            multiSelect
                                        />
                                        &nbsp;
                                        <Label>Report Type :</Label>
                                        &nbsp;
                                        <Dropdown
                                            selectedKeys={selectedProcessedReportType}
                                            onChange={onProcessedReportTypeChange}
                                            placeholder="Select Report Type"
                                            options={processedFilingTypes}
                                            disabled={false}
                                            styles={dropdownShortStyles}
                                            multiSelect
                                        />                                    
                                    </Stack.Item>
                                    <Stack.Item grow={2} styles={stackItemStyles}>
                                        &nbsp;
                                        <Label>Summarization Topics</Label>
                                        &nbsp;
                                        <Dropdown
                                            selectedKeys={selectedSecSummaryTopicItem}
                                            onChange={onSecSummarizationTopicChanged}
                                            //defaultSelectedKeys={['RecursiveCharacterTextSplitter']}
                                            placeholder="Select Topic"
                                            options={secSummaryTopicOptions}
                                            disabled={false}
                                            styles={dropdownStyles}
                                            multiSelect
                                        />
                                        &nbsp;
                                        <Label>Custom Topics</Label>
                                        &nbsp;
                                        <TextField value={customTopic} onChange={onCustomTopicChange} />
                                        &nbsp;
                                        <PrimaryButton text="Summarize" onClick={() => processSec("2", "No", "")} disabled={isLoading || selectedProcessedCompany.length == 0 || selectedProcessedYears.length ==0  || selectedProcessedReportType.length == 0}/>&nbsp;
                                        {/* <PrimaryButton text="Reprocess" onClick={() => processSec("2", "Yes")} disabled={isLoading || selectedProcessedCompany.length == 0 || selectedProcessedYears.length ==0  || selectedProcessedReportType.length == 0} /> */}
                                        <PrimaryButton text="Reprocess" onClick={() => processSec("2", "Yes", "")} disabled={true} />
                                    </Stack.Item>
                                    {isLoading ? (
                                        <Stack.Item grow={2} styles={stackItemStyles}>
                                            <Spinner label="Processing..." ariaLive="assertive" labelPosition="right" />
                                        </Stack.Item>
                                        ) : (
                                        <div>
                                        <br/>
                                        <Stack enableScopedSelectors styles={stackItemCenterStyles} tokens={innerStackTokens}>
                                            <Stack.Item grow={2} styles={stackItemCenterStyles}>
                                                <DetailsList
                                                    compact={true}
                                                    items={secSummarization || []}
                                                    columns={secSummarizationColumns}
                                                    selectionMode={SelectionMode.none}
                                                    getKey={(item: any) => item.key}
                                                    selectionPreservedOnEmptyClick={true}
                                                    layoutMode={DetailsListLayoutMode.justified}
                                                    ariaLabelForSelectionColumn="Toggle selection"
                                                    checkButtonAriaLabel="select row"
                                                    />
                                            </Stack.Item>
                                        </Stack>
                                        </div>
                                    )}
                                </Stack>
                            </Stack>

                    </PivotItem>
                    <PivotItem
                        headerText="Search"
                        id="search"
                        headerButtonProps={{
                        'data-order': 3,
                        }}
                    >
                            <Stack enableScopedSelectors tokens={outerStackTokens}>
                                <Stack enableScopedSelectors styles={stackItemStyles} tokens={innerStackTokens}>
                                    <Stack.Item grow={2} styles={stackItemStyles}>
                                        <div className={styles.example}>
                                            <p><b>Step 3 : </b> 
                                              This step focuses on accessing the <b>Publicly</b> available press releases for the company.  For our use-case we are focusing on
                                              generating summary only for the latest 25 press releases.  Besides generating the summary, we are also using GPT to find 
                                              sentiment and the sentiment score for the press-releases.
                                            </p>
                                        </div>
                                    </Stack.Item>
                                    <Stack.Item grow={2} styles={stackItemStyles}>
                                        &nbsp;
                                        <Label>Symbol :</Label>
                                        &nbsp;
                                        <Dropdown
                                            selectedKeys={selectedVectoredCompany}
                                            onChange={onVectoredCompanyChange}
                                            placeholder="Select Company"
                                            options={vectoredCompanies}
                                            disabled={false}
                                            styles={dropdownShortStyles}
                                            multiSelect
                                        />
                                        &nbsp;
                                        <Label>Filling Year :</Label>
                                        &nbsp;
                                        <Dropdown
                                            selectedKeys={selectedVectoredYears}
                                            onChange={onVectoredYearChange}
                                            placeholder="Select Filing Year"
                                            options={vectoredFilingYears}
                                            disabled={false}
                                            styles={dropdownShortStyles}
                                            multiSelect
                                        />
                                        &nbsp;
                                        <Label>Report Type :</Label>
                                        &nbsp;
                                        <Dropdown
                                            selectedKeys={selectedVectoredReportType}
                                            onChange={onVectoredReportTypeChange}
                                            placeholder="Select Report Type"
                                            options={vectoredFilingTypes}
                                            disabled={false}
                                            styles={dropdownShortStyles}
                                            multiSelect
                                        />                                    
                                    </Stack.Item>
                                    <Stack.Item grow={2} styles={stackItemStyles}>
                                        <div className={styles.edgarTopSection}>
                                            <h1 className={styles.edgarTitle}>Ask your financial data</h1>
                                            <div className={styles.edgarQuestionInput}>
                                                <QuestionInput
                                                    placeholder="Ask me anything"
                                                    disabled={isLoading}
                                                    onSend={question => processSec("3", "No", question)}
                                                />
                                            </div>
                                        </div>
                                    </Stack.Item>
                                    <Stack.Item grow={2} styles={stackItemStyles}>
                                        <div className={styles.edgarBottomSection}>
                                            {isLoading && <Spinner label="Generating answer" />}
                                            {!isLoading && !error && (
                                                <div>
                                                    <div >
                                                        <DetailsList
                                                            compact={true}
                                                            items={searchItems}
                                                            columns={searchColumns}
                                                            setKey="multiple"
                                                            selectionMode={SelectionMode.none}
                                                            layoutMode={DetailsListLayoutMode.justified}
                                                            isHeaderVisible={true}
                                                            enterModalSelectionOnTouch={true}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                            {error ? (
                                                <div className={styles.edgarAnswerContainer}>
                                                    <AnswerError error={error.toString()} onRetry={() => processSec("3", "No", lastQuestionRef.current)} />
                                                </div>
                                            ) : null}
                                            {activeAnalysisPanelTab && answer && (
                                                <AnalysisPanel
                                                    className={styles.edgarAnalysisPanel}
                                                    activeCitation={activeCitation}
                                                    onActiveTabChanged={x => onToggleTab(x, 0)}
                                                    citationHeight="600px"
                                                    answer={answer}
                                                    activeTab={activeAnalysisPanelTab}
                                                />
                                            )}
                                        </div>
                                    </Stack.Item>
                                </Stack>
                            </Stack>
                    </PivotItem>
                    <PivotItem
                        headerText="Compare & Contrast"
                        id="compare"
                        headerButtonProps={{
                        'data-order': 4,
                        }}
                    >
                            <Stack enableScopedSelectors tokens={outerStackTokens}>
                                <Stack enableScopedSelectors styles={stackItemStyles} tokens={innerStackTokens}>
                                    <Stack.Item grow={2} styles={stackItemStyles}>
                                        <div className={styles.example}>
                                            <p><b>Step 4 : </b> 
                                              This step focuses on pulling the <b>Publicly</b> available 10-K annual filings for the company from the SEC Edgar website.
                                              Once the data is crawled, it is stored and persisted in the indexed Repository.  The data is then used to 
                                              generate the summary.   Summaries are generated for Item1, Item1A, Item3, Item5, Item7, Item7A and Item9 sections of the 10-K filing.
                                            </p>
                                        </div>
                                    </Stack.Item>
                                    <Stack.Item grow={2} styles={stackItemStyles}>
                                        &nbsp;
                                        <Label>Symbol :</Label>
                                        &nbsp;
                                        <Dropdown
                                            selectedKeys={selectedVectoredCompany}
                                            onChange={onVectoredCompanyChange}
                                            placeholder="Select Company"
                                            options={vectoredCompanies}
                                            disabled={false}
                                            styles={dropdownShortStyles}
                                            multiSelect
                                        />
                                        &nbsp;
                                        <Label>Filling Year :</Label>
                                        &nbsp;
                                        <Dropdown
                                            selectedKeys={selectedVectoredYears}
                                            onChange={onVectoredYearChange}
                                            placeholder="Select Filing Year"
                                            options={vectoredFilingYears}
                                            disabled={false}
                                            styles={dropdownShortStyles}
                                            multiSelect
                                        />
                                        &nbsp;
                                        <Label>Report Type :</Label>
                                        &nbsp;
                                        <Dropdown
                                            selectedKeys={selectedVectoredReportType}
                                            onChange={onVectoredReportTypeChange}
                                            placeholder="Select Report Type"
                                            options={vectoredFilingTypes}
                                            disabled={false}
                                            styles={dropdownShortStyles}
                                            multiSelect
                                        />                                    
                                    </Stack.Item>
                                    <Stack.Item grow={2} styles={stackItemStyles}>
                                        <div className={styles.edgarTopSection}>
                                            <h1 className={styles.edgarTitle}>Compare & Contrast your financial data</h1>
                                            <div className={styles.edgarQuestionInput}>
                                                <QuestionInput
                                                    placeholder="Ask me anything"
                                                    disabled={isLoading}
                                                    updateQuestion={lastQuestionRef.current}
                                                    onSend={question => processSec("4", "No", question)}
                                                />
                                            </div>
                                            {exampleLoading ? <div><span>Please wait, Generating Sample Question</span><Spinner/></div> : null}
                                            <ExampleList onExampleClicked={onExampleClicked}
                                                EXAMPLES={
                                                exampleList
                                            } />
                                        </div>
                                    </Stack.Item>
                                    <br/>
                                    <Stack.Item grow={2} styles={stackItemStyles}>
                                        <div className={styles.edgarTopSection}>
                                            {isLoading && <Spinner label="Generating answer" />}
                                            {!isLoading && (
                                                <div className={styles.edgarQuestionInput}>
                                                        <TextField
                                                            multiline
                                                            rows={17}
                                                            borderless
                                                            readOnly
                                                            value={compareAnswer}
                                                        />
                                                </div>
                                            )}
                                        </div>
                                    </Stack.Item>
                                </Stack>
                            </Stack>
                    </PivotItem>
                    <PivotItem
                        headerText="Chat Sec"
                        headerButtonProps={{
                        'data-order': 5,
                        }}
                    >
                    <div className={styles.root}>
                        <Stack enableScopedSelectors tokens={outerStackTokens}>
                                <Stack enableScopedSelectors styles={stackItemStyles} tokens={innerStackTokens}>
                                    <Stack.Item grow={2} styles={stackItemStyles}>
                                        <Label>Symbol :</Label>&nbsp;
                                        <TextField onChange={onSymbolChange}  value={symbol} disabled={true}/>
                                        <Label>Talk to Document :</Label>&nbsp;
                                        <Dropdown
                                            selectedKey={selectedDoc ? selectedDoc.key : undefined}
                                            // eslint-disable-next-line react/jsx-no-bind
                                            onChange={onDocChange}
                                            placeholder="Select an PDF"
                                            options={docOptions}
                                            styles={dropdownStyles}
                                        />
                                    </Stack.Item>
                                </Stack>
                        </Stack>
                        <br/>
                        <div className={styles.commandsContainer}>
                            <ClearChatButton className={styles.commandButton} onClick={clearChat}  text="Clear chat" disabled={!lastQuestionRef.current || isLoading} />
                        </div>
                        <div className={styles.commandsContainer}>
                            <SessionButton className={styles.commandButton} onClick={clearChat} />
                            <ClearChatButton className={styles.commandButton} onClick={deleteSession}  text="Delete Session" disabled={false} />
                            <RenameButton className={styles.commandButton}  onClick={renameSession}  text="Rename Session"/>
                            <TextField className={styles.commandButton} value={sessionName} onChange={onSessionNameChange}
                                styles={{root: {width: '200px'}}} />
                        </div>
                        <div className={styles.chatRoot}>
                            {detailsList}
                            <div className={styles.chatContainer}>
                                {!lastQuestionRef.current ? (
                                    <div className={styles.chatEmptyState}>
                                        <SparkleFilled fontSize={"30px"} primaryFill={"rgba(115, 118, 225, 1)"} aria-hidden="true" aria-label="Chat logo" />
                                        <h3 className={styles.chatEmptyStateTitle}>Chat with your Pitch Book</h3>
                                        <h4 className={styles.chatEmptyStateSubtitle}>Ask anything on {symbol} from {selectedDoc ? selectedDoc.text : ''}</h4>
                                        <div className={styles.chatInput}>
                                            <QuestionInput
                                                clearOnSend
                                                placeholder="Type a new question"
                                                disabled={isLoading}
                                                onSend={question => makeApiRequest(question)}
                                            />
                                        </div>                                        
                                    </div>
                                ) : (
                                    <div className={styles.chatMessageStream}>
                                        {answers.map((answer, index) => (
                                            <div key={index}>
                                                <UserChatMessage message={answer[0]} />
                                                <div className={styles.chatMessageGpt}>
                                                    <Answer
                                                        key={index}
                                                        answer={answer[1]}
                                                        isSpeaking = {runningIndex === index}
                                                        isSelected={selectedAnswer === index && activeAnalysisPanelTab !== undefined}
                                                        onCitationClicked={c => onShowCitation(c, index)}
                                                        onThoughtProcessClicked={() => onToggleTab(AnalysisPanelTabs.ThoughtProcessTab, index)}
                                                        onSupportingContentClicked={() => onToggleTab(AnalysisPanelTabs.SupportingContentTab, index)}
                                                        onFollowupQuestionClicked={q => makeApiRequest(q)}
                                                        onSpeechSynthesisClicked={() => startOrStopSynthesis("gpt35", answer[2], index)}
                                                        showFollowupQuestions={true}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                        {isLoading && (
                                            <>
                                                <UserChatMessage message={lastQuestionRef.current} />
                                                <div className={styles.chatMessageGptMinWidth}>
                                                    <AnswerLoading />
                                                </div>
                                            </>
                                        )}
                                        {error ? (
                                            <>
                                                <UserChatMessage message={lastQuestionRef.current} />
                                                <div className={styles.chatMessageGptMinWidth}>
                                                    <AnswerError error={error.toString()} onRetry={() => makeApiRequest(lastQuestionRef.current)} />
                                                </div>
                                            </>
                                        ) : null}
                                        <div ref={chatMessageStreamEnd} />
                                        <div className={styles.chatInput}>
                                            <QuestionInput
                                                clearOnSend
                                                placeholder="Type a new question"
                                                disabled={isLoading}
                                                onSend={question => makeApiRequest(question)}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {answers.length > 0 && activeAnalysisPanelTab && (
                                <AnalysisPanel
                                    className={styles.chatAnalysisPanel}
                                    activeCitation={activeCitation}
                                    onActiveTabChanged={x => onToggleTab(x, selectedAnswer)}
                                    citationHeight="810px"
                                    answer={answers[selectedAnswer][1]}
                                    activeTab={activeAnalysisPanelTab}
                                />
                            )}

                            {/* <div>
                                <DefaultButton onClick={refreshBlob}>Refresh Docs</DefaultButton>
                                <Dropdown
                                    selectedKey={selectedItem ? selectedItem.key : undefined}
                                    // eslint-disable-next-line react/jsx-no-bind
                                    onChange={onChange}
                                    placeholder="Select an PDF"
                                    options={options}
                                    styles={dropdownStyles}
                                />
                                &nbsp;
                            </div> */}
                        </div>
                    </div>

                    </PivotItem>
                </Pivot>
            </div>
            )}
        </div>
    );
};

export default Sec;