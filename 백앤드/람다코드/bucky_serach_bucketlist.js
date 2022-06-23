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
const connectionPromise = mysql.createConnection({
                host: "buckydatabase.c7ozy5epcsbh.ap-northeast-2.rds.amazonaws.com",
                user: "admin",
                password: "Insukkim!6810",
                database: "buckyDatabase",
            });
            
const SUCCESS_MSG = "successfully get list of bucketLists";               //0
const FAIL_MSG = "getting list of bucketList failed";                    //1


exports.handler = async (event) => {
    // TODO implement
    var response = {
        statusCode: 200,
        body: {
            status: "0",
            msg: SUCCESS_MSG
        }
    };
    
    const keyword = event.keyword;
    const email = getEmail(event.authorization);
    
    
    try
    {
          const conn = await connectionPromise;
          var res = await getListOfbucketList(conn, keyword, email);
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

async function getListOfbucketList(conn, keyword, email)
{
    const searchCommand = `SELECT bucketId, title, profilePict, (SELECT count(*) FROM bucketListHeart WHERE bucketId = bucketList.bucketId AND email = '${email}') as heart 
        FROM bucketList
        WHERE isVisible = 1 AND owner != '${email}' AND (bucketTags REGEXP '${keyword}' OR title REGEXP '${keyword}' )
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

