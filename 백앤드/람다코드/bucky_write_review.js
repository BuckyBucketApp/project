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
const REVIEW_FOLDER = "review/";
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
const REVIEW_TABLE_NAME = "bucket_content";
const POINT_TABLE_NAME = "point_table";

const SUCCESS_MSG = "successfully write review";         //0
const FAIL_MSG = "writing review failed";                    //1

//set timezone for lambda
process.env.TZ = 'Asia/Seoul';

exports.handler = async (event) => {
    // TODO implement
    
    console.log(event.body);
    var response = {
        statusCode: 200,
        body: {
            status: "0",
            msg: SUCCESS_MSG
        }
    };
    
    
    const parsedResult = await parser.parse(event);
    
    const agent = event.headers["User-Agent"];
    
    if(agent != undefined && agent.split('/')[0] === "okhttp")
    {
        parsedResult.content = JSON.parse(parsedResult.content);
            
    }
    
    const email = getEmail(event.headers.Authorization);
    const review = {};
    const files = parsedResult.files;
    review.picts = [];
    review.content = parsedResult.content;
    review.bucketId = parsedResult.bucketId;
    
    console.log(review);

    
    var connection;
    
    
    try{
        var promiseList = [];
    
        connection = await connectionPromise;
        connection.beginTransaction();
        
        const rangeInDays = await checkIfCanWriteReview(connection, review.bucketId, email );
        console.log("rangeInDays: " + rangeInDays);
        const point = insertPoint(rangeInDays);
        
        //get paths to pictures for review
        var pathStrings = [];
        for(var index = 1; index <= files.length; index++)
        {
            pathStrings.push(BUCKET_PATH + getKeyNameForFile(REVIEW_FOLDER + review.bucketId + "/", index, files[index - 1]));
        }
        review.picts = pathStrings
        const title = await getTitle(connection, review.bucketId);
        
        promiseList.push(writeReviewInRDS(connection, review.bucketId, pathStrings.toString()));
        promiseList.push(updateReviewDynamo(review.bucketId, review.content));
        promiseList.push(addPointDynamo(review.bucketId, email, point, title));
        
        
        
        
        for(var index = 1; index <= files.length; index++)
        {
            const ind = index;
            promiseList.push(
                putObjectToS3(review.bucketId, files[ind - 1], ind)
            );
        }
        
        await Promise.all(promiseList);
        
        response.body.review = review;
        
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


function insertPoint(rangeInDays)
{
    if(rangeInDays > 365)
    {
        return 4000;
    }
    else if(rangeInDays > 182)
    {
        return 2000;
    }
    else if( rangeInDays > 90)
    {
        return 1000;
    }
    else if( rangeInDays > 30)
    {
        return 500;
    }
    else if( rangeInDays > 7)
    {
        return 250;
    }
    else{
        return 100;
    }
}
//check if user is allowed to write review
//if not modifiable throw error!
async function checkIfCanWriteReview(connection, bucketId, owner)
{
    const queryCommand = "SELECT owner, startDate, achievedDate FROM bucketList WHERE bucketId = ?";
    var queryResult = await connection.query(queryCommand, bucketId);
    const queryOwner = queryResult[0][0].owner;
    const queryAchievedDate = queryResult[0][0].achievedDate;
    const queryStartDate = queryResult[0][0].startDate;
    
    console.log(queryAchievedDate);
    console.log(queryStartDate);
    
    const startDate = new Date(queryStartDate);
    const achievedDate = new Date(queryAchievedDate);
    
    console.log('query owner: ' + queryOwner + " owner: " + owner);
    if(owner !== queryOwner || queryAchievedDate == null)
    {
        throw "cannot write review";
    }
    
    return Math.floor((achievedDate - startDate) / (1000 * 60 * 60 * 24) );
    
    
}

//get title of the bucketlist
async function getTitle(RDSconnection, bucketId)
{
    const queryCommand = `SELECT title FROM bucketList WHERE bucketId = ?`;
    var res = await RDSconnection.query(queryCommand, [bucketId]);
    res = res[0][0].title;
    
    return res;
}

//upload picture to S3------------------------------
//return name of the file
async function putObjectToS3(bucketId ,file, orderNumb)
{
    
    var data = file.content
    
    //get binary data of file
    CREATE_BUCKET_PARAMS.Body = data;
    //get file type from file
    CREATE_BUCKET_PARAMS.Key = getKeyNameForFile(REVIEW_FOLDER + bucketId + "/", orderNumb, file);
    await S3.putObject(CREATE_BUCKET_PARAMS).promise();
    
    return CREATE_BUCKET_PARAMS.Key;
}

//get key name for the file to be stored in s3
function getKeyNameForFile(folder, fileName, file)
{
    return folder  + fileName +"." + getFileTypeFromFile(file);
}

//get file type from file
function getFileTypeFromFile(file)
{
    //return file.contentType.split("/")[1];

    return 'jpg';
}


//insert review content in DynamoDB-------------------------------------
async function updateReviewDynamo(bucketId, content)
{
    var params = {
        TableName: REVIEW_TABLE_NAME,
        Key:{
            "bucketId": bucketId.toString()
        },
        UpdateExpression: "set reviewContent = :val",
        ExpressionAttributeValues:{
            ":val": content
        }
    };
    
    return DOC_CLIENT.update(params).promise();
}

//add point to user
async function addPointDynamo(bucketId, email, point, title)
{
    var temp = new Date().getTime();
    var formatDate = new Date(temp).toLocaleString("en-US", {
        "TimeZone": "Asia/Seoul"
    });
   
    
    var params = {
        TableName: POINT_TABLE_NAME,
        Item:{
            email: email,
            earnedTime: Math.floor(Date.now()/ 1000),
            point: point,
            source: "review",
            formatTime: formatDate,
            bucketId: bucketId,
            title: title
            
            
        }
    }    
    
    return DOC_CLIENT.put(params).promise();
}

//insert new bucket to RDS ------------------------------------------------
//return bucketId
async function writeReviewInRDS(RDSconnection, bucketId, reviewPaths){
    const insertReviewCommand = "INSERT INTO review(bucketId, reviewPaths) VALUES(?, ?)";

    return RDSconnection.query(insertReviewCommand, [bucketId, reviewPaths]);
    
}


async function addUrlRDS(RDSconnection,listOfURL, bucketId)
{
    var insertCommand = "INSERT INTO reviewPict(bucketId, reviewPict) VALUES ";
    
    for(var index = 0; index < listOfURL.length - 1; index++)
    {
        insertCommand += `(${bucketId}, '${listOfURL[index]}' ) ,`;
    }
    
    if(listOfURL.length > 0)
    {
        insertCommand += `(${bucketId}, '${listOfURL[listOfURL.length - 1]}' ) `;
    }
    
    return RDSconnection.query(insertCommand);
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