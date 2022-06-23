const AWS = require('aws-sdk');
const parser = require('lambda-multipart-parser');
const jwt = require('jsonwebtoken');
const mysql = require("mysql2/promise");
const axios = require('axios');

const DOC_CLIENT = new AWS.DynamoDB.DocumentClient();

//configuring for s3 bucket
const s3 = new AWS.S3();
const bucketParams = {
        Bucket: `buckybucket2022`,
        ACL:'public-read'
        };
        
const BUCKT_PICT_FOLDER = "achieve/";

const BUCKET_KEYWORDS = "bucket_keywords";

//create connection for rds
var connectionPromise = mysql.createConnection({
                host: "buckydatabase.c7ozy5epcsbh.ap-northeast-2.rds.amazonaws.com",
                user: "admin",
                password: "Insukkim!6810",
                database: "buckyDatabase",
            });

//response msgs
const SUCCESS_MSG = "autenticate successful";        //0
const FAIL_MSG = "authenticate failed";               //1


exports.handler = async (event) => {
    var response = {
        statusCode: 200,
        body: {
            status: "0",
            msg: SUCCESS_MSG
        }
    };
    
    
    const parsedResult = await parser.parse(event);
 
    console.log(event);
    
    var file = parsedResult.files[0];
    const bucketId = parseInt(parsedResult.bucketId);
    const email = getEmail(event.headers.Authorization);
    
    const data = file.content.toString('base64');
    
     const sendData = 
    {
        "requests":
        [
            {
                "image":
                {
                    "content": data
                },
                "features":
                [
                    {
                        "type":"LABEL_DETECTION",
                        "maxResults":100
                    }
                ]
            }
        ]
    };
    
    var conn;
    
    try{
        
        conn = await connectionPromise;
        var achievable = await checkAchievable(conn, bucketId, email);
        
        if(!achievable)
        {
            throw "another owner";
        }
        
        const analysis = await getLabels(sendData);
        
        var keywords = new Set(await getKeywords(bucketId));
        console.log("keywords:");
        console.log(keywords);
        
        var successFlag = false;
        
        for(var anal of analysis)
        {
            if(keywords.has(anal))
            {
                successFlag = true;
                break;
            }
        }
        
        if(successFlag)
        {
            console.log("success!");
            bucketParams.Key = getKeyNameForFile(BUCKT_PICT_FOLDER, bucketId, file);
            await putObjectToS3(s3, bucketParams, file);
        }
        else{
            response = failResponse(response);
            console.log("fail");
        }
        
    }
    catch(e)
    {
        console.log(e);
        response = failResponse(response);
        conn.close();
        connectionPromise = mysql.createConnection({
                host: "buckydatabase.c7ozy5epcsbh.ap-northeast-2.rds.amazonaws.com",
                user: "admin",
                password: "Insukkim!6810",
                database: "buckyDatabase",
            });
    }
    
    response = formatResponseBody(response);
    return response;
};


async function checkAchievable(RDSConnection, bucketId, email)
{
    const selectCommand = "SELECT COUNT(*) as count, achievedDate FROM bucketList WHERE bucketId = ? AND owner = ?";
    var res = await RDSConnection.query(selectCommand, [bucketId, email]);
    const achievedDate = res[0][0].achievedDate;
    const count = parseInt(res[0][0].count);
    
    console.log("achievedDate: " + achievedDate);
    console.log("count: " + count);
    
    if(count === 0 || achievedDate !== null)
    {
        return false;
    }
    else 
    {
        return true;
    }
}


async function getLabels(sendData)
{
  const aProm = new Promise(function (resolve){
    axios
    .post('https://vision.googleapis.com/v1/images:annotate?key=', sendData)
    .then(res => {
      console.log(`statusCode: ${res.status}`);
      console.log("res : ");
      resolve(res);
    })
    .catch(error => {
      console.error(error);
      console.log("error msg: " + error.message);
      console.log("error request: " + error.request);
    });
  } );

  var res = await aProm;
  var labels = res.data.responses;
  
  const retList = [];
  
  for(var label of labels[0].labelAnnotations)
  {
      retList.push(label.description.toLowerCase());
  }
  
  console.log("picture keywords");
  console.log(retList);
  return retList;
}

async function getKeywords(bucketId)
{
    var params = {
        TableName: BUCKET_KEYWORDS,
        Key: {
            "bucketId": bucketId
        }
    };
    
    var res = await DOC_CLIENT.get(params).promise();
    return res.Item.keywords;
}

async function putObjectToS3(s3, bucketPar, file)
{
    
    var data = file.content;
    
 
    //get binary data of file
    bucketPar.Body = data;
    //get file type from file
    bucketPar.Key = bucketPar.Key;
    
    return s3.putObject(bucketPar).promise();
}

function getFileTypeFromFile(file)
{
    const temp = file.filename.split(".")
    //return temp[temp.length - 1 ];
    return "jpg";
}

function getKeyNameForFile(profilePictureFolder, bucketId, file)
{
    return profilePictureFolder + bucketId +  "." + getFileTypeFromFile(file) ;
}

//get email from token
function getEmail(token)
{
    var payload = jwt.decode(token);
    
    return payload.emailAddress;
}

function failResponse(response)
{
    response.body.status = "1";
    response.body.msg = FAIL_MSG;
    return response;
}

//stringify response body before return
function formatResponseBody(response)
{
    response.body = JSON.stringify(response.body);
    return response;
}