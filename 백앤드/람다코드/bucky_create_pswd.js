const mysql = require("mysql2/promise");
const AWS = require("aws-sdk");

//connecting for DynamoDB
AWS.config.update(
    {
        region: "ap-northeast-2",
        endpoint: "dynamodb.ap-northeast-2.amazonaws.com"
    });

const docClient = new AWS.DynamoDB.DocumentClient();

//table name for DynamoDB
const tableName = "ps_email_verification";

//connecting to RDS
const connectionPromise = mysql.createConnection({
                host: "buckydatabase.c7ozy5epcsbh.ap-northeast-2.rds.amazonaws.com",
                user: "admin",
                password: "Insukkim!6810",
                database: "buckyDatabase",
            });
            

const createdPswdMsg = "successfully created pswd";       //0
const unverifiedMsg = "the email is not verified";        //1
const notSendCodeMsg = "code was not sent to the email";  //2
const wrongCodeMsg = "code is not correct";               //3
exports.handler = async (event) => {
    
    const email = event.email;
    const code = event.code.toString();
    const password = event.pswd;
    
    // TODO implement
    var response = {
        statusCode: 200,
        body: {
            status: "0",
            msg: createdPswdMsg
        }
    };
    
    var connection;
    try{
        //returns email, code, timestamp
        var dynamoResult = await getItem(email);
        
        //the email is not in dynamoDB or expired
        if(dynamoResult === undefined || dynamoResult === null || dynamoResult.state === undefined || isExpired(dynamoResult.timestamp))
        {
            console.log(email + " : code was not sent or expired");
            response = notSendCodeResponse(response);
        }
        //email was not verified
        else if(dynamoResult.state !== 1)
        {
            console.log(email + " : code not verified");
            response = unverifiedResponse(response);
        }
        //the code is not matching
        else if(dynamoResult.code !== code)
        {
            console.log(email + " : code not matched");
            response = wrongCodeResponse(response);
        }
        //ready to update pswd
        else
        {
            try
            {
                console.log(  email + " : successfully update pswd")
                connection = await connectionPromise;
                await connection.beginTransaction()
                
                //update password in RDS
                var queryResult = await connection.query("UPDATE users SET password = ? WHERE email = ?", [password ,email]);
                console.log("update result: " + queryResult);
                
                connection.commit();
            }
            catch(e)
            {
                //when error while updating database
                connection.rollback();
                response.statusCode = 500;
                console.log("error occurred while updating database");
                console.log(e);
            }
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

//modify response msg
function unverifiedResponse(response)
{
    response.body.status = "1";
    response.body.msg = unverifiedMsg;
    return response;
}

function notSendCodeResponse(response)
{
    response.body.status = "2";
    response.body.msg = notSendCodeMsg;
    return response;
}

function wrongCodeResponse(response)
{
    response.body.status = "3";
    response.body.msg = wrongCodeMsg;
    return response;
}

//getItem from dynamoDB
async function getItem(email)
{
    var params = {
        TableName: tableName,
        Key: {
            email: email
        }
    };
    
    var res = await docClient.get(params).promise();
   
    return  res.Item;
}


//check if took too long to change the pswd
function isExpired(sentTime)
{
    const current_in_min = Math.ceil( Date.now() / 1000);
    
    if((current_in_min > sentTime))
    {
        return true;
    }
    else
    {
        return false;
    }
}

function getExpiringTimestamp()
{
    return (Math.floor(Date.now() / 1000) + 180 );
}
