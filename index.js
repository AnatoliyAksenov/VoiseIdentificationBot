var builder = require('botbuilder');
var restify = require('restify');
var fs = require('fs');
var Promise = require('bluebird');
var request = require('request-promise').defaults({ encoding: null });
var identProfiles = require('./service.js');
var db = require('./db.js');

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});

var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});

// Create Bot with `persistConversationData` flag 
var bot = new builder.UniversalBot(connector, {
    persistConversationData: true
});

server.post('/api/messages', connector.listen());

var lastName = '';

// Bot dialogs
bot.dialog('/', function (session) {

    if (!session.conversationData[lastName]) {
        //session.conversationData[lastName] = '5a4cb034-59d7-46b1-9908-2dda681d5a6c';
        //session.beginDialog('/select-profile');
        session.beginDialog('/main');
    } else {

        var profileId = session.conversationData[lastName];
        session.send('Текущий профиль %s:%s', lastName, profileId);

        session.beginDialog('/main');
    }
});

bot.dialog('/select-profile', new builder.SimpleDialog(function(session, results){
    if (results && results.response) {
        var pid = results.response.trim();
        
        db.models.profile.findOne({profileId: pid}).then(function(model){
            if(model){
                lastName = model.profileName;
                session.conversationData[lastName] = model.profileId;
                session.replaceDialog('/');
            } else {
                session.send(`Профиль ${pid} не найден в базе. Выполните связь с профиля с БД через команду /prepare`);
                session.replaceDialog('/');
            }
        })        
        
        return;
    }

    builder.Prompts.text(session, 'Введите идентификатор профиля.');
}));

bot.dialog('/profile-info', new builder.SimpleDialog(function(session, results){
    var pid = session.conversationData[lastName];
    identProfiles.getProfile(pid, function(err){
        console.log(err);
        session.send(`Ошибка получения информации по профилю ${pid}`);
    }, function(body){
        if(typeof body == 'string'){
            session.send(`Сервер вернул данные в не поддерживаемом формате: ${body}`);
            console.log(body);            
        } else {
            session.send(JSON.stringify(body.body)); 
            console.log(body.body);
        }    
        session.beginDialog('/main');
    }, function(res){
        console.log(`/profile-info: ${res.statusCode}`);        
    });
}));


bot.dialog('/main', new builder.IntentDialog()
    .onBegin(function(session, args, next){
        if (!session.conversationData[lastName]) {
            session.send(`Не выбран рабочий профиль.
             Просмотр списка профилей: /profiles
             Выбор рабочего профиля: /select-profile`);
        } else {

            session.send(`Список команд:\n
            /profiles - список профилей\n
            /newprofile - создать новый профиль\n 
            /profile-info - просмотреть информацию по профилю\n
            /select-profile - установить профиль по умолчанию\n
            /prepare - внести профиль в БД\n
            /enroll - обучение профиля\n
            /identity - идентификация голоса в файле
            `);
        }
    })
    .matches(/^\/?profiles/, function(session, args, next){

        identProfiles.get(function(error){
            session.send(`Ошибка получения данных с сервера.\n ${error}`);
            console.log(`get all profiles: ${error}`);
        }, function(res, body){
            var obj;
            if(typeof body == 'string')
                obj = JSON.parse(body)
            else
                obj = body;

            for(const id in obj){
                const pid = obj[id].identificationProfileId;
                    console.log(pid);
                    db.models.profile.findOne({profileId: pid}).exec(function(err, model){
                        if (err){
                            console.log(`Error in findOne for ${pid}`);
                        }
                        else{  
                            //${model.profileName}
                            var name = 'Имя не определено';
                            if(model)
                              name = model.profileName;
                            session.send(`${name} ${pid}`);                            
                        }
                    });                               
            }
        
        });
        
    }).matches(/^\/?newprofile/, '/newprofile')
    .matches(/^\/?profile-info/, '/profile-info')
    .matches(/^\/?select-profile/, '/select-profile')
    .matches(/^\/?prepare/, builder.DialogAction.send('Under consruction'))
    .matches(/^\/?enroll/, '/enroll')
    .matches(/^\/?identity/, '/identity')
    .onDefault(function(session){
        session.send('Команда не распознана.');
        session.beginDialog('/main');
        return;
    })
);

