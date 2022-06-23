const AWS = require('aws-sdk');
const parser = require('lambda-multipart-parser');
const jwt = require('jsonwebtoken');
const mysql = require("mysql2/promise");

//configuring for s3 bucket
const s3 = new AWS.S3();
const bucketParams = {
        Bucket: `buckybucket2022`,
        ACL:'public-read'
        };


//create connection for rds
const connectionPromise = mysql.createConnection({
                host: "buckydatabase.c7ozy5epcsbh.ap-northeast-2.rds.amazonaws.com",
                user: "admin",
                password: "Insukkim!6810",
                database: "buckyDatabase",
            });

//set necessary variable for bucket upload
const PROFILE_PICTURE_FOLDER = "profilepict/";
const BUCKET_PATH = "https://buckybucket2022.s3.ap-northeast-2.amazonaws.com/";
const BUCKET_NAME = 'buckybucket2022';

//response msgs
const SUCCESS_MSG = "update successful";        //0
const FAIL_MSG = "update failed";               //1

exports.handler = async (event) => {
    
    const parsedResult = await parser.parse(event);
    //picture data
    
    console.log(parsedResult);

    var file = parsedResult.files[0];
    
    const agent = event.headers["User-Agent"];
    
    if(agent != undefined && agent.split('/')[0] === "okhttp")
    {
        parsedResult.nickname = JSON.parse(parsedResult.nickname);
        parsedResult.tags = JSON.parse(parsedResult.tags);
            
    }
    
 // TODO implement
    var response = {
        statusCode: 200,
        body: {
            status: "0",
            msg: SUCCESS_MSG
        }
    };
    
    var connection;
    const email = getEmail(event.headers.Authorization);
    const nickname = parsedResult.nickname;
    const tags = convertStringTagsToList(parsedResult.tags);
    
    console.log("nickname:" + nickname);
    console.log("tags:");
    console.log(tags);
    
    var promiseList = [];
    try
    {
        
        
        connection = await connectionPromise;
        connection.beginTransaction();
        
        let newProfilePict = file != undefined? BUCKET_PATH + getKeyNameForFile(PROFILE_PICTURE_FOLDER, email, file) : null;
        
        promiseList.push(deletePicture(connection, email));
        promiseList.push(updateUser(connection, email, nickname, newProfilePict, tags))
        promiseList.push(putObjectToS3(s3, bucketParams, file, email));
        
        var res = await Promise.all(promiseList);
        console.log(res);
        
        connection.commit();
    }
    catch(e)
    {
        connection.rollback();
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
    
    response = formatResponseBody(response);
    return response;
};


//delete profilePicture
async function deletePicture(RDSConnection, email)
{
    var profilePict = await getProfilePict(RDSConnection, email);
    
    if(profilePict != null )
    {
        let key = getKeyNameFromUrl(profilePict);
        console.log("key: " + key);
        return await deleteFromS3(key);
    }
}

async function updateUser(RDSConnection, email, nickname, profilePicturePath, tags)
{
    var promiseList = [];
    
    const deleteTagsCommand = "DELETE FROM userInterestTags WHERE email = ? ;";
    const updateUserCommand = "UPDATE users SET profilePicturePath = ?, nickname = ? WHERE email = ?";
    
    promiseList.push(RDSConnection.query(deleteTagsCommand, [email]));
    promiseList.push(RDSConnection.query(updateUserCommand, [profilePicturePath, nickname, email]));
    promiseList.push(insertTagsToDB(RDSConnection, email, tags));
    
    await Promise.all(promiseList);
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


//get profilePicturePath of a user
async function getProfilePict(RDSConnection, email)
{
    const getProfilePictCommand = `SELECT profilePicturePath FROM users WHERE email = ?`;
    
    var re = await RDSConnection.query(getProfilePictCommand, email);
    
    return re[0][0].profilePicturePath;
}

//upload picture to S3
async function putObjectToS3(s3, bucketPar, file, email)
{
    
    var data = file.content;
    
    console.log("will upload: " + data);
    //get binary data of file
    bucketPar.Body = data;
    //get file type from file
    bucketPar.Key = getKeyNameForFile(PROFILE_PICTURE_FOLDER, email, file);
    
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



//delete previous profilePict
async function deleteFromS3(fileKey)
{
    var params = {  
        Bucket: BUCKET_NAME,
        Key: fileKey 
    };

    return await s3.deleteObject(params).promise();
    
}

function getKeyNameFromUrl(picturePath)
{
    const temp = picturePath.substring(BUCKET_PATH.length);
    
    return temp;
}

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
    response.body.msg = FAIL_MSG;
    return response;
}

//get email from token
function getEmail(token)
{
    var payload = jwt.decode(token);
    
    return payload.emailAddress;
}

function convertStringTagsToList(strTags)
{
    const truncatedTags = strTags.substring(1, strTags.length - 1);
    
    const truncatedList = truncatedTags.split(",");
    console.log("truncatedList: " + truncatedList);
    
    const retList = [];
    
    for(var tag of truncatedList)
    {
        retList.push(tag.substring(1, tag.length -1 ));
    }
    
    return retList;
}