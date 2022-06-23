const AWS = require('aws-sdk');
const mysql = require("mysql2/promise");
const jwt = require('jsonwebtoken');
 
//configuring for s3 bucket
const S3 = new AWS.S3();

        
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


const SUCCESS_MSG = "successfully deleted Bucket";         //0
const FAIL_MSG = "bucket delete failed";                    //1

exports.handler = async (event) => {
    console.log("event:");
    console.log(event);
    // TODO implement
    var response = {
        statusCode: 200,
        body: {
            status: "0",
            msg: SUCCESS_MSG
        }
    };
    
    
    const email = getEmail(event.authorization);
    var bucketId = parseInt(event.bucketId);
    
    var connection;
    
    
    try{
        var promiseList = [];
    
        connection = await connectionPromise;
        const profilePict = await checkIfDeletable(connection, bucketId, email);
        
        console.log("profilePict: " + profilePict);
        
        if(profilePict !== null && profilePict !== undefined )
        {
            let key = profilePict.substring(BUCKET_PATH.length);
            console.log(key);
            promiseList.push(deleteObjectS3(bucketId, key));
            
            
        }
        connection.beginTransaction();
     
        
        promiseList.push(deleteItemDynamo(bucketId));
        const res = await Promise.all(promiseList);
        await deleteBucketInRDS(connection, bucketId);
        
        //file이 undefined가 아니면 picture upload!
        
        
        
        
        
        
        
        console.log(res);
        
        
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
//return profilePict if modifiable
async function checkIfDeletable(connection, bucketId, owner)
{
    const queryCommand = "SELECT owner, achievedDate, profilePict FROM bucketList WHERE bucketId = ?";
    var queryResult = await connection.query(queryCommand, bucketId);
    
    console.log("checkIfDeletable: ");
    console.log(queryResult);
    
    const queryOwner = queryResult[0][0].owner;
    const queryAchievedDate = queryResult[0][0].achievedDate;
    const profilePict = queryResult[0][0].profilePict;
    
    console.log('query owner: ' + queryOwner + " owner: " + owner);
    if(owner !== queryOwner || queryAchievedDate !== null)
    {
        throw "cannot delete!";
    }
    
    return profilePict;

}
//check the file and if exist delete!
async function deleteObjectS3(bucketId, key)
{
    console.log("started to delte s3 picture object");
    //list bucket first to get exact key
   
    //delete based on key
    DELETE_BUCKET_PARAMS.Key = key
    
    var res =  await S3.deleteObject(DELETE_BUCKET_PARAMS).promise();
    
    console.log("delete s3 msgs:");
    console.log(res);
}




//insert content of bucket to DynamoDB-------------------------------------
async function deleteItemDynamo(bucketId, content)
{
    console.log("started to delete bucket content in dynamodb");
    var params = {
        TableName: TABLE_NAME,
        Key: {
        'bucketId': bucketId.toString()
        }
    };
    
    
    return DOC_CLIENT.delete(params).promise();
}


//insert new bucket to RDS ------------------------------------------------
//return bucketId
async function deleteBucketInRDS(RDSconnection, bucketId ){
    const deleteBucketCommand = "DELETE FROM bucketList WHERE bucketId = ?";
    
    return RDSconnection.query(deleteBucketCommand, bucketId);
    

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