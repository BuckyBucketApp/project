const AWS = require('aws-sdk');
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
            


const SUCCESS_MSG = "successfully deleted verifyRequest";         //0
const FAIL_MSG = "deleting verification request failed";                    //1

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
    
    
  
    
    const email = getEmail(event.authorization);
    const bucketId = event.bucketId;
    const requestDate = formatRequestDate(event.requestDate);
    
    var connection;
    
    
    try{
       
        var promiseList = [];
        
        connection = await connectionPromise;
        connection.beginTransaction();
        
        await checkIfCanDeleteVerifyRequest(connection, bucketId, email);
        
        var retList = await getVerifyRequestPictPath(connection, bucketId, requestDate);
        
        console.log("picture paths: ");
        console.log(retList);
        
        if(retList !== null){
        for(var pict of retList)
            {
            
            let key = pict.substring(BUCKET_PATH.length);
            promiseList.push(deleteObjectS3(bucketId, key));
            }
        }
        promiseList.push(deleteVerifyRequest(connection, bucketId, requestDate));
        
        await Promise.all(promiseList);
        
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

function formatRequestDate(requestDate)
{
    var datePart = requestDate.substring(0, 10);
    var timePart = requestDate.substring(11, 19);
    
    var comp = datePart + " " + timePart;
    
    console.log("after format requestDate: " + comp);
    return comp;
}

//check if user is allowed to delete verifyRequest
//if not deletable throw error!
async function checkIfCanDeleteVerifyRequest(connection, bucketId, owner)
{
    const queryCommand = "SELECT owner FROM bucketList WHERE bucketId = ?";
    var queryResult = await connection.query(queryCommand, bucketId);
    const queryOwner = queryResult[0][0].owner;
    
    console.log('query owner: ' + queryOwner + " owner: " + owner);
    if(owner !== queryOwner)
    {
        throw "cannot delete verify request";
    }

}

//delete bucket
async function deleteObjectS3(bucketId, key)
{
    const DELETE_BUCKET_PARAMS = {
        Bucket: 'buckybucket2022'
    }
    
    console.log("started to delete s3 picture object with key " + key);
   
    //delete based on key
    DELETE_BUCKET_PARAMS.Key = key
    
    var res =  await S3.deleteObject(DELETE_BUCKET_PARAMS).promise();
    
    console.log("delete s3 msgs:");
    console.log(res);
}

//insert new bucket to RDS ------------------------------------------------
//return bucketId
async function deleteVerifyRequest(RDSconnection, bucketId, requestDate){
    const deleteCommand = `DELETE FROM verifyRequest WHERE bucketId = ? AND requestDate = ?`;
    console.log("delete command: " + deleteCommand);
    
    await RDSconnection.query(deleteCommand, [bucketId, requestDate]);
    console.log("delete verifyRequest succeeded!");
    
}

async function getVerifyRequestPictPath(RDSconnection, bucketId, requestDate)
{
    const queryCommand = `SELECT verifyRequestPicts FROM verifyRequest WHERE bucketId = ? AND requestDate = ?`;
    
    console.log("query command: " + queryCommand);
    
    var res = await RDSconnection.query(queryCommand, [bucketId, requestDate]);
    console.log(res);
    
    res = res[0][0].verifyRequestPicts;
    console.log(res);
    
    if(res === null )
    {
        return null;
    }
    return res.split(',');
    
    
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




