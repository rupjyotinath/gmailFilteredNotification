const { google } = require("googleapis");
const notifier=require('node-notifier');
const fs=require('fs');
const { compileFunction } = require("vm");

/**
 * List the labels in the user's account
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
 * Gets messages from message id's
 * @param {google.auth.OAuth2} auth 
 * @param {Array} messages An array containing message ids, can be obtained from users.messages.list or users.history.list 
 */
async function getMessages(auth,messages){
    const gmail=google.gmail({version:'v1',auth});
    if(messages.length<1){
        throw new Error("getMessages requires atleast one message id");
    }
    try{
        const promises=[];
        
        messages.map((id)=>{
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
            // notifier.notify('All messages downloaded and read.') // It works
        });

        // WORKING FOR LOOP But Slow since its series.
        // for(let i=0;i<messages.length;i++){
        //     const id= messages[i].id;
        //     try{
        //         const res=await gmail.users.messages.get({
        //             id:id,
        //             userId:'me'
        //         });
        //         console.log(res.data.id)
        //         console.log(res.data.labelIds);
        //         console.log(res.data.snippet)
        //     }
        //     catch(err){
        //         console.log('Unable to get Individual messages:'+err);
        //     }
            
        // }  
    }
    catch(err){
        return console.log('Error in API'+err);
    }
}

async function listHistory(auth, nextPageToken=null){
    console.log(nextPageToken)
    let historyId=null;
    let messageIds={};
    messageIds.messagesAddedIds=[];
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
        console.log('**History Array**')
        console.log(res.data);
        console.log(res.data.history); // May not be present if no data
        // If history array not present , return the object messageIds directly.
        if(!res.data.history){
            return messageIds;
        }
        // Else continue

        res.data.history.forEach(history=>{
            console.log(history.id);
            console.log(history.messages)
            if(history.messagesAdded){
                history.messagesAdded.forEach(message=>{
                    console.log(message)
                    console.log(message.message);
                    console.log(message.message.id);
                    console.log(message.message.snippet);
                    messageIds.messagesAddedIds.push(message.message.id);
                })
            }
        })
        console.log(res.data.historyId)
        console.log(res.data.nextPageToken) // Will be undefined if no other page
        if(res.data.nextPageToken){
            try{
                const returnedMesageIds=await listHistory(auth, res.data.nextPageToken);
                if(returnedMesageIds.messagesAddedIds){
                    returnedMesageIds.messagesAddedIds.forEach(messageId=>{
                        messageIds.messagesAddedIds.push(messageId);
                    })
                }
            }
            catch(err){
                throw err;
            }
        }
        return messageIds;
    }
    catch(err){
        console.log('WARNING Error while executing Gmail API');
        throw err;
    }
}


/**
 * Syncs with Gmail to get the latest historyId and messageId
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
        console.log('mostRecentMessageId:',mostRecentMessageId);
        console.log('mostRecentHistoryId:',mostRecentHistoryId);
        console.log('Message Snippet:')
        console.log(mostRecentMesage.data.snippet);

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
 * Updates the sync.json file and sync-backup.json file, used as part of the synchronization process
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

module.exports={
    listLabels,
    getMessages,
    listMessages,
    listHistory,
    syncClient
}

