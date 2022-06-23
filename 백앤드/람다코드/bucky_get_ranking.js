const AWS = require('aws-sdk');
const jwt = require('jsonwebtoken');
const mysql = require("mysql2/promise");

//create connection for rds
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
const AGGREGATE_POINT_TABLE_NAME = "aggregate_point_table";        
        
//response msg
const SUCCESS_MSG = "successfully got user ranking";              //0
const FAIL_MSG = "sending user ranking failed";                    //1

exports.handler = async (event) => {
    // TODO implement
    var response = {
        statusCode: 200,
        body: {
            status: "0",
            msg: SUCCESS_MSG
        }
    };
    
    console.log("event:");
    console.log(event);
    
    const email = getEmail(event.authorization);
    
    console.log("email: ");
    console.log(email);
    
    var conn;
    try
    {
        conn = await connectionPromise;
        
        const promList = [];
        promList.push(getUsersAndPointFromDynamo(conn));
        promList.push(getMyInfo(conn, email));
        
        const res = await Promise.all(promList);
        response.body.ranking = res[0];
        response.body.myinfo = res[1];
        
        console.log(res);
    }
    catch(e)
    {
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

async function getMyInfo(RDSConnection, email)
{
    const queryCommand = `SELECT nickname, profilePicturePath FROM users WHERE email = ?`;
    var res = await RDSConnection.query(queryCommand, [email]);
    
     return {
         nickname: res[0][0].nickname,
         profilePicturePath: res[0][0].profilePicturePath
     };
}

//get nickname for users in ranking 50
async function getNicknamesForUsers(RDSConnection, users)
{
    const emailList = [];
    
    for(var user of users)
    {
        emailList.push(user.email);
    }
    
    const queryCommand = createQueryCommand(users);
    var res = await RDSConnection.query(queryCommand, emailList);

   
    
    res = res[0];
    
    console.log("queried result from rds");
    console.log(res);
    
    const tempDict = {};
    
    for(var re of res)
    {
        tempDict[`${re.email}`] = {
            "nickname": re.nickname,
            "profilePicturePath": re.profilePicturePath
        };
    }
    
   
    
    for(var user of users)
    {

        if(tempDict[`${user.email}`] === undefined || tempDict[`${user.email}`] === null )
        {
            continue;
        }
        
        user.nickname = tempDict[`${user.email}`].nickname;
        
        user.profilePicturePath = tempDict[`${user.email}`].profilePicturePath;
            
    }
    
    return users;
}

function createQueryCommand(users){
    var queryCommand = "SELECT profilePicturePath, email, nickname FROM users WHERE email IN (";
    
    for(var user of users)
    {
        queryCommand +=  "? ,";
    }
    
    queryCommand = queryCommand.substring(0, queryCommand.length - 1);
    queryCommand += ')';
    
    console.log("query command for RDS");
    console.log(queryCommand);
    
    return queryCommand;
}

//get users sorted by points------------------------------------
async function getUsersAndPointFromDynamo(RDSConnection)
{
    var params = {
        TableName: AGGREGATE_POINT_TABLE_NAME
    };
    
    var res = await DOC_CLIENT.scan(params).promise();
    res = res.Items;
    
    res.sort(function(e1, e2){
        return e2.point - e1.point;
    });
    
    if(res.length > 50)
    {
        res = res.slice(0, 50);
    }
    
    res = getNicknamesForUsers(RDSConnection, res);
    
    return res;
    
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