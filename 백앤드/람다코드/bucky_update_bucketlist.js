const AWS = require('aws-sdk');
const parser = require('lambda-multipart-parser');
const mysql = require("mysql2/promise");
const jwt = require('jsonwebtoken');
 
//configuring for s3 bucket
const S3 = new AWS.S3();
const CREATE_BUCKET_PARAMS = {
        Bucket: `buckybucket2022`,
        ACL:'public-read'
        };
        
const DELETE_BUCKET_PARAMS = {
        Bucket: 'buckybucket2022'
}

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


const SUCCESS_MSG = "successfully updated Bucket";         //0
const FAIL_MSG = "bucket update failed";                    //1

exports.handler = async (event) => {
    // TODO implement
    
    console.log(event);
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
    
    
    var bucket = {};
    
    const agent = event.headers["User-Agent"];
    
    console.log("parsedResult:");
    console.log(parsedResult);
    
    if(agent != undefined && agent.split('/')[0] === "okhttp")
    {
            parsedResult.title = JSON.parse(parsedResult.title);
            parsedResult.content = JSON.parse(parsedResult.content);
            parsedResult.isVisible = parseInt(parsedResult.isVisible);
            console.log("before parsing tags: " + parsedResult.tags);
            console.log("before parsing detailPlans: " + parsedResult.detailPlans);
            parsedResult.tags = JSON.parse(parsedResult.tags);
            parsedResult.detailPlans = JSON.parse(parsedResult.detailPlans);
            
    }
    
    console.log(parsedResult);
    
    const email = getEmail(event.headers.Authorization);
    bucket.bucketId = parsedResult.bucketId;
    bucket.title = parsedResult.title;
    bucket.content = parsedResult.content;
    bucket.isVisible = parsedResult.isVisible;
    bucket.tags = convertStringTagsToList(parsedResult.tags);
    bucket.detailPlans = JSON.parse(parsedResult.detailPlans);
    bucket.profilePict = null;
    

    console.log("parsed:")
    console.log(bucket);
    

    
    var connection;
    
    
    try{
        var promiseList = [];
    
        connection = await connectionPromise;
        await checkIfModifiable(connection, bucket.bucketId, email);
        
        connection.beginTransaction();
        const keyToDelete = await getProfilPictKey(connection, bucket.bucketId);
        
        const fileKey = getKeyNameForFile(BUCKET_PROFILE_FOLDER, bucket.bucketId, file);
        bucket.profilePict = BUCKET_PATH + fileKey; 
        promiseList = await updateBucketInRDS(connection, bucket.bucketId, bucket.title,  bucket.isVisible ,bucket.tags, bucket.detailPlans, bucket.profilePict );
            
       
        
        const dynamoPromise = insertContentToDynamo(bucket.bucketId, bucket.content);
        
        promiseList.push(dynamoPromise);
        promiseList.push(deleteObjectS3(keyToDelete));
        
        //file이 undefined가 아니면 picture upload!
        
        await Promise.all(promiseList);
        if(file != undefined)
        {
            await putObjectToS3(bucket.bucketId, file, fileKey);
            
        }
        
        
        const res = await Promise.all(promiseList);
        
       
        
        console.log(res);
        
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

//check if user is allowed to modify bucket
//if not modifiable throw error!
async function checkIfModifiable(connection, bucketId, owner)
{
    const queryCommand = "SELECT owner, achievedDate FROM bucketList WHERE bucketId = ?";
    var queryResult = await connection.query(queryCommand, bucketId);
    console.log(queryResult);
    const queryOwner = queryResult[0][0].owner;
    const queryAchievedDate = queryResult[0][0].achievedDate;
    
    console.log('query owner: ' + queryOwner + " owner: " + owner);
    if(owner !== queryOwner || queryAchievedDate !== null)
    {
        throw "cannot modify!";
    }
    
    
    
}
//check the file and if exist delete!
async function deleteObjectS3(bucketKey)
{
    
    DELETE_BUCKET_PARAMS.Key = bucketKey;
    
    return await S3.deleteObject(DELETE_BUCKET_PARAMS).promise();

}

async function getProfilPictKey(RDSconnection, bucketId)
{
    const queryCommand = `SELECT profilePict FROM bucketList WHERE bucketId = ?`;
    var res = await RDSconnection.query(queryCommand, [bucketId]);
    res = res[0][0].profilePict;
    
    return res.substring(BUCKET_PATH.length);
}

//upload picture to S3------------------------------
//return name of the file
async function putObjectToS3(bucketId ,file, fileKey)
{
    
    var data = file.content
    
    console.log("s3 params:")
    
    //get binary data of file
    CREATE_BUCKET_PARAMS.Body = data;
    //get file type from file
    CREATE_BUCKET_PARAMS.Key = fileKey;
    
    console.log(CREATE_BUCKET_PARAMS);
    
    await S3.putObject(CREATE_BUCKET_PARAMS).promise();
    
    return CREATE_BUCKET_PARAMS.Key;
}


//get key name for the file to be stored in s3
function getKeyNameForFile(bucketProfileFolder, bucketId, file)
{
    return bucketProfileFolder + bucketId +  "." + getFileTypeFromFile(file);
}

//get file type from file
function getFileTypeFromFile(file)
{
   // return file.contentType.split("/")[1];
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
async function updateBucketInRDS(RDSconnection, bucketId, title,  isVisible ,tags, detailPlans, profilePict ){
    var deletePromiseList = [];
    var createPromiseList = [];
    const updateBucketListCommand = "UPDATE bucketList SET title = ?, isVisible = ?, bucketTags = ?, profilePict = ? WHERE bucketId = ?";
    const deleteDetailPlansCommand = "DELETE FROM detailPlan WHERE bucketId = ?";
    
    const createDetailPlanCommand = createCommandForInsertIntoDetailPlan(detailPlans, bucketId);
    
    deletePromiseList.push( RDSconnection.query(updateBucketListCommand, [title, isVisible, tags.toString(),profilePict, bucketId]));
    deletePromiseList.push(RDSconnection.query(deleteDetailPlansCommand, [bucketId]));
    
    await Promise.all(deletePromiseList);
    
    console.log("done deleting in rds");
    
    createPromiseList.push(RDSconnection.query(createDetailPlanCommand));
    
    return createPromiseList;
    
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