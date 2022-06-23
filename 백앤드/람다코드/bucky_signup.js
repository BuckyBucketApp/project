const AWS = require('aws-sdk');
const parser = require('lambda-multipart-parser');
const mysql = require("mysql2/promise");
 
//configuring for s3 bucket
const s3 = new AWS.S3();
const bucketParams = {
        Bucket: `buckybucket2022`,
        ACL:'public-read'
        };

//set necessary variable for bucket upload
const profilePictureFolder = "profilepict/";
const bucketPath = "https://buckybucket2022.s3.ap-northeast-2.amazonaws.com/";


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
const AGGREGATE_POINT_TABLE_NAME = "aggregate_point_table";        
        
//response msg
const successMsg = "successfully signed up";         //0
const failMsg = "sign up failed";                    //1

exports.handler = async (event) => {
    
    var response = {
        statusCode: 200,
        body: {
            status: "0",
            msg: successMsg
        }
    };
    
 
    //conver multipart/form-data to JSON
    const parsedResult = await parser.parse(event);
    //picture data
    
    console.log(parsedResult);

    var file = parsedResult.files[0];


    //get requiredData
    var nickname = JSON.parse(parsedResult.nickname);
    console.log("nickname: " + nickname);
    var email = JSON.parse(parsedResult.email);
    
    console.log("email: " + email);
    
    var password = JSON.parse(parsedResult.password);
    
    console.log("password: " + password);
    

    var tags = JSON.parse(parsedResult.tags);
    
    var typeOfTags = typeof tags;
    console.log("tags: " + typeOfTags);
    console.log(tags);
    
   
    tags = convertStringTagsToList(tags);
    
    
    
    var profilePict; 
    
    var connection;
    
    
    try
    {
        const dynamoPromise = initializeAggregate(email);
        connection = await connectionPromise;
        
        //프로필사진을 안올릴시 NULL 아니면 path!
        if(file == undefined)                                                     
        {
            console.log(email + " : " + "profile picture not exist!" );
            profilePict = "NULL";
        }
        else
        {
            console.log(email +  " : " + "profilePicture exist!");
            //setting name for picture to store in s3 bucket
            bucketParams.Key = getKeyNameForFile(profilePictureFolder,  email ,  file); 
            profilePict = bucketPath + bucketParams.Key;
        }
    
        await connection.beginTransaction()
        
        //insert new user info to DB
        await signUpNewUser(connection, email, password, nickname, profilePict);
        //insert tags that users selected when sign up
        await insertTagsToDB(connection, email, tags);
    
       
        //commit 완료시 s3 버킷에 upload
        if(file != undefined)
        {
            var uploadResponse = await putObjectToS3(s3, bucketParams, file);
            console.log("upload To S3 response: " + uploadResponse);
        }
        
        
        await dynamoPromise;
        
        await connection.commit();
    
    }
    catch(e)
    {
        await connection.rollback();
        response = failResponse(response);
        console.log(e);
    }
    
    response = formatResponseBody(response);
    
    return response;
};

//stringify response body before return
function formatResponseBody(response)
{
    response.body = JSON.stringify(response.body);
    return response;
}

//change response
function failResponse(response)
{
    response.body.status = "1";
    response.body.msg = failMsg;
    return response;
}

//insert new user info to DB
async function signUpNewUser(connection, email, password, nickname, profilePict)
{
    return connection.query("INSERT INTO users(email, password, nickname, profilePicturePath) VALUES(?, ?, ?, ?)", 
        [email, password, nickname, profilePict]);
}

//insert tags that users selected to DB
async function insertTagsToDB(connection, email, listOfTags)
{
    var tagInsert = "INSERT INTO userInterestTags(email, tag) VALUES ";
    
    
    const tags = listOfTags;
    
    //유저의 태그들 추가!
    for(var tag of tags)
    {
        tagInsert = tagInsert + ` ('${email}', '${tag}'),`;
    }
    
    console.log("before tagInsert: " + tagInsert);
    tagInsert = tagInsert.substring(0, tagInsert.length -  1);
    
    return connection.query(tagInsert);
}

//upload picture to S3
async function putObjectToS3(s3, bucketPar, file)
{
    
    var data = file.content;
    
    console.log("will upload: " + data);
    //get binary data of file
    bucketPar.Body = data;
    //get file type from file
    bucketPar.Key = bucketPar.Key;
    
    return s3.putObject(bucketPar).promise();
}

function getFileTypeFromFile(file)
{
    const temp = file.filename.split(".")
    return temp[temp.length - 1 ];
}

function getKeyNameForFile(profilePictureFolder, email, file)
{
    return profilePictureFolder + email +  "." + getFileTypeFromFile(file) ;
}

//initialize aggregate_point_table
async function initializeAggregate(email)
{
    var params = {
        TableName: AGGREGATE_POINT_TABLE_NAME,
        Item:{
            "email": email,
            "point": 0
        }
    };
    
    return DOC_CLIENT.put(params).promise();
}

function convertStringTagsToList(strTags)
{
    const truncatedTags = strTags.substring(1, strTags.length - 1);
    
    const truncatedList = truncatedTags.split(",");
    const retList = [];
    
    for(var tag of truncatedList)
    {
        retList.push(tag.substring(1, tag.length -1 ));
    }
    
    return retList;
}