const { google } = require("googleapis");
const notifier=require('node-notifier');

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

module.exports={
    listLabels,
    listMessages
}

