const mysql = require("mysql2/promise");
const jwt = require('jsonwebtoken');

//connecting to RDS
const connectionPromise = mysql.createConnection({
                host: "buckydatabase.c7ozy5epcsbh.ap-northeast-2.rds.amazonaws.com",
                user: "admin",
                password: "Insukkim!6810",
                database: "buckyDatabase",
            });
            


const SUCCESS_MSG = "successfully pressed heart";         //0
const FAIL_MSG = "press heart failed";                    //1


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
    const bucketId = event.bucketId;
    
    var connection; 
    
    try
    {
        connection = await connectionPromise;
        connection.beginTransaction();
        
        await pressHeart(connection, email, bucketId);
        
        connection.commit();
    }
    catch(e)
    {
        connection.rollback();
        console.log(e);
        response = failResponse(response);
    }
    
    response = formatResponseBody(response);
    return response;
};


async function pressHeart(RDSConnection, email, bucketId)
{
    const pressHeartCommand = `INSERT INTO bucketListHeart(email, bucketId) VALUES (?, ?);`
    
    return await RDSConnection.query(pressHeartCommand, [email, bucketId]);

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