const AWS = require('aws-sdk');
const mysql = require("mysql2/promise");
const jwt = require('jsonwebtoken');

//create connection for rds
const connectionPromise = mysql.createConnection({
                host: "buckydatabase.c7ozy5epcsbh.ap-northeast-2.rds.amazonaws.com",
                user: "admin",
                password: "Insukkim!6810",
                database: "buckyDatabase",
            });

//response msgs
const SUCCESS_MSG = "heart search successful";        //0
const FAIL_MSG = "heart search failed";               //1


exports.handler = async (event) => {
    // TODO implement
    var response = {
        statusCode: 200,
        body: {
            status: "0",
            msg: SUCCESS_MSG
        }
    };
    
    const email = getEmail(event.authorization);
    
    var connection;
    
    try
    {
        
        connection = await connectionPromise;
        
        var res = await getHeartBucketList(connection, email);
        response.body.bucketLists = res;
        console.log(res);
    }
    catch(e)
    {
        console.log(e);
        response = failResponse(response);
    }
    
    
    response = formatResponseBody(response);
    return response;
};

//get bucketList that user hearted!
async function getHeartBucketList(RDSConnection, email)
{
    const getHeartBucketListCommand = `SELECT bucketList.bucketId as bucketId, title, profilePict, 1 as heart, (CASE 
        WHEN writtenDate is null THEN 0
        ELSE 1 END) as achieved
        FROM bucketList left outer join review on bucketList.bucketId = review.bucketId
        WHERE isVisible = 1 AND bucketList.bucketId IN (SELECT bucketId FROM bucketListHeart WHERE email = ? );`
        
    var res = await RDSConnection.query(getHeartBucketListCommand, email);
    
    return res[0];
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



