const nodemailer = require('nodemailer');
const mysql = require("mysql2/promise");
const AWS = require("aws-sdk");

//connecting for DynamoDB
AWS.config.update(
    {
        region: "ap-northeast-2",
        endpoint: "dynamodb.ap-northeast-2.amazonaws.com"
    });

const docClient = new AWS.DynamoDB.DocumentClient();

//connecting to RDS
const connectionPromise = mysql.createConnection({
                host: "buckydatabase.c7ozy5epcsbh.ap-northeast-2.rds.amazonaws.com",
                user: "admin",
                password: "Insukkim!6810",
                database: "buckyDatabase",
            });

//messages to send
const successMsg = "successfully sent verification code.";                     //0
const notRegisteredMsg = "email is not registered";                            //1
const errorSendingMSg = "error while sending code";                            

//tableName for DynamoDB
const tableName = "ps_email_verification";

exports.handler = async (event) => {
    
    
    var response = {
        statusCode: 200,
        body: {
            status:"0",                                        //0 -> success, 1-> email not registered, 2-> error while sending code
            msg: successMsg
        }
    };
    
    var email = event.email;
    
    var connection;
    try{
        
        
        connection = await connectionPromise;
        var queryResult = await connection.query("SELECT email FROM users WHERE email = ?", [email]);
        //get the result of the query
        queryResult = queryResult[0];
        
        //if queryResult.length is 0, the mail is not registered!, else it is registered!
        if(queryResult.length === 0)
        {
            response = notRegisteredEmailResponse(response);
            console.log(email + " not in database");
        }
        else{
            //if mail is registered, send code and record them into DynamoDB
        
            //generate four randmo numbers
            var code = generateFourRand();
            
            //send mail and put items in dynamoDB at the same time
            var mailPromise = sendMail(code, email);
            var putItemPromise = recordSentCode(email, code); 
        
            
            var res = await Promise.all([mailPromise, putItemPromise ]);
            console.log("successfully send code to email: " + email + " with code: " + code);
        }
        
       

    }
    catch(e)
    {
        response = sendCodeErrorResponse(response);
        console.log(e);
    }
    
    

    response = formatResponse(response);    
    //response = stringifyResponse(response);
    
    return response;
};

//-----------------------------------------------

function formatResponse(response)
{
    response.body = JSON.stringify(response.body);
    return response;
}

function notRegisteredEmailResponse(response)
{
    response.body.status = "1";
    response.body.msg = notRegisteredMsg;
    return response;
}

function sendCodeErrorResponse(response)
{
    response.body.status = "2";
    response.body.msg = errorSendingMSg;
    return response;
}

function stringifyResponse(response)
{
    response.body = JSON.stringify(response.body);
    
    return response;
}

async function sendMail(code, reciever )
{
    var transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'buckybucket2022@gmail.com',
            pass: 'Insukkim!6810'
        }
    });

    var mailOptions = {
        from: 'buckybucket2022@gmail.com',
        to: reciever,
        subject: '인증번호 발송',
        text: '인증번호는 ' + code + " 입니다."
    };

    return transporter.sendMail(mailOptions );
}

function generateFourRand()
{
    var randNumb = "";
    for(var index = 0; index < 4; index++ )
    {
        randNumb = randNumb + Math.floor(Math.random() * 9);
    }
    
    return randNumb
}

//record that the email was sent!
async function recordSentCode(email, code)
{
    return putItem(email, code, 0);
}

async function putItem(email, code, state)
{
     var params = {
        TableName: tableName,
        Item:{
            email:email,
            code: code,
            state: state, 
            timestamp:(Math.floor(Date.now() / 1000 ) + 180)
        }  
    };
    
    return docClient.put(params).promise();
}