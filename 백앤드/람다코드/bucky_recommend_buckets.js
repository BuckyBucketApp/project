const jwt = require('jsonwebtoken');
const mysql = require("mysql2/promise");


//create connection for rds
var connectionPromise = mysql.createConnection({
                host: "buckydatabase.c7ozy5epcsbh.ap-northeast-2.rds.amazonaws.com",
                user: "admin",
                password: "Insukkim!6810",
                database: "buckyDatabase",
            });

//response msgs
const SUCCESS_MSG = "recommendation successful";        //0
const FAIL_MSG = "recommendation failed";         //1


exports.handler = async (event) => {
    // TODO implement
    var response = {
        statusCode: 200,
        body: {
            status: "0",
            msg: SUCCESS_MSG
        }
    };
    
    console.log("event:");
    console.log(event);
    
    const email = getEmail(event.authorization);
    
    var connection; 
    
    try
    {
        connection = await connectionPromise;
        
        var recommendation = await recommendBuckets(connection, email);
        console.log(recommendation);
        
        response.body.bucketLists = recommendation;
        
        
    }
    catch(e)
    {
        console.log(e);
        response = failResponse(response);
        connection.close();
        connectionPromise = mysql.createConnection({
                host: "buckydatabase.c7ozy5epcsbh.ap-northeast-2.rds.amazonaws.com",
                user: "admin",
                password: "Insukkim!6810",
                database: "buckyDatabase",
            });
    }
    
    response = formatResponse(response);
    
    console.log("response: ");
    console.log(response);
    
    return response;
};



function formatResponse(response)
{
    response.body = JSON.stringify(response.body);
    return response;
}

function failResponse(response)
{
    response.body.status = "1";
    response.body.msg = FAIL_MSG;
    return response;
}

async function recommendBuckets(RDSconnection, email)
{
    const getTagsCommand = `SELECT tag FROM userInterestTags WHERE email = ?`;
    const getRecommendationCommand = 
        `SELECT bucketList.bucketId as bucketId, title, profilePict, (CASE 
        WHEN writtenDate is null THEN 0
        ELSE 1 END) as achieved,
        (SELECT count(*) FROM bucketListHeart WHERE bucketId = bucketList.bucketId AND email = ? ) as heart 
        FROM bucketList left outer join review on bucketList.bucketId = review.bucketId 
        WHERE isVisible = 1 AND owner != ? AND (bucketTags REGEXP ? );`

    //get tags that users are interested in
    const tagList = [];
    
    var tags = await RDSconnection.query(getTagsCommand, email);
    
    for(var tag of tags[0])
    {
        tagList.push(tag.tag);
    }
    
    
    const tagReg = createTagRegex(tagList);
    console.log("tagReg: " + tagReg);
    
    //get recommendation for user
    var recommendation  = await RDSconnection.query(getRecommendationCommand, [email, email, tagReg])
    
    return recommendation[0]; 
}

function createTagRegex(tagList)
{
    if(tagList.length === 0)
    {
        return "";
    }
    
    var tagReg = tagList[0];
    
    for(var index = 1; index < tagList.length; index++)
    {
        tagReg +=  `|${tagList[index]}`;
    }
    
    return tagReg;
}

//get email from token
function getEmail(token)
{
    var payload = jwt.decode(token);
    
    return payload.emailAddress;
}
