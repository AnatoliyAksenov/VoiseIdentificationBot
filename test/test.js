var identProfiles = require('../service.js');


// identProfiles.get(function(error){

//     console.log('GET: error');
// }, function(res, body){
//     var obj;
//     if(typeof body == 'string')
//       obj = JSON.parse(body)
//     else
//       obj = body;
//     for(var profile in obj){
//         console.log(obj[profile].identificationProfileId)
//         //console.log("1");
//     }
    
// });


// var profileId = 'f0065091-034a-4369-94c6-fd8372abbb1c';
// var filename = './1.wav';

/*

identProfiles.enroll(profileId, filename, 
   function(error){
    console.log('ENROLL: error');
   }, function(success){
    console.log("ENROLL: %j", success);
   }
);


var profileIds = [profileId,  '5a4cb034-59d7-46b1-9908-2dda681d5a6c'];
var filename2 = './p2.wav';
identProfiles.identify(profileIds, filename2, function(error){
    console.log(error);
}, function(res, body){
    console.log(body);
})

*/

// identProfiles.createProfile(function(err){
//   console.log(err);
// }, function(data){
//     if(typeof data == 'string')
//         console.log(data);
//     else{
//         var str = data.toString('ascii'); // recieved Buffer object
//         var obj = JSON.parse(str);
//         console.log(obj.identificationProfileId);
//     }    
// }, function(res){
//     //console.log(res);
// });


// var profileId3 = 'be7e613c-cbfa-4063-a74c-2d4c5d8207f9';
// identProfiles.deleteProfile(profileId3,function(err){
//     console.log(err);
// }, function(success){
//     if(typeof success == 'string')
//         console.log(success);
//     else 
//         console.log(success.toString('ascii'));    
// }, function(res){

//     console.log(res.statusCode);
    
// });

var profileId3 = '5e5efa61-80ff-4cb7-8c19-076c2ff94389';
identProfiles.getProfile(profileId3,function(err){
    console.log(err);
}, function(success){
    if(typeof success == 'string')
        console.log(success);
    else 
        console.log(success.body);    
}, function(res){

    console.log(res.statusCode);
    
});