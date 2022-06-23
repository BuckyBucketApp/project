const jwt = require('jsonwebtoken');
const mysql = require("mysql2/promise");

//connecting to RDS
const connectionPromise = mysql.createConnection({
                host: "buckydatabase.c7ozy5epcsbh.ap-northeast-2.rds.amazonaws.com",
                user: "admin",
                password: "Insukkim!6810",
                database: "buckyDatabase",
            });
    
const usableEmailMsg = "the email is usable";                                  //0
const duplicateEmailMsg = "the email is already in use";                       //1

exports.handler = async (event) => {
    var email = event.email;
    // TODO implement
    var response = {
        statusCode : 200,
        body:{
            status: "0",
            msg:usableEmailMsg 
        }
    };
    
    
    // TODO implement
    try{
        
    let connection = await connectionPromise;
     
     //check if there is a duplicate email in rds   
    var res = await connection.query("SELECT email FROM users WHERE email= ?", [email]);
    var queryResultEmail = res[0][0];
    console.log(email + " : queryResultEmail :  " + queryResultEmail);
    
        if(queryResultEmail !== undefined)
        {
            response = duplicateEmailResponse(response);
        }
  
    
    }
    catch(e)
    {
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

function duplicateEmailResponse(response)
{
    response.body.status = "1";
    response.body.msg = duplicateEmailMsg;
    return response;
}