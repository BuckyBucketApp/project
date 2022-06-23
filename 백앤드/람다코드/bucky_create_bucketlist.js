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
const BUCKET_PROFILE_FOLDER = "bucketProfile/";
const BUCKET_PATH = "https://buckybucket2022.s3.ap-northeast-2.amazonaws.com/";


//connecting to RDS
const connectionPromise = mysql.createConnection({
                host: "buckydatabase.c7ozy5epcsbh.ap-northeast-2.rds.amazonaws.com",
                user: "admin",
                password: "Insukkim!6810",
                database: "buckyDatabase",
            });
            
//connecting for DynamoDB
AWS.config.update(
    {
        region: "ap-northeast-2",
        endpoint: "dynamodb.ap-northeast-2.amazonaws.com"
    });

const DOC_CLIENT = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = "bucket_content";


const SUCCESS_MSG = "successfully created Bucket";         //0
const FAIL_MSG = "bucket creation failed";                    //1



exports.handler = async (event) => {
    // TODO implement
    var response = {
        statusCode: 200,
        body: {
            status: "0",
            msg: SUCCESS_MSG
        }
    };
    
    console.log(event);
    const parsedResult = await parser.parse(event);
    
    var file = parsedResult.files[0];
   
    const agent = event.headers["User-Agent"];
    
    if(agent != undefined && agent.split('/')[0] === "okhttp")
    {
            parsedResult.title = JSON.parse(parsedResult.title);
            parsedResult.content = JSON.parse(parsedResult.content);
            parsedResult.isVisible = parseInt(parsedResult.isVisible);
            parsedResult.startDate = JSON.parse(parsedResult.startDate);
            parsedResult.endDate = JSON.parse(parsedResult.endDate);
            console.log("before parsing tags: " + parsedResult.tags);
            console.log("before parsing detailPlans: " + parsedResult.detailPlans);
            parsedResult.tags = JSON.parse(parsedResult.tags);
            parsedResult.detailPlans = JSON.parse(parsedResult.detailPlans);
            
    }
    
    var bucket = {};
    
    console.log("token: " + event.headers.Authorization);
    
    bucket.title = parsedResult.title;
    bucket.content = parsedResult.content;
    bucket.isVisible = parsedResult.isVisible;
    bucket.startDate = parsedResult.startDate;
    bucket.endDate = parsedResult.endDate;
    bucket.tags = convertStringTagsToList(parsedResult.tags);
    bucket.detailPlans = JSON.parse(parsedResult.detailPlans);
    
    bucket.profilePict = null;
    
    console.log("parsedResult: ");
    console.log(bucket);
    const email = getEmail(event.headers.Authorization);
    
    var connection;
    
    
    try{
        var promiseList = [];
    
        connection = await connectionPromise;
        connection.beginTransaction();
     
        var bucketId = await insertNewBucketToRDS(connection, email, bucket.title, bucket.startDate, bucket.endDate, 
            bucket.isVisible, bucket.tags, bucket.detailPlans);
            
    
        
        const dynamoPromise = insertContentToDynamo(bucketId, bucket.content);
        
        if(file != undefined)
        {
            const s3Promise = putObjectToS3(bucketId, file);
            promiseList.push(s3Promise);
            
            
        }
        
        promiseList.push(dynamoPromise);
        
        bucket.bucketId = bucketId;
        const res = await Promise.all(promiseList);
        
        if(file != undefined)
        {
            bucket.profilePict = BUCKET_PATH + res[0];
            await insertUrlRDS(connection,bucketId, bucket.profilePict );
        }
        
        //returns newly created bucket
        response.body.bucketList = bucket;
        
        connection.commit();
     
     
    }
    catch(e)
    {
        connection.rollback();
        console.log(e);
        response = failResponse(response);
    }
    
    
    
    return formatResponseBody(response);
};


