const AWS = require('aws-sdk');
const jwt = require('jsonwebtoken');

//connecting for DynamoDB
AWS.config.update(
    {
        region: "ap-northeast-2",
        endpoint: "dynamodb.ap-northeast-2.amazonaws.com"
    });

const DOC_CLIENT = new AWS.DynamoDB.DocumentClient();
const AGGREGATE_POINT_TABLE_NAME = "aggregate_point_table";        
        
//response msg
const SUCCESS_MSG = "successfully sent point";              //0
const FAIL_MSG = "sending point failed";                    //1

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
        var point = await getPointFromDynamo(email);
        console.log(point);
        response.body.point = point;
        
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
async function getPointFromDynamo(email)
{
    var params = {
        TableName: AGGREGATE_POINT_TABLE_NAME,
        Key: {
            "email": email
        }
    };
    
    var res = await DOC_CLIENT.get(params).promise();
    return res.Item.point;
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