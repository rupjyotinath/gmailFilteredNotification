const { google } = require("googleapis");
const fs=require('fs');

/**
 * Gets messages from message id's
 * @param {google.auth.OAuth2} auth 
 * @param {Array} messageids An array containing message ids, can be obtained from users.messages.list or users.history.list 
 */
async function getMessages(auth,messageids){
    const gmail=google.gmail({version:'v1',auth});
    if(messageids.length<1){
        throw new Error("getMessages requires atleast one message id");
    }
    try{
        const promises=[];
        
        messageids.map((id)=>{
            promises.push(gmail.users.messages.get({
                            id:id,
                            userId:'me'
                        }));
        });

        return Promise.allSettled(promises);
    }
    catch(err){
        console.log("Error in getting messages.");
        throw err;
    }
}

/**
 * Function returns the newly added messages according to changes in the user mailbox's history.
 * It also saves the returns the current history Id.
 * Runs the users.history.list Gmail API and corcerned only newly added messages.
 * It is the Google recommended way (polling) for user email changes for installed apps.
 * @param {*} auth Google oauth2 client
 * @param {*} nextPageToken To retrieve specific page of result
 */
async function listHistory(auth, nextPageToken=null){
    let historyId;
    let newMessages={};
    newMessages.messagesAdded=[];
    try{
        const data=fs.readFileSync('./sync.json');
        const syncInfo=JSON.parse(data);
        if(syncInfo.mostRecentHistoryId)
            historyId=syncInfo.mostRecentHistoryId;
        else{
            throw new Error('startHistoryId not available')
        }
    }
    catch(err){
        throw err;
    }
    const gmail=google.gmail({version:'v1',auth});
    try{
        const res=await gmail.users.history.list({
            userId:'me',
            maxResults:50,
            startHistoryId:historyId,
            labelId:'INBOX',
            historyTypes:['MESSAGE_ADDED'],
            pageToken:nextPageToken?nextPageToken:null
        });
        // console.log(res);
        // console.log('**History Array**')
        // console.log(res.data);
        // console.log(res.data.history); // May not be present if no data
        // If history array not present , return the object messageIds directly.
        if(!res.data.history){
            return newMessages;
        }
        // Else continue

        res.data.history.forEach(history=>{
            // console.log(history.id);
            // console.log(history.messages)
            if(history.messagesAdded){
                history.messagesAdded.forEach(message=>{
                    // console.log(message)
                    // console.log(message.message); // Contains only id, threadId and labelIds.
                    // console.log(message.message.id);
                    newMessages.messagesAdded.push(message.message);
                })
            }
        })
        // console.log(res.data.historyId)
        newMessages.historyId=res.data.historyId;
        // console.log(res.data.nextPageToken) // Will be undefined if no other page
        if(res.data.nextPageToken){
            try{
                const returnedNewMessages=await listHistory(auth, res.data.nextPageToken);
                if(returnedNewMessages.messagesAdded){
                    returnedNewMessages.messagesAdded.forEach(message=>{
                        newMessages.messagesAdded.push(message);
                    })
                }
            }
            catch(err){
                throw err;
            }
        }
        return newMessages;
    }
    catch(err){
        console.log('WARNING Error while executing Gmail API');
        throw err;
    }
}


/**
 * Syncs with Gmail to get the latest historyId and messageId
 * The sync.json file used here will subsequently be used to get history changes.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client
 */