//upload picture to S3------------------------------
//return name of the file
async function putObjectToS3(bucketId ,file)
{
    
    var data = file.content
    
    console.log("will upload: " + data);
    //get binary data of file
    BUCKET_PARAMS.Body = data;
    //get file type from file
    BUCKET_PARAMS.Key = getKeyNameForFile(BUCKET_PROFILE_FOLDER, bucketId, file);
    await S3.putObject(BUCKET_PARAMS).promise();
    
    return BUCKET_PARAMS.Key;
}

//get key name for the file to be stored in s3
function getKeyNameForFile(bucketProfileFolder, bucketId, file)
{
    return bucketProfileFolder + bucketId +  "." + getFileTypeFromFile(file);
}

//get file type from file
function getFileTypeFromFile(file)
{
    //return file.contentType.split("/")[1];
    return 'jpg';
}


//insert content of bucket to DynamoDB-------------------------------------
async function insertContentToDynamo(bucketId, content)
{
    var params = {
        TableName: TABLE_NAME,
        Item:{
            bucketId: bucketId.toString(),
            content: content
        }  
    };
    
    return DOC_CLIENT.put(params).promise();
}


//insert new bucket to RDS ------------------------------------------------
//return bucketId
async function insertNewBucketToRDS(RDSconnection, owner, title, startDate, endDate, isVisible ,tags, detailPlans ){
    const insertIntoBucketListCommand = "INSERT INTO bucketList(owner, title, startDate, endDate, isVisible, bucketTags) VALUES(?, ?, ?, ?, ?, ?)";
    var insertIntoDetailPlanCommand;
    var insertIntoBucketTagsCommand;
    const getLastInsertIdCommand = "SELECT LAST_INSERT_ID()";
    var promiseList = [];
    
    var bucketId;
    
    await RDSconnection.query(insertIntoBucketListCommand, [owner, title, startDate, endDate, isVisible, tags.toString()]);
    
    
    //get lastId of bucketId
    bucketId = await RDSconnection.query(getLastInsertIdCommand);
    bucketId = bucketId[0][0]['LAST_INSERT_ID()'];
    
    //create command for inserting data into detailPlan
    
    insertIntoDetailPlanCommand = createCommandForInsertIntoDetailPlan(detailPlans, bucketId);
    
    await RDSconnection.query(insertIntoDetailPlanCommand);
    
    return bucketId;
    
}


function createCommandForInsertIntoDetailPlan(detailPlans, bucketId)
{
    var insertIntoDetailPlanCommand = "INSERT INTO detailPlan(bucketId, orderNumb, content, planDate) VALUES "
    
    var tempDetailPlan;
    for(var index = 0; index < detailPlans.length - 1; index++)
    {
        tempDetailPlan = detailPlans[index];
        insertIntoDetailPlanCommand += `(${bucketId}, \'${tempDetailPlan.orderNumb} \', \'${tempDetailPlan.content}\', \'${tempDetailPlan.planDate} \'  ), `;
    }
    
    if(detailPlans.length > 0)
    {
        tempDetailPlan = detailPlans[detailPlans.length - 1];
        insertIntoDetailPlanCommand += `(${bucketId}, \'${tempDetailPlan.orderNumb} \', \'${tempDetailPlan.content}\', \'${tempDetailPlan.planDate} \'  ) `;
    }
    
    return insertIntoDetailPlanCommand;
}


async function insertUrlRDS(RDSconnection, bucketId, profilePict)
{
    const updateStatement = "UPDATE bucketList set profilePict = ? WHERE bucketId = ?";
    
    return RDSconnection.query(updateStatement, [profilePict, bucketId]);
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
    console.log("payload: " + payload);
    return payload.emailAddress;
}




function convertStringTagsToList(strTags)
{
    const truncatedTags = strTags.substring(1, strTags.length - 1);
    
    const truncatedList = truncatedTags.split(",");
    console.log("truncatedList: " + truncatedList);
    
    const retList = [];
    
    for(var tag of truncatedList)
    {
        retList.push(tag.substring(1, tag.length -1 ));
    }
    
    return retList;
}