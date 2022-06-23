const AWS = require('aws-sdk');
const jwt = require('jsonwebtoken');

//connecting for DynamoDB
AWS.config.update(
    {
        region: "ap-northeast-2",
        endpoint: "dynamodb.ap-northeast-2.amazonaws.com"
    });

const DOC_CLIENT = new AWS.DynamoDB.DocumentClient();
const POINT_TABLE_NAME = "point_table";

//response msg
const SUCCESS_MSG = "successfully sent point details";              //0
const FAIL_MSG = "sending point details failed";                    //1

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
    
    try
    {
        var pointDetails = await getDetailPointFromDynamo(email);
        response.body.details = pointDetails;
        
    }
    catch(e)
    {
        console.log(e);
        response = failResponse(response);
        
    }
    
    
    response = formatResponseBody(response);
    return response;
};

//insert content of bucket to DynamoDB-------------------------------------
async function getDetailPointFromDynamo(email)
{
    var params = {
        TableName: POINT_TABLE_NAME,
        KeyConditionExpression: "#email = :email",
        ExpressionAttributeNames: {
          "#email": "email"  
        },
        ExpressionAttributeValues:{
            ":email": email
        },
        ScanIndexForward: false
    };
    
    var res = await DOC_CLIENT.query(params).promise();
    console.log("queried result: ");
    console.log(res.Items);
    
    return res.Items;
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