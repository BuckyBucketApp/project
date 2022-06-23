var AWS = require("aws-sdk");
AWS.config.update({region: "ap-northeast-2"});

exports.handler = async (event) => {
    const newItem = event.Records[0].dynamodb.NewImage;
    const earnedTime = newItem.earnedTime.S;
    const point = parseInt(newItem.point.N);
    const email = newItem.email.S;
    const source = newItem.source.S;
    
    console.log(newItem);
    
    try
    {
        await triggerSNSTopic(email, point, source, earnedTime);
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


async function triggerSNSTopic(email, point, source, earnedTime)
{
    const msg = {
        email : email,
        point: point,
        source: source,
        earnedTime: earnedTime
    };
    
    var params = {
        Message: JSON.stringify(msg),
        TopicArn: "arn:aws:sns:ap-northeast-2:438655031161:on_new_point",
        Subject: "new point notification"
    };
    
    return new AWS.SNS({apiVersion: "2010-03-31"}).publish(params).promise();
}