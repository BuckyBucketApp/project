const AWS = require('aws-sdk');

//connecting for DynamoDB
AWS.config.update(
    {
        region: "ap-northeast-2",
        endpoint: "dynamodb.ap-northeast-2.amazonaws.com"
    });

const DOC_CLIENT = new AWS.DynamoDB.DocumentClient();
const AGGREGATE_POINT_TABLE_NAME = "aggregate_point_table";

exports.handler = async (event) => {
    console.log(event);
    
    const item = JSON.parse(event.Records[0].Sns.Message);
    
    console.log(item);
    
    try
    {
        await changeAggregate(item.email, item.point);
    }
    catch(e)
    {
        console.log(e);
    }
    
    // TODO implement
    const response = {
        statusCode: 200,
        body: JSON.stringify('Hello from Lambda!'),
    };
    return response;
};

async function changeAggregate(email, point)
{
    const params = {
        TableName: AGGREGATE_POINT_TABLE_NAME,
        Key:{
            "email": email
        },
        UpdateExpression: "set point = point + :val",
        ExpressionAttributeValues:{
            ":val" : point
        }
    }
    
    return DOC_CLIENT.update(params).promise();
}