bot.dialog('/enroll', [
    function(session){
        builder.Prompts.text(session, `Передайте аудио файл в формате wav PCM 16K 16 bit Mono.`);
    },
    function(session, results){
        var msg = session.message;
        if (msg.attachments.length) {

            var attachment = msg.attachments[0];
            var fileDownload = isSkypeMessage(msg)
                ? requestWithToken(attachment.contentUrl)
                : request(attachment.contentUrl);
            var profileId = session.conversationData[lastName];
            var tempfile = __dirname + `/.tmp/${guid()}.tmp`;    
            var ws = fs.createWriteStream(tempfile);
            
            ws.on('finish', function(){
                    if(attachment.contentType == 'audio/wav'){
                        identProfiles.enroll(profileId, tempfile, function(error){
                                console.log(`ENROLL ${profileId}, ${tempfile}: error:${error}`);
                                session.message.attachments[0] = void 0;
                                session.message.attachments = [];
                                fs.unlinkSync(tempfile);
                                session.endDialog();
                            }, function(success){
                                session.send(JSON.stringify(success));
                                session.message.attachments[0] = void 0;
                                session.message.attachments = [];
                                fs.unlinkSync(tempfile);
                                session.endDialog();                                
                            });
                    } else {
                        session.send(`Передан не поддерживаемый тип файла: ${attachment.contentType}`);
                        session.endDialog();
                    }               
            });

            fileDownload.pipe(ws);
    }    
}]);

bot.dialog('/identity', [
    function(session){
        builder.Prompts.text(session, `Передайте аудио файл в формате wav PCM 16K 16 bit Mono.`);
    },
    function(session, results){
        var msg = session.message;
        if (msg.attachments.length) {

            var attachment = msg.attachments[0];
            var fileDownload = isSkypeMessage(msg)
                ? requestWithToken(attachment.contentUrl)
                : request(attachment.contentUrl);
            var profileId = session.conversationData[lastName];
            var tempfile = __dirname + `/.tmp/${guid()}.tmp`;    
            var ws = fs.createWriteStream(tempfile);
            
            ws.on('finish', function(){
                    if(attachment.contentType == 'audio/wav'){
                        var getIds = new Promise(function(resolve, reject){
                            identProfiles.get(function(error){
                                reject(error);
                            }, function(res, body){
                                var obj;
                                if(typeof body == 'string')
                                    obj = JSON.parse(body)
                                else
                                    obj = body;
                                var pid = [];    
                                for(const id in obj){
                                    pid.push(obj[id].identificationProfileId);
                                }
                                resolve(pid);
                            });                            
                        });
                        
                        getIds.then(function(ids){
                            identProfiles.identify(ids, tempfile, function(error){
                                console.log(`ENROLL ${profileId}, ${tempfile}: error:${error}`);
                                session.message.attachments[0] = void 0;
                                session.message.attachments = [];
                                fs.unlinkSync(tempfile);
                                session.endDialog();
                            }, function(res, body){
                                session.send(JSON.stringify(body));
                                session.message.attachments[0] = void 0;
                                session.message.attachments = [];
                                fs.unlinkSync(tempfile);
                                session.endDialog();
                            });
                        });                        
                    } else {
                        session.send(`Передан не поддерживаемый тип файла: ${attachment.contentType}`);
                        session.endDialog();
                    }               
                    
            });

            fileDownload.pipe(ws);
    }    
}]);

