const fs=require('fs');
const readline=require('readline');
const {google} = require('googleapis');
const notifier=require('node-notifier');

const {listLabels,getMessages,listMessages, syncClient, listHistory}=require('./gmailAPI');
const { compileFunction } = require('vm');
const {conciseMessage, filterMessageBasedOnLabels, filterMessage} = require('./lib');
const defaultFilter=require('./defaultFilter');

// If modifying these scopes, delete token.json
// const SCOPES=['https://www.googleapis.com/auth/calendar.readonly'];
const SCOPES=['https://www.googleapis.com/auth/calendar','https://www.googleapis.com/auth/gmail.readonly'];

//The file token.json stores the users access and refresh tokens, and is created automatically
//when the authorization flow completes for the first time.
const TOKEN_PATH='token.js';



//Load client secrets from a local file.
fs.readFile('credentials.json',(err,content)=>{
    if(err) return console.log("Error loading client secret file:", err);
    // Authorize a client with credentials, then call the Google Calendar API
    authorize(JSON.parse(content),scheduleNotification);
});

/**
 * Create an Oauth2.0 client with the given credentials, and then execute the 
 * given callback function.
 * @param {object} credentials The authorization client credentials
 * @param {function} callback The callback to call with the authorized client
 */
function authorize(credentials,callback) {
    const {client_secret,client_id,redirect_uris} = credentials.web;

    const oAuth2Client=new google.auth.OAuth2(
        client_id,client_secret,redirect_uris[0]
    );

    // Check if we previously stored a token
    fs.readFile(TOKEN_PATH,(err,token)=>{
        if(err) return getAccessToken(oAuth2Client,callback);
        oAuth2Client.setCredentials(JSON.parse(token));
        callback(oAuth2Client);
    })
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for
 * @param {callback} callback Callback for the authorized client
 */
function getAccessToken(oAuth2Client,callback) {
    const authUrl=oAuth2Client.generateAuthUrl({
        access_type:'offline',
        scope:SCOPES,
    });
    console.log("Authorize this app by visiting this url:",authUrl);
    const rl=readline.createInterface({
        input:process.stdin,
        output:process.stdout
    });
    rl.question('Enter the code from that page: ',(code)=>{
        rl.close();
        oAuth2Client.getToken(code,(err,token)=>{
            if(err) return console.error('Error retrieving access token',err);
            oAuth2Client.setCredentials(token);
            // Store the token to disk
            fs.writeFile(TOKEN_PATH,JSON.stringify(token),(err)=>{
                if(err) return console.error(err);
            });
            callback(oAuth2Client);
        })
    })
}

/**
 * 
 * @param {google.auth.oAuth2} auth An authorized OAuth2 client
 */
function scheduleNotification(auth) {
    // First check if Gmail is sync
    // i.e. App is running first time ?
    if(!fs.existsSync('./sync.json')){
        // If sync.json file not present, the app is running first time, need to sync with Gmail
        syncClient(auth)
        .then(()=>{
            console.log("syncClient complete successfully")
            // Now run the notifyNewMessages continously every 15 minutes
            setInterval(()=>{
                notifyNewMessages(auth)
                .catch(err=>{
                    console.log("ERROR",err);
                })
            },15*60*1000);
        })
        .catch((err)=>{
            console.log("Error with syncClient "+err);
        })
    }
    else{
        setInterval(()=>{
            notifyNewMessages(auth)
            .catch(err=>{
                console.log("ERROR",err);
            })
        },5*60*1000);
    }
    
}

async function notifyNewMessages(auth){
    try{
        // Get all the new filtered messages
        const newMessages=await getNewFilteredMessages(auth);

        // Notify the user, desktop & console
        notify(newMessages);
    }
    catch(err){
        console.log("Error in notifyNewMessages")
        throw err;
    }
    
}

function notify(messsages){
    const totalMessages=messsages.length;
    if(totalMessages!=0){
        const notifyString=`You have ${totalMessages} new ${totalMessages==1?"message":"messages"}`;
        notifier.notify({
            title:"GmailFilteredNotify",
            message:notifyString
        });
        console.log("**************************************");
        console.log(notifyString);
        const currentTime=new Date().toString();
        console.log(currentTime);
        console.log("**************************************");
        messsages.forEach(message=>{
            console.log(message.from);
            console.log(message.snippet);
            console.log("-------------------");
        })
    }
    else{
        console.log("No New Message");
        const currentTime=new Date().toString();
        console.log(currentTime);
    }
}

/**
 * Gets the new messages after applying the filter
 * @param {google.auth.oAuth2} auth 
 */
async function getNewFilteredMessages(auth){
    try{
        // Call listHistory to check new messages
        const newMessages=await listHistory(auth);
        const messagesAdded=newMessages.messagesAdded;
        // console.log(defaultFilter)
        let content,filter;
        try{
            // Get the user filter settings
            content=fs.readFileSync('./filter.json');
            filter=JSON.parse(content);
        }
        catch(err){
            // If error, will use the default filter
            console.log("Error in reading filter settings, switching to default filter settings");
            filter=defaultFilter;
        }

        // Filter the messages received based on labelIds
        const labelFilteredMessages=messagesAdded.filter(
            message=>filterMessageBasedOnLabels(message,filter.labels)
        );

        // Create an array containing only message ids
        const messageIds=[];
        console.log("listHistory Ran Successfully. Here are Message Added Ids");
        labelFilteredMessages.forEach(message=>{
            console.log(`Message Id: ${message.id}`);
            console.log('Labels',message.labelIds);
            messageIds.push(message.id);
        })
        console.log("Will be calling getMessages() to get Message details");
        const values=await getMessages(auth,messageIds);

        const concisedMessages=[];
        values.forEach(valueElement=>{
            if(valueElement.value){
                // console.log(valueElement.value.data.id);
                // console.log(valueElement.value.data.snippet);
                // console.log("    ====payload.headers====");
                // console.log(valueElement.value.data.payload.headers);
                concisedMessages.push(conciseMessage(valueElement.value.data));
            }else{
                console.log("Unknown Error with particular Message")
            }
        })

        console.log(concisedMessages.length);

        // Filter the concised messages based on emailIds and domains provided in filter
        const emailAndDomainFilteredMessages=concisedMessages.filter(message=>filterMessage(message,filter));

        // Log to test
        console.log(emailAndDomainFilteredMessages.length);
        emailAndDomainFilteredMessages.forEach(message=>console.log(message));

        // Return the  new messages
        return emailAndDomainFilteredMessages;
    }
    catch(err){
        console.log("Error in getting new filtered messages.");
        throw err;
    }
    
}