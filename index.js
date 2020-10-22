const fs=require('fs');
const readline=require('readline');
const {google} = require('googleapis');

const {listLabels,listMessages, syncClient, listHistory}=require('./gmailAPI');

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
    authorize(JSON.parse(content),list);
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
 * Lists the next 10 events on the user's primary calendar
 * @param {google.auth.oAuth2} auth An authorized OAuth2 client
 */
function list(auth) {
    // Get Gmail labels
    // listLabels(auth);

    // Get Messages
    // listMessages(auth);

    //Sync with Gmail 
        // syncClient(auth)
        // .then(()=>{
        //     console.log("syncClient complete successfully")
        // })
        // .catch((err)=>{
        //     console.log("Error with syncClient "+err);
        // })

    // List History
    listHistory(auth)
    .then((messageIds)=>{
        console.log("listHistory Ran Successfully. Here are Message Added Ids");
        messageIds.messagesAddedIds.forEach(messageId=>{
            console.log(`Message Id: ${messageId}`);
        })
        console.log("Done");
    })
    .catch(err=>{
        console.log("Error with listHistory "+err);
    })
    
}