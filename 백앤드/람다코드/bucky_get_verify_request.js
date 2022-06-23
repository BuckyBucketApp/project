const jwt = require('jsonwebtoken');
const mysql = require("mysql2/promise");


//create connection for rds
var connectionPromise = mysql.createConnection({
                host: "buckydatabase.c7ozy5epcsbh.ap-northeast-2.rds.amazonaws.com",
                user: "admin",
                password: "Insukkim!6810",
                database: "buckyDatabase",
            });


//response msgs
const successMsg = "successfully got verifyRequests";        //0
const FailMsg = "failed to get verifyRequests";              //1


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
        response.body.verifyRequests = await getVerifyRequests(conn, email);
        
    }
    catch(e)
    {
        console.log(e);
        response = FailResponse(response);
        conn.close();
        connectionPromise = mysql.createConnection({
                host: "buckydatabase.c7ozy5epcsbh.ap-northeast-2.rds.amazonaws.com",
                user: "admin",
                password: "Insukkim!6810",
                database: "buckyDatabase",
            });
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

async function getVerifyRequests(RDSConnection, email)
{
    const queryCommand = `SELECT bucketId, title, requestDate, content, state, verifyRequestPicts
FROM bucketList natural join verifyRequest WHERE bucketList.owner = ? ORDER BY requestDate DESC`;
    
    var res = await RDSConnection.query(queryCommand ,email);
    
    res = res[0];
    
    for(var temp of res)
    {
        if(temp.verifyRequestPicts !== undefined && temp.verifyRequestPicts !== null)
        {
            temp.verifyRequestPicts = temp.verifyRequestPicts.split(',');
        }
    }
    
    console.log("queried result: ");
    console.log(res);
    
    return res;
    
}