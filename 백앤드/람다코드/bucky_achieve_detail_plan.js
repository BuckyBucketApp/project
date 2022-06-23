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
const SUCCESS_MSG = "update detailPlan successful";        //0
const FAIL_MSG = "update detailPlan failed";               //1

exports.handler = async (event) => {
    
    const email = getEmail(event.authorization);
    
    console.log(event);
    
    
    
 // TODO implement
    var response = {
        statusCode: 200,
        body: {
            status: "0",
            msg: SUCCESS_MSG
        }
    };
    
    var connection;

    try
    {
        const bucketId = parseInt(event.bucketId);
        const orderNumb = parseInt(event.orderNumb);
        const achieved = parseInt(event.achieved);
        
        
        connection = await connectionPromise;
        connection.beginTransaction();
        
        var isChangable = await checkIfChangeable(connection, email, bucketId);
        
        if(isChangable)
        {
            await chageDetailPlan(connection, bucketId, orderNumb,achieved);
        }
        
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

async function checkIfChangeable(RDSConnection, email, bucketId)
{
    const queryCommand = `SELECT owner, achievedDate FROM bucketList WHERE bucketId = ?`;
    const res = await RDSConnection.query(queryCommand, [bucketId]);
    let owner = res[0][0].owner;
    let achievedDate = res[0][0].achievedDate;
    
    var ret; 
    
    console.log("checkIfChangeable query result: ");
    console.log(res);
    if(owner !== email || (achievedDate !== null && achievedDate !== undefined))
    {
        
        ret = false;
    }
    
    ret = true;
    
    console.log("checkIfChangeable result: ")
    console.log(ret);
    
    return ret;
}

async function chageDetailPlan(RDSConnection, bucketId, orderNumb, achieved)
{
    const updateCommand = `UPDATE detailPlan SET achieved = ? WHERE bucketId = ? AND orderNumb = ?`;
    await RDSConnection.query(updateCommand, [achieved, bucketId, orderNumb]);
    
}
//stringify response body before return
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