async function syncClient(auth){
    console.log("Syncing with Gmail")
    const gmail=google.gmail({version:'v1',auth});
    try{
        const res=await gmail.users.messages.list({
            includeSpamTrash:false,
            labelIds:['INBOX'],
            maxResults:1,
            q:'category:primary',
            userId:'me'
        });
        const mostRecentMessageId=res.data.messages[0].id;
        const mostRecentMesage= await gmail.users.messages.get({
            userId:'me',
            id:mostRecentMessageId
        });
        const mostRecentHistoryId=mostRecentMesage.data.historyId;

        // For Debugging
        // console.log('mostRecentMessageId:',mostRecentMessageId);
        console.log('mostRecentHistoryId:',mostRecentHistoryId);
        // console.log('Message Snippet:')
        // console.log(mostRecentMesage.data.snippet);

        let content=null;
        try{
            content=fs.readFileSync('./sync.json');
        }
        catch(err){
            console.log("WARNING: Error in raeding sync.json file, will create new file");
            // throw err; Don't throw , will create new file
        }        
        const syncInfo={
            mostRecentMessageId,
            mostRecentHistoryId
        }
        // content not present means, the sync.json is not read properly
        if(!content){
            updateSyncFile(syncInfo,syncInfo);
        }
        else{
            // Verify that content is an Object containing mostRecentMessageId and mostRecentHistoryId
            // The sync.json file may be corrupted or doesn't contain the desired key-value pairs
            let oldSyncInfo=null;
            try{
                oldSyncInfo=JSON.parse(content);
            }
            catch(err){
                // Error in parsing
                console.log("WARNING: sync.json file corrupted, JSON.parse failed");
            }

            if(oldSyncInfo){
                // This function throws error in case of error, it will be caught in below catch block.
                updateSyncFile(syncInfo,oldSyncInfo);
            }
            else{
                // The content in sync.json file is corrupted, hence the sync-backup file should also contain 
                // the updated syncInfo
                updateSyncFile(syncInfo,syncInfo);
            }
        }

    }
    catch(err){
        console.log("Error while syncing Gmail "+err.message);
        throw err;
    }
}


/**
 * Updates the sync.json file and sync-backup.json file, used as part of the synchronization process.
 * Also used to save latest history id whenever new message found.
 * @param {Object} newSyncInfo Object containing the latest historyId and messageId to save
 * @param {Object} oldSyncInfo Object containing the previous historyId and messageId to save
 */
function updateSyncFile(newSyncInfo, oldSyncInfo){
    try{
        fs.writeFileSync('./sync.json',JSON.stringify(newSyncInfo));
        // Create a backup of previous histotyId and messageId (oldSyncInfo)
        fs.writeFileSync('./sync-backup.json',JSON.stringify(oldSyncInfo));
    }catch(err){
        console.log("Error while updating sync files"+err);
        throw err;
    }
}

/*
                NOTICE
THE BELOW FUNCTION listLabels IS TAKEN FROM GOOGLE GMAIL NODE.JS QUICKSTART PROJECT 
VISIT https://developers.google.com/gmail/api/quickstart/nodejs OR RESPECTIVE GMAIL API PROJECT.

THE CODE IS PROBABLY APACHE 2.0 LICENSED. CHECK THE LINK OR THEIR RELEVANT GITBUB REPOSITORY.

ALL OTHER CODE IN THIS FILE IS SOLELY WRITTEN BY ME AND MIT LICENSED.

*/

/**
 * List the labels in the user's account, NOT USED IN THIS VERSION OF PROJECT . FOR FUTURE USE.
 * Used to get Lables for understanding Gmail labels.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client
 */
function listLabels(auth) {
    const gmail=google.gmail({version:'v1',auth});
    gmail.users.labels.list({
        userId:'me'
    },(err,res)=>{
        if(err) return console.log('The API returned an error: '+err);
        const labels = res.data.labels;
        if(labels.length){
            console.log('Labels:');
            labels.forEach((label)=>{
                console.log(label.name);
                console.log(label);
            })
        }
        else{
            console.log('No labels found');
        }
    })
}

/**
 * Gets and displays messages. 
 * Currently, this function is not used. For future use.
 */
async function listMessages(auth) {
    const gmail=google.gmail({version:'v1',auth});
    try{
        const res=await gmail.users.messages.list({
            includeSpamTrash:false,
            labelIds:['INBOX'],
            maxResults:5,
            q:'category:primary',
            userId:'me'
        });
        // console.log(res)
        console.log(res.data);
        const messages=res.data.messages;
        console.log('****Get Messages Individually****');
        
        const promises=[];
        
        messages.map((message)=>{
            promises.push(gmail.users.messages.get({
                            id:message.id,
                            userId:'me'
                        }));
        });

        Promise.allSettled(promises).then(values=>{
            values.forEach(valueElement=>{
                if(valueElement.value){
                    console.log(valueElement.value.data.id);
                    console.log(valueElement.value.data.snippet);
                    // console.log("    ====payload.headers====");
                    // console.log(valueElement.value.data.payload.headers);

                }else{
                    console.log("Unknown Error with particular Message")
                }
            })
        });
    }
    catch(err){
        return console.log('Error in API'+err);
    }
}

module.exports={
    listLabels,
    getMessages,
    listMessages,
    listHistory,
    syncClient,
    updateSyncFile
}