bot.dialog('/newprofile', new builder.SimpleDialog(function(session, results){
    if (results && results.response) {
        lastName = results.response;
        
        identProfiles.createProfile(function(err){
          console.log(err);
        }, function(data){
            var str = data.toString('ascii'); // recieved Buffer object
            var obj = JSON.parse(str);
            session.conversationData[lastName] = obj.identificationProfileId;
            session.userData[lastName] = obj.identificationProfileId;
            db.models.profile.create({profileId: obj.identificationProfileId, profileName: lastName}, function(){
                session.send('Новый профиль содан.');
                session.send(`${lastName} : ${session.conversationData[lastName]}`);
                session.send("Для обучения профиля используйте команду \'\\enroll\'");
            });            
        }, function(res){
           session.send('Что то пошло не так.');
        });
        
        session.replaceDialog('/profiles');
        return;
    }

    builder.Prompts.text(session, 'Введите имя нового профиля.');
}));

/*
bot.dialog('/search', new builder.IntentDialog()
    .onBegin(function (session, args, next) {
        // is user's name set? 
        var userName = session.userData[UserNameKey];
        if (!userName) {
            session.beginDialog('/askUserName');
            return;
        }

        // has the user been welcomed to the conversation?
        if (!session.privateConversationData[UserWelcomedKey]) {
            session.privateConversationData[UserWelcomedKey] = true;
            session.send('Welcome back %s! Remember the rules: %s', userName, HelpMessage);
        }

        next();
        
    }).matches(/^current city/i, function (session) {
        // print city settings
        var userName = session.userData[UserNameKey];
        var defaultCity = session.conversationData[CityKey];
        var userCity = session.privateConversationData[CityKey]
        if (!!userCity) {
            session.send(
                '%s, you have overridden the city. Your searches are for things in %s. The default conversation city is %s.',
                userName, userCity, defaultCity);
            return;
        } else {
            session.send('Hey %s, I\'m currently configured to search for things in %s.', userName, defaultCity);
        }

    }).matches(/^change city to (.*)/i, function (session, args) {
        // change default city
        var newCity = args.matched[1].trim();
        session.conversationData[CityKey] = newCity;
        var userName = session.userData[UserNameKey];
        session.send('All set %s. From now on, all my searches will be for things in %s.', userName, newCity);

    }).matches(/^change my city to (.*)/i, function (session, args) {
        // change user's city
        var newCity = args.matched[1].trim();
        session.privateConversationData[CityKey] = newCity;
        var userName = session.userData[UserNameKey];
        session.send('All set %s. I have overridden the city to %s just for you', userName, newCity);

    }).matches(/^reset/i, function (session, args) {
        // reset data
        delete session.userData[UserNameKey];
        delete session.privateConversationData[CityKey];
        delete session.privateConversationData[UserWelcomedKey];
        session.send('Ups... I\'m suffering from a memory loss...');
        session.endDialog();

    }).onDefault(function (session) {
        // perform search
        var city = session.privateConversationData[CityKey] || session.conversationData[CityKey];
        var userName = session.userData[UserNameKey];
        var messageText = session.message.text.trim();
        session.send('%s, wait a few seconds. Searching for \'%s\' in \'%s\'...', userName, messageText, city);
        session.send('https://www.bing.com/search?q=%s', encodeURIComponent(messageText + ' in ' + city));
    }));

bot.dialog('/askUserName', new builder.SimpleDialog(function (session, results) {
    if (results && results.response) {
        session.userData[UserNameKey] = results.response;
        session.privateConversationData[UserWelcomedKey] = true;
        session.send('Welcome %s! %s', results.response, HelpMessage)
        //  end the current dialog and replace it with  '/search' dialog
        session.replaceDialog('/search');
        return;
    }

    builder.Prompts.text(session, 'Before get started, please tell me your name?');
}));*/



// Request file with Authentication Header
var requestWithToken = function (url) {
    return obtainToken().then(function (token) {
        return request({
            url: url,
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/octet-stream'
            }
        });
    });
};

// Promise for obtaining JWT Token (requested once)
var obtainToken = Promise.promisify(connector.getAccessToken.bind(connector));

var isSkypeMessage = function (message) {
    return message.source === 'skype';
};

function guid() {
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
    s4() + '-' + s4() + s4() + s4();
}

function s4() {
  return Math.floor((1 + Math.random()) * 0x10000)
    .toString(16)
    .substring(1);
}