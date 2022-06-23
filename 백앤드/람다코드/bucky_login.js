const jwt = require('jsonwebtoken');
const mysql = require("mysql2/promise");


//create connection for rds
var connectionPromise = mysql.createConnection({
                host: "buckydatabase.c7ozy5epcsbh.ap-northeast-2.rds.amazonaws.com",
                user: "admin",
                password: "Insukkim!6810",
                database: "buckyDatabase",
            });

//expiring time for the token.            
const expiringSeconds = 300000;

//response msgs
const successMsg = "login successful";        //0
const notFoundMsg = "user not found";         //1

//handler function
exports.handler = async (event) => {
    console.log(event);
    
    var email = event.email;
    var password = event.pswd;
    
    var response = {
        statusCode: 200,
        body:{
            status: "0",
            msg:successMsg,
            token: null
        }
    };
    
    var connection;
    // TODO implement
    try
    {
        connection = await connectionPromise;
        
        //check if there is a matching credentials in RDS
        var queryResult = await connection.query("SELECT email FROM users WHERE email=? AND password=?", [email, password]);
        var resultEmail = queryResult[0][0];
        console.log(email + ": resulted query is " + resultEmail);
    
        //if not matching
        if(resultEmail === undefined)
        {
            response = notFoundResponse(response);
        }
        //if matching, generate token
        else
        {
            var token = generateToken(email);
        
            response.body.token = token;
            console.log("generatedToken: " + token);
        }
    }
    catch(e)
    {
        //if error occurred, mark it as server-side error
        response.statusCode = 500;
        console.log(email + " : " +  e);
        connection.close();
        connectionPromise = mysql.createConnection({
                host: "buckydatabase.c7ozy5epcsbh.ap-northeast-2.rds.amazonaws.com",
                user: "admin",
                password: "Insukkim!6810",
                database: "buckyDatabase",
            });
        
    }
    

    response = formatResponse(response);
    console.log("response is : " + response.toString());
    
    return response;
};


function formatResponse(response)
{
    response.body = JSON.stringify(response.body);
    return response;
}

//modify response
function notFoundResponse(response)
{
    response.body.status = "1";
    response.body.msg = notFoundMsg;
    response.body.token = null;
    return response;
}

//generate token and store email address of user in the token!
function generateToken(email)
{
    
    const secretKey = "my_secret_key";
    
    const header = {
      algorithm : "HS256",
      expiresIn: expiringSeconds
    };
    
    var token = jwt.sign({emailAddress:email}, secretKey, header);
    
    
    return token;
}

