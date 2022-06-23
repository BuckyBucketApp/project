const AWS = require('aws-sdk');
const mysql = require("mysql2/promise");
const jwt = require('jsonwebtoken');
 

//configuring for s3 bucket
const S3 = new AWS.S3();

        
const DELETE_BUCKET_PARAMS = {
        Bucket: 'buckybucket2022'
}

//set necessary variable for bucket upload
const REVIEW_BUCKET_FOLDER = "review/";
const BUCKET_PATH = "https://buckybucket2022.s3.ap-northeast-2.amazonaws.com/";
const BUCKET_PROFILE = ""


//connecting to RDS
const connectionPromise = mysql.createConnection({
                host: "buckydatabase.c7ozy5epcsbh.ap-northeast-2.rds.amazonaws.com",
                user: "admin",
                password: "Insukkim!6810",
                database: "buckyDatabase",
            });
            
//connecting for DynamoDB
AWS.config.update(
    {
        region: "ap-northeast-2",
        endpoint: "dynamodb.ap-northeast-2.amazonaws.com"
    });

const DOC_CLIENT = new AWS.DynamoDB.DocumentClient();
const CONTENT_TABLE_NAME = "bucket_content";


const SUCCESS_MSG = "successfully send bucket";         //0
const FAIL_MSG = "sending bucket failed";                    //1

//set timezone for lambda
process.env.TZ = 'Asia/Seoul';

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
    const bucketId = event.bucketId;
    
    console.log("email: " + email);
    console.log("bucketId: " + bucketId);
    
    var connection;
    
    
    try{
       
        connection = await connectionPromise;
        
        var promiseList = [];
        
        
        promiseList.push(getBucketListRDS(connection , bucketId, email));
        promiseList.push(getContentDynamo(bucketId));
        
        const col = await Promise.all(promiseList);
    
        
        const RDSres = col[0];
        const DynamoRes = col[1];
        
        RDSres.reviewContent = DynamoRes.reviewContent === undefined ? null: DynamoRes.reviewContent;
        RDSres.bucketContent = DynamoRes.bucketContent;
        
        
        console.log(RDSres);
        
        response.body.bucketList = RDSres;
        
        connection.commit();
        
    }
    catch(e)
    {
        connection.rollback();
        console.log(e);
        response = failResponse(response);
    }
    
    
    return formatResponseBody(response);
};


//insert review content in DynamoDB-------------------------------------
async function getContentDynamo(bucketId)
{
    var params = {
        TableName: CONTENT_TABLE_NAME,
        Key:{
            "bucketId": bucketId.toString()
        }
    };
    
    const res = await DOC_CLIENT.get(params).promise();

    console.log("query result from dynamo: ");
    console.log(res);
    
    if(res  === {})
    {
        console.log("returning empty bucketContent");
        return {
            bucketContent: null,
            bucketReview: null
        };
    }
    
    var bucketContent = res.Item.content;
    var bucketReview = res.Item.reviewContent; 
        
    if(bucketReview === undefined)
    {
        bucketReview = null;
    }

    return {
        bucketContent: bucketContent,
        bucketReview: bucketReview
    };
}

//get bucketlist from rds 
async function getBucketListRDS(RDSconnection, bucketId, email)
{
    const bucketList = {
        bucketId: bucketId
    };
    
    const getBucketListCommand = `SELECT users.profilePicturePath , bucketList.bucketId, isVisible, title, users.nickname, startDate, endDate, 
        GROUP_CONCAT(DISTINCT CONCAT_WS( ",", orderNumb, content, planDate, achieved) SEPARATOR "^") as detailPlans, 
       bucketTags, 
        (SELECT count(*) FROM bucketListHeart WHERE bucketId = ${bucketId} AND email = '${email}' ) as heart,
        achievedDate,
        profilePict,
        achievePict,
        reviewPaths
        FROM bucketList 
        left outer join detailPlan ON(bucketList.bucketId = detailPlan.bucketId)
        left outer join review ON (review.bucketId = bucketList.bucketId)
        join users ON (bucketList.owner = users.email)
        WHERE (bucketList.bucketId = ${bucketId})
        GROUP BY bucketList.bucketId, title, users.nickname, startDate, endDate, profilePict, achievePict, isVisible`;
        
    var res = await RDSconnection.query(getBucketListCommand);
    const queryResult = res[0][0];
    console.log("queryResult: " + queryResult);
    
    
    bucketList.isVisible = queryResult.isVisible;
    bucketList.title = queryResult.title;
    bucketList.nickname = queryResult.nickname;
    bucketList.startDate = queryResult.startDate;
    bucketList.endDate = queryResult.endDate;
    bucketList.heart = queryResult.heart;
    bucketList.tags = queryResult.bucketTags.split(",");
    bucketList.profilePict = queryResult.profilePict;
    bucketList.achievedPict = queryResult.achievePict;
    bucketList.userProfilePict = queryResult.profilePicturePath;
    bucketList.reviewPicts = queryResult.reviewPaths != null ? queryResult.reviewPaths.split(",") : queryResult.reviewPaths; 
    
    bucketList.detailPlans = [];
    
    const rawDetailPlans = queryResult.detailPlans.split("^");
    
    console.log("raw Detail Plans: " + rawDetailPlans);
    
    for(var detailPlan of rawDetailPlans)
    {
        let splitArray = detailPlan.split(',');
        let temp = {
            orderNumb: parseInt(splitArray[0]),
            content: splitArray[1],
            planDate: splitArray[2],
            achieved: splitArray[splitArray.length - 1]
        };
        
        bucketList.detailPlans.push(temp);
    }
    
    
    
    return bucketList;
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