const AWS = require("aws-sdk");


AWS.config.update(
    {
        region: "ap-northeast-2",
        endpoint: "dynamodb.ap-northeast-2.amazonaws.com"
    });

const docClient = new AWS.DynamoDB.DocumentClient();

//dynamoDB table name
const tableName = "ps_email_verification";

//Msgs to send to client
const verifiedMsg = "the code is successfully verfied";      //0
const wrongCodeMsg = "the code is wrong";                    //1
const emailNotFoundMsg = "did not send code to the email";   //2

exports.handler = async (event) => {
    
    var response = {
        statusCode: 200,
        body: {
            status:"0",
            msg:verifiedMsg
        },
    };
    
    const email = event.email;
    const code = event.code.toString();
    
    try{
        
        var queryResult = await getItem(email);
        console.log("resulted queryResult: ");
        console.log(queryResult);
        
        if(queryResult === undefined || queryResult === null)
        {
            response = emailNotFoundResponse(response);
            console.log( email + " not found on dynamoDB");
        }
        else{
            
            //check if the code is expired!
           
           if( isExpired(queryResult.timestamp))
           {
               response = emailNotFoundResponse(response);
               console.log(email + " is expired");
           }
           else if(code !== queryResult.code){
                //if code is not same, send appropriate msg.
                response = wrongCodeResponse(response);
                console.log(email + " wrong code.");
            }
            else{
                //if code is correct and not expired, save it to DynamoDB
                console.log( email + ": code was correct and not expired");
                var updateResult = await verifyCode(email, code);
                console.log( "update Result is ");
                console.log(updateResult);
            }
        }
        
    }
    catch(e)
    {
        //if there is an error, say it is server-side error
        console.log(email + " : " + e);
        response.statusCode = 500; 
    }
    // TODO implement

    response = formatResponse(response);    
    return response;
};

function formatResponse(response)
{
    response.body = JSON.stringify(response.body);
    return response;
}

//modifying response msg
function wrongCodeResponse(response)
{
    response.body.status = "1";
    response.body.msg = wrongCodeMsg;
    return response;
}

function emailNotFoundResponse(response)
{
    response.body.status = "2";
    response.body.msg = emailNotFoundMsg;
    return response;
}


//accessing and deleting item from dynamodb
async function getItem(email)
{
    var params = {
        TableName: tableName,
        Key: {
            email: email
        },
       
    };
    
    var res = await docClient.get(params).promise();
   
    return  res.Item;
}


//tell dynamoDB that it is verified
async function verifyCode( email, code)
{
   return updateItem(email, code, 1, getExpiringTimestamp());
}

async function updateItem(email, code, state, timestamp)
{
    var params = {
        TableName: tableName,
        Key:{
            email: email
        },
        UpdateExpression :"set #code = :c, #state = :s",
        ExpressionAttributeNames:{
            "#code": "code",
            "#state": "state",
            "#timestamp" : "timestamp"
        },
        ExpressionAttributeValues:{
            ":c": code,
            ":s": state,
            ":t": timestamp
        },
        ReturnValues: "UPDATED_NEW"
    };
    
    if(!(timestamp === undefined || timestamp === null) )
    {
        params.UpdateExpression = params.UpdateExpression + ", #timestamp = :t";
    }
    
    return docClient.update(params).promise();
    
    
}

//check if it is expired: expiredTime is 3 min
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
