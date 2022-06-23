const jwt = require('jsonwebtoken');

const secretKey = "my_secret_key";

exports.handler = async (event) => {
    console.log(event);
    
    var token = event.authorizationToken;
    var auth = verifyToken(token);
    var policy = createPolicy(auth, event.methodArn);
    // TODO implement
    console.log(policy.policyDocument.Statement);
    return policy;
};

//if token is valid return Allow, Else return Deny
function verifyToken(token)
{
     var auth = "Allow";
    
    try
    {
      jwt.verify(token, secretKey);
      
    }
    catch(e)
    {
      if(e instanceof jwt.JsonWebTokenError){
        console.log(e);
        auth = "Deny";
      }
      else if(e instanceof jwt.ExpiredSignatureError)
      {
        console.log(e);
        auth = "Deny";
      }
    }
    
    return auth;
}

//createPolicy based on Allow or Deny
function createPolicy(auth, resource)
{
  const policy= {
  principalId: "user1", // The principal user identification associated with the token sent by the client.
  policyDocument: {
    Version: "2012-10-17",
    Statement: [
      {
        Action: "execute-api:Invoke",
        Effect: auth,
        Resource: resource
      }
    ]
  },
  "context": {
    "key": "value",
    "numKey": 1,
    "boolKey": true
  }
}

  return policy;
}