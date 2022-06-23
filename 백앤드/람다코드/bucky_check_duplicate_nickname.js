const jwt = require('jsonwebtoken');
const mysql = require("mysql2/promise");


//connecting to RDS
const connectionPromise = mysql.createConnection({
                host: "buckydatabase.c7ozy5epcsbh.ap-northeast-2.rds.amazonaws.com",
                user: "admin",
                password: "Insukkim!6810",
                database: "buckyDatabase",
            });
            
//response msgs
const usableNicknameMsg = "the nickname is usable.";                           //0
const duplicateNicknameMsg = "the nickname is already in use.";                //1

exports.handler = async (event) => {
    console.log(event);
    var nickname = event.nickname;
    
    
    // TODO implement
    var response = {
        statusCode : 200,
        body:{
            status: "0",
            msg: usableNicknameMsg
        }
        
    };
    
    if(nickname == null || nickname === "")
    {
       response = duplicateNicknameResponse(response);
    }
    
    if(nickname === undefined)
    {
        response = duplicateNicknameResponse(response);
        return response;
    }
    
    
    // TODO implement
    try
    {
        
        let connection = await connectionPromise;
        
        //check if there is the nickname in RDS
        var res = await connection.query("SELECT email FROM users WHERE nickname= ?", [nickname]);
        var querResultNickname = res[0][0];
        console.log(nickname + " : resulted query: " + querResultNickname);
    
        if(querResultNickname !== undefined)
        {
            response = duplicateNicknameResponse(response);
        }
    
    }
    catch(e)
    {
        //server-side error
        response.statusCode = 500;
        console.log(e);
    }
    
    response = formatResponse(response);    
    return response;
};

function formatResponse(response)
{
    response.body = JSON.stringify(response.body);
    return response;
}

function duplicateNicknameResponse(response)
{
    response.body.status = "1";
    response.body.msg = duplicateNicknameMsg;
    return response;
}