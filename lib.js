/**
 * Returns a concised version of message Object, which removes all unnecessary data
 * @param {Object} message The email message object obtained from a users.messages.get 
 * @returns {Object} concisedMessage
 */
function conciseMessage(message){
    const concisedMessage={};

    if(!message.id && !message.snippet && message.payload && message.payload.headers){
        throw new Error("message passed to conciseMessage not proper, id, snippet, headers missing")
    }
    concisedMessage.id=message.id;
    concisedMessage.snippet=message.snippet;

    const messageHeaders=message.payload.headers;
    // console.log(messageHeaders);
    const headerFrom=messageHeaders.find(({name})=>name==='From');
    console.log(headerFrom)

    if(headerFrom){
        concisedMessage.from=headerFrom.value;
    }

    let senderName;
    let senderEmail;
    if(headerFrom){
        const headerFromValue=headerFrom.value.split(" <");
        console.log(headerFromValue)
        if(headerFromValue.length===2){
            senderName=headerFromValue[0];
            senderEmail=headerFromValue[1];
        }
        else{
            senderEmail=headerFromValue[0];
        }        
        senderEmail=senderEmail.substring(0,senderEmail.length-1);
        if(!senderName && senderEmail){
            senderName=senderEmail.split("@")[0];
        }
    }

    let domain;
    if(senderEmail){
        domain=senderEmail.split("@")[1];
    }

    concisedMessage.senderEmail=senderEmail;
    concisedMessage.senderName=senderName;
    concisedMessage.domain=domain;

    console.log(concisedMessage);

    return concisedMessage;
}

module.exports={
    conciseMessage
}