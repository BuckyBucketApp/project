const AWS = require('aws-sdk');
const parser = require('lambda-multipart-parser');
const mysql = require("mysql2/promise");
const jwt = require('jsonwebtoken');
 
//configuring for s3 bucket
const S3 = new AWS.S3();
const BUCKET_PARAMS = {
        Bucket: `buckybucket2022`,
        ACL:'public-read'
        };

//set necessary variable for bucket upload
const VERIFICATION_FOLDER = "verifyRequest/";
const BUCKET_PATH = "https://buckybucket2022.s3.ap-northeast-2.amazonaws.com/";


//connecting to RDS
var connectionPromise = mysql.createConnection({
                host: "buckydatabase.c7ozy5epcsbh.ap-northeast-2.rds.amazonaws.com",
                user: "admin",
                password: "Insukkim!6810",
                database: "buckyDatabase",
            });
            


const SUCCESS_MSG = "successfully requested verification";         //0
const FAIL_MSG = "verification request failed";                    //1

exports.handler = async (event) => {
    // TODO implement
    var response = {
        statusCode: 200,
        body: {
            status: "0",
            msg: SUCCESS_MSG
        }
    };
    
    const parsedResult = await parser.parse(event);
    
    console.log(parsedResult);
    var file = parsedResult.files[0];
    
    const email = getEmail(event.headers.Authorization);
    var verificationRequest ={};
    verificationRequest.bucketId = parseInt(parsedResult.bucketId);
    verificationRequest.content = parsedResult.content;
    
    
    var connection;
    
    
    try{
       
        var promiseList = [];
        
        const timeStampForKeyName = Date.now().toString();
        
        connection = await connectionPromise;
        connection.beginTransaction();
        if(isNaN(verificationRequest.bucketId))
        {
            throw "bucket id not specified";
        }
        
        await checkIfCanSendRequest(connection, verificationRequest.bucketId, email);
        
        //get url for the picture
        var pictPath = BUCKET_PATH + getKeyNameForFile(VERIFICATION_FOLDER, verificationRequest.bucketId, file, timeStampForKeyName);
        
        
        promiseList.push(verifyRequest(connection, verificationRequest.bucketId, verificationRequest.content, pictPath));
        promiseList.push(putObjectToS3(verificationRequest.bucketId, file, timeStampForKeyName));
        
        const res = await Promise.all(promiseList);
        
        verificationRequest.pictPath = BUCKET_PATH +  res[1];
        
        response.body.verification_request= verificationRequest;
        
        connection.commit();
     
     
    }
    catch(e)
    {
        console.log(e);
        connection.rollback();
        
        response = failResponse(response);
        
        connection.close();
        connectionPromise = mysql.createConnection({
                host: "buckydatabase.c7ozy5epcsbh.ap-northeast-2.rds.amazonaws.com",
                user: "admin",
                password: "Insukkim!6810",
                database: "buckyDatabase",
            });
    }
    
    
    
    return formatResponseBody(response);
};

//check if user is allowed to modify bucket
//if not modifiable throw error!
async function checkIfCanSendRequest(connection, bucketId, owner)
{
    const queryCommand = "SELECT owner, achievedDate FROM bucketList WHERE bucketId = ?";
    var queryResult = await connection.query(queryCommand, bucketId);
    const queryOwner = queryResult[0][0].owner;
    const queryAchievedDate = queryResult[0][0].achievedDate;
    
    console.log('query owner: ' + queryOwner + " owner: " + owner);
    if(owner !== queryOwner || queryAchievedDate !== null)
    {
        throw "cannot send request";
    }

}

//upload picture to S3------------------------------
//return name of the file
async function putObjectToS3(bucketId ,file, timeStampForKeyName)
{
    
    var data = file.content
    
    console.log("will upload: " + data);
    //get binary data of file
    BUCKET_PARAMS.Body = data;
    //get file type from file
    BUCKET_PARAMS.Key = getKeyNameForFile(VERIFICATION_FOLDER, bucketId, file, timeStampForKeyName);
    await S3.putObject(BUCKET_PARAMS).promise();
    
    return BUCKET_PARAMS.Key;
}

//get key name for the file to be stored in s3
function getKeyNameForFile(bucketProfileFolder, bucketId, file, timeStampForKeyName)
{
    return bucketProfileFolder + bucketId +"/" + timeStampForKeyName  + "." + getFileTypeFromFile(file);
}

//get file type from file
function getFileTypeFromFile(file)
{
    //return file.contentType.split("/")[1];
    return 'jpg';
}


//insert new bucket to RDS ------------------------------------------------
//return bucketId
async function verifyRequest(RDSconnection, bucketId, content, verifyRequestPicts ){
    const verifyRequestCommand = "INSERT INTO verifyRequest(bucketId, content, verifyRequestPicts) VALUES(?, ?, ?)";
    return RDSconnection.query(verifyRequestCommand, [bucketId, content, verifyRequestPicts]);
    
}


//stringify response body before return ---------------------------------------------
function formatResponseBody(response)
{
    response.body = JSON.stringify(response.body);
    return response;
}

//change response
function failResponse(response)
{
    response.body.status = "1";
    response.body.msg = FAIL_MSG;
    return response;
}


//get email from token
function getEmail(token)
{
    var payload = jwt.decode(token);
    
    return payload.emailAddress;
}




