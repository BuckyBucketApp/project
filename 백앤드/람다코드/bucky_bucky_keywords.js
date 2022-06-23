const language = require('@google-cloud/language');
const mysql = require("mysql2/promise");
const {TranslationServiceClient} = require('@google-cloud/translate');
const AWS = require('aws-sdk');

const WordNet = require("node-wordnet");
const wordNet = new WordNet();

//connecting to RDS
const connectionPromise = mysql.createConnection({
                host: "buckydatabase.c7ozy5epcsbh.ap-northeast-2.rds.amazonaws.com",
                user: "admin",
                password: "Insukkim!6810",
                database: "buckyDatabase",
            });
            
const CREDENTIALS = JSON.parse(JSON.stringify({ }));
  
const CONFIG = {
      credentials: {
          private_key: CREDENTIALS.private_key,
          client_email: CREDENTIALS.client_email
      }
  };
  
const CLIENT = new language.LanguageServiceClient(CONFIG);

  

  const CONTENT_DOCUMENT = {
    type: 'PLAIN_TEXT',
  };
  
  const TITLE_DOCUMENT = {
    type: 'PLAIN_TEXT',
  };
  
exports.handler = async (event) => {
    const newItem = event.Records[0].dynamodb.NewImage;
    console.log(newItem);
    
    
    const content = newItem.content.S;
    const bucketId = parseInt(newItem.bucketId.S);
    
    // TODO implement
    const response = {
        statusCode: 200,
        body: JSON.stringify('Hello from Lambda!'),
    };
    
    try{
        
        
        var connection = await connectionPromise;
        
        //translate bucketTitle, content to English
        var title = await getBucketTitle(connection, bucketId);
        //console.log(res);
        var translated = await translateText(content, title);
        console.log("translated: " + translated.toString());
        
        
        
        //get Keywords of translated bucket content to English
        const promiseList = [];
        CONTENT_DOCUMENT.content = translated[1];
        promiseList.push(getKeywords(CLIENT, CONTENT_DOCUMENT));
        
        
        TITLE_DOCUMENT.content = translated[0];
        promiseList.push(getKeywords(CLIENT, TITLE_DOCUMENT));
    
        //get keywords from google NLP
        const res = await Promise.all(promiseList);
        console.log("Content KeyWord: " + res[0].toString());
        console.log("Title Keyword: " + res[1].toString());
        
        //Merge all keywords from google NLP into a single list
        const totalKeywords = res[0].concat(res[1]);
       
        
        const insertKeywords = await getAllSynymsForAllWords(totalKeywords);
         console.log("Set: " + insertKeywords.toString());
        
        
        await insertKeywordToDynamo(bucketId, insertKeywords);
        //console.log(res);
    }
    catch(e)
    {
        console.log(e);    
    }
    
    return response;
};

async function getBucketTitle(RDSConnection, bucketId){
    const queryCommand = `SELECT title FROM bucketList WHERE bucketId = ?`;
    var res = await RDSConnection.query(queryCommand, bucketId);
    
    return res[0][0].title;
}

async function getKeywords(CLIENT, DOCUMENT)
{
    const [result] = await CLIENT.analyzeEntities({document: DOCUMENT});
    
    const retList = [];
    
    for(var entity of result.entities)
    {
        retList.push(entity.name);
    }
    
    return retList;
}

async function translateText(content, title) {
    // Instantiates a client
    const translationClient = new TranslationServiceClient(CONFIG);

    const projectId = 'sendemail-345213';
    const location = 'global';
    // Construct request
    const request = {
        parent: `projects/${projectId}/locations/${location}`,
        contents: [title, content],
        mimeType: 'text/plain', // mime types: text/plain, text/html
        sourceLanguageCode: 'ko',
        targetLanguageCode: 'en',
    };

    // Run request
    const [response] = await translationClient.translateText(request);
    const retList = [response.translations[0].translatedText, response.translations[1].translatedText];
    return retList;
}

//insert content of bucket to DynamoDB-------------------------------------
async function insertKeywordToDynamo(bucketId, keywords)
{
    const TABLE_NAME = "bucket_keywords";
    const DOC_CLIENT = new AWS.DynamoDB.DocumentClient();
    
    var params = {
        TableName: TABLE_NAME,
        Item:{
            bucketId: bucketId,
            keywords: keywords
        }  
    };
    
    return DOC_CLIENT.put(params).promise();
}

//get all Synoynms for words
async function getSynonyms(word)
{
    var lookUpPromise = new Promise((resolve, reject) => {
        resolve();
    })
    var results;
    
    const aProm = new Promise(resolve => {
        wordNet.lookup(word, (result) =>{
            resolve(result);
        })
    });

    var results = await aProm;

    console.log("finish lookup");

    const aSet = new Set();

    for(var result of results)
    {
      
        for(var synonym of result.synonyms){
            
            aSet.add(synonym);   
        }
         
    }

    return Array.from(aSet);
}

async function getAllSynonyms(word)
{
    var promList = [];
    const wordList = word.split(" ");
    for(var word of wordList)
    {
        promList.push(getSynonyms(word));
    }

    var resultLists = await Promise.all(promList);

    var totalList = [];

    for(var result of resultLists)
    {
        result.forEach(element => totalList.push(element));    
    }
    
    return totalList;
}

async function getAllSynymsForAllWords(wordList)
{
    var promList = [];
    
    for(var word of wordList)
    {
        promList.push(getAllSynonyms(word));
    }
    
    var resultLists = await Promise.all(promList);
    
    var totalList = [];
    
    for (var result of resultLists)
    {
        result.forEach(element => totalList.push(element));
    }
    
    return totalList;
}
