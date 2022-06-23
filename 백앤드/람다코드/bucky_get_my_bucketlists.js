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
            
const SUCCESS_MSG = "successfully get my bucketLists";               //0
const FAIL_MSG = "getting my bucketLists failed";                    //1


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
    
    var conn;
    try
    {
          conn = await connectionPromise;
          var res = await getListOfbucketList(conn, email);
          response.body.bucketLists = res;
          console.log(res);
    }
    catch(e)
    {
        console.log("error type is: ");
        console.log(typeof e );
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

async function getListOfbucketList(conn, email)
{
    const searchCommand = `SELECT bucketList.bucketId as bucketId, title, profilePict, (CASE 
        WHEN writtenDate is null THEN 0
        ELSE 1 END) as achieved
        FROM bucketList left outer join review on bucketList.bucketId = review.bucketId
        WHERE owner = '${email}' 
        ORDER BY createdDate DESC`;
        
    var res = await conn.query(searchCommand);
    
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
