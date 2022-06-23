const jwt = require('jsonwebtoken');
const mysql = require("mysql2/promise");


//create connection for rds
const connectionPromise = mysql.createConnection({
                host: "buckydatabase.c7ozy5epcsbh.ap-northeast-2.rds.amazonaws.com",
                user: "admin",
                password: "Insukkim!6810",
                database: "buckyDatabase",
            });


//response msgs
const successMsg = "successfully got user info";        //0
const FailMsg = "failed to get user info";              //1


exports.handler = async (event) => {
    // TODO implement
    var response = {
        statusCode: 200,
        body: {
            "msg": successMsg,
            "status": "0"
        }
        
    };
    
    console.log("event");
    console.log(event);
    
    const email = getEmail(event.authorization);
    
    console.log("email: ");
    console.log(email);
    
    var conn;
    try{
        conn = await connectionPromise;
        var res = await getUserDetail(conn, email);
        
        console.log("queried data:");
        console.log(res);
        
        response.body.user = res;
    }
    catch(e)
    {
        console.log(e);
        response = FailResponse(response);
    }
    
    response = formatResponse(response);
    
    console.log("response data:");
    console.log(response);
    
    return response;
};

function formatResponse(response)
{
    response.body = JSON.stringify(response.body);
    return response;
}

//modify response
function FailResponse(response)
{
    response.body.status = "1";
    response.body.msg = FailMsg;
    return response;
}

//get email from token
function getEmail(token)
{
    var payload = jwt.decode(token);
    
    return payload.emailAddress;
}

async function getUserDetail(RDSConnection , email)
{
    const queryCommand = `SELECT email, nickname, profilePicturePath, GROUP_CONCAT(tag SEPARATOR ',') as tags
FROM users natural join userInterestTags
WHERE email = ?`
        
    var res = await RDSConnection.query(queryCommand, email);
    
    res = res[0][0];
    if(res.tags !== undefined)
    {
        res.tags = res.tags.split(',');
    }
    
    return res;
}