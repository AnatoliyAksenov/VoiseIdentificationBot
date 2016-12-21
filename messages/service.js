var request = require('request');
var fs = require('fs');

var Ocp_Apim_Subscription_Key = process.env.OCP_APIM_SUBSCRIPTION_KEY;

if(!Ocp_Apim_Subscription_Key){
    throw new Error('Pleese set environment variable OCP_APIM_SUBSCRIPTION_KEY');
}

function debug(str){
    if(process.env.DEBUG == 'cognetive service')
        console.log(str);
}

var identificationProfiles = {};

function postCognetiveService(url, error, success, response, body){
    debug(`f: postCognetiveService:\n url:${url}\n body:${JSON.stringify(body)}`);
    var options = {
        url: url,
        body: body,
        headers:{
            "Ocp-Apim-Subscription-Key": Ocp_Apim_Subscription_Key
        }
    };
    return request.post(options)
                  .on("error", error)
                  .on("data", success)
                  .on("response", response);
}

function getCognetiveService(url, error, success){
    debug(`f: getCognetiveService:\n url:${url}`);    
    var options = {
        url: url,
        headers:{
            "Ocp-Apim-Subscription-Key": Ocp_Apim_Subscription_Key
        }
    };
    return request.get(options, function(err, res, body){
        if(err){
            error(err);
        } else {
            success(res, body);
        }
    });
};

function deleteCognetiveService(url, error, success, response){
    debug(`f: deleteCognetiveService:\n url:${url}`);
    var options = {
        url: url,
        headers:{
            "Ocp-Apim-Subscription-Key": Ocp_Apim_Subscription_Key
        }
    };
    return request.delete(options)
                  .on("error", error)
                  .on("data", success)
                  .on("response", response);
}

identificationProfiles.createProfile = function(error, success, response){
    var url = `https://api.projectoxford.ai/spid/v1.0/identificationProfiles`;
    var obj = {
        "locale":"en-us",
    };
    
    postCognetiveService(url,  function(err){
        debug(`createProfile error fired: ${err}`);
        error(err);
    }, function(data){
        debug(`createProfile data fired: ${data}`);
        success(data);
    }, function(res){
        debug(`createProfile response fired: ${res}`);            
        response(res);
    }, JSON.stringify(obj));

};

identificationProfiles.deleteProfile = function(profileId, error, success, response){
    var url = `https://api.projectoxford.ai/spid/v1.0/identificationProfiles/${profileId}`;
    
    deleteCognetiveService(url, function(err){
        debug(`deleteProfile error fired: ${err}`);
        error(err);
    }, function(data){
        debug(`deleteProfile data fired: ${data}`);
        success(data);
    }, function(res){
        debug(`deleteProfile response fired: ${res}`);            
        response(res);
    });

};

identificationProfiles.getProfile = function(profileId, error, success, response){
    var url = `https://api.projectoxford.ai/spid/v1.0/identificationProfiles/${profileId}`;
    
    getCognetiveService(url, function(err){
        debug(`getProfile error fired: ${err}`);
        error(err);
    }, function(data){
        debug(`getProfile data fired: ${data}`);
        success(data);
    }, function(res){
        debug(`getProfile response fired: ${res}`);            
        response(res);
    });

};




identificationProfiles.enroll = function(profileId, filename, error, success){
    var url = `https://api.projectoxford.ai/spid/v1.0/identificationProfiles/${profileId}/enroll??shortAudio=true`;
    fs.createReadStream(filename).pipe(
        postCognetiveService(url, function(err){
            debug(`Enroll error: ${err}`);
            error(err);
        }, function(data){
            // on data action not currently fired
            debug(`Enroll success: ${JSON.stringify(data)}`);
            success(data);
        }, function(res){
            debug(`Enroll response fired.\nResponse info: ${JSON.stringify(res)}`);
            if(res.statusCode == 202) {
                success({statusCode: res.statusCode, message:"success"});
            } else {
                error(new Error(`Status code: ${res.statusCode}`));
            }
        })
    )
};

identificationProfiles.get = function(error, success){
    var url = "https://api.projectoxford.ai/spid/v1.0/identificationProfiles";
    getCognetiveService(url, function(err){
        debug(`Error: ${err}`);
        error(err);
    }, function(res, body){
        debug(`Success: ${JSON.stringify(body)}`);
        success(res, body);
    });
};

identificationProfiles.identify = function(profileIds, filename, error, success){
    var str = encodeURI(profileIds.join(','));
    var url = `https://api.projectoxford.ai/spid/v1.0/identify?identificationProfileIds=${str}`;
    fs.createReadStream(filename).pipe(
        postCognetiveService(url, error, function(data){
            success(data); //on data action not fired
        }, function(response){
            if(response.statusCode == 202){                
                var operation_url = response.caseless.dict["operation-location"];
                debug(`file succsessfully sended. Waiting results.\nOperation info: ${JSON.stringify(response.caseless)}\nBody info: ${JSON.stringify(response.body)}`);                
                setTimeout(function(){
                    if(!!operation_url){                            
                        getCognetiveService(operation_url, error, function(res, body){
                            if(body.status = 'running' || res.caseless.dict["apim-request-id"]){
                                //second round
                                debug(`Second round. Operation info: ${JSON.stringify(response.caseless)}\nBody info: ${JSON.stringify(body)}`);                
                                setTimeout(function(){
                                    getCognetiveService(operation_url, function(err){
                                        debug(`Second round error: ${err}`);
                                        error(err);
                                    }, function(res, body){
                                        debug(`Second round success: ${JSON.stringify(body)}`);
                                        success(res, body);
                                    });
                                }, 2000);                                    
                            } else {
                                status(res, body);    
                            }
                            
                        });
                    }                        
                    }, 2000);
            }
        })
    );
};

module.exports = identificationProfiles;